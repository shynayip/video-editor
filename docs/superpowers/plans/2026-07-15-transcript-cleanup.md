# Transcript Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real timestamped transcription, reviewable cleanup suggestions, and CapCut-style main-video/audio cuts from transcript selections.

**Architecture:** A local Express endpoint receives media and calls OpenAI `whisper-1` with verbose JSON word timestamps. Pure transcript logic detects suggestions and converts approved source ranges into timeline cuts. React owns request state, review controls, manual text correction, and one-step history integration.

**Tech Stack:** React 19, TypeScript 5.9, Express, Multer, OpenAI Node SDK, Vite proxy, Node test runner.

## Global Constraints

- `OPENAI_API_KEY` is server-only and never exposed to browser code.
- Cleanup modifies selected main video and its linked original audio together.
- Overlay clips, music, microphone narration, and text clips remain unchanged.
- Suggestions require user review before timeline modification.
- OpenAI word timestamps use `response_format: "verbose_json"`, `timestamp_granularities: ["word"]`, and model `whisper-1`.

---

### Task 1: Transcript Analysis And Cleanup Ranges

**Files:**
- Create: `src/transcriptLogic.ts`
- Create: `tests/transcriptLogic.test.mts`

**Interfaces:**
- Produces: `TranscriptWord`, `CleanupSuggestion`, `detectCleanupSuggestions`, `normalizeCleanupRanges`, and `applyTranscriptCuts`.
- Consumes: `TimelineClip` from `src/editorLogic.ts`.

- [ ] **Step 1: Write failing analysis tests**

```ts
test("detects filler words and long timestamp gaps", () => {
  const words = [
    {word: "Hello", start: 0, end: 0.4},
    {word: "um", start: 0.5, end: 0.7},
    {word: "again", start: 2.0, end: 2.4},
  ];
  const suggestions = detectCleanupSuggestions(words, 0.8);
  assert.deepEqual(suggestions.map((item) => item.kind), ["filler", "silence"]);
});

test("merges overlapping cleanup ranges", () => {
  assert.deepEqual(normalizeCleanupRanges([{start: 1, end: 2}, {start: 1.5, end: 3}]), [{start: 1, end: 3}]);
});
```

- [ ] **Step 2: Run tests and confirm missing-module failure**

Run: `node --test tests\transcriptLogic.test.mts`

Expected: FAIL because `src/transcriptLogic.ts` does not exist.

- [ ] **Step 3: Implement types and pure detection**

```ts
export type TranscriptWord = {word: string; start: number; end: number};
export type CleanupSuggestion = {id: string; kind: "filler" | "silence" | "repeat"; label: string; start: number; end: number; selected: boolean};
const FILLERS = new Set(["um", "uh", "erm", "ah"]);

export const detectCleanupSuggestions = (words: TranscriptWord[], silenceSeconds = 0.8): CleanupSuggestion[] => {
  const result: CleanupSuggestion[] = [];
  words.forEach((word, index) => {
    if (FILLERS.has(word.word.toLowerCase().replace(/[^a-z]/g, ""))) result.push({id: `filler-${index}`, kind: "filler", label: word.word, start: word.start, end: word.end, selected: true});
    const next = words[index + 1];
    if (next && next.start - word.end >= silenceSeconds) result.push({id: `silence-${index}`, kind: "silence", label: "Silent gap", start: word.end, end: next.start, selected: true});
  });
  return result;
};
```

Implement `normalizeCleanupRanges` by sorting ranges and merging every range whose start is less than or equal to the previous end.

- [ ] **Step 4: Write failing timeline-cut tests**

Test a selected main clip and linked audio clip with a two-second removed range at 30 fps. Assert both durations shrink by 60 frames, source segments no longer include the removed interval, and unrelated upper/text/narration clips are unchanged.

- [ ] **Step 5: Implement `applyTranscriptCuts`**

Use normalized ranges in descending source-time order. Split the selected main and linked audio at each range boundary, remove the inside segment, and shift later main/linked-audio segments left by the removed frame count. Return a new `TimelineClip[]` without changing unrelated tracks.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests\transcriptLogic.test.mts tests\editorLogic.test.mts`

Expected: all tests PASS.

```powershell
git add src/transcriptLogic.ts tests/transcriptLogic.test.mts
git commit -m "feat: add transcript cleanup logic"
```

### Task 2: Secure Transcription Endpoint

**Files:**
- Create: `server/transcription.mjs`
- Create: `server/transcription.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `POST /api/transcribe` multipart endpoint with field `media`.
- Returns: `{text: string, words: Array<{word: string, start: number, end: number}>}`.

- [ ] **Step 1: Add server dependencies and scripts**

Run: `npm.cmd install express multer openai dotenv concurrently`

Add scripts:

