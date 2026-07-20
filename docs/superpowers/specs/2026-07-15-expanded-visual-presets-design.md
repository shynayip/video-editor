# Expanded Effects and Filters Design

## Goal

Give users more visual choices while keeping Effects and Filters easy to understand and adjustable for each selected video clip.

## Presets

Effects contain eight choices:

- None
- Blur
- Glow
- B/W
- Invert
- Fade
- Shadow
- Zoom

Filters contain eight choices:

- None
- Warm
- Cool
- Vivid
- Vintage
- Sepia
- Cinema
- Soft

A clip can use one effect and one filter at the same time. Selecting a new choice replaces only the choice in that group.

## Intensity Controls

Effects and Filters each have their own intensity slider from 0% to 100%. The slider appears beneath its group's preset buttons and updates the selected clip immediately.

- 0% produces the unmodified result for that group.
- 100% produces the full preset result.
- Choosing None resets that group's intensity to 0%.
- Choosing a non-None preset starts at 100% unless the clip already has an intensity for that group.

The selected preset and intensity are stored on each main-track or overlay-track clip. Different clips can therefore use different visual settings.

## Rendering

The existing visual-style helper will return the complete presentation style for a clip:

- CSS filter values for color and blur-based presets.
- Opacity for Fade.
- Drop shadow for Shadow.
- Scale for Zoom.

The same calculated style is applied to the central preview, overlay preview videos, and timeline thumbnails so they remain visually consistent.

## Interaction

Opening Effects or Filters continues to select the current video clip automatically. Preset buttons and the intensity slider remain disabled only when the timeline has no editable main or overlay video.

Every preset or intensity change is recorded as one timeline history edit so Undo and Redo continue to work.

## Validation and Testing

- Clamp stored intensity values to the 0–100 range.
- Ignore effect and filter changes for audio, caption, text, and sticker clips.
- Test every new preset type and intensity calculation.
- Test that changing one group preserves the other group.
- Test the Effects and Filters panels, slider wiring, disabled state, and preview styles.
- Run the complete editor tests, ESLint, and TypeScript checks.
