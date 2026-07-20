# Undo, Redo, and Toolbar Cleanup Design

## Goal

Make timeline Undo and Redo reliable and remove the unused Replace button from the timeline toolbar.

## Behavior

- Place a Redo curved-right-arrow icon directly beside the Undo curved-left-arrow icon.
- Undo restores the timeline state from immediately before the latest edit.
- Redo restores the timeline state that was most recently undone.
- Disable Undo when there is no earlier timeline state.
- Disable Redo when there is no undone timeline state.
- Clear Redo history whenever the user makes a new timeline edit after undoing.
- Include timeline edits such as importing, splitting, trimming, deleting, moving, changing speed, changing volume, and adding overlays.
- Remove the Replace icon button from the timeline toolbar.
- Keep existing drag-to-replace behavior unchanged; this request removes only the unused toolbar button.

## Architecture

Maintain two timeline snapshot stacks in the editor component: an undo stack containing states before completed edits and a redo stack containing states removed by Undo. A normal timeline edit pushes the current clips onto the undo stack, applies the new clips, and clears the redo stack. Undo and Redo transfer snapshots between the two stacks without recording those transfers as new edits.

Keep history limited to the timeline clip array. Media selection, playhead position, playback state, and panel selection are interface state and are not included in Undo or Redo.

## Error Handling

Undo and Redo do nothing when their corresponding stack is empty. Their buttons remain disabled in those states so users receive an immediate visual indication.

## Verification

- Add tests for applying an edit, undoing it, redoing it, and clearing redo history after a new edit.
- Verify Undo and Redo buttons enable and disable at the correct times.
- Verify the Replace toolbar button is absent.
- Run the editor logic tests and TypeScript/ESLint checks.
- Test the controls in the running Vite editor at `http://localhost:5173/`.
