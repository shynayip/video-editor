# Scene-Detected Media Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace each imported full-video gallery card with independently previewable and draggable mini-scene cards detected locally from visual cuts.

**Architecture:** The existing Express media server will run bundled FFmpeg/FFprobe against a temporary upload and return normalized scene ranges. The React editor will store those ranges as virtual media items sharing one persisted source file, loop a selected range in the native preview, and pass the range start into the existing linked video/audio timeline pair.

**Tech Stack:** React 19, TypeScript, Vite 8, Express 5, Multer, `ffmpeg-static`, `ffprobe-static`, Node test runner, Remotion 4.

## Global Constraints

- Scene-change threshold is `0.32`.
- Minimum resulting scene duration is `0.75` seconds.
- Detection stays local; no external AI or network service is used.
- The original full-video card is replaced by scene cards, not retained beside them.
- A failed or no-cut detection produces one full-length fallback scene.
- Scene cards share one uploaded source file and do not duplicate MP4 data.
- Clicking a scene previews and loops only that range.
- Dragging a scene preserves its source start and duration in both linked video and audio clips.
- Existing target-layer replacement, reciprocal audio, Undo/Redo, and signed-layer behavior remain unchanged.

---

### Task 1: Scene Range Normalization

**Files:**
- Create: `server/sceneDetection.mjs`
- Create: `tests/sceneDetection.test.mjs`

**Interfaces:**
- Produces: `buildSceneDetectionArgs(inputPath, threshold): string[]`
- Produces: `parseSceneTimestamps(stderr): number[]`
- Produces: `normalizeSceneRanges({timestamps, durationSeconds, minimumDurationSeconds}): Array<{startSeconds: number; endSeconds: number}>`
- Produces: `detectScenesInMedia({inputPath, ffmpegPath, ffprobePath, execFileImpl, threshold, minimumDurationSeconds}): Promise<SceneRange[]>`

- [ ] **Step 1: Write failing parser and normalization tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSceneDetectionArgs,
  normalizeSceneRanges,
  parseSceneTimestamps,
} from "../server/sceneDetection.mjs";

test("parses visual cut timestamps from FFmpeg showinfo output", () => {
  const stderr = [
    "[Parsed_showinfo_1] n: 0 pts: 144000 pts_time:1.6 pos: 0",
    "[Parsed_showinfo_1] n: 1 pts: 432000 pts_time:4.8 pos: 200",
  ].join("\n");
  assert.deepEqual(parseSceneTimestamps(stderr), [1.6, 4.8]);
});

test("normalizes cuts into contiguous ranges and merges short scenes", () => {
  assert.deepEqual(normalizeSceneRanges({
    timestamps: [0, 0.2, 4.8, 4.8, 11.2, 99],
    durationSeconds: 12,
    minimumDurationSeconds: 0.75,
  }), [
    {startSeconds: 0, endSeconds: 4.8},
    {startSeconds: 4.8, endSeconds: 11.2},
    {startSeconds: 11.2, endSeconds: 12},
  ]);
});

test("returns one full-length range when no visual cut exists", () => {
  assert.deepEqual(normalizeSceneRanges({
    timestamps: [],
    durationSeconds: 7.5,
    minimumDurationSeconds: 0.75,
  }), [{startSeconds: 0, endSeconds: 7.5}]);
});

