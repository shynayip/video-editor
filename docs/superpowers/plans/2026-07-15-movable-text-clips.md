# Movable Text Clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users move a text clip horizontally on the Text track and drag its rendered text anywhere inside the video preview without allowing the text to leave the frame.

**Architecture:** Add pure text movement helpers to `editorLogic.ts`, then connect them to two focused pointer-drag sessions in `Composition.tsx`. Each drag previews movement by replacing only `timelineHistory.present`, then adds exactly one history entry when the drag ends.

**Tech Stack:** React 19, TypeScript, Remotion 4, Pointer Events, Node test runner, CSS.

## Global Constraints

- Text timeline movement changes `start` while preserving `duration` and visual properties.
- Text preview movement changes `text.x` and `text.y` while preserving all timing and appearance fields.
- The full rendered text must remain inside all four preview edges.
- Trim handles remain independent from clip movement.
- Each completed drag creates at most one Undo/Redo history entry.
- Media dragging, overlay movement, sticker manipulation, timeline scrubbing, and trimming must remain unchanged.
- Do not add text animation, rotation, resizing, font selection, multi-select movement, snapping, or keyframes.

---

## File Structure

- Modify `src/editorLogic.ts`: pure, immutable text movement and preview clamping helpers.
- Modify `tests/editorLogic.test.mts`: unit coverage for exact movement, boundaries, preservation, invalid IDs, and no-op identity.
- Modify `src/Composition.tsx`: text timeline and preview pointer sessions, selection, live updates, and one-entry history finalization.
- Modify `src/index.css`: move/grab cursors and selected dragging feedback.

### Task 1: Pure Timeline Text Movement

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `moveTextClip(clips: TimelineClip[], clipId: string, targetStart: number, timelineDuration: number): TimelineClip[]`
- Preserves: every field except the matching caption clip's `start`.

- [ ] **Step 1: Write failing tests for exact movement and boundaries**

Add `moveTextClip` to the test imports and add these cases:

```ts
test("moves only the selected text clip to the requested frame", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 20});
  const other = createTextClip({id: "text-2", content: "Other", playheadFrame: 200});
  const result = moveTextClip([text, other], "text-1", 120, 480);

  assert.equal(result[0].start, 120);
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].text, text.text);
  assert.strictEqual(result[1], other);
});

test("clamps text movement to the timeline boundaries", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 20});

  assert.equal(moveTextClip([text], "text-1", -30, 480)[0].start, 0);
  assert.equal(moveTextClip([text], "text-1", 460, 480)[0].start, 390);
});

test("keeps text clip arrays unchanged for invalid and no-op moves", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 20});
  const clips = [text];

  assert.strictEqual(moveTextClip(clips, "missing", 100, 480), clips);
  assert.strictEqual(moveTextClip(clips, "text-1", 20, 480), clips);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node --test tests\editorLogic.test.mts
```

Expected: FAIL because `moveTextClip` is not exported.

- [ ] **Step 3: Implement the immutable timeline helper**

Add to `src/editorLogic.ts`:

```ts
export const moveTextClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  timelineDuration: number,
): TimelineClip[] => {
  const clip = clips.find(
    (candidate) => candidate.id === clipId && candidate.track === "caption",
  );
  if (!clip) return clips;

  const maxStart = Math.max(0, timelineDuration - clip.duration);
  const start = Math.max(0, Math.min(maxStart, Math.round(targetStart)));
  if (start === clip.start) return clips;

  return clips.map((candidate) =>
    candidate.id === clipId ? {...candidate, start} : candidate,
  );
};
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```powershell
node --test tests\editorLogic.test.mts
```

Expected: all editor logic tests pass.

- [ ] **Step 5: Commit the timeline helper**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add text timeline movement logic"
```

### Task 2: Pure Preview Text Movement

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: existing `TimelineClip.text` coordinates expressed as preview percentages.
- Produces: `moveTextOverlay(clips, clipId, position, bounds): TimelineClip[]`.
- `position`: `{x: number; y: number}` in percentages.
- `bounds`: `{halfWidthPercent: number; halfHeightPercent: number}` measured from the rendered text and preview.

- [ ] **Step 1: Write failing tests for preview movement and clamping**

Add `moveTextOverlay` to the test imports and add:

```ts
test("moves text in the preview while preserving timing and appearance", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 45});
  const result = moveTextOverlay(
    [text],
    "text-1",
    {x: 30, y: 40},
    {halfWidthPercent: 10, halfHeightPercent: 5},
  );

  assert.equal(result[0].start, 45);
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].text, {
    ...text.text,
    x: 30,
    y: 40,
  });
});

test("keeps the full text inside every preview edge", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 0});
  const bounds = {halfWidthPercent: 12, halfHeightPercent: 8};

  const topLeft = moveTextOverlay([text], "text-1", {x: -20, y: -20}, bounds)[0];
  const bottomRight = moveTextOverlay([text], "text-1", {x: 120, y: 120}, bounds)[0];

  assert.deepEqual(
    {x: topLeft.text?.x, y: topLeft.text?.y},
    {x: 12, y: 8},
  );
  assert.deepEqual(
    {x: bottomRight.text?.x, y: bottomRight.text?.y},
    {x: 88, y: 92},
  );
});

test("keeps arrays unchanged when preview text cannot move", () => {
  const text = createTextClip({id: "text-1", content: "Hello", playheadFrame: 0});
  const clips = [text];
  const bounds = {halfWidthPercent: 10, halfHeightPercent: 5};

  assert.strictEqual(
    moveTextOverlay(clips, "missing", {x: 30, y: 40}, bounds),
    clips,
  );
  assert.strictEqual(
    moveTextOverlay(clips, "text-1", {x: 50, y: 78}, bounds),
    clips,
  );
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
node --test tests\editorLogic.test.mts
```

