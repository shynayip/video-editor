# Sticker Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Stickers tab add built-in or uploaded stickers to a dedicated timeline track and allow direct preview positioning.

**Architecture:** Extend the editor model with a sticker track and sticker transform data, keeping pure state operations in `editorLogic.ts`. `Composition.tsx` owns the library, upload lifecycle, active-sticker rendering, and pointer interactions; `index.css` provides the compact library and transform controls.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, native Pointer Events, Node test runner, ESLint.

## Global Constraints

- Upload accepts PNG, WebP, and GIF.
- New stickers begin at the current red playhead and last 90 frames.
- Stickers render above video layers and remain independently selectable, trimmable, splittable, deletable, and undoable.
- Existing main, overlay, and audio behavior must remain unchanged.

---

### Task 1: Sticker Timeline Model

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `StickerTransform`, sticker fields on `TimelineClip`, `createStickerClip()`, and existing active/split/delete helpers working with `track: "sticker"`.

- [ ] **Step 1: Write failing model tests**

Add tests that call:

```ts
createStickerClip({
  id: "sticker-heart",
  label: "Heart",
  src: "heart.png",
  playheadFrame: 120,
})
```

and expect a `sticker` clip starting at frame `120`, lasting `90` frames, with `{x: 50, y: 50, scale: 1, rotation: 0}`. Add boundary tests showing `getActiveClipAtFrame()` returns the sticker at frames `120` and `209`, but not `210`.

- [ ] **Step 2: Verify the tests fail**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts
```

Expected: FAIL because `createStickerClip` and the `sticker` track are not defined.

- [ ] **Step 3: Implement the model**

Extend the types and add this pure constructor:

```ts
export type TrackName = "upper" | "sticker" | "main" | "caption" | "audio";

export type StickerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

// Add this optional field to TimelineClip:
sticker?: StickerTransform;

export const createStickerClip = ({id, label, src, playheadFrame}: {
  id: string;
  label: string;
  src: string;
  playheadFrame: number;
}): TimelineClip => ({
  id,
  label,
  src,
  track: "sticker",
  start: playheadFrame,
  duration: 90,
  color: "#f59e0b",
  sticker: {x: 50, y: 50, scale: 1, rotation: 0},
});

export const appendStickerClip = (
  clips: TimelineClip[],
  sticker: TimelineClip,
): TimelineClip[] => [...clips, sticker];
```

- [ ] **Step 4: Verify model tests pass**

Run the Node test command above. Expected: all tests PASS.

### Task 2: Working Stickers Tab And Upload

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `createStickerClip()` and `TimelineClip.sticker`.
- Produces: active tool state, built-in sticker library, upload input, and Sticker timeline row.

- [ ] **Step 1: Add a failing state-operation test**

Test `appendStickerClip()` twice with two constructed stickers at the same playhead. Expect both independent clip IDs to remain and the original main/overlay clips to be unchanged.

- [ ] **Step 2: Verify the new test fails for the missing integration helper**

Run the Node test command. Expected: FAIL because `appendStickerClip` is not yet exported.

- [ ] **Step 3: Implement the library and track**

In `Composition.tsx`, add:

```ts
type EditorTool = "media" | "stickers";
type StickerItem = {id: string; label: string; src: string; uploaded?: boolean};
```

Use an `activeTool` state, a hidden `accept="image/png,image/webp,image/gif"` input, several built-in sticker items, and an upload handler that creates object URLs. Clicking a library item calls `commitClipChange()` with `appendStickerClip(currentClips, createStickerClip(...))` at `playheadFrame`, selects the new clip, and switches `selectedTrack` to `sticker`. Add `{id: "sticker", label: "Sticker track"}` between overlay and main in `tracks`.

- [ ] **Step 4: Style the library and sticker timeline clips**

Add `.sticker-grid`, `.sticker-item`, `.sticker-preview`, and `.sticker-upload-button` styles using the existing panel dimensions and 6px-or-less radii. Sticker thumbnails must fit without changing panel size.

- [ ] **Step 5: Verify tests and lint**

Run:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts
& "C:\Program Files\nodejs\npm.cmd" run lint
```

Expected: tests PASS and lint exits `0`.

### Task 3: Preview Positioning And Final Verification

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: active sticker clips at `playheadFrame`.
- Produces: sticker rendering and pointer-based move/resize/rotate interactions.

- [ ] **Step 1: Render active sticker clips**

Filter source-backed sticker clips with `getActiveClipAtFrame` boundary semantics and render each as an absolutely positioned `<img>` above preview videos. Position with percentage coordinates and apply scale/rotation from the selected clip's transform.

- [ ] **Step 2: Add direct manipulation**

On pointer down, capture the pointer and store the initial transform. Pointer movement updates `x` and `y`; a corner handle updates `scale` with a minimum of `0.2`; a rotation handle updates `rotation`. Stop propagation so sticker editing never scrubs the timeline or toggles playback.

- [ ] **Step 3: Add selection controls**

Show a cyan selection outline only for the selected sticker, with one resize handle and one rotation handle. Use icon-only delete/duplicate commands with tooltips; deletion uses the existing selected-clip action and duplication creates a new sticker clip offset by 8px.

- [ ] **Step 4: Verify in the standalone editor**

At `http://localhost:5173/`, verify: open Stickers, add a built-in sticker, upload PNG/WebP/GIF, move/resize/rotate, play through its start/end, trim, split, duplicate, delete, and undo. Confirm main/overlay/audio tracks still play.

- [ ] **Step 5: Run final checks**

Run the Node tests and `npm.cmd run lint` commands from Task 2. Expected: all pass with no TypeScript or ESLint errors.
