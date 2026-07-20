# Movable Text Clips Design

## Goal

Allow a text clip to be positioned independently in two dimensions:

- Horizontally on the timeline to control when the text appears.
- Horizontally and vertically in the video preview to control where the text appears.

The full text must remain visible inside the preview frame.

## Interaction Design

### Timeline movement

The body of a text clip on the Text track is draggable. Dragging it horizontally changes its `start` frame while preserving its duration and all visual properties. The clip is clamped between frame `0` and the end of the current main-track duration.

The pointer keeps its original offset inside the clip, so the clip does not jump when dragging begins. Existing left and right trim handles remain dedicated to trimming and do not start a move operation.

### Preview movement

When a text clip is active at the playhead, its rendered text can be dragged directly in the preview. The drag updates the text overlay's `x` and `y` position. The text element's measured dimensions are used to clamp movement so none of the text can be dragged outside the preview frame.

Clicking or starting a drag on preview text selects the matching timeline clip. The selected text keeps the existing visible selection treatment.

### History

Each completed timeline drag or preview drag creates one history entry. Pointer-move updates during the same drag do not create separate entries. Undo restores the position before the drag; Redo reapplies the completed position.

## Data Model

No new track type is required. Text clips continue to use the `caption` track and the existing fields:

- `start` and `duration` for timeline placement.
- `text.x` and `text.y` for preview placement.
- `text.content`, `text.fontSize`, and `text.color` for appearance.

Pure editor helpers will calculate clamped timeline and preview positions. React pointer handlers will translate pointer coordinates into those helpers and commit the final result to timeline history.

## Component Boundaries

- `editorLogic.ts` owns pure movement and clamping calculations.
- `Composition.tsx` owns pointer capture, drag-session state, preview measurement, selection, and history commits.
- `index.css` owns move cursors and selected/dragging visual states.

Timeline dragging and preview dragging use separate interaction state so media dragging, overlay lane movement, sticker manipulation, timeline scrubbing, and trimming remain unchanged.

## Edge Cases

- A text clip cannot start before frame `0`.
- A text clip cannot extend past the current main-track duration when moved.
- Preview text remains fully inside all four preview edges.
- Movement stops safely on pointer-up or pointer-cancel.
- Starting a trim operation does not start a move operation.
- A drag that produces no position change does not add a history entry.
- Missing text metadata causes no movement and no error.

## Verification

Unit tests will cover:

- Moving a text clip to an exact timeline frame.
- Clamping at the beginning and end of the timeline.
- Preserving duration and visual text properties.
- Clamping preview coordinates using the measured text size.
- Returning unchanged clips for invalid identifiers or no-op moves.

UI verification will cover:

- Dragging the text clip along the Text track.
- Dragging active text around the preview.
- Keeping text fully visible at every preview edge.
- Trimming without accidentally moving.
- Undoing and redoing each type of drag as a single action.

## Out of Scope

This change does not add text animation, rotation, resizing, font selection, multi-select movement, snapping, or keyframes.
