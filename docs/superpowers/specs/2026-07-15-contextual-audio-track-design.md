# Contextual Audio Track Design

## Goal

Keep the timeline compact by showing the Audio track only when the user is working with a Main track clip or its audio.

## Interaction

- The Audio track is hidden when the editor first opens.
- Selecting a Main track clip or the Main track lane reveals the Audio track.
- Selecting the Audio track or an audio clip keeps the Audio track visible so it remains editable.
- Selecting an Overlay, Sticker, Text, or Caption track hides the Audio track.
- Audio clips remain in timeline data while hidden. Hiding the row must not delete, mute, trim, or otherwise edit audio.
- Main video and audio clips remain independently editable.

## Implementation Boundary

The editor component will store whether the contextual Audio row is visible. Track and clip selection will update that visibility using one shared rule. Timeline row construction will include the Audio row only when audio clips exist and the contextual visibility flag is active.

## Testing

A unit-tested selection rule will cover Main, Audio, Overlay, Sticker, and Caption selections. Existing timeline tests and TypeScript checks must continue to pass.
