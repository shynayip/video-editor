# Local Audio Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a no-cost local workflow that analyzes a selected video for silence, filler words, repeated speech, and weak vocabulary, then applies only user-approved cleanup while keeping linked video and audio synchronized.

**Architecture:** A loopback-only Node endpoint extracts 16 kHz mono WAV audio with the existing FFmpeg dependency, runs a cached Transformers.js Whisper pipeline, and combines word timestamps with FFmpeg silence ranges. Pure analysis and timeline functions produce reviewable suggestions and one atomic undoable edit; the React Transcript panel owns selection, progress, approval, and vocabulary replacement UI.

**Tech Stack:** React 19, TypeScript, Node.js ES modules, Express, FFmpeg, `@huggingface/transformers`, `wavefile`, Remotion, Node test runner.

## Global Constraints

- No OpenAI API key or paid API request is required for local cleanup.
- Analysis runs only on `127.0.0.1`; media never leaves the computer.
- The first analysis downloads the quantized multilingual Whisper Tiny runtime (approximately 150-250 MB depending on the resolved model files); later analyses reuse the cached model.
- Every removal is presented as a suggestion and requires user approval.
- Vocabulary replacements change transcript/caption text only and never remove media.
- Silence, filler, and repetition removals affect only the selected video and its reciprocal linked audio.
- One Apply action creates one timeline-history entry and supports Undo/Redo.
- Unrelated clips and tracks remain unchanged.

---

## File Structure

- Create `server/localWhisper.mjs`: model loading, cache configuration, WAV decoding, and local transcription.
- Create `server/localWhisper.test.mjs`: injected-pipeline tests without downloading a model.
- Create `server/audioCleanupLogic.mjs`: pure suggestion normalization and detection.
- Create `server/audioCleanupLogic.test.mjs`: silence, filler, repetition, vocabulary, and overlap tests.
- Modify `server/transcriptionServer.mjs`: add the loopback local-analysis endpoint and cancellation.
- Modify `server/transcriptionServer.test.mjs`: route, validation, local-only, and failure tests.
- Modify `src/editorLogic.ts`: apply approved cleanup ranges to selected linked media.
- Modify `tests/editorLogic.test.mts`: speed, trim, pairing, atomic history, and preservation tests.
- Modify `src/Composition.tsx`: Transcript analysis state, review controls, preview seeking, apply, and undo.
- Modify `src/index.css`: compact Transcript suggestion list and responsive states.
- Modify `tests/caption-ui.test.mts`: Transcript wiring and stale-analysis protection tests.
- Modify `package.json` and `package-lock.json`: local inference dependencies and test scripts.
- Modify `.gitignore`: ignore the project-local model cache and temporary partial downloads.

---

### Task 1: Local Whisper Adapter

