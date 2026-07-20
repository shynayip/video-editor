# Right Preview Editor Layout Design

## Goal

Rearrange only the editor area below the existing top bar to match the user's sketch. The top navigation, project status, Save button, and Export button remain unchanged.

## Desktop Layout

The area below the top bar is a two-column layout:

- The left column contains the working controls and timeline.
- The right column contains the video preview and spans the full available height below the top bar.

The left column is split vertically:

- The upper-left panel is one unified square-like workspace containing Import, Record, the media gallery, and the controls for the selected editing tool.
- The lower-left panel contains the timeline toolbar, ruler, playhead, video layers, captions, and audio tracks.

The timeline must not extend underneath the right-side preview. The preview must not be moved above the timeline or pushed downward by timeline content.

## Existing Behavior

- Keep the top bar markup and behavior unchanged.
- Keep all existing media import, recording, selection, editing, playback, timeline, Save, and Export behavior.
- Selecting Media, Audio, Text, Stickers, Cutout, Animations, Effects, Captions, Transcript, Filters, or Adjustment changes the contents of the unified upper-left workspace.
- Existing tool controls that currently use a separate settings panel will be presented within the upper-left workspace.
- The preview continues to show gallery media or timeline playback using the current preview logic.
- Timeline tracks retain horizontal and vertical scrolling when their content exceeds the lower-left area.

## Sizing

- The right preview column should receive slightly more width than the left editing column on a typical desktop display.
- The upper-left panel should remain large enough for the current media grids and tool controls.
- The lower-left timeline should have a stable minimum height and scroll internally instead of resizing or covering the preview.
- The preview media uses the current contain behavior so the complete frame remains visible without distortion.

## Responsive Behavior

At widths too narrow for both columns, the editor may retain a minimum desktop canvas with horizontal scrolling. Controls, preview media, timeline labels, and buttons must not overlap.

## Implementation Scope

- Update the editor workspace structure in `src/Composition.tsx` only where required to place the existing panels into the new regions.
- Update layout and responsive rules in `src/index.css`.
- Update focused UI tests to lock the new panel arrangement.
- Do not change editing data, media processing, timeline calculations, or project persistence.

## Verification

- Run the focused UI and editor logic tests.
- Run TypeScript checks.
- Verify the live page at desktop and narrower viewport sizes.
- Confirm the top bar is unchanged, the upper-left controls are unified, the timeline stays lower-left, and the preview fills the entire right side.
