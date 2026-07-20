# Manual and Automatic Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual playhead captions and OpenAI-powered timed caption generation while keeping captions separate from ordinary text overlays.

**Architecture:** Keep caption construction, timestamp conversion, and batch replacement as pure functions in `src/editorLogic.ts`. Add a local Express endpoint that extracts audio with FFmpeg and calls OpenAI without exposing the API key; `Composition.tsx` owns panel state, media upload, preview rendering, and timeline integration.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, Vite 8, Node.js, Express, Multer, FFmpeg, OpenAI audio transcriptions, Node test runner, ESLint.

## Global Constraints

- Manual captions begin at the current red playhead and default to 90 frames.
- Automatic captions apply to one selected main-track or overlay video clip.
- OpenAI credentials remain in the local backend and never enter browser code.
- Text and Caption tracks are separate and appear only when they contain clips.
- One successful automatic generation is one undoable editor operation.
- Failed generation must leave the timeline unchanged.
- The Captions group offers Auto captions, Manual captions, Upload caption file, and Auto lyrics.
- Caption-file import supports `.srt`, `.ass`, and `.lrc` and parses files locally.
- Existing video, overlay, sticker, text, audio, trim, split, delete, and history behavior must remain functional.

## File Structure

- `src/editorLogic.ts`: caption/text types and pure caption timeline operations.
- `src/Composition.tsx`: Captions tab, generation request, preview, selection, and conditional tracks.
- `src/index.css`: caption panel, status, preview, and timeline styling.
- `server/transcriptionLogic.mjs`: validation, OpenAI transcript normalization, and an injectable transcription pipeline with no HTTP concerns.
- `server/transcriptionServer.mjs`: Express upload route, temporary files, FFmpeg, OpenAI request, and cleanup.
- `vite.config.ts`: standalone editor API proxy.
- `.env.example`: documented local API-key variable.
- `tests/editorLogic.test.mts`: caption model and timeline behavior.
- `tests/transcriptionLogic.test.mjs`: backend response validation without a real API call.
- `tests/caption-ui.test.mts`: source-level UI contract checks following the existing UI-test style.

---

### Task 1: Separate Text And Caption Timeline Models

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TrackName` with `text`, `CaptionOverlay`, `TranscriptionSegment`, `createManualCaptionClip()`, `createGeneratedCaptionClips()`, and `replaceGeneratedCaptionBatch()`.

- [ ] **Step 1: Write failing track-separation and manual-caption tests**

Add imports for the new helpers and tests with these assertions:

```ts
test("keeps ordinary text separate from captions", () => {
  const text = createTextClip({id: "text-1", content: "Title", playheadFrame: 12});
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Hello",
    playheadFrame: 120,
    timelineDuration: 480,
    style: defaultCaptionStyle,
  });

  assert.equal(text.track, "text");
  assert.equal(caption?.track, "caption");
  assert.equal(caption?.start, 120);
  assert.equal(caption?.duration, 90);
});

