# AI Image and Video Cutout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace color-key controls with one automatic foreground cutout that produces transparent image and video assets used by preview and export.

**Architecture:** A focused server module owns AI model loading, image segmentation, FFmpeg frame extraction, and transparent WebM encoding. The existing Express media API exposes one multipart endpoint; the React editor calls it, keeps the original clip unchanged until completion, and then swaps the selected cutout clip source while preserving timing, transform, linked audio, and identity.

**Tech Stack:** React 19, TypeScript, Express 5, Multer, FFmpeg, Transformers.js `background-removal`, Node test runner, Remotion.

## Global Constraints

- Remove Off, Green, White, and Black from the visible Cutout panel.
- Use one `Auto cutout` action for selected image and video cutout clips.
- Preserve the selected clip's id, start, duration, speed, transform, split boundaries, and linked audio.
- Store the transparent processed asset as the clip source so preview and export use the same result.
- Do not modify project state when processing fails or is cancelled.
- Keep Move, Erase, Restore, brush size, split, reset, undo, and redo.

---

## File Map

- Create `server/backgroundRemoval.mjs`: model singleton, image segmentation, video frame pipeline, transparent output encoding, and temporary-file cleanup.
- Modify `server/transcriptionServer.mjs`: dependency injection and `/api/remove-background` multipart endpoint.
- Modify `src/Composition.tsx`: Auto cutout request, cancellation guard, result application, and simplified controls.
- Modify `src/editorLogic.ts`: generalize automatic cutout result application from images to images/videos.
- Modify `src/index.css`: remove obsolete color-key control layout and style the single progress action.
- Modify `tests/transcriptionLogic.test.mjs`: endpoint and failure-path coverage.
- Modify `tests/editorLogic.test.mts`: identity/timing/audio preservation coverage.
- Modify `tests/playhead-ui.test.mts`: visible control and client request coverage.

### Task 1: Generalize cutout result application

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `applyAutomaticCutoutById(clips, clipId, processedSrc): TimelineClip[]` supporting both `cutout.mediaKind` values.

- [ ] **Step 1: Write a failing video result test**

Add a test that creates a video cutout/audio pair, applies `uploads/person-transparent.webm`, and asserts the cutout source changes while id, start, duration, transform, and linked audio object remain unchanged.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test --test-name-pattern="automatic video cutout" tests/editorLogic.test.mts`

Expected: FAIL because `applyAutomaticCutoutById` currently rejects non-image cutouts.

- [ ] **Step 3: Remove the image-only guard**

Update `applyAutomaticCutoutById` so it accepts any cutout clip with a source and writes:

```ts
return {
  ...clip,
  src: processedSrc,
  cutout: {
    ...clip.cutout,
    originalSrc: clip.cutout.originalSrc ?? clip.src,
    maskStrokes: [],
    chromaKey: "none",
  },
};
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `node --test --test-name-pattern="automatic.*cutout" tests/editorLogic.test.mts`

Expected: all matching tests PASS.

### Task 2: Add the local AI processor

**Files:**
- Create: `server/backgroundRemoval.mjs`
- Test: `tests/backgroundRemoval.test.mjs`

**Interfaces:**
- Produces: `createBackgroundRemovalProcessor(options)`.
- Produces: `processor.process({inputPath, mediaKind, startSeconds, durationSeconds, outputDirectory, onProgress, signal})` returning `{outputPath, extension, mimeType}`.
- Consumes injected `pipelineFactory`, `runFfmpeg`, and filesystem functions in tests.

- [ ] **Step 1: Write failing processor tests**

Cover model singleton reuse, still-image output, ordered frame processing, progress values from `0` through `100`, FFmpeg arguments containing `libvpx-vp9` and `yuva420p`, abort handling, and temporary directory cleanup on success/failure.

- [ ] **Step 2: Run processor tests and confirm RED**

