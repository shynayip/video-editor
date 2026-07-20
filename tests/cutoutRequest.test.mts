import assert from "node:assert/strict";
import test from "node:test";
import {
  createAutomaticCutoutRequestTiming,
  createCutoutRequestSnapshot,
  getCutoutRequestSource,
  isCutoutRequestSnapshotCurrent,
} from "../src/cutoutRequest.ts";
import {
  applyAutomaticCutoutById,
  createCutoutVideoPair,
  resetCutoutMask,
  splitClipByIdAtFrame,
  trimClipById,
} from "../src/editorLogic.ts";
import type {TimelineClip} from "../src/editorLogic.ts";

const createSelectedCutout = (): TimelineClip => ({
  id: "cutout-request-person",
  label: "Person",
  track: "cutout",
  start: 45,
  duration: 150,
  color: "#0d9488",
  src: "uploads/person-original.mp4",
  sourceStart: 90,
  speed: 1.25,
  volume: 0.8,
  linkedClipId: "cutout-request-audio",
  cutout: {
    x: 42,
    y: 58,
    scale: 1.4,
    rotation: -12,
    mediaKind: "video",
    chromaKey: "green",
    maskStrokes: [
      {mode: "erase", size: 12, points: [{x: 10, y: 20}]},
    ],
  },
});

test("an unchanged selected cutout matches its request snapshot", () => {
  const clip = createSelectedCutout();
  const snapshot = createCutoutRequestSnapshot(clip);
  assert.ok(snapshot);
  const equivalentClip: TimelineClip = {
    ...clip,
    cutout: {
      ...clip.cutout!,
      maskStrokes: clip.cutout!.maskStrokes?.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({...point})),
      })),
    },
  };

  assert.equal(
    isCutoutRequestSnapshotCurrent(snapshot, clip.id, equivalentClip),
    true,
  );
  assert.equal(
    isCutoutRequestSnapshotCurrent(snapshot, "different-selection", equivalentClip),
    false,
  );
});

test("source and source-range edits invalidate a cutout request snapshot", () => {
  const clip = createSelectedCutout();
  const snapshot = createCutoutRequestSnapshot(clip);
  assert.ok(snapshot);
  const changedClips: Array<{label: string; clip: TimelineClip}> = [
    {label: "source", clip: {...clip, src: "uploads/person-replaced.mp4"}},
    {label: "timeline start", clip: {...clip, start: clip.start + 1}},
    {label: "duration", clip: {...clip, duration: clip.duration - 1}},
    {label: "source start", clip: {...clip, sourceStart: 0}},
    {label: "speed", clip: {...clip, speed: 2}},
  ];

  for (const changed of changedClips) {
    assert.equal(
      isCutoutRequestSnapshotCurrent(snapshot, clip.id, changed.clip),
      false,
      changed.label,
    );
  }
});

test("original source metadata edits invalidate a cutout request snapshot", () => {
  const originalClip = createSelectedCutout();
  const clip: TimelineClip = {
    ...originalClip,
    src: "uploads/person-transparent.webm",
    sourceStart: 0,
    cutout: {
      ...originalClip.cutout!,
      originalSrc: originalClip.src,
      originalSourceStart: originalClip.sourceStart,
    },
  };
  const snapshot = createCutoutRequestSnapshot(clip);
  assert.ok(snapshot);

  assert.equal(
    isCutoutRequestSnapshotCurrent(snapshot, clip.id, {
      ...clip,
      cutout: {...clip.cutout!, originalSrc: "uploads/replaced-original.mp4"},
    }),
    false,
  );
  assert.equal(
    isCutoutRequestSnapshotCurrent(snapshot, clip.id, {
      ...clip,
      cutout: {...clip.cutout!, originalSourceStart: 120},
    }),
    false,
  );
});

test("a repeated video cutout request uses the original source range", () => {
  const originalClip = createSelectedCutout();
  const processedClip: TimelineClip = {
    ...originalClip,
    src: "uploads/person-transparent.webm",
    sourceStart: 0,
    cutout: {
      ...originalClip.cutout!,
      originalSrc: originalClip.src,
      originalSourceStart: originalClip.sourceStart,
    },
  };

  assert.deepEqual(getCutoutRequestSource(processedClip), {
    src: "uploads/person-original.mp4",
    sourceStart: 90,
  });
});

