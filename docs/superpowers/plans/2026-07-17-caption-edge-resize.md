# Caption Edge Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eight directly draggable resize handles to the selected caption boundary while preserving caption movement, fit limits, selection isolation, and undo behavior.

**Architecture:** A pure resize-projection helper converts pointer movement and a handle direction into a font size. `Composition.tsx` stores the active handle direction for each gesture and renders eight pointer handles inside the selected caption, while the existing measured-fit and history code remains responsible for canvas containment and undo.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner, Remotion/Vite.

## Global Constraints

- Only the selected active caption may resize.
- Dragging the caption body continues to move it.
- All eight handles resize uniformly without distorting text.
- Captions remain inside the preview and no-op gestures create no history.
- Do not change caption timing or other timeline tracks.

---

### Task 1: Directional Caption Resize Calculation

**Files:**
- Modify: `src/editorLogic.ts:1252-1272`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `CaptionResizeHandle` union and `getResizedCaptionFontSizeFromHandle(args): number`.
- Consumes: the existing 12px minimum and 160px maximum caption font-size limits.

- [ ] **Step 1: Write failing directional projection tests**

Add tests that call the helper from right, left, top, bottom, and diagonal handles. Assert outward pointer movement enlarges, inward movement shrinks, and results remain within `12..160`.

```ts
assert.equal(getResizedCaptionFontSizeFromHandle({
  startFontSize: 40,
  startX: 100,
  startY: 100,
  pointerX: 140,
  pointerY: 100,
  handle: "right",
}), 60);

assert.equal(getResizedCaptionFontSizeFromHandle({
  startFontSize: 40,
  startX: 100,
  startY: 100,
  pointerX: 140,
  pointerY: 100,
  handle: "left",
}), 20);
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --no-warnings --test tests/editorLogic.test.mts`

Expected: FAIL because `getResizedCaptionFontSizeFromHandle` is not exported.

- [ ] **Step 3: Implement directional pointer projection**

```ts
export type CaptionResizeHandle =
  | "top-left" | "top" | "top-right" | "right"
  | "bottom-right" | "bottom" | "bottom-left" | "left";

const handleVectors: Record<CaptionResizeHandle, {x: number; y: number}> = {
  "top-left": {x: -1, y: -1}, top: {x: 0, y: -1},
  "top-right": {x: 1, y: -1}, right: {x: 1, y: 0},
  "bottom-right": {x: 1, y: 1}, bottom: {x: 0, y: 1},
  "bottom-left": {x: -1, y: 1}, left: {x: -1, y: 0},
};
```

Normalize the vector, project `(pointer - start)` onto it, add half the projected distance to `startFontSize`, round, and clamp to `12..160`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `node --no-warnings --test tests/editorLogic.test.mts`

Expected: all editor-logic tests pass.

---

### Task 2: Eight On-Caption Resize Handles

**Files:**
- Modify: `src/Composition.tsx:1078-1088,3080-3128,4077-4131,5680-5730`
- Modify: `src/index.css:1391-1447`
- Modify: `tests/caption-ui.test.mts:88-115`

**Interfaces:**
- Consumes: `CaptionResizeHandle` and `getResizedCaptionFontSizeFromHandle` from Task 1.
- Produces: eight `.caption-resize-handle-<direction>` elements on the selected caption.

- [ ] **Step 1: Write a failing UI structure test**

Assert the selected caption renders all eight handle class names and passes each direction into `startCaptionResizeDrag`. Assert CSS contains the appropriate `ns-resize`, `ew-resize`, `nesw-resize`, and `nwse-resize` cursors.

```ts
for (const handle of [
  "top-left", "top", "top-right", "right",
  "bottom-right", "bottom", "bottom-left", "left",
]) {
  assert.match(previewCaptions, new RegExp(`caption-resize-handle-${handle}`));
}
```

- [ ] **Step 2: Run the UI test and confirm RED**

Run: `node --no-warnings --test tests/caption-ui.test.mts`

Expected: FAIL because the eight caption-bound handles are not rendered.

- [ ] **Step 3: Store the handle direction in gesture state**

Add `handle: CaptionResizeHandle` to `CaptionResizeDrag`. Update `startCaptionResizeDrag(event, clip, handle)` and use `getResizedCaptionFontSizeFromHandle` during pointer movement.

- [ ] **Step 4: Render eight selected-caption handles**

Render eight pointer-only spans inside the selected caption. Each span receives `caption-resize-handle`, a direction class, and calls `startCaptionResizeDrag(event, captionClip, handle)`.

Remove the detached `.caption-resize-handle-canvas` button. Update measurement cloning to remove every `.caption-resize-handle` before measuring the caption text.

- [ ] **Step 5: Position and style every handle**

Use absolute positions at the four corners and edge centers. Use 14px white circular handles with dark borders and directional cursors. Keep `pointer-events: auto` and `touch-action: none`.

- [ ] **Step 6: Run focused verification**

Run:

```powershell
node --no-warnings --test tests/caption-ui.test.mts tests/editorLogic.test.mts
npx.cmd eslint src/Composition.tsx src/editorLogic.ts tests/caption-ui.test.mts tests/editorLogic.test.mts
npx.cmd tsc --noEmit
```

Expected: all focused tests pass, ESLint exits 0, and TypeScript exits 0.

- [ ] **Step 7: Verify the running editor**

Reload `http://localhost:5173/`, select a caption, and confirm the eight handles remain visible, inward dragging shrinks, outward dragging enlarges, the caption body still moves, and the browser console has no errors.
