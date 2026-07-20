# Auto-Growing Timeline Design

## Goal

Remove the fixed 16-second project limit. The editor must support projects longer than one hour and grow whenever clips extend the edit.

## Duration Model

The project duration is the greatest end frame across every timeline clip:

`max(clip.start + clip.duration)`

Main, overlay, linked audio, independent audio, text, caption, and sticker clips all contribute. An empty project keeps a one-frame minimum so playback and rendering remain valid.

Importing, moving, trimming, changing speed, splitting, deleting, undoing, or redoing clips recalculates the duration from current timeline state. No fixed maximum is imposed by the editor.

## Timeline Presentation

The toolbar displays the dynamic frame count and a clock value. Clock labels use `MM:SS` below one hour and `HH:MM:SS` at one hour or longer.

Ruler ticks are generated from the current project duration instead of being fixed at 0, 4, 8, 12, and 16 seconds. The timeline uses a readable minimum pixel width and horizontal scrolling for long projects; clips are not compressed into unreadable slivers.

## Playback And Editing

The playhead maximum and playback stopping point use the dynamic project duration. Pointer scrubbing and clip positioning use the same scroll-aware coordinate system so editing remains accurate after horizontal scrolling.

## Remotion Duration

The Remotion composition receives a generous valid fallback duration for Studio registration. The interactive editor and exported project metadata derive their actual duration from timeline state. A later export implementation can serialize timeline clips into composition props and return the same calculated duration from `calculateMetadata`.

## Testing

Tests cover:

- Duration calculation across all track types.
- Projects longer than one hour.
- Empty-project minimum duration.
- Dynamic ruler labels and hour formatting.
- Removal of fixed 16-second ruler and display assumptions.

