# Local Audio Cleanup Design

## Goal

Replace the Transcript panel's paid OpenAI dependency with a local workflow that detects silence, repeated speech, filler words, and weak vocabulary. Users review every suggestion before applying changes.

## Scope

The feature analyzes one selected main or overlay video clip at a time. It supports:

- Local silence detection.
- Local speech transcription with a lightweight Whisper model.
- Detection of repeated adjacent words and repeated short phrases.
- Detection of configurable filler and weak-vocabulary expressions.
- Rule-based replacement suggestions for weak vocabulary.
- User approval for each suggestion.
- Timeline cleanup that keeps linked video and audio synchronized.
- Undo through the editor's existing timeline history.

Context-aware sentence rewriting, cloud transcription, and automatic cleanup without review are outside this version.

## Architecture

### Local Analysis Server

The existing loopback-only transcription server remains the boundary for media processing. It will stop calling the OpenAI API for this workflow and instead coordinate:

1. FFmpeg audio extraction for the selected visible source range.
2. FFmpeg silence detection with timestamped start and end ranges.
3. A local Whisper executable and a multilingual lightweight model for timestamped speech recognition.
4. Deterministic cleanup analysis over the recognized words.

The first analysis downloads the configured model, approximately 150 MB, into an ignored local model directory. Download state is reported to the client. Later analyses reuse the cached model.

### Cleanup Analyzer

The analyzer converts Whisper output and silence ranges into normalized suggestions. Every suggestion has a stable identifier, type, source-time range, original text, reason, default selected state, and optional replacement text.

Suggestion types are:

- `silence`: a quiet range long enough to remove without making speech sound abrupt.
- `filler`: configured terms such as "um", "uh", "like", "you know", and "basically".
- `repetition`: adjacent duplicate words or repeated phrases of up to three words.
- `vocabulary`: configured weak expressions with rule-based stronger alternatives.

Overlapping removal suggestions are merged before applying timeline edits. Vocabulary suggestions change transcript or caption wording only and never remove media.

### Timeline Integration

Approved silence, filler, and repetition ranges are converted from source time to timeline frames using the selected clip's source offset and speed. The editor cuts only the selected video and its reciprocal linked audio. Unrelated main, overlay, narration, text, sticker, and caption clips remain unchanged.

The entire cleanup is committed as one timeline-history edit so a single Undo restores the original clips. No-op cleanup does not create history.

## Interface

The Transcript panel provides:

- The selected source clip name.
- An **Analyze locally** command.
- First-run model download progress.
- Analysis progress and recoverable error messages.
- Filtered suggestion groups for Silence, Repeated speech, Filler words, and Vocabulary.
- A checkbox for each suggestion.
- Editable replacement text for vocabulary suggestions.
- **Apply cleanup** and **Undo** commands.

The user can seek the playhead to a suggestion and preview the surrounding media before approving it. Applying cleanup is disabled while analysis is running, when no suggestion is selected, or when the selected source clip no longer matches the analyzed media and timing.

## Data Safety And Errors

Media remains on the local computer. The server binds only to `127.0.0.1`, validates local origins, limits uploads, uses unique temporary directories, and removes temporary files on success, failure, or cancellation.

The cached model is the only persistent analysis asset. If the download is interrupted, the partial file is discarded and the user can retry. Missing FFmpeg, model startup failures, unsupported media, malformed timestamps, and stale clip selections produce clear errors without changing the timeline.

## Testing

Automated coverage will verify:

- Silence range normalization and minimum-duration behavior.
- Filler, repetition, and vocabulary suggestion detection.
- Overlap merging and source-time to timeline-frame conversion.
- Speed-adjusted and trimmed clips.
- Reciprocal linked audio/video cleanup while preserving unrelated tracks.
- Vocabulary-only edits without media removal.
- Atomic apply, no-op behavior, Undo, and Redo.
- Model caching, interrupted downloads, local-only server binding, cancellation, and cleanup.
- Transcript panel selection, progress, stale-analysis protection, and approval controls.

## Success Criteria

A user can analyze a selected clip, review locally generated cleanup suggestions, apply only approved changes, and undo the result without configuring an OpenAI API key or incurring API charges.
