# Vertical Preview Volume Design

## Goal

Make the imported-video preview volume control fit cleanly inside narrow portrait preview frames and communicate the current value only while the user is adjusting it.

## Interaction

- Clicking the preview speaker button opens a compact vertical volume slider above the button.
- The slider runs from 100% at the top to 0% at the bottom.
- While the user is actively dragging the slider, a small percentage label displays the rounded current value, such as `65%`.
- The percentage label disappears when the pointer is released or cancelled.
- The slider itself stays open until the existing volume-control dismissal behavior closes it.
- Preview volume remains independent from timeline clip volume.

## Layout

- The popup is right-aligned to the speaker button and opens inward, entirely within the preview frame.
- The slider uses a vertical writing mode rather than rotating the whole control, keeping pointer and keyboard behavior native.
- The transient percentage label sits above the slider without resizing the transport row.

## State And Events

- Add a boolean state that tracks active preview-volume adjustment.
- Pointer down starts adjustment.
- Pointer up and pointer cancel end adjustment.
- Existing media or preview-mode changes also reset adjustment state.
- The percentage label is rendered only while adjustment state is active.

## Accessibility

- Keep the existing `Imported video volume` accessible label.
- Keep the native range input so keyboard adjustment continues to work.
- The percentage label is supplementary visual feedback and does not replace the range control's accessible value.

## Verification

- Add a regression test for vertical slider styling and top-to-bottom direction.
- Add a regression test proving the transient percentage is tied to active adjustment state.
- Run the focused media-preview and playhead tests plus TypeScript checking.
