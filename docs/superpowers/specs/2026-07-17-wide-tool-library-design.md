# Wide Tool Library Design

## Goal

Use the currently empty workspace width to show more imported media and tool assets at once, reducing vertical scrolling without shrinking the preview below a usable size.

## Layout

- Apply the wider library column to every editing tool, including Media, Audio, Text, Stickers, Cutout, Animations, Effects, Captions, Transcript, Filters, and Adjustment.
- Increase the library column from its current 220-280px range to a responsive 420-620px range.
- Preserve the existing settings column and keep the preview column flexible with a minimum usable width.
- Keep horizontal workspace overflow available for narrow windows instead of compressing controls until they overlap.

## Library Grids

- Change imported media and sticker grids from a fixed three-column layout to an auto-fitting responsive grid.
- Keep each tile wide enough for a readable thumbnail, duration, and truncated filename.
- Use additional columns when space is available so typical libraries require fewer rows.

## Overflow

- Retain vertical overflow only as a fallback when the library contains more items than can fit in the workspace height.
- Keep the scrollbar at the far right edge of the widened library panel.
- Do not change timeline scrolling, preview playback, drag and drop, imports, or clip-editing behavior.

## Responsive Behavior

- Large windows use the full widened range and display more grid columns.
- Medium windows keep the library useful while the preview consumes remaining space.
- Narrow windows preserve minimum panel widths and allow horizontal workspace scrolling.

## Verification

- Add a source-level UI regression test for the widened library column and auto-fitting grids.
- Run the focused UI test, TypeScript checking, and scoped linting.
- Confirm the running editor remains available on port 5173.
