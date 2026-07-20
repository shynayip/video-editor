# Independent Imported-Media Preview Design

## Goal

Allow users to inspect every imported video independently before adding it to the editing timeline.

## Selection Behavior

- Clicking an imported-media card selects that item and opens it in the preview canvas.
- Selection does not create, replace, or modify any timeline clip.
- Dragging imported media onto a video track remains the action that adds it to the project timeline.
- Selecting a different imported item pauses playback and resets the media-preview position to the beginning.

## Independent Playback

- The preview canvas play/pause button controls the selected imported video while media-preview mode is active.
- Media-preview playback must not change the main timeline playhead.
- The timeline toolbar play/pause button continues to control only timeline playback and switches the canvas back to timeline-preview mode.
- When media-preview playback reaches the end, it pauses at the end. Playing again restarts from the beginning.

## Media Seek Bar

- A compact seek bar appears directly below the preview canvas for selected imported videos.
- The seek bar displays the current time and total duration.
- Clicking or dragging the seek bar seeks only the selected imported video.
- The seek position follows video playback through the video element's time-update events.
- Imported images remain previewable but do not show video playback or seeking controls.

## State And Data Flow

- Timeline position remains stored in `playheadFrame`.
- Imported-media position is stored separately in seconds as media-preview time.
- `previewMode` decides which position and playback path is active.
- Changing `playheadFrame` must never reset the selected imported video's current time.
- The existing preview video element remains the rendering surface for both modes.

## Error And Empty States

- If no imported item is selected, the canvas keeps the existing media-selection prompt.
- If a video cannot play, the controls remain available and playback stays paused without changing timeline state.
- Seek values are clamped between zero and the selected video's duration.

## Verification

- Add source-level UI tests proving media play does not switch to timeline mode or update `playheadFrame`.
- Test that the timeline toolbar explicitly returns to timeline-preview mode.
- Test that selecting media resets only media-preview playback state.
- Test the presence and accessibility labels of the imported-video seek control.
- Run TypeScript and relevant UI tests.
- In the browser, select multiple imported videos, play and seek each one, and confirm the main timeline clips and red playhead remain unchanged.
