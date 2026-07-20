# Sticker Editor

## Goal

Turn the Stickers tab into a working editor for placing built-in and user-uploaded visual stickers over the video.

## Sticker Library

- Clicking the Stickers tab replaces the media library with a compact sticker library.
- The library contains built-in stickers and an Upload control.
- Upload accepts PNG, WebP, and GIF files and keeps them available for the current browser editing session.
- Selecting a sticker adds it at the current red-playhead frame for a default duration of three seconds.

## Preview Editing

- Active stickers render above main and overlay videos.
- A selected sticker shows a restrained transform outline with handles.
- Users can drag to reposition, resize from a corner handle, and rotate from a rotation handle.
- Sticker transforms remain constrained to sensible minimum dimensions while allowing placement partially outside the frame.

## Timeline Editing

- Add a dedicated Sticker track below the overlay track.
- Sticker clips support selection, trimming, splitting, duplication, and deletion.
- Multiple stickers may overlap in time and remain independently editable.
- Sticker visibility is determined by the red playhead and each sticker clip's boundaries.

## State And Errors

- Reject unsupported uploads without changing the project.
- Revoke uploaded object URLs when the editor unmounts.
- Sticker edits participate in the existing undo history.

## Verification

- Unit-test adding a sticker at the playhead, visibility boundaries, and transform updates.
- Verify built-in and uploaded stickers in the standalone Vite editor.
- Verify drag, resize, rotate, trim, split, duplicate, delete, and undo.
- Run editor logic tests, TypeScript, and ESLint.