**Files:**
- Create: `server/localWhisper.mjs`
- Create: `server/localWhisper.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `createLocalWhisper({pipelineFactory, WaveFileCtor, modelId, cacheDir})`
- Produces: `transcribeWav({wavBuffer, onProgress, signal}) -> Promise<{text, words}>`
- `words` is `Array<{startSeconds: number; endSeconds: number; text: string}>`.

- [ ] **Step 1: Install the local inference dependencies**

Run:

```powershell
npm.cmd install @huggingface/transformers wavefile
```

Expected: `package.json` and `package-lock.json` include both dependencies.

- [ ] **Step 2: Write failing adapter tests**

Create tests that inject a fake pipeline and WAV decoder:

```js
test("caches one local Whisper pipeline and normalizes word timestamps", async () => {
  let loads = 0;
  const whisper = createLocalWhisper({
    pipelineFactory: async () => {
      loads += 1;
      return async () => ({
        text: " um hello",
        chunks: [
          {text: " um", timestamp: [0, 0.3]},
          {text: " hello", timestamp: [0.3, 0.8]},
        ],
      });
    },
    WaveFileCtor: FakeWaveFile,
    modelId: "onnx-community/whisper-tiny",
    cacheDir: "C:/models",
  });

  const first = await whisper.transcribeWav({wavBuffer: Buffer.from("wav")});
  await whisper.transcribeWav({wavBuffer: Buffer.from("wav")});

  assert.equal(loads, 1);
  assert.deepEqual(first.words, [
    {startSeconds: 0, endSeconds: 0.3, text: "um"},
    {startSeconds: 0.3, endSeconds: 0.8, text: "hello"},
  ]);
});
```

Also test malformed chunks, progress forwarding, and an already-aborted signal.

- [ ] **Step 3: Run the tests and confirm the intended failure**

Run:

```powershell
node --test server/localWhisper.test.mjs
```

Expected: FAIL because `server/localWhisper.mjs` does not exist.

- [ ] **Step 4: Implement the adapter**

Implement a lazily cached pipeline using:

```js
const transcriber = await pipelineFactory(
  "automatic-speech-recognition",
  modelId,
  {cache_dir: cacheDir, progress_callback: onProgress},
);
const output = await transcriber(audioData, {
  return_timestamps: "word",
  chunk_length_s: 30,
  stride_length_s: 5,
});
```

Decode WAV input to 32-bit float, 16 kHz mono using `WaveFileCtor`, normalize finite positive chunks, reuse one in-flight pipeline promise, and clear a rejected loader so Retry works. Reject before inference when `signal.aborted` is true and check it again after inference.

- [ ] **Step 5: Ignore local model files**

Add:

```gitignore
.models/
.models/**/*.partial
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test server/localWhisper.test.mjs
npm.cmd run lint
```

Expected: adapter tests PASS and lint exits 0.

Commit:

```powershell
git add package.json package-lock.json .gitignore server/localWhisper.mjs server/localWhisper.test.mjs
git commit -m "feat: add local Whisper transcription"
```

---

### Task 2: Cleanup Suggestion Detection

**Files:**
- Create: `server/audioCleanupLogic.mjs`
- Create: `server/audioCleanupLogic.test.mjs`

**Interfaces:**
- Consumes: Whisper words and FFmpeg silence ranges.
- Produces: `buildCleanupSuggestions({words, silenceRanges, sourceDurationSeconds})`.
- Produces: `mergeRemovalRanges(suggestions)`.
- Suggestion shape: `{id, type, startSeconds, endSeconds, originalText, reason, selected, replacementText?}`.

- [ ] **Step 1: Write failing detector tests**

Cover these exact cases:

```js
assert.deepEqual(
  detectFillers([{text: "Um", startSeconds: 1, endSeconds: 1.2}]),
  [{type: "filler", startSeconds: 1, endSeconds: 1.2, originalText: "Um"}],
);

assert.equal(
  detectRepetitions(words("we we need to to continue")).length,
  2,
);

assert.deepEqual(
  suggestVocabulary("very good"),
  {originalText: "very good", replacementText: "effective"},
);
```

Also test a 0.2-second silence is ignored, a 0.7-second silence is suggested with 0.08-second speech padding, punctuation/case normalization, repeated two- and three-word phrases, overlapping range merging, and clamping to source duration.

- [ ] **Step 2: Run and confirm failure**

Run:

```powershell
node --test server/audioCleanupLogic.test.mjs
```

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement deterministic detectors**

Use explicit constants:

```js
export const MIN_SILENCE_SECONDS = 0.5;
export const SILENCE_EDGE_PADDING_SECONDS = 0.08;
export const FILLER_TERMS = ["um", "uh", "erm", "like", "you know", "basically"];
export const VOCABULARY_REPLACEMENTS = new Map([
  ["very good", "effective"],
  ["very bad", "ineffective"],
  ["a lot", "substantially"],
  ["thing", "point"],
  ["stuff", "details"],
]);
```

Create stable IDs from type, rounded milliseconds, and occurrence index. Default silence, filler, and immediate repetitions to selected; default vocabulary suggestions to unselected so wording never changes unexpectedly.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node --test server/audioCleanupLogic.test.mjs
```

Expected: all detector tests PASS.

Commit:

