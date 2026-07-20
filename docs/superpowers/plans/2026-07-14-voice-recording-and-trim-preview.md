# Voice Recording and Trim-Aware Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timeline trimming and scrubbing control preview playback correctly, and let users record microphone narration directly onto the audio track at the red playhead.

**Architecture:** Keep pure timeline transformations in `src/editorLogic.ts`, browser microphone lifecycle in a focused `src/voiceRecorder.ts`, and UI/media synchronization in `src/Composition.tsx`. The playhead becomes the source of truth for timeline preview; clips carry a source offset so left trims and splits preserve the correct point in the original media.

**Tech Stack:** React 19, TypeScript 5.9, browser `MediaRecorder`/`getUserMedia`, Remotion 4, Node test runner.

## Global Constraints

- The red playhead controls timeline preview and may be moved by clicking or dragging the timeline.
- A cropped section must not remain visible outside its timeline clip.
- A finished microphone recording begins at the current red playhead.
- Main video and its linked original audio receive matching trim, split, and delete changes.
- Recorded narration remains independent from main-video trimming.
- Existing overlay, split, trim, delete, undo, speed, and volume behavior must remain functional.
- Local recording object URLs last for the current browser session only.

---

### Task 1: Source-Aware Timeline Trimming and Splitting

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TimelineClip.sourceStart?: number`
- Produces: `trimClipById(clips, clipId, edge, frameDelta, minimumDuration): TimelineClip[]`
- Updates: `splitClipOnTrackAtFrame()` so the second segment advances `sourceStart`

- [ ] **Step 1: Write failing tests for left trim and split source offsets**

```ts
test("left trim advances the source offset", () => {
  const result = trimClipById([clip], clip.id, "left", 30, 15);
  assert.equal(result[0].start, 30);
  assert.equal(result[0].duration, 90);
  assert.equal(result[0].sourceStart, 30);
});

