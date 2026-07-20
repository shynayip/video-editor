# Transcript Cleanup Design

## Goal

Add CapCut-style transcript editing that converts spoken video audio into timestamped text, identifies cleanup opportunities, and lets users cut corresponding main-video dialogue by editing the transcript.

## Toolbar And Panel

- Add `Transcript` to the top editing toolbar beside `Captions`.
- Activating Transcript opens a dedicated panel for the selected main-track clip.
- Before processing, the panel shows the selected clip and a `Generate transcript` command.
- During processing, the panel shows progress and prevents duplicate requests.
- After processing, the panel lists timestamped words and detected cleanup suggestions.

## Transcription Backend

- Add a local server endpoint that accepts the selected media file and sends its audio to OpenAI speech-to-text.
- The OpenAI API key is read only from a server environment variable and is never included in browser code.
- The response contains transcript text plus word or segment timestamps.
- The browser converts timestamps into source and timeline frames for the selected clip.
- Missing API configuration, unsupported media, network errors, and speech-free media produce clear recoverable errors.

## Cleanup Review

- Detect and highlight filler words such as `um`, `uh`, and repeated short phrases.
- Detect long silent gaps from timestamp spacing.
- Suggestions are selected for removal by the user; cleanup does not silently modify the timeline.
- Users can preview or deselect suggestions before applying them.
- Transcript wording can be corrected manually without changing media timing.

## Timeline Editing

- Applying cleanup removes the selected transcript time ranges from the corresponding main video and its linked original audio.
- Later main clips ripple left to close removed gaps.
- Separate overlay clips, music, microphone narration, and text clips retain their own timing and content.
- Removed ranges are normalized and merged before applying cuts so overlapping suggestions cannot create duplicate cuts.
- Transcript cleanup is one history operation, allowing Undo and Redo to restore both transcript and timeline state.

## Transcript Data

Store transcript state separately from `TimelineClip`:

- source media or clip identifier,
- full editable text,
- timestamped words or segments,
- cleanup category and selected state,
- processing and error state.

Timeline clips remain the source of truth for media placement and duration.

## Safety And Limits

- Only an explicitly selected main clip can be transcribed or cleaned.
- Cleanup is disabled when no timestamped transcript exists.
- All generated ranges are clamped to the selected clip boundaries.
- API keys and server error details are not exposed in the interface.

## Testing

- Unit tests cover filler detection, silence detection, overlapping-range normalization, and timestamp-to-frame conversion.
- Timeline tests verify that cleanup cuts main video and linked audio equally and ripples later main clips.
- Tests verify overlays, narration, music, and text clips remain unchanged.
- API tests cover success, missing key, invalid media, and provider failure.
- Browser verification covers generating a transcript, reviewing suggestions, applying cleanup, and undoing the edit.
