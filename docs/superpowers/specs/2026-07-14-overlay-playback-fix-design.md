# Multi-Row Overlay Playback Fix

## Goal

Make overlay clips behave like real upper video layers: imported overlay videos appear above the main-track video, can be placed at chosen timeline positions, and can sit on separate overlay rows instead of being squeezed into one messy group. While the red playhead is inside an overlay clip, that clip appears over the main video. When an overlay clip is trimmed away or has a gap, the lower overlay row or main video shows through.

## Behavior

- Remove the source-less `Upper clip` placeholder from the initial timeline.
- Add an imported video to the overlay area at the current red-playhead frame.
- If the new overlay overlaps another overlay clip, place it on a separate overlay row so each video remains individually adjustable.
- Reuse an existing overlay row only when that row has empty space at the new clip's time range.
- Display overlay rows as separate lanes, like the reference screenshot, instead of stacking all overlay clips inside one tall group.
- Let the user select, split, trim, and adjust each overlay clip independently by clicking that specific clip.
- Show the active overlay while paused as well as while playing.
- Synchronize the overlay video's media time to its position inside the overlay clip.
- Mute overlay audio by default so the main narrative audio continues underneath, while still allowing the user to change an overlay clip's volume later.
- Preserve splitting and trimming as clip-specific operations; splitting one overlay clip does not split the main, audio, caption, or other overlay rows.
- Let the red playhead line span all timeline rows: overlay rows, main track, captions, and audio track.
- Allow clicking the timeline to move the red playhead so splits happen exactly where the user chooses.

## Implementation

Add an overlay lane index to timeline clips. Imported overlays use the first lane that does not overlap their requested start/duration; if every existing lane overlaps, create a new lane. Render those lanes separately, with the higher overlay lane visually above lower lanes and above the main track.

Keep overlay selection in the timeline logic and return the visible, source-backed clip at a frame. If multiple overlay clips are active at the same frame, the highest overlay lane is the visible top layer. Use separate refs for the main and overlay preview videos so both can seek and play from clip-relative time. The preview layer is rendered whenever a source-backed overlay is active, independent of the play/pause state.

For splitting, prefer the selected clip id over a whole-track split. This means clicking an overlay clip and pressing split cuts only that clip at the current red playhead position. The clip label remains the original media name after splitting so the timeline does not become cluttered with `A` and `B` suffixes.

## Verification

- Add regression tests proving source-less placeholders cannot mask a real overlay and an imported overlay starts at the requested playhead frame.
- Add tests proving overlapping overlays are assigned to separate lanes, non-overlapping overlays can reuse a lane, and the active visible overlay is the topmost lane at the playhead.
- Add tests proving splitting a selected overlay clip cuts only that clip at the red playhead frame.
- Run the editor logic tests and TypeScript/ESLint checks.
- Verify in Remotion Studio that overlay rows display separately, pausing within an overlay still shows it, pausing outside it shows the lower row or main clip, and each row can be adjusted independently.
