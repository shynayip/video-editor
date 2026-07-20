# Caption Canvas Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users move and resize one selected caption directly on the video preview canvas.

**Architecture:** Extend each `CaptionOverlay` with optional percentage-based `x` and `y` coordinates, using bottom-center defaults for existing projects. Keep movement and size clamping in pure `editorLogic.ts` helpers, then connect those helpers to pointer interactions in `Composition.tsx` using the same undoable drag lifecycle already used by text overlays.

**Tech Stack:** React 19, TypeScript, Remotion, CSS, Node test runner.

## Global Constraints

- Editing changes only the selected caption clip.
- Existing captions without coordinates render at `x: 50` and `y: 82`.
- Captions remain inside the video preview frame.
- Caption font size stays between 12 and 160 pixels.
- Pointer release and pointer cancellation each complete one undoable edit.
- Selection controls never appear in rendered output.

---

### Task 1: Caption Transform Data And Pure Helpers

**Files:**
- Modify: `src/editorLogic.ts:10-34`
- Modify: `src/editorLogic.ts:1460-1562`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `getCaptionPosition(caption: CaptionOverlay): {x: number; y: number}`
- Produces: `moveCaptionOverlay(clips, clipId, position, bounds): TimelineClip[]`
- Produces: `resizeCaptionOverlayById(clips, clipId, fontSize): TimelineClip[]`
- Produces: `getResizedCaptionFontSize(input): number`

- [ ] **Step 1: Write failing unit tests for default position and selected-only movement**

Add imports for the four helper names above, then add:

```ts
test("moves only the selected caption and clamps it inside the preview", () => {
  const first = createManualCaptionClip({
    id: "caption-1",
    content: "First caption",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const second = createManualCaptionClip({
    id: "caption-2",
    content: "Second caption",
    playheadFrame: 90,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;

  assert.deepEqual(getCaptionPosition(first.caption!), {x: 50, y: 82});
  const moved = moveCaptionOverlay(
    [first, second],
    first.id,
    {x: 98, y: 2},
    {halfWidthPercent: 14, halfHeightPercent: 6},
  );

  assert.deepEqual(getCaptionPosition(moved[0].caption!), {x: 86, y: 6});
  assert.deepEqual(moved[1], second);
  assert.equal(moved[0].start, first.start);
  assert.equal(moved[0].duration, first.duration);
});
```

- [ ] **Step 2: Run the movement test and verify RED**

Run:

```powershell
node --no-warnings --test --test-name-pattern="moves only the selected caption" tests/editorLogic.test.mts
```

Expected: FAIL because `getCaptionPosition` and `moveCaptionOverlay` are not exported.

- [ ] **Step 3: Implement optional caption coordinates and movement helpers**

Extend `CaptionOverlay` and add the pure helpers:

```ts
export type CaptionOverlay = CaptionStyle & {
  content: string;
  x?: number;
  y?: number;
  sourceClipId?: string;
  generationId?: string;
};

export const getCaptionPosition = (caption: CaptionOverlay) => ({
  x: caption.x ?? 50,
  y: caption.y ?? 82,
});

export const moveCaptionOverlay = (
  clips: TimelineClip[],
  clipId: string | null,
  position: {x: number; y: number},
  bounds: {halfWidthPercent: number; halfHeightPercent: number},
): TimelineClip[] => clips.map((clip) => {
  if (clip.id !== clipId || clip.track !== "caption" || !clip.caption) return clip;
  return {
    ...clip,
    caption: {
      ...clip.caption,
      x: Math.max(bounds.halfWidthPercent, Math.min(100 - bounds.halfWidthPercent, position.x)),
      y: Math.max(bounds.halfHeightPercent, Math.min(100 - bounds.halfHeightPercent, position.y)),
    },
  };
});
```

- [ ] **Step 4: Run the movement test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write a failing unit test for caption resizing**

```ts
test("resizes only the selected caption within readable limits", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Resize me",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const larger = getResizedCaptionFontSize({
    startFontSize: 36,
    startX: 100,
    startY: 100,
    pointerX: 160,
    pointerY: 180,
  });

  assert.equal(resizeCaptionOverlayById([caption], caption.id, larger)[0].caption?.fontSize, 86);
  assert.equal(resizeCaptionOverlayById([caption], caption.id, 500)[0].caption?.fontSize, 160);
  assert.equal(resizeCaptionOverlayById([caption], caption.id, -20)[0].caption?.fontSize, 12);
});
```

- [ ] **Step 6: Run the resize test and verify RED**

Run:

```powershell
node --no-warnings --test --test-name-pattern="resizes only the selected caption" tests/editorLogic.test.mts
```