Expected: FAIL because `moveTextOverlay` is not exported.

- [ ] **Step 3: Implement preview clamping**

Add to `src/editorLogic.ts`:

```ts
type TextPosition = {x: number; y: number};
type TextPositionBounds = {
  halfWidthPercent: number;
  halfHeightPercent: number;
};

export const moveTextOverlay = (
  clips: TimelineClip[],
  clipId: string,
  position: TextPosition,
  bounds: TextPositionBounds,
): TimelineClip[] => {
  const clip = clips.find(
    (candidate) =>
      candidate.id === clipId &&
      candidate.track === "caption" &&
      candidate.text,
  );
  if (!clip?.text) return clips;

  const halfWidth = Math.max(0, Math.min(50, bounds.halfWidthPercent));
  const halfHeight = Math.max(0, Math.min(50, bounds.halfHeightPercent));
  const x = Math.max(halfWidth, Math.min(100 - halfWidth, position.x));
  const y = Math.max(halfHeight, Math.min(100 - halfHeight, position.y));

  if (x === clip.text.x && y === clip.text.y) return clips;

  return clips.map((candidate) =>
    candidate.id === clipId
      ? {...candidate, text: {...candidate.text!, x, y}}
      : candidate,
  );
};
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```powershell
node --test tests\editorLogic.test.mts
```

Expected: all editor logic tests pass.

- [ ] **Step 5: Commit the preview helper**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add text preview movement logic"
```

### Task 3: Drag Text Clips on the Timeline

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `moveTextClip` from Task 1.
- Produces: a text-only live drag session that commits one history item on pointer-up or pointer-cancel.

- [ ] **Step 1: Add text timeline drag state and import the helper**

Import `moveTextClip`, then define:

```ts
type TextTimelineDrag = {
  clipId: string;
  startX: number;
  originalClips: TimelineClip[];
};
```

Inside `MyComponent`, add:

```ts
const [textTimelineDrag, setTextTimelineDrag] =
  useState<TextTimelineDrag | null>(null);
```

- [ ] **Step 2: Add the pointer-down handler**

Add beside the existing trim and media drag handlers:

```ts
const startTextTimelineDrag = (
  event: PointerEvent<HTMLElement>,
  clip: TimelineClip,
) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  selectTimelineClip(clip);
  setTextTimelineDrag({
    clipId: clip.id,
    startX: event.clientX,
    originalClips: clips,
  });
};
```

- [ ] **Step 3: Add live movement and one-entry history finalization**

Add an effect modeled on trim dragging, always deriving movement from `originalClips`:

```ts
useEffect(() => {
  if (!textTimelineDrag) return;

  const originalClip = textTimelineDrag.originalClips.find(
    (clip) => clip.id === textTimelineDrag.clipId,
  );
  if (!originalClip) return;

  const handlePointerMove = (event: globalThis.PointerEvent) => {
    const frameDelta = Math.round(
      (event.clientX - textTimelineDrag.startX) / timelineScale,
    );
    setTimelineHistory((history) => ({
      ...history,
      present: moveTextClip(
        textTimelineDrag.originalClips,
        textTimelineDrag.clipId,
        originalClip.start + frameDelta,
        mainTrackDuration,
      ),
    }));
  };

  const finishDrag = () => {
    setTimelineHistory((history) =>
      history.present === textTimelineDrag.originalClips
        ? history
        : {
            past: [...history.past, textTimelineDrag.originalClips],
            present: history.present,
            future: [],
          },
    );
    setTextTimelineDrag(null);
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finishDrag, {once: true});
  window.addEventListener("pointercancel", finishDrag, {once: true});
  return () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  };
}, [mainTrackDuration, textTimelineDrag]);
```

- [ ] **Step 4: Connect only caption clip bodies to the handler**

Extend the clip class and pointer logic:

```tsx
className={`timeline-clip ${
  clip.track === "upper" || clip.track === "caption" ? "draggable-clip" : ""
} ...`}
```

```tsx
onPointerDown={(event) => {
  event.stopPropagation();
  selectTimelineClip(clip);
  if (clip.track === "upper") {
    startPointerDrag(event, clip);
  } else if (clip.track === "caption") {
    startTextTimelineDrag(event, clip);
  }
}}
```

The existing trim buttons already call `preventDefault()` and `stopPropagation()`, so trimming remains separate.

- [ ] **Step 5: Verify timeline interaction and regressions**

