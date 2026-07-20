# Manual and Automatic Captions Design

## Goal

Make the **Captions** tab functional with two clear workflows:

1. Add a caption manually at the red playhead.
2. Generate timed captions automatically from the selected video clip using the OpenAI transcription API.

Captions must remain separate from ordinary text overlays so each feature has its own conditional timeline track.

## Scope

This version includes:

- Manual caption creation at the current playhead position.
- Automatic caption generation for a selected main-track or overlay video clip.
- Caption editing through the existing selection, split, trim, delete, and undo/redo behavior.
- Basic caption styling: font size, text color, background visibility, and background color.
- Caption rendering near the bottom center of the preview.
- A Caption track that appears only when at least one caption exists.
- A Text track that appears only when at least one ordinary text overlay exists.

This version does not include subtitle-file import, translation, speaker identification, or word-by-word animation.

## Data Model

The existing track model currently uses `caption` for ordinary text overlays. That coupling will be removed:

- Add `text` to `TrackName`.
- Change `createTextClip` and existing text-overlay rendering to use `track: "text"`.
- Reserve `track: "caption"` exclusively for subtitles and captions.
- Keep both Text and Caption rows conditional so empty tracks are not displayed.

Caption clips will store the same shared timing properties as other clips and caption-specific presentation data:

- `text`
- `start`
- `duration`
- `fontSize`
- `textColor`
- `backgroundEnabled`
- `backgroundColor`
- optional `sourceClipId` for automatically generated captions
- optional `generationId` to identify one generated caption batch

## Manual Caption Flow

Selecting **Captions** opens a panel with a caption text field, style controls, and an **Add caption** command.

When the user adds a caption:

- Empty text is rejected.
- The caption starts at the current red playhead position.
- Its default duration is 90 frames, limited by the composition boundary.
- It receives the current caption style settings.
- It is selected after creation so its duration can be trimmed immediately.
- The operation is added to editor history so Undo restores the prior state.

## Automatic Caption Flow

The automatic section contains a **Generate captions** command and explains which selected video will be transcribed.

The flow is:

1. The user selects a main-track or overlay video clip.
2. The frontend sends that clip's media to a local `/api/transcribe` endpoint.
3. The backend extracts an audio-only temporary file with FFmpeg because the transcription endpoint accepts audio input rather than video input.
4. The backend sends the audio to OpenAI's audio transcription endpoint using an OpenAI speech-to-text model that returns reliable segment timestamps.
5. Validated transcript segments are returned to the frontend.
6. Segment seconds are converted to composition frames using the composition FPS and offset by the selected clip's timeline start.
7. One caption clip is created for each segment and the complete batch is stored as one undoable editor operation.

If captions were already generated for the same source clip, the UI asks whether to replace that generated batch. Manual captions and captions generated for other clips are not removed.

## Backend and API-Key Safety

The OpenAI API key must never be included in browser code.

- Add a small local Node backend for `/api/transcribe`.
- Read `OPENAI_API_KEY` from `.env`.
- Add a documented placeholder to `.env.example`.
- Ensure `.env` remains ignored by Git.
- Proxy `/api` from the Vite development server to the local backend.
- Delete temporary media and audio files in a `finally` cleanup path.
- Validate media type, transcript response shape, and timestamp order before returning data.
- Do not change the timeline unless the full response validates successfully.

The development command should start both the Vite frontend and transcription backend so the user still opens the editor at `http://localhost:5173/`.

## Loading and Error States

Automatic generation reports meaningful progress:

- Preparing media
- Extracting audio
- Transcribing
- Adding captions

The panel shows a clear, recoverable error for:

- No selected video clip
- Missing `OPENAI_API_KEY`
- Media loading failure
- FFmpeg unavailable or extraction failure
- OpenAI request failure
- Empty speech result
- Invalid or missing timestamps

Existing captions remain unchanged after any failed generation attempt.

## Preview and Timeline Behavior

- Active captions render bottom-center within a safe margin from the preview edge.
- Multiple captions that overlap at the playhead are stacked without covering one another.
- Caption styles update immediately in the preview.
- Caption clips use a distinct timeline color from Text, Main, Overlay, and Audio clips.
- Selecting a caption exposes the same trim handles used by other clips.
- Splitting affects only the selected caption clip; video, overlay, text, and audio tracks remain unchanged.

## Testing

Pure editor-logic tests will cover:

- Manual caption creation at the playhead.
- Segment-second to frame conversion.
- Correct source-clip timeline offset.
- Caption and Text track separation.
- Generated-batch replacement without deleting manual captions.
- Invalid timestamps causing no mutation.
- Undo restoring the previous caption set.

Backend tests will mock FFmpeg and the OpenAI request to cover success, cleanup, missing-key, API-error, and invalid-response paths without making a real paid API call.

UI verification will cover:

- Opening the Captions panel.
- Adding and previewing a manual caption.
- Conditional Caption and Text timeline rows.
- Automatic-generation progress and errors.
- Selecting, trimming, splitting, deleting, and undoing a caption.
- Existing video, overlay, sticker, text, and audio behavior remaining intact.

## Acceptance Criteria

- The Captions tab is interactive and no longer empty.
- A user can manually add a caption at the red playhead.
- A user can generate timed captions from the selected video with an OpenAI API key configured locally.
- The API key is never exposed to the browser bundle.
- Text overlays and captions use separate conditional tracks.
- Captions display in the preview at the correct times.
- Caption clips can be selected, split, trimmed, deleted, and restored with Undo.
- Failed transcription does not damage or partially change the timeline.
