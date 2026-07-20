# Adjustable Text Clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Text toolbar tab create styled, resizable timeline clips that display over the video at the red playhead.

**Architecture:** Extend the existing timeline clip model with optional text presentation fields and keep timing operations in `editorLogic.ts`. `Composition.tsx` owns the active tool, text form, preview rendering, and Text track UI while reusing existing history, trim, split, and delete behavior.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, native CSS, Node test runner.

## Global Constraints

- New text clips default to four seconds and are capped at the current project end.
- Empty or whitespace-only text is rejected.
- Text clips use the internal `caption` track and the user-facing label `Text track`.
- Existing main, overlay, audio, history, trim, split, and delete behavior must remain unchanged.

---

### Task 1: Text Clip Domain Logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TextClipOptions` and `createTextClip(options: TextClipOptions): TimelineClip | null`.
- Extends: `TimelineClip` with `text`, `fontSize`, `textColor`, `textX`, and `textY`.

- [ ] **Step 1: Write failing creation and visibility tests**

```ts
test("creates a four-second text clip at the playhead", () => {
  const clip = createTextClip({id: "text-1", text: "Hello", start: 60, projectEnd: 480, fps: 30});
  assert.equal(clip?.track, "caption");
  assert.equal(clip?.duration, 120);
  assert.equal(clip?.text, "Hello");
});

test("caps text duration at the project end and rejects empty text", () => {
  assert.equal(createTextClip({id: "empty", text: "   ", start: 0, projectEnd: 480, fps: 30}), null);
  assert.equal(createTextClip({id: "late", text: "End", start: 450, projectEnd: 480, fps: 30})?.duration, 30);
});
```

- [ ] **Step 2: Run tests and confirm the missing export failure**

Run: `node --test tests\editorLogic.test.mts`

Expected: FAIL because `createTextClip` is not exported.

- [ ] **Step 3: Add text fields and creation logic**

```ts
export type TimelineClip = {
  // existing fields
  text?: string;
  fontSize?: number;
  textColor?: string;
  textX?: number;
  textY?: number;
};

export type TextClipOptions = {
  id: string;
  text: string;
  start: number;
  projectEnd: number;
  fps: number;
};

export const createTextClip = (options: TextClipOptions): TimelineClip | null => {
  const text = options.text.trim();
  if (!text || options.start >= options.projectEnd) return null;
  return {
    id: options.id,
    label: text,
    text,
    track: "caption",
    start: options.start,
    duration: Math.min(options.fps * 4, options.projectEnd - options.start),
    color: "#ef476f",
    fontSize: 48,
    textColor: "#ffffff",
    textX: 50,
    textY: 82,
  };
};
```

- [ ] **Step 4: Run domain tests**

Run: `node --test tests\editorLogic.test.mts`

Expected: all tests PASS.

- [ ] **Step 5: Commit domain logic**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add adjustable text clip model"
```

### Task 2: Text Tool Panel And Preview

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `createTextClip` and text fields on `TimelineClip`.
- Produces: active Text tab, text form, live preview overlays, and Text track.

- [ ] **Step 1: Add active-tool and text-form state**

```ts
type EditorTool = "media" | "audio" | "text" | "stickers" | "effects" | "captions" | "filters" | "adjustment" | "transcript";
const [activeTool, setActiveTool] = useState<EditorTool>("media");
const [textDraft, setTextDraft] = useState("");
const [textSize, setTextSize] = useState(48);
const [textColor, setTextColor] = useState("#ffffff");
const activeTextClips = getActiveClipsAtFrame(clips, "caption", playheadFrame).filter((clip) => clip.text);
```

- [ ] **Step 2: Convert toolbar labels into working buttons**

```tsx
<button className={activeTool === "text" ? "tool-tab active-tool" : "tool-tab"} onClick={() => setActiveTool("text")} type="button">
  Text
</button>
```

Apply the same button pattern to Media so switching back restores the media panel.

- [ ] **Step 3: Add the text editor panel and creation command**

```ts
const addTextAtPlayhead = () => {
  const clip = createTextClip({
    id: `text-${Date.now()}`,
    text: textDraft,
    start: playheadFrame,
    projectEnd: Math.max(mainTrackDuration, compositionDurationInFrames),
    fps,
  });
  if (!clip) return;
  clip.fontSize = textSize;
  clip.textColor = textColor;
  commitClipChange((current) => [...current, clip]);
  setSelectedClipId(clip.id);
  setSelectedTrack("caption");
};
```

```tsx
<section className="text-tool-panel" aria-label="Text editor">
  <label>Text<textarea value={textDraft} onChange={(event) => setTextDraft(event.target.value)} /></label>
  <label>Size<input type="range" min="16" max="120" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} /></label>
  <label>Color<input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
  <button type="button" onClick={addTextAtPlayhead} disabled={!textDraft.trim()}>Add text</button>
</section>
```

- [ ] **Step 4: Render active text over the preview**

```tsx
{activeTextClips.map((clip) => (
  <div key={clip.id} className="preview-text-layer" style={{left: `${clip.textX ?? 50}%`, top: `${clip.textY ?? 82}%`, color: clip.textColor, fontSize: clip.fontSize}}>
    {clip.text}
  </div>
))}
```

- [ ] **Step 5: Add the Text track and selected-text editing synchronization**

Add `{id: "caption", label: "Text track"}` to `tracks`. When a selected clip has `track === "caption"`, populate the panel from its fields and commit changes by clip id without changing timing.

- [ ] **Step 6: Add focused CSS**

```css
.tool-tab { appearance: none; border: 0; background: transparent; color: #91a0af; padding: 8px 0; cursor: pointer; }
.tool-tab.active-tool { color: #38d6c8; font-weight: 900; }
.text-tool-panel { display: grid; gap: 14px; padding: 18px; }
.text-tool-panel label { display: grid; gap: 6px; color: #aebdca; }
.text-tool-panel textarea { min-height: 92px; resize: vertical; }
.preview-text-layer { position: absolute; transform: translate(-50%, -50%); z-index: 8; max-width: 86%; text-align: center; font-weight: 800; text-shadow: 0 2px 6px #000; pointer-events: none; }
```

- [ ] **Step 7: Run static checks and commit**

Run: `npm.cmd run lint`

Expected: ESLint and TypeScript exit 0.

```powershell
git add src/Composition.tsx src/index.css
git commit -m "feat: add text editing panel and preview"
```

### Task 3: Text Interaction Verification

**Files:**
- Modify only if verification exposes a defect: `src/Composition.tsx`, `src/index.css`, `src/editorLogic.ts`
- Test only if verification exposes a logic defect: `tests/editorLogic.test.mts`

- [ ] **Step 1: Run the complete automated suite**

Run: `node --test tests\editorLogic.test.mts; npm.cmd run lint; npm.cmd run build`

Expected: all tests pass and both commands exit 0.

- [ ] **Step 2: Verify in the browser**

Open `http://localhost:5173/`, click Text, enter `Sample title`, add it at a nonzero playhead, and confirm it appears in the preview and Text track.

- [ ] **Step 3: Verify duration editing**

Drag the right trim handle longer and shorter. Confirm the text remains visible only while the red playhead is within the resized range. Split, delete, undo, and redo the selected text clip.

- [ ] **Step 4: Verify responsive layout**

Check desktop and narrow viewport widths. Confirm the form, preview text, timeline labels, and toolbar do not overlap.

- [ ] **Step 5: Commit any verification fixes**

```powershell
git add src tests
git commit -m "fix: polish adjustable text interactions"
```