Run: `node --test tests/backgroundRemoval.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement model-backed image processing**

Load one cached pipeline:

```js
pipeline("background-removal", "onnx-community/BiRefNet_lite-ONNX", {
  dtype: "q8",
});
```

Save the returned RGBA `RawImage` as PNG. Reuse the promise so repeated cutouts do not reload the model.

- [ ] **Step 4: Implement frame extraction and transparent encoding**

For video, extract the selected source range to numbered PNG frames, process each frame sequentially, then encode:

```text
-framerate <source fps> -i frame-%08d.png -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0
```

The output contains visuals only; linked audio remains managed by the editor.

- [ ] **Step 5: Verify processor tests GREEN**

Run: `node --test tests/backgroundRemoval.test.mjs`

Expected: all tests PASS without downloading a model because tests inject a fake pipeline.

### Task 3: Expose the processing endpoint

**Files:**
- Modify: `server/transcriptionServer.mjs`
- Test: `tests/transcriptionLogic.test.mjs`

**Interfaces:**
- Adds: `POST /api/remove-background` with multipart field `file` and fields `mediaKind`, `startSeconds`, and `durationSeconds`.
- Returns: `{src, mimeType}` where `src` begins with `uploads/`.

- [ ] **Step 1: Write failing route tests**

Test image and video success responses, missing upload, invalid media kind/range, processor failure, and confirmation that no response path is returned before the output file exists.

- [ ] **Step 2: Run route tests and confirm RED**

Run: `node --test --test-name-pattern="background removal" tests/transcriptionLogic.test.mjs`

Expected: 404 or missing route assertions.

- [ ] **Step 3: Add injected processor and route**

Extend `createTranscriptionApp` options with `backgroundRemovalProcessor`. Validate input, write the upload to a temporary source, call `process`, move the completed output into `public/uploads`, and respond only after `stat` confirms it exists.

- [ ] **Step 4: Add cleanup and error mapping**

Always remove request temporary files. Return `400 invalid_background_removal_request`, `499 background_removal_cancelled`, or `500 background_removal_failed` without changing existing endpoints.

- [ ] **Step 5: Verify route tests GREEN**

Run: `node --test --test-name-pattern="background removal" tests/transcriptionLogic.test.mjs`

Expected: all matching tests PASS.

### Task 4: Replace the Cutout controls and connect the client

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Adds: `processSelectedCutoutAutomatically(): Promise<void>`.
- Consumes: `POST /api/remove-background`.
- Removes visible calls to `setSelectedCutoutChromaKey`.

- [ ] **Step 1: Write failing UI source tests**

Assert one button named `Auto cutout`, acceptance of image/video selections, request fields for media kind and source range, loading/cancellation guards, and absence of visible Green/White/Black/Off buttons.

- [ ] **Step 2: Run focused UI tests and confirm RED**

Run: `node --test --test-name-pattern="Auto cutout" tests/playhead-ui.test.mts`

Expected: FAIL because the existing button is image-only and color buttons remain.

- [ ] **Step 3: Implement request and safe result commit**

Fetch the selected original source as a blob, post it with metadata, and apply the returned source only when the request token still matches the selected clip. Use `applyAutomaticCutoutById` through `commitClipChange` so undo restores the previous source.

- [ ] **Step 4: Simplify the panel**

Render one full-width button:

```tsx
<button
  type="button"
  className="secondary-action-button auto-cutout-button"
  onClick={() => void processSelectedCutoutAutomatically()}
  disabled={!selectedCutoutClip || isAutoCutoutLoading}
>
  {isAutoCutoutLoading ? cutoutProgressLabel : "Auto cutout"}
</button>
```

Remove the four color-key buttons. Retain manual tools and editing history.

- [ ] **Step 5: Verify UI tests GREEN**

Run: `node --test --test-name-pattern="cutout" tests/playhead-ui.test.mts`

Expected: all matching tests PASS.

### Task 5: Integration and regression verification

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run complete tests**

Run: `node --test tests/*.test.mjs tests/*.test.mts`

Expected: all tests PASS.

- [ ] **Step 2: Run static checks**

Run: `npx.cmd tsc --noEmit && npx.cmd eslint src server tests`

Expected: exit code 0.

- [ ] **Step 3: Verify the live editor**

At `http://localhost:5173/`, import a short person video as a cutout, select it, click Auto cutout, verify the room becomes transparent, linked audio remains, undo/redo restores/reapplies it, and the Cutout panel contains no color-key choices.

- [ ] **Step 4: Verify export input**

Save the project and inspect the export request payload to confirm the selected cutout source is the generated `uploads/*.webm` path rather than the original source.

## Self-Review

- Spec coverage: UI simplification, image/video processing, preservation, export consistency, cancellation, errors, cleanup, and tests are covered.
- Placeholder scan: no TBD/TODO steps remain.
- Type consistency: the processor result and route response both use `src` and `mimeType`; the editor applies `src` through the existing logic helper.
