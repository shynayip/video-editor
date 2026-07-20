# Imported Media Delete Design

## Goal

Let users remove an unused imported video from the media gallery without cluttering every thumbnail or breaking timeline clips.

## Interaction

- Each media thumbnail has a small trash icon in its lower-right corner.
- The icon is hidden normally and appears when the thumbnail is hovered or contains keyboard focus.
- The icon has an accessible label and tooltip naming the delete action.
- Clicking the icon does not select or drag the thumbnail.

## Delete Rules

- If no timeline clip references the media source, remove the media item from the gallery.
- If any timeline clip references the media source, keep the media item and show a short warning asking the user to remove it from the timeline first.
- If the deleted item was selected, select the first remaining gallery item or clear the selection when none remain.

## Implementation

- Add a pure media-removal helper to `src/editorLogic.ts` so reference checks and selection fallback are testable.
- Wire the helper into the media thumbnail list in `src/Composition.tsx`.
- Add hover and focus-visible styling in `src/index.css`.
- Use the existing project status area for success and warning messages.

## Verification

- Unit-test deletion, timeline protection, and selected-item fallback.
- UI-source test the icon label, event isolation, and hover/focus styling.
- Run TypeScript, focused ESLint, and existing editor tests.
