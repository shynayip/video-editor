# Effect and Filter Auto-Selection

## Goal

Make the Effects and Filters controls immediately usable without requiring the user to discover that a timeline clip must be selected first.

## Interaction

When the user opens Effects or Filters:

1. Keep the current selection if it is a main-track or overlay-track video clip.
2. Otherwise select the visible overlay clip under the red playhead, if one exists.
3. Otherwise select the main-track clip under the red playhead.
4. If the playhead is not over a video, select the first main-track video clip.
5. If the timeline has no video clips, leave the visual choices disabled.

The chosen clip becomes the target for effect and filter changes. Audio, captions, text, and stickers remain unchanged.

## Implementation Boundary

Add one selection helper in `editorLogic.ts` and use it when opening the Effects or Filters tabs in `Composition.tsx`. Keep the existing effect/filter application and undo/redo behavior.

## Verification

- Unit-test the selection priority and empty-timeline behavior.
- Verify both tabs call the same selection flow.
- Run the existing editor logic and UI tests, lint, and TypeScript checks.
