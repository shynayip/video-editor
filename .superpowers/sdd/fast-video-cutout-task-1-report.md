# Fast Auto Cutout Video Processor Report

## Implementation Details

- Kept image background removal on `onnx-community/BiRefNet_lite-ONNX` with `{dtype: "fp16"}`.
- Added a separate cached video pipeline for `Xenova/modnet` with `{dtype: "q4"}`.
- Switched video frame extraction to FFmpeg sampling at 10 fps with `-vf fps=10`.
- Switched transparent WebM encoding to a fixed 10 fps output and added `-t <durationSeconds>` to preserve the requested clip length.
- Preserved the existing processor interface, cancellation checks, progress callbacks, cleanup behavior, result shape, and no-audio output.

## Verification

### RED

Command:

```bash
node --test tests/backgroundRemoval.test.mjs
```

Result before implementation:

- The new fast-path test failed because the processor only loaded the BiRefNet image pipeline and did not create the separate MODNet video pipeline.

### GREEN

Command:

```bash
node --test tests/backgroundRemoval.test.mjs
```

Result after implementation:

- `5` tests passed, `0` failed.

Command:

```bash
npx.cmd tsc --noEmit
```

Result:

- Passed with exit code `0`.

## Concerns

- None at the moment. The video path no longer uses `getVideoFpsImpl`, but the public processor interface remains unchanged and the requested fast-path behavior is in place.

## Review Fix Pass

### RED

Command:

```bash
node --test tests/backgroundRemoval.test.mjs
```

Result before the fix:

- 8 tests ran, 4 failed.
- The new fractional-duration integration test failed because the encoded WebM was still shorter than the requested duration.
- The retry and encode-cancellation tests also failed on the first harness pass because the stub writers were not creating parent directories or matching the real extracted-frame paths.

### GREEN

Command:

```bash
node --test tests/backgroundRemoval.test.mjs
```

Result after the fix:

- 8 tests ran, 8 passed, 0 failed.

Command:

```bash
npx.cmd tsc --noEmit
```

Result:

- Passed with exit code `0`.

### Notes

- The video encode path now rounds up to the next 10 fps frame boundary, pads cloned frames before the final encode bound, and keeps the image cache isolated from a failed video pipeline initialization.
