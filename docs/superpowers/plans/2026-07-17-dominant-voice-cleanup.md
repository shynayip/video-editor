# Dominant-Voice Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace volume-only silence removal with a local action that identifies the longest-speaking voice and ripple-removes every selected-main-clip section where that voice is absent.

**Architecture:** A focused server service extracts the selected source range to 16 kHz mono WAV, uses existing non-silence detection to create candidate speech windows, computes local WavLM speaker embeddings, clusters matching voices, and returns padded ranges for the dominant speaker. Pure editor logic converts those retained source-time ranges into synchronized main-video and reciprocal-audio segments; the React action applies one guarded history update while leaving every unrelated track unchanged.

**Tech Stack:** React 19, TypeScript, Remotion, Express, FFmpeg/FFprobe, `@huggingface/transformers`, `Xenova/wavlm-base-plus-sv`, Node test runner, ESLint.

## Global Constraints

- Run speaker analysis locally; do not require a cloud API or Hugging Face token.
- Treat the speaker with the greatest total accepted speech duration as the dominant voice.
- Keep 0.15 seconds of padding around dominant-speaker ranges.
- Merge dominant ranges separated by gaps of 0.3 seconds or less.
- Ignore candidate speech windows shorter than 0.6 seconds.
- Require at least 1.2 seconds of accepted dominant speech and a dominant-duration ratio of at least 0.45.
- Cut only the selected main video clip and its reciprocal linked original audio.
- Do not cut or shift overlays, captions, text, stickers, cutouts, background music, narration, unrelated audio, or other video layers.
- Commit the cleanup as one history operation; one Undo restores the exact previous timeline.
- Apply no edit when speech is absent, speaker identity is ambiguous, the request is stale, or processing fails.

---

### Task 1: Dominant Speaker Analysis Service

**Files:**
- Create: `server/dominantVoiceDetection.mjs`
- Create: `tests/dominantVoiceDetection.test.mjs`

**Interfaces:**
- Consumes: `detectSilenceInMedia({inputPath, ffmpegPath, sourceStartSeconds, durationSeconds, signal})`
- Produces: `cosineSimilarity(left, right) -> number`
- Produces: `clusterSpeakerWindows(windows, {similarityThreshold}) -> Array<{centroid, windows, durationSeconds}>`
- Produces: `normalizeDominantVoiceRanges(ranges, options) -> Array<{startSeconds, endSeconds}>`
- Produces: `createDominantVoiceDetector(dependencies).detect(options) -> Promise<{ranges, dominantSpeechSeconds, analyzedSpeechSeconds}>`

- [ ] **Step 1: Write failing clustering and normalization tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterSpeakerWindows,
  normalizeDominantVoiceRanges,
} from "../server/dominantVoiceDetection.mjs";

test("clusters matching speaker embeddings and selects duration independently", () => {
  const clusters = clusterSpeakerWindows([
    {startSeconds: 0, endSeconds: 2, embedding: [1, 0]},
    {startSeconds: 2.5, endSeconds: 4.5, embedding: [0.98, 0.02]},
    {startSeconds: 5, endSeconds: 6, embedding: [0, 1]},
  ], {similarityThreshold: 0.82});
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].durationSeconds, 4);
  assert.equal(clusters[1].durationSeconds, 1);
});

