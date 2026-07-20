# Quiet New Track Drop Zones Design

## Goal

Remove the persistent "New track above" and "New track below" wording from the timeline while preserving the ability to create video tracks by dragging media above or below the main track.

## Interaction

- Empty new-track targets have no visible text label.
- Empty targets remain available across the timeline lane so media can still be dropped on them.
- A target becomes visibly highlighted only while a video is being dragged over it.
- After a video is dropped, the existing dynamic-layer behavior creates a normal track row containing the clip.
- The main track and existing video tracks keep their current labels and behavior.

## Accessibility

The drop targets retain an accessible label through `aria-label`, even though no text is rendered visibly.

## Implementation

Update the two new-layer drop target render paths in `src/Composition.tsx` to use empty, accessibility-labelled track labels. Adjust `src/index.css` so idle targets are visually quiet and drag-over targets show a clear dashed highlight. Update the UI source tests to verify that the visible wording is absent while both drop targets remain available.

## Verification

- Run `node --test tests\playhead-ui.test.mts`.
- Run `npm.cmd run lint`.
- Confirm the local page responds at `http://localhost:5173/`.