Expected: FAIL because the resize helpers are not exported.

- [ ] **Step 7: Implement caption resize helpers**

```ts
export const resizeCaptionOverlayById = (
  clips: TimelineClip[],
  clipId: string | null,
  fontSize: number,
): TimelineClip[] => clips.map((clip) => {
  if (clip.id !== clipId || clip.track !== "caption" || !clip.caption) return clip;
  return {
    ...clip,
    caption: {
      ...clip.caption,
      fontSize: Math.max(12, Math.min(160, Math.round(fontSize))),
    },
  };
});

export const getResizedCaptionFontSize = getResizedTextFontSize;
```

- [ ] **Step 8: Run focused and full editor-logic tests**

```powershell
node --no-warnings --test tests/editorLogic.test.mts
```

Expected: all editor-logic tests PASS.

- [ ] **Step 9: Commit the helper layer**

```powershell
git add -- src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add caption canvas transform helpers"
```

---

### Task 2: On-Canvas Caption Move And Resize Controls

**Files:**
- Modify: `src/Composition.tsx:1018-1060`
- Modify: `src/Composition.tsx:1215-1235`
- Modify: `src/Composition.tsx:2831-3003`
- Modify: `src/Composition.tsx:3767-3865`
- Modify: `src/Composition.tsx:5424-5454`
- Modify: `src/index.css:1359-1389`
- Test: `tests/caption-ui.test.mts`

**Interfaces:**
- Consumes: `getCaptionPosition`, `moveCaptionOverlay`, `resizeCaptionOverlayById`, `getResizedCaptionFontSize`
- Produces: selected caption pointer movement and lower-right resize handle in the preview.

- [ ] **Step 1: Write a failing UI source test for selected caption controls**

```ts
test("moves and resizes only the selected caption on the preview canvas", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const previewCaptions = source.slice(
    source.indexOf('className="preview-caption-stack"'),
    source.indexOf("activeStickerClips.map"),
  );

  assert.match(previewCaptions, /left: `\$\{captionPosition\.x\}%`/);
  assert.match(previewCaptions, /top: `\$\{captionPosition\.y\}%`/);
  assert.match(previewCaptions, /startCaptionPreviewDrag\(event, captionClip\)/);
  assert.match(previewCaptions, /selectedClipId === captionClip\.id[\s\S]*caption-resize-handle/);
  assert.match(previewCaptions, /startCaptionResizeDrag\(event, captionClip\)/);
  assert.match(css, /\.caption-resize-handle\s*\{/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

```powershell
node --no-warnings --test --test-name-pattern="moves and resizes only the selected caption" tests/caption-ui.test.mts
```

Expected: FAIL because the caption pointer handlers and handle are absent.

- [ ] **Step 3: Add caption drag state and start handlers**

Add the state types and state values:

```ts
type CaptionPreviewDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  halfWidthPercent: number;
  halfHeightPercent: number;
};

type CaptionResizeDrag = {
  clipId: string;
  startX: number;
  startY: number;
  startFontSize: number;
  originalClips: TimelineClip[];
};

const [captionPreviewDrag, setCaptionPreviewDrag] =
  useState<CaptionPreviewDrag | null>(null);
const [captionResizeDrag, setCaptionResizeDrag] =
  useState<CaptionResizeDrag | null>(null);
```

Add both start handlers:

```ts
const startCaptionPreviewDrag = (
  event: PointerEvent<HTMLElement>,
  clip: TimelineClip,
) => {
  const previewBounds = previewWindowRef.current?.getBoundingClientRect();
  if (!previewBounds || !clip.caption) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  const captionBounds = event.currentTarget.getBoundingClientRect();
  selectTimelineClip(clip);
  setCaptionPreviewDrag({
    clipId: clip.id,
    startX: event.clientX,
    startY: event.clientY,
    originalClips: clips,
    halfWidthPercent: (captionBounds.width / previewBounds.width) * 50,
    halfHeightPercent: (captionBounds.height / previewBounds.height) * 50,
  });
};