test("pads, clamps, and merges nearby dominant ranges", () => {
  assert.deepEqual(normalizeDominantVoiceRanges([
    {startSeconds: 1, endSeconds: 2},
    {startSeconds: 2.2, endSeconds: 3},
  ], {durationSeconds: 4, paddingSeconds: 0.15, mergeGapSeconds: 0.3}), [
    {startSeconds: 0.85, endSeconds: 3.15},
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/dominantVoiceDetection.test.mjs`

Expected: FAIL because `server/dominantVoiceDetection.mjs` does not exist.

- [ ] **Step 3: Implement vector math and deterministic clustering**

```js
export const cosineSimilarity = (left, right) => {
  if (!left?.length || left.length !== right?.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? dot / denominator : -1;
};

export const clusterSpeakerWindows = (windows, {similarityThreshold = 0.82} = {}) => {
  const clusters = [];
  for (const window of windows) {
    let best = null;
    let bestSimilarity = -1;
    for (const cluster of clusters) {
      const similarity = cosineSimilarity(window.embedding, cluster.centroid);
      if (similarity > bestSimilarity) {
        best = cluster;
        bestSimilarity = similarity;
      }
    }
    if (!best || bestSimilarity < similarityThreshold) {
      clusters.push({
        centroid: [...window.embedding],
        windows: [window],
        durationSeconds: window.endSeconds - window.startSeconds,
      });
      continue;
    }
    best.windows.push(window);
    best.durationSeconds += window.endSeconds - window.startSeconds;
    best.centroid = best.centroid.map((value, index) =>
      (value * (best.windows.length - 1) + window.embedding[index]) / best.windows.length
    );
  }
  return clusters.sort((left, right) => right.durationSeconds - left.durationSeconds);
};
```

Implement `normalizeDominantVoiceRanges` by sorting, adding 0.15-second padding, clamping to the selected duration, and merging overlaps or gaps no larger than 0.3 seconds.

- [ ] **Step 4: Add failing orchestration tests with injected models and FFmpeg**

```js
test("returns only the longest-speaking cluster", async () => {
  const detector = createDominantVoiceDetector({
    extractAudioImpl: async () => "C:/temp/selected.wav",
    findCandidateSpeechImpl: async () => [
      {startSeconds: 0, endSeconds: 2},
      {startSeconds: 3, endSeconds: 5},
      {startSeconds: 6, endSeconds: 7},
    ],
    loadAudioImpl: async () => new Float32Array(16000),
    createEmbeddingImpl: async (_audio, range) =>
      range.startSeconds < 5 ? [1, 0] : [0, 1],
    makeTempDirectoryImpl: async () => "C:/temp/dominant-job",
    removeDirectoryImpl: async () => undefined,
  });
  const result = await detector.detect({
    inputPath: "C:/media/clip.mp4",
    sourceStartSeconds: 2,
    durationSeconds: 8,
  });
  assert.deepEqual(result.ranges, [
    {startSeconds: 0, endSeconds: 2.15},
    {startSeconds: 2.85, endSeconds: 5.15},
  ]);
});
```

Add cases for no candidate speech, dominant speech below 1.2 seconds, dominant ratio below 0.45, model failure, abort, and temporary-directory cleanup.

- [ ] **Step 5: Implement local audio extraction and WavLM embeddings**

Use FFmpeg to extract only the selected visible source range:

```js
await execFileImpl(ffmpegPath, [
  "-y", "-ss", String(sourceStartSeconds), "-t", String(durationSeconds),
  "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", outputWavPath,
], {signal});
```

Cache one model/processor promise and use the Transformers.js speaker-verification model:

```js
const loadEmbeddingRuntime = async () => {
  const {AutoModel, AutoProcessor, read_audio} = await import("@huggingface/transformers");
  const modelId = "Xenova/wavlm-base-plus-sv";
  const [processor, model] = await Promise.all([
    AutoProcessor.from_pretrained(modelId),
    AutoModel.from_pretrained(modelId, {dtype: "q8"}),
  ]);
  return {processor, model, readAudio: read_audio};
};

const createEmbedding = async (audio, runtime) => {
  const inputs = await runtime.processor(audio);
  const output = await runtime.model(inputs);
  return Array.from(output.embeddings.data);
};
```

Use the complement of `detectSilenceInMedia` ranges as candidate windows, discard windows shorter than 0.6 seconds, slice the decoded 16 kHz waveform for each window, compute embeddings sequentially, cluster at cosine similarity 0.82, enforce the 1.2-second and 0.45 ratio safeguards, then normalize the dominant cluster's ranges.

- [ ] **Step 6: Verify the service tests and commit**

Run: `node --test tests/dominantVoiceDetection.test.mjs tests/silenceDetection.test.mjs`

Expected: PASS.

```powershell
git add server/dominantVoiceDetection.mjs tests/dominantVoiceDetection.test.mjs
git commit -m "feat: detect dominant voice locally"
```

---

### Task 2: Dominant Voice API Route

**Files:**
- Modify: `server/transcriptionServer.mjs`
- Modify: `tests/transcriptionLogic.test.mjs`

**Interfaces:**
- Consumes: `dominantVoiceDetector.detect({inputPath, sourceStartSeconds, durationSeconds, signal})`
- Produces: `POST /api/detect-dominant-voice` returning `{ranges, dominantSpeechSeconds, analyzedSpeechSeconds}`

- [ ] **Step 1: Write failing route tests**

Add route tests that inject `detectDominantVoiceImpl` and assert the selected trim range:

```js
test("returns dominant voice ranges for the selected source range", async (t) => {
  const calls = [];
  const app = createTranscriptionApp({
    detectDominantVoiceImpl: async (options) => {
      calls.push(options);
      return {
        ranges: [{startSeconds: 0.5, endSeconds: 3}],
        dominantSpeechSeconds: 2.5,
        analyzedSpeechSeconds: 4,
      };
    },
  });
  const server = await listenForTest(t, app);
  const response = await postMultipart(server, "/api/detect-dominant-voice", {
    fields: {sourceStart: "2", duration: "8"},
    file: {field: "file", name: "clip.mp4", type: "video/mp4", body: "media"},
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json.ranges, [{startSeconds: 0.5, endSeconds: 3}]);
  assert.equal(calls[0].sourceStartSeconds, 2);
  assert.equal(calls[0].durationSeconds, 8);
});
```

Add tests for missing file, non-video upload, invalid ranges, foreign origins, processing failure, request abort, upload limit, and cleanup.

- [ ] **Step 2: Run route tests and verify RED**

Run: `node --test tests/transcriptionLogic.test.mjs --test-name-pattern="dominant voice"`

Expected: FAIL because the route is missing.

- [ ] **Step 3: Add the detector dependency and secure route**

Extend `createTranscriptionApp` with an injected `detectDominantVoiceImpl`, defaulting to the cached detector from Task 1. Implement the route using the existing local-origin/host middleware, upload limits, range parser, per-request temporary directory, and abort handling used by `/api/detect-silence`.

Return these structured failures:

```js
sendError(res, 400, "invalid_dominant_voice_request", "Select a valid video range.");
sendError(res, 422, "dominant_voice_not_found", "A reliable main voice could not be identified.");
sendError(res, 500, "dominant_voice_detection_failed", safeMessage);
```

- [ ] **Step 4: Verify the complete API suite and commit**

Run: `node --test tests/transcriptionLogic.test.mjs tests/dominantVoiceDetection.test.mjs`

Expected: PASS.

```powershell
git add server/transcriptionServer.mjs tests/transcriptionLogic.test.mjs
git commit -m "feat: expose dominant voice detection API"
```

---

### Task 3: Keep-Range Timeline Editing

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `keepDominantVoiceInLinkedVideo(clips, videoClipId, ranges, fps) -> TimelineClip[]`
- Ranges are relative to the selected clip's visible source start and expressed in source seconds.

- [ ] **Step 1: Write failing synchronized-cut tests**

```ts
test("keeps dominant ranges in main video and reciprocal audio only", () => {
  const result = keepDominantVoiceInLinkedVideo([
    mainVideo({id: "video", linkedClipId: "audio", duration: 300}),
    linkedAudio({id: "audio", linkedClipId: "video", duration: 300}),
    overlayVideo({id: "overlay", start: 0, duration: 300}),
    captionClip({id: "caption", start: 0, duration: 300}),
  ], "video", [
    {startSeconds: 1, endSeconds: 3},
    {startSeconds: 5, endSeconds: 6},
  ], 30);
  assert.deepEqual(result.filter((clip) => clip.track === "main").map(pickTiming), [
    {start: 0, duration: 60, sourceStart: 30},
    {start: 60, duration: 30, sourceStart: 150},
  ]);
  assert.equal(result.find((clip) => clip.id === "overlay")?.start, 0);
  assert.equal(result.find((clip) => clip.id === "caption")?.duration, 300);
});
```

Add cases for 2x and 0.5x clips, nonzero source starts, reciprocal-link validation, empty ranges, invalid ranges, stale generated captions for the source clip, later clips on the same main layer, and preservation of every unrelated track.

- [ ] **Step 2: Run focused editor tests and verify RED**

Run: `node --test tests/editorLogic.test.mts --test-name-pattern="dominant voice"`

Expected: FAIL because `keepDominantVoiceInLinkedVideo` is missing.

- [ ] **Step 3: Implement keep-range segmentation**

Refactor the range normalization and synchronized video/audio segmentation currently embedded in `removeSilenceFromLinkedVideo` into private helpers. Implement `keepDominantVoiceInLinkedVideo` directly from normalized retained ranges:

```ts
const timelineStart = Math.round((range.startSeconds * fps) / speed);
const timelineEnd = Math.round((range.endSeconds * fps) / speed);
const sourceOffset = Math.round(range.startSeconds * fps);
```

Create contiguous output segments beginning at the selected clip's original timeline start, preserve reciprocal links, remove stale generated captions tied to that source clip, and shift only later clips belonging to the same main video layer by the removed frame count. Return the original array reference when no valid change is possible.

- [ ] **Step 4: Verify editor logic and commit**

Run: `node --test tests/editorLogic.test.mts`

Expected: PASS.

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: keep dominant voice timeline ranges"
```

---

### Task 4: Keep Main Voice Editor Action

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `tests/playhead-ui.test.mts`
- Create: `src/dominantVoiceRequest.ts`
- Create: `tests/dominantVoiceRequest.test.mts`

**Interfaces:**
- Produces: `createDominantVoiceRequestSnapshot(clip) -> immutable snapshot | null`
- Produces: `isDominantVoiceRequestCurrent(snapshot, selectedClipId, clips) -> boolean`
- Consumes: `POST /api/detect-dominant-voice`
- Consumes: `keepDominantVoiceInLinkedVideo(...)`

- [ ] **Step 1: Write failing request-guard tests**

```ts
test("accepts only an unchanged selected main clip", () => {
  const clip = mainVideo({id: "main", src: "/uploads/main.mp4", duration: 300});
  const snapshot = createDominantVoiceRequestSnapshot(clip)!;
  assert.equal(isDominantVoiceRequestCurrent(snapshot, "main", [clip]), true);
  assert.equal(isDominantVoiceRequestCurrent(snapshot, "other", [clip]), false);
  assert.equal(isDominantVoiceRequestCurrent(snapshot, "main", [
    {...clip, speed: 2},
  ]), false);
});
```

Cover source, sourceStart, duration, speed, linked-audio identity, deletion, and track changes.

- [ ] **Step 2: Run request tests and verify RED**

Run: `node --test tests/dominantVoiceRequest.test.mts`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement immutable request snapshots**

Serialize only the fields that affect server analysis or timeline application:

```ts
export type DominantVoiceRequestSnapshot = {
  clipId: string;
  fingerprint: string;
};

const fingerprintClip = (clip: TimelineClip) => JSON.stringify({
  id: clip.id,
  track: clip.track,
  src: clip.src,
  sourceStart: clip.sourceStart ?? 0,
  duration: clip.duration,
  speed: clip.speed ?? 1,
  linkedClipId: clip.linkedClipId ?? null,
});
```

- [ ] **Step 4: Write failing UI source tests**

Assert that the Transcript panel contains `Keep main voice`, no longer displays `Remove silence`, posts to `/api/detect-dominant-voice`, reports the four progress stages, and applies `keepDominantVoiceInLinkedVideo` through one `commitClipChange` call.

Run: `node --test tests/playhead-ui.test.mts --test-name-pattern="main voice"`

Expected: FAIL before the component is updated.

- [ ] **Step 5: Implement the guarded React workflow**

Rename the action to `keepMainVoiceAutomatically`. Reuse the current silence-request abort controller pattern, but use an independent request token and snapshot. Upload the original selected clip with its effective `sourceStart / fps` and `(duration * speed) / fps`. Show these sequential statuses:

```ts
"Extracting audio..."
"Detecting speakers..."
"Finding the main voice..."
"Removing other sections..."
```

Before parsing and before committing, require `isDominantVoiceRequestCurrent(...)`. Apply the returned ranges with one history commit:

```ts
commitClipChange((currentClips) =>
  keepDominantVoiceInLinkedVideo(currentClips, sourceClipId, ranges, fps)
);
```

Disable the button while processing and unless the selected source is a main-track video with reciprocal linked audio. Treat aborts silently and display server validation messages without changing the timeline.

- [ ] **Step 6: Verify UI, request, and editor tests and commit**

Run:

```powershell
node --test tests/dominantVoiceRequest.test.mts tests/playhead-ui.test.mts tests/editorLogic.test.mts
npx.cmd tsc --noEmit
npx.cmd eslint src/Composition.tsx src/dominantVoiceRequest.ts src/editorLogic.ts tests/dominantVoiceRequest.test.mts
```

Expected: all commands exit 0.

```powershell
git add src/Composition.tsx src/dominantVoiceRequest.ts src/editorLogic.ts tests/playhead-ui.test.mts tests/dominantVoiceRequest.test.mts
git commit -m "feat: add keep main voice action"
```

---

### Task 5: Integrated Verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-4.

**Interfaces:**
- Verifies all interfaces from Tasks 1-4 without adding new product behavior.

- [ ] **Step 1: Run all focused dominant-voice tests**

```powershell
node --test tests/dominantVoiceDetection.test.mjs tests/dominantVoiceRequest.test.mts tests/silenceDetection.test.mjs tests/transcriptionLogic.test.mjs tests/editorLogic.test.mts tests/playhead-ui.test.mts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run compiler, lint, and whitespace checks**

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint server/dominantVoiceDetection.mjs server/transcriptionServer.mjs src/dominantVoiceRequest.ts src/editorLogic.ts src/Composition.tsx tests/dominantVoiceDetection.test.mjs tests/dominantVoiceRequest.test.mts
git diff --check
```

Expected: all commands exit 0; CRLF conversion warnings are acceptable.

- [ ] **Step 3: Perform a live local smoke test**

Start `npm.cmd run web`, select a main clip containing at least two voices or background-only regions, press **Keep main voice**, and verify:

- the dominant speaker remains audible and visible;
- other-speaker/noise-only sections are removed from the selected main video and linked audio;
- the red playhead and resulting video/audio segments remain synchronized;
- overlays, captions, text, stickers, music, and unrelated tracks are unchanged;
- one Undo restores the original selected video and linked audio.

- [ ] **Step 4: Commit verification-only fixes if needed**

If no fixes were required, do not create an empty commit. If a directly related correction was required:

```powershell
git add <only-files-changed-for-the-correction>
git commit -m "fix: verify dominant voice cleanup"
```
