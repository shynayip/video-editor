# Unlimited Video Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag imported or existing videos onto unlimited dynamic tracks above or below the main track, with complete replacement on occupied ranges and correct preview/audio ordering.

**Architecture:** Preserve the existing `main` and `upper` clip categories for compatibility, but add a signed `videoLayer` value: main is 0, positive values render above it, and negative values render below it. Centralize layer lookup, replacement, movement, and compositing order in pure editor-logic helpers; keep React responsible for drag targets, row rendering, and preview elements.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, CSS, Node test runner, ESLint

## Global Constraints

- Import adds media only to the Media gallery.
- The main video track is layer 0.
- Positive layers render above Main; negative layers render below Main.
- There is no fixed number of secondary video layers.
- An occupied-range drop removes every overlapping clip on only that target layer, plus each removed clip's reciprocal linked audio.
- Replacement never removes narration, captions, text, stickers, or clips on other layers.
- A new video keeps its natural duration even when it is shorter than removed footage.
- Moving a video moves its reciprocal linked audio and preserves clip properties.
- Undo and Redo cover all completed timeline edits.

---

### Task 1: Add Signed Video-Layer and Replacement Logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TimelineClip[]`, clip IDs, signed target layer numbers, target start frames, and media-pair clips.
- Produces: `getVideoLayer`, `getNextVideoLayer`, `replaceVideoLayerRange`, `placeVideoPairOnLayer`, and `moveVideoClipToLayer`.

- [ ] **Step 1: Write failing signed-layer tests**

Add tests that preserve legacy overlay clips, allocate unlimited positive and negative layers, and identify main as layer 0.

```ts
assert.equal(getVideoLayer({
  ...historyClip("main"),
  track: "main",
}), 0);
assert.equal(getVideoLayer({
  ...historyClip("legacy-overlay"),
  track: "upper",
  overlayLane: 2,
}), 3);
assert.equal(getVideoLayer({
  ...historyClip("below"),
  track: "upper",
  videoLayer: -2,
}), -2);

assert.equal(getNextVideoLayer(clips, "above"), 4);
assert.equal(getNextVideoLayer(clips, "below"), -3);
```

- [ ] **Step 2: Write failing replacement and movement tests**

Cover complete removal of all overlaps on the target layer, linked-audio removal, narration preservation, other-layer preservation, frame-0 clamping, and movement of a reciprocal video/audio pair.

```ts
const replaced = replaceVideoLayerRange(clips, {
  videoLayer: 1,
  start: 60,
  duration: 90,
});
assert.equal(replaced.some((clip) => clip.id === "overlap-on-layer-1"), false);
assert.equal(replaced.some((clip) => clip.id === "overlap-audio"), false);
assert.equal(replaced.some((clip) => clip.id === "narration"), true);
assert.equal(replaced.some((clip) => clip.id === "same-time-layer-2"), true);

const moved = moveVideoClipToLayer(clips, "moving-video", -2, -40);
assert.deepEqual(
  moved.filter((clip) => clip.id === "moving-video" || clip.id === "moving-audio")
    .map((clip) => ({id: clip.id, start: clip.start})),
  [
    {id: "moving-video", start: 0},
    {id: "moving-audio", start: 0},
  ],
);
assert.equal(moved.find((clip) => clip.id === "moving-video")?.videoLayer, -2);
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run: `node --test tests\editorLogic.test.mts`

Expected: FAIL because the signed-layer helpers are not exported.

- [ ] **Step 4: Add the compatibility layer model**

Add `videoLayer?: number` to `TimelineClip`. Preserve existing data by mapping legacy `overlayLane` values to positive layers.

```ts
export type VideoLayerDirection = "above" | "below";

export const getVideoLayer = (clip: TimelineClip): number | null => {
  if (clip.track === "main") return 0;
  if (clip.track !== "upper") return null;
  return clip.videoLayer ?? (clip.overlayLane ?? 0) + 1;
};

