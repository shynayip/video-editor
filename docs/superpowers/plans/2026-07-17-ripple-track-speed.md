# Ripple Track-Wide Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every video clip on a selected layer contiguous when track-wide speed changes alter clip durations, without doubling playback speed or autosaving every slider preview.

**Architecture:** Extend the existing pure `setVideoLayerSpeed` timeline helper to calculate ordered, contiguous starts alongside speed-adjusted durations. Apply the same timing updates to reciprocal linked audio; existing Composition slider routing and gesture history remain unchanged.

**Tech Stack:** TypeScript, React, Remotion, Node test runner

## Global Constraints

- The first eligible video keeps its existing timeline start.
- Later eligible videos start at the previous eligible video's recalculated end.
- Existing gaps and overlaps on the selected layer collapse during track-wide speed changes.
- Reciprocal audio receives identical start, duration, and speed values.
- Images, one-way audio, other layers, and per-clip speed behavior remain unchanged.
- One slider drag remains one Undo action.
- Timeline output time advances at a constant 30 FPS; clip speed is applied only through source timing and native media playback rate.
- Autosave uses one trailing write after rapid editor changes while explicit Save remains immediate.

---

### Task 1: Ripple Exact-Layer Video Timing

**Files:**
- Modify: `src/editorLogic.ts:3583-3610`
- Test: `tests/editorLogic.test.mts:2640-2830`

**Interfaces:**
- Consumes: `setVideoLayerSpeed(clips: TimelineClip[], videoLayer: number, speed: number): TimelineClip[]`, `isVideoLayerControlTarget`, and reciprocal audio lookup.
- Produces: The same `setVideoLayerSpeed` interface, now returning contiguous video and linked-audio timing for the selected layer.

- [ ] **Step 1: Write the failing contiguous-speed tests**

Add tests that create three videos on one signed layer with starts `30`, `150`, and `330`, reciprocal audio for each, plus unrelated media. After `setVideoLayerSpeed(clips, 0, 2)`, assert video starts are `30`, `90`, and `180`; assert recalculated durations remain `60`, `90`, and the third clip's computed duration; assert reciprocal audio matches each video; and assert unrelated clips retain object identity. Add a slow-speed case using speed `0.5` and assert the same back-to-back invariant.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="keeps a video layer contiguous" tests/editorLogic.test.mts
```

Expected: FAIL because the second and third clips retain their old `start` values.

- [ ] **Step 3: Implement ordered ripple timing**

In `setVideoLayerSpeed`, gather eligible videos with their original array indices, sort by `start` and then index, and build an update map. Keep the first clip's start, set each later start to the running end, and compute duration with:

```ts
const duration = Math.max(
  1,
  Math.round((video.duration * (video.speed ?? 1)) / speed),
);
```

Store `{start, duration, speed}` for each video and its reciprocal audio. Apply those three fields only to mapped clips.

- [ ] **Step 4: Run focused and regression tests**

Run:

```powershell
node --test --test-name-pattern="video layer|signed layer|layer controls|layer-control|keeps a video layer contiguous" tests/editorLogic.test.mts
node --test --test-name-pattern="selected video layer|layer-control" tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
npx.cmd eslint src
```

Expected: focused tests, UI wiring tests, TypeScript, and ESLint all pass. Record any unrelated shared-worktree failures separately.

- [ ] **Step 5: Commit the focused change**

```powershell
git add -- src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "fix: ripple clips after track speed changes"
```

### Task 2: Remove Double-Speed Playback and Slider Autosave Churn

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx:2120-2170, 5260-5290`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Produces: `advanceTimelinePlaybackFrame(currentFrame: number, projectDuration: number, framesPerTick?: number): number`.
- Preserves: existing project serialization, explicit Save, clip playback rate, source-time conversion, and Undo behavior.

- [ ] **Step 1: Write failing playback and autosave tests**

Add an executable pure-helper test proving the next timeline frame is `currentFrame + 3` regardless of whether the active clip is `0.5x`, `1x`, or `2x`, with clamping at project end. Add UI wiring assertions that the timeline playback interval calls the helper without active clip speed and that autosave schedules and clears one timeout around project persistence.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="advances timeline playback at a constant rate|debounces editor autosave" tests/editorLogic.test.mts tests/playhead-ui.test.mts
```

Expected: FAIL because the helper does not exist and autosave is currently synchronous per editor update.

- [ ] **Step 3: Implement constant output-time playback**

Add the pure helper with input validation and project-end clamping. Replace the playback interval's `3 * speed` calculation with this helper so timeline output time advances by three frames per 100 milliseconds. Keep native video/audio `playbackRate` and `getClipSourceTime` unchanged.

- [ ] **Step 4: Debounce automatic project persistence**

Change only the automatic persistence effect to schedule a trailing `window.setTimeout` write and clear the pending timeout during rapid state changes. Keep the explicit Save button's direct persistence path unchanged.

- [ ] **Step 5: Verify focused behavior and static checks**

Run:

```powershell
node --test --test-name-pattern="advances timeline playback at a constant rate|debounces editor autosave|video layer|signed layer|layer controls|layer-control|keeps a video layer contiguous" tests/editorLogic.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
npx.cmd eslint src
```

Expected: all focused tests and static checks pass.
