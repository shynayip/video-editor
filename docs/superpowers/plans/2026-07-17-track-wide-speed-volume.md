# Track-Wide Speed and Volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let blank-space selection on any video lane apply exact speed and volume values to every video on that signed layer, while clip selection continues to edit only one clip.

**Architecture:** Add pure layer-wide editing helpers in `editorLogic.ts`, then add an explicit `selectedVideoLayer` control scope in `Composition.tsx`. The details panel will route the same sliders to either clip helpers or layer helpers, and each track-wide edit will remain one history operation.

**Tech Stack:** React 19, TypeScript, Remotion 4, CSS, Node test runner.

## Global Constraints

- Clicking a clip edits only that clip and its reciprocal linked audio.
- Clicking blank space on a video lane clears clip selection and selects only that signed video layer.
- Track-wide controls set exact values: `1.50x` means every video on the selected layer becomes `1.50x`; `70%` means every video on the selected layer becomes `70%`.
- Independent narration, background music, captions, text, stickers, cutouts, and other video layers remain unchanged.
- A track-wide update creates one timeline history entry and one Undo restores it.
- Do not add dependencies or restructure the existing large editor component.

---

### Task 1: Pure Video-Layer Speed and Volume Helpers

**Files:**
- Modify: `src/editorLogic.ts:3352-3405`
- Test: `tests/editorLogic.test.mts:1235-1325`

**Interfaces:**
- Consumes: `TimelineClip`, `getVideoLayer(clip)`, and reciprocal `linkedClipId` metadata.
- Produces: `setVideoLayerSpeed(clips: TimelineClip[], videoLayer: number, speed: number): TimelineClip[]` and `setVideoLayerVolume(clips: TimelineClip[], videoLayer: number, volume: number): TimelineClip[]`.

- [ ] **Step 1: Write failing layer-wide helper tests**

Add imports and tests that create two main videos with reciprocal audio, one overlay video, and independent narration:

```ts
const layerControlClips: TimelineClip[] = [
  {id: "main-1", label: "Main 1", track: "main", start: 0, duration: 120, color: "#0891b2", speed: 1, volume: 1, linkedClipId: "main-audio-1"},
  {id: "main-audio-1", label: "Main 1 audio", track: "audio", start: 0, duration: 120, color: "#2563eb", speed: 1, volume: 1, linkedClipId: "main-1"},
  {id: "main-2", label: "Main 2", track: "main", start: 120, duration: 90, color: "#0891b2", speed: 1, volume: 1, linkedClipId: "main-audio-2"},
  {id: "main-audio-2", label: "Main 2 audio", track: "audio", start: 120, duration: 90, color: "#2563eb", speed: 1, volume: 1, linkedClipId: "main-2"},
  {id: "overlay", label: "Overlay", track: "upper", start: 0, duration: 60, color: "#7c3aed", speed: 1, volume: 1, videoLayer: 1, linkedClipId: "overlay-audio"},
  {id: "overlay-audio", label: "Overlay audio", track: "audio", start: 0, duration: 60, color: "#2563eb", speed: 1, volume: 1, linkedClipId: "overlay"},
  {id: "narration", label: "Narration", track: "audio", start: 0, duration: 300, color: "#1d4ed8", speed: 1, volume: 1},
  {id: "music", label: "Music", track: "audio", start: 0, duration: 300, color: "#1d4ed8", speed: 1, volume: 0.5},
  {id: "caption", label: "Caption", track: "caption", start: 0, duration: 60, color: "#ef4444", content: "Unchanged"},
  {id: "legacy-main", label: "Legacy main", track: "main", start: 210, duration: 30, color: "#0891b2", speed: 1, volume: 1},
];

test("sets exact speed on every video in one signed layer and its linked audio", () => {
  const result = setVideoLayerSpeed(layerControlClips, 0, 1.5);

  assert.deepEqual(
    result.filter((clip) => ["main-1", "main-audio-1", "main-2", "main-audio-2", "legacy-main"].includes(clip.id))
      .map(({id, speed}) => ({id, speed})),
    [
      {id: "main-1", speed: 1.5},
      {id: "main-audio-1", speed: 1.5},
      {id: "main-2", speed: 1.5},
      {id: "main-audio-2", speed: 1.5},
      {id: "legacy-main", speed: 1.5},
    ],
  );
  for (const id of ["overlay", "overlay-audio", "narration", "music", "caption"]) {
    assert.strictEqual(
      result.find((clip) => clip.id === id),
      layerControlClips.find((clip) => clip.id === id),
    );
  }
});

test("sets exact volume on every video in one signed layer and its linked audio", () => {
  const result = setVideoLayerVolume(layerControlClips, 1, 0.7);

  assert.equal(result.find((clip) => clip.id === "overlay")?.volume, 0.7);
  assert.equal(result.find((clip) => clip.id === "overlay-audio")?.volume, 0.7);
  for (const id of ["main-1", "main-audio-1", "legacy-main", "narration", "music", "caption"]) {
    assert.strictEqual(
      result.find((clip) => clip.id === id),
      layerControlClips.find((clip) => clip.id === id),
    );
  }
});

test("rejects invalid video-layer speed and volume values", () => {
  assert.strictEqual(setVideoLayerSpeed(layerControlClips, 0, 0), layerControlClips);
  assert.strictEqual(setVideoLayerSpeed(layerControlClips, 0, Number.NaN), layerControlClips);
  assert.strictEqual(setVideoLayerVolume(layerControlClips, 0, -0.1), layerControlClips);
  assert.strictEqual(setVideoLayerVolume(layerControlClips, 0, Number.NaN), layerControlClips);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test --test-name-pattern="sets exact speed on every video|sets exact volume on every video|rejects invalid video-layer" tests/editorLogic.test.mts
```

