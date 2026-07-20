# Automatic Silence Removal Design

## Goal

Add a one-command local cleanup action that removes silent pauses from one selected video clip while keeping its reciprocal original audio synchronized and preserving Undo/Redo.

## User Experience

The Transcript panel shows a **Remove silence** command when a source-backed main or overlay video is selected. Activating it analyzes only the selected clip's visible source range. While analysis runs, the command is disabled and reports progress.

Pauses longer than 0.6 seconds are removed automatically. Each detected range keeps 0.15 seconds of surrounding audio so speech does not sound abruptly cut. When no qualifying silence exists, the timeline remains unchanged and the panel reports that no removable silence was found.

## Detection

The loopback-only local media server uses FFmpeg `silencedetect` on the selected source range. The initial threshold is -40 dB. Server output is parsed into finite, ordered silence ranges, clamped to the selected duration, padded by 0.15 seconds on both speech-facing edges, and merged when necessary.

The endpoint returns normalized ranges relative to the selected clip. It does not rewrite or persist the uploaded media.

## Timeline Editing

The editor converts returned seconds to source frames and retains the non-silent portions as adjacent timeline clips. It applies identical source ranges and durations to the selected video and its reciprocal linked audio. Later clips on the same video layer and the reciprocal linked-audio sequence ripple left by the removed duration so no empty gap remains.

Unrelated overlays, narration, music, text, stickers, captions, and other video layers are not cut or shifted. Generated transcript captions belonging to the cleaned source clip are removed because their timestamps are stale; users can generate a fresh transcript after cleanup.

All clip changes are committed as one history operation. One Undo restores the original video, linked audio, timing, and removed generated captions; Redo reapplies the cleanup. A no-op result does not create history.

## Errors And Safety

The server keeps the existing localhost origin checks, upload limit, abort handling, unique temporary directories, and cleanup behavior. Invalid ranges, missing audio, FFmpeg failure, a changed selection, or a changed clip boundary produce a recoverable message without modifying the timeline.

## Testing

Automated tests cover FFmpeg argument construction, silence-log parsing, threshold and padding behavior, range clamping and merging, paired video/audio segmentation, layer-specific ripple behavior, preservation of unrelated tracks, stale caption removal, no-op history, and atomic Undo/Redo. Browser verification covers selecting a clip, applying automatic silence removal, observing the shortened synchronized pair, and undoing the operation.

## Success Criteria

For a selected video containing a pause longer than 0.6 seconds, the user can press **Remove silence** once, hear and see the pause removed without desynchronizing original audio, and restore the exact previous timeline with one Undo.
