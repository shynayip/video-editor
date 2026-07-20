# Creative Text Animations Design

## Goal

Expand the text clip animation control beyond simple entrance effects with a compact creative preset pack. The pack adds word-aware and decorative animations while keeping every result deterministic in the editor preview and Remotion render.

## User Experience

- A user creates or selects a text clip.
- The existing **Animation** control continues to show one selectable preset per text clip.
- Existing choices remain available: **None**, **Pop**, **Jump**, and **Fade**.
- New choices are **Star Jump**, **Bounce**, **Typewriter**, **Wave**, **Flicker**, and **Spin In**.
- Choosing a preset updates only the selected text clip, appears immediately in the preview, and participates in undo and redo.
- Moving, trimming, rotating, or resizing the text clip keeps its animation attached and synchronized.

## Animation Behavior

- **Star Jump**: small decorative stars travel from one word to the next in sequence. The active word receives a brief lift and emphasis while the stars are nearby.
- **Bounce**: words rise and settle one after another near the start of the clip.
- **Typewriter**: characters become visible in order until the complete text is shown.
- **Wave**: words move vertically in a staggered wave while remaining readable.
- **Flicker**: the complete text briefly varies in opacity before settling at full opacity.
- **Spin In**: the complete text rotates and scales into its final presentation.
- Entrance-style presets settle into a neutral presentation after their animation window.
- The decorative Star Jump and Wave motions may use a short repeating cycle while the clip is active so the effect remains visible on longer text clips.
- Whitespace and line wrapping remain visually equivalent to the original text content.

## Data Model

Extend `TextEntranceAnimation` with the six new preset identifiers. Continue storing one `animation` value on each `TextOverlay`, preserving compatibility with existing clips and saved projects.

The shared text animation presentation expands only where necessary for whole-text properties such as opacity, scale, translation, and rotation. Word-aware presentation is derived from the clip, playhead frame, and word or character index rather than stored as mutable timeline data.

## Rendering

- All timing derives from `playheadFrame`, `clip.start`, and stable item indexes.
- No CSS keyframe animation, timers, or runtime randomness will control the rendered result.
- Star positions, sizes, and phases use fixed indexed values so preview and exported frames match.
- Word-aware presets render text as inline word spans while preserving ordinary spaces and wrapping.
- Typewriter renders only the visible character prefix for the current frame.
- Decorative stars are non-interactive, remain visually attached to the text, and do not interfere with text selection, movement, resize, or rotation handles.
- Existing font, color, effect, position, rotation, and stacking behavior remain intact.

## Controls

The existing animation button grid will contain the full set of presets. It remains visible only for a selected text clip and continues to expose the selected preset through its active and `aria-pressed` states.

The initial implementation does not add separate duration, intensity, entrance, loop, or exit controls. One preset per text clip keeps the panel understandable and matches the approved creative pack scope.

## Testing

- Verify all six new preset identifiers can be stored on only the selected text clip.
- Verify whole-text animation presentation at the start, middle, and settled frames.
- Verify word and character progression is derived deterministically from the playhead.
- Verify Star Jump produces stable decorative star presentation for the same frame and word index.
- Verify text content, spaces, and existing clip styling remain unchanged after an animation is selected.
- Verify the controls expose all existing and new choices with accessible selected states.
- Run focused editor logic and UI tests, followed by TypeScript and lint checks.

## Scope

This change adds the approved creative preset pack to text clips. It does not add custom keyframes, user-uploaded particle graphics, multiple simultaneous animation presets, separate exit animations, or caption animation changes.
