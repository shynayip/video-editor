# Subject-Aware Auto Cutout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Auto cutout retain one central person or product in images and videos, produce smooth transparent media, and preserve the complete selected duration and linked audio.

**Architecture:** Add a pure mask-processing module for connected-component selection, confidence scoring, temporal continuity, alpha interpolation, and RGBA composition. Add a model-routing module that caches MODNet and BiRefNet independently and falls back from an uncertain portrait mask to the general model. Keep the existing API and Remotion editor request flow, but rebuild video output at 30 fps from 10 fps AI mask keyframes and encode the exact padded frame sequence without a truncating `-t` bound.

**Tech Stack:** Node.js, Transformers.js `RawImage`, FFmpeg/FFprobe, React, Remotion, TypeScript, Node test runner.

## Global Constraints

- Keep one primary person or product and remove secondary foreground regions.
- Prefer foreground size, frame-center proximity, and temporal continuity when choosing the primary subject.
- Preserve manual erase, restore, reset, split, trim, cancellation, and stale-request behavior.
- Preserve timeline position, source offsets, speed, transform, volume, and linked-audio identity.
- Transparent processed videos remain silent because linked audio is owned by the editor.
- Do not add a paid service or require a cloud API key.
- Do not modify unrelated dirty workspace files.

---

## File Structure

- Create `server/subjectMask.mjs`: pure alpha-mask selection, scoring, interpolation, and RGBA composition.
- Create `tests/subjectMask.test.mjs`: deterministic synthetic-mask coverage.
- Create `server/subjectCutoutEngine.mjs`: model loading, cache retry, portrait confidence routing, and general-model fallback.
- Create `tests/subjectCutoutEngine.test.mjs`: mocked model routing and retry coverage.
- Modify `server/backgroundRemoval.mjs`: image/video orchestration, 30 fps frame reconstruction, exact duration encoding, cancellation, and cleanup.
- Modify `tests/backgroundRemoval.test.mjs`: processor integration and duration regressions.
- Modify `tests/transcriptionLogic.test.mjs`: API error propagation and unchanged media response contract.
- Modify `tests/playhead-ui.test.mts`: ensure editor state and linked audio stay unchanged when Auto cutout succeeds or fails.

---

### Task 1: Primary-subject mask selection

**Files:**
- Create: `server/subjectMask.mjs`
- Create: `tests/subjectMask.test.mjs`

**Interfaces:**
- Produces: `selectPrimaryAlpha({alpha, width, height, previousSubject}) -> {alpha, subject, confidence}`.
- Produces: `interpolateAlpha(left, right, progress) -> Uint8ClampedArray`.
- Produces: `composeRgbaWithAlpha(image, alpha, RawImageCtor) -> RawImage`.
- `subject` shape: `{centroidX, centroidY, area, bounds: {left, top, right, bottom}}`, with normalized centroids.

- [ ] **Step 1: Write failing connected-component tests**

Create synthetic alpha planes and assert that a large central component beats smaller edge components, a previous overlapping subject beats a similarly sized newcomer, and all non-selected pixels become zero.

```js
const result = selectPrimaryAlpha({alpha, width: 8, height: 6});
assert.equal(result.alpha[indexOfCentralSubject], 255);
assert.equal(result.alpha[indexOfEdgeDecoration], 0);
assert.equal(result.subject.centroidX > 0.35 && result.subject.centroidX < 0.65, true);
```

- [ ] **Step 2: Write failing alpha utility tests**

Assert linear interpolation (`0` to `200` at `0.25` becomes `50`) and that RGBA composition preserves RGB while replacing only alpha.

- [ ] **Step 3: Run the new tests and confirm RED**

Run: `node --test tests/subjectMask.test.mjs`

Expected: FAIL because `server/subjectMask.mjs` does not exist.

- [ ] **Step 4: Implement component labeling and scoring**

Use an iterative 8-neighbor flood fill over pixels whose alpha is at least `24`. Score each component as:

```js
const score = areaRatio * 0.55 + centerScore * 0.30 + continuityScore * 0.15;
```

Set non-selected alpha to zero, retain original soft alpha inside the selected component, include neighboring soft-edge pixels connected to it, and apply one 3-by-3 alpha blur pass only to pixels within two pixels of the selected boundary.

- [ ] **Step 5: Implement confidence, interpolation, and composition**

Confidence is accepted only when foreground coverage is between `0.015` and `0.90`, the selected component owns at least `65%` of nonzero foreground, and its normalized centroid lies within `0.42` of frame center. Construct output with `new RawImageCtor(rgba, width, height, 4)`.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `node --test tests/subjectMask.test.mjs`

