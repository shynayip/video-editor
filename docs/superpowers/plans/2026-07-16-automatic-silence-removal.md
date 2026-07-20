# Automatic Silence Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local one-click action that removes pauses longer than 0.6 seconds from a selected video and its reciprocal audio, closes the resulting gaps, and supports atomic Undo/Redo.

**Architecture:** A focused server module runs FFmpeg `silencedetect` and returns normalized ranges relative to the selected source clip. A pure editor-logic function turns the complementary speech ranges into synchronized video/audio timeline segments and ripples later clips on that video layer. The Transcript panel calls the endpoint, rejects stale results, and commits the cleanup once through existing timeline history.

**Tech Stack:** React 19, TypeScript, Remotion, Express, FFmpeg via `ffmpeg-static`, Node test runner, ESLint.

## Global Constraints

- Detect silence locally; do not require or transmit an OpenAI API key.
- Remove pauses only when they are longer than 0.6 seconds.
- Preserve 0.15 seconds at both boundaries of each detected pause.
- Use a -40 dB FFmpeg silence threshold.
- Cut the selected video and only its reciprocal linked original audio.
- Do not cut or shift unrelated overlays, narration, music, text, stickers, captions, or other video layers.
- Remove stale generated transcript captions for the cleaned source clip.
- Commit the complete cleanup as one history operation; one Undo restores the exact prior timeline.
- Do not create history when no removable silence is found.

---

### Task 1: Local Silence Detection Module

**Files:**
- Create: `server/silenceDetection.mjs`
- Create: `tests/silenceDetection.test.mjs`

**Interfaces:**
- Produces: `parseSilenceRanges(stderr, {durationSeconds, minimumSilenceSeconds, speechPaddingSeconds}) -> Array<{startSeconds: number; endSeconds: number}>`
- Produces: `detectSilenceInMedia(options) -> Promise<Array<{startSeconds: number; endSeconds: number}>>`

- [ ] **Step 1: Write failing parser tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {parseSilenceRanges} from "../server/silenceDetection.mjs";

test("parses qualifying FFmpeg silence and preserves speech padding", () => {
  const ranges = parseSilenceRanges(`
    [silencedetect] silence_start: 1.2
    [silencedetect] silence_end: 2.4 | silence_duration: 1.2
  `, {
    durationSeconds: 5,
    minimumSilenceSeconds: 0.6,
    speechPaddingSeconds: 0.15,
  });
  assert.deepEqual(ranges, [{startSeconds: 1.35, endSeconds: 2.25}]);
});

test("drops short pauses and clamps terminal silence", () => {
  const ranges = parseSilenceRanges(`
    silence_start: 0.2
    silence_end: 0.6 | silence_duration: 0.4
    silence_start: 4
  `, {
    durationSeconds: 5,
    minimumSilenceSeconds: 0.6,
    speechPaddingSeconds: 0.15,
  });
  assert.deepEqual(ranges, [{startSeconds: 4.15, endSeconds: 5}]);
});
```

- [ ] **Step 2: Run the parser tests and verify RED**

Run: `node --test tests/silenceDetection.test.mjs`

Expected: FAIL because `server/silenceDetection.mjs` does not exist.

- [ ] **Step 3: Implement range parsing and normalization**

```js
const finite = (value) => Number.isFinite(value);

export const parseSilenceRanges = (stderr, {
  durationSeconds,
  minimumSilenceSeconds = 0.6,
  speechPaddingSeconds = 0.15,
}) => {
  const events = [...String(stderr).matchAll(/silence_(start|end):\s*([0-9.]+)/g)]
    .map((match) => ({kind: match[1], seconds: Number(match[2])}))
    .filter((event) => finite(event.seconds));
  const raw = [];
  let start = null;
  for (const event of events) {
    if (event.kind === "start") start = event.seconds;
    if (event.kind === "end" && start !== null) {
      raw.push({startSeconds: start, endSeconds: event.seconds});
      start = null;
    }
  }
  if (start !== null) raw.push({startSeconds: start, endSeconds: durationSeconds});
  return raw.flatMap((range) => {
    const startSeconds = Math.max(0, range.startSeconds);
    const endSeconds = Math.min(durationSeconds, range.endSeconds);
    if (endSeconds - startSeconds < minimumSilenceSeconds) return [];
    const paddedStart = startSeconds === 0 ? 0 : startSeconds + speechPaddingSeconds;
    const paddedEnd = endSeconds === durationSeconds ? durationSeconds : endSeconds - speechPaddingSeconds;
    return paddedEnd > paddedStart ? [{startSeconds: paddedStart, endSeconds: paddedEnd}] : [];
  });
};
```

- [ ] **Step 4: Add a failing FFmpeg invocation test**

```js
import {detectSilenceInMedia} from "../server/silenceDetection.mjs";

