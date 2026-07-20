# Text Entrance Animations Design

## Goal

Allow users to give each text clip a short entrance animation. The animation plays once when the text clip begins and does not repeat for the rest of the clip.

## User Experience

- A user creates or selects a text clip.
- The existing text controls show a new **Animation** section.
- The available choices are **None**, **Pop In**, **Jump In**, and **Fade In**.
- Choosing an option updates only the selected text clip and immediately updates the preview.
- Each text clip keeps its own animation choice.
- Animation changes participate in the existing undo and redo history.

## Animation Behavior

- **None**: the text appears normally.
- **Pop In**: the text scales from small to full size with a light overshoot.
- **Jump In**: the text enters from below and settles with a small bounce.
- **Fade In**: the text opacity increases smoothly from transparent to opaque.
- Each animation lasts approximately 0.5 seconds at the project frame rate.
- Once the entrance window has finished, the text remains stable for the rest of its clip.
- Preview and rendered output use frame-based values so they remain deterministic in Remotion.

## Data Model

Add a text entrance animation preset to `TextOverlay`. Existing clips without the property behave as `none`, preserving compatibility with current projects and saved state.

The text style update path will accept animation changes so it can reuse the current clip-history mechanism.

## Rendering

The preview calculates the selected text clip's local frame from the timeline playhead and the clip start frame. A pure helper returns opacity, scale, and vertical translation for that frame. The resulting presentation is combined with the text's existing position, rotation, font, and visual effects.

CSS keyframe animations will not be used because Remotion output must be determined by the current frame.

## Controls

The text details panel receives a compact segmented control below the existing visual effects. Buttons use the labels **None**, **Pop**, **Jump**, and **Fade**, with an active state for the selected preset. The control is visible only when a text clip is selected, matching the existing text formatting workflow.

## Testing

- Verify new text clips default to `none`.
- Verify changing the preset updates only the selected text clip without mutating the original array.
- Verify each preset's presentation at the beginning, during, and after its entrance window.
- Verify the text controls expose all four choices and apply the selected state.
- Run focused editor logic and UI tests, then project TypeScript and lint checks where unrelated worktree changes permit.

## Scope

This feature covers entrance animation only. Repeating animations, exit animations, custom duration controls, per-character animation, and caption animation are outside this change.
