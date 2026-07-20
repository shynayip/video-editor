# Hover Video Preview Controls

## Goal

Replace the filename and large play button currently covering the media preview with compact controls that stay hidden until the user hovers over or focuses the preview. Users must be able to seek to any valid point, play or pause, and change preview volume without obscuring the video.

## Interaction Design

- Show the selected filename in a translucent strip at the top of the preview only while the preview is hovered or contains keyboard focus.
- Show a bottom control bar under the same conditions.
- The bottom bar contains a play/pause icon, a speaker icon, the current time, the total duration, and a draggable range playhead.
- Clicking the speaker icon opens an inline volume slider. The slider remains available while it or the preview has focus and closes when focus and hover leave the preview.
- Dragging the playhead seeks immediately and keeps the controls visible for the entire interaction.
- Full-video previews seek across the complete source duration.
- Detected scene previews expose only that scene's duration. Their visible time starts at `00:00`, while seeking maps back to the scene's absolute source range.
- Icons use accessible names and tooltips. Keyboard users can tab to every control and use arrow keys on both sliders.

## Component Changes

The existing media preview remains the playback source. The preview receives a dedicated overlay containing:

1. A top filename label.
2. A bottom transport row.
3. An expandable inline volume range input.

The existing imported-media seek state and scene boundaries remain authoritative. A new media-preview volume state controls only gallery and scene preview playback; it does not modify timeline clip volume.

Visibility is handled with CSS hover and `focus-within`, plus an active class while seeking or while the volume slider is open. Controls use opacity and pointer-event transitions so hidden controls cannot intercept video interactions.

## Data Flow

1. Selecting imported media resets playback and loads its valid preview range.
2. Moving the playhead converts the visible relative value to the correct source time.
3. The native video element reports playback progress, which updates the playhead.
4. Clicking play or pause controls only the imported-media preview.
5. Moving the volume slider updates the native video element immediately.
6. Scene playback continues to loop inside the selected scene boundaries.

## Error And Edge Handling

- Clamp seeks to the full video or selected scene boundaries.
- Treat missing or invalid duration as zero and disable seeking until metadata loads.
- Preserve the selected volume when switching between imported videos.
- A zero volume value displays the muted speaker state.
- Long filenames truncate visually and remain available through a title tooltip.

## Testing

- Verify filename and controls are inside the hover overlay rather than covering the preview permanently.
- Verify hover, focus, dragging, and open-volume states reveal controls.
- Verify the playhead seeks full videos and maps scene-relative values to scene source ranges.
- Verify play/pause uses the independent media-preview player.
- Verify the speaker opens a slider and volume changes reach the native video element.
- Verify accessible labels and keyboard-compatible range controls.
- Run the focused preview tests, TypeScript, and the production bundle.
