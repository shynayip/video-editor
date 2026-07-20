# Vertical 9:16 Preview Design

## Goal

Change the editor preview from a horizontal 16:9 canvas to a vertical 9:16 canvas suitable for portrait videos such as TikTok, Instagram Reels, and YouTube Shorts.

## Workspace Layout

The main workspace remains arranged horizontally from left to right:

1. Settings panel.
2. Import panel.
3. Preview area.

The timeline remains full-width underneath the workspace.

## Preview Canvas

- The visible preview window uses an exact `9 / 16` aspect ratio.
- The preview is centered horizontally and vertically within the available preview area.
- The preview grows as large as the available height permits without overflowing its panel.
- Existing video fitting and transform behavior remain unchanged so media is not stretched.
- The rotation control remains above the preview frame.

## Scope

This change only affects the editor preview layout. It does not change timeline behavior, clip data, playback controls, media transforms, or panel ordering.

## Verification

- Update the workspace layout test to require a `9 / 16` preview ratio.
- Confirm the old `16 / 9` preview sizing rule is absent.
- Run TypeScript and focused layout tests.
- Visually inspect the editor at a desktop viewport and confirm the portrait preview is centered and does not overlap the panels or timeline.
