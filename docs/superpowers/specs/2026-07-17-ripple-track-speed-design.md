# Ripple Track-Wide Speed Design

## Problem

Changing the speed of a whole video layer updates every clip duration but leaves each clip at its previous timeline start. Faster playback therefore creates gaps, while slower playback can create overlaps. Clips that were arranged back-to-back must remain attached after a track-wide speed change.

## Behavior

- Track-wide speed applies only to actual video clips on the selected signed video layer.
- Clips retain their existing chronological order, with original array order used as a stable tie-breaker.
- The first video clip keeps its current timeline start.
- Every later video clip starts at the previous video clip's recalculated end.
- Existing gaps and overlaps between videos on that selected layer are collapsed during a track-wide speed change.
- Each reciprocal linked audio clip receives the same speed, duration, and recalculated start as its video.
- Images, one-way audio links, and clips on other tracks remain unchanged.
- Per-clip speed editing keeps its existing independent behavior and does not ripple neighboring clips.
- Slider preview and completion continue to create one Undo history entry for one drag gesture.

## Implementation

Extend the pure `setVideoLayerSpeed` helper. It will gather eligible videos for the exact signed layer, sort them chronologically, calculate each new duration from its previous speed and requested speed, and assign contiguous starts. The resulting update map will be applied to both videos and reciprocal linked audio.

No UI restructuring is required because track-wide slider routing already calls this helper, while individual clip controls call the separate per-clip helper.

## Playback Performance

The timeline playhead represents output time and must advance at a constant 30 frames per second regardless of clip speed. Clip speed is already applied by source-time conversion and native video/audio `playbackRate`; multiplying the timeline timer by speed applies the speed twice and causes repeated corrective seeks. The playback timer will therefore advance by three frames every 100 milliseconds without reading the active clip speed.

Track-wide slider previews also change the full clip array repeatedly. Project autosave will be debounced so rapid preview updates cancel the previous pending write and produce one trailing save after the adjustment settles. Existing explicit Save behavior remains immediate.

## Verification

- A focused test will first reproduce gaps after speeding up several separated or adjacent clips.
- Tests will verify faster and slower speeds both keep clips contiguous.
- Tests will verify the first clip start, ordering, reciprocal audio timing, unrelated tracks, images, and one-way audio remain correct.
- Existing one-gesture Undo tests must continue to pass.
- A playback-clock regression test will verify that frame advancement is independent of clip speed.
- UI wiring coverage will verify autosave uses one trailing debounce rather than synchronously persisting every slider preview.