Expected: all subject-mask tests pass.

- [ ] **Step 7: Commit**

```powershell
git add video-editor/server/subjectMask.mjs video-editor/tests/subjectMask.test.mjs
git commit -m "feat: select primary cutout subject"
```

---

### Task 2: Person/product model routing

**Files:**
- Create: `server/subjectCutoutEngine.mjs`
- Create: `tests/subjectCutoutEngine.test.mjs`

**Interfaces:**
- Consumes: `selectPrimaryAlpha` and `composeRgbaWithAlpha` from Task 1.
- Produces: `createSubjectCutoutEngine({pipelineFactory, loadImageImpl, RawImageCtor})`.
- Engine method: `process(inputPath, {mode, previousSubject, signal}) -> {image, alpha, subject, route}`.
- `mode` is `"image"`, `"video-first"`, or `"video-next"`; `route` is `"portrait"` or `"general"`.

- [ ] **Step 1: Write failing routing tests**

Mock portrait and general pipelines. Assert:

```js
assert.equal((await engine.process("person.png", {mode: "video-first"})).route, "portrait");
assert.equal((await engine.process("product.png", {mode: "video-first"})).route, "general");
assert.equal((await engine.process("photo.png", {mode: "image"})).route, "general");
```

The product fixture returns an empty or low-confidence MODNet matte and a confident BiRefNet matte.

- [ ] **Step 2: Write failing cache and retry tests**

Assert one promise per route, a rejected initialization is evicted only for that route, and a failed portrait cache does not evict a loaded general pipeline.

- [ ] **Step 3: Run tests and confirm RED**

Run: `node --test tests/subjectCutoutEngine.test.mjs`

Expected: FAIL because the engine module does not exist.

- [ ] **Step 4: Implement model adapters**

Use these model definitions:

```js
const models = {
  portrait: {task: "background-removal", id: "Xenova/modnet", options: {dtype: "q4"}},
  general: {task: "background-removal", id: "onnx-community/BiRefNet_lite-ONNX", options: {dtype: "fp16"}},
};
```

If general initialization or first inference reports an unsupported fp16 provider, retry that route once with no `dtype` option. Do not retry cancellation errors.

- [ ] **Step 5: Implement routing**

