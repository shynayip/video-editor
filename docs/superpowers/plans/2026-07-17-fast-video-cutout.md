# Fast Video Cutout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Auto cutout usable for presenter videos without changing clip timing or linked audio.

**Architecture:** Keep the existing background-removal API and editor request flow. Split the server processor's cached model by media kind: BiRefNet Lite for images and quantized MODNet for videos, with video extraction capped at 10 fps before transparent WebM encoding.

**Tech Stack:** Node.js, Transformers.js, FFmpeg, Remotion editor, Node test runner, TypeScript.

## Global Constraints

- Keep image cutout behavior unchanged.
- Use `Xenova/modnet` with `dtype: "q4"` for videos.
- Process video frames at 10 fps while preserving full clip duration.
- Do not alter or regenerate linked audio.

---

### Task 1: Fast video background-removal processor

**Files:**
- Modify: `server/backgroundRemoval.mjs`
- Test: `tests/backgroundRemoval.test.mjs`

**Interfaces:**
- Consumes: `createBackgroundRemovalProcessor({pipelineFactory, runFfmpeg, ...})`
- Produces: unchanged `process({inputPath, mediaKind, startSeconds, durationSeconds, outputDirectory, signal})` result.

- [ ] **Step 1: Write failing processor tests**

Assert that image and video jobs create separate cached pipelines, video uses `Xenova/modnet` with `{dtype: "q4"}`, extraction includes `-vf fps=10`, and output encoding uses `-framerate 10` plus `-t <duration>`.

- [ ] **Step 2: Verify the tests fail for the missing fast path**

Run: `node --test tests/backgroundRemoval.test.mjs`

Expected: failures showing the current BiRefNet model and source FPS arguments.

- [ ] **Step 3: Implement the minimal processor change**

Create one cached pipeline per media kind. Retain BiRefNet Lite fp16 for images; load MODNet q4 for videos. Extract at 10 fps and encode at 10 fps with the requested duration.

- [ ] **Step 4: Verify focused and full tests**

Run: `node --test tests/backgroundRemoval.test.mjs tests/cutoutRequest.test.mts tests/editorLogic.test.mts tests/playhead-ui.test.mts tests/transcriptionLogic.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Verify TypeScript and changed-file formatting**

Run: `npx.cmd tsc --noEmit`

Run: `git diff --check -- video-editor/server/backgroundRemoval.mjs video-editor/tests/backgroundRemoval.test.mjs`

Expected: both commands exit successfully.
