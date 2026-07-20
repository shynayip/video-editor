# Playhead Drag-Only Design

## Goal

Make the red timeline playhead move only when the user directly drags the playhead.

## Interaction

- Pressing and dragging the red playhead updates the current frame.
- Releasing or cancelling the pointer immediately stops playhead movement.
- Clicking an overlay, main, audio, text, sticker, or caption track selects that track or clip without moving the playhead.
- Clicking empty space in a track may select the clip active at that clicked frame, but the red playhead remains at its previous frame.
- Clicking or dragging the timeline ruler does not move the playhead.
- Clip dragging and trimming continue to work without starting playhead scrubbing.

## Implementation

- Keep `startTimelineScrub` only on the `.timeline-playhead` element.
- Remove playhead scrub initiation from timeline track lanes and the timeline ruler.
- Keep existing pointer capture and pointer-ID checks for direct playhead dragging.

## Testing

- Verify the playhead retains its direct `onPointerDown={startTimelineScrub}` handler.
- Verify track lanes do not invoke `startTimelineScrub`.
- Verify the timeline ruler does not invoke `startTimelineScrub`.
- Run editor logic tests, UI wiring tests, ESLint, TypeScript, and the local page health check.