Images always use `general`. The first video keyframe tries `portrait`; if `selectPrimaryAlpha().confidence` is false, retry the same frame with `general`. Subsequent frames reuse the selected route and previous subject; an uncertain portrait frame falls back to `general` for that frame.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `node --test tests/subjectCutoutEngine.test.mjs tests/subjectMask.test.mjs`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add video-editor/server/subjectCutoutEngine.mjs video-editor/tests/subjectCutoutEngine.test.mjs
git commit -m "feat: route person and product cutouts"
```

---

### Task 3: Smooth transparent video and exact duration

**Files:**
- Modify: `server/backgroundRemoval.mjs`
- Modify: `tests/backgroundRemoval.test.mjs`

**Interfaces:**
- Consumes: `createSubjectCutoutEngine`, `interpolateAlpha`, and `composeRgbaWithAlpha`.
- Preserves: `createBackgroundRemovalProcessor({...}).process({...})` and result `{outputPath, extension, mimeType}`.

- [ ] **Step 1: Preserve the existing failing duration regression**

Keep `pads the encoded video so it is never shorter than the requested duration` and add an assertion that a `0.83` second request yields `ceil(0.83 * 30) / 30` within FFprobe tolerance.

- [ ] **Step 2: Add failing smooth-frame orchestration tests**

Assert video extraction uses `fps=30`, AI segmentation runs only on frames `1, 4, 7, ...`, intermediate alpha planes are interpolated, every extracted RGB frame is written once, and the output encode command has `-framerate 30` with no output `-t`.

- [ ] **Step 3: Run processor tests and confirm RED**

Run: `node --test tests/backgroundRemoval.test.mjs`

Expected: the existing duration test and new orchestration tests fail.

- [ ] **Step 4: Inject the subject engine and RawImage operations**

Replace direct `pipelineFactory` use with an injectable `subjectEngine` defaulting to `createSubjectCutoutEngine`. Retain existing filesystem and FFmpeg dependency injection so cancellation and cleanup tests remain deterministic.

- [ ] **Step 5: Rebuild video at 30 fps**

Extract `ceil(durationSeconds * 30)` source PNGs at 30 fps. Run the engine on every third source frame, interpolate alpha for the two frames between neighboring keyframes, read each original source frame, compose its original RGB with interpolated alpha, and save sequential transparent PNGs.

- [ ] **Step 6: Encode without truncating the last frame**

Use:

```js
[
  "-y", "-framerate", "30",
  "-i", processedPattern,
  "-frames:v", String(targetFrameCount),
  "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
  "-auto-alt-ref", "0", "-an", temporaryOutputPath,
]
```

Do not pass output `-t`. Pad a missing final source frame by copying the last available source frame before alpha composition.

- [ ] **Step 7: Run processor tests and confirm GREEN**

Run: `node --test tests/backgroundRemoval.test.mjs tests/subjectCutoutEngine.test.mjs tests/subjectMask.test.mjs`

Expected: all tests pass, including FFprobe duration bounds.

- [ ] **Step 8: Commit**

```powershell
git add video-editor/server/backgroundRemoval.mjs video-editor/tests/backgroundRemoval.test.mjs
git commit -m "fix: preserve smooth cutout video duration"
```

---

### Task 4: API and Remotion editor contract

**Files:**
- Modify: `tests/transcriptionLogic.test.mjs`
- Modify: `tests/playhead-ui.test.mts`
- Modify only if a test exposes a contract defect: `server/transcriptionServer.mjs`, `src/Composition.tsx`

**Interfaces:**
- Preserves: `POST /api/remove-background` fields `file`, `mediaKind`, `sourceStart`, and `duration`.
- Preserves: success JSON `{src, mimeType}` and error JSON `{error: {code, message}}`.
- Preserves: `applyAutomaticCutoutById` replacement of only the selected cutout source.

- [ ] **Step 1: Add API failure-message coverage**

Make a processor throw `General cutout model failed to initialize.` and assert status `500`, code `background_removal_failed`, and that exact actionable message.

- [ ] **Step 2: Add editor contract coverage**

Assert the request still sends the effective original source range after split or trim and that success does not replace, delete, or regenerate reciprocal linked audio.

- [ ] **Step 3: Run tests and inspect RED or GREEN**

Run: `node --test tests/transcriptionLogic.test.mjs tests/cutoutRequest.test.mts tests/editorLogic.test.mts tests/playhead-ui.test.mts`

Expected: existing contract tests pass; any new failure identifies the smallest required server or editor correction.

- [ ] **Step 4: Make only contract-required corrections**

Keep the current cancellation token and stale-selection checks. If needed, map processor errors without replacing their message and leave `commitClipChange` scoped to `applyAutomaticCutoutById(currentClips, clipId, payload.src)`.

- [ ] **Step 5: Re-run tests and confirm GREEN**

Run the command from Step 3.

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add video-editor/tests/transcriptionLogic.test.mjs video-editor/tests/playhead-ui.test.mts video-editor/server/transcriptionServer.mjs video-editor/src/Composition.tsx
git commit -m "test: protect automatic cutout editor contract"
```

Stage only files actually changed in this task.

---

### Task 5: End-to-end verification

**Files:**
- Verify all files changed in Tasks 1 through 4.
- Add a generated fixture only if needed under `tests/fixtures/cutout/`; do not commit user media.

**Interfaces:**
- Produces no new public interface.

- [ ] **Step 1: Run the complete relevant test suite**

```powershell
node --test tests/subjectMask.test.mjs tests/subjectCutoutEngine.test.mjs tests/backgroundRemoval.test.mjs tests/cutoutRequest.test.mts tests/editorLogic.test.mts tests/playhead-ui.test.mts tests/transcriptionLogic.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript and formatting checks**

```powershell
npx.cmd tsc --noEmit
git diff --check -- video-editor/server/subjectMask.mjs video-editor/server/subjectCutoutEngine.mjs video-editor/server/backgroundRemoval.mjs video-editor/tests/subjectMask.test.mjs video-editor/tests/subjectCutoutEngine.test.mjs video-editor/tests/backgroundRemoval.test.mjs video-editor/tests/transcriptionLogic.test.mjs video-editor/tests/playhead-ui.test.mts
```

Expected: both commands exit successfully.

- [ ] **Step 3: Run one local image and video smoke test**

Start `npm.cmd run dev:caption`, import a representative person or product image and a short video, then verify one central subject remains, secondary objects are removed, video motion and final frames continue, linked audio is unchanged, and reset restores the original source.

- [ ] **Step 4: Review the final diff for scope**

Run: `git status --short` and `git diff --stat HEAD~4..HEAD`.

Expected: only Auto cutout implementation, tests, and docs are included; pre-existing user changes remain untouched.

- [ ] **Step 5: Commit any fixture-only verification change**

Only if Step 3 required a generated fixture:

```powershell
git add video-editor/tests/fixtures/cutout
git commit -m "test: add automatic cutout fixture"
```

Otherwise, do not create an empty verification commit.
