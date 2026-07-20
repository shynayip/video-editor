# Horizontal 16:9 Workspace Design

## Goal

Rework the editor's upper workspace into a clear horizontal desktop layout so the active settings panel sits on the left, the imported media library sits in the middle, and the large video preview sits on the right. The timeline remains full-width below this workspace.

## Approved Layout

The upper workspace uses three columns from left to right in this order:

1. Clip and tool settings panel.
2. Media import and library panel.
3. A flexible 16:9 preview area.

The settings and import columns use restrained desktop widths. The right preview column receives the remaining space and must not collapse into the narrow vertical strip shown in the current interface.

## Preview Sizing

- The visible preview window keeps a true `16 / 9` aspect ratio.
- The preview grows to use the available right-column width and height while remaining fully visible.
- The existing `600px` width ceiling is removed or raised so it no longer leaves avoidable empty space around the video.
- Transform, crop, resize, and rotation controls remain positioned relative to the preview window.
- The media itself continues to use the editor's existing fit/crop behavior; this change affects workspace layout rather than changing clip content.

## Panel Behavior

- The settings panel remains independently scrollable on the left.
- The import/media library remains independently scrollable in the middle.
- The preview remains centered in the large right-hand area.
- The timeline and playback toolbar stay below the workspace and are not moved into any of the three columns.
- On narrower desktop windows, panel widths may shrink within limits, but the preview remains the priority. The editor may horizontally overflow at very small widths instead of stacking the panels vertically.

## Implementation Scope

This should primarily be a CSS layout change in `src/index.css`. JSX structure should only change if the existing workspace order cannot support the approved layout. Existing editing behavior and project state must remain unchanged.

## Verification

- Confirm the workspace grid is settings, import/media, preview.
- Confirm the preview window is 16:9.
- Confirm the preview is visibly wider than before and no longer squeezed into a vertical strip.
- Confirm both side panels can still scroll.
- Confirm the timeline remains below the entire upper workspace.
- Run TypeScript, lint, and the focused UI tests that cover workspace structure.
