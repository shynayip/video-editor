# Overlay Drag and Embedded Audio Design

## Goal

Make overlay clips behave like independent timeline clips that users can move to an exact time and overlay row. Keep a video's original sound inside its video clip, while reserving the Audio track for separately imported music or recorded narration.

## Overlay movement

- A user can drag the body of an overlay clip horizontally to change its start frame.
- A user can drag the clip vertically to another overlay row.
- The drop position is calculated from the pointer position inside the timeline content area.
- A clip cannot be positioned before frame 0 or beyond the visible main timeline duration.
- Dropping onto an occupied time range creates or uses another available overlay row so clips do not stack incoherently in one row.
- Moving an overlay does not change the main track, captions, or audio.
- One completed drag creates one Undo/Redo history entry.
- Trim handles continue to adjust duration and do not start a move drag.

## Embedded video audio

- Main and overlay video clips store and control their own volume.
- Original video sound plays from the selected timeline video source without a duplicate Main audio clip.
- Selecting a video clip shows its Speed and Volume controls in the right panel.
- Clicking empty timeline space clears the clip selection and hides clip-specific controls.
- Editing, splitting, trimming, deleting, or moving a video affects only that selected video clip.

## Standalone audio

- The Audio track is hidden when there are no standalone audio clips.
- The Audio track appears when the user imports separate music or records narration.
- Standalone audio remains independently selectable, movable, splittable, trimmable, and adjustable.

## Data flow

- A pure timeline helper receives a clip ID, target start frame, and target overlay row, then returns updated clips.
- The component records pointer-down state, previews movement during pointer movement, and commits one history update on pointer-up.
- Overlay rows are derived from `overlayLane`; lane allocation prevents overlap in a single row.
- Initial project state no longer creates a duplicate audio clip for the main video.

## Validation

- Unit tests cover horizontal movement, vertical movement, frame clamping, overlap lane allocation, and isolation from other tracks.
- Unit tests confirm initial video sound does not require a duplicate audio timeline item.
- Component lint and TypeScript checks must pass.
- Live browser verification confirms dragging in both directions and conditional Audio track visibility.