test("a split processed video reprocesses and resets its right segment at the effective original offset", () => {
  const [createdVideo, createdAudio] = createCutoutVideoPair({
    videoId: "cutout-split-video",
    audioId: "cutout-split-audio",
    label: "Speaker",
    src: "uploads/speaker-original.mp4",
    start: 45,
    duration: 150,
  });
  const video = {...createdVideo, sourceStart: 90};
  const audio = {...createdAudio, sourceStart: 90};
  const processed = applyAutomaticCutoutById(
    [video, audio],
    video.id,
    "uploads/speaker-transparent.webm",
  );
  const split = splitClipByIdAtFrame(processed, video.id, 105);
  const rightVideo = split.find((clip) => clip.id === `${video.id}-b`);
  const rightAudio = split.find((clip) => clip.id === `${audio.id}-b`);
  assert.ok(rightVideo);
  assert.ok(rightAudio);

  assert.deepEqual(getCutoutRequestSource(rightVideo), {
    src: "uploads/speaker-original.mp4",
    sourceStart: 150,
  });

  const reprocessed = applyAutomaticCutoutById(
    split,
    rightVideo.id,
    "uploads/speaker-transparent-v2.webm",
  );
  const reprocessedVideo = reprocessed.find((clip) => clip.id === rightVideo.id);
  const reprocessedAudio = reprocessed.find((clip) => clip.id === rightAudio.id);
  assert.equal(reprocessedVideo?.sourceStart, 0);
  assert.equal(reprocessedVideo?.cutout?.originalSourceStart, 150);
  assert.strictEqual(reprocessedAudio, rightAudio);

  const reset = resetCutoutMask(reprocessed, rightVideo.id);
  const restoredVideo = reset.find((clip) => clip.id === rightVideo.id);
  const restoredAudio = reset.find((clip) => clip.id === rightAudio.id);
  assert.equal(restoredVideo?.src, "uploads/speaker-original.mp4");
  assert.equal(restoredVideo?.sourceStart, 150);
  assert.equal(restoredVideo?.cutout?.originalSrc, undefined);
  assert.equal(restoredVideo?.cutout?.originalSourceStart, undefined);
  assert.strictEqual(restoredAudio, rightAudio);
  assert.equal(restoredAudio?.sourceStart, restoredVideo?.sourceStart);
});

test("a left-trimmed processed video reprocesses and resets at the effective original offset", () => {
  const [createdVideo, createdAudio] = createCutoutVideoPair({
    videoId: "cutout-trim-video",
    audioId: "cutout-trim-audio",
    label: "Presenter",
    src: "uploads/presenter-original.mp4",
    start: 45,
    duration: 150,
  });
  const video = {...createdVideo, sourceStart: 90};
  const audio = {...createdAudio, sourceStart: 90};
  const processed = applyAutomaticCutoutById(
    [video, audio],
    video.id,
    "uploads/presenter-transparent.webm",
  );
  const trimmed = trimClipById(processed, video.id, "left", 30);
  const trimmedVideo = trimmed.find((clip) => clip.id === video.id);
  const trimmedAudio = trimmed.find((clip) => clip.id === audio.id);
  assert.ok(trimmedVideo);
  assert.ok(trimmedAudio);

  assert.deepEqual(getCutoutRequestSource(trimmedVideo), {
    src: "uploads/presenter-original.mp4",
    sourceStart: 120,
  });
  assert.equal(trimmedAudio.sourceStart, 120);

  const reprocessed = applyAutomaticCutoutById(
    trimmed,
    video.id,
    "uploads/presenter-transparent-v2.webm",
  );
  const reprocessedVideo = reprocessed.find((clip) => clip.id === video.id);
  const reprocessedAudio = reprocessed.find((clip) => clip.id === audio.id);
  assert.equal(reprocessedVideo?.sourceStart, 0);
  assert.equal(reprocessedVideo?.cutout?.originalSourceStart, 120);
  assert.strictEqual(reprocessedAudio, trimmedAudio);

  const reset = resetCutoutMask(reprocessed, video.id);
  const restoredVideo = reset.find((clip) => clip.id === video.id);
  const restoredAudio = reset.find((clip) => clip.id === audio.id);
  assert.equal(restoredVideo?.src, "uploads/presenter-original.mp4");
  assert.equal(restoredVideo?.sourceStart, 120);
  assert.equal(restoredVideo?.cutout?.originalSrc, undefined);
  assert.equal(restoredVideo?.cutout?.originalSourceStart, undefined);
  assert.strictEqual(restoredAudio, trimmedAudio);
  assert.equal(restoredAudio?.sourceStart, restoredVideo?.sourceStart);
});

