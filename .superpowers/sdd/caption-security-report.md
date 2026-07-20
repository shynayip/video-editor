# Caption Security Final Report

Date: 2026-07-15

## Summary

- Vite and the Express caption API now bind to `127.0.0.1`.
- `/api/transcribe` rejects non-local `Host` values and browser `Origin` values outside `http://localhost:5173` and `http://127.0.0.1:5173` with structured 403 errors.
- Auto captions send `sourceStart` and visible source `duration` only; ffmpeg extracts that range with `-ss` and `-t` before the OpenAI request.
- Returned transcription timestamps remain relative to the extracted range, and the UI maps them exactly once onto the selected clip timeline.
- Frontend and backend cancellation now use `AbortController`/`AbortSignal`, cancel in-flight media/API/OpenAI/ffmpeg work, clear loading promptly, suppress abort errors, and preserve temp cleanup.

## Verification

- `node --test tests/transcriptionLogic.test.mjs`
- `node --experimental-strip-types --test tests/caption-ui.test.mts`
- `node --experimental-strip-types --test tests/captionFileParser.test.mts`
- `node --experimental-strip-types --test tests/captionTiming.test.mts`
- `node --experimental-strip-types --test tests/editorLogic.test.mts`
- `npm.cmd run lint`
- `npm.cmd run build`

Notes: PowerShell blocked `npm run lint` through `npm.ps1`, so verification used `npm.cmd`. Build output was restored afterward to preserve pre-existing dirty build artifacts.