Expected: FAIL because `setVideoLayerSpeed` and `setVideoLayerVolume` are not exported.

- [ ] **Step 3: Implement the minimal pure helpers**

Add helpers that build per-id updates from video clips on the requested layer:

```ts
export const setVideoLayerSpeed = (
  clips: TimelineClip[],
  videoLayer: number,
  speed: number,
): TimelineClip[] => {
  if (!Number.isFinite(videoLayer) || !Number.isFinite(speed) || speed <= 0) return clips;
  const updates = new Map<string, {duration: number; speed: number}>();

  for (const video of clips.filter((clip) => getVideoLayer(clip) === videoLayer)) {
    const duration = Math.max(1, Math.round((video.duration * (video.speed ?? 1)) / speed));
    updates.set(video.id, {duration, speed});
    const linkedAudio = getReciprocalLinkedAudio(clips, video);
    if (linkedAudio) updates.set(linkedAudio.id, {duration, speed});
  }

  if (updates.size === 0) return clips;
  return clips.map((clip) => {
    const update = updates.get(clip.id);
    return update ? {...clip, ...update} : clip;
  });
};

export const setVideoLayerVolume = (
  clips: TimelineClip[],
  videoLayer: number,
  volume: number,
): TimelineClip[] => {
  if (!Number.isFinite(videoLayer) || !Number.isFinite(volume) || volume < 0) return clips;
  const targetIds = new Set<string>();

  for (const video of clips.filter((clip) => getVideoLayer(clip) === videoLayer)) {
    targetIds.add(video.id);
    const linkedAudio = getReciprocalLinkedAudio(clips, video);
    if (linkedAudio) targetIds.add(linkedAudio.id);
  }

  if (targetIds.size === 0) return clips;
  return clips.map((clip) => targetIds.has(clip.id) ? {...clip, volume} : clip);
};
```

- [ ] **Step 4: Run helper tests and verify GREEN**

Run the Step 2 command again.

Expected: all three tests PASS; durations for reciprocal video/audio pairs match after speed changes, the unlinked legacy video still updates, and unrelated tracks retain object identity.

