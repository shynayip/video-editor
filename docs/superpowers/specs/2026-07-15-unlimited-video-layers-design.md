# Unlimited Video Layers Design

## Goal

Allow users to create as many independent video tracks as needed above or below the main track, without automatically placing imported media or silently restricting videos to one overlay group.

## Media Import

Importing video adds it only to the Media gallery. Import does not change the timeline.

Users place imported media by dragging it to:

- An existing video track.
- The New track above drop area.
- The New track below drop area.

## Layer Model

The main track stays fixed at layer 0.

Secondary video tracks use signed layer numbers:

- Positive layers are above the main track.
- Negative layers are below the main track.
- A larger positive number appears visually above smaller positive numbers.
- A smaller negative number appears visually behind larger negative numbers.

The timeline derives its video-track rows from clips, so there is no fixed track limit. Empty secondary tracks disappear automatically because they contain no clips.

## Creating Tracks

The timeline always shows two compact drop areas:

- New track above, before all upper video rows.
- New track below, after all lower video rows.

Dropping media on New track above creates the next positive layer. Dropping media on New track below creates the next negative layer. The new clip starts at the horizontal drop position and keeps its natural duration.

## Existing Track Drops

Dropping media onto empty time in an existing video track places the clip at the horizontal drop position.

If the new clip's time range overlaps one or more clips on that track, every overlapping video clip is removed completely and the new video replaces that range. Each removed video's reciprocal linked audio is also removed. The new video keeps its own natural duration, even when it is shorter than the removed footage and leaves empty timeline space.

Moving an existing secondary video clip to another video layer follows the same replacement rule. The moved clip keeps its source timing, duration, visual settings, speed, volume, and linked audio.

## Main Track

The main track remains the primary sequential narrative track. Users can drag imported media onto it at a chosen time. A drop onto occupied main-track footage uses the same complete replacement rule.

The existing merge-to-end behavior remains available when media is dropped after the current main-track ending.

## Preview Compositing

At the playhead, active layers render in this order:

1. Negative video layers, from furthest back to nearest the main track.
2. Main-track video.
3. Positive video layers, from nearest the main track to highest.
4. Stickers, text, and captions.

Higher rendered layers cover lower layers. A video below the main track is visible only where higher layers are absent, hidden, transparent, cropped, or visually faded.

## Audio

Every imported video continues to receive reciprocal linked audio.

- Moving a video moves its linked audio to the same start time.
- Replacing or deleting a video removes only its reciprocal linked audio.
- Independent narration audio is never removed by video-layer replacement.
- Playback uses the audio belonging to the highest visible active video layer, plus independent narration.

## Selection and Editing

Each clip remains individually selectable. Split, trim, speed, volume, effects, filters, hide, delete, and Undo/Redo continue to operate on the selected clip only.

The red playhead spans all visible video and audio rows.

## Safety and Validation

- Clamp dropped clip starts to frame 0 or later.
- Do not allow main or secondary video clips to overlap on the same layer after a completed drop.
- Never remove clips from another video layer during replacement.
- Never remove unrelated audio, captions, text, stickers, or narration.
- Canceling a drag leaves the timeline unchanged.

## Testing

- Test unlimited positive and negative layer assignment.
- Test that importing media does not mutate the timeline.
- Test creation through both new-track drop areas.
- Test empty-space placement and occupied-range replacement.
- Test linked-audio movement and removal while preserving narration.
- Test preview ordering above and below the main track.
- Test dynamic row ordering and drop-target wiring.
- Run the complete editor tests, ESLint, TypeScript checks, and local page availability check.
