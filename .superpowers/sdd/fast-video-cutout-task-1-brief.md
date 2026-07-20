# Task 1: Fast video background-removal processor

## Context

The current Auto cutout video processor uses BiRefNet Lite fp16 on every source frame. Two real 0.5-second API benchmarks each took about 192 seconds. The approved fast local path must preserve the existing API and editor behavior.

## Binding Requirements

- Modify only `server/backgroundRemoval.mjs` and `tests/backgroundRemoval.test.mjs`.
- Follow TDD: add focused tests and observe the correct failures before editing production code.
- Keep image jobs on `onnx-community/BiRefNet_lite-ONNX` with `{dtype: "fp16"}`.
- Use a separately cached video pipeline with model `Xenova/modnet` and `{dtype: "q4"}`.
- Extract video frames at 10 fps using FFmpeg.
- Encode the transparent WebM at 10 fps and explicitly preserve the requested full duration.
- Keep `yuva420p`, `libvpx-vp9`, `-auto-alt-ref 0`, and no output audio.
- Preserve cancellation, progress callbacks, cleanup, result shape, and public `createBackgroundRemovalProcessor` interface.
- Do not modify linked audio or editor code.

## Required Verification

1. `node --test tests/backgroundRemoval.test.mjs`
2. Report the RED failure before implementation and the GREEN result afterward.
3. `npx.cmd tsc --noEmit`
4. Do not commit because this is a shared dirty worktree. Do not revert any existing changes.

## Report

Write implementation details, exact commands/results, and concerns to `.superpowers/sdd/fast-video-cutout-task-1-report.md`. Return status `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`.