test("automatic cutout timing uses the split segment's effective original range", () => {
  const [createdVideo, createdAudio] = createCutoutVideoPair({
    videoId: "cutout-timing-split-video",
    audioId: "cutout-timing-split-audio",
    label: "Speaker",
    src: "uploads/speaker-original.mp4",
    start: 45,
    duration: 150,
  });
  const video = {...createdVideo, sourceStart: 90, speed: 1.5};
  const audio = {...createdAudio, sourceStart: 90, speed: 1.5};
  const processed = applyAutomaticCutoutById(
    [video, audio],
    video.id,
    "uploads/speaker-transparent.webm",
  );
  const split = splitClipByIdAtFrame(processed, video.id, 105);
  const rightVideo = split.find((clip) => clip.id === `${video.id}-b`);
  const rightAudio = split.find((clip) => clip.id === `${audio.id}-b`);
  assert.ok(rightVideo);
  assert.ok(rightAudio);

  const timing = createAutomaticCutoutRequestTiming(rightVideo, 30);
  assert.ok(timing);
  assert.deepEqual({
    sourceStartSeconds: timing.sourceStartSeconds,
    durationSeconds: timing.durationSeconds,
  }, {
    sourceStartSeconds: 6,
    durationSeconds: 4.5,
  });

  const reprocessed = applyAutomaticCutoutById(
    split,
    rightVideo.id,
    "uploads/speaker-transparent-v2.webm",
  );
  assert.strictEqual(
    reprocessed.find((clip) => clip.id === rightAudio.id),
    rightAudio,
  );
});

test("automatic cutout timing uses the left-trimmed segment's effective original range", () => {
  const [createdVideo, createdAudio] = createCutoutVideoPair({
    videoId: "cutout-timing-trim-video",
    audioId: "cutout-timing-trim-audio",
    label: "Presenter",
    src: "uploads/presenter-original.mp4",
    start: 45,
    duration: 150,
  });
  const video = {...createdVideo, sourceStart: 90, speed: 1.5};
  const audio = {...createdAudio, sourceStart: 90, speed: 1.5};
  const processed = applyAutomaticCutoutById(
    [video, audio],
    video.id,
    "uploads/presenter-transparent.webm",
  );
  const trimmed = trimClipById(processed, video.id, "left", 30);
  const trimmedVideo = trimmed.find((clip) => clip.id === video.id);
  const trimmedAudio = trimmed.find((clip) => clip.id === audio.id);
  assert.ok(trimmedVideo);
  assert.ok(trimmedAudio);

  const timing = createAutomaticCutoutRequestTiming(trimmedVideo, 30);
  assert.ok(timing);
  assert.deepEqual({
    sourceStartSeconds: timing.sourceStartSeconds,
    durationSeconds: timing.durationSeconds,
  }, {
    sourceStartSeconds: 4.5,
    durationSeconds: 6,
  });

  const reprocessed = applyAutomaticCutoutById(
    trimmed,
    trimmedVideo.id,
    "uploads/presenter-transparent-v2.webm",
  );
  assert.strictEqual(
    reprocessed.find((clip) => clip.id === trimmedAudio.id),
    trimmedAudio,
  );
});

test("mask edits invalidate a cutout request snapshot", () => {
  const clip = createSelectedCutout();
  const snapshot = createCutoutRequestSnapshot(clip);
  assert.ok(snapshot);
  const changedClip: TimelineClip = {
    ...clip,
    cutout: {
      ...clip.cutout!,
      maskStrokes: [
        ...(clip.cutout!.maskStrokes ?? []),
        {mode: "restore", size: 8, points: [{x: 30, y: 40}]},
      ],
    },
  };

  assert.equal(
    isCutoutRequestSnapshotCurrent(snapshot, clip.id, changedClip),
    false,
  );
});

test("transform and chroma edits invalidate a cutout request snapshot", () => {
  const clip = createSelectedCutout();
  const snapshot = createCutoutRequestSnapshot(clip);
  assert.ok(snapshot);
  const changedClips: Array<{label: string; clip: TimelineClip}> = [
    {label: "x", clip: {...clip, cutout: {...clip.cutout!, x: 50}}},
    {label: "y", clip: {...clip, cutout: {...clip.cutout!, y: 50}}},
    {label: "scale", clip: {...clip, cutout: {...clip.cutout!, scale: 2}}},
    {label: "rotation", clip: {...clip, cutout: {...clip.cutout!, rotation: 10}}},
    {label: "chroma", clip: {...clip, cutout: {...clip.cutout!, chromaKey: "white"}}},
  ];

  for (const changed of changedClips) {
    assert.equal(
      isCutoutRequestSnapshotCurrent(snapshot, clip.id, changed.clip),
      false,
      changed.label,
    );
  }
});
