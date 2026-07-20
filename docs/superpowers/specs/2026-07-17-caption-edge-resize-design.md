# Caption Edge Resize Design

## Goal

Make a selected caption resize directly from its visible cyan selection boundary. The caption body remains draggable for movement, while resize handles provide a familiar video-editor interaction.

## Interaction

- A selected active caption shows eight white handles: four corners and four edge centers.
- Dragging inside the caption moves it and keeps the four-arrow move cursor.
- Dragging any handle resizes the caption uniformly by changing its font size.
- Each handle uses the matching directional resize cursor.
- Dragging outward enlarges the caption; dragging inward shrinks it.
- The caption remains within the preview and is limited to the largest font size that fits.
- Only the selected caption changes. Other captions and timeline tracks remain unchanged.
- One completed gesture creates one undo entry. A gesture that produces no change creates none.

## Implementation

- Add a caption resize-handle direction type for top, top-right, right, bottom-right, bottom, bottom-left, left, and top-left.
- Add a pure helper that projects pointer movement onto the selected handle's outward direction and converts that distance into a clamped font size.
- Store the active handle direction in the caption resize gesture state.
- Render eight pointer handles inside the selected caption boundary.
- Remove the detached preview-corner resize control.
- Exclude every handle from caption DOM measurement clones so fit calculations measure text only.

## Verification

- Unit-test inward and outward resizing from horizontal, vertical, and diagonal handles.
- Verify the minimum and measured maximum font-size bounds.
- Verify all eight handle classes and directional cursors are present.
- Run focused caption/editor tests, scoped ESLint, TypeScript, and a live browser console check.

## Out Of Scope

- Independent horizontal or vertical text distortion.
- Changing caption duration or timeline position through the preview handles.
- Resizing unselected or inactive captions.