export const getNextVideoLayer = (
  clips: TimelineClip[],
  direction: VideoLayerDirection,
) => {
  const layers = clips
    .map(getVideoLayer)
    .filter((layer): layer is number => layer !== null && layer !== 0);
  return direction === "above"
    ? Math.max(0, ...layers) + 1
    : Math.min(0, ...layers) - 1;
};
```

- [ ] **Step 5: Implement target-layer replacement**

Use reciprocal links to remove only overlapping video clips and their own audio.

```ts
export const replaceVideoLayerRange = (
  clips: TimelineClip[],
  target: {videoLayer: number; start: number; duration: number; excludeClipId?: string},
) => {
  const start = Math.max(0, target.start);
  const replacedIds = new Set(
    clips
      .filter((clip) =>
        clip.id !== target.excludeClipId &&
        getVideoLayer(clip) === target.videoLayer &&
        clipRangesOverlap(start, target.duration, clip.start, clip.duration),
      )
      .flatMap((clip) => [clip.id, clip.linkedClipId].filter(Boolean) as string[]),
  );
  return clips.filter((clip) => !replacedIds.has(clip.id));
};
```

- [ ] **Step 6: Implement placement and movement**

`placeVideoPairOnLayer` first calls `replaceVideoLayerRange`, then appends a reciprocal media pair using `track: "main"` for layer 0 or `track: "upper"` plus `videoLayer` otherwise. `moveVideoClipToLayer` removes destination collisions excluding the moving clip, updates its track/layer/start, and updates only its reciprocal linked audio start.

```ts
export const placeVideoPairOnLayer = (
  clips: TimelineClip[],
  pair: TimelineClip[],
  videoLayer: number,
  start: number,
) => {
  const video = pair.find((clip) => clip.track === "main" || clip.track === "upper");
  if (!video) return clips;
  const clampedStart = Math.max(0, start);
  const remaining = replaceVideoLayerRange(clips, {
    videoLayer,
    start: clampedStart,
    duration: video.duration,
  });
  return [
    ...remaining,
    ...pair.map((clip) =>
      clip.id === video.id
        ? {
            ...clip,
            track: videoLayer === 0 ? "main" : "upper",
            start: clampedStart,
            videoLayer: videoLayer === 0 ? undefined : videoLayer,
            overlayLane: undefined,
          }
        : {...clip, start: clampedStart},
    ),
  ];
};
```

- [ ] **Step 7: Run the logic tests and verify they pass**

Run: `node --test tests\editorLogic.test.mts`

Expected: all editor logic tests PASS.

---

### Task 2: Render Dynamic Video Rows and Drop Targets

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: Task 1's layer helpers, placement helper, and movement helper.
- Produces: signed video rows, New track above/below drop areas, and drag/drop placement at the pointer frame.

- [ ] **Step 1: Write the failing import and dynamic-row UI test**

Assert that gallery import no longer appends overlays, rows are derived from signed layers, two new-track drop areas exist, and row elements carry `data-video-layer`.

```ts
assert.doesNotMatch(importBlock, /appendMediaToOverlayTrack/);
assert.match(compositionSource, /getNextVideoLayer\(clips, "above"\)/);
assert.match(compositionSource, /getNextVideoLayer\(clips, "below"\)/);
assert.match(compositionSource, /data-new-video-layer="above"/);
assert.match(compositionSource, /data-new-video-layer="below"/);
assert.match(compositionSource, /data-video-layer=\{track\.videoLayer\}/);
assert.match(stylesheetSource, /\.new-video-layer-drop/);
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `node --test tests\playhead-ui.test.mts`

Expected: FAIL because import still auto-adds overlays and signed drop rows do not exist.

- [ ] **Step 3: Replace overlay-row derivation with signed video rows**

Change `TimelineRow` to carry `videoLayer?: number`. Derive distinct positive layers descending above Main and negative layers descending from nearest Main to furthest below. Keep sticker/text rows above Main and contextual audio below all video rows.

```tsx
const secondaryVideoLayers = Array.from(
  new Set(
    clips
      .map(getVideoLayer)
      .filter((layer): layer is number => layer !== null && layer !== 0),
  ),
);
const upperLayers = secondaryVideoLayers.filter((layer) => layer > 0).sort((a, b) => b - a);
const lowerLayers = secondaryVideoLayers.filter((layer) => layer < 0).sort((a, b) => b - a);
```

Render rows in this order: New track above, upper layers, sticker/text rows, Main, lower layers, New track below, contextual audio.

- [ ] **Step 4: Stop auto-adding imported media**

Remove the `newMediaItems.forEach(appendMediaToOverlayTrack)` call. Keep gallery state, selected media, preview mode, and input reset behavior.

- [ ] **Step 5: Replace string drop state with a structured target**

```ts
type VideoDropTarget =
  | {kind: "layer"; videoLayer: number}
  | {kind: "new-layer"; direction: VideoLayerDirection};

const [videoDropTarget, setVideoDropTarget] = useState<VideoDropTarget | null>(null);
```

During pointer move/up, read `data-video-layer` or `data-new-video-layer`. Calculate the horizontal target frame from the pointer position. New-track drops call `getNextVideoLayer`; existing rows use their signed layer.

- [ ] **Step 6: Use one placement path for imported media**

Replace overlay-specific placement with `placeMediaOnVideoLayer(mediaItem, videoLayer, startFrame)`. It creates a reciprocal pair and commits `placeVideoPairOnLayer` once, so Undo treats the replacement and insertion as one edit.

```tsx
const placeMediaOnVideoLayer = useCallback((
  mediaItem: MediaItem,
  videoLayer: number,
  startFrame: number,
) => {
  const timestamp = Date.now();
  const videoId = `video-${timestamp}-${mediaItem.id}`;
  const audioId = `video-audio-${timestamp}-${mediaItem.id}`;
  const pair = createVideoMediaPair({
    videoId,
    audioId,
    track: videoLayer === 0 ? "main" : "upper",
    label: mediaItem.label.replace(/\.[^.]+$/, ""),
    src: mediaItem.src,
    start: Math.max(0, startFrame),
    duration: mediaItem.durationInFrames,
  });
  commitClipChange((current) =>
    placeVideoPairOnLayer(current, pair, videoLayer, startFrame),
  );
  setSelectedClipId(videoId);
  setSelectedTrack(videoLayer === 0 ? "main" : "upper");
}, [commitClipChange]);
```

