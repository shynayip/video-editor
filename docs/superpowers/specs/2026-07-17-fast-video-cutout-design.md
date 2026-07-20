# Fast Video Cutout Design

## Problem

The current video Auto cutout path runs BiRefNet Lite on every source frame. A measured 0.5-second clip took about 192 seconds even after model warm-up, making the control appear nonfunctional for ordinary clips.

## Approved Behavior

- Image Auto cutout keeps the existing BiRefNet Lite processing path.
- Video Auto cutout uses quantized MODNet (`Xenova/modnet`, `q4`) for portrait matting.
- Video frames are sampled at 10 fps for local processing speed.
- The transparent WebM keeps the selected clip's complete source duration and contains no audio; the existing linked audio clip remains unchanged.
- Existing selection, cancellation, stale-request protection, reset, trim, and split behavior remains unchanged.
- Processing failures continue to appear in the editor project status.

## Verification

- Processor tests verify separate cached image/video pipelines, MODNet q4 selection, 10 fps extraction, transparent WebM encoding, cancellation, cleanup, and duration preservation.
- Existing request, editor logic, UI, server, and TypeScript checks must remain green.