```powershell
git add server/audioCleanupLogic.mjs server/audioCleanupLogic.test.mjs
git commit -m "feat: detect local audio cleanup suggestions"
```

---

### Task 3: Loopback Local Analysis Endpoint

**Files:**
- Modify: `server/transcriptionServer.mjs`
- Modify: `server/transcriptionServer.test.mjs`

**Interfaces:**
- Consumes: multipart field `file`, `sourceStart`, and `duration`.
- Produces: `POST /api/analyze-audio` JSON `{transcript, words, suggestions}`.
- Emits progress through `GET /api/local-model-status` as `{state, progress, message}`.

- [ ] **Step 1: Write failing route tests**

Inject local analysis dependencies and assert:

```js
assert.equal(response.status, 200);
assert.deepEqual(response.body.suggestions[0].type, "silence");
assert.equal(openAiFetchCalls, 0);
```

Test missing media (400), invalid trim range (400), foreign Origin (403), oversized upload (413), cancellation cleanup, malformed local output (500 with sanitized message), and status polling during model download.

- [ ] **Step 2: Run and confirm failure**

Run:

```powershell
node --test server/transcriptionServer.test.mjs
```

Expected: new local endpoint tests FAIL with 404.

- [ ] **Step 3: Implement extraction and analysis**

Extract the selected range to WAV:

```js
const ffmpegArgs = [
  "-y", "-ss", String(sourceStart), "-t", String(duration),
  "-i", inputPath,
  "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_f32le",
  outputPath,
];
```

Run a second FFmpeg analysis pass with `silencedetect=noise=-38dB:d=0.5`, parse only finite paired `silence_start`/`silence_end` events, then call `transcribeWav` and `buildCleanupSuggestions`. Reuse the existing local-origin, size, trim, cancellation, unique-temp-directory, and cleanup controls.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node --test server/transcriptionServer.test.mjs server/localWhisper.test.mjs server/audioCleanupLogic.test.mjs
npm.cmd run lint
```

Expected: route and unit tests PASS; lint exits 0.

Commit:

```powershell
git add server/transcriptionServer.mjs server/transcriptionServer.test.mjs
git commit -m "feat: expose local audio analysis endpoint"
```

---

### Task 4: Atomic Linked Timeline Cleanup

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `applyApprovedAudioCleanup(clips, {clipId, removalRanges, vocabularyEdits, fps})`.
- Returns the original array for invalid or no-op cleanup.
- Returns new reciprocal video/audio segments for accepted removal ranges.

- [ ] **Step 1: Write failing timeline tests**

Add tests proving:

```ts
const result = applyApprovedAudioCleanup(clips, {
  clipId: "main-video",
  removalRanges: [{startSeconds: 2, endSeconds: 3}],
  vocabularyEdits: [],
  fps: 30,
});
assert.deepEqual(result.filter((clip) => clip.track === "main").map(pickTiming), [
  {start: 0, duration: 60, sourceStart: 0},
  {start: 60, duration: 210, sourceStart: 90},
]);
```

Also cover a trimmed source, 2x and 0.5x speed, reciprocal audio IDs, an overlay layer, overlapping ranges, removal outside the clip, narration preservation, unrelated track preservation, vocabulary-only caption changes, and exact Undo/Redo through `applyTimelineHistoryEdit`.

- [ ] **Step 2: Run and confirm failure**

Run:

```powershell
node --test tests/editorLogic.test.mts
```

Expected: FAIL because `applyApprovedAudioCleanup` is not exported.

- [ ] **Step 3: Implement range conversion and segment generation**

Convert source seconds to source frames, intersect with `[sourceStart, sourceStart + duration * speed]`, convert surviving source spans back to timeline duration with `Math.round(sourceFrames / speed)`, and sequence generated segments from the original timeline start. Each generated video/audio pair receives reciprocal IDs such as `${clipId}-cleanup-${index}-video` and `${clipId}-cleanup-${index}-audio`.

Vocabulary edits update only caption clips whose `sourceClipId` matches the analyzed clip and whose timestamp overlaps the suggestion. Preserve every unrelated object unchanged.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node --test tests/editorLogic.test.mts
```

