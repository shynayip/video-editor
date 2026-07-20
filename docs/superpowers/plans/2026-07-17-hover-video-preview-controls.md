# Hover Video Preview Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unobtrusive hover/focus video preview controls with a draggable playhead, top filename, play/pause, and an expandable volume slider.

**Architecture:** Keep the native preview video and existing media-preview timing as the single playback source. Move imported-media transport into an absolutely positioned overlay inside `preview-window`, add preview-only volume state, and reveal controls through hover, `focus-within`, seeking, or an open volume slider. Scene cards continue using absolute source timestamps internally while displaying relative scene time.

**Tech Stack:** React 19, TypeScript, CSS, Remotion 4, Node test runner.

## Global Constraints

- Filename and controls are hidden until preview hover or keyboard focus.
- Filename is positioned at the top and truncates with a tooltip.
- The bottom overlay contains play/pause, a draggable playhead, time labels, and a speaker button.
- Clicking the speaker opens an inline volume slider.
- Preview volume must not change timeline clip volume.
- Full-video seeking uses the full duration; detected scenes remain clamped to their source range and display relative time.
- Hidden controls must not intercept pointer input.
- Existing timeline playback and scene looping must remain unchanged.

---

### Task 1: Preview Transport And Volume Behavior

**Files:**
- Modify: `video-editor/src/Composition.tsx:1398-1405, 1590-1660, 4825-4890, 6435-6510`
- Test: `video-editor/tests/media-preview-ui.test.mts`

**Interfaces:**
- Consumes: existing `mediaPreviewTime`, `mediaPreviewSeekMinSeconds`, `mediaPreviewSeekMaxSeconds`, `mediaPreviewDisplayTime`, `mediaPreviewDisplayDuration`, `toggleMediaPreviewPlayback`, and `handleMediaPreviewSeek`.
- Produces: `mediaPreviewVolume: number`, `isMediaPreviewVolumeOpen: boolean`, `handleMediaPreviewVolumeChange(event: ChangeEvent<HTMLInputElement>): void`, and imported-media overlay markup.

- [ ] **Step 1: Write failing preview-control tests**

Add assertions to `media-preview-ui.test.mts` that require preview-only volume state, direct native-video volume synchronization, an overlay filename, play/pause button, seek input, speaker button, and expandable volume input:

```ts
assert.match(source, /const \[mediaPreviewVolume, setMediaPreviewVolume\] = useState\(1\)/);
assert.match(source, /const \[isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen\] = useState\(false\)/);
assert.match(source, /video\.volume = previewMode === "media"\s*\? mediaPreviewVolume/);
assert.match(source, /className="media-preview-overlay"/);
assert.match(source, /className="media-preview-filename"/);
assert.match(source, /aria-label=\{isMediaPreviewPlaying \? "Pause imported video" : "Play imported video"\}/);
assert.match(source, /aria-label="Seek imported video"/);
assert.match(source, /aria-label="Adjust imported video volume"/);
assert.match(source, /aria-label="Imported video volume"/);
assert.match(source, /onChange=\{handleMediaPreviewVolumeChange\}/);
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
node --test tests/media-preview-ui.test.mts
```

Expected: FAIL because preview-only volume state and `.media-preview-overlay` markup do not exist.

- [ ] **Step 3: Add preview-only volume state and handler**

In `Composition.tsx`, add:

```tsx
const [mediaPreviewVolume, setMediaPreviewVolume] = useState(1);
const [isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen] = useState(false);

const handleMediaPreviewVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
  const nextVolume = Math.max(0, Math.min(1, Number(event.currentTarget.value)));
  setMediaPreviewVolume(nextVolume);
  if (previewVideoRef.current && previewMode === "media") {
    previewVideoRef.current.volume = nextVolume;
  }
};
```

Update native preview synchronization:

```tsx
video.volume = previewMode === "media"
  ? mediaPreviewVolume
  : Math.min(previewVolume, 1);
```

Add `mediaPreviewVolume` to the effect dependency list. Keep imported-media playback unmuted so zero volume is represented by `video.volume = 0`, not timeline mute state.

- [ ] **Step 4: Move imported-media controls into the preview overlay**

Inside `preview-window`, render this only for imported video media:

```tsx
<div className={`media-preview-overlay ${isMediaPreviewVolumeOpen ? "volume-open" : ""}`}>
  <div className="media-preview-filename" title={selectedMedia.label}>
    {selectedMedia.label}
  </div>
  <div className="media-preview-transport">
    <button
      type="button"
      className="media-preview-icon-button"
      aria-label={isMediaPreviewPlaying ? "Pause imported video" : "Play imported video"}
      title={isMediaPreviewPlaying ? "Pause" : "Play"}
      onClick={toggleMediaPreviewPlayback}
    >
      {isMediaPreviewPlaying ? "❚❚" : "▶"}
    </button>
    <span>{formatMediaPreviewTime(mediaPreviewDisplayTime)}</span>
    <input
      className="media-preview-seek"
      type="range"
      min={mediaPreviewSeekMinSeconds}
      max={mediaPreviewSeekMaxSeconds}
      step="0.01"
      value={Math.min(mediaPreviewSeekMaxSeconds, Math.max(mediaPreviewSeekMinSeconds, mediaPreviewTime))}
      aria-label="Seek imported video"
      onChange={handleMediaPreviewSeek}
    />
    <span>{formatMediaPreviewTime(mediaPreviewDisplayDuration)}</span>
    <div className="media-preview-volume-control">
      <button
        type="button"
        className="media-preview-icon-button"
        aria-label="Adjust imported video volume"
        title="Volume"
        aria-expanded={isMediaPreviewVolumeOpen}
        onClick={() => setIsMediaPreviewVolumeOpen((open) => !open)}
      >
        {mediaPreviewVolume === 0 ? "🔇" : "🔊"}
      </button>
      {isMediaPreviewVolumeOpen ? (
        <input
          className="media-preview-volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={mediaPreviewVolume}
          aria-label="Imported video volume"
          onChange={handleMediaPreviewVolumeChange}
        />
      ) : null}
    </div>
  </div>
</div>
```