test("split advances the second clip source offset", () => {
  const result = splitClipOnTrackAtFrame([clip], "main", 45);
  assert.equal(result[1].sourceStart, 45);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because `trimClipById` and `sourceStart` behavior do not exist.

- [ ] **Step 3: Implement the pure timeline changes**

```ts
export type TimelineClip = {
  // existing fields
  sourceStart?: number;
};

export const trimClipById = (
  clips: TimelineClip[],
  clipId: string,
  edge: "left" | "right",
  frameDelta: number,
  minimumDuration = 15,
): TimelineClip[] => clips.map((clip) => {
  if (clip.id !== clipId) return clip;
  if (edge === "left") {
    const appliedDelta = Math.max(-clip.start, Math.min(frameDelta, clip.duration - minimumDuration));
    return {
      ...clip,
      start: clip.start + appliedDelta,
      duration: clip.duration - appliedDelta,
      sourceStart: Math.max(0, (clip.sourceStart ?? 0) + appliedDelta),
    };
  }
  return {...clip, duration: Math.max(minimumDuration, clip.duration + frameDelta)};
});
```

Update the second result from `splitClipOnTrackAtFrame()` with:

```ts
sourceStart: (clip.sourceStart ?? 0) + firstDuration,
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: all editor-logic tests PASS.

- [ ] **Step 5: Commit the task**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "fix: preserve source timing when trimming clips"
```

### Task 2: User-Controlled Playhead and Preview Synchronization

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TimelineClip.sourceStart`
- Produces: `getClipSourceTime(clip, playheadFrame, fps): number`
- UI behavior: pointer down/move on the timeline changes `playheadFrame`

- [ ] **Step 1: Write a failing source-time test**

```ts
test("calculates source time from playhead and trim offset", () => {
  assert.equal(getClipSourceTime({...clip, start: 30, sourceStart: 45}, 60, 30), 2.5);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because `getClipSourceTime` is not exported.

- [ ] **Step 3: Implement source-time calculation**

```ts
export const getClipSourceTime = (
  clip: TimelineClip,
  playheadFrame: number,
  fps: number,
) => ((clip.sourceStart ?? 0) + playheadFrame - clip.start) / fps;
```

- [ ] **Step 4: Connect timeline pointer input to the red playhead**

Add a timeline container ref and pointer handler that converts pointer X into frames, clamps to `0..mainTrackDuration`, pauses playback while scrubbing, sets timeline-preview mode, and calls `setPlayheadFrame(frame)`. Attach pointer move until pointer up so the line can be dragged.

- [ ] **Step 5: Make preview follow the playhead**

Replace paused Media-library fallback during timeline editing with `activeTimelineClip`. Whenever `playheadFrame`, clip identity, or `sourceStart` changes, seek the native video using:

```ts
video.currentTime = Math.max(0, getClipSourceTime(activeTimelineClip, playheadFrame, fps));
```

When no main clip is active at the playhead, render the black empty preview state. Starting Play must seek first and then call `video.play()`.

- [ ] **Step 6: Add scrub cursor and playhead hit area styling**

```css
.timeline-panel { position: relative; cursor: pointer; }
.timeline-playhead { pointer-events: none; z-index: 20; }
.timeline-scrub-area { position: absolute; inset: 0; }
```

- [ ] **Step 7: Run logic tests and lint**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Run: `& "C:\Program Files\nodejs\npm.cmd" run lint`

Expected: tests PASS and lint exits 0.

- [ ] **Step 8: Commit the task**

```powershell
git add src/Composition.tsx src/editorLogic.ts src/index.css tests/editorLogic.test.mts
git commit -m "fix: synchronize preview with draggable playhead"
```

### Task 3: Linked Main Video and Audio Editing

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TimelineClip.linkedClipId?: string`
- Produces: linked trim, split, and delete transformations that preserve matching timeline boundaries

- [ ] **Step 1: Write failing tests showing linked audio follows main-video trim, split, and delete**
- [ ] **Step 2: Run tests and verify they fail because linked edits are not implemented**
- [ ] **Step 3: Add link metadata and apply the same boundary transformation to the linked audio clip**
- [ ] **Step 4: Keep narration clips unlinked so they remain unchanged**
- [ ] **Step 5: Run tests and lint, expecting all checks to pass**

### Task 4: Microphone Narration Recording

**Files:**
- Create: `src/voiceRecorder.ts`
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `createRecordedAudioClip(options): TimelineClip | null`
- Produces: `BrowserVoiceRecorder` with `start(): Promise<void>`, `stop(): Promise<RecordedVoice>`, and `dispose(): void`
- `RecordedVoice`: `{blob: Blob; durationSeconds: number; mimeType: string}`

- [ ] **Step 1: Write failing tests for recorded audio clip creation**

```ts
test("adds recorded narration at the red playhead", () => {
  const clip = createRecordedAudioClip({
    id: "voice-1", label: "Voice recording", src: "blob:voice",
    start: 90, durationSeconds: 2.4, fps: 30,
  });
  assert.equal(clip?.track, "audio");
  assert.equal(clip?.start, 90);
  assert.equal(clip?.duration, 72);
});

test("rejects an empty recording", () => {
  assert.equal(createRecordedAudioClip({
    id: "voice-1", label: "Voice recording", src: "blob:voice",
    start: 0, durationSeconds: 0, fps: 30,
  }), null);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because `createRecordedAudioClip` does not exist.

- [ ] **Step 3: Implement recorded clip conversion**

```ts
export const createRecordedAudioClip = (options: RecordedAudioOptions): TimelineClip | null => {
  const duration = Math.round(options.durationSeconds * options.fps);
  if (duration < 1) return null;
  return {
    id: options.id,
    label: options.label,
    track: "audio",
    start: options.start,
    duration,
    color: "#2563eb",
    src: options.src,
    volume: 1,
  };
};
```

- [ ] **Step 4: Implement the browser recorder wrapper**

Use `navigator.mediaDevices.getUserMedia({audio: true})`, collect non-empty `dataavailable` chunks, measure elapsed time with `performance.now()`, build a Blob using the recorder MIME type, and stop every stream track in both `stop()` and `dispose()`.

- [ ] **Step 5: Connect Record and Stop to the editor**

Add `isRecording` and `recordingError` state. Start creates the recorder; Stop creates an object URL and timeline clip at the current `playheadFrame`, inserts it with `commitClipChange`, selects it, and sets `selectedTrack` to `audio`. Change the button label and accessible name between Record and Stop.

- [ ] **Step 6: Render active audio timeline sources**

For each non-hidden audio clip active at `playheadFrame`, render a native audio element keyed by clip ID, seek it using `getClipSourceTime`, apply clip volume, and play/pause it with `isPreviewPlaying`. Do not use the placeholder `Main audio` clip when it has no `src`.

- [ ] **Step 7: Add recording state and error styling**

```css
.record-button.is-recording { background: #dc2626; color: #fff; }
.recording-error { color: #fca5a5; font-size: 12px; }
```

- [ ] **Step 8: Run full verification**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Run: `& "C:\Program Files\nodejs\npm.cmd" run lint`

Expected: all tests PASS and lint exits 0.

- [ ] **Step 9: Verify the browser workflow**

Open `http://localhost:5173`, grant microphone permission, drag the red line, record two seconds, stop, confirm the new blue audio clip starts at the line, play from before the clip, and confirm narration begins only when the line reaches it.

- [ ] **Step 10: Commit the task**

```powershell
git add src/voiceRecorder.ts src/editorLogic.ts src/Composition.tsx src/index.css tests/editorLogic.test.mts
git commit -m "feat: record narration onto the audio timeline"
```
