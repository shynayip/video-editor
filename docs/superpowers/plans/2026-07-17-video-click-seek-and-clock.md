# Video Click Seek And Timeline Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seek the red timeline playhead to the exact clicked position of any video clip and show current playback time beside total project duration.

**Architecture:** Keep compact ruler labels unchanged and add a separate fixed-width timecode formatter in `editorLogic.ts`. Route video clip pointer coordinates through the existing scroll-aware `getPointerTimelineFrame()` conversion, then pass the frame into the shared clip selection handler before existing drag behavior starts.

**Tech Stack:** React 19, TypeScript 5.9, Node test runner, Remotion 4

## Global Constraints

- Main, overlay, and additional video layers must share the same exact-position seeking behavior.
- Ordinary pointer movement must not move the playhead unless a supported timeline scrub or drag interaction is active.
- Text, caption, audio, and non-video selection behavior must remain unchanged.
- The summary format is always `HH:MM:SS / HH:MM:SS`.
- Existing timeline scrolling, scaling, clip dragging, and contextual audio selection must continue working.

---

### Task 1: Fixed Timeline Timecode

**Files:**
- Modify: `src/editorLogic.ts:618`
- Modify: `src/Composition.tsx:7625`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `frame: number`, `fps: number`
- Produces: `formatTimelineTimecode(frame: number, fps: number): string`

- [ ] **Step 1: Write failing formatter tests**

```ts
assert.equal(formatTimelineTimecode(0, 30), "00:00:00");
assert.equal(formatTimelineTimecode(16 * 30, 30), "00:00:16");
assert.equal(formatTimelineTimecode(60 * 30, 30), "00:01:00");
assert.equal(formatTimelineTimecode(3661 * 30, 30), "01:01:01");
```

- [ ] **Step 2: Write a failing UI source regression test**

```ts
assert.match(
  source,
  /formatTimelineTimecode\(playheadFrame, fps\)[\s\S]*?formatTimelineTimecode\(projectDuration, fps\)/,
);
assert.doesNotMatch(source, /\{projectDuration\} frames \/ /);
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="fixed timeline timecode|current and total timeline time" tests\editorLogic.test.mts tests\playhead-ui.test.mts
```

Expected: FAIL because `formatTimelineTimecode` and the new summary rendering do not exist.

- [ ] **Step 4: Add the minimal formatter**

```ts
export const formatTimelineTimecode = (frame: number, fps: number): string => {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};
```

- [ ] **Step 5: Render current and total time**

```tsx
<strong>
  {formatTimelineTimecode(playheadFrame, fps)} / {formatTimelineTimecode(projectDuration, fps)}
</strong>
```

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run the Step 3 command.

Expected: PASS.

### Task 2: Exact Video Clip Click Seeking

**Files:**
- Modify: `src/Composition.tsx:2583`
- Modify: `src/Composition.tsx:7855`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `selectTimelineClip(clip: TimelineClip, pointerFrame?: number | null)`
- Produces: selected video clip plus a playhead clamped to that clip's exact clicked timeline frame

- [ ] **Step 1: Write a failing interaction regression test**

```ts
assert.match(
  source,
  /const selectTimelineClip = \(clip: TimelineClip, pointerFrame\?: number \| null\)/,
);
assert.match(
  source,
  /const isVideoClip = clip\.track === "main" \|\| clip\.track === "upper" \|\| clip\.track === "cutout"/,
);
assert.match(
  source,
  /isVideoClip && pointerFrame !== null && pointerFrame !== undefined[\s\S]*?setPlayheadFrame\([\s\S]*?Math\.min\(clip\.start \+ clip\.duration - 1, pointerFrame\)/,
);
assert.match(
  source,
  /const pointerFrame = getPointerTimelineFrame\(event\.clientX\);[\s\S]*?selectTimelineClip\(clip, pointerFrame\)/,
);
```

- [ ] **Step 2: Run the focused interaction test and verify RED**

Run:

```powershell
node --test --test-name-pattern="seeks video clips to the exact clicked frame" tests\playhead-ui.test.mts
```

Expected: FAIL because selection does not accept or apply a pointer frame.

- [ ] **Step 3: Extend shared selection with exact video seeking**

```ts
const selectTimelineClip = (clip: TimelineClip, pointerFrame?: number | null) => {
  setSelectedVideoLayer(null);
  setSelectedClipId(clip.id);
  setSelectedTrack(clip.track);
  const isVideoClip = clip.track === "main" ||
    clip.track === "upper" ||
    clip.track === "cutout";
  if (isVideoClip && pointerFrame !== null && pointerFrame !== undefined) {
    setPlayheadFrame(Math.max(
      clip.start,
      Math.min(clip.start + clip.duration - 1, pointerFrame),
    ));
    setPreviewMode("timeline");
  } else if (clip.track === "text" || clip.track === "caption") {
    setPlayheadFrame(Math.max(clip.start, clip.start + clip.duration - 1));
    setPreviewMode("timeline");
  }
  // Preserve the existing contextual audio calculation.
};
```

- [ ] **Step 4: Pass the scroll-aware pointer frame from video clip presses**

```tsx
onPointerDown={(event) => {
  event.stopPropagation();
  const pointerFrame = getPointerTimelineFrame(event.clientX);
  selectTimelineClip(clip, pointerFrame);
  // Preserve existing drag dispatch.
}}
```

- [ ] **Step 5: Run the focused interaction test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Verify: `src/editorLogic.ts`
- Verify: `src/Composition.tsx`
- Verify: `tests/editorLogic.test.mts`
- Verify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: completed Tasks 1 and 2
- Produces: verified editor behavior with no TypeScript or regression failures

- [ ] **Step 1: Run the full relevant test suites**

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript checking**

```powershell
npx.cmd tsc --noEmit
```

Expected: exit code 0 with no errors.

- [ ] **Step 3: Check patch formatting**

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Verify the running app**

Open `http://127.0.0.1:5173/`, click different positions in main and overlay video clips, and confirm the red playhead lands exactly under the pointer while the summary updates in `HH:MM:SS / HH:MM:SS` format.