test("runs silencedetect only over the selected visible source range", async () => {
  const calls = [];
  const ranges = await detectSilenceInMedia({
    inputPath: "C:/temp/video.mp4",
    ffmpegPath: "ffmpeg",
    sourceStartSeconds: 2,
    durationSeconds: 8,
    execFileImpl: async (file, args) => {
      calls.push({file, args});
      const error = new Error("ffmpeg exits after analysis");
      error.stderr = "silence_start: 1\nsilence_end: 2 | silence_duration: 1";
      throw error;
    },
  });
  assert.deepEqual(calls[0].args, [
    "-hide_banner", "-ss", "2", "-t", "8", "-i", "C:/temp/video.mp4",
    "-vn", "-af", "silencedetect=noise=-40dB:d=0.6", "-f", "null", "-",
  ]);
  assert.deepEqual(ranges, [{startSeconds: 1.15, endSeconds: 1.85}]);
});
```

- [ ] **Step 5: Implement `detectSilenceInMedia` and verify GREEN**

Capture FFmpeg stderr whether the injected process resolves with `{stderr}` or rejects with an error carrying `stderr`. Re-throw only when stderr contains no `silence_` event and the process failed for a real media error.

Run: `node --test tests/silenceDetection.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the detection module**

```powershell
git add server/silenceDetection.mjs tests/silenceDetection.test.mjs
git commit -m "feat: detect removable silence locally"
```

---

### Task 2: Local Silence Detection API

**Files:**
- Modify: `server/transcriptionServer.mjs`
- Modify: `tests/transcriptionLogic.test.mjs`

**Interfaces:**
- Consumes: `detectSilenceInMedia({inputPath, ffmpegPath, sourceStartSeconds, durationSeconds, signal, execFileImpl})`
- Produces: `POST /api/detect-silence` returning `{ranges: Array<{startSeconds, endSeconds}>}`

- [ ] **Step 1: Write failing route tests**

Add tests beside the existing `/api/transcribe` tests:

```js
test("returns normalized local silence ranges", async () => {
  const app = createTranscriptionApp({
    detectSilenceInMediaImpl: async (options) => {
      assert.equal(options.sourceStartSeconds, 2);
      assert.equal(options.durationSeconds, 8);
      return [{startSeconds: 1.15, endSeconds: 1.85}];
    },
  });
  const response = await request(app)
    .post("/api/detect-silence")
    .set("Origin", "http://localhost:5173")
    .field("sourceStart", "2")
    .field("duration", "8")
    .attach("file", Buffer.from("media"), "clip.mp4");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {ranges: [{startSeconds: 1.15, endSeconds: 1.85}]});
});
```

Also assert `400 missing_file`, `400 invalid_trim_range`, abort behavior, and route-level temporary-directory cleanup.

- [ ] **Step 2: Run the route tests and verify RED**

Run: `node --test tests/transcriptionLogic.test.mjs`

Expected: FAIL with 404 for `/api/detect-silence` or an unknown dependency option.

- [ ] **Step 3: Add the route using the existing secure upload boundary**

Import `detectSilenceInMedia`, inject it as `detectSilenceInMediaImpl`, and add an upload route that reuses `validateLocalRequest`, `parseTrimRange`, upload limits, abort listeners, unique temporary directories, `toInputPath`, and cleanup helpers. Return structured errors with code `silence_detection_failed`.

```js
app.post("/api/detect-silence", upload.single("file"), async (req, res) => {
  // Validate file and trim range using the same contracts as /api/transcribe.
  // Persist the upload only inside a unique temporary directory.
  const ranges = await detectSilenceInMediaImpl({
    inputPath,
    ffmpegPath: ffmpegBinaryPath,
    sourceStartSeconds: trimRange.sourceStartSeconds,
    durationSeconds: trimRange.durationSeconds,
    signal: requestAbortController.signal,
    execFileImpl,
  });
  return res.json({ranges});
});
```

- [ ] **Step 4: Verify route tests and targeted lint**

Run: `node --test tests/transcriptionLogic.test.mjs`

