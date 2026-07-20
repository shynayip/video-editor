# Caption Group Extension Design

## Goal

Expand the Captions panel into four clear actions: Auto captions, Manual captions, Upload caption file, and Auto lyrics.

## Caption Group

The Captions panel initially shows four compact action tiles with icons:

- **Auto captions** transcribes speech from the selected main or overlay video.
- **Manual captions** opens the existing manual caption form.
- **Upload caption file** accepts `.srt`, `.ass`, and `.lrc` files.
- **Auto lyrics** transcribes sung audio from the selected main or overlay video using the same secure backend.

Selecting an action replaces the tile list with that action's controls and a Back command. This avoids displaying every form at once.

## Caption File Import

Caption files are parsed locally in the browser; they are never uploaded to the backend.

- SRT timestamps use `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
- ASS imports `Dialogue:` rows from the `[Events]` section and converts ASS time values.
- LRC imports one or more `[mm:ss.xx]` timestamps per lyric line. Each line ends at the next timestamp; the last line defaults to 90 frames.
- Imported times are converted to frames using the composition FPS and clamped to the composition duration.
- Empty and malformed entries are skipped. If no valid entries remain, the panel shows an error and the timeline is unchanged.
- A successful file import adds all caption clips in one undoable history operation.

## Auto Lyrics

Auto lyrics uses the selected source-backed main or overlay clip and the existing `/api/transcribe` route. It has separate user-facing labels and progress text but returns the same validated timestamp segment shape. Generated lyric clips use the Caption track and the same styling controls as other captions.

Auto lyrics does not claim studio-grade lyric recognition. API failures or speech-free results leave existing captions unchanged.

## Timeline And Preview

All four actions create ordinary caption clips on the conditional Caption track. Imported and generated clips can be selected, split, trimmed, deleted, and restored with Undo. They render with the current caption style near the bottom center of the preview.

## Testing

- Pure parser tests cover valid and malformed SRT, ASS, and LRC files.
- LRC tests cover multiple timestamps and last-line default duration.
- UI tests cover all four action tiles, Back navigation, file acceptance, atomic import, and the Auto lyrics request path.
- Existing caption, text, video, overlay, sticker, effect, filter, and audio tests remain passing.

## Acceptance Criteria

- The Captions panel visibly offers all four approved actions.
- `.srt`, `.ass`, and `.lrc` files create correctly timed Caption-track clips.
- Invalid files do not partially change the timeline.
- Auto lyrics works from a selected video without exposing the OpenAI API key.
- Every successful action is undoable as one timeline operation.
