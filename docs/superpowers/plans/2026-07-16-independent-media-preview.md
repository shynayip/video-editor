# Independent Imported-Media Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users play and seek any imported video without adding it to the timeline or moving the main timeline playhead.

**Architecture:** Preserve the existing shared preview video element but separate media-preview time from `playheadFrame`. Route the canvas play button according to `previewMode`, keep the timeline toolbar explicitly timeline-only, and render a video-only seek control beneath the canvas.

**Tech Stack:** React, TypeScript, native HTML video, CSS, Node test runner.

## Global Constraints

- Clicking imported media only selects it for preview.
- Only dragging media onto a video track adds it to the timeline.
- Imported-media playback and seeking never change `playheadFrame`.
- Timeline toolbar playback continues to control only the project timeline.
- Imported images do not show video playback or seek controls.
- Existing timeline editing, drag-and-drop, media deletion, and project persistence remain unchanged.

---

### Task 1: Add independent media-preview playback and seeking

**Files:**
- Modify: `tests/playhead-ui.test.mts`
- Modify: `tests/workspace-layout.test.mjs`
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `previewMode`, `selectedMedia`, `previewVideoRef`, `playheadFrame`, and `isPreviewPlaying`.
- Produces: `mediaPreviewTime`, `mediaPreviewDuration`, `toggleCanvasPreviewPlayback()`, `toggleTimelinePlayback()`, `seekMediaPreview()`, and an accessible imported-video seek slider.

- [ ] **Step 1: Add failing source-level UI tests**

Add assertions to `tests/playhead-ui.test.mts` that require:

```ts
assert.match(source, /const \[mediaPreviewTime, setMediaPreviewTime\] = useState\(0\)/);
assert.match(source, /const \[mediaPreviewDuration, setMediaPreviewDuration\] = useState\(0\)/);
assert.match(source, /const toggleCanvasPreviewPlayback/);
assert.match(source, /const toggleTimelinePlayback/);
assert.match(source, /if \(previewMode === "media"\)/);
assert.match(source, /setPreviewMode\("timeline"\)/);
assert.match(source, /if \(!isPreviewPlaying \|\| previewMode !== "timeline"\)/);
assert.match(source, /aria-label="Seek imported video"/);
assert.match(source, /onTimeUpdate=\{handleMediaPreviewTimeUpdate\}/);
assert.match(source, /onLoadedMetadata=\{handleMediaPreviewMetadata\}/);
assert.match(source, /onEnded=\{handleMediaPreviewEnded\}/);
```

Also isolate the media-selection function and assert it resets media-preview state without changing clips or the main playhead:

```ts
const chooseStart = source.indexOf("const chooseMedia");
const chooseEnd = source.indexOf("const deleteMediaItem", chooseStart);
const chooseMedia = source.slice(chooseStart, chooseEnd);
assert.match(chooseMedia, /setMediaPreviewTime\(0\)/);
assert.match(chooseMedia, /setMediaPreviewDuration\(0\)/);
assert.doesNotMatch(chooseMedia, /setPlayheadFrame/);
assert.doesNotMatch(chooseMedia, /commitClipChange/);
```

Update `tests/workspace-layout.test.mjs` to reserve vertical room for the seek controls:

```js
assert.match(previewShell, /width:\s*min\(100%, calc\(\(100cqh - 82px\) \* 9 \/ 16\)\);/);
```

- [ ] **Step 2: Run the focused tests and verify the expected failures**

```powershell
node --test tests/playhead-ui.test.mts tests/workspace-layout.test.mjs
```

Expected: failures because independent preview state, handlers, seek UI, and reserved control height do not exist.

- [ ] **Step 3: Add separate media-preview state and selection reset**

Add beside the existing preview state:

```tsx
const [mediaPreviewTime, setMediaPreviewTime] = useState(0);
const [mediaPreviewDuration, setMediaPreviewDuration] = useState(0);
```

Update media selection to pause and reset only the imported-media preview:

```tsx
const chooseMedia = (mediaItem: MediaItem) => {
  previewVideoRef.current?.pause();
  setSelectedMediaId(mediaItem.id);
  setIsPreviewPlaying(false);
  setMediaPreviewTime(0);
  setMediaPreviewDuration(0);
  setPreviewMode("media");
};
```

- [ ] **Step 4: Separate canvas and timeline playback handlers**

Implement a canvas handler that plays the selected media without changing modes or `playheadFrame`, and a timeline handler that explicitly returns to timeline mode:

```tsx
const toggleCanvasPreviewPlayback = () => {
  if (previewMode !== "media") {
    toggleTimelinePlayback();
    return;
  }

  const video = previewVideoRef.current;
  if (!video || selectedMedia?.mediaType === "image") return;

  if (isPreviewPlaying) {
    video.pause();
    setIsPreviewPlaying(false);
    return;
  }

  if (video.currentTime >= video.duration) {
    video.currentTime = 0;
    setMediaPreviewTime(0);
  }
  void video.play().then(() => setIsPreviewPlaying(true)).catch(() => {
    setIsPreviewPlaying(false);
  });
};

const toggleTimelinePlayback = () => {
  previewVideoRef.current?.pause();
  const wasTimelinePlaying = previewMode === "timeline" && isPreviewPlaying;
  setPreviewMode("timeline");
  if (wasTimelinePlaying) {
    setIsPreviewPlaying(false);
    return;
  }
  if (playheadFrame >= projectDuration) setPlayheadFrame(0);
  setIsPreviewPlaying(true);
};
```

The canvas button calls `toggleCanvasPreviewPlayback`; the timeline toolbar button calls `toggleTimelinePlayback`.

- [ ] **Step 5: Stop timeline synchronization during media preview**

Change the timeline playback timer guard to:

```tsx
if (!isPreviewPlaying || previewMode !== "timeline") return;
```

Include `previewMode` in the timer effect dependency list. In the preview-video synchronization effect, update `currentTime` only inside the timeline-mode branch. Media mode must allow the native video element to advance normally.

- [ ] **Step 6: Add imported-video metadata, time, end, and seek handlers**

```tsx
const handleMediaPreviewMetadata = () => {
  const video = previewVideoRef.current;
  if (!video || previewMode !== "media") return;
  setMediaPreviewDuration(Number.isFinite(video.duration) ? video.duration : 0);
  setMediaPreviewTime(video.currentTime);
};

const handleMediaPreviewTimeUpdate = () => {
  const video = previewVideoRef.current;
  if (!video || previewMode !== "media") return;
  setMediaPreviewTime(video.currentTime);
};

const handleMediaPreviewEnded = () => {
  setMediaPreviewTime(mediaPreviewDuration);
  setIsPreviewPlaying(false);
};

const seekMediaPreview = (time: number) => {
  const video = previewVideoRef.current;
  const clampedTime = Math.max(0, Math.min(mediaPreviewDuration, time));
  if (video) video.currentTime = clampedTime;
  setMediaPreviewTime(clampedTime);
};
```

Attach the metadata/time/end handlers to the media-preview `<video>` element.

- [ ] **Step 7: Render and style the media seek controls**

After `.preview-window`, render controls only for a selected imported video:

```tsx
{previewMode === "media" && selectedMedia && getMediaItemType(selectedMedia) === "video" ? (
  <div className="media-preview-controls">
    <span>{formatPreviewTime(mediaPreviewTime)}</span>
    <input
      aria-label="Seek imported video"
      type="range"
      min="0"
      max={Math.max(mediaPreviewDuration, 0.01)}
      step="0.01"
      value={Math.min(mediaPreviewTime, Math.max(mediaPreviewDuration, 0.01))}
      onChange={(event) => seekMediaPreview(Number(event.currentTarget.value))}
    />
    <span>{formatPreviewTime(mediaPreviewDuration)}</span>
  </div>
) : null}
```

Add a small local `formatPreviewTime(seconds)` helper returning `m:ss`, then style `.media-preview-controls` as a stable three-column row beneath the canvas. Change `.preview-shell` to:

```css
width: min(100%, calc((100cqh - 82px) * 9 / 16));
```

- [ ] **Step 8: Run verification**

```powershell
node --test tests/playhead-ui.test.mts tests/workspace-layout.test.mjs
npx.cmd tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits with code `0`.

- [ ] **Step 9: Verify behavior in the browser**

At `http://localhost:5173/`:

1. Record the main-track clip count and red playhead position.
2. Click each imported video card.
3. Play, pause, click, and drag its media seek control.
4. Confirm the selected video changes and seeks correctly.
5. Confirm main-track clip count and red playhead position do not change.
6. Click timeline play and confirm timeline playback resumes independently.

- [ ] **Step 10: Commit**

```powershell
git add tests/playhead-ui.test.mts tests/workspace-layout.test.mjs src/Composition.tsx src/index.css
git commit -m "feat: add independent imported media preview"
```