test("clamps a manual caption to the timeline end", () => {
  const caption = createManualCaptionClip({
    id: "caption-end",
    content: "End",
    playheadFrame: 470,
    timelineDuration: 480,
    style: defaultCaptionStyle,
  });
  assert.equal(caption?.duration, 10);
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts
```

Expected: FAIL because `text` is not a valid track and caption constructors are missing.

- [ ] **Step 3: Add distinct text and caption types**

Update the model with these exact public shapes:

```ts
export type TrackName =
  | "upper"
  | "sticker"
  | "text"
  | "main"
  | "caption"
  | "audio";

export type CaptionStyle = {
  fontSize: number;
  textColor: string;
  backgroundEnabled: boolean;
  backgroundColor: string;
};

export type CaptionOverlay = CaptionStyle & {
  content: string;
  sourceClipId?: string;
  generationId?: string;
};

export type TranscriptionSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

// Add to TimelineClip:
caption?: CaptionOverlay;

export const defaultCaptionStyle: CaptionStyle = {
  fontSize: 36,
  textColor: "#ffffff",
  backgroundEnabled: true,
  backgroundColor: "#000000cc",
};
```

Change `createTextClip`, `moveTextClip`, and `moveTextOverlay` to require `track === "text"` instead of `track === "caption"`.

- [ ] **Step 4: Implement manual caption construction**

Add:

```ts
export const createManualCaptionClip = ({
  id,
  content,
  playheadFrame,
  timelineDuration,
  style,
}: {
  id: string;
  content: string;
  playheadFrame: number;
  timelineDuration: number;
  style: CaptionStyle;
}): TimelineClip | null => {
  const text = content.trim();
  const start = Math.max(0, Math.round(playheadFrame));
  const duration = Math.min(90, timelineDuration - start);
  if (!text || duration < 1) return null;

  return {
    id,
    label: text,
    track: "caption",
    start,
    duration,
    color: "#ef4444",
    caption: {...style, content: text},
  };
};
```

- [ ] **Step 5: Run model tests and commit**

Run the Task 1 test command. Expected: PASS.

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: separate text and caption tracks"
```

---

### Task 2: Convert Timestamped Transcript Segments Into Caption Clips

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TimelineClip`, `CaptionStyle`, and `TranscriptionSegment` from Task 1.
- Produces: `createGeneratedCaptionClips(options): TimelineClip[]` and `replaceGeneratedCaptionBatch(clips, sourceClipId, generated): TimelineClip[]`.

- [ ] **Step 1: Write failing timestamp conversion tests**

Add tests for a selected clip at frame `90`, `sourceStart: 30`, `duration: 180`, `speed: 1`, and `fps: 30`. Feed segments at `0.2-1`, `1.5-3`, and `10-11` seconds. Expect the first segment to be excluded because it ends at the trim boundary, the second to map to frames `105-150`, and the out-of-range segment to be excluded.

Also test replacement:

```ts
const result = replaceGeneratedCaptionBatch(
  [manualCaption, oldGeneratedForMain, generatedForOverlay],
  "main-1",
  newGenerated,
);
assert.ok(result.includes(manualCaption));
assert.ok(result.includes(generatedForOverlay));
assert.equal(result.some((clip) => clip.id === oldGeneratedForMain.id), false);
```

- [ ] **Step 2: Verify timestamp tests fail**

Run the Task 1 test command. Expected: FAIL because both helpers are missing.

- [ ] **Step 3: Implement source-aware frame conversion**

Implement this interface and behavior:

```ts
export const createGeneratedCaptionClips = ({
  sourceClip,
  segments,
  fps,
  timelineDuration,
  generationId,
  style,
}: {
  sourceClip: TimelineClip;
  segments: TranscriptionSegment[];
  fps: number;
  timelineDuration: number;
  generationId: string;
  style: CaptionStyle;
}): TimelineClip[] => {
  const speed = sourceClip.speed ?? 1;
  const sourceStartSeconds = (sourceClip.sourceStart ?? 0) / fps;
  const sourceEndSeconds = sourceStartSeconds + (sourceClip.duration * speed) / fps;

  return segments.flatMap((segment, index) => {
    const text = segment.text.trim();
    const visibleStart = Math.max(segment.startSeconds, sourceStartSeconds);
    const visibleEnd = Math.min(segment.endSeconds, sourceEndSeconds);
    if (!text || visibleEnd <= visibleStart) return [];

    const start = sourceClip.start + Math.round(
      ((visibleStart - sourceStartSeconds) * fps) / speed,
    );
    const end = Math.min(
      timelineDuration,
      sourceClip.start + Math.round(
        ((visibleEnd - sourceStartSeconds) * fps) / speed,
      ),
    );
    if (end <= start) return [];

    return [{
      id: `${generationId}-${index}`,
      label: text,
      track: "caption" as const,
      start,
      duration: end - start,
      color: "#ef4444",
      caption: {
        ...style,
        content: text,
        sourceClipId: sourceClip.id,
        generationId,
      },
    }];
  });
};

export const replaceGeneratedCaptionBatch = (
  clips: TimelineClip[],
  sourceClipId: string,
  generated: TimelineClip[],
): TimelineClip[] => [
  ...clips.filter(
    (clip) =>
      clip.track !== "caption" ||
      !clip.caption?.generationId ||
      clip.caption.sourceClipId !== sourceClipId,
  ),
  ...generated,
];
```

- [ ] **Step 4: Reject malformed segments without mutation**

Filter segments unless all values are finite, `startSeconds >= 0`, and `endSeconds > startSeconds`. Add a test where every segment is invalid and assert `createGeneratedCaptionClips()` returns `[]`.

- [ ] **Step 5: Run tests and commit**

Run the editor logic tests. Expected: PASS.

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: map transcript timestamps to captions"
```

---

### Task 3: Local OpenAI Transcription Backend

**Files:**
- Create: `server/transcriptionLogic.mjs`
- Create: `server/transcriptionServer.mjs`
- Create: `tests/transcriptionLogic.test.mjs`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `normalizeTranscriptSegments(payload)`, `transcribeMediaFile(options)`, and HTTP `POST /api/transcribe` returning `{segments: TranscriptionSegment[]}`.

- [ ] **Step 1: Install backend dependencies**

Run:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install express multer dotenv ffmpeg-static
& "C:\Program Files\nodejs\npm.cmd" install --save-dev concurrently
```

Expected: dependencies and lockfile update successfully.

- [ ] **Step 2: Write failing transcript normalization tests**

Create `tests/transcriptionLogic.test.mjs` with success and rejection cases:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {normalizeTranscriptSegments} from "../server/transcriptionLogic.mjs";

test("normalizes OpenAI segment timestamps", () => {
  assert.deepEqual(
    normalizeTranscriptSegments({segments: [{start: 0.2, end: 1.4, text: " Hi "}]}),
    [{startSeconds: 0.2, endSeconds: 1.4, text: "Hi"}],
  );
});

test("rejects responses without usable timestamps", () => {
  assert.throws(() => normalizeTranscriptSegments({text: "Hi"}), /timestamps/i);
});
```

Add pipeline tests using injected fakes. The success test records the FFmpeg arguments, returns a mocked OpenAI verbose-JSON response, and asserts temporary cleanup runs. Add separate tests for a rejected OpenAI response and malformed transcript timestamps; both must assert cleanup still runs.

- [ ] **Step 3: Verify the backend test fails**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests\transcriptionLogic.test.mjs
```

Expected: FAIL because `transcriptionLogic.mjs` does not exist.

- [ ] **Step 4: Implement strict response normalization**

Create `normalizeTranscriptSegments(payload)` so it throws unless `payload.segments` is an array containing at least one finite, ordered, non-empty segment. Return only `{startSeconds, endSeconds, text}` objects and export the function.

```js
export const normalizeTranscriptSegments = (payload) => {
  const segments = Array.isArray(payload?.segments) ? payload.segments : [];
  const normalized = segments.flatMap((segment) => {
    const startSeconds = Number(segment?.start);
    const endSeconds = Number(segment?.end);
    const text = String(segment?.text ?? "").trim();
    return Number.isFinite(startSeconds) &&
      Number.isFinite(endSeconds) &&
      startSeconds >= 0 && endSeconds > startSeconds && text
      ? [{startSeconds, endSeconds, text}]
      : [];
  });
  if (normalized.length === 0) throw new Error("Transcript has no usable timestamps");
  return normalized;
};
```

Export an injectable service with this signature:

```js
export const transcribeMediaFile = async ({
  inputPath,
  outputPath,
  tempDirectory,
  apiKey,
  ffmpegPath,
  execFileImpl,
  fetchImpl,
  readFileImpl,
  removeDirectoryImpl,
}) => {
  try {
    await execFileImpl(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      outputPath,
    ]);

    const audio = await readFileImpl(outputPath);
    const body = new FormData();
    body.append("file", new Blob([audio]), "audio.mp3");
    body.append("model", "whisper-1");
    body.append("response_format", "verbose_json");
    body.append("timestamp_granularities[]", "segment");

    const response = await fetchImpl(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {Authorization: `Bearer ${apiKey}`},
        body,
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "OpenAI transcription failed");
    }
    return normalizeTranscriptSegments(payload);
  } finally {
    await removeDirectoryImpl(tempDirectory, {recursive: true, force: true});
  }
};
```

The implementation must run FFmpeg, read the extracted MP3 into a Blob, call the OpenAI endpoint, reject non-2xx responses with the returned message when available, normalize timestamps, and always call `removeDirectoryImpl(tempDirectory, {recursive: true, force: true})` in `finally`.

- [ ] **Step 5: Implement the secure upload route**

Create an Express server on `CAPTION_API_PORT ?? 5174` with `multer.memoryStorage()` and a 100 MB upload limit. The route must:

1. Return `400` without `req.file`.
2. Return `500` with code `missing_api_key` when `OPENAI_API_KEY` is absent.
3. Write the upload to `mkdtemp(join(tmpdir(), "video-editor-caption-"))`.
4. Call `transcribeMediaFile()` with real `execFile`, `fetch`, `readFile`, and `rm` dependencies.
5. Inside the service, run `ffmpeg-static` with `-vn -ac 1 -ar 16000 output.mp3`.
6. Submit `output.mp3` in `FormData` to `https://api.openai.com/v1/audio/transcriptions` with `model=whisper-1`, `response_format=verbose_json`, and `timestamp_granularities[]=segment`.
7. Normalize the JSON with `normalizeTranscriptSegments()` and return `{segments}`.
8. Let the service remove the temporary directory recursively in `finally`.

