# Overlay Linked Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each main and overlay video its own contextual audio clip, with topmost-overlay audio priority during playback.

**Architecture:** Keep video and audio as separate `TimelineClip` records connected by `linkedClipId`. Pure helpers in `editorLogic.ts` will create pairs, filter contextual audio, choose playback audio, and apply linked edits; `Composition.tsx` will render only the selected pair's audio row and play only the winning audio clip.

**Tech Stack:** React 19, TypeScript, Remotion 4, native HTML media elements, Node test runner, ESLint.

## Global Constraints

- Every imported main or overlay video has a linked audio clip.
- The contextual audio row shows only audio linked to the selected video.
- Active overlay audio replaces main audio; the topmost active overlay wins.
- Recorded narration remains independent.
- Existing unlinked clips continue to render.
- No new dependencies.

---

### Task 1: Create And Query Linked Video Audio

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `createVideoMediaPair(options): [TimelineClip, TimelineClip]`
- Produces: `getContextualAudioClips(clips, selectedClipId): TimelineClip[]`
- Produces: `getPlaybackAudioClips(clips, frame): TimelineClip[]`

- [ ] **Step 1: Write failing pair-creation tests**

Add tests proving `createVideoMediaPair` creates linked `main` and `audio` records for a main video and linked `upper` and `audio` records for an overlay, including matching source, start, duration, and overlay lane.

```ts
const [overlay, audio] = createVideoMediaPair({
  videoId: "overlay-1",
  audioId: "overlay-audio-1",
  track: "upper",
  label: "Camera",
  src: "camera.mp4",
  start: 60,
  duration: 120,
  overlayLane: 2,
});
assert.equal(overlay.linkedClipId, audio.id);
assert.equal(audio.linkedClipId, overlay.id);
assert.equal(audio.start, overlay.start);
assert.equal(audio.duration, overlay.duration);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because `createVideoMediaPair` is not exported.

- [ ] **Step 3: Generalize main pair creation**

Implement `createVideoMediaPair` with `track: "main" | "upper"`, preserve `createMainMediaPair` as a compatibility wrapper, and assign the existing main/overlay colors.

```ts
export const createVideoMediaPair = (options: VideoMediaPairOptions) => {
  const video: TimelineClip = {
    id: options.videoId,
    label: options.label,
    track: options.track,
    start: options.start,
    duration: options.duration,
    color: options.track === "main" ? "#0891b2" : "#7c3aed",
    src: options.src,
    speed: 1,
    volume: 1,
    linkedClipId: options.audioId,
    ...(options.track === "upper" ? {overlayLane: options.overlayLane ?? 0} : {}),
  };
  const audio: TimelineClip = {
    id: options.audioId,
    label: `${options.label} audio`,
    track: "audio",
    start: options.start,
    duration: options.duration,
    color: "#2563eb",
    src: options.src,
    speed: 1,
    volume: 1,
    linkedClipId: options.videoId,
  };
  return [video, audio] as [TimelineClip, TimelineClip];
};
```

- [ ] **Step 4: Write failing contextual and playback-priority tests**

Test that contextual audio returns only the selected video's linked audio. Test that playback returns main audio with no overlay, overlay audio while one overlay is active, and only the highest-lane/topmost overlay audio when overlays overlap.

- [ ] **Step 5: Implement query helpers and verify GREEN**

Use `linkedClipId` for contextual filtering. For playback, find active overlays with `getActiveOverlayClipsAtFrame`, take the final/topmost clip, and return its linked audio; otherwise use the active main video's linked audio. Do not include independent narration in this ownership decision.

Run: `node --test tests/editorLogic.test.mts`

Expected: all editor logic tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: link audio to every video clip"
```