- [ ] **Step 5: Commit helper behavior**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add video layer speed and volume helpers"
```

---

### Task 2: Distinguish Whole-Track Selection From Clip Selection

**Files:**
- Modify: `src/Composition.tsx:1420-1660, 1948-1970, 2348-2400, 6890-6938, 7110-7160`
- Test: `tests/playhead-ui.test.mts:620-650`

**Interfaces:**
- Consumes: `setVideoLayerSpeed` and `setVideoLayerVolume` from Task 1.
- Produces: `selectedVideoLayer: number | null`, `selectWholeVideoLayer(videoLayer: number)`, and slider routing based on clip scope versus layer scope.

- [ ] **Step 1: Write failing UI wiring tests**

Add a source-level regression test:

```ts
test("routes speed and volume to a selected video layer or one selected clip", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[selectedVideoLayer, setSelectedVideoLayer\] = useState<number \| null>\(null\)/);
  assert.match(
    source,
    /const selectWholeVideoLayer = \(videoLayer: number\) => \{[\s\S]*?setSelectedVideoLayer\(videoLayer\);[\s\S]*?setSelectedClipId\(null\);/,
  );
  assert.match(
    source,
    /event\.target === event\.currentTarget[\s\S]*?selectWholeVideoLayer\(track\.videoLayer\)/,
  );
  assert.match(source, /setVideoLayerSpeed\(currentClips, selectedVideoLayer, speed\)/);
  assert.match(source, /setVideoLayerVolume\(currentClips, selectedVideoLayer, volume\)/);
  assert.match(source, /layerSpeeds\.size === 1/);
  assert.match(source, /layerVolumes\.size === 1/);
  assert.match(source, /clipControlTarget \|\| selectedVideoLayer !== null/);
  assert.match(source, /const canEditSelectedSpeed = hasSelectedVideoLayer \|\|/);
  assert.match(source, /const canEditSelectedVolume = hasSelectedVideoLayer \|\|/);
  assert.match(source, /selectedVideoLayer === track\.videoLayer/);
  assert.match(source, /Track controls/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test --test-name-pattern="routes speed and volume to a selected video layer" tests/playhead-ui.test.mts
```

Expected: FAIL because whole-layer selection state and routing do not exist.

- [ ] **Step 3: Add explicit control-scope state and selection transitions**

Import Task 1 helpers and add:

```ts
const [selectedVideoLayer, setSelectedVideoLayer] = useState<number | null>(null);

const selectWholeVideoLayer = (videoLayer: number) => {
  setSelectedVideoLayer(videoLayer);
  setSelectedClipId(null);
  setSelectedTrack(videoLayer === 0 ? "main" : "upper");
  setIsAudioTrackVisible(
    clips.some(
      (clip) => getVideoLayer(clip) === videoLayer && Boolean(clip.linkedClipId),
    ),
  );
};
```

At the start of `selectTimelineClip`, `selectTrackClipAtFrame`, and `selectVideoLayerClipAtFrame`, call `setSelectedVideoLayer(null)`. Also clear `selectedVideoLayer` after `placeMediaOnVideoLayer` selects its new clip and when `openVisualTool` resolves a single visual target. In blank-lane handling, call `selectWholeVideoLayer(track.videoLayer)` and do not call `selectVideoLayerClipAtFrame`.

Use this exact blank-lane transition for both the label click and the lane's empty-area pointer handler:

```tsx
if (track.videoLayer !== undefined) {
  selectWholeVideoLayer(track.videoLayer);
  return;
}
selectTrackClipAtFrame(track.id, Math.max(0, frame));
```

Keep `selectVideoLayerClipAtFrame` for flows that intentionally resolve one clip at the current frame; because it starts with `setSelectedVideoLayer(null)`, it cannot leave both control scopes active.

- [ ] **Step 4: Derive track control values and route slider changes**

Compute selected-layer videos and shared values:

```ts
const selectedVideoLayerClips = selectedVideoLayer === null
  ? []
  : clips.filter((clip) => getVideoLayer(clip) === selectedVideoLayer);
const layerSpeeds = new Set(selectedVideoLayerClips.map((clip) => clip.speed ?? 1));
const layerVolumes = new Set(selectedVideoLayerClips.map((clip) => clip.volume ?? 1));
const hasSelectedVideoLayer = selectedVideoLayerClips.length > 0;
const selectedClipSpeed = clipControlTarget?.speed ??
  (layerSpeeds.size === 1 ? [...layerSpeeds][0] : 1);
const selectedClipVolume = clipControlTarget?.volume ??
  (layerVolumes.size === 1 ? [...layerVolumes][0] : 1);
const canEditSelectedSpeed = hasSelectedVideoLayer ||
  clipControlTarget?.track === "main" ||
  clipControlTarget?.track === "upper" ||
  clipControlTarget?.track === "cutout" ||
  clipControlTarget?.track === "audio";
const canEditSelectedVolume = hasSelectedVideoLayer || Boolean(
  clipControlTarget &&
    clipControlTarget.track !== "sticker" &&
    clipControlTarget.cutout?.mediaKind !== "image",
);
```

Route updates with clip selection taking priority:

```ts
const updateSelectedClipSpeed = (speed: number) => {
  commitClipChange((currentClips) =>
    clipControlTarget
      ? setClipSpeedById(currentClips, clipControlTarget.id, speed)
      : selectedVideoLayer !== null
        ? setVideoLayerSpeed(currentClips, selectedVideoLayer, speed)
        : currentClips,
  );
};

const updateSelectedClipVolume = (volume: number) => {
  commitClipChange((currentClips) =>
    clipControlTarget
      ? setClipVolumeById(currentClips, clipControlTarget.id, volume)
      : selectedVideoLayer !== null
        ? setVideoLayerVolume(currentClips, selectedVideoLayer, volume)
        : currentClips,
  );
};
```

- [ ] **Step 5: Render the correct control scope and lane highlight**

Render controls when either a clip or any video layer is selected. For an empty selected layer, show neutral values but disable both sliders through `hasSelectedVideoLayer`. Replace the details-panel guard and heading with a clip-first label and a layer fallback:

```tsx
const layerControlLabel = selectedVideoLayer === 0
  ? "Main track"
  : selectedVideoLayer === null
    ? ""
    : `Video layer ${selectedVideoLayer > 0 ? "+" : ""}${selectedVideoLayer}`;
const clipControlHeading = activeTool === "audio"
  ? "Audio controls"
  : activeTool === "animations"
    ? "Animation controls"
    : activeTool === "effects"
      ? "Effect controls"
      : activeTool === "filters"
        ? "Filter controls"
        : "Clip controls";

// In the details panel:
{clipControlTarget || selectedVideoLayer !== null ? (
  <div className="clip-controls">
    <span>
      {clipControlTarget
        ? `${clipControlHeading}: ${clipControlTarget.label}`
        : `Track controls: ${layerControlLabel}`}
    </span>
    <label>
      <strong>Speed</strong>
      <em>{selectedClipSpeed.toFixed(2)}x</em>
      <input
        type="range"
        min="0.25"
        max="2"
        step="0.05"
        value={selectedClipSpeed}
        disabled={!canEditSelectedSpeed}
        onChange={(event) => {
          updateSelectedClipSpeed(Number(event.currentTarget.value));
        }}
      />
    </label>
    <label>
      <strong>Volume</strong>
      <em>{Math.round(selectedClipVolume * 100)}%</em>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={selectedClipVolume}
        disabled={!canEditSelectedVolume}
        onChange={(event) => {
          updateSelectedClipVolume(Number(event.currentTarget.value));
        }}
      />
    </label>
  </div>
) : null}
```

Change lane selection styling so only the exact signed layer is highlighted:

```tsx
className={`track-lane ${
  (videoDropTarget?.kind === "layer" &&
    videoDropTarget.videoLayer === track.videoLayer) ||
  (videoDropTarget?.kind === "append-main" && track.videoLayer === 0)
    ? "drop-target"
    : ""
} ${
  track.videoLayer !== undefined && selectedVideoLayer === track.videoLayer
    ? "selected-track-lane"
    : ""
} ${track.id === "upper" ? "overlay-track-lane" : ""}`}
```

Selected clips retain `selected-timeline-clip`; selecting one clears `selectedVideoLayer`, so individual-clip editing does not highlight the lane.

- [ ] **Step 6: Run UI and focused logic tests**

```powershell
& "C:\Program Files\nodejs\node.exe" --test --test-name-pattern="routes speed and volume to a selected video layer|allows selected audio clips to use the selected clip speed control" tests/playhead-ui.test.mts
& "C:\Program Files\nodejs\node.exe" --test --test-name-pattern="sets exact speed on every video|sets exact volume on every video|rejects invalid video-layer|adjusts a selected overlay clip" tests/editorLogic.test.mts
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit UI behavior**

```powershell
git add src/Composition.tsx tests/playhead-ui.test.mts
git commit -m "feat: add track-wide speed and volume controls"
```

---

### Task 3: Verify Selection, Undo, and Production Build

**Files:**
- Modify only if verification exposes a scoped defect: `src/Composition.tsx`, `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`, `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: all Task 1 and Task 2 behavior.
- Produces: verified track-wide and clip-only editing with one-step Undo.

- [ ] **Step 1: Run focused automated verification**

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests/editorLogic.test.mts
& "C:\Program Files\nodejs\node.exe" --test --test-name-pattern="routes speed and volume to a selected video layer|provides a direct append target|allows selected audio clips" tests/playhead-ui.test.mts
```

Expected: all focused tests PASS. If the complete UI file still reports the known stale workspace-width assertion, do not alter unrelated layout behavior as part of this feature.

- [ ] **Step 2: Run static and production checks**

```powershell
& "C:\Program Files\nodejs\npx.cmd" eslint src
& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit
$out = Join-Path $env:TEMP "video-editor-track-controls-verify"
& "C:\Program Files\nodejs\npx.cmd" remotion bundle --out-dir=$out
```

Expected: source lint and TypeScript exit `0`; Remotion creates the temporary bundle.

- [ ] **Step 3: Verify in the browser**

1. Reload `http://localhost:5173/`.
2. Click blank space after the last clip on Main track and confirm the lane, not a clip, is selected.
3. Set speed to `1.50x` and volume to `70%`; confirm every main video and reciprocal linked audio receives those exact values.
4. Click one main clip, set speed to `0.75x`, and confirm only that clip and its reciprocal audio change.
5. Select one signed overlay lane and confirm other overlay layers remain unchanged.
6. Click Undo once after a track-wide change and confirm all clips from that single operation return to their previous values.
7. Check browser logs and confirm there are no runtime errors.

- [ ] **Step 4: Commit any verification-only fixes**

If no fixes were required, skip this commit. Otherwise:

```powershell
git add src/Composition.tsx src/editorLogic.ts tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "fix: finalize track-wide clip controls"
```
