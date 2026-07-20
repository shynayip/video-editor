# Voice Recording and Trim-Aware Preview Design

## Goal

Add browser microphone recording for narration and make the preview obey the red playhead and each clip's trimmed timeline boundaries.

## Preview Behavior

- The red playhead is the source of truth for timeline preview.
- When the playhead is inside a visible main clip, the preview displays that clip and seeks to the matching source time.
- When the playhead is outside every visible main clip, the preview displays the editor's black empty state.
- Pausing playback does not switch back to the selected Media-library item.
- Selecting a Media-library item may still show that item before it is placed on the timeline, but moving or selecting the timeline returns the preview to timeline mode.
- Right trimming removes the tail from timeline playback. Left trimming preserves the correct source offset so the remaining clip begins at the expected point in the original video.

## Voice Recording Flow

- The existing Record button starts a microphone recording after browser permission is granted.
- While recording, the button clearly changes to Stop and shows an active recording state.
- Stopping creates one local audio media item and one audio timeline clip.
- The new audio clip begins at the current red playhead frame and uses the measured recording duration.
- The new clip becomes selected so its volume can be adjusted immediately.
- Recorded clips support the existing split, trim, delete, and undo operations.
- The recorder releases the microphone stream after stopping, failing, or unmounting.

## Audio Playback

- Active audio clips are found from the red playhead using the same timeline boundary rules as video clips.
- Original audio linked to a main video clip follows that video's trim, split, and delete operations so their lengths remain aligned.
- Microphone narration remains independent and is edited only when its own audio clip is selected.
- Recorded audio plays only while the playhead is inside its timeline clip.
- Audio volume comes from the selected clip's existing volume property.
- Multiple audio clips may exist; overlapping clips play together.

## Error Handling

- If microphone permission is denied or no microphone is available, no clip is created.
- A concise message is shown near the Record control.
- Unsupported browsers disable recording and explain that microphone recording is unavailable.
- Empty or zero-length recordings are discarded.

## Data Model

- Timeline clips gain an optional source offset in frames. Splitting and left trimming update this offset so playback stays aligned to the source media.
- Recorded media uses an in-memory object URL for the current session.
- Refresh persistence is outside this change because browser object URLs cannot survive a reload without persistent browser storage or a backend upload.

## Testing

- A trimmed main clip is inactive after its new end frame.
- Left trim and split preserve the correct source offset.
- Linked main video and audio clips keep matching boundaries after trim, split, and delete operations.
- A recording is converted to an audio timeline clip at the requested playhead with the measured duration.
- Invalid recording durations do not create clips.
- Existing split, overlay, speed, volume, delete, and undo tests remain green.
