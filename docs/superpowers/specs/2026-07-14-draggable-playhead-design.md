# Draggable Timeline Playhead

## Goal

Let users choose an exact editing time by clicking or dragging the red playhead across the timeline.

## Interaction

- Clicking the timeline ruler or an empty part of any track moves the playhead to that frame.
- Dragging the red line or its top handle scrubs continuously from left to right.
- Scrubbing pauses active playback and updates the preview to the selected frame.
- The playhead is clamped between frame `0` and the final main-track frame.
- Clicking a clip still selects it. Dragging trim handles still trims it and does not move the playhead.
- The playhead remains one continuous red line across all timeline rows.

## Implementation

Add a timeline content reference and convert the pointer's horizontal position into a frame using the existing timeline scale. Reuse one clamping helper for click, pointer-move, and playback updates. Capture the pointer while scrubbing so movement continues even if the cursor leaves the red line.

## Verification

- Unit-test horizontal-position conversion and frame clamping.
- Verify click-to-seek, drag-to-seek, both timeline boundaries, clip selection, and trim-handle isolation.
- Run editor logic tests, TypeScript, and ESLint.
