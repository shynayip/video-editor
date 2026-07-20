# Cutout Media Design

## Goal

Add a dedicated Cutout tool for placing imported images or videos above the edited video. A cutout remains independently movable, resizable, rotatable, trimmable, splittable, deletable, and undoable.

## User Flow

The top bar contains a Cutout tab. The user imports an image or video from that panel. The new object is inserted at the red playhead, selected, and shown on a Cutout track. The user drags the object directly on the preview, uses its corner and rotation handles, and uses the timeline trim handles to control how long it remains visible.

Video cutouts create a reciprocal linked audio clip at the same timeline position. Selecting the video cutout reveals only its linked audio row. Trimming, splitting, deleting, speed changes, and volume changes keep both clips synchronized. Image cutouts do not create audio.

## Data Model

`TimelineClip` gains a `cutout` transform containing position, scale, rotation, and media kind. Cutout clips use the dedicated `cutout` track. Video cutouts have reciprocal `linkedClipId` references to an audio clip; image cutouts do not.

## Rendering

Active cutouts render after the regular video layers and before text/captions. Images use an image element and videos use a muted video element synchronized to the playhead; linked audio is rendered through the existing audio playback system. This first version supports transparent image/video assets and ordinary rectangular media. Automatic AI background removal is outside this scope.

## Persistence And Export

Cutout files upload into `public/uploads`, so saved projects survive refresh and Remotion export can resolve the files. The existing project serializer includes the new clip properties without a schema migration.

## Verification

Logic tests cover image creation, video/audio pairing, contextual audio, playback audio, trimming, splitting, and deletion. UI tests cover the Cutout tab, file input, preview rendering, timeline row, and transform handles. TypeScript, ESLint, and the existing test suites must pass.
