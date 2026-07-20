# Overlay Linked Audio Design

## Goal

Give every main and overlay video clip its own linked audio clip. Show only the audio belonging to the selected video, and use overlay priority to decide which audio is heard during playback.

## Data Model

- Every imported main or overlay video is created with a linked audio clip.
- The video and audio clips reference each other through `linkedClipId`.
- Linked audio keeps the same source, start, duration, source offset, speed, and volume context as its video.
- Recorded narration remains an independent audio clip and is not treated as video-owned audio.

## Selection And Timeline

- The audio row is hidden on initial load.
- Selecting a main video shows only that video's linked audio clip.
- Selecting an overlay video shows only that overlay's linked audio clip.
- Selecting the visible linked audio keeps that audio row visible.
- Selecting stickers, text, captions, or empty track space hides the contextual audio row.
- Audio belonging to other videos remains in editor state but is not rendered in the contextual row.

## Playback Priority

- When no overlay video is active, the active main video's linked audio plays.
- When an overlay video is active, main audio is paused and the overlay's linked audio plays.
- When multiple overlay videos overlap, only the topmost active overlay's linked audio plays.
- When the topmost overlay ends, playback falls back to the next active overlay or the main video.
- Video elements remain muted whenever their linked audio element is responsible for playback.

## Editing Behavior

- Moving an overlay also moves its linked audio to the same start time.
- Trimming a video updates its linked audio timing and source offset.
- Splitting a video creates two independently linked video/audio pairs at the playhead.
- Deleting a video deletes its linked audio.
- Adjusting the visible audio changes only the selected video's linked audio.
- Undo and redo capture linked video/audio edits as one timeline operation.

## Compatibility

- Existing clips without `linkedClipId` continue to render.
- Existing main audio is matched conservatively by source and timing when possible.
- Independent narration audio is never automatically attached to a video.

## Testing

- Test creation of linked overlay video/audio pairs.
- Test selection filtering so only the selected video's audio is visible.
- Test main, overlay, and topmost-overlay playback priority.
- Test linked movement, trimming, splitting, deletion, volume adjustment, undo, and redo.
- Run editor logic tests, UI wiring tests, ESLint, TypeScript, and a local page health check.
