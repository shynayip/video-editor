# Sticker and Cutout Eight-Handle Resize Design

## Goal

Give selected sticker and cutout overlays a compact transform frame with eight manual resize handles. Users can resize width and height independently, matching the free-transform behavior requested for the editor preview.

## Interaction Design

- Selected stickers and cutouts show four corner handles and four side handles.
- Left and right handles change width only.
- Top and bottom handles change height only.
- Corner handles change width and height together without forcing the original aspect ratio.
- Resizing anchors the opposite edge or corner, so the overlay does not jump while dragging.
- Moving, rotating, duplicating, deleting, Undo, and Redo continue to work.
- Pointer interactions remain constrained to the preview area and enforce a small minimum size.

## Sizing

- New stickers and cutouts start with a smaller default transform box than the current implementation.
- Existing projects remain readable. Missing width or height values fall back to the legacy scale-based dimensions.
- Once an existing overlay is resized, explicit width and height values are stored on that clip.

## Architecture

- Extend sticker and cutout transform data with normalized width and height values.
- Add a shared directional-resize calculation in `editorLogic.ts` so both overlay types use identical geometry.
- Update preview interaction state to record the active handle and starting rectangle.
- Render the same eight-handle control pattern for stickers and cutouts.
- Keep rotation separate from resizing and preserve the existing quick actions.

## Boundaries

- This change affects preview transform controls only.
- It does not change cutout masking, timeline trimming, media playback, or rendering order.
- Free resizing may intentionally stretch sticker and cutout content.

## Testing

- Unit-test all eight resize directions, opposite-edge anchoring, minimum size, and preview bounds.
- Add UI source tests confirming eight handles render for both sticker and cutout overlays.
- Run the editor logic suite, UI tests, TypeScript, and lint checks.

