import assert from "node:assert/strict";
import test from "node:test";
import {
  createSceneMediaItems,
  createVideoMediaPair,
  getPublicMediaFallbackSource,
  getClipSourceTime,
  isPlayableMediaResponse,
  isStoredUploadSource,
  reconnectMediaSource,
  reconcileClipSourceDuration,
  trimClipById,
} from "../src/editorLogic.ts";
import type {TimelineClip} from "../src/editorLogic.ts";

test("repairs an imported clip that extends past its ten second source", () => {
  const clips: TimelineClip[] = [
    {
      id: "video",
      label: "Scene 1",
      track: "main",
      start: 1111,
      duration: 390,
      sourceStart: 0,
      src: "scene.mp4",
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Scene 1 audio",
      track: "audio",
      start: 1111,
      duration: 390,
      sourceStart: 0,
      src: "scene.mp4",
      color: "#2563eb",
      linkedClipId: "video",
    },
  ];

  const repaired = reconcileClipSourceDuration(clips, "scene.mp4", 300);

  assert.deepEqual(
    repaired.map(({duration, sourceDuration}) => ({duration, sourceDuration})),
    [
      {duration: 300, sourceDuration: 300},
      {duration: 300, sourceDuration: 300},
    ],
  );
});

test("accounts for source offset and speed when repairing imported timing", () => {
  const clip: TimelineClip = {
    id: "video",
    label: "Trimmed scene",
    track: "upper",
    start: 0,
    duration: 180,
    sourceStart: 60,
    sourceDuration: 300,
    speed: 2,
    src: "scene.mp4",
    color: "#7c3aed",
  };

  const [repaired] = reconcileClipSourceDuration([clip], "scene.mp4", 300);

  assert.equal(repaired.duration, 120);
  assert.equal(getClipSourceTime(repaired, 30, 30), 4);
});

test("carries the complete source duration from import into linked timeline clips", () => {
  const [mediaItem] = createSceneMediaItems({
    sourceFileId: "source-1",
    label: "Scene.mp4",
    src: "scene.mp4",
    ranges: [{startSeconds: 0, endSeconds: 10}],
    fps: 30,
    sourceDurationInFrames: 300,
  });
  const clips = createVideoMediaPair({
    videoId: "video",
    audioId: "audio",
    track: "main",
    label: mediaItem.label,
    src: mediaItem.src,
    start: 0,
    duration: mediaItem.durationInFrames,
    sourceStart: mediaItem.sourceStart,
    sourceDuration: mediaItem.sourceDurationInFrames,
  });

  assert.equal(mediaItem.sourceDurationInFrames, 300);
  assert.deepEqual(clips.map(({sourceDuration}) => sourceDuration), [300, 300]);
});

test("prevents a right trim from extending video and audio beyond the source", () => {
  const clips = createVideoMediaPair({
    videoId: "video",
    audioId: "audio",
    track: "main",
    label: "Ten second clip",
    src: "scene.mp4",
    start: 0,
    duration: 240,
    sourceDuration: 300,
  });

  const trimmed = trimClipById(clips, "video", "right", 120);

  assert.deepEqual(trimmed.map(({duration}) => duration), [300, 300]);
});

test("reconnects a missing upload only to the same named public video", () => {
  const clips = createVideoMediaPair({
    videoId: "video",
    audioId: "audio",
    track: "main",
    label: "Character talking - Scene 1",
    src: "uploads/Character-talking-old-id.mp4",
    start: 0,
    duration: 390,
    sourceDuration: 390,
  });
  const fallback = getPublicMediaFallbackSource(clips[0]);

  assert.equal(fallback, "Character talking.mp4");
  assert.ok(fallback);
  const reconnected = reconnectMediaSource(
    clips,
    "uploads/Character-talking-old-id.mp4",
    fallback,
  );
  assert.deepEqual(reconnected.map(({label}) => label), [
    "Character talking - Scene 1",
    "Character talking - Scene 1 audio",
  ]);
  assert.deepEqual(reconnected.map(({src}) => src), [fallback, fallback]);
  assert.deepEqual(reconnected.map(({sourceDuration}) => sourceDuration), [
    undefined,
    undefined,
  ]);
});

test("rejects Vite's HTML fallback when checking a missing video", () => {
  const response = (ok: boolean, contentType: string) => ({
    ok,
    headers: {get: () => contentType},
  });

  assert.equal(isPlayableMediaResponse(response(true, "text/html")), false);
  assert.equal(isPlayableMediaResponse(response(true, "video/mp4")), true);
});

test("recognizes saved upload paths with or without a leading slash", () => {
  assert.equal(isStoredUploadSource("uploads/clip.mp4"), true);
  assert.equal(isStoredUploadSource("/uploads/clip.mp4"), true);
  assert.equal(isStoredUploadSource("clip.mp4"), false);
});
