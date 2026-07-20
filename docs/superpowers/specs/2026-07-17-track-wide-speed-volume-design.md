# Track-Wide Speed and Volume Controls

## Goal

Allow users to apply one speed or volume value to every video on the same video track by selecting the track's blank space, while preserving the existing ability to edit one selected clip independently.

## Interaction Design

- Clicking a video clip selects that clip. Speed and volume changes affect only that clip and its reciprocal linked audio clip.
- Clicking blank space in the main track or any signed video layer selects the whole video track and clears the individual clip selection.
- A selected track uses the existing selected-lane highlight. A selected clip continues to use the existing selected-clip highlight.
- The details panel identifies whether the controls currently target a clip or a track.
- Track speed and volume sliders show a shared value when all clips agree. If clips have different values, the controls start from a neutral value of `1.00x` for speed and `100%` for volume; the next slider change applies that exact value to every clip on the track.

## Editing Rules

- Track-wide speed updates every video clip whose signed video-layer number matches the selected layer.
- Track-wide volume updates every video clip on that layer.
- Each affected video's reciprocal linked audio clip receives the same speed or volume update so playback remains synchronized.
- Independent narration, background music, captions, text, stickers, cutouts on other tracks, and clips on other video layers remain unchanged.
- A track-wide operation is committed as one timeline history edit, so one Undo restores all affected clips.
- Returning to a single clip selection switches the sliders back to clip-only behavior.

## State and Data Flow

- Add an explicit selected-video-layer state that distinguishes whole-track selection from clip selection.
- Blank-lane pointer handling selects the lane and clears `selectedClipId` without seeking to a clip under the playhead.
- Clip pointer handling clears whole-track targeting and keeps the existing clip selection behavior.
- The details panel derives its label, values, and enabled state from either the selected clip or selected video layer.
- Pure editor-logic helpers apply speed and volume by signed video-layer number and update reciprocal linked audio clips.

## Error and Empty States

- Track-wide controls are disabled when the selected video layer has no video clips.
- Invalid speed or volume values leave the clip array unchanged, following existing editor-logic conventions.
- If a legacy video clip has no reciprocal linked audio, the video is still updated and unrelated audio remains untouched.

## Testing

- Unit tests verify track-wide speed and volume affect every video on the requested layer and only reciprocal audio.
- Unit tests verify other layers, narration, captions, and unrelated audio are unchanged.
- UI source tests verify blank-lane selection clears clip selection and routes controls to track-wide helpers.
- Browser verification checks clip-only editing, whole-track editing, selected-lane feedback, and one-step Undo.
