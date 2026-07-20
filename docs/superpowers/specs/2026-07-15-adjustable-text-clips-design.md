# Adjustable Text Clips Design

## Goal

Make the top-bar Text tool functional. Users can create styled text at the red playhead, see it over the video, and control how long it remains visible by resizing its timeline clip.

## Interaction

- Clicking `Text` activates the Text tool and replaces the media controls with a text editor panel.
- The panel includes text content, font size, text color, and an `Add text` command.
- Adding text creates a text clip at the current red playhead position.
- New text clips default to four seconds, capped at the current project end.
- A dedicated `Text track` appears in the timeline when text clips exist.
- Selecting a text clip exposes its values in the Text panel for live editing.
- The existing left and right trim handles resize the clip. A longer clip keeps the text visible longer; a shorter clip hides it earlier.
- Existing split, delete, undo, and redo commands apply to selected text clips.

## Preview Behavior

- A text clip is visible only while the playhead is within its start and end frames.
- Multiple active text clips may display together.
- Text is centered initially and rendered above video and overlay footage.
- Text styling updates immediately without changing clip timing.

## Data Model

Extend `TimelineClip` with optional text properties:

- `text`: displayed content.
- `fontSize`: pixel size.
- `textColor`: CSS color.
- `textX` and `textY`: percentage-based preview position, initially centered.

Text clips use the existing `caption` track identifier internally so current split, trim, selection, deletion, and history helpers continue to work. The user-facing label is `Text track`.

## Validation

- Empty or whitespace-only text cannot be added.
- Text duration is at least the existing minimum trim duration.
- Default duration never extends beyond the project end when an end exists.
- Styling controls remain within safe font-size and color values.

## Testing

- Unit test creation at the playhead with default and end-capped duration.
- Unit test rejection of empty text.
- Unit test active-text visibility before, during, and after the clip range.
- Existing split, trim, delete, undo, and redo tests continue to pass.
- Browser verification covers opening Text, adding text, preview display, and resizing its timeline clip.