Use a single error response shape:

```js
res.status(status).json({
  error: {code, message},
});
```

- [ ] **Step 6: Document the local secret**

Create `.env.example`:

```dotenv
OPENAI_API_KEY=replace_with_your_openai_api_key
CAPTION_API_PORT=5174
```

Keep `.env` in `.gitignore` and also ignore `server-temp/` defensively.

- [ ] **Step 7: Run tests and commit**

Run the backend tests. Expected: normalization, success, API failure, malformed response, and cleanup tests PASS without running FFmpeg or making an OpenAI request.

```powershell
git add server tests/transcriptionLogic.test.mjs .env.example .gitignore package.json package-lock.json
git commit -m "feat: add local caption transcription API"
```

---

### Task 4: Run Frontend And Caption API Together

**Files:**
- Create: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: backend `POST /api/transcribe` from Task 3.
- Produces: `npm.cmd run web` serving the editor at port 5173 and proxying `/api` to port 5174.

- [ ] **Step 1: Add explicit Vite proxy configuration**

Create:

```ts
import {defineConfig} from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:5174",
    },
  },
});
```

- [ ] **Step 2: Split and combine web scripts**

Set these scripts while preserving Remotion `dev`, `build`, `upgrade`, and `lint`:

```json
{
  "web:frontend": "vite",
  "web:api": "node server/transcriptionServer.mjs",
  "web": "concurrently -k -n WEB,API \"npm run web:frontend\" \"npm run web:api\""
}
```

