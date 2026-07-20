# Compact Unlabelled Video Layers Design

## Goal

Remove visible secondary video-layer names and close the excessive vertical gap between the final video layer and the contextual audio track.

## Timeline Labels

- Secondary signed video rows render no visible `Video layer +N` or `Video layer -N` wording.
- Main track and Audio track keep their visible labels.
- Secondary rows retain an accessible direction/layer name through `aria-label`.
- Clip boxes, selection, movement, splitting, and drag/drop behavior remain unchanged.

## Vertical Spacing

- Empty above/below new-track drop targets collapse from a full `45px` timeline row to a thin `10px` drop strip.
- The thin strips remain available for adding another layer.
- A strip visibly highlights when media is dragged over it.
- The Audio track sits directly below the last lower video row, separated only by the thin add-layer strip.

## Verification

- UI source tests assert secondary layer wording is absent while Main and Audio labels remain.
- CSS tests assert the new-layer target height is `10px` and its lane fills the compact strip.
- Run the timeline UI suite, lint/TypeScript, and the local `5173` page check.