test("builds FFmpeg scene detection with the approved threshold", () => {
  assert.deepEqual(buildSceneDetectionArgs("C:/temp/input.mp4", 0.32), [
    "-hide_banner", "-i", "C:/temp/input.mp4",
    "-vf", "select='gt(scene,0.32)',showinfo",
    "-an", "-f", "null", "-",
  ]);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/sceneDetection.test.mjs`

Expected: FAIL because `server/sceneDetection.mjs` does not exist.

- [ ] **Step 3: Implement the pure detector helpers and injected process runner**

```js
import {promisify} from "node:util";
import {execFile} from "node:child_process";

const execFileAsync = promisify(execFile);

export const buildSceneDetectionArgs = (inputPath, threshold = 0.32) => [
  "-hide_banner", "-i", inputPath,
  "-vf", `select='gt(scene,${threshold})',showinfo`,
  "-an", "-f", "null", "-",
];

export const parseSceneTimestamps = (stderr = "") =>
  [...stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

export const normalizeSceneRanges = ({
  timestamps,
  durationSeconds,
  minimumDurationSeconds = 0.75,
}) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const boundaries = [...new Set([0, ...timestamps, durationSeconds]
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= durationSeconds))]
    .sort((a, b) => a - b);
  const ranges = boundaries.slice(0, -1).map((startSeconds, index) => ({
    startSeconds,
    endSeconds: boundaries[index + 1],
  })).filter((range) => range.endSeconds > range.startSeconds);

  return ranges.reduce((result, range) => {
    const duration = range.endSeconds - range.startSeconds;
    if (duration < minimumDurationSeconds && result.length > 0) {
      result[result.length - 1].endSeconds = range.endSeconds;
      return result;
    }
    result.push({...range});
    return result;
  }, []);
};

export const detectScenesInMedia = async ({
  inputPath,
  ffmpegPath,
  ffprobePath,
  execFileImpl = execFileAsync,
  threshold = 0.32,
  minimumDurationSeconds = 0.75,
}) => {
  const [{stdout: probeOutput}, {stderr}] = await Promise.all([
    execFileImpl(ffprobePath, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", inputPath]),
    execFileImpl(ffmpegPath, buildSceneDetectionArgs(inputPath, threshold)),
  ]);
  return normalizeSceneRanges({
    timestamps: parseSceneTimestamps(stderr),
    durationSeconds: Number(String(probeOutput).trim()),
    minimumDurationSeconds,
  });
};
```

- [ ] **Step 4: Add injected-runner tests and run GREEN**

Add tests that assert FFprobe/FFmpeg receive the expected executable paths and that the returned ranges use probe duration. Run: `node --test tests/sceneDetection.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit the detector core**

```bash
git add server/sceneDetection.mjs tests/sceneDetection.test.mjs
git commit -m "feat: detect visual scene ranges"
```

### Task 2: Local Scene Detection API

**Files:**
- Modify: `server/transcriptionServer.mjs`
- Modify: `tests/transcriptionLogic.test.mjs`

**Interfaces:**
- Consumes: `detectScenesInMedia(...)` from Task 1.
- Produces: `POST /api/detect-scenes` accepting multipart field `file` and returning `{scenes: SceneRange[]}`.

- [ ] **Step 1: Write failing API tests**

```js
test("POST /api/detect-scenes returns normalized local scene ranges", async (t) => {
  const calls = [];
  const server = await createTestServer({
    detectScenesInMediaImpl: async (options) => {
      calls.push(options);
      return [
        {startSeconds: 0, endSeconds: 2.5},
        {startSeconds: 2.5, endSeconds: 6},
      ];
    },
  });
  t.after(() => server.close());
  const form = new FormDataCtor();
  form.append("file", new BlobCtor(["video"], {type: "video/mp4"}), "sample.mp4");
  const response = await fetchImpl(`${server.url}/api/detect-scenes`, {method: "POST", body: form});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {scenes: [
    {startSeconds: 0, endSeconds: 2.5},
    {startSeconds: 2.5, endSeconds: 6},
  ]});
  assert.equal(calls.length, 1);
});

test("POST /api/detect-scenes rejects missing files", async (t) => {
  const server = await createTestServer({detectScenesInMediaImpl: async () => []});
  t.after(() => server.close());
  const response = await fetchImpl(`${server.url}/api/detect-scenes`, {method: "POST"});
  assert.equal(response.status, 400);
});
```

- [ ] **Step 2: Run API tests and verify RED**

Run: `node --test tests/transcriptionLogic.test.mjs --test-name-pattern="detect-scenes"`

Expected: FAIL with route status 404.

- [ ] **Step 3: Add the route with guaranteed temporary cleanup**

Import `detectScenesInMedia`, accept `detectScenesInMediaImpl` and `ffprobeBinaryPath` as `createTranscriptionApp` dependencies, write `req.file.buffer` to a unique temporary input path, call the detector, return `{scenes}`, and remove the temporary directory in `finally`. Use existing `cleanupTempDirectory`, `makeTempDirectory`, `writeFileImpl`, `ffmpegBinaryPath`, and `ffprobeStatic.path` patterns.

```js
app.post("/api/detect-scenes", upload.single("file"), async (req, res) => {
  if (!req.file) return sendError(res, 400, "missing_file", "No video file was uploaded.");
  if (!req.file.mimetype.startsWith("video/")) {
    return sendError(res, 400, "unsupported_media", "Scene detection requires a video file.");
  }
  let tempDirectory;
  try {
    tempDirectory = await makeTempDirectory(join(tmpdir(), "video-editor-scenes-"));
    const inputPath = toInputPath(tempDirectory, req.file.originalname);
    await writeFileImpl(inputPath, req.file.buffer);
    const scenes = await detectScenesInMediaImpl({
      inputPath,
      ffmpegPath: ffmpegBinaryPath,
      ffprobePath: ffprobeBinaryPath,
    });
    return res.json({scenes});
  } catch (error) {
    return sendError(res, 500, "scene_detection_failed", error instanceof Error ? error.message : "Scene detection failed.");
  } finally {
    if (tempDirectory) await removeDirectoryImpl(tempDirectory, cleanupOptions);
  }
});
```

- [ ] **Step 4: Verify success, validation, and cleanup tests**

Run: `node --test tests/transcriptionLogic.test.mjs --test-name-pattern="detect-scenes"`. Expected: PASS, including cleanup after success and detector failure.

- [ ] **Step 5: Commit the API**

```bash
git add server/transcriptionServer.mjs tests/transcriptionLogic.test.mjs
git commit -m "feat: expose local scene detection API"
```

### Task 3: Typed Client And Scene Media Helpers

**Files:**
- Create: `src/sceneDetectionClient.ts`
- Create: `tests/sceneDetectionClient.test.mts`
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `detectVideoScenes(file, fetchImpl?): Promise<SceneRange[]>`.
- Produces: `createSceneMediaItems({sourceFileId, label, src, ranges, fps}): SavedMediaItem[]`.
- Produces: `splitSceneMediaItemAtFrame({mediaItems, mediaId, relativeFrame}): SavedMediaItem[]`.
- Extends: `SavedMediaItem` with `sourceStart?: number`, `sourceFileId?: string`, and `sceneIndex?: number`.

- [ ] **Step 1: Write failing client validation tests**

```ts
test("posts a video and accepts contiguous scene ranges", async () => {
  const ranges = await detectVideoScenes(new File(["video"], "clip.mp4", {type: "video/mp4"}), async (_url, options) => {
    assert.equal(options?.method, "POST");
    return new Response(JSON.stringify({scenes: [{startSeconds: 0, endSeconds: 2}]}), {
      status: 200,
      headers: {"content-type": "application/json"},
    });
  });
  assert.deepEqual(ranges, [{startSeconds: 0, endSeconds: 2}]);
});

test("rejects malformed detector responses", async () => {
  await assert.rejects(() => detectVideoScenes(file, async () =>
    new Response(JSON.stringify({scenes: [{startSeconds: 3, endSeconds: 1}]}))), /invalid scene/i);
});
```

- [ ] **Step 2: Run client tests and verify RED**

Run: `node --test tests/sceneDetectionClient.test.mts`.

Expected: FAIL because `detectVideoScenes` does not exist.

- [ ] **Step 3: Implement the typed client**

```ts
export type SceneRange = {startSeconds: number; endSeconds: number};

export const detectVideoScenes = async (
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<SceneRange[]> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetchImpl("/api/detect-scenes", {method: "POST", body: formData});
  if (!response.ok) throw new Error("Scene detection failed.");
  const payload = await response.json() as {scenes?: SceneRange[]};
  if (!Array.isArray(payload.scenes) || payload.scenes.some((range) =>
    !Number.isFinite(range.startSeconds) || !Number.isFinite(range.endSeconds) ||
    range.startSeconds < 0 || range.endSeconds <= range.startSeconds)) {
    throw new Error("The scene detector returned invalid scene ranges.");
  }
  return payload.scenes;
};
```

- [ ] **Step 4: Write failing virtual scene and manual split tests**

```ts
test("creates virtual media cards sharing one source URL", () => {
  const items = createSceneMediaItems({
    sourceFileId: "source-1",
    label: "Interview.mp4",
    src: "uploads/interview.mp4",
    ranges: [{startSeconds: 0, endSeconds: 2}, {startSeconds: 2, endSeconds: 5}],
    fps: 30,
  });
  assert.deepEqual(items.map(({label, src, sourceStart, durationInFrames, sceneIndex}) =>
    ({label, src, sourceStart, durationInFrames, sceneIndex})), [
    {label: "Interview - Scene 1", src: "uploads/interview.mp4", sourceStart: 0, durationInFrames: 60, sceneIndex: 1},
    {label: "Interview - Scene 2", src: "uploads/interview.mp4", sourceStart: 60, durationInFrames: 90, sceneIndex: 2},
  ]);
});

test("manually splits only the selected scene at a relative preview frame", () => {
  const result = splitSceneMediaItemAtFrame({mediaItems: scenes, mediaId: "scene-1", relativeFrame: 30});
  assert.deepEqual(result.map(({sourceStart, durationInFrames}) => ({sourceStart, durationInFrames})), [
    {sourceStart: 0, durationInFrames: 30},
    {sourceStart: 30, durationInFrames: 30},
  ]);
});
```

- [ ] **Step 5: Implement scene card creation and splitting**

Add the three optional fields to `SavedMediaItem`. Implement deterministic scene IDs based on `sourceFileId` and range start, remove the source extension from labels, reject boundary splits, and renumber all cards from the same `sourceFileId` after a manual split.

- [ ] **Step 6: Run helper tests and commit**

Run: `node --test tests/editorLogic.test.mts tests/sceneDetectionClient.test.mts`. Expected: PASS.

```bash
git add src/sceneDetectionClient.ts src/editorLogic.ts tests/sceneDetectionClient.test.mts tests/editorLogic.test.mts
git commit -m "feat: model virtual scene media cards"
```

### Task 4: Import Analysis And Full-Card Replacement

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `detectVideoScenes` and `createSceneMediaItems` from Task 3.
- Produces: analyzing gallery state and scene cards replacing each imported full video.

- [ ] **Step 1: Write failing UI source tests**

```ts
test("analyzes imported videos and replaces the full card with scene cards", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
  assert.match(source, /detectVideoScenes\(file\)/);
  assert.match(source, /createSceneMediaItems\(/);
  assert.match(source, /Detecting scenes/);
  assert.match(source, /setMediaItems\(\(currentItems\) => \[\.\.\.sceneItems, \.\.\.currentItems\]\)/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node --test tests/playhead-ui.test.mts --test-name-pattern="scene cards"`.

Expected: FAIL because the scene import wiring is absent.

- [ ] **Step 3: Add analyzing state and independent multi-file handling**

Add:

```ts
type AnalyzingMediaItem = {id: string; label: string};
const [analyzingMediaItems, setAnalyzingMediaItems] = useState<AnalyzingMediaItem[]>([]);
```

For each selected video:
1. Create a stable `sourceFileId` and analyzing item.
2. Read browser duration and upload the source in parallel.
3. Call `detectVideoScenes(file)`.
4. Convert ranges with `createSceneMediaItems`.
5. On detector failure, create one range `{startSeconds: 0, endSeconds: durationInFrames / fps}` and set a non-blocking fallback status.
6. Remove the analyzing item in `finally`.
7. Insert only scene cards; never insert the original full-video card.

- [ ] **Step 4: Render analyzing cards and scene metadata**

Render `.media-thumb.is-analyzing` cards with a spinner and `Detecting scenes...`; render `Scene N` and formatted range duration on completed cards. Keep analyzing cards non-draggable and without delete controls.

- [ ] **Step 5: Run UI and existing import tests**

Run: `node --test tests/playhead-ui.test.mts tests/editorLogic.test.mts tests/viteMediaServing.test.mjs`. Expected: PASS.

- [ ] **Step 6: Commit import analysis**

```bash
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: replace imported videos with scene cards"
```

### Task 5: Scene-Range Preview And Manual Split

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `SavedMediaItem.sourceStart`, `durationInFrames`, and `splitSceneMediaItemAtFrame`.
- Produces: selected-scene looping preview and `Split scene` control.

- [ ] **Step 1: Write failing preview-loop tests**

```ts
test("seeks media preview to the scene start and loops at the scene end", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
  assert.match(source, /const mediaPreviewStartSeconds = \(selectedMedia\?\.sourceStart \?\? 0\) \/ fps/);
  assert.match(source, /const mediaPreviewEndSeconds = mediaPreviewStartSeconds \+ \(selectedMedia\?\.durationInFrames \?\? 0\) \/ fps/);
  assert.match(source, /currentTime >= mediaPreviewEndSeconds/);
  assert.match(source, /currentTime = mediaPreviewStartSeconds/);
  assert.match(source, /Split scene/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/playhead-ui.test.mts --test-name-pattern="scene start"`.

Expected: FAIL because media preview always seeks to zero and has no segment loop.

- [ ] **Step 3: Implement range-aware media preview**

Derive start/end seconds from the selected card. When the selected media ID changes, seek after `loadedmetadata` to the scene start. Add `onTimeUpdate` to the media-preview video; if playback reaches the scene end, seek back to the start and continue only when `isPreviewPlaying` is true. Update `togglePreviewPlayback` to restart from the scene start when current time is at or beyond the scene end.

- [ ] **Step 4: Add manual scene split at the preview playhead**

Track the relative scene preview frame from `(video.currentTime - mediaPreviewStartSeconds) * fps`. Show an icon button with `aria-label="Split scene"` only for selected video scene cards. Call `splitSceneMediaItemAtFrame`, preserve the first resulting card as selected, autosave, and report `Scene split`.

- [ ] **Step 5: Verify preview and split tests**

Run: `node --test tests/playhead-ui.test.mts tests/editorLogic.test.mts`. Expected: PASS.

- [ ] **Step 6: Commit preview behavior**

```bash
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts tests/editorLogic.test.mts
git commit -m "feat: preview and split detected scenes"
```

### Task 6: Preserve Scene Source Ranges On Timeline Placement

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Modify: `tests/editorLogic.test.mts`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Extends: `VideoMediaPairOptions` with `sourceStart?: number`.
- Ensures: video and linked audio clips receive the same `sourceStart`.

- [ ] **Step 1: Write the failing linked-pair test**

```ts
test("creates linked scene clips with matching source offsets", () => {
  const [video, audio] = createVideoMediaPair({
    videoId: "video", audioId: "audio", track: "main", label: "Scene 2",
    src: "uploads/interview.mp4", start: 120, duration: 90, sourceStart: 60,
  });
  assert.equal(video.sourceStart, 60);
  assert.equal(audio.sourceStart, 60);
  assert.equal(video.duration, 90);
  assert.equal(audio.duration, 90);
});
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `node --test tests/editorLogic.test.mts --test-name-pattern="source offsets"`.

Expected: FAIL because `VideoMediaPairOptions` does not copy `sourceStart`.

- [ ] **Step 3: Copy source offsets into both clips**

```ts
export type VideoMediaPairOptions = {
  videoId: string;
  audioId: string;
  track: "main" | "upper";
  label: string;
  src: string;
  start: number;
  duration: number;
  overlayLane?: number;
  sourceStart?: number;
};

// Include in both video and audio objects:
sourceStart: Math.max(0, options.sourceStart ?? 0),
```

- [ ] **Step 4: Pass the selected scene offset through all drag/drop paths**

In `createMediaTimelineClips`, pass `sourceStart: mediaItem.sourceStart ?? 0` into `createVideoMediaPair`. Confirm both direct layer placement and inserted signed-layer placement call this shared helper.

- [ ] **Step 5: Verify linked audio, layering, and Undo/Redo regressions**

Run: `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`. Expected: PASS.

- [ ] **Step 6: Commit timeline placement**

```bash
git add src/editorLogic.ts src/Composition.tsx tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "feat: preserve scene ranges on timeline"
```

### Task 7: End-To-End Verification And Usage Copy

**Files:**
- Modify: `src/Composition.tsx` only if verification reveals missing accessible labels or status copy.
- Modify: `tests/playhead-ui.test.mts` only for a verified missing behavior.

**Interfaces:**
- Verifies the complete import-to-timeline workflow.

- [ ] **Step 1: Run all focused automated tests**

```powershell
node --test tests/sceneDetection.test.mjs
node --test tests/sceneDetectionClient.test.mts
node --test tests/editorLogic.test.mts
node --test tests/playhead-ui.test.mts
node --test tests/viteMediaServing.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run static verification separately**

Run: `npx.cmd tsc --noEmit` and `npx.cmd eslint src server/sceneDetection.mjs tests/sceneDetection.test.mjs tests/sceneDetectionClient.test.mts`.

Expected: PASS. Report unrelated existing lint failures separately instead of changing unrelated files.

- [ ] **Step 3: Start both local services**

Run: `npm.cmd run web` from `C:\Users\shyna\OneDrive\Documents\Video Editing\video-editor`.

Expected: frontend at `http://127.0.0.1:5173/` and media API at `http://127.0.0.1:5174/`.

- [ ] **Step 4: Verify the browser workflow**

1. Click Import and choose a video containing at least two obvious cuts.
2. Confirm `Detecting scenes...` appears.
3. Confirm only scene cards appear after analysis; no full-video duplicate remains.
4. Click Scene 2 and confirm the preview starts at Scene 2 and loops before Scene 3.
5. Use Split scene at a non-boundary frame and confirm one card becomes two cards.
6. Drag one scene to Main and one scene to a signed layer.
7. Play the timeline and confirm each scene uses the correct source range and linked audio.
8. Refresh and confirm the scene cards and timeline clips persist.

- [ ] **Step 5: Commit any verification-only corrections**

If no corrections were needed, do not create an empty commit. If corrections were needed:

```bash
git add <only-the-corrected-files>
git commit -m "fix: polish scene import workflow"
```