```json
"web:client": "vite --host 0.0.0.0",
"web:server": "node server/transcription.mjs",
"web": "concurrently -k \"npm:web:client\" \"npm:web:server\""
```

- [ ] **Step 2: Write endpoint tests with an injected transcription function**

Create tests that start the Express app with a fake provider and verify: multipart success returns words, absent media returns 400, absent API configuration returns 503, and provider failure returns a sanitized 502.

- [ ] **Step 3: Run endpoint tests and confirm failure**

Run: `node --test server\transcription.test.mjs`

Expected: FAIL because the server module does not exist.

- [ ] **Step 4: Implement the endpoint**

```js
const result = await client.audio.transcriptions.create({
  file: await toFile(req.file.buffer, req.file.originalname, {type: req.file.mimetype}),
  model: "whisper-1",
  response_format: "verbose_json",
  timestamp_granularities: ["word"],
});
res.json({text: result.text, words: result.words ?? []});
```

Use Multer memory storage with a 25 MB limit, accepted audio/video MIME types, and centralized sanitized JSON errors.

- [ ] **Step 5: Add Vite proxy and environment template**

```ts
server: {proxy: {"/api": "http://localhost:8787"}}
```

`.env.example` contains only `OPENAI_API_KEY=replace_with_your_key` and `TRANSCRIPTION_PORT=8787`.

- [ ] **Step 6: Run server tests and commit**

Run: `node --test server\transcription.test.mjs`

Expected: all endpoint tests PASS.

```powershell
git add server package.json package-lock.json vite.config.ts .env.example
git commit -m "feat: add secure transcription endpoint"
```

### Task 3: Transcript Tool Interface

**Files:**
- Create: `src/transcriptionClient.ts`
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `POST /api/transcribe`, `detectCleanupSuggestions`, selected main clip, and media source.
- Produces: Transcript tab, request states, editable transcript, and selectable cleanup suggestions.

- [ ] **Step 1: Implement the typed browser client**

```ts
export const transcribeMedia = async (source: string, filename: string) => {
  const mediaResponse = await fetch(source);
  if (!mediaResponse.ok) throw new Error("Unable to read the selected media.");
  const form = new FormData();
  form.append("media", await mediaResponse.blob(), filename);
  const response = await fetch("/api/transcribe", {method: "POST", body: form});
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Transcription failed.");
  return payload as {text: string; words: TranscriptWord[]};
};
```

- [ ] **Step 2: Add Transcript tab and state**

Add `transcript` to `EditorTool`. Store `transcriptText`, `transcriptWords`, `cleanupSuggestions`, `transcriptStatus`, and `transcriptError`, keyed to the selected main clip id.

- [ ] **Step 3: Add transcript panel states**

The idle panel shows selected clip and Generate transcript. Loading shows progress. Success shows an editable transcript textarea, suggestion rows with checkboxes and timestamps, Select all/Clear controls, and `Apply cleanup`. Error shows a concise message and Retry.

- [ ] **Step 4: Add styling and accessibility**

Use compact transcript rows, color-coded suggestion swatches, explicit labels, and a scrollable panel. Do not use nested cards. Ensure every checkbox and command has an accessible name.

- [ ] **Step 5: Run lint and commit**

Run: `npm.cmd run lint`

Expected: ESLint and TypeScript exit 0.

```powershell
git add src/transcriptionClient.ts src/Composition.tsx src/index.css
git commit -m "feat: add transcript review interface"
```

### Task 4: Cleanup Integration And Verification

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `tests/transcriptLogic.test.mts` only for newly exposed integration defects

- [ ] **Step 1: Connect Apply cleanup to one history edit**

```ts
commitClipChange((currentClips) => applyTranscriptCuts(
  currentClips,
  selectedMainClip.id,
  cleanupSuggestions.filter((item) => item.selected).map(({start, end}) => ({start, end})),
  fps,
));
```

Update transcript words and suggestions to remove applied ranges only after the timeline edit succeeds.

- [ ] **Step 2: Run all automated verification**

Run: `node --test tests\*.test.mts server\*.test.mjs; npm.cmd run lint; npm.cmd run build`

Expected: all tests pass and lint/build exit 0.

- [ ] **Step 3: Configure and start locally**

Set `OPENAI_API_KEY` in `.env`, run `npm.cmd run web`, and verify Vite and the transcription server start without exposing the key in browser assets or logs.

- [ ] **Step 4: Verify transcript workflow in the browser**

Select a speech video, generate transcript, deselect one suggestion, apply cleanup, and confirm selected ranges disappear from main video and linked audio while unrelated tracks remain unchanged.

- [ ] **Step 5: Verify history and failures**

Undo and redo cleanup. Then verify missing-key, unsupported-file, and no-speech messages are recoverable and do not modify the timeline.

- [ ] **Step 6: Commit integration fixes**

```powershell
git add src tests server
git commit -m "feat: integrate transcript cleanup with timeline"
```
