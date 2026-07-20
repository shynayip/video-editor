# Caption Canvas Editing Design

## Goal

Allow a user to reposition and resize one selected caption directly in the video preview. Editing one caption must not change the other captions in the group or alter any caption timing.

## Interaction

- Clicking an active caption in the preview selects that caption clip.
- Dragging the selected caption moves it within the visible video frame.
- A single resize handle appears at the selected caption's lower-right corner.
- Dragging the resize handle changes only that caption's font size.
- The selection outline and resize handle are editor controls and are not part of the rendered video.
- Caption movement is clamped so the caption remains inside the preview frame.
- Caption font size is clamped to a usable range of 12 to 160 pixels.
- A completed move or resize creates one undoable timeline-history entry.

## Data Model

`CaptionOverlay` will store `x` and `y` as percentage coordinates relative to the preview frame. Existing captions that do not have coordinates use `x: 50` and `y: 82`, preserving the current bottom-center placement.

Position and font size remain properties of each caption clip. Auto-generated captions, manually entered captions, and imported subtitle captions therefore use the same editing behavior without introducing a separate caption group style.

## Components And Data Flow

The preview caption component will follow the existing text-overlay interaction pattern:

1. Pointer down selects the caption and records its original clips, pointer position, and rendered caption bounds.
2. Pointer movement converts the cursor delta to preview percentages and updates the selected caption in the current history state.
3. Pointer up or cancellation commits the original state to undo history once.
4. Resize pointer movement derives a font size from diagonal movement and updates only the selected caption.

Pure helpers in `editorLogic.ts` will own caption movement, resizing, defaults, and clamping. `Composition.tsx` will own pointer lifecycle and preview rendering. CSS will provide the selected outline, move cursor, and resize handle.

## Compatibility And Error Handling

- Missing `x` or `y` values in existing saved projects fall back to the current bottom-center location.
- A missing caption payload or unavailable preview bounds cancels the interaction without changing the project.
- Pointer cancellation uses the same cleanup and history behavior as pointer release.
- Selection and editing remain available only for captions active at the current playhead frame.

## Testing

- Unit tests will cover default position, per-caption movement, frame clamping, and font-size clamping.
- UI source tests will verify caption pointer handlers, the selected-only resize handle, percentage positioning, and editor-only controls.
- The complete test suite, lint, and production build must pass.

## Out Of Scope

- Rotating captions.
- Moving or resizing an entire caption group at once.
- Changing caption timing through the preview canvas.
- Automatic line wrapping controls.