const startCaptionResizeDrag = (
  event: PointerEvent<HTMLElement>,
  clip: TimelineClip,
) => {
  if (!clip.caption) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  selectTimelineClip(clip);
  setCaptionResizeDrag({
    clipId: clip.id,
    startX: event.clientX,
    startY: event.clientY,
    startFontSize: clip.caption.fontSize,
    originalClips: clips,
  });
};
```

- [ ] **Step 4: Add undoable pointer lifecycle effects**

For movement, add this effect:

```ts
useEffect(() => {
  if (!captionPreviewDrag) return;
  const originalCaption = captionPreviewDrag.originalClips.find(
    (clip) => clip.id === captionPreviewDrag.clipId,
  )?.caption;
  if (!originalCaption) return;
  const originalPosition = getCaptionPosition(originalCaption);

  const handlePointerMove = (event: globalThis.PointerEvent) => {
    const bounds = previewWindowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = originalPosition.x +
      ((event.clientX - captionPreviewDrag.startX) / bounds.width) * 100;
    const y = originalPosition.y +
      ((event.clientY - captionPreviewDrag.startY) / bounds.height) * 100;
    setTimelineHistory((history) => ({
      ...history,
      present: moveCaptionOverlay(
        captionPreviewDrag.originalClips,
        captionPreviewDrag.clipId,
        {x, y},
        {
          halfWidthPercent: captionPreviewDrag.halfWidthPercent,
          halfHeightPercent: captionPreviewDrag.halfHeightPercent,
        },
      ),
    }));
  };
  const finish = () => {
    setTimelineHistory((history) => history.present === captionPreviewDrag.originalClips
      ? history
      : {past: [...history.past, captionPreviewDrag.originalClips], present: history.present, future: []});
    setCaptionPreviewDrag(null);
  };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finish, {once: true});
  window.addEventListener("pointercancel", finish, {once: true});
  return () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
  };
}, [captionPreviewDrag]);
```

For resizing, add the corresponding effect:

```ts
useEffect(() => {
  if (!captionResizeDrag) return;
  const handlePointerMove = (event: globalThis.PointerEvent) => {
    setTimelineHistory((history) => ({
      ...history,
      present: resizeCaptionOverlayById(
        captionResizeDrag.originalClips,
        captionResizeDrag.clipId,
        getResizedCaptionFontSize({
          startFontSize: captionResizeDrag.startFontSize,
          startX: captionResizeDrag.startX,
          startY: captionResizeDrag.startY,
          pointerX: event.clientX,
          pointerY: event.clientY,
        }),
      ),
    }));
  };
  const finish = () => {
    setTimelineHistory((history) => history.present === captionResizeDrag.originalClips
      ? history
      : {past: [...history.past, captionResizeDrag.originalClips], present: history.present, future: []});
    setCaptionResizeDrag(null);
  };
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", finish, {once: true});
  window.addEventListener("pointercancel", finish, {once: true});
  return () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
  };
}, [captionResizeDrag]);
```

- [ ] **Step 5: Render captions at stored coordinates with a selected-only handle**

Replace the fixed `bottom` placement with:

```tsx
const captionPosition = getCaptionPosition(caption);

style={{
  left: `${captionPosition.x}%`,
  top: `${captionPosition.y}%`,
  color: caption.textColor,
  fontSize: `${caption.fontSize}px`,
  background: caption.backgroundEnabled ? caption.backgroundColor : "transparent",
  zIndex: 24 + captionIndex,
}}
onPointerDown={(event) => startCaptionPreviewDrag(event, captionClip)}
```

Inside the caption element, render only for the selected clip:

```tsx
{selectedClipId === captionClip.id ? (
  <span
    aria-label="Resize caption"
    className="caption-resize-handle"
    role="button"
    tabIndex={0}
    onPointerDown={(event) => startCaptionResizeDrag(event, captionClip)}
  />
) : null}
```

- [ ] **Step 6: Style movement and resize controls**

Update `.preview-caption` to use `translate: -50% -50%` and `cursor: move`. Add an absolute 16-by-16-pixel lower-right `.caption-resize-handle` with `cursor: nwse-resize`, a high-contrast border, and a stable hit target. Keep the existing selected outline.

- [ ] **Step 7: Run focused caption tests**

```powershell
node --no-warnings --test tests/caption-ui.test.mts tests/editorLogic.test.mts
```

Expected: all caption and editor-logic tests PASS.

- [ ] **Step 8: Commit the preview interaction**

```powershell
git add -- src/Composition.tsx src/index.css tests/caption-ui.test.mts
git commit -m "feat: edit captions on preview canvas"
```

---

### Task 3: Regression And Build Verification

**Files:**
- Verify only; fix only caption-related regressions in the files above.

**Interfaces:**
- Consumes: completed caption helper and preview interaction tasks.
- Produces: verified local editor build.

- [ ] **Step 1: Run the complete test suite**

```powershell
node --no-warnings --test tests\*.test.mts tests\*.test.mjs
```

Expected: all tests PASS with no failures.

- [ ] **Step 2: Run lint**

```powershell
npm.cmd run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: exit code 0 and a generated Vite bundle.

- [ ] **Step 4: Verify the running editor endpoint**

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/ | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.