### Task 2: Keep Linked Pairs Synchronized During Editing

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TimelineClip.linkedClipId`
- Produces: pair-aware `moveOverlayClip`, `trimClipById`, `splitClipByIdAtFrame`, and `deleteClipById`

- [ ] **Step 1: Write failing linked-edit tests**

Add independent tests proving that moving and trimming an overlay updates its linked audio, splitting produces two video/audio pairs with correct source offsets, and deleting removes only the selected video and its linked audio. Include a test proving narration remains unchanged.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because current edit helpers modify only the video.

- [ ] **Step 3: Implement linked movement and trimming**

When the target is a `main` or `upper` clip, resolve its linked audio by ID and apply the same start/duration delta and source offset. Keep the audio's track and color unchanged.

- [ ] **Step 4: Implement linked split and deletion**

Split the video and linked audio at the same frame. Generate two new reciprocal link pairs, preserving the original label on both video segments. Delete the linked partner only when a selected video has an explicit reciprocal link; never delete unrelated narration.

- [ ] **Step 5: Run the tests and verify GREEN**

Run: `node --test tests/editorLogic.test.mts`

Expected: all editor logic tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: synchronize linked video audio edits"
```

### Task 3: Wire Contextual Audio Selection And Rendering

**Files:**
- Modify: `src/Composition.tsx`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `createVideoMediaPair`, `getContextualAudioClips`
- Produces: a single contextual audio row for the selected main or overlay video

- [ ] **Step 1: Write failing UI-wiring tests**

Assert that overlay import appends a video/audio pair, `selectTimelineClip` reveals audio for both `main` and `upper`, and the audio timeline row maps `contextualAudioClips` rather than every clip whose track is `audio`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because overlay import creates only one clip and upper selection hides audio.

- [ ] **Step 3: Import overlays as linked pairs**

Replace `addOverlayMediaClip` usage in `appendMediaToOverlayTrack` with `createVideoMediaPair`, using unique overlay video and audio IDs and `findAvailableOverlayLane` for placement.

- [ ] **Step 4: Render only contextual audio**

Derive:

```ts
const contextualAudioClips = useMemo(
  () => getContextualAudioClips(clips, selectedClipId),
  [clips, selectedClipId],
);
```

Show the audio row when this list is non-empty, and filter the audio row to these IDs. Selecting its audio keeps the same linked context visible.

- [ ] **Step 5: Update selection visibility and controls**

Treat `upper` selection as audio-capable. When linked audio is selected, retain its owning video context. Volume and speed controls target the selected audio clip only.

- [ ] **Step 6: Run UI and logic tests**

Run: `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/Composition.tsx tests/playhead-ui.test.mts
git commit -m "feat: show audio for selected video clips"
```

### Task 4: Apply Topmost Overlay Audio Playback Priority

**Files:**
- Modify: `src/Composition.tsx`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `getPlaybackAudioClips(clips, playheadFrame)`
- Produces: muted video elements plus one winning linked audio source

- [ ] **Step 1: Write failing playback-wiring tests**

Assert that `Composition.tsx` derives `playbackAudioClips` from the helper, renders only those clips as `<audio>`, and keeps timeline video elements muted while linked playback audio exists.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because playback currently renders all active audio clips.

- [ ] **Step 3: Wire playback priority**

Replace broad `activeAudioClips` playback with:

```ts
const playbackAudioClips = useMemo(
  () => getPlaybackAudioClips(clips, playheadFrame),
  [clips, playheadFrame],
);
```

Render only the winning linked audio. Keep video elements muted when their linked audio is active, and allow legacy unlinked video audio as a fallback.

- [ ] **Step 4: Verify playback transitions**

Add tests for main-to-overlay, overlapping-overlay, and overlay-to-main transitions at boundary frames. Confirm hidden or zero-volume linked audio remains selected correctly without allowing lower-priority audio through.

- [ ] **Step 5: Run all verification**

Run:

```bash
node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts
npm.cmd run lint
```

Expected: all tests PASS; ESLint and TypeScript exit 0.

Open `http://localhost:5173/` and verify:

1. Select a main video: only its audio row appears.
2. Select each overlay: only that overlay's audio appears.
3. Play without an overlay: main audio is heard.
4. Play under an overlay: only overlay audio is heard.
5. Play overlapping overlays: only the topmost overlay audio is heard.

- [ ] **Step 6: Commit**

```bash
git add src/Composition.tsx tests/playhead-ui.test.mts
git commit -m "feat: prioritize topmost overlay audio"
```