Run: `npx.cmd eslint server/transcriptionServer.mjs server/silenceDetection.mjs tests/silenceDetection.test.mjs tests/transcriptionLogic.test.mjs`

Expected: PASS with no lint errors.

- [ ] **Step 5: Commit the API**

```powershell
git add server/transcriptionServer.mjs tests/transcriptionLogic.test.mjs
git commit -m "feat: expose local silence detection endpoint"
```

---

### Task 3: Atomic Synchronized Timeline Cleanup

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `removeSilenceFromLinkedVideo(clips, videoClipId, ranges, fps) -> TimelineClip[]`
- Range input is relative source seconds: `Array<{startSeconds: number; endSeconds: number}>`

- [ ] **Step 1: Write failing synchronized-cut tests**

```ts
test("removes silence from a video and reciprocal audio and closes the gap", () => {
  const clips: TimelineClip[] = [
    {id: "video", label: "Lesson", track: "main", start: 0, duration: 300, sourceStart: 30, src: "lesson.mp4", color: "#0891b2", linkedClipId: "audio"},
    {id: "audio", label: "Lesson audio", track: "audio", start: 0, duration: 300, sourceStart: 30, src: "lesson.mp4", color: "#2563eb", linkedClipId: "video"},
  ];
  const result = removeSilenceFromLinkedVideo(clips, "video", [
    {startSeconds: 2, endSeconds: 3},
    {startSeconds: 6, endSeconds: 7},
  ], 30);
  assert.deepEqual(result.filter((clip) => clip.track === "main").map(({start, duration, sourceStart}) => ({start, duration, sourceStart})), [
    {start: 0, duration: 60, sourceStart: 30},
    {start: 60, duration: 90, sourceStart: 120},
    {start: 150, duration: 90, sourceStart: 240},
  ]);
  assert.deepEqual(result.filter((clip) => clip.track === "audio").map(({start, duration, sourceStart}) => ({start, duration, sourceStart})), [
    {start: 0, duration: 60, sourceStart: 30},
    {start: 60, duration: 90, sourceStart: 120},
    {start: 150, duration: 90, sourceStart: 240},
  ]);
});
```

Add separate tests proving that later clips on the same signed video layer ripple by the removed frame count, unrelated tracks remain byte-for-byte equal, transcript captions generated for `video` are removed, invalid/no-op ranges return the original array, and each generated video segment links reciprocally to its matching audio segment.

- [ ] **Step 2: Run editor logic tests and verify RED**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because `removeSilenceFromLinkedVideo` is not exported.

- [ ] **Step 3: Implement normalized complementary speech segments**

Inside `removeSilenceFromLinkedVideo`:

1. Validate the selected clip is a source-backed `main` or `upper` video.
2. Normalize, clamp, sort, and merge silence ranges to `[0, clip.duration * speed / fps]`.
3. Build complementary speech ranges.
4. Convert source seconds to source frames and timeline frames using clip speed.
5. Create stable segment IDs `${originalId}-speech-${index}` and reciprocal audio IDs.
6. Preserve clip visual, adjustment, animation, volume, hidden state, signed `videoLayer`, and overlay lane.
7. Ripple only later clips with the same signed video layer and the matching linked-audio sequence.
8. Remove captions whose `caption.generationId` starts with `transcript-` and whose `caption.sourceClipId` matches the selected video.

Return the original `clips` reference when normalization produces no removable ranges.

- [ ] **Step 4: Run focused and complete editor tests**

Run: `node --test tests/editorLogic.test.mts`

Expected: PASS.

Run: `npx.cmd tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 5: Commit timeline cleanup**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: remove silence from linked timeline clips"
```

---