Expected: editor logic tests PASS.

Commit:

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: apply approved local audio cleanup"
```

---

### Task 5: Transcript Review Interface

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/caption-ui.test.mts`

**Interfaces:**
- Consumes: `/api/analyze-audio` and `/api/local-model-status`.
- Consumes: `applyApprovedAudioCleanup`.
- Stores analysis identity `{clipId, src, sourceStart, duration, speed}` to reject stale results.

- [ ] **Step 1: Write failing UI wiring tests**

Assert the source contains:

```ts
assert.match(source, /Analyze locally/);
assert.match(source, /api\/analyze-audio/);
assert.match(source, /Silence[\s\S]*Repeated speech[\s\S]*Filler words[\s\S]*Vocabulary/);
assert.match(source, /Apply cleanup/);
assert.match(source, /analysisIdentity/);
```

Also require AbortController cancellation, disabled Apply while loading or stale, editable vocabulary replacement input, suggestion seeking, and one `commitClipChange` call for Apply.

- [ ] **Step 2: Run and confirm failure**

Run:

```powershell
node --test tests/caption-ui.test.mts
```

Expected: new UI tests FAIL.

- [ ] **Step 3: Implement analysis state and requests**

Add typed state:

```ts
type CleanupSuggestion = {
  id: string;
  type: "silence" | "filler" | "repetition" | "vocabulary";
  startSeconds: number;
  endSeconds: number;
  originalText: string;
  reason: string;
  selected: boolean;
  replacementText?: string;
};
```

Fetch selected media as a Blob, send it with exact source trim metadata, poll model status during first load, and accept results only when the current selected clip still matches the captured identity. Abort on selection/timing change and unmount.

- [ ] **Step 4: Build review controls**

Render one unframed grouped list with checkboxes, timestamp buttons that seek the playhead, editable vocabulary replacements, download/analysis progress, **Apply cleanup**, and **Undo**. Do not add a second timeline or duplicate card hierarchy.

- [ ] **Step 5: Apply one atomic edit**

Build selected removal ranges and vocabulary edits, then call:

```ts
commitClipChange((currentClips) => applyApprovedAudioCleanup(currentClips, {
  clipId: analysisIdentity.clipId,
  removalRanges,
  vocabularyEdits,
  fps,
}));
```

Clear analysis after a successful change, preserve it after a no-op, and surface a concise status message.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test tests/caption-ui.test.mts tests/editorLogic.test.mts
npm.cmd run lint
```

Expected: UI and logic tests PASS; lint exits 0.

Commit:

```powershell
git add src/Composition.tsx src/index.css tests/caption-ui.test.mts
git commit -m "feat: add local transcript cleanup review"
```

---

### Task 6: End-to-End Verification And Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md` if present; otherwise create `docs/local-audio-cleanup.md`

**Interfaces:**
- Documents the model cache, first-run download, privacy boundary, and Retry behavior.

- [ ] **Step 1: Remove the Transcript API-key instruction**

Keep any OpenAI key documentation only for legacy automatic captions if that feature still uses it. State explicitly that **Transcript > Analyze locally** does not use the key.

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
node --test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: zero failed tests, lint/type checking exits 0, Remotion bundle exits 0, and `git diff --check` prints nothing.

- [ ] **Step 3: Perform local browser verification**

Run `npm.cmd run web`, then verify at desktop and narrow viewport widths:

1. Select a main clip and open Transcript.
2. Start analysis and confirm first-run progress remains readable.
3. Cancel once and confirm Retry works without timeline changes.
4. Analyze again and seek to suggestions.
5. Deselect one removal and edit one vocabulary replacement.
6. Apply cleanup and verify linked video/audio remain synchronized.
7. Undo and verify exact restoration.
8. Select an overlay and repeat a small cleanup.

- [ ] **Step 4: Commit documentation**

```powershell
git add .env.example README.md docs/local-audio-cleanup.md
git commit -m "docs: explain local audio cleanup"
```

Stage only files that exist and were changed.