- [ ] **Step 7: Allow existing main and secondary clips to move between rows**

Mark both main and secondary video clips draggable. On drop, call `moveVideoClipToLayer` with the target signed layer and pointer frame minus the clip grab offset. Do not use `removeOverlayCollisions`, which silently deletes by the old unsigned lane model.

- [ ] **Step 8: Add compact new-track drop styling**

```css
.new-video-layer-drop {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  min-height: 34px;
  color: #738398;
}

.new-video-layer-drop .track-lane {
  border-style: dashed;
  background: #0c141d;
}

.new-video-layer-drop.drop-target .track-lane {
  border-color: #38d6c8;
  background: #12302f;
}
```

- [ ] **Step 9: Run the UI and logic tests**

Run: `node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts`

Expected: all tests PASS.

---

### Task 3: Composite Signed Layers and Select the Correct Audio

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: signed-layer clips and the playhead frame.
- Produces: `getActiveVideoLayersAtFrame`, `getTopVisibleVideoClipAtFrame`, signed preview order, and correct linked playback audio.

- [ ] **Step 1: Write failing compositing and audio tests**

Create active clips at layers `-2`, `-1`, `0`, `1`, and `3`. Assert render order is `[-2, -1, 0, 1, 3]`, top visible is layer 3, hidden clips are ignored, and linked playback audio comes from layer 3 while narration remains independent.

```ts
assert.deepEqual(
  getActiveVideoLayersAtFrame(clips, 45).map(getVideoLayer),
  [-2, -1, 0, 1, 3],
);
assert.equal(getTopVisibleVideoClipAtFrame(clips, 45)?.id, "layer-3");
assert.deepEqual(
  getPlaybackAudioClips(clips, 45).map((clip) => clip.id),
  ["layer-3-audio"],
);
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests\editorLogic.test.mts`

Expected: FAIL because the signed compositing helpers do not exist.

- [ ] **Step 3: Implement signed active-layer ordering**

```ts
export const getActiveVideoLayersAtFrame = (
  clips: TimelineClip[],
  frame: number,
) => clips
  .filter((clip) =>
    getVideoLayer(clip) !== null &&
    !clip.hidden &&
    frame >= clip.start &&
    frame < clip.start + clip.duration,
  )
  .sort((a, b) => (getVideoLayer(a) ?? 0) - (getVideoLayer(b) ?? 0));

export const getTopVisibleVideoClipAtFrame = (
  clips: TimelineClip[],
  frame: number,
) => {
  const active = getActiveVideoLayersAtFrame(clips, frame);
  return active[active.length - 1];
};
```

Update `getPlaybackAudioClips` to choose only the reciprocal linked audio of `getTopVisibleVideoClipAtFrame`. Keep `getIndependentPlaybackAudioClips` unchanged so narration continues.

- [ ] **Step 4: Refactor preview rendering around the ordered active list**

In `Composition.tsx`, derive `activeVideoLayers`. Render each video in sorted order inside the preview, using stable absolute positioning and `zIndex` based on list order. Preserve source-time seeking, speed, volume/muting, visual styles, and playback synchronization for every active video element.

```tsx
{activeVideoLayers.map((videoClip, index) => (
  <video
    key={videoClip.id}
    className="preview-video preview-layer-video"
    data-video-layer={getVideoLayer(videoClip)}
    src={resolveMediaSource(videoClip.src as string)}
    muted
    playsInline
    style={{
      filter: getClipVisualFilter(videoClip),
      zIndex: index + 1,
    }}
  />
))}
```

- [ ] **Step 5: Add UI source assertions for signed preview order**

```ts
assert.match(compositionSource, /getActiveVideoLayersAtFrame\(clips, playheadFrame\)/);
assert.match(compositionSource, /activeVideoLayers\.map\(\(videoClip, index\) =>/);
assert.match(compositionSource, /data-video-layer=\{getVideoLayer\(videoClip\)\}/);
assert.doesNotMatch(compositionSource, /getActiveOverlayClipsAtFrame/);
```

- [ ] **Step 6: Run all verification commands**

Run:

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
npm.cmd run lint
(Invoke-WebRequest -UseBasicParsing http://localhost:5173/ -TimeoutSec 5).StatusCode
```

Expected: all tests PASS, ESLint and TypeScript exit 0, and the local page returns HTTP 200.

- [ ] **Step 7: Preserve the implementation without disturbing unrelated staged changes**

Inspect `git status --short` and `git diff --cached --name-status`. If unrelated changes remain staged in a touched file, leave the implementation uncommitted and report that clearly. Otherwise commit only `src/editorLogic.ts`, `src/Composition.tsx`, `src/index.css`, `tests/editorLogic.test.mts`, and `tests/playhead-ui.test.mts`.