Run:

```powershell
node --test tests\editorLogic.test.mts
npm.cmd run lint
```

Expected: all tests pass and lint exits successfully. In the browser, drag `hi` along the Text track, then confirm Undo and Redo each treat the entire drag as one action.

- [ ] **Step 6: Commit timeline UI movement**

```powershell
git add src/Composition.tsx src/index.css
git commit -m "feat: drag text clips on timeline"
```

### Task 4: Drag Text Inside the Video Preview

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `moveTextOverlay` from Task 2 and `previewWindowRef`.
- Produces: direct preview movement with measured boundary clamping and one Undo/Redo entry.

- [ ] **Step 1: Add preview drag state and import the helper**

Import `moveTextOverlay`, then define:

```ts
type TextPreviewDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  halfWidthPercent: number;
  halfHeightPercent: number;
};
```

Inside `MyComponent`, add:

```ts
const [textPreviewDrag, setTextPreviewDrag] =
  useState<TextPreviewDrag | null>(null);
```

- [ ] **Step 2: Measure the rendered text when preview dragging starts**

Add:

```ts
const startTextPreviewDrag = (
  event: PointerEvent<HTMLButtonElement>,
  clip: TimelineClip,
) => {
  const previewBounds = previewWindowRef.current?.getBoundingClientRect();
  if (!previewBounds || !clip.text) return;

  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  const textBounds = event.currentTarget.getBoundingClientRect();
  selectTimelineClip(clip);
  setTextPreviewDrag({
    clipId: clip.id,
    startX: event.clientX,
    startY: event.clientY,
    originalClips: clips,
    halfWidthPercent: (textBounds.width / previewBounds.width) * 50,
    halfHeightPercent: (textBounds.height / previewBounds.height) * 50,
  });
};
```

- [ ] **Step 3: Add live preview movement and history finalization**

Add an effect that derives x/y from the original clip and current preview size:

```ts
useEffect(() => {
  if (!textPreviewDrag) return;

  const originalClip = textPreviewDrag.originalClips.find(
    (clip) => clip.id === textPreviewDrag.clipId,
  );
  if (!originalClip?.text) return;

  const handlePointerMove = (event: globalThis.PointerEvent) => {
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    if (!previewBounds) return;

    const x = originalClip.text.x +
      ((event.clientX - textPreviewDrag.startX) / previewBounds.width) * 100;
    const y = originalClip.text.y +
      ((event.clientY - textPreviewDrag.startY) / previewBounds.height) * 100;

    setTimelineHistory((history) => ({
      ...history,
      present: moveTextOverlay(
        textPreviewDrag.originalClips,
        textPreviewDrag.clipId,
        {x, y},
        {
          halfWidthPercent: textPreviewDrag.halfWidthPercent,
          halfHeightPercent: textPreviewDrag.halfHeightPercent,
        },
      ),
    }));
  };

  const finishDrag = () => {
    setTimelineHistory((history) =>
      history.present === textPreviewDrag.originalClips
        ? history
        : {
            past: [...history.past, textPreviewDrag.originalClips],
            present: history.present,
            future: [],
          },
    );
    setTextPreviewDrag(null);
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finishDrag, {once: true});
  window.addEventListener("pointercancel", finishDrag, {once: true});
  return () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  };
}, [textPreviewDrag]);
```

- [ ] **Step 4: Connect active preview text to pointer dragging**

Replace the preview text click-only interaction with:

```tsx
onClick={() => selectTimelineClip(textClip)}
onPointerDown={(event) => startTextPreviewDrag(event, textClip)}
```

Add an accessible label and dragging state:

```tsx
aria-label={`Move text: ${text.content}`}
className={`preview-text-overlay ${
  selectedClipId === textClip.id ? "selected-preview-text" : ""
} ${textPreviewDrag?.clipId === textClip.id ? "dragging-preview-text" : ""}`}
```

- [ ] **Step 5: Add precise cursor behavior**

Update `src/index.css`:

```css
.preview-text-overlay {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.preview-text-overlay.dragging-preview-text,
.preview-text-overlay:active {
  cursor: grabbing;
}
```

- [ ] **Step 6: Run complete verification**

Run:

```powershell
node --test tests\editorLogic.test.mts
npm.cmd run lint
npx.cmd vite build
```

Expected: all tests pass, lint exits successfully, and Vite builds successfully. Existing Tailwind/lightningcss unknown at-rule warnings may remain if they are unchanged from baseline.

In `http://localhost:5173/`, verify:

1. Add or select a text clip and place the playhead inside it.
2. Drag the text to the top-left, top-right, bottom-left, and bottom-right; the complete text remains visible.
3. Drag the orange text clip along the Text track; its preview visibility moves with its timing.
4. Trim both ends and confirm the clip does not move.
5. Undo and redo one timeline drag and one preview drag; each drag uses one history step.
6. Confirm overlay dragging, sticker manipulation, timeline scrubbing, playback, and media selection still respond normally.

- [ ] **Step 7: Commit preview movement**

```powershell
git add src/Composition.tsx src/index.css
git commit -m "feat: drag text inside preview"
```