### Task 4: Transcript Panel Action And Undo Integration

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/caption-ui.test.mts`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `POST /api/detect-silence`
- Consumes: `removeSilenceFromLinkedVideo(clips, sourceClipId, ranges, fps)`
- Produces: Transcript-panel **Remove silence** action and status messages.

- [ ] **Step 1: Write failing source-level UI tests**

Add assertions that the Transcript panel contains a `Remove silence` button, submits `file`, `sourceStart`, and `duration` to `/api/detect-silence`, verifies the selected clip identity and timing before commit, calls `removeSilenceFromLinkedVideo` inside exactly one `commitClipChange`, disables both transcript operations during analysis, and reports both success and no-silence states.

```ts
assert.match(source, /onClick=\{removeSilenceAutomatically\}/);
assert.match(source, /fetch\("\/api\/detect-silence"/);
assert.match(source, /removeSilenceFromLinkedVideo\(/);
assert.match(source, /Removed \$\{[^}]+\} silent pause/);
assert.match(source, /No removable silence was found/);
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/caption-ui.test.mts tests/playhead-ui.test.mts`

Expected: FAIL because the action and button do not exist.

- [ ] **Step 3: Implement the asynchronous cleanup action**

Add `removeSilenceAutomatically` beside `generateTranscript`. It must:

1. Abort any previous caption/cleanup request.
2. Snapshot clip id, `src`, `sourceStart`, `duration`, speed, and selection version.
3. Fetch the media, construct `FormData`, and POST to `/api/detect-silence`.
4. Parse `{ranges}` and surface structured server errors.
5. Reject stale results when selection or source timing changed.
6. If ranges are empty, show `No removable silence was found.` without calling `commitClipChange`.
7. Otherwise call `commitClipChange` once with `removeSilenceFromLinkedVideo`.
8. Keep the first resulting video segment selected, set timeline preview mode, and report the number of removed pauses.

Use the existing request token, abort controller, loading state, and `captionStatus` conventions so switching clips safely cancels cleanup.

- [ ] **Step 4: Add the Transcript panel control**

```tsx
<div className="transcript-actions">
  <button className="import-button" type="button" disabled={isAutoCaptionLoading || !selectedCaptionSourceClip} onClick={generateTranscript}>
    {isAutoCaptionLoading ? "Working..." : "Generate transcript"}
  </button>
  <button className="secondary-action-button" type="button" disabled={isAutoCaptionLoading || !selectedCaptionSourceClip} onClick={removeSilenceAutomatically}>
    Remove silence
  </button>
</div>
```

Style `.transcript-actions` as a compact two-column command row that wraps on narrow widths and does not enlarge the preview workspace.

- [ ] **Step 5: Verify UI tests, TypeScript, and lint**

Run: `node --test tests/caption-ui.test.mts tests/playhead-ui.test.mts`

Run: `npx.cmd eslint src/Composition.tsx src/editorLogic.ts src/index.css tests/caption-ui.test.mts tests/playhead-ui.test.mts`

Run: `npx.cmd tsc --noEmit`

Expected: all commands pass. If ESLint does not accept CSS input in the existing configuration, rerun the same command without `src/index.css` and validate CSS through the build.

- [ ] **Step 6: Commit the interface**

```powershell
git add src/Composition.tsx src/index.css tests/caption-ui.test.mts tests/playhead-ui.test.mts
git commit -m "feat: add automatic silence removal action"
```

---

### Task 5: End-To-End Verification

**Files:**
- Verify only; modify production files only if a failing check exposes a requirement gap.

**Interfaces:**
- Verifies the complete `/api/detect-silence` to timeline-history workflow.

- [ ] **Step 1: Run every automated test**

```powershell
$tests = Get-ChildItem -Path tests -File | Where-Object { $_.Name -match '\.test\.(mjs|mts|js|ts)$' } | Select-Object -ExpandProperty FullName
node --test $tests
```

Expected: all tests pass.

- [ ] **Step 2: Run static and production checks**

Run: `npx.cmd tsc --noEmit`

Run: `npm.cmd run build`

Expected: TypeScript exits 0 and Remotion writes the bundle to `build`.

- [ ] **Step 3: Start the full local stack**

Run: `npm.cmd run web`

Expected: Vite serves `http://localhost:5173/` and the local API listens on `127.0.0.1:5174`.

- [ ] **Step 4: Verify the user workflow in the browser**

1. Select `initialClips` on the main track.
2. Open Transcript and press **Remove silence**.
3. Confirm the main video and its linked audio shorten by the same number of frames.
4. Play across every cut and confirm audio remains synchronized.
5. Confirm unrelated overlay/narration clips retain their timing.
6. Press Undo once and confirm the exact original video/audio pair and duration return.
7. Press Redo once and confirm the silence cleanup returns.

- [ ] **Step 5: Final commit if verification required corrections**

```powershell
git add server/silenceDetection.mjs server/transcriptionServer.mjs src/editorLogic.ts src/Composition.tsx src/index.css tests/silenceDetection.test.mjs tests/transcriptionLogic.test.mjs tests/editorLogic.test.mts tests/caption-ui.test.mts tests/playhead-ui.test.mts
git commit -m "fix: verify automatic silence removal workflow"
```