- [ ] **Step 3: Verify both processes start**

Run `npm.cmd run web`. Expected: Vite reports `http://localhost:5173/` and the API reports port `5174`. Stop with `Ctrl+C` after verification.

- [ ] **Step 4: Commit configuration**

```powershell
git add vite.config.ts package.json package-lock.json
git commit -m "chore: run caption API with web editor"
```

---

### Task 5: Functional Captions Panel And Manual Caption Flow

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Create: `tests/caption-ui.test.mts`

**Interfaces:**
- Consumes: `createManualCaptionClip()`, distinct `text`/`caption` tracks, and existing `commitClipChange()`.
- Produces: active `captions` tool, manual form, conditional Caption row, and caption preview.

- [ ] **Step 1: Write failing UI contract tests**

Create a source-level test matching the existing UI-test convention:

```ts
assert.match(source, /activeTool.*"captions"/s);
assert.match(source, /onClick=\{addCaptionAtPlayhead\}/);
assert.match(source, /getActiveClipsAtFrame\([\s\S]*?"caption"/);
assert.match(source, /label: "Caption track"/);
assert.match(source, /label: "Text track"/);
```

Also assert the caption and text rows are both guarded by `hasClipsOnTrack()`.

- [ ] **Step 2: Verify the UI test fails**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests\caption-ui.test.mts
```

Expected: FAIL because Captions is currently inert.

- [ ] **Step 3: Add caption tool state and manual controls**

Extend the tool union with `"captions"`; make the Captions navigation button call `setActiveTool("captions")`. Add state:

```ts
const [captionDraft, setCaptionDraft] = useState("");
const [captionStyle, setCaptionStyle] = useState(defaultCaptionStyle);
const [captionStatus, setCaptionStatus] = useState<
  {kind: "idle" | "loading" | "error" | "success"; message: string}
>({kind: "idle", message: ""});
```

Implement `addCaptionAtPlayhead()` with `createManualCaptionClip()`, `commitClipChange()`, selection of the new clip, `setSelectedTrack("caption")`, and draft clearing only after successful creation.

- [ ] **Step 4: Render the Captions panel**

Add a manual section with textarea, Add caption command, font-size range, text-color input, background checkbox, and background-color input. Use labels rather than explanatory feature prose. Disable Add when the trimmed draft is empty.

- [ ] **Step 5: Separate timeline rows and text dragging**

Change active ordinary text lookup and drag behavior to `track: "text"`. Add conditional rows:

```ts
...(hasClipsOnTrack(clips, "text")
  ? [{key: "text", id: "text" as TrackName, label: "Text track"}]
  : []),
...(hasClipsOnTrack(clips, "caption")
  ? [{key: "caption", id: "caption" as TrackName, label: "Caption track"}]
  : []),
