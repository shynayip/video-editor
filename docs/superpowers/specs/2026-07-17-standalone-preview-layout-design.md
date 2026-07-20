# Standalone Preview Layout Design

## Goal

Make the video preview the dominant standalone workspace while keeping the timeline compact and usable below it. The preview should occupy all available central space without stretching or cropping portrait or landscape media.

## Layout

- Keep the existing top navigation and project actions.
- Give the preview a full-width workspace band below the navigation.
- Move the media library and tool settings out of the preview's horizontal space. They remain available as compact left-side panels associated with the active navigation tool.
- Center the preview canvas in its band and size it to the largest dimensions that fit the available width and height.
- Preserve the source aspect ratio with `contain`; unused space remains the editor's dark canvas background.
- Keep preview overlays, captions, text handles, stickers, crop controls, and playback controls positioned relative to the preview canvas.

## Timeline

- Keep the timeline as a separate band below the preview.
- Reduce its default height so the preview receives more vertical space.
- Align the timeline toolbar and track labels to the left and reduce unnecessary spacing.
- Preserve horizontal scrolling for long projects and vertical scrolling when many tracks exist.
- Do not change clip timing, drag, trim, split, overlay, audio, caption, text, playhead, or history behavior.

## Responsive Behavior

- On wide screens, the preview uses the full center width and the active tool panel is compact on the left.
- On narrower screens, tool panels remain scrollable and the preview keeps a stable minimum editing size.
- The timeline never overlaps the preview or Remotion Studio controls.
- Text, captions, and preview controls remain inside the visible canvas at all supported sizes.

## Verification

- Add layout regression checks for the editor grid, standalone preview area, compact timeline height, and left-aligned controls.
- Run TypeScript and the focused UI tests.
- Inspect the editor at desktop and narrow viewport sizes to confirm that portrait and landscape clips are contained, centered, and unobstructed.

