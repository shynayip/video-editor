# Optional Scene Import Design

## Goal

Let users decide whether newly imported gallery videos remain complete videos or are automatically separated into detected scene cards. Scene cards must use stable source-group numbering such as `Scene 1.1`, `Scene 1.2`, and `Scene 2.1`.

## Import Flow

After the user selects one or more video files, show one confirmation dialog for the entire selection. The dialog provides three actions:

- **Keep as full videos**: import every selected video as one complete media item.
- **Separate into scenes**: run scene detection for every selected video and create one gallery card per detected scene.
- **Cancel**: close the dialog without importing or uploading the selected files.

Images do not require scene detection. If a selection contains images and videos, the selected video behavior applies only to the videos while images import normally.

## Source Group Numbering

Every imported video receives a permanent source-group number in import order. The number continues across later imports and survives refreshes.

For example:

- First video: `Scene 1.1`, `Scene 1.2`, `Scene 1.3`
- Second video: `Scene 2.1`, `Scene 2.2`
- Next imported video: `Scene 3.1`, `Scene 3.2`

When several videos are imported together, each video receives the next available group number. Keeping a video whole still reserves its group number, although its gallery card continues to display its original filename. Deleting media does not renumber remaining or future items.

The source-group number must be stored with the saved media metadata so it remains stable after autosave and refresh. The saved project also stores the next unused source-group number. Importing videos advances that counter before processing begins, and deleting media never reduces it.

## Scene Labels

Scene cards display `Scene <source group>.<scene position>`. The scene position starts at 1 within each source video.

The original filename and shared source-file identifier remain in metadata so scene cards can still be associated with their source video. Splitting an existing scene manually preserves its source group and renumbers that source video's scene positions in timeline order.

## Failure Handling

If the user chooses scene separation and detection fails for a video, import it as one full-duration scene using the assigned label, such as `Scene 3.1`. Other videos in the same batch continue processing.

Upload or media-duration failures retain the existing per-file error behavior. The dialog choice itself does not add temporary gallery cards before the user confirms.

## UI

Use a focused modal dialog immediately after file selection. It must identify how many videos will be affected and use clear action labels rather than a generic yes/no question. Keyboard focus stays inside the dialog until the user chooses an action or cancels.

While scene detection runs, retain the existing analyzing cards. Full-video imports skip scene analysis and become available as ordinary gallery cards after upload and duration loading finish.

## Testing

Tests cover:

- keeping selected videos whole without calling scene detection;
- separating multiple videos with stable grouped labels;
- continuing group numbers across later imports and saved project reloads;
- reserving a group number for a whole-video import;
- preserving group numbers after deletion;
- fallback naming when scene detection fails;
- cancelling without uploading or modifying the gallery;
- importing images normally in a mixed selection.