```

Only `text` clips use `startTextTimelineDrag`; captions remain selectable and trimmable but are not freely dragged in the preview.

- [ ] **Step 6: Render active captions safely**

Build `activeCaptionClips` with `getActiveClipsAtFrame(clips, "caption", playheadFrame)`. Render them after videos and before stickers/text as bottom-centered spans using `caption.content`, style colors, and background toggle. Stack overlaps using an index-based `bottom` offset.

- [ ] **Step 7: Style and verify manual captions**

Add compact `.caption-tool-panel`, `.caption-style-grid`, `.caption-status`, `.preview-caption-stack`, and `.preview-caption` rules. Ensure caption controls fit the media panel, preview text remains readable, and timeline clips retain stable height.

Run caption UI tests, editor logic tests, and lint. Expected: PASS.

- [ ] **Step 8: Commit manual caption UI**

```powershell
git add src/Composition.tsx src/index.css tests/caption-ui.test.mts
git commit -m "feat: add manual caption editor"
```

---

### Task 6: Automatic Caption Generation UI

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/caption-ui.test.mts`

**Interfaces:**
- Consumes: `/api/transcribe`, `createGeneratedCaptionClips()`, and `replaceGeneratedCaptionBatch()`.
- Produces: `generateCaptionsForSelectedClip()` with progress, replacement confirmation, atomic history update, and recoverable errors.

- [ ] **Step 1: Extend failing UI tests for automatic generation**

Assert the source contains `fetch("/api/transcribe"`, `createGeneratedCaptionClips`, `replaceGeneratedCaptionBatch`, the four progress labels, and a disabled Generate command while loading.

- [ ] **Step 2: Verify the new UI test fails**

Run the caption UI test. Expected: FAIL because automatic generation is absent.

- [ ] **Step 3: Implement selected-media upload**

In `generateCaptionsForSelectedClip()`:

```ts
const sourceClip = selectedClip;
if (!sourceClip?.src || !["main", "upper"].includes(sourceClip.track)) {
  setCaptionStatus({kind: "error", message: "Select a video clip first."});
  return;
}

setCaptionStatus({kind: "loading", message: "Preparing media"});
const mediaResponse = await fetch(resolveMediaSource(sourceClip.src));
if (!mediaResponse.ok) throw new Error("Could not load the selected media.");
const mediaBlob = await mediaResponse.blob();
const body = new FormData();
body.append("media", mediaBlob, `${sourceClip.label}.mp4`);
```

Then update status to `Extracting audio / Transcribing`, POST to `/api/transcribe`, and validate `response.ok` plus a `segments` array.

- [ ] **Step 4: Convert and commit one atomic generated batch**

Create `generationId = caption-${Date.now()}`, convert the response using the selected clip, `fps`, `compositionDurationInFrames`, and current style. If no clips result, throw `No speech was found in the selected clip.`

When prior generated captions reference the same source clip, call `window.confirm("Replace the captions previously generated for this clip?")`; cancel without mutation when declined. Otherwise call `commitClipChange()` exactly once with `replaceGeneratedCaptionBatch()`.

- [ ] **Step 5: Add progress and error UI**

Show one status row with `role="status"` for progress/success and `role="alert"` for errors. Disable both manual Add and automatic Generate while loading. Use these messages: `Preparing media`, `Extracting audio`, `Transcribing`, `Adding captions`, and `Captions added`.

- [ ] **Step 6: Run all automated checks**

Run:

```powershell
& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts tests\playhead-ui.test.mts tests\caption-ui.test.mts tests\transcriptionLogic.test.mjs
& "C:\Program Files\nodejs\npm.cmd" run lint
```

Expected: all tests PASS; ESLint and TypeScript exit `0`.

- [ ] **Step 7: Commit automatic generation**

```powershell
git add src/Composition.tsx src/index.css tests/caption-ui.test.mts
git commit -m "feat: generate timed captions from video"
```

---

### Task 7: End-To-End Verification

**Files:**
- Modify only files required by defects found during verification.

**Interfaces:**
- Verifies all interfaces delivered in Tasks 1-6.

- [ ] **Step 1: Configure a local key**

Create an untracked `.env` from `.env.example` and set a valid `OPENAI_API_KEY`. Confirm `git status --short` does not list `.env`.

- [ ] **Step 2: Start the complete editor**

Run `npm.cmd run web` and open `http://localhost:5173/`. Confirm both frontend and API processes remain running.

