# AI Image and Video Cutout Design

## Goal

Replace the confusing color-key controls with one automatic cutout workflow that isolates a person or foreground object from ordinary image and video backgrounds. The processed transparency must be used by both the editor preview and exported video.

## Current Problem

- `Auto image` is disabled for video clips and uses a color-distance algorithm designed for still-image backgrounds.
- Green, White, and Black are chroma-key filters. They only work when a source has a nearly solid matching background and cannot identify a person in a normal room.
- Presenting both workflows together makes the color-key buttons look like general background removal.

## Interface

- Remove Off, Green, White, and Black from the Cutout panel.
- Rename `Auto image` to `Auto cutout` and enable it for selected image and video cutout clips.
- Keep Move, Erase, Restore, brush size, split, reset, undo, and redo.
- While processing, disable Auto cutout and show a clear progress label.
- On success, keep the same selected timeline clip and replace its visual source with the transparent processed asset.
- On failure, preserve the original media and show a concise error status.

## Processing Architecture

### Images

Use foreground segmentation to produce a transparent PNG. Retain the original source in the clip so Reset and Restore remain available.

### Videos

Send the selected source range to the local media server. The server processes frames with foreground/person segmentation, preserves frame timing, and creates a transparent WebM asset. Audio remains in the existing linked audio clip and is not duplicated in the transparent visual asset.

The client receives progress updates and, when complete, swaps only the selected cutout clip source. Duration, start position, speed, transform, linked audio, split boundaries, and selection remain unchanged.

## Export

The processed transparent PNG or WebM becomes the clip source stored in project state. Remotion therefore composites the same source during export, avoiding a preview-only result.

## Compatibility and Fallbacks

- Existing projects that contain a chroma-key value continue to load, but the controls are no longer shown.
- Transparent PNG and WebM imports continue to work without additional processing.
- If automatic segmentation is unavailable, the user can still use Erase and Restore manually.

## Error Handling

- Reject unsupported or unreadable sources before modifying project state.
- Cancel stale processing when the selected clip changes.
- Remove temporary frame files after success or failure.
- Never replace the selected clip until the processed asset is complete and readable.

## Testing

- UI tests verify that only Auto cutout remains and it supports image/video selections.
- Client tests verify request, progress, success, cancellation, and failure behavior.
- Server tests verify source-range arguments, transparent output registration, and cleanup.
- Editor-logic tests verify that applying a processed result preserves timing, transforms, selection-relevant identity, and linked audio.
- TypeScript, ESLint, and the existing full suite must remain clean.
