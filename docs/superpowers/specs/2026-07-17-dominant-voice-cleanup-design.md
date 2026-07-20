# Dominant-Voice Cleanup Design

## Goal

Replace basic volume-based silence removal with a local AI workflow that keeps the dominant speaker in a selected main video clip and removes sections where that speaker is absent.

## User Flow

1. The user selects a clip on the main video track.
2. The user presses **Keep main voice**.
3. The editor reports progress while extracting audio, detecting speakers, identifying the dominant speaker, and applying the edit.
4. The speaker with the longest total speech duration is treated as the main voice.
5. Sections containing silence, music, background noise, or only other speakers are ripple-deleted from the selected main video and its linked audio.
6. Overlay video, captions, text, cutouts, stickers, background music, and unrelated audio clips remain unchanged.
7. The complete operation is stored as one undoable history change.

## Detection Rules

- Run voice activity detection before speaker matching so non-speech audio is not considered a speaker.
- Generate speaker embeddings for detected speech windows and cluster matching voices locally.
- Select the cluster with the greatest total speaking duration as the dominant speaker.
- Add short padding before and after retained dominant-speaker ranges to avoid clipping words.
- Merge retained ranges separated by very short gaps to avoid producing many tiny cuts.
- Reject the operation when no reliable speech or no sufficiently dominant speaker can be identified.

## Architecture

### Local Processing Service

Add a dedicated dominant-voice detection service behind the existing local Express API. It accepts the selected clip's original media source range, extracts mono audio with FFmpeg, runs local voice activity and speaker-embedding models, and returns normalized dominant-speaker time ranges. Models are loaded once and cached for later requests.

### Editor Request Flow

The editor snapshots the selected clip identity, source, source range, duration, and speed before starting. It cancels stale requests when the selection or clip changes. A successful response is applied only if the snapshot still matches.

### Timeline Edit

Convert dominant-speaker source-time ranges to selected-clip timeline ranges, including playback speed. Invert them into removal ranges and ripple-delete only the selected main clip and its linked audio. Preserve source offsets and media synchronization across every resulting segment. Other tracks keep their original positions and contents.

## Interface

- Rename **Remove silence** to **Keep main voice**.
- Disable the action unless a main video clip is selected.
- Show processing stages in the existing project status area.
- Allow cancellation through selection changes and request aborts.
- Show a clear message without modifying the timeline when detection is unreliable or processing fails.

## Error Handling

- Validate media type, source range, duration, and upload size before processing.
- Use per-request temporary directories and remove them on success, failure, and cancellation.
- Do not apply partial edits.
- Preserve the original error if cleanup also fails.
- Keep the existing project untouched when the model cannot load or the clip has no usable dominant speech.

## Testing

- Voice activity and dominant-cluster selection.
- Padding, gap merging, and normalized ranges.
- No-speech and ambiguous-speaker rejection.
- Speed-aware source-to-timeline conversion.
- Ripple deletion of main video and linked audio only.
- Preservation of overlays, captions, text, stickers, background music, and unrelated audio.
- Undo and redo as one history operation.
- Request cancellation and stale-result rejection.
- API validation, temporary-file cleanup, and model-load failures.

## Out Of Scope

- Choosing a speaker manually from a voice sample.
- Cloud speech APIs.
- Removing background noise while retaining the same full video duration.
- Repositioning or deleting content on unrelated tracks.
