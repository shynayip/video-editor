# Vertical Preview Volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the imported-video preview's horizontal volume popup with a vertical slider that shows its percentage only during active pointer adjustment.

**Architecture:** Keep the existing speaker toggle and independent preview-volume state. Add one transient React boolean for active adjustment, render the range and optional percentage inside a fixed vertical popup, and use native vertical range styling so pointer and keyboard behavior remain browser-managed.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner

## Global Constraints

- The slider runs from 100% at the top to 0% at the bottom.
- The rounded percentage label renders only while pointer adjustment is active.
- The popup remains entirely inside the preview frame and does not resize the transport row.
- Preview volume remains independent from timeline clip volume.
- Preserve the existing `Imported video volume` accessible label and native range input.
- Do not modify unrelated editor behavior or uploaded media.

---

### Task 1: Vertical Preview Volume Popup

**Files:**
- Modify: `video-editor/tests/media-preview-ui.test.mts`
- Modify: `video-editor/src/Composition.tsx`
- Modify: `video-editor/src/index.css`

**Interfaces:**
- Consumes: existing `mediaPreviewVolume`, `isMediaPreviewVolumeOpen`, `handleMediaPreviewVolumeChange`, `handleMediaPreviewVolumePointerDown`, and `handleMediaPreviewVolumePointerEnd` inside `MyComponent`.
- Produces: `isMediaPreviewVolumeAdjusting: boolean`, `.media-preview-volume-popover`, and `.media-preview-volume-value`.

- [ ] **Step 1: Write failing UI contract tests**

Add assertions to `tests/media-preview-ui.test.mts` that require vertical range styling and transient percentage state:

```ts
test("renders a vertical imported-video volume slider with a transient value", () => {
  const source = readComposition();
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    source,
    /const \[isMediaPreviewVolumeAdjusting, setIsMediaPreviewVolumeAdjusting\] = useState\(false\)/,
  );
  assert.match(source, /className="media-preview-volume-popover"/);
  assert.match(
    source,
    /isMediaPreviewVolumeAdjusting \? \(\s*<output className="media-preview-volume-value">\s*\{Math\.round\(mediaPreviewVolume \* 100\)\}%\s*<\/output>/s,
  );
  assert.match(
    css,
    /\.media-preview-volume-slider\s*\{[^}]*writing-mode:\s*vertical-lr[^}]*direction:\s*rtl/s,
  );
  assert.match(
    css,
    /\.media-preview-volume-popover\s*\{[^}]*position:\s*absolute[^}]*right:\s*0[^}]*bottom:\s*calc\(100%\s*\+\s*6px\)/s,
  );
});
```

Extend the existing interaction test to require adjustment state updates:

```ts
assert.match(
  source,
  /const handleMediaPreviewVolumePointerDown = \(\) => \{[\s\S]*setIsMediaPreviewVolumeAdjusting\(true\)/,
);
assert.match(
  source,
  /const handleMediaPreviewVolumePointerEnd = \(\) => \{[\s\S]*setIsMediaPreviewVolumeAdjusting\(false\)/,
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --test tests/media-preview-ui.test.mts
```

Expected: FAIL because adjustment state, popup markup, transient output, and vertical styling do not exist.

- [ ] **Step 3: Add transient adjustment state and event updates**

In `src/Composition.tsx`, add state beside the existing preview-volume state:

```tsx
const [mediaPreviewVolume, setMediaPreviewVolume] = useState(1);
const [isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen] = useState(false);
const [isMediaPreviewVolumeAdjusting, setIsMediaPreviewVolumeAdjusting] = useState(false);
```

Reset it when media or preview mode changes:

```tsx
useEffect(() => {
  mediaPreviewVolumeDragRef.current = false;
  setIsMediaPreviewVolumeAdjusting(false);
  setIsMediaPreviewVolumeOpen(false);
}, [previewMode, selectedMediaId]);
```

Update the existing pointer handlers:

```tsx
const handleMediaPreviewVolumePointerDown = () => {
  mediaPreviewVolumeDragRef.current = true;
  setIsMediaPreviewVolumeAdjusting(true);
  setIsMediaPreviewVolumeOpen(true);
};

const handleMediaPreviewVolumePointerEnd = () => {
  mediaPreviewVolumeDragRef.current = false;
  setIsMediaPreviewVolumeAdjusting(false);
  closeMediaPreviewVolumeIfInactive();
};
```

- [ ] **Step 4: Render the vertical popup and adjustment-only value**

Replace the conditional range with this popup while keeping the existing attributes and handlers:

```tsx
{isMediaPreviewVolumeOpen ? (
  <div className="media-preview-volume-popover">
    {isMediaPreviewVolumeAdjusting ? (
      <output className="media-preview-volume-value">
        {Math.round(mediaPreviewVolume * 100)}%
      </output>
    ) : null}
    <input
      className="media-preview-volume-slider"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={mediaPreviewVolume}
      aria-label="Imported video volume"
      onPointerDown={handleMediaPreviewVolumePointerDown}
      onPointerUp={handleMediaPreviewVolumePointerEnd}
      onPointerCancel={handleMediaPreviewVolumePointerEnd}
      onChange={handleMediaPreviewVolumeChange}
    />
  </div>
) : null}
```

- [ ] **Step 5: Style the fixed vertical popup**

In `src/index.css`, keep `.media-preview-volume-control` at `width: 30px` and replace the horizontal slider popup rules with:

```css
.media-preview-volume-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 1;
  display: grid;
  justify-items: center;
  width: 44px;
  height: 132px;
  padding: 26px 6px 8px;
  border-radius: 7px;
  background: rgba(2, 6, 23, 0.9);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.32);
}

.media-preview-volume-slider {
  width: 20px;
  height: 98px;
  margin: 0;
  writing-mode: vertical-lr;
  direction: rtl;
  accent-color: #38d6c8;
}

.media-preview-volume-value {
  position: absolute;
  top: 6px;
  color: #f8fafc;
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Run focused verification and confirm GREEN**

Run:

```powershell
node --test tests/media-preview-ui.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits with code 0.

- [ ] **Step 7: Verify the live interaction**

At `http://localhost:5173/`, select an imported video, hover the preview, click the speaker, and drag the vertical slider.

Expected: the rail is vertical, higher pointer positions increase volume, the percentage appears only during dragging, and the popup remains inside the preview frame.

- [ ] **Step 8: Commit only the feature files**

```powershell
git add video-editor/src/Composition.tsx video-editor/src/index.css video-editor/tests/media-preview-ui.test.mts
git commit -m "feat: add vertical preview volume"
```