- [ ] **Step 3: Verify manual captions**

Move the red playhead, add a manual caption, change its styles, play across its boundaries, trim it, split it at the red line, delete it, and Undo. Confirm the Caption track disappears only when it has no captions.

- [ ] **Step 4: Verify automatic captions**

Select a main video clip, generate captions, and confirm captions appear at spoken times. Repeat for an overlay clip. Generate again for the same source, accept replacement, and verify manual captions remain.

- [ ] **Step 5: Verify error recovery and regression safety**

Stop the API and trigger generation; confirm an error appears and the timeline is unchanged. Restart it, then verify video playback, overlay layering, stickers, ordinary text, audio, trim, split, delete, draggable playhead, and undo/redo.

- [ ] **Step 6: Run final checks and review the diff**

Run the full test/lint commands from Task 6 plus:

```powershell
git diff --check
git status --short
```

Expected: tests and lint pass, `git diff --check` prints nothing, `.env` is absent from status, and only intentional project files are changed.

---

### Task 8: Expanded Caption Group, File Import, And Auto Lyrics

**Files:**
- Create: `src/captionFileParser.ts`
- Create: `tests/captionFileParser.test.mts`
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/caption-ui.test.mts`

**Interfaces:**
- Produces: `parseCaptionFile({name, content, fps, timelineDuration}): ParsedCaption[]`, four Caption action tiles, local file import, and Auto lyrics generation.

- [ ] **Step 1: Write failing parser tests**

Cover SRT comma timestamps, ASS `Dialogue:` rows, LRC timestamps, multiple LRC timestamps on one line, malformed-row skipping, and a completely invalid file returning `[]`.

```ts
assert.deepEqual(
  parseCaptionFile({
    name: "captions.srt",
    content: "1\n00:00:01,000 --> 00:00:02,500\nHello",
    fps: 30,
    timelineDuration: 480,
  }),
  [{text: "Hello", start: 30, duration: 45}],
);
```

- [ ] **Step 2: Verify parser tests fail**

Run `node --test tests\captionFileParser.test.mts`. Expected: FAIL because the parser module is missing.

- [ ] **Step 3: Implement local parsers**

Export:

```ts
export type ParsedCaption = {text: string; start: number; duration: number};
export const parseCaptionFile = ({
  name,
  content,
  fps,
  timelineDuration,
}: {
  name: string;
  content: string;
  fps: number;
  timelineDuration: number;
}): ParsedCaption[] => {
  // Dispatch by lowercase extension, normalize to seconds, sort, convert to
  // clamped frames, and return only non-empty positive-duration entries.
};
```

For LRC, use the next timestamp as the end and default the final entry to `90` frames. Strip ASS override tags such as `{\\an8}` and convert `\\N` to a space.

- [ ] **Step 4: Add four Caption action tiles**

Add `captionMode: "menu" | "auto" | "manual" | "upload" | "lyrics"`. The menu renders four icon buttons titled exactly `Auto captions`, `Manual captions`, `Upload caption file`, and `Auto lyrics`. Selecting one mode shows its controls plus an icon-only Back command with tooltip.

- [ ] **Step 5: Implement atomic file import**

Use a hidden input with `accept=".srt,.ass,.lrc,text/plain"`. Read with `file.text()`, parse locally, map every parsed item to a `TimelineClip` with `track: "caption"`, current caption style, and unique IDs, then call `commitClipChange()` exactly once. Invalid files show an alert and make no timeline change.

- [ ] **Step 6: Implement Auto lyrics**

Refactor the automatic request into `generateTimedCaptions(mode: "captions" | "lyrics")`. Both modes use the selected main/upper source clip and `/api/transcribe`; lyrics use user-facing progress/success copy containing `lyrics`. Both convert through `createGeneratedCaptionClips()` and commit one generated batch atomically.

- [ ] **Step 7: Add UI tests and styling**

Assert all four actions, mode navigation, accepted extensions, local `file.text()` parsing, one `commitClipChange()` import, and `generateTimedCaptions("lyrics")`. Style a two-column compact action grid at desktop width and one column in the narrow media panel without oversized explanatory cards.

- [ ] **Step 8: Verify and commit**

Run parser tests, caption UI tests, all editor logic/timing/transcription tests, and lint. Expected: all pass.

```powershell
git add src/captionFileParser.ts src/Composition.tsx src/index.css tests/captionFileParser.test.mts tests/caption-ui.test.mts
git commit -m "feat: expand caption import and lyrics tools"
```
