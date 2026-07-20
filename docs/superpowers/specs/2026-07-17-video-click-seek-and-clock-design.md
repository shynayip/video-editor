# Video Click Seek And Timeline Clock Design

## Goal

Make timeline video interaction consistent across main, overlay, and additional video layers. Clicking a video clip should select it and move the red playhead to the exact clicked frame. The timeline summary should show the current playback time beside the total project duration.

## Interaction

- A pointer press on a video clip calculates the frame from the pointer's horizontal position in the shared timeline canvas.
- The calculated frame is clamped to the clicked clip's visible timeline range and the project duration.
- The clicked clip remains selected and retains its existing contextual audio behavior.
- Existing clip dragging continues to start from the same pointer press. Seeking occurs at the initial pointer location and does not follow ordinary mouse movement.
- Text, caption, audio, and non-video selection behavior remains unchanged.

## Time Display

- Replace `frames / duration` with `current time / total time`.
- Both values use a fixed `HH:MM:SS` format, including durations shorter than one hour.
- The current value follows the playhead during playback and manual scrubbing.
- The total value follows the computed project duration.

Example: `00:00:16 / 00:01:00`.

## Implementation Boundaries

- Reuse the timeline's existing pointer-to-frame conversion so scrolling and timeline scaling remain correct.
- Add a dedicated fixed-width clock formatter rather than changing the existing ruler formatter, because ruler labels are intentionally compact.
- Apply exact-position seeking only to video timeline clips: main, upper/overlay, and video cutout clips.

## Verification

- A regression test proves clicking a video clip derives and applies the pointer frame before starting drag behavior.
- A formatting test covers zero, sub-hour, and hour-long timestamps.
- A UI regression test proves the summary renders `current / total` and no longer renders the frame count.
- Run the complete interface test file and TypeScript checking.
