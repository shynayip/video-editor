# Sticker and Cutout Eight-Handle Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact, freely resizable sticker and cutout overlays with four corner handles and four side handles.

**Architecture:** Extend the existing normalized overlay transform with optional width and height values, then centralize directional resize geometry in a pure editor-logic helper. The preview interaction layer will call that helper for both sticker and cutout clips and render one shared eight-handle class pattern.

**Tech Stack:** React, TypeScript, Remotion, CSS, Node test runner

## Global Constraints

- Side handles resize one axis independently.
- Corner handles resize both axes without preserving aspect ratio.
- The opposite edge or corner remains anchored during resizing.
- Existing scale-only saved clips remain compatible.
- Moving, rotating, duplicating, deleting, Undo, Redo, masking, and timeline duration controls remain unchanged.

---

### Task 1: Directional Overlay Resize Geometry

**Files:**
- Modify: `src/editorLogic.ts:56-61`
- Modify: `src/editorLogic.ts` near the existing caption resize helpers
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `OverlayResizeHandle`, the eight direction string union.
- Produces: `getOverlayTransformRect(transform, fallbackWidth, fallbackHeight)` returning `{x, y, width, height}` in preview percentages.
- Produces: `resizeOverlayTransformFromHandle(options)` returning `{x, y, width, height}` in preview percentages.
- Extends: `StickerTransform` with optional `width?: number` and `height?: number`.

- [ ] **Step 1: Write failing geometry tests**

Add tests that call `resizeOverlayTransformFromHandle` for `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`, `bottom-left`, and `left`. Assert that side handles change only one dimension, corner handles change both dimensions, and the opposite edge or corner remains fixed.

```ts
assert.deepEqual(resizeOverlayTransformFromHandle({
  handle: "right",
  startRect: {x: 50, y: 50, width: 20, height: 20},
  deltaX: 10,
  deltaY: 8,
  minimumWidth: 4,
  minimumHeight: 4,
}), {x: 55, y: 50, width: 30, height: 20});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern="resizes overlay" tests/editorLogic.test.mts`

Expected: FAIL because `resizeOverlayTransformFromHandle` is not exported.

- [ ] **Step 3: Implement normalized transform geometry**

Add optional `width` and `height` to `StickerTransform`. Implement the eight-handle helper by converting the center rectangle to left, right, top, and bottom edges; moving only the edges represented by the handle; enforcing minimum dimensions; clamping all edges to `0..100`; then returning the new center and dimensions.

```ts
export type OverlayResizeHandle = CaptionResizeHandle;

export const getOverlayTransformRect = (
  transform: StickerTransform,
  fallbackWidth: number,
  fallbackHeight: number,
) => ({
  x: transform.x,
  y: transform.y,
  width: transform.width ?? fallbackWidth * transform.scale,
  height: transform.height ?? fallbackHeight * transform.scale,
});
```

- [ ] **Step 4: Test minimum size, preview bounds, and legacy fallback**

Add assertions that a handle cannot produce dimensions below `4%`, the rectangle remains inside `0..100`, and a scale-only transform resolves to scaled fallback dimensions.

- [ ] **Step 5: Run focused and full editor-logic tests**

Run: `node --test --test-name-pattern="overlay transform|resizes overlay" tests/editorLogic.test.mts`

Expected: PASS.

Run: `node --test tests/editorLogic.test.mts`

Expected: all tests pass.

---

### Task 2: Eight Preview Handles and Compact Defaults

**Files:**
- Modify: `src/Composition.tsx:1240-1335`
- Modify: `src/Composition.tsx:5198-5327`
- Modify: `src/Composition.tsx:6595-6732`
- Modify: `src/Composition.tsx:6866-6932`
- Modify: `src/index.css:1466-1554`
- Modify: `src/index.css:1774-1835`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `OverlayResizeHandle`, `getOverlayTransformRect`, and `resizeOverlayTransformFromHandle` from Task 1.
- Changes: `StickerInteraction` records `mode: "move" | "resize" | "rotate"`, optional handle, starting rectangle, and preview dimensions.

- [ ] **Step 1: Write failing UI source tests**

Assert that both selected overlay render paths contain exactly these eight directional handle classes:

```ts
const handles = [
  "top-left", "top", "top-right", "right",
  "bottom-right", "bottom", "bottom-left", "left",
];
for (const handle of handles) {
  assert.match(source, new RegExp(`overlay-resize-handle-${handle}`));
}
```

Also assert that the old `.sticker-scale-handle` and `.cutout-scale-handle` controls are no longer rendered.

- [ ] **Step 2: Run the UI tests and verify RED**

Run: `node --test --test-name-pattern="eight resize handles" tests/playhead-ui.test.mts`

Expected: FAIL because the directional controls do not exist.

- [ ] **Step 3: Wire directional resizing into sticker and cutout interactions**

When a resize handle starts, capture the resolved starting rectangle and active handle. During pointer movement, convert pixel deltas to preview percentages and call `resizeOverlayTransformFromHandle`. Store returned `x`, `y`, `width`, and `height` on the matching sticker or cutout transform. Preserve one Undo history entry per completed drag.

- [ ] **Step 4: Render the eight controls for both overlay types**

Create one local handle-name array and map it inside both selected sticker and selected cutout controls. Stop pointer propagation and invoke the relevant resize start handler.

```tsx
{overlayResizeHandles.map((handle) => (
  <button
    key={handle}
    className={`overlay-resize-handle overlay-resize-handle-${handle}`}
    type="button"
    aria-label={`Resize ${overlayKind} from ${handle}`}
    onPointerDown={(event) => startResize(event, clip, handle)}
  />
))}
```

- [ ] **Step 5: Make new overlay boxes smaller**

Set new sticker transforms to `width: 14`, `height: 14` and new cutout transforms to `width: 24`, `height: 24`. Render explicit dimensions as percentages and remove CSS dimensions that force the current oversized boxes. Keep scale-only fallback values for existing clips.

- [ ] **Step 6: Style stable eight-handle controls**

Use 10px square corner handles and short rectangular side handles. Position them at all four corners and edge midpoints with appropriate resize cursors. Keep the rotation handle and quick actions outside the transform box without changing its layout size.

- [ ] **Step 7: Run UI and static verification**

Run: `node --test tests/playhead-ui.test.mts`

Expected: all tests pass.

Run: `npx.cmd tsc --noEmit`

Expected: exit code 0.

Run: `npx.cmd eslint src`

Expected: no errors.

---

### Task 3: Browser Interaction Verification

**Files:**
- Verify: `src/Composition.tsx`
- Verify: `src/index.css`

**Interfaces:**
- Consumes: completed eight-handle preview controls from Task 2.
- Produces: verified sticker and cutout behavior at the running editor URL.

- [ ] **Step 1: Start or reuse the development server**

Run: `npm.cmd run dev`

Expected: the editor is available at the printed localhost URL.

- [ ] **Step 2: Verify sticker interaction**

Add a sticker, select it, confirm eight handles appear, drag every side and corner, and confirm width and height can be changed independently. Confirm the default box is visibly smaller and move, rotate, duplicate, delete, Undo, and Redo still work.

- [ ] **Step 3: Verify cutout interaction**

Select a cutout, confirm eight handles appear, resize from each side and corner, and confirm masking and deletion still work. Confirm the transform frame stays inside the preview.

- [ ] **Step 4: Run final regression checks**

Run: `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`

Expected: all tests pass.

Run: `git diff --check`

Expected: no whitespace errors.

