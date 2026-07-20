# Subject-Aware Auto Cutout Design

## Goal

Make Auto cutout reliably remove the background from images and videos while retaining one primary person or product. Remotion remains responsible for previewing and rendering the transparent result; local segmentation and FFmpeg processing produce that result.

## Approved Behavior

- Auto cutout keeps one primary person or product and removes the background and secondary distractions.
- The primary subject is chosen using foreground size, proximity to the frame center, and continuity with the subject selected in nearby video frames.
- Images and videos use the same primary-subject rules.
- Person footage may use the faster portrait-matting path when its mask is confident.
- Product footage and uncertain portrait results fall back to the general foreground-removal model.
- Existing manual erase, restore, reset, split, trim, selection, cancellation, and stale-request behavior remains available.
- Video cutout preserves the complete selected source duration and does not modify or regenerate linked audio.

## Processing Architecture

### Model adapters

The background-removal processor exposes a common alpha-mask result while using model-specific adapters:

- The portrait adapter uses MODNet through its supported image-segmentation output.
- The general adapter uses BiRefNet through the background-removal pipeline.
- Runtime options must be compatible with the active Node CPU provider; an unsupported reduced-precision option must fall back to a supported quantized or full-precision model instead of failing the request.

### Subject selection

Each model result is converted to an alpha mask. Mask cleanup then:

1. Removes very small disconnected regions.
2. Scores remaining regions using area and distance from the frame center.
3. Retains the highest-scoring region as the primary subject.
4. Preserves nearby details belonging to that subject, including hair, hands, and product edges.
5. Softens the final alpha edge without making the subject translucent.

For video, the previous accepted region contributes a continuity score based on overlap and centroid distance. This prevents the selected subject from switching to another person or object between frames.

### Automatic routing

For an image or the first sampled video frame, run the portrait adapter first. Accept its result only when it contains a plausible central subject with adequate foreground coverage and edge confidence. Otherwise, run the general adapter. Video keeps the chosen route unless confidence drops, at which point the general adapter is used for that frame and subsequent uncertain frames.

### Video timing

- Extract frames over the exact selected source range.
- Segment at the configured processing cadence while preserving the original output timing.
- Reuse or interpolate neighboring alpha masks between processed frames so motion remains smooth.
- Encode a transparent VP9 WebM whose probed duration is at least the requested duration and no more than one output-frame interval longer.
- Do not apply an FFmpeg duration bound that truncates the final encoded frame.
- Keep the processed video silent because the editor already owns a linked audio clip.

### Remotion integration

The editor replaces only the selected cutout clip's visible source with the processed transparent PNG or WebM. Remotion displays that source as an ordinary layered image or video. Timeline position, source offsets, speed, transform, volume, and linked-audio identity remain unchanged.

## Failure Handling

- Report model download, initialization, decoding, segmentation, and encoding failures separately in the project status.
- Keep the original media visible if processing fails or is cancelled.
- Ignore a completed response when the selected clip changed while processing.
- Clean temporary frames and partial output files after success, failure, or cancellation.

## Verification

- Unit tests cover model routing, primary-region selection, secondary-region removal, center preference, edge cleanup, and temporal subject continuity.
- Processor tests cover images, portrait videos, product videos, fallback behavior, cancellation, cache retry, cleanup, silent transparent encoding, and duration preservation.
- Editor tests verify that processing changes only the selected cutout source and preserves linked audio and timeline properties.
- An integration fixture with two foreground objects verifies that only the central primary subject remains.
- A fractional-duration video fixture verifies that the transparent result does not lose or freeze its final frames.
- TypeScript, focused tests, and the full relevant editor suite must pass before completion.