Remove the old imported-media controls below `preview-window`. Keep the existing central play button and badge for timeline mode only so imported video filenames and transport are not duplicated.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```powershell
node --test tests/media-preview-ui.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit behavior**

```powershell
git add video-editor/src/Composition.tsx video-editor/tests/media-preview-ui.test.mts
git commit -m "feat: add media preview transport overlay"
```

---

### Task 2: Hover, Focus, And Drag-Safe Presentation

**Files:**
- Modify: `video-editor/src/index.css:970-1020`
- Modify: `video-editor/src/Composition.tsx` only if an active seeking class is required after browser verification.
- Test: `video-editor/tests/media-preview-ui.test.mts`

**Interfaces:**
- Consumes: `.preview-window`, `.media-preview-overlay`, `.media-preview-transport`, `.media-preview-volume-control`, and `.volume-open` from Task 1.
- Produces: hidden-by-default controls that reveal on preview hover, `focus-within`, or open-volume state without covering the video unnecessarily.

- [ ] **Step 1: Write failing CSS contract tests**

Add:

```ts
assert.match(css, /\.media-preview-overlay\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
assert.match(css, /\.preview-window:hover \.media-preview-overlay[\s\S]*opacity:\s*1/);
assert.match(css, /\.preview-window:focus-within \.media-preview-overlay[\s\S]*opacity:\s*1/);
assert.match(css, /\.media-preview-overlay\.volume-open[\s\S]*opacity:\s*1/);
assert.match(css, /\.media-preview-transport\s*\{[^}]*position:\s*absolute[^}]*bottom:\s*0/s);
assert.match(css, /\.media-preview-filename\s*\{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
node --test tests/media-preview-ui.test.mts
```

Expected: FAIL because the overlay visibility and placement CSS is missing.

- [ ] **Step 3: Implement hover and focus styling**

Replace the old `.media-preview-controls` block with:

```css
.media-preview-overlay {
  position: absolute;
  inset: 0;
  z-index: 120;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.preview-window:hover .media-preview-overlay,
.preview-window:focus-within .media-preview-overlay,
.media-preview-overlay.volume-open {
  opacity: 1;
}

.media-preview-filename {
  position: absolute;
  top: 10px;
  right: 10px;
  left: 10px;
  overflow: hidden;
  padding: 7px 10px;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(2, 6, 23, 0.72);
}

.media-preview-transport {
  position: absolute;
  right: 8px;
  bottom: 8px;
  left: 8px;
  display: grid;
  grid-template-columns: 30px max-content minmax(52px, 1fr) max-content auto;
  align-items: center;
  gap: 7px;
  padding: 7px;
  color: #f8fafc;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  background: rgba(2, 6, 23, 0.78);
}

.media-preview-filename,
.media-preview-transport,
.media-preview-overlay.volume-open {
  pointer-events: auto;
}

.media-preview-icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #f8fafc;
}

.media-preview-volume-control {
  position: relative;
  display: flex;
  align-items: center;
}

.media-preview-volume-slider {
  width: 78px;
  accent-color: #38d6c8;
}
```

Keep `.media-preview-seek` at `width: 100%` with the existing accent color. Use square corners or at most the existing 8px preview radius; do not introduce decorative pill styling.

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```powershell
node --test tests/media-preview-ui.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Verify in the browser**

At `http://localhost:5173/`:

1. Select a full imported video and verify controls are hidden until hover.
2. Hover the preview and verify the top filename and bottom controls appear.
3. Drag the playhead to the middle and verify the preview seeks immediately.
4. Click play/pause and verify the playhead follows playback.
5. Open volume, move the slider, and verify audible volume changes without changing timeline clip volume.
6. Select a detected scene and verify the visible time begins at `00:00` and cannot seek outside the scene.
7. Tab through controls and verify the overlay remains visible under `focus-within`.

- [ ] **Step 6: Run final verification**

```powershell
node --test tests/media-preview-ui.test.mts tests/playhead-ui.test.mts tests/sceneDetectionClient.test.mts tests/editorLogic.test.mts
npx.cmd tsc --noEmit
npx.cmd remotion bundle --out-dir "$env:TEMP\video-editor-hover-controls-build"
git diff --check
```

Expected: all tests pass, TypeScript exits 0, Remotion creates the bundle, and `git diff --check` prints no errors.

- [ ] **Step 7: Commit styling**

```powershell
git add video-editor/src/index.css video-editor/src/Composition.tsx video-editor/tests/media-preview-ui.test.mts
git commit -m "style: reveal preview controls on hover"
```
