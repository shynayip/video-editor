import assert from "node:assert/strict";
import test from "node:test";
import {
  addOverlayClip,
  addOverlayMediaClip,
  addTranscriptCaptions,
  applyTimelineHistoryEdit,
  advanceTimelinePlaybackFrame,
  stepTimelinePlayback,
  canDropClipOnMainTrack,
  createTrailingAutosaveScheduler,
  changeFirstClipSpeed,
  clampPlayheadFrame,
  createRecordedAudioClip,
  createSceneMediaItems,
  getInitialNextSourceGroupIndex,
  normalizeMediaSceneLabels,
  createImageMediaClip,
  createVideoMediaPair,
  createBackgroundMusicClip,
  createCutoutImageClip,
  createCutoutVideoPair,
  createMainMediaPair,
  createStickerClip,
  createTextClip,
  createSavedEditorProject,
  createTimelineHistory,
  deleteClipById,
  duplicateClipById,
  getClipSourceTime,
  getClipAnimationPreviewFrame,
  getContextualAudioClips,
  getExpandedTimelineBoundary,
  getStableTimelineFrameDelta,
  getDragEdgeAutoScrollDelta,
  getTimelineFrameFromPointer,
  getManualRotationAngle,
  getVisibleRotateHandleTop,
  getActiveClipAtFrame,
  getActiveClipsAtFrame,
  getActiveOverlayClipsAtFrame,
  getActiveVideoLayersAtFrame,
  getTopVisibleVideoClipAtFrame,
  getVisualToolTargetClipId,
  getVideoLayer,
  getVideoLayerEnd,
  getIndependentPlaybackAudioClips,
  getPlaybackAudioClips,
  formatTimelineClock,
  formatTimelineTimecode,
  createTimelineTicks,
  getTimelineDuration,
  moveVideoClipToLayer,
  placeVideoPairInInsertedLayer,
  placeVideoPairOnLayer,
  insertVideoPairOnLayerAtFrame,
  hasClipsOnTrack,
  findAvailableOverlayLane,
  getTimelineTransitionBoundaries,
  getClipTransitionPresentation,
  setTrackVolume,
  hideFirstClipOnTrack,
  moveClipToMainTrack,
  moveCutoutClip,
  moveOverlayClip,
  moveTextClip,
  moveIndependentTimelineClip,
  moveTextOverlay,
  parseSavedEditorProject,
  appendStickerClip,
  defaultCaptionStyle,
  defaultClipAdjustment,
  createGeneratedCaptionClips,
  createManualCaptionClip,
  replaceClipMediaById,
  replaceGeneratedCaptionBatch,
  replaceFirstClipOnTrack,
  removeBrowserOnlySavedMedia,
  keepDominantVoiceInLinkedVideo,
  removeSilenceFromLinkedVideo,
  redoTimelineHistory,
  setClipSpeedById,
  setClipVolumeById,
  setClipTransitionById,
  setVideoLayerSpeed,
  setVideoLayerVolume,
  getVideoLayerControlState,
  previewVideoLayerControlHistoryGesture,
  finishVideoLayerControlHistoryGesture,
  startVideoLayerControlHistoryGesture,
  toggleClipMuteById,
  isTrackHidden,
  toggleTrackVisibility,
  setClipEffectById,
  setClipFilterById,
  setClipAnimationById,
  setCutoutChromaKeyById,
  setTextStyleById,
  setTextContentById,
  getTextAnimationPresentation,
  getTextAnimationStars,
  getTextAnimationVisibleCharacterCount,
  getTextAnimationWordPresentation,
  setTextRotationById,
  setCaptionStyleById,
  splitSceneMediaItemAtFrame,
  subtractSourceRanges,
  appendCutoutMaskStroke,
  applyAutomaticCutoutById,
  createCutoutMaskDataUrl,
  createCutoutRestoreMaskDataUrl,
  resetCutoutMask,
  removeBackgroundPixels,
  removeUnusedMediaItem,
  resizeTextOverlayById,
  resizeTextOverlayBoxById,
  resizeCutoutTransform,
  getRotatedTextResizeDelta,
  getResizedTextFontSize,
  getCaptionPosition,
  getEffectiveCutoutOriginalSourceStart,
  moveCaptionOverlay,
  resizeCaptionOverlayById,
  getResizedCaptionFontSize,
  getResizedCaptionFontSizeFromHandle,
  getMaximumFittingCaptionFontSize,
  createWaveformBars,
  splitClipOnTrackAtFrame,
  splitClipByIdAtFrame,
  splitFirstClipOnTrack,
  shouldMovePlayheadDuringScrub,
  shouldShowAudioTrackForSelection,
  trimClipById,
  synchronizeOriginalAudio,
  undoTimelineHistory,
} from "../src/editorLogic.ts";
import type { TimelineClip } from "../src/editorLogic.ts";

const historyClip = (id: string): TimelineClip => ({
  id,
  label: id,
  track: "main",
  start: 0,
  duration: 30,
  color: "#0891b2",
});

test("creates deterministic virtual scene cards that share their source URL", () => {
  const items = createSceneMediaItems({
    sourceFileId: "source-1",
    sourceGroupIndex: 1,
    label: "Interview.mp4",
    src: "uploads/interview.mp4",
    ranges: [
      { startSeconds: 0, endSeconds: 2 },
      { startSeconds: 2, endSeconds: 5 },
    ],
    fps: 30,
  });

  assert.deepEqual(items, [
    {
      id: "scene-source-1-0",
      label: "Scene 1.1",
      src: "uploads/interview.mp4",
      duration: "00:02",
      durationInFrames: 60,
      kind: "local",
      mediaType: "video",
      sourceFileId: "source-1",
      sourceStart: 0,
      sourceGroupIndex: 1,
      sourceLabel: "Interview.mp4",
      sceneIndex: 1,
    },
    {
      id: "scene-source-1-60",
      label: "Scene 1.2",
      src: "uploads/interview.mp4",
      duration: "00:03",
      durationInFrames: 90,
      kind: "local",
      mediaType: "video",
      sourceFileId: "source-1",
      sourceStart: 60,
      sourceGroupIndex: 1,
      sourceLabel: "Interview.mp4",
      sceneIndex: 2,
    },
  ]);
});

test("creates grouped scene labels and preserves the original source name", () => {
  const items = createSceneMediaItems({
    sourceFileId: "source-a",
    sourceGroupIndex: 2,
    label: "Interview.mp4",
    src: "/uploads/interview.mp4",
    ranges: [
      { startSeconds: 0, endSeconds: 2 },
      { startSeconds: 2, endSeconds: 5 },
    ],
    fps: 30,
    sourceDurationInFrames: 150,
  });

  assert.deepEqual(
    items.map(({ label, sourceGroupIndex, sourceLabel, sceneIndex }) => ({
      label,
      sourceGroupIndex,
      sourceLabel,
      sceneIndex,
    })),
    [
      {
        label: "Scene 2.1",
        sourceGroupIndex: 2,
        sourceLabel: "Interview.mp4",
        sceneIndex: 1,
      },
      {
        label: "Scene 2.2",
        sourceGroupIndex: 2,
        sourceLabel: "Interview.mp4",
        sceneIndex: 2,
      },
    ],
  );
});

test("continues source groups from the persisted counter after deletion", () => {
  const remainingItems = [
    {
      id: "whole-1",
      label: "Whole.mp4",
      src: "/uploads/whole.mp4",
      duration: "00:05",
      durationInFrames: 150,
      kind: "public" as const,
      mediaType: "video" as const,
      sourceGroupIndex: 1,
    },
  ];

  assert.equal(getInitialNextSourceGroupIndex(remainingItems, 4), 4);
});

test("normalizes grouped and whole-video scene labels after loading", () => {
  const normalized = normalizeMediaSceneLabels([
    {
      id: "grouped",
      label: "Old grouped label",
      src: "/uploads/grouped.mp4",
      duration: "00:02",
      durationInFrames: 60,
      kind: "public",
      mediaType: "video",
      sourceFileId: "source-1",
      sourceGroupIndex: 1,
      sceneIndex: 2,
    },
    {
      id: "whole",
      label: "Whole video.mp4",
      src: "/uploads/whole.mp4",
      duration: "00:05",
      durationInFrames: 150,
      kind: "public",
      mediaType: "video",
      sourceGroupIndex: 4,
    },
  ]);

  assert.deepEqual(
    normalized.map(({ label, sourceLabel }) => ({ label, sourceLabel })),
    [
      { label: "Scene 1.2", sourceLabel: "Old grouped label" },
      { label: "Scene 4", sourceLabel: "Whole video.mp4" },
    ],
  );
});

test("splits one scene and renumbers only its source cards", () => {
  const scenes = createSceneMediaItems({
    sourceFileId: "source-1",
    sourceGroupIndex: 1,
    label: "Interview.mp4",
    src: "uploads/interview.mp4",
    ranges: [
      { startSeconds: 0, endSeconds: 2 },
      { startSeconds: 2, endSeconds: 4 },
    ],
    fps: 30,
  });
  const unrelated = {
    id: "other-source",
    label: "B-roll.mp4",
    src: "uploads/b-roll.mp4",
    duration: "00:02",
    durationInFrames: 60,
    kind: "local" as const,
  };

  const result = splitSceneMediaItemAtFrame({
    mediaItems: [scenes[0], scenes[1], unrelated],
    mediaId: "scene-source-1-60",
    relativeFrame: 30,
  });

  assert.deepEqual(
    result.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.label,
      sourceStart: item.sourceStart,
      durationInFrames: item.durationInFrames,
      sourceGroupIndex: item.sourceGroupIndex,
      sceneIndex: item.sceneIndex,
    })),
    [
      {
        id: "scene-source-1-0",
        label: "Scene 1.1",
        sourceStart: 0,
        durationInFrames: 60,
        sourceGroupIndex: 1,
        sceneIndex: 1,
      },
      {
        id: "scene-source-1-60",
        label: "Scene 1.2",
        sourceStart: 60,
        durationInFrames: 30,
        sourceGroupIndex: 1,
        sceneIndex: 2,
      },
      {
        id: "scene-source-1-90",
        label: "Scene 1.3",
        sourceStart: 90,
        durationInFrames: 30,
        sourceGroupIndex: 1,
        sceneIndex: 3,
      },
    ],
  );
  assert.strictEqual(result[3], unrelated);
});

test("rejects manual scene splits at invalid boundaries", () => {
  const scenes = createSceneMediaItems({
    sourceFileId: "source-1",
    sourceGroupIndex: 1,
    label: "Interview.mp4",
    src: "uploads/interview.mp4",
    ranges: [{ startSeconds: 0, endSeconds: 2 }],
    fps: 30,
  });

  assert.strictEqual(
    splitSceneMediaItemAtFrame({
      mediaItems: scenes,
      mediaId: scenes[0].id,
      relativeFrame: 0,
    }),
    scenes,
  );
  assert.strictEqual(
    splitSceneMediaItemAtFrame({
      mediaItems: scenes,
      mediaId: scenes[0].id,
      relativeFrame: scenes[0].durationInFrames,
    }),
    scenes,
  );
  assert.strictEqual(
    splitSceneMediaItemAtFrame({
      mediaItems: scenes,
      mediaId: scenes[0].id,
      relativeFrame: Number.NaN,
    }),
    scenes,
  );
});

test("calculates project duration from the furthest clip on any track", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Main",
      track: "main",
      start: 0,
      duration: 480,
      color: "#0891b2",
    },
    {
      id: "overlay",
      label: "Overlay",
      track: "upper",
      start: 108000,
      duration: 9000,
      color: "#7c3aed",
    },
    {
      id: "text",
      label: "Text",
      track: "caption",
      start: 120000,
      duration: 300,
      color: "#f97316",
    },
  ];

  assert.equal(getTimelineDuration(clips), 120300);
  assert.equal(getTimelineDuration([]), 1);
});

test("finds the end of only the requested video layer", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main 1",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
    },
    {
      id: "main-2",
      label: "Main 2",
      track: "main",
      start: 120,
      duration: 90,
      color: "#0891b2",
    },
    {
      id: "overlay",
      label: "Overlay",
      track: "upper",
      start: 0,
      duration: 400,
      color: "#7c3aed",
      videoLayer: 1,
    },
    {
      id: "audio",
      label: "Narration",
      track: "audio",
      start: 0,
      duration: 600,
      color: "#2563eb",
    },
  ];

  assert.equal(getVideoLayerEnd(clips, 0), 210);
  assert.equal(getVideoLayerEnd(clips, 1), 400);
  assert.equal(getVideoLayerEnd(clips, 2), 0);
});

test("derives transitions only between adjacent clips on one video layer", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 20,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };
  const gap: TimelineClip = {
    id: "gap",
    label: "Gap",
    track: "main",
    start: 60,
    duration: 10,
    color: "#0891b2",
    videoLayer: 0,
    src: "gap.mp4",
  };
  const upper: TimelineClip = {
    id: "upper",
    label: "Upper",
    track: "upper",
    start: 30,
    duration: 20,
    color: "#7c3aed",
    videoLayer: 1,
    src: "upper.mp4",
  };

  assert.deepEqual(
    getTimelineTransitionBoundaries([gap, upper, second, first], 0),
    [
      {
        outgoingClipId: "first",
        incomingClipId: "second",
        frame: 30,
      },
    ],
  );
  assert.deepEqual(
    getTimelineTransitionBoundaries([gap, upper, second, first], 1),
    [],
  );
});

test("clamps and removes an incoming clip transition", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 12,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };

  const applied = setClipTransitionById([first, second], "second", "fade", 40);
  assert.deepEqual(applied[1].transition, { preset: "fade", duration: 12 });

  const removed = setClipTransitionById(applied, "second", "none", 12);
  assert.equal(removed[1].transition, undefined);
  assert.equal(Object.hasOwn(removed[1], "transition"), false);
});

test("presents both sides of a fade around an adjacent boundary", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };
  const clips = setClipTransitionById([first, second], "second", "fade", 10);

  assert.deepEqual(getClipTransitionPresentation(clips, "first", 24), {
    opacity: 1,
    translateX: 0,
    scale: 1,
  });
  assert.deepEqual(getClipTransitionPresentation(clips, "second", 36), {
    opacity: 1,
    translateX: 0,
    scale: 1,
  });
  assert.deepEqual(getClipTransitionPresentation(clips, "first", 30), {
    opacity: 0.5,
    translateX: 0,
    scale: 1,
  });
  assert.deepEqual(getClipTransitionPresentation(clips, "second", 30), {
    opacity: 0.5,
    translateX: 0,
    scale: 1,
  });
});

test("presents dissolve, slide, and zoom deterministically for both transition sides", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };

  const cases = [
    {
      preset: "dissolve" as const,
      outgoing: { opacity: 0.5, translateX: 0, scale: 1 },
      incoming: { opacity: 0.5, translateX: 0, scale: 1 },
    },
    {
      preset: "slide" as const,
      outgoing: { opacity: 1, translateX: -6, scale: 1 },
      incoming: { opacity: 1, translateX: 6, scale: 1 },
    },
    {
      preset: "zoom" as const,
      outgoing: { opacity: 0.5, translateX: 0, scale: 1.03 },
      incoming: { opacity: 0.5, translateX: 0, scale: 0.97 },
    },
  ];

  for (const transitionCase of cases) {
    const clips = setClipTransitionById(
      [first, second],
      "second",
      transitionCase.preset,
      10,
    );

    assert.deepEqual(
      getClipTransitionPresentation(clips, "first", 30),
      transitionCase.outgoing,
    );
    assert.deepEqual(
      getClipTransitionPresentation(clips, "second", 30),
      transitionCase.incoming,
    );
  }
});

test("presents both sides at the midpoint of a one-frame transition", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };
  const cases = [
    {
      preset: "fade" as const,
      outgoing: { opacity: 0.5, translateX: 0, scale: 1 },
      incoming: { opacity: 0.5, translateX: 0, scale: 1 },
    },
    {
      preset: "dissolve" as const,
      outgoing: { opacity: 0.5, translateX: 0, scale: 1 },
      incoming: { opacity: 0.5, translateX: 0, scale: 1 },
    },
    {
      preset: "zoom" as const,
      outgoing: { opacity: 0.5, translateX: 0, scale: 1.03 },
      incoming: { opacity: 0.5, translateX: 0, scale: 0.97 },
    },
  ];

  for (const transitionCase of cases) {
    const clips = setClipTransitionById(
      [first, second],
      "second",
      transitionCase.preset,
      1,
    );

    assert.deepEqual(
      getClipTransitionPresentation(clips, "first", 30),
      transitionCase.outgoing,
    );
    assert.deepEqual(
      getClipTransitionPresentation(clips, "second", 30),
      transitionCase.incoming,
    );
  }

  const fadeClips = setClipTransitionById([first, second], "second", "fade", 1);
  assert.deepEqual(getClipTransitionPresentation(fadeClips, "first", 31), {
    opacity: 0,
    translateX: 0,
    scale: 1,
  });
  assert.deepEqual(getClipTransitionPresentation(fadeClips, "second", 31), {
    opacity: 1,
    translateX: 0,
    scale: 1,
  });
});

test("selects the active transition when a clip belongs to two adjacent edges", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
  };
  const third: TimelineClip = {
    id: "third",
    label: "Third",
    track: "main",
    start: 60,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "third.mp4",
  };
  const withFade = setClipTransitionById(
    [first, second, third],
    "second",
    "fade",
    10,
  );
  const clips = setClipTransitionById(withFade, "third", "slide", 10);

  assert.deepEqual(getClipTransitionPresentation(clips, "second", 60), {
    opacity: 1,
    translateX: -6,
    scale: 1,
  });
});

test("returns neutral transition presentation when either adjacent clip is hidden", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    videoLayer: 0,
    src: "second.mp4",
    transition: { preset: "fade", duration: 10 },
  };
  const neutral = { opacity: 1, translateX: 0, scale: 1 };

  assert.deepEqual(
    getClipTransitionPresentation(
      [{ ...first, hidden: true }, second],
      "second",
      30,
    ),
    neutral,
  );
  assert.deepEqual(
    getClipTransitionPresentation(
      [first, { ...second, hidden: true }],
      "first",
      30,
    ),
    neutral,
  );
});

test("removes an incoming transition when deleting its predecessor", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    transition: { preset: "fade", duration: 12 },
  };

  const result = deleteClipById([first, second], "first");

  assert.deepEqual(
    result.map((clip) => clip.id),
    ["second"],
  );
  assert.equal(result[0].transition, undefined);
  assert.equal(Object.hasOwn(result[0], "transition"), false);
});

test("does not copy a transition onto a non-adjacent duplicate", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    transition: { preset: "fade", duration: 12 },
  };

  const result = duplicateClipById([first, second], "second", "copy");
  const duplicate = result.find((clip) => clip.id === "copy-video");

  assert.ok(duplicate);
  assert.equal(duplicate.videoLayer, 1);
  assert.equal(duplicate.transition, undefined);
  assert.equal(Object.hasOwn(duplicate, "transition"), false);
});

test("reclamps an incoming transition after speed shrinks its clip", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    speed: 1,
    transition: { preset: "fade", duration: 20 },
  };

  const result = setClipSpeedById([first, second], "second", 3);

  assert.equal(result[1].duration, 10);
  assert.deepEqual(result[1].transition, { preset: "fade", duration: 10 });
});

test("removes an incoming transition when trimming creates a gap", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    transition: { preset: "fade", duration: 12 },
  };

  const result = trimClipById([first, second], "first", "right", -10, 1);

  assert.equal(result[0].duration, 20);
  assert.equal(result[1].transition, undefined);
});

test("does not copy an incoming transition onto the right side of a split", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    transition: { preset: "fade", duration: 20 },
  };

  const result = splitClipByIdAtFrame([first, second], "second", 40);

  assert.deepEqual(result.find((clip) => clip.id === "second-a")?.transition, {
    preset: "fade",
    duration: 10,
  });
  assert.equal(
    result.find((clip) => clip.id === "second-b")?.transition,
    undefined,
  );
});

test("removes an incoming transition when moving its clip across a gap", () => {
  const first: TimelineClip = {
    id: "first",
    label: "First",
    track: "main",
    start: 0,
    duration: 30,
    color: "#0891b2",
    src: "first.mp4",
  };
  const second: TimelineClip = {
    id: "second",
    label: "Second",
    track: "main",
    start: 30,
    duration: 30,
    color: "#0891b2",
    src: "second.mp4",
    transition: { preset: "fade", duration: 12 },
  };

  const result = moveVideoClipToLayer([first, second], "second", 0, 60);

  assert.equal(result.find((clip) => clip.id === "second")?.start, 60);
  assert.equal(
    result.find((clip) => clip.id === "second")?.transition,
    undefined,
  );
});

test("formats timeline clocks beyond one hour", () => {
  assert.equal(formatTimelineClock(16 * 30, 30), "00:16");
  assert.equal(formatTimelineClock((60 * 60 + 5) * 30, 30), "01:00:05");
});

test("formats fixed timeline timecode", () => {
  assert.equal(formatTimelineTimecode(0, 30), "00:00:00");
  assert.equal(formatTimelineTimecode(16 * 30, 30), "00:00:16");
  assert.equal(formatTimelineTimecode(60 * 30, 30), "00:01:00");
  assert.equal(formatTimelineTimecode(3661 * 30, 30), "01:01:01");
});

test("creates ruler ticks through the dynamic project end", () => {
  const ticks = createTimelineTicks(2 * 60 * 60 * 30, 30);
  assert.equal(ticks[0].label, "00:00");
  assert.equal(ticks.at(-1)?.label, "02:00:00");
  assert.ok(ticks.length >= 5 && ticks.length <= 12);
});

test("creates readable ruler ticks for a project beyond seventeen hours", () => {
  const duration = (17 * 60 * 60 + 1) * 30;
  const ticks = createTimelineTicks(duration, 30);

  assert.equal(ticks[0].label, "00:00");
  assert.equal(ticks.at(-1)?.label, "17:00:01");
  assert.ok(ticks.length >= 5 && ticks.length <= 12);
});

test("deduplicates identical labels at the final ruler tick", () => {
  const ticks = createTimelineTicks(241, 30);

  assert.equal(ticks.at(-1)?.frame, 241);
  assert.deepEqual(
    ticks.map((tick) => tick.label),
    ["00:00", "00:02", "00:04", "00:06", "00:08"],
  );
});

test("clamps the playhead when project duration shrinks", () => {
  assert.equal(clampPlayheadFrame(480, 241), 240);
  assert.equal(clampPlayheadFrame(-20, 241), 0);
  assert.equal(clampPlayheadFrame(20, 0), 0);
});

test("advances playback with a validated optional frame tick", () => {
  assert.equal(advanceTimelinePlaybackFrame(10, 40), 13);
  assert.equal(advanceTimelinePlaybackFrame(10, 40, 5), 15);
  assert.equal(advanceTimelinePlaybackFrame(10, 40, Number.NaN), 13);
  assert.equal(advanceTimelinePlaybackFrame(10, 40, 0), 13);
  assert.equal(advanceTimelinePlaybackFrame(10, 40, -2), 13);
});

test("returns the reset frame for invalid or empty playback durations", () => {
  assert.equal(advanceTimelinePlaybackFrame(10, Number.NaN), 0);
  assert.equal(advanceTimelinePlaybackFrame(10, Number.POSITIVE_INFINITY), 0);
  assert.equal(advanceTimelinePlaybackFrame(10, -1), 0);
});

test("Task 2 playback advances across clip boundaries then stops and resets at project end", () => {
  const expectedSteps = [
    { nextFrame: 31, continues: true },
    { nextFrame: 34, continues: true },
    { nextFrame: 37, continues: true },
    { nextFrame: 39, continues: true },
    { nextFrame: 0, continues: false },
  ];
  let frame = 28;

  for (const expectedStep of expectedSteps) {
    const step = stepTimelinePlayback(frame, 40);
    assert.deepEqual(step, expectedStep);
    frame = step.nextFrame;
  }
});

test("cancels the first trailing autosave during rapid changes and persists the latest once", () => {
  const pendingCallbacks = new Map<number, () => void>();
  const cancelledTimers: number[] = [];
  let nextTimerId = 1;
  let persistCount = 0;
  const autosave = createTrailingAutosaveScheduler(
    () => {
      persistCount += 1;
    },
    {
      schedule: (callback) => {
        const timerId = nextTimerId;
        nextTimerId += 1;
        pendingCallbacks.set(timerId, callback);
        return timerId;
      },
      cancel: (timerId) => {
        cancelledTimers.push(timerId);
        pendingCallbacks.delete(timerId);
      },
    },
  );

  autosave.schedule();
  const firstTimerId = 1;
  autosave.schedule();
  const latestTimerId = 2;

  assert.deepEqual(cancelledTimers, [firstTimerId]);
  assert.equal(pendingCallbacks.has(firstTimerId), false);
  const latestCallback = pendingCallbacks.get(latestTimerId);
  pendingCallbacks.delete(latestTimerId);
  latestCallback?.();
  assert.equal(persistCount, 1);
  assert.equal(pendingCallbacks.size, 0);
});

test("cancels pending trailing autosave work during cleanup", () => {
  const cancelledTimers: number[] = [];
  let persistCount = 0;
  const autosave = createTrailingAutosaveScheduler(
    () => {
      persistCount += 1;
    },
    {
      schedule: () => 7,
      cancel: (timerId) => {
        cancelledTimers.push(timerId);
      },
    },
  );

  autosave.schedule();
  autosave.cancel();

  assert.deepEqual(cancelledTimers, [7]);
  assert.equal(persistCount, 0);
});

test("calculates drag deltas from a captured timeline content origin", () => {
  const startFrame = getTimelineFrameFromPointer(480, -300, 148, 1.15);
  assert.equal(
    getStableTimelineFrameDelta(490, startFrame, -300, 148, 1.15),
    8,
  );
});

test("auto-scrolls toward timeline edges only while the pointer is nearby", () => {
  assert.ok(getDragEdgeAutoScrollDelta(102, 100, 900) < 0);
  assert.equal(getDragEdgeAutoScrollDelta(500, 100, 900), 0);
  assert.ok(getDragEdgeAutoScrollDelta(898, 100, 900) > 0);
  assert.equal(getDragEdgeAutoScrollDelta(0, 100, 900), 0);
  assert.equal(getDragEdgeAutoScrollDelta(1000, 100, 900), 0);
});

test("calculates manual canvas rotation from the clip center", () => {
  assert.equal(getManualRotationAngle(100, 100, 100, 0, 0), 0);
  assert.equal(getManualRotationAngle(100, 100, 200, 100, 0), 90);
  assert.equal(getManualRotationAngle(100, 100, 100, 200, 0), 180);
  assert.equal(getManualRotationAngle(100, 100, 0, 100, 0), -90);
  assert.equal(getManualRotationAngle(100, 100, 200, 100, 30), 120);
});

test("keeps the manual rotate handle visible near the top of the preview", () => {
  assert.equal(getVisibleRotateHandleTop(40), 18);
  assert.equal(getVisibleRotateHandleTop(8), 18);
  assert.equal(getVisibleRotateHandleTop(0), 18);
  assert.equal(getVisibleRotateHandleTop(Number.NaN), 18);
});

test("converts pointer positions from scroll-shifted timeline content bounds", () => {
  assert.equal(getTimelineFrameFromPointer(148, 0, 148, 1.15), 0);
  assert.equal(getTimelineFrameFromPointer(480, -300, 148, 1.15), 550);
  assert.equal(getTimelineFrameFromPointer(248, 100, 148, 1.15), 0);
});

test("expands move boundaries while retaining zero and invalid clamps", () => {
  assert.equal(getExpandedTimelineBoundary(480, 450, 120), 570);
  assert.equal(getExpandedTimelineBoundary(480, -40, 120), 480);
  assert.equal(
    getExpandedTimelineBoundary(Number.NaN, Number.NaN, Number.NaN),
    1,
  );
});

test("undoes and redoes the latest timeline edit", () => {
  const original = [historyClip("original")];
  const edited = [historyClip("edited")];
  const afterEdit = applyTimelineHistoryEdit(
    createTimelineHistory(original),
    edited,
  );

  const afterUndo = undoTimelineHistory(afterEdit);
  assert.deepEqual(afterUndo.present, original);
  assert.equal(afterUndo.past.length, 0);
  assert.deepEqual(afterUndo.future, [edited]);

  const afterRedo = redoTimelineHistory(afterUndo);
  assert.deepEqual(afterRedo.present, edited);
  assert.deepEqual(afterRedo.past, [original]);
  assert.equal(afterRedo.future.length, 0);
});

test("keeps overlapping text, sticker, cutout, and caption clips unchanged", () => {
  const tracks = ["text", "sticker", "cutout", "caption"] as const;
  const overlapping = tracks.flatMap((track) => [
    {
      id: `${track}-first`,
      label: "First",
      track,
      start: 20,
      duration: 60,
      color: "#fff",
    },
    {
      id: `${track}-second`,
      label: "Second",
      track,
      start: 40,
      duration: 60,
      color: "#fff",
    },
  ]);

  assert.deepEqual(createTimelineHistory(overlapping).present, overlapping);
});

test("a new edit after undo clears redo history", () => {
  const original = [historyClip("original")];
  const firstEdit = [historyClip("first-edit")];
  const replacementEdit = [historyClip("replacement-edit")];
  const afterUndo = undoTimelineHistory(
    applyTimelineHistoryEdit(createTimelineHistory(original), firstEdit),
  );

  const result = applyTimelineHistoryEdit(afterUndo, replacementEdit);

  assert.deepEqual(result.present, replacementEdit);
  assert.deepEqual(result.past, [original]);
  assert.equal(result.future.length, 0);
});

test("undo and redo leave history unchanged when their stack is empty", () => {
  const initial = createTimelineHistory([historyClip("original")]);

  assert.equal(undoTimelineHistory(initial), initial);
  assert.equal(redoTimelineHistory(initial), initial);
});

test("moves the playhead until pointer release even when the device omits button state", () => {
  assert.equal(
    shouldMovePlayheadDuringScrub({
      activePointerId: 4,
      pointerId: 4,
      buttons: 1,
    }),
    true,
  );
  assert.equal(
    shouldMovePlayheadDuringScrub({
      activePointerId: 4,
      pointerId: 5,
      buttons: 1,
    }),
    false,
  );
  assert.equal(
    shouldMovePlayheadDuringScrub({
      activePointerId: 4,
      pointerId: 4,
      buttons: 0,
    }),
    true,
  );
});

test("chooses the visible preview window for clip animations", () => {
  const clip: TimelineClip = {
    id: "animated",
    label: "Animated",
    track: "main",
    start: 90,
    duration: 300,
    color: "#0891b2",
    animation: {
      preset: "fade-in",
      timing: "start",
      duration: 30,
      easing: "smooth",
    },
  };

  assert.equal(getClipAnimationPreviewFrame(clip, "fade-in"), 90);
  assert.equal(getClipAnimationPreviewFrame(clip, "pop"), 90);
  assert.equal(getClipAnimationPreviewFrame(clip, "fade-out"), 360);
  assert.equal(getClipAnimationPreviewFrame(clip, "slide-out"), 360);
  assert.equal(getClipAnimationPreviewFrame(clip, "none"), 90);
});

test("uses the matching timeline edge when an animation preset changes", () => {
  const clip: TimelineClip = {
    id: "animated",
    label: "Animated",
    track: "main",
    start: 0,
    duration: 300,
    color: "#0891b2",
    animation: {
      preset: "fade-in",
      timing: "start",
      duration: 30,
      easing: "smooth",
    },
  };

  const fadedOut = setClipAnimationById([clip], clip.id, "fade-out");
  assert.equal(fadedOut[0].animation?.timing, "end");

  const fadedIn = setClipAnimationById(fadedOut, clip.id, "fade-in");
  assert.equal(fadedIn[0].animation?.timing, "start");
});

test("shows contextual audio only for main and audio selections", () => {
  assert.equal(shouldShowAudioTrackForSelection("main"), true);
  assert.equal(shouldShowAudioTrackForSelection("audio"), true);
  assert.equal(shouldShowAudioTrackForSelection("upper"), false);
  assert.equal(shouldShowAudioTrackForSelection("sticker"), false);
  assert.equal(shouldShowAudioTrackForSelection("caption"), false);
});

test("creates imported images as silent visual clips", () => {
  const imageClip = createImageMediaClip({
    id: "image-1",
    track: "upper",
    label: "Cover photo",
    src: "uploads/cover.png",
    start: 45,
    duration: 150,
  });

  assert.deepEqual(imageClip, {
    id: "image-1",
    label: "Cover photo",
    track: "upper",
    start: 45,
    duration: 150,
    color: "#7c3aed",
    src: "uploads/cover.png",
    speed: 1,
    volume: 1,
    mediaType: "image",
    overlayLane: 0,
  });
});

test("moves an upper clip to the end of the main track", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 160,
      color: "#0891b2",
    },
    {
      id: "upper-1",
      label: "Upper clip",
      track: "upper",
      start: 0,
      duration: 90,
      color: "#7c3aed",
    },
  ];

  const result = moveClipToMainTrack(clips, "upper-1");

  assert.deepEqual(result, [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 160,
      color: "#0891b2",
    },
    {
      id: "upper-1",
      label: "Upper clip",
      track: "main",
      start: 160,
      duration: 90,
      color: "#7c3aed",
    },
  ]);
});

test("allows dropping an upper clip onto the main track", () => {
  const clips: TimelineClip[] = [
    {
      id: "upper-1",
      label: "Upper clip",
      track: "upper",
      start: 0,
      duration: 90,
      color: "#7c3aed",
    },
  ];

  assert.equal(canDropClipOnMainTrack(clips, "upper-1", "main"), true);
  assert.equal(canDropClipOnMainTrack(clips, "upper-1", "upper"), false);
});

test("splits the first main track clip into independent adjacent segments", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 150,
      color: "#0891b2",
    },
  ];

  const result = splitFirstClipOnTrack(clips, "main");

  assert.deepEqual(result, [
    {
      id: "main-1-a",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 75,
      color: "#0891b2",
    },
    {
      id: "main-1-b",
      label: "Main clip",
      track: "main",
      start: 75,
      duration: 75,
      color: "#0891b2",
    },
  ]);
});

test("splits the first upper track clip without moving it to another track", () => {
  const clips: TimelineClip[] = [
    {
      id: "upper-1",
      label: "Upper clip",
      track: "upper",
      start: 10,
      duration: 91,
      color: "#7c3aed",
    },
  ];

  const result = splitFirstClipOnTrack(clips, "upper");

  assert.deepEqual(result, [
    {
      id: "upper-1-a",
      label: "Upper clip",
      track: "upper",
      start: 10,
      duration: 45,
      color: "#7c3aed",
    },
    {
      id: "upper-1-b",
      label: "Upper clip",
      track: "upper",
      start: 55,
      duration: 46,
      color: "#7c3aed",
    },
  ]);
});

test("splits the main track clip at the selected playhead frame", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 100,
      duration: 150,
      color: "#0891b2",
      src: "video.mp4",
    },
  ];

  const result = splitClipOnTrackAtFrame(clips, "main", 160);

  assert.deepEqual(result, [
    {
      id: "main-1-a",
      label: "Main clip",
      track: "main",
      start: 100,
      duration: 60,
      color: "#0891b2",
      src: "video.mp4",
    },
    {
      id: "main-1-b",
      label: "Main clip",
      track: "main",
      start: 160,
      duration: 90,
      color: "#0891b2",
      src: "video.mp4",
      sourceStart: 60,
    },
  ]);
});

test("does not show a main clip after the playhead is outside its trimmed boundary", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 219,
      color: "#0891b2",
      src: "video.mp4",
    },
  ];

  assert.equal(getActiveClipAtFrame(clips, "main", 220), undefined);
});

test("returns every active overlay clip at the selected playhead frame", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-1",
      label: "First overlay",
      track: "upper",
      start: 20,
      duration: 120,
      color: "#7c3aed",
      src: "overlay-1.mp4",
    },
    {
      id: "overlay-2",
      label: "Second overlay",
      track: "upper",
      start: 40,
      duration: 120,
      color: "#7c3aed",
      src: "overlay-2.mp4",
    },
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 240,
      color: "#0891b2",
      src: "main.mp4",
    },
  ];

  assert.deepEqual(
    getActiveClipsAtFrame(clips, "upper", 60).map((clip) => clip.id),
    ["overlay-1", "overlay-2"],
  );
});

test("assigns overlapping overlay media to separate lanes", () => {
  const firstResult = addOverlayMediaClip([], {
    id: "overlay-1",
    label: "First overlay",
    src: "first.mp4",
    start: 30,
    duration: 120,
  });
  const result = addOverlayMediaClip(firstResult, {
    id: "overlay-2",
    label: "Second overlay",
    src: "second.mp4",
    start: 60,
    duration: 120,
  });

  assert.deepEqual(
    result.map((clip) => clip.overlayLane),
    [0, 1],
  );
});

test("reuses an overlay lane when its time range is empty", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-1",
      label: "First overlay",
      track: "upper",
      start: 0,
      duration: 60,
      color: "#7c3aed",
      overlayLane: 0,
    },
    {
      id: "overlay-2",
      label: "Second overlay",
      track: "upper",
      start: 20,
      duration: 60,
      color: "#7c3aed",
      overlayLane: 1,
    },
  ];

  assert.equal(findAvailableOverlayLane(clips, 80, 40), 0);
});

test("orders active overlays from lower lane to topmost lane", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-top",
      label: "Top overlay",
      track: "upper",
      start: 0,
      duration: 120,
      color: "#7c3aed",
      src: "top.mp4",
      overlayLane: 2,
    },
    {
      id: "overlay-bottom",
      label: "Bottom overlay",
      track: "upper",
      start: 0,
      duration: 120,
      color: "#7c3aed",
      src: "bottom.mp4",
      overlayLane: 0,
    },
  ];

  assert.deepEqual(
    getActiveOverlayClipsAtFrame(clips, 30).map((clip) => clip.id),
    ["overlay-bottom", "overlay-top"],
  );
});

test("moves a linked overlay and audio pair while preserving narration", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay",
      label: "Overlay",
      track: "upper",
      start: 30,
      duration: 60,
      color: "#7c3aed",
      overlayLane: 0,
      linkedClipId: "overlay-audio",
    },
    {
      id: "overlay-audio",
      label: "Overlay audio",
      track: "audio",
      start: 30,
      duration: 60,
      color: "#2563eb",
      linkedClipId: "overlay",
    },
    {
      id: "main",
      label: "Main",
      track: "main",
      start: 0,
      duration: 480,
      color: "#0891b2",
    },
    {
      id: "narration",
      label: "Narration",
      track: "audio",
      start: 0,
      duration: 480,
      color: "#2563eb",
    },
  ];

  const result = moveOverlayClip(clips, "overlay", 90, 1, 480);

  assert.deepEqual(
    result.find((clip) => clip.id === "overlay"),
    {
      ...clips[0],
      start: 90,
      overlayLane: 1,
    },
  );
  assert.deepEqual(
    result.find((clip) => clip.id === "overlay-audio"),
    {
      ...clips[1],
      start: 90,
    },
  );
  assert.strictEqual(
    result.find((clip) => clip.id === "main"),
    clips[2],
  );
  assert.strictEqual(
    result.find((clip) => clip.id === "narration"),
    clips[3],
  );
});

test("clamps overlays at zero and allows an expanded project boundary", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay",
      label: "Overlay",
      track: "upper",
      start: 30,
      duration: 120,
      color: "#7c3aed",
      overlayLane: 0,
    },
  ];

  assert.equal(moveOverlayClip(clips, "overlay", -40, 0, 480)[0].start, 0);
  assert.equal(moveOverlayClip(clips, "overlay", 450, 0, 570)[0].start, 450);
  assert.equal(
    moveOverlayClip(clips, "overlay", Number.NaN, 0, 570)[0].start,
    0,
  );
});

test("moves an overlapping overlay into the next available lane", () => {
  const clips: TimelineClip[] = [
    {
      id: "moving",
      label: "Moving",
      track: "upper",
      start: 0,
      duration: 90,
      color: "#7c3aed",
      overlayLane: 0,
    },
    {
      id: "occupied",
      label: "Occupied",
      track: "upper",
      start: 100,
      duration: 120,
      color: "#7c3aed",
      overlayLane: 1,
    },
  ];

  const result = moveOverlayClip(clips, "moving", 120, 1, 480);

  assert.equal(result.find((clip) => clip.id === "moving")?.start, 120);
  assert.equal(result.find((clip) => clip.id === "moving")?.overlayLane, 2);
});

test("splits a linked overlay into reciprocal video and audio pairs", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-1",
      label: "Recording",
      track: "upper",
      start: 30,
      duration: 120,
      color: "#7c3aed",
      src: "overlay.mp4",
      overlayLane: 1,
      sourceStart: 10,
      linkedClipId: "overlay-audio",
    },
    {
      id: "overlay-audio",
      label: "Recording audio",
      track: "audio",
      start: 30,
      duration: 120,
      color: "#2563eb",
      sourceStart: 10,
      linkedClipId: "overlay-1",
    },
    {
      id: "overlay-2",
      label: "Other overlay",
      track: "upper",
      start: 0,
      duration: 120,
      color: "#7c3aed",
      overlayLane: 0,
    },
    {
      id: "main-1",
      label: "Main",
      track: "main",
      start: 0,
      duration: 240,
      color: "#0891b2",
    },
  ];

  const result = splitClipByIdAtFrame(clips, "overlay-1", 90);

  assert.deepEqual(result, [
    {
      ...clips[0],
      id: "overlay-1-a",
      duration: 60,
      linkedClipId: "overlay-audio-a",
    },
    {
      ...clips[0],
      id: "overlay-1-b",
      start: 90,
      duration: 60,
      sourceStart: 70,
      linkedClipId: "overlay-audio-b",
    },
    {
      ...clips[1],
      id: "overlay-audio-a",
      duration: 60,
      linkedClipId: "overlay-1-a",
    },
    {
      ...clips[1],
      id: "overlay-audio-b",
      start: 90,
      duration: 60,
      sourceStart: 70,
      linkedClipId: "overlay-1-b",
    },
    clips[2],
    clips[3],
  ]);
});

test("deletes only the selected timeline clip", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
    },
    {
      id: "upper-1",
      label: "Overlay clip",
      track: "upper",
      start: 20,
      duration: 80,
      color: "#7c3aed",
    },
  ];

  assert.deepEqual(deleteClipById(clips, "upper-1"), [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
    },
  ]);
});

test("replaces the first main track clip while keeping its original boundaries", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 20,
      duration: 150,
      color: "#0891b2",
    },
  ];

  const result = replaceFirstClipOnTrack(clips, "main");

  assert.deepEqual(result, [
    {
      id: "main-1-replacement",
      label: "Replacement clip",
      track: "main",
      start: 20,
      duration: 150,
      color: "#f59e0b",
    },
  ]);
});

test("replaces a dropped-on main clip with new media while keeping timing", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Old clip",
      track: "main",
      start: 30,
      duration: 180,
      color: "#0891b2",
      src: "old.mp4",
      speed: 0.75,
      volume: 0.5,
    },
    {
      id: "main-2",
      label: "Other clip",
      track: "main",
      start: 210,
      duration: 90,
      color: "#0891b2",
      src: "other.mp4",
    },
  ];

  assert.deepEqual(
    replaceClipMediaById(clips, "main-1", {
      label: "New clip",
      src: "new.mp4",
    }),
    [
      {
        id: "main-1",
        label: "New clip",
        track: "main",
        start: 30,
        duration: 180,
        color: "#0891b2",
        src: "new.mp4",
        speed: 0.75,
        volume: 0.5,
      },
      clips[1],
    ],
  );
});

test("replaces the first upper track clip while keeping it on the upper track", () => {
  const clips: TimelineClip[] = [
    {
      id: "upper-1",
      label: "Upper clip",
      track: "upper",
      start: 0,
      duration: 92,
      color: "#7c3aed",
    },
  ];

  const result = replaceFirstClipOnTrack(clips, "upper");

  assert.deepEqual(result, [
    {
      id: "upper-1-replacement",
      label: "Replacement clip",
      track: "upper",
      start: 0,
      duration: 92,
      color: "#f59e0b",
    },
  ]);
});

test("adds an overlay clip on the upper track above the main track", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 150,
      color: "#0891b2",
    },
    {
      id: "audio-1",
      label: "Narrative audio",
      track: "audio",
      start: 0,
      duration: 150,
      color: "#2563eb",
    },
  ];

  const result = addOverlayClip(clips);

  assert.deepEqual(result, [
    ...clips,
    {
      id: "overlay-1",
      label: "Overlay clip",
      track: "upper",
      start: 30,
      duration: 90,
      color: "#a855f7",
    },
  ]);
});

test("adds dragged media to the overlay track at the selected playhead frame", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 480,
      color: "#0891b2",
      src: "main.mp4",
    },
  ];

  assert.deepEqual(
    addOverlayMediaClip(clips, {
      id: "overlay-2",
      label: "Overlay video",
      src: "overlay.mp4",
      start: 90,
      duration: 120,
    }),
    [
      ...clips,
      {
        id: "overlay-2",
        label: "Overlay video",
        track: "upper",
        start: 90,
        duration: 120,
        color: "#7c3aed",
        src: "overlay.mp4",
        speed: 1,
        volume: 1,
        overlayLane: 0,
      },
    ],
  );
});

test("hides the first main track clip without deleting it", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 150,
      color: "#0891b2",
    },
  ];

  const result = hideFirstClipOnTrack(clips, "main");

  assert.deepEqual(result, [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 0,
      duration: 150,
      color: "#0891b2",
      hidden: true,
    },
  ]);
});

test("adds cleaned transcript captions as independent audio cleanup segments", () => {
  const clips: TimelineClip[] = [
    {
      id: "audio-1",
      label: "Narrative audio",
      track: "audio",
      start: 0,
      duration: 150,
      color: "#2563eb",
    },
  ];

  const result = addTranscriptCaptions(clips);

  assert.deepEqual(result, [
    ...clips,
    {
      id: "caption-1",
      label: "Clean caption",
      track: "caption",
      start: 12,
      duration: 44,
      color: "#ef4444",
    },
    {
      id: "caption-2",
      label: "Edited dialogue",
      track: "caption",
      start: 62,
      duration: 52,
      color: "#ef4444",
    },
  ]);
});

test("changes the first main track clip to fast motion while keeping its start", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip",
      track: "main",
      start: 20,
      duration: 150,
      color: "#0891b2",
    },
  ];

  const result = changeFirstClipSpeed(clips, "main", 2);

  assert.deepEqual(result, [
    {
      id: "main-1",
      label: "Main clip 2x",
      track: "main",
      start: 20,
      duration: 75,
      color: "#0891b2",
      speed: 2,
    },
  ]);
});

test("updates a main clip from one custom speed to another custom speed", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main clip 1.25x",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      speed: 1.25,
    },
  ];

  const result = changeFirstClipSpeed(clips, "main", 0.75);

  assert.deepEqual(result, [
    {
      id: "main-1",
      label: "Main clip 0.75x",
      track: "main",
      start: 0,
      duration: 200,
      color: "#0891b2",
      speed: 0.75,
    },
  ]);
});

test("adjusts audio track volume while keeping the clip timing", () => {
  const clips: TimelineClip[] = [
    {
      id: "audio-1",
      label: "Narrative audio",
      track: "audio",
      start: 0,
      duration: 150,
      color: "#2563eb",
    },
  ];

  const result = setTrackVolume(clips, "audio", 1.25);

  assert.deepEqual(result, [
    {
      id: "audio-1",
      label: "Narrative audio 125%",
      track: "audio",
      start: 0,
      duration: 150,
      color: "#2563eb",
      volume: 1.25,
    },
  ]);
});

test("adjusts a selected overlay clip speed by id", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-1",
      label: "Overlay clip",
      track: "upper",
      start: 20,
      duration: 120,
      color: "#7c3aed",
      speed: 1,
    },
    {
      id: "overlay-2",
      label: "Other overlay",
      track: "upper",
      start: 20,
      duration: 120,
      color: "#7c3aed",
      speed: 1,
    },
  ];

  const result = setClipSpeedById(clips, "overlay-2", 2);

  assert.deepEqual(result, [
    clips[0],
    {
      id: "overlay-2",
      label: "Other overlay",
      track: "upper",
      start: 20,
      duration: 60,
      color: "#7c3aed",
      speed: 2,
    },
  ]);
});

test("adjusts a selected overlay clip volume by id", () => {
  const clips: TimelineClip[] = [
    {
      id: "overlay-1",
      label: "Overlay clip",
      track: "upper",
      start: 20,
      duration: 120,
      color: "#7c3aed",
      volume: 0,
    },
  ];

  const result = setClipVolumeById(clips, "overlay-1", 0.65);

  assert.deepEqual(result, [
    {
      id: "overlay-1",
      label: "Overlay clip",
      track: "upper",
      start: 20,
      duration: 120,
      color: "#7c3aed",
      volume: 0.65,
    },
  ]);
});

test("applies effects and filters only to selected video clips", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-1",
      label: "Main video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
    },
    {
      id: "audio-1",
      label: "Main audio",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
    },
  ];

  const withEffect = setClipEffectById(clips, "main-1", "glow");
  const withFilter = setClipFilterById(withEffect, "main-1", "warm");
  const ignoredAudio = setClipEffectById(withFilter, "audio-1", "blur");

  assert.deepEqual(ignoredAudio[0].visual, {
    effect: "glow",
    filter: "warm",
  });
  assert.equal(ignoredAudio[1].visual, undefined);
});

test("left trim advances linked video and audio source timing without trimming narration", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Original audio",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
      linkedClipId: "main",
    },
    {
      id: "voice",
      label: "Narration",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
    },
  ];

  const result = trimClipById(clips, "main", "left", 30);

  assert.deepEqual(
    result.map(({ id, start, duration, sourceStart }) => ({
      id,
      start,
      duration,
      sourceStart,
    })),
    [
      { id: "main", start: 30, duration: 90, sourceStart: 30 },
      { id: "audio", start: 30, duration: 90, sourceStart: 30 },
      { id: "voice", start: 0, duration: 120, sourceStart: undefined },
    ],
  );
});

test("left trim synchronizes an upper video only with its reciprocal audio", () => {
  const overlay: TimelineClip = {
    id: "overlay",
    label: "Overlay video",
    track: "upper",
    start: 30,
    duration: 120,
    sourceStart: 10,
    color: "#7c3aed",
    linkedClipId: "overlay-audio",
  };
  const overlayAudio: TimelineClip = {
    id: "overlay-audio",
    label: "Overlay audio",
    track: "audio",
    start: 30,
    duration: 120,
    sourceStart: 10,
    color: "#2563eb",
    linkedClipId: "overlay",
  };
  const narration: TimelineClip = {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 5,
    duration: 200,
    sourceStart: 7,
    color: "#2563eb",
  };

  const result = trimClipById(
    [overlay, overlayAudio, narration],
    overlay.id,
    "left",
    20,
  );

  assert.deepEqual(result[0], {
    ...overlay,
    start: 50,
    duration: 100,
    sourceStart: 30,
  });
  assert.deepEqual(result[1], {
    ...overlayAudio,
    start: 50,
    duration: 100,
    sourceStart: 30,
  });
  assert.strictEqual(result[2], narration);
});

test("right trim shortens linked video and audio without trimming narration", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Original audio",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
      linkedClipId: "main",
    },
    {
      id: "voice",
      label: "Narration",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
    },
  ];

  const result = trimClipById(clips, "main", "right", -45);
  assert.equal(result.find((clip) => clip.id === "main")?.duration, 75);
  assert.equal(result.find((clip) => clip.id === "audio")?.duration, 75);
  assert.equal(result.find((clip) => clip.id === "voice")?.duration, 120);
});

test("trim leaves legacy original audio unchanged when link metadata is missing", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      src: "video.mp4",
    },
    {
      id: "audio",
      label: "Main audio",
      track: "audio",
      start: 0,
      duration: 480,
      color: "#2563eb",
      src: "video.mp4",
    },
  ];

  const result = trimClipById(clips, "main", "right", -45);

  assert.equal(result.find((clip) => clip.id === "main")?.duration, 75);
  assert.equal(result.find((clip) => clip.id === "audio")?.duration, 480);
});

test("repairs an already mismatched legacy original audio clip", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 99,
      color: "#0891b2",
      src: "video.mp4",
    },
    {
      id: "audio",
      label: "Main audio",
      track: "audio",
      start: 0,
      duration: 480,
      color: "#2563eb",
      src: "video.mp4",
    },
  ];

  const result = synchronizeOriginalAudio(clips);

  assert.equal(result.find((clip) => clip.id === "audio")?.duration, 99);
});

test("deleting a selected video removes only its reciprocal linked audio", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Original audio",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
      linkedClipId: "main",
    },
    {
      id: "voice",
      label: "Narration",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
    },
  ];

  assert.deepEqual(
    deleteClipById(clips, "main").map((clip) => clip.id),
    ["voice"],
  );
});

test("duplicates a selected main video onto a new upper video layer", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Clip",
      track: "main",
      start: 0,
      duration: 90,
      color: "#0891b2",
      src: "clip.mp4",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Clip audio",
      track: "audio",
      start: 0,
      duration: 90,
      color: "#2563eb",
      src: "clip.mp4",
      linkedClipId: "main",
      volume: 0.8,
    },
  ];

  const result = duplicateClipById(clips, "main", "copy");

  assert.equal(result.length, 4);
  assert.deepEqual(
    result
      .slice(2)
      .map(
        ({ id, label, track, start, duration, linkedClipId, videoLayer }) => ({
          id,
          label,
          track,
          start,
          duration,
          linkedClipId,
          videoLayer,
        }),
      ),
    [
      {
        id: "copy-video",
        label: "Clip copy",
        track: "upper",
        start: 0,
        duration: 90,
        linkedClipId: "copy-audio",
        videoLayer: 1,
      },
      {
        id: "copy-audio",
        label: "Clip audio copy",
        track: "audio",
        start: 0,
        duration: 90,
        linkedClipId: "copy-video",
        videoLayer: undefined,
      },
    ],
  );
});

test("reconnects a missing video and its linked audio to replacement media", () => {
  const clips = createMainMediaPair({
    mainId: "missing-video",
    audioId: "missing-audio",
    label: "Missing clip",
    src: "missing.mp4",
    start: 0,
    duration: 480,
  });

  const replaced = replaceClipMediaById(clips, "missing-video", {
    label: "Character clip",
    src: "/uploads/character.mp4",
  });

  assert.equal(replaced[0]?.label, "Character clip");
  assert.equal(replaced[0]?.src, "/uploads/character.mp4");
  assert.equal(replaced[1]?.label, "Character clip audio");
  assert.equal(replaced[1]?.src, "/uploads/character.mp4");
});

test("duplicates an overlay video onto the next upper video layer", () => {
  const clips: TimelineClip[] = [
    {
      id: "upper",
      label: "Overlay",
      track: "upper",
      start: 30,
      duration: 60,
      color: "#7c3aed",
      src: "overlay.mp4",
      linkedClipId: "upper-audio",
      overlayLane: 2,
      videoLayer: 1,
    },
    {
      id: "upper-audio",
      label: "Overlay audio",
      track: "audio",
      start: 30,
      duration: 60,
      color: "#2563eb",
      src: "overlay.mp4",
      linkedClipId: "upper",
      volume: 1,
    },
  ];

  const result = duplicateClipById(clips, "upper", "copy");

  assert.deepEqual(
    result
      .slice(2)
      .map(({ id, track, start, overlayLane, videoLayer, linkedClipId }) => ({
        id,
        track,
        start,
        overlayLane,
        videoLayer,
        linkedClipId,
      })),
    [
      {
        id: "copy-video",
        track: "upper",
        start: 30,
        overlayLane: undefined,
        videoLayer: 2,
        linkedClipId: "copy-audio",
      },
      {
        id: "copy-audio",
        track: "audio",
        start: 30,
        overlayLane: undefined,
        videoLayer: undefined,
        linkedClipId: "copy-video",
      },
    ],
  );
});

test("creates imported background music as independent audio", () => {
  assert.deepEqual(
    createBackgroundMusicClip({
      id: "music-1",
      label: "Song",
      src: "song.mp3",
      playheadFrame: 45,
      durationInFrames: 300,
    }),
    {
      id: "music-1",
      label: "Song",
      track: "audio",
      start: 45,
      duration: 300,
      color: "#2563eb",
      src: "song.mp3",
      volume: 0.7,
      audioKind: "music",
    },
  );
});

test("toggles mute for a video and its reciprocal audio pair", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 90,
      color: "#0891b2",
      linkedClipId: "audio",
      volume: 1,
    },
    {
      id: "audio",
      label: "Video audio",
      track: "audio",
      start: 0,
      duration: 90,
      color: "#2563eb",
      linkedClipId: "main",
      volume: 1,
    },
    {
      id: "music",
      label: "Music",
      track: "audio",
      start: 0,
      duration: 90,
      color: "#2563eb",
      volume: 0.4,
    },
  ];

  const muted = toggleClipMuteById(clips, "main");

  assert.equal(muted.find((clip) => clip.id === "main")?.volume, 0);
  assert.equal(muted.find((clip) => clip.id === "audio")?.volume, 0);
  assert.equal(muted.find((clip) => clip.id === "music")?.volume, 0.4);

  const unmuted = toggleClipMuteById(muted, "main");

  assert.equal(unmuted.find((clip) => clip.id === "main")?.volume, 1);
  assert.equal(unmuted.find((clip) => clip.id === "audio")?.volume, 1);
});

test("splitting a selected main video keeps its linked audio as one continuous clip in legacy track splits", () => {
  const clips: TimelineClip[] = [
    {
      id: "main",
      label: "Video",
      track: "main",
      start: 0,
      duration: 120,
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Original audio",
      track: "audio",
      start: 0,
      duration: 120,
      color: "#2563eb",
      linkedClipId: "main",
    },
  ];

  const result = splitClipOnTrackAtFrame(clips, "main", 30);

  assert.deepEqual(
    result.filter((clip) => clip.track === "main").map((clip) => clip.duration),
    [30, 90],
  );
  assert.deepEqual(
    result
      .filter((clip) => clip.track === "audio")
      .map(({ id, start, duration }) => ({ id, start, duration })),
    [{ id: "audio", start: 0, duration: 120 }],
  );
});

test("removes silence from a video and reciprocal audio and closes the gap", () => {
  const clips: TimelineClip[] = [
    {
      id: "video",
      label: "Lesson",
      track: "main",
      start: 0,
      duration: 300,
      sourceStart: 30,
      src: "lesson.mp4",
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Lesson audio",
      track: "audio",
      start: 0,
      duration: 300,
      sourceStart: 30,
      src: "lesson.mp4",
      color: "#2563eb",
      linkedClipId: "video",
    },
  ];

  const result = removeSilenceFromLinkedVideo(
    clips,
    "video",
    [
      { startSeconds: 2, endSeconds: 3 },
      { startSeconds: 6, endSeconds: 7 },
    ],
    30,
  );

  assert.deepEqual(
    result
      .filter((clip) => clip.track === "main")
      .map(({ start, duration, sourceStart }) => ({
        start,
        duration,
        sourceStart,
      })),
    [
      { start: 0, duration: 60, sourceStart: 30 },
      { start: 60, duration: 90, sourceStart: 120 },
      { start: 150, duration: 90, sourceStart: 240 },
    ],
  );
  assert.deepEqual(
    result
      .filter((clip) => clip.track === "audio")
      .map(({ start, duration, sourceStart }) => ({
        start,
        duration,
        sourceStart,
      })),
    [
      { start: 0, duration: 60, sourceStart: 30 },
      { start: 60, duration: 90, sourceStart: 120 },
      { start: 150, duration: 90, sourceStart: 240 },
    ],
  );
});

test("ripples only later reciprocal pairs on the same signed video layer", () => {
  const selectedVideo: TimelineClip = {
    id: "selected-video",
    label: "Selected",
    track: "upper",
    start: 30,
    duration: 120,
    sourceStart: 15,
    src: "selected.mp4",
    color: "#7c3aed",
    linkedClipId: "selected-audio",
    videoLayer: -2,
  };
  const selectedAudio: TimelineClip = {
    id: "selected-audio",
    label: "Selected audio",
    track: "audio",
    start: 30,
    duration: 120,
    sourceStart: 15,
    src: "selected.mp4",
    color: "#2563eb",
    linkedClipId: "selected-video",
  };
  const laterVideo: TimelineClip = {
    id: "later-video",
    label: "Later",
    track: "upper",
    start: 150,
    duration: 90,
    src: "later.mp4",
    color: "#7c3aed",
    linkedClipId: "later-audio",
    videoLayer: -2,
  };
  const laterAudio: TimelineClip = {
    id: "later-audio",
    label: "Later audio",
    track: "audio",
    start: 150,
    duration: 90,
    src: "later.mp4",
    color: "#2563eb",
    linkedClipId: "later-video",
  };
  const otherLayerVideo: TimelineClip = {
    id: "other-video",
    label: "Other layer",
    track: "upper",
    start: 150,
    duration: 90,
    src: "other.mp4",
    color: "#7c3aed",
    linkedClipId: "other-audio",
    videoLayer: 2,
  };
  const otherLayerAudio: TimelineClip = {
    id: "other-audio",
    label: "Other audio",
    track: "audio",
    start: 150,
    duration: 90,
    src: "other.mp4",
    color: "#2563eb",
    linkedClipId: "other-video",
  };
  const narration: TimelineClip = {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 170,
    duration: 60,
    color: "#2563eb",
    src: "voice.wav",
  };
  const text: TimelineClip = {
    id: "text",
    label: "Title",
    track: "text",
    start: 160,
    duration: 45,
    color: "#f97316",
  };
  const sticker: TimelineClip = {
    id: "sticker",
    label: "Star",
    track: "sticker",
    start: 180,
    duration: 45,
    color: "#f59e0b",
  };
  const clips = [
    selectedVideo,
    selectedAudio,
    laterVideo,
    laterAudio,
    otherLayerVideo,
    otherLayerAudio,
    narration,
    text,
    sticker,
  ];

  const result = removeSilenceFromLinkedVideo(
    clips,
    selectedVideo.id,
    [{ startSeconds: 1, endSeconds: 2 }],
    30,
  );

  assert.equal(result.find((clip) => clip.id === laterVideo.id)?.start, 120);
  assert.equal(result.find((clip) => clip.id === laterAudio.id)?.start, 120);
  assert.strictEqual(
    result.find((clip) => clip.id === otherLayerVideo.id),
    otherLayerVideo,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === otherLayerAudio.id),
    otherLayerAudio,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === narration.id),
    narration,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === text.id),
    text,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === sticker.id),
    sticker,
  );
});

test("removes only stale transcript captions generated for the selected source", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const selectedTranscript: TimelineClip = {
    id: "selected-transcript",
    label: "Old",
    track: "caption",
    start: 0,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Old",
      sourceClipId: "video",
      generationId: "transcript-batch-1",
    },
  };
  const selectedNonTranscript: TimelineClip = {
    id: "selected-import",
    label: "Imported",
    track: "caption",
    start: 30,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Imported",
      sourceClipId: "video",
      generationId: "caption-import-1",
    },
  };
  const otherTranscript: TimelineClip = {
    id: "other-transcript",
    label: "Other",
    track: "caption",
    start: 0,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Other",
      sourceClipId: "other-video",
      generationId: "transcript-batch-2",
    },
  };
  const manualCaption: TimelineClip = {
    id: "manual",
    label: "Manual",
    track: "caption",
    start: 60,
    duration: 30,
    color: "#ef4444",
    caption: { ...defaultCaptionStyle, content: "Manual" },
  };

  const result = removeSilenceFromLinkedVideo(
    [
      video,
      audio,
      selectedTranscript,
      selectedNonTranscript,
      otherTranscript,
      manualCaption,
    ],
    video.id,
    [{ startSeconds: 1, endSeconds: 2 }],
    30,
  );

  assert.equal(
    result.some((clip) => clip.id === selectedTranscript.id),
    false,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === selectedNonTranscript.id),
    selectedNonTranscript,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === otherTranscript.id),
    otherTranscript,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === manualCaption.id),
    manualCaption,
  );
});

test("normalizes silence ranges and preserves reciprocal segment properties at custom speed", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Camera",
    track: "upper",
    start: 20,
    duration: 150,
    sourceStart: 90,
    src: "camera.mp4",
    color: "#7c3aed",
    linkedClipId: "audio",
    speed: 1.5,
    hidden: true,
    overlayLane: 4,
    videoLayer: -3,
    visual: { effect: "glow", filter: "warm" },
    animation: { preset: "fade-in", timing: "start", duration: 12 },
    adjustment: { ...defaultClipAdjustment, scale: 1.2 },
    volume: 0.75,
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Camera audio",
    track: "audio",
    start: 20,
    duration: 150,
    sourceStart: 90,
    src: "camera.mp4",
    color: "#2563eb",
    linkedClipId: "video",
    speed: 1.5,
    hidden: true,
    volume: 0.65,
  };

  const result = removeSilenceFromLinkedVideo(
    [video, audio],
    video.id,
    [
      { startSeconds: 4, endSeconds: 6 },
      { startSeconds: -1, endSeconds: 1 },
      { startSeconds: 1.5, endSeconds: 2.5 },
      { startSeconds: 0.5, endSeconds: 2 },
      { startSeconds: 9, endSeconds: 12 },
    ],
    30,
  );
  const videoSegments = result.filter((clip) => clip.track === "upper");
  const audioSegments = result.filter((clip) => clip.track === "audio");

  assert.deepEqual(
    videoSegments.map(
      ({ id, linkedClipId, start, duration, sourceStart, speed }) => ({
        id,
        linkedClipId,
        start,
        duration,
        sourceStart,
        speed,
      }),
    ),
    [
      {
        id: "video-speech-0",
        linkedClipId: "audio-speech-0",
        start: 20,
        duration: 30,
        sourceStart: 165,
        speed: 1.5,
      },
      {
        id: "video-speech-1",
        linkedClipId: "audio-speech-1",
        start: 50,
        duration: 30,
        sourceStart: 270,
        speed: 1.5,
      },
    ],
  );
  assert.deepEqual(
    audioSegments.map(
      ({ id, linkedClipId, start, duration, sourceStart, speed }) => ({
        id,
        linkedClipId,
        start,
        duration,
        sourceStart,
        speed,
      }),
    ),
    [
      {
        id: "audio-speech-0",
        linkedClipId: "video-speech-0",
        start: 20,
        duration: 30,
        sourceStart: 165,
        speed: 1.5,
      },
      {
        id: "audio-speech-1",
        linkedClipId: "video-speech-1",
        start: 50,
        duration: 30,
        sourceStart: 270,
        speed: 1.5,
      },
    ],
  );
  assert.deepEqual(
    videoSegments.map(
      ({
        hidden,
        overlayLane,
        videoLayer,
        visual,
        animation,
        adjustment,
        volume,
      }) => ({
        hidden,
        overlayLane,
        videoLayer,
        visual,
        animation,
        adjustment,
        volume,
      }),
    ),
    [
      {
        hidden: true,
        overlayLane: 4,
        videoLayer: -3,
        visual: video.visual,
        animation: video.animation,
        adjustment: video.adjustment,
        volume: 0.75,
      },
      {
        hidden: true,
        overlayLane: 4,
        videoLayer: -3,
        visual: video.visual,
        animation: video.animation,
        adjustment: video.adjustment,
        volume: 0.75,
      },
    ],
  );
  assert.deepEqual(
    audioSegments.map(({ hidden, volume }) => ({ hidden, volume })),
    [
      { hidden: true, volume: 0.65 },
      { hidden: true, volume: 0.65 },
    ],
  );
});

test("returns the original array for invalid or no-op silence removal ranges", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const clips = [video, audio];

  assert.strictEqual(
    removeSilenceFromLinkedVideo(clips, video.id, [], 30),
    clips,
  );
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: Number.NaN, endSeconds: 1 }],
      30,
    ),
    clips,
  );
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 4, endSeconds: 5 }],
      30,
    ),
    clips,
  );
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 2, endSeconds: 1 }],
      30,
    ),
    clips,
  );
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      0,
    ),
    clips,
  );
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      "missing",
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );
  const noSourceClips: TimelineClip[] = [{ ...video, src: undefined }, audio];
  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      noSourceClips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    noSourceClips,
  );
});

test("returns the original array when the selected video has no linked audio", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
  };
  const clips = [video];

  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );
});

test("returns the original array when the selected video has a stale linked audio id", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "missing-audio",
  };
  const clips = [video];

  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );
});

test("returns the original array when linked audio is not reciprocal", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "other-video",
  };
  const clips = [video, audio];

  assert.strictEqual(
    removeSilenceFromLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );
});

test("calculates preview source time from trim offset and playhead", () => {
  const clip: TimelineClip = {
    id: "main",
    label: "Video",
    track: "main",
    start: 30,
    duration: 90,
    sourceStart: 45,
    color: "#0891b2",
  };
  assert.equal(getClipSourceTime(clip, 60, 30), 2.5);
});

test("subtracts detected silence from retained main voice ranges", () => {
  assert.deepEqual(
    subtractSourceRanges(
      [
        { startSeconds: 0, endSeconds: 4 },
        { startSeconds: 5, endSeconds: 10 },
      ],
      [
        { startSeconds: 1, endSeconds: 2 },
        { startSeconds: 3.5, endSeconds: 6 },
        { startSeconds: 8, endSeconds: 12 },
      ],
      10,
    ),
    [
      { startSeconds: 0, endSeconds: 1 },
      { startSeconds: 2, endSeconds: 3.5 },
      { startSeconds: 6, endSeconds: 8 },
    ],
  );
});

test("keeps dominant voice ranges in a main video and reciprocal audio only", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Lesson",
    track: "main",
    start: 0,
    duration: 300,
    src: "lesson.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Lesson audio",
    track: "audio",
    start: 0,
    duration: 300,
    src: "lesson.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const laterMain: TimelineClip = {
    id: "later-main",
    label: "Next lesson",
    track: "main",
    start: 300,
    duration: 90,
    src: "next.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "later-audio",
  };
  const laterAudio: TimelineClip = {
    id: "later-audio",
    label: "Next lesson audio",
    track: "audio",
    start: 300,
    duration: 90,
    src: "next.mp4",
    color: "#2563eb",
    linkedClipId: "later-main",
  };
  const overlay: TimelineClip = {
    id: "overlay",
    label: "Overlay",
    track: "upper",
    start: 0,
    duration: 300,
    src: "overlay.mp4",
    color: "#7c3aed",
  };
  const overlayAudio: TimelineClip = {
    id: "overlay-audio",
    label: "Overlay audio",
    track: "audio",
    start: 0,
    duration: 300,
    src: "overlay.mp4",
    color: "#2563eb",
  };
  const caption: TimelineClip = {
    id: "caption",
    label: "Caption",
    track: "caption",
    start: 0,
    duration: 300,
    color: "#ef4444",
    caption: { ...defaultCaptionStyle, content: "Keep me" },
  };
  const staleTranscript: TimelineClip = {
    id: "stale-transcript",
    label: "Old",
    track: "caption",
    start: 0,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Old",
      sourceClipId: "video",
      generationId: "transcript-batch-1",
    },
  };
  const importedCaption: TimelineClip = {
    id: "imported-caption",
    label: "Imported",
    track: "caption",
    start: 30,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Imported",
      sourceClipId: "video",
      generationId: "caption-import-1",
    },
  };
  const narration: TimelineClip = {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 20,
    duration: 80,
    src: "voice.wav",
    color: "#2563eb",
  };
  const text: TimelineClip = {
    id: "text",
    label: "Title",
    track: "text",
    start: 20,
    duration: 80,
    color: "#f97316",
  };
  const sticker: TimelineClip = {
    id: "sticker",
    label: "Star",
    track: "sticker",
    start: 20,
    duration: 80,
    color: "#f59e0b",
  };
  const cutout: TimelineClip = {
    id: "cutout",
    label: "Subject",
    track: "cutout",
    start: 20,
    duration: 80,
    src: "subject.mp4",
    color: "#0f766e",
  };
  const clips = [
    video,
    audio,
    laterMain,
    laterAudio,
    overlay,
    overlayAudio,
    caption,
    staleTranscript,
    importedCaption,
    narration,
    text,
    sticker,
    cutout,
  ];

  const result = keepDominantVoiceInLinkedVideo(
    clips,
    video.id,
    [
      { startSeconds: 1, endSeconds: 3 },
      { startSeconds: 5, endSeconds: 6 },
    ],
    30,
  );

  assert.deepEqual(
    result
      .filter((clip) => clip.id.startsWith("video-dominant-"))
      .map(({ start, duration, sourceStart, linkedClipId }) => ({
        start,
        duration,
        sourceStart,
        linkedClipId,
      })),
    [
      {
        start: 0,
        duration: 60,
        sourceStart: 30,
        linkedClipId: "audio-dominant-0",
      },
      {
        start: 60,
        duration: 30,
        sourceStart: 150,
        linkedClipId: "audio-dominant-1",
      },
    ],
  );
  assert.deepEqual(
    result
      .filter((clip) => clip.id.startsWith("audio-dominant-"))
      .map(({ start, duration, sourceStart, linkedClipId }) => ({
        start,
        duration,
        sourceStart,
        linkedClipId,
      })),
    [
      {
        start: 0,
        duration: 60,
        sourceStart: 30,
        linkedClipId: "video-dominant-0",
      },
      {
        start: 60,
        duration: 30,
        sourceStart: 150,
        linkedClipId: "video-dominant-1",
      },
    ],
  );
  assert.equal(result.find((clip) => clip.id === laterMain.id)?.start, 90);
  assert.strictEqual(
    result.find((clip) => clip.id === laterAudio.id),
    laterAudio,
  );
  assert.equal(
    result.some((clip) => clip.id === staleTranscript.id),
    false,
  );
  [
    overlay,
    overlayAudio,
    caption,
    importedCaption,
    narration,
    text,
    sticker,
    cutout,
  ].forEach((clip) => {
    assert.strictEqual(
      result.find((candidate) => candidate.id === clip.id),
      clip,
    );
  });
});

test("keeps dominant voice ranges with speed-aware source offsets", () => {
  const fastVideo: TimelineClip = {
    id: "fast-video",
    label: "Fast",
    track: "main",
    start: 20,
    duration: 120,
    sourceStart: 90,
    speed: 2,
    src: "fast.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "fast-audio",
  };
  const fastAudio: TimelineClip = {
    id: "fast-audio",
    label: "Fast audio",
    track: "audio",
    start: 20,
    duration: 120,
    sourceStart: 90,
    speed: 2,
    src: "fast.mp4",
    color: "#2563eb",
    linkedClipId: "fast-video",
  };
  const slowVideo: TimelineClip = {
    id: "slow-video",
    label: "Slow",
    track: "main",
    start: 10,
    duration: 240,
    sourceStart: 60,
    speed: 0.5,
    src: "slow.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "slow-audio",
  };
  const slowAudio: TimelineClip = {
    id: "slow-audio",
    label: "Slow audio",
    track: "audio",
    start: 10,
    duration: 240,
    sourceStart: 60,
    speed: 0.5,
    src: "slow.mp4",
    color: "#2563eb",
    linkedClipId: "slow-video",
  };

  const fastResult = keepDominantVoiceInLinkedVideo(
    [fastVideo, fastAudio],
    fastVideo.id,
    [
      { startSeconds: 1, endSeconds: 3 },
      { startSeconds: 5, endSeconds: 7 },
    ],
    30,
  );
  const slowResult = keepDominantVoiceInLinkedVideo(
    [slowVideo, slowAudio],
    slowVideo.id,
    [
      { startSeconds: 1, endSeconds: 2 },
      { startSeconds: 3, endSeconds: 4 },
    ],
    30,
  );

  assert.deepEqual(
    fastResult
      .filter((clip) => clip.id.startsWith("fast-video-dominant-"))
      .map(({ start, duration, sourceStart }) => ({
        start,
        duration,
        sourceStart,
      })),
    [
      { start: 20, duration: 30, sourceStart: 120 },
      { start: 50, duration: 30, sourceStart: 240 },
    ],
  );
  assert.deepEqual(
    slowResult
      .filter((clip) => clip.id.startsWith("slow-video-dominant-"))
      .map(({ start, duration, sourceStart }) => ({
        start,
        duration,
        sourceStart,
      })),
    [
      { start: 10, duration: 60, sourceStart: 90 },
      { start: 70, duration: 60, sourceStart: 150 },
    ],
  );
});

test("returns the original clips for invalid dominant voice keep ranges or links", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "other-video",
  };
  const clips = [video, audio];

  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(clips, video.id, [], 30),
    clips,
  );
  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: Number.NaN, endSeconds: 1 }],
      30,
    ),
    clips,
  );
  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 2, endSeconds: 1 }],
      30,
    ),
    clips,
  );
  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      clips,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );

  const reciprocal = [{ ...video }, { ...audio, linkedClipId: video.id }];
  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      reciprocal,
      video.id,
      [{ startSeconds: 0, endSeconds: 3 }],
      30,
    ),
    reciprocal,
  );
  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      reciprocal,
      video.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      0,
    ),
    reciprocal,
  );
});

test("does not clean a main-track image for dominant voice", () => {
  const image: TimelineClip = {
    id: "image",
    label: "Still",
    track: "main",
    start: 0,
    duration: 90,
    src: "still.png",
    mediaType: "image",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Still audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "still.png",
    color: "#2563eb",
    linkedClipId: "image",
  };
  const clips = [image, audio];

  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      clips,
      image.id,
      [{ startSeconds: 1, endSeconds: 2 }],
      30,
    ),
    clips,
  );
});

test("keeps metadata-light dominant voice videos while excluding explicit images", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const laterVideo: TimelineClip = {
    id: "later-video",
    label: "Later",
    track: "main",
    start: 90,
    duration: 30,
    src: "later.mp4",
    color: "#0891b2",
  };
  const laterImage: TimelineClip = {
    id: "later-image",
    label: "Still",
    track: "main",
    start: 90,
    duration: 30,
    src: "still.png",
    mediaType: "image",
    color: "#0891b2",
  };

  const result = keepDominantVoiceInLinkedVideo(
    [video, audio, laterVideo, laterImage],
    video.id,
    [{ startSeconds: 0, endSeconds: 1 }],
    30,
  );

  assert.equal(
    result.some((clip) => clip.id === "video-dominant-0"),
    true,
  );
  assert.equal(result.find((clip) => clip.id === laterVideo.id)?.start, 30);
  assert.strictEqual(
    result.find((clip) => clip.id === laterImage.id),
    laterImage,
  );
});

test("keeps main-track images and unrelated overlay transitions unchanged", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const laterVideo: TimelineClip = {
    id: "later-video",
    label: "Later",
    track: "main",
    start: 90,
    duration: 30,
    src: "later.mp4",
    mediaType: "video",
    color: "#0891b2",
  };
  const laterImage: TimelineClip = {
    id: "later-image",
    label: "Still",
    track: "main",
    start: 90,
    duration: 30,
    src: "still.png",
    mediaType: "image",
    color: "#0891b2",
  };
  const overlay: TimelineClip = {
    id: "overlay",
    label: "Overlay",
    track: "upper",
    start: 0,
    duration: 30,
    src: "overlay.mp4",
    mediaType: "video",
    color: "#7c3aed",
    transition: { preset: "fade", duration: 12 },
  };

  const result = keepDominantVoiceInLinkedVideo(
    [video, audio, laterVideo, laterImage, overlay],
    video.id,
    [{ startSeconds: 0, endSeconds: 1 }],
    30,
  );

  assert.equal(result.find((clip) => clip.id === laterVideo.id)?.start, 30);
  assert.strictEqual(
    result.find((clip) => clip.id === laterImage.id),
    laterImage,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === overlay.id),
    overlay,
  );
});

test("returns the original clips for malformed dominant voice ranges", () => {
  const video: TimelineClip = {
    id: "video",
    label: "Video",
    track: "main",
    start: 0,
    duration: 90,
    src: "video.mp4",
    mediaType: "video",
    color: "#0891b2",
    linkedClipId: "audio",
  };
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    src: "video.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  };
  const clips = [video, audio];

  assert.strictEqual(
    keepDominantVoiceInLinkedVideo(
      clips,
      video.id,
      [null, { startSeconds: 1, endSeconds: 2 }] as unknown as Array<{
        startSeconds: number;
        endSeconds: number;
      }>,
      30,
    ),
    clips,
  );
});

test("left trim consumes source frames at the selected clip speed", () => {
  const clips: TimelineClip[] = [
    {
      id: "main-fast",
      label: "Fast video",
      track: "main",
      start: 0,
      duration: 120,
      sourceStart: 40,
      speed: 2,
      color: "#0891b2",
      linkedClipId: "audio-fast",
    },
    {
      id: "audio-fast",
      label: "Fast audio",
      track: "audio",
      start: 0,
      duration: 120,
      sourceStart: 40,
      speed: 2,
      color: "#2563eb",
      linkedClipId: "main-fast",
    },
  ];

  const result = trimClipById(clips, "main-fast", "left", 30);

  assert.deepEqual(
    result.map(({ start, duration, sourceStart }) => ({
      start,
      duration,
      sourceStart,
    })),
    [
      { start: 30, duration: 90, sourceStart: 100 },
      { start: 30, duration: 90, sourceStart: 100 },
    ],
  );
});

test("creates recorded narration at the requested playhead", () => {
  const clip = createRecordedAudioClip({
    id: "voice-1",
    label: "Voice recording",
    src: "blob:voice",
    start: 90,
    durationSeconds: 2.4,
    fps: 30,
  });

  assert.deepEqual(clip, {
    id: "voice-1",
    label: "Voice recording",
    track: "audio",
    start: 90,
    duration: 72,
    color: "#2563eb",
    src: "blob:voice",
    volume: 1,
    audioKind: "voiceover",
  });
});

test("creates a main video with a separate matching audio clip", () => {
  const [video, audio] = createMainMediaPair({
    mainId: "main-1",
    audioId: "audio-1",
    label: "initialClips",
    src: "initialClips.mp4",
    start: 30,
    duration: 480,
  });

  assert.deepEqual(video, {
    id: "main-1",
    label: "initialClips",
    track: "main",
    start: 30,
    duration: 480,
    sourceStart: 0,
    color: "#0891b2",
    src: "initialClips.mp4",
    speed: 1,
    volume: 1,
    linkedClipId: "audio-1",
  });
  assert.deepEqual(audio, {
    id: "audio-1",
    label: "initialClips audio",
    track: "audio",
    start: 30,
    duration: 480,
    sourceStart: 0,
    color: "#2563eb",
    src: "initialClips.mp4",
    volume: 1,
    linkedClipId: "main-1",
    audioKind: "linked",
  });
});

test("creates a linked main video and audio pair", () => {
  const [video, audio] = createVideoMediaPair({
    videoId: "main-2",
    audioId: "main-audio-2",
    track: "main",
    label: "Main camera",
    src: "main-camera.mp4",
    start: 15,
    duration: 240,
  });

  assert.deepEqual(video, {
    id: "main-2",
    label: "Main camera",
    track: "main",
    start: 15,
    duration: 240,
    sourceStart: 0,
    color: "#0891b2",
    src: "main-camera.mp4",
    speed: 1,
    volume: 1,
    linkedClipId: "main-audio-2",
  });
  assert.deepEqual(audio, {
    id: "main-audio-2",
    label: "Main camera audio",
    track: "audio",
    start: 15,
    duration: 240,
    sourceStart: 0,
    color: "#2563eb",
    src: "main-camera.mp4",
    audioKind: "linked",
    speed: 1,
    volume: 1,
    linkedClipId: "main-2",
  });
});

test("creates linked scene clips with matching source offsets", () => {
  const [video, audio] = createVideoMediaPair({
    videoId: "video",
    audioId: "audio",
    track: "main",
    label: "Scene 2",
    src: "uploads/interview.mp4",
    start: 120,
    duration: 90,
    sourceStart: 60,
  });

  assert.equal(video.sourceStart, 60);
  assert.equal(audio.sourceStart, 60);
  assert.equal(video.duration, 90);
  assert.equal(audio.duration, 90);
});

test("defaults ordinary linked media source offsets to zero", () => {
  const [video, audio] = createVideoMediaPair({
    videoId: "ordinary-video",
    audioId: "ordinary-audio",
    track: "main",
    label: "Ordinary video",
    src: "uploads/ordinary.mp4",
    start: 0,
    duration: 120,
  });

  assert.equal(video.sourceStart, 0);
  assert.equal(audio.sourceStart, 0);
});

test("preserves a linked scene range through main placement and undo redo", () => {
  const original = [historyClip("original-main")];
  const scenePair = createVideoMediaPair({
    videoId: "scene-video",
    audioId: "scene-audio",
    track: "main",
    label: "Interview - Scene 2",
    src: "uploads/interview.mp4",
    start: 120,
    duration: 90,
    sourceStart: 60,
  });
  const placed = placeVideoPairOnLayer(original, scenePair, 0, 120);
  const committed = applyTimelineHistoryEdit(
    createTimelineHistory(original),
    placed,
  );

  assert.deepEqual(
    placed.map(({ id, duration, sourceStart }) => ({
      id,
      duration,
      sourceStart,
    })),
    [
      { id: "original-main", duration: 30, sourceStart: undefined },
      { id: "scene-video", duration: 90, sourceStart: 60 },
      { id: "scene-audio", duration: 90, sourceStart: 60 },
    ],
  );

  const undone = undoTimelineHistory(committed);
  assert.deepEqual(undone.present, original);
  assert.deepEqual(redoTimelineHistory(undone).present, placed);
});

test("preserves a linked scene range in an inserted signed layer", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "existing-main",
    audioId: "existing-main-audio",
    track: "main",
    label: "Existing main",
    src: "uploads/main.mp4",
    start: 0,
    duration: 180,
  });
  const scenePair = createVideoMediaPair({
    videoId: "scene-overlay",
    audioId: "scene-overlay-audio",
    track: "upper",
    label: "Interview - Scene 3",
    src: "uploads/interview.mp4",
    start: 45,
    duration: 75,
    sourceStart: 150,
  });

  const placed = placeVideoPairInInsertedLayer(
    [main, mainAudio],
    scenePair,
    -1,
    45,
  );
  const overlay = placed.find(({ id }) => id === "scene-overlay");
  const audio = placed.find(({ id }) => id === "scene-overlay-audio");

  assert.equal(getVideoLayer(overlay!), -1);
  assert.equal(overlay?.sourceStart, 150);
  assert.equal(audio?.sourceStart, 150);
  assert.equal(overlay?.duration, 75);
  assert.equal(audio?.duration, 75);
});

test("creates a linked overlay video and audio pair on its requested lane", () => {
  const [overlay, audio] = createVideoMediaPair({
    videoId: "overlay-1",
    audioId: "overlay-audio-1",
    track: "upper",
    label: "Camera",
    src: "camera.mp4",
    start: 60,
    duration: 120,
    overlayLane: 2,
  });

  assert.equal(overlay.linkedClipId, audio.id);
  assert.equal(audio.linkedClipId, overlay.id);
  assert.equal(audio.src, overlay.src);
  assert.equal(audio.start, overlay.start);
  assert.equal(audio.duration, overlay.duration);
  assert.equal(overlay.overlayLane, 2);
  assert.equal(overlay.track, "upper");
  assert.equal(overlay.color, "#7c3aed");
  assert.equal(audio.track, "audio");
  assert.equal(audio.color, "#2563eb");
});

test("returns only the selected video's linked audio for contextual playback", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "main-context",
    audioId: "main-context-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 240,
  });
  const [overlay, overlayAudio] = createVideoMediaPair({
    videoId: "overlay-context",
    audioId: "overlay-context-audio",
    track: "upper",
    label: "Overlay",
    src: "overlay.mp4",
    start: 60,
    duration: 120,
    overlayLane: 1,
  });
  const narration: TimelineClip = {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 0,
    duration: 240,
    color: "#2563eb",
    src: "narration.wav",
  };

  assert.deepEqual(
    getContextualAudioClips(
      [main, mainAudio, overlay, overlayAudio, narration],
      overlay.id,
    ),
    [overlayAudio],
  );
});

test("returns the complete reciprocal audio speech sequence in timeline order", () => {
  const video: TimelineClip = {
    id: "lesson-video",
    label: "Lesson",
    track: "main",
    start: 30,
    duration: 150,
    src: "lesson.mp4",
    color: "#0891b2",
    linkedClipId: "lesson-audio",
  };
  const audio: TimelineClip = {
    id: "lesson-audio",
    label: "Lesson audio",
    track: "audio",
    start: 30,
    duration: 150,
    src: "lesson.mp4",
    color: "#2563eb",
    linkedClipId: "lesson-video",
  };
  const segments = removeSilenceFromLinkedVideo(
    [video, audio],
    video.id,
    [{ startSeconds: 1, endSeconds: 2 }],
    30,
  );
  const videoSegments = segments.filter((clip) => clip.track === "main");
  const audioSegments = segments.filter((clip) => clip.track === "audio");
  const unrelatedNarration: TimelineClip = {
    id: "narration",
    label: "Lesson audio",
    track: "audio",
    start: 0,
    duration: 60,
    src: "lesson.mp4",
    color: "#2563eb",
  };
  const nearPrefixVideo: TimelineClip = {
    ...videoSegments[0]!,
    id: "lesson-video-alt-speech-0",
    start: 180,
    linkedClipId: "lesson-audio-alt-speech-0",
  };
  const nearPrefixAudio: TimelineClip = {
    ...audioSegments[0]!,
    id: "lesson-audio-alt-speech-0",
    start: 180,
    linkedClipId: nearPrefixVideo.id,
  };
  const oneWayAudio: TimelineClip = {
    ...audioSegments[0]!,
    id: "lesson-audio-one-way",
    start: 210,
    linkedClipId: "lesson-video-speech-0",
  };
  const independentMusic: TimelineClip = {
    id: "lesson-music",
    label: "Lesson audio",
    track: "audio",
    start: 240,
    duration: 60,
    src: "lesson.mp4",
    color: "#2563eb",
  };

  assert.deepEqual(
    getContextualAudioClips(
      [
        ...videoSegments,
        ...audioSegments.toReversed(),
        unrelatedNarration,
        nearPrefixVideo,
        nearPrefixAudio,
        oneWayAudio,
        independentMusic,
      ],
      "lesson-video-speech-0",
    ),
    audioSegments,
  );
});

test("prioritizes the active topmost overlay audio during playback", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "main-playback",
    audioId: "main-playback-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 300,
  });
  const [firstOverlay, firstOverlayAudio] = createVideoMediaPair({
    videoId: "overlay-playback-1",
    audioId: "overlay-playback-audio-1",
    track: "upper",
    label: "First overlay",
    src: "first-overlay.mp4",
    start: 60,
    duration: 120,
    overlayLane: 0,
  });
  const [topOverlay, topOverlayAudio] = createVideoMediaPair({
    videoId: "overlay-playback-2",
    audioId: "overlay-playback-audio-2",
    track: "upper",
    label: "Top overlay",
    src: "top-overlay.mp4",
    start: 90,
    duration: 120,
    overlayLane: 2,
  });
  const narration: TimelineClip = {
    id: "playback-narration",
    label: "Narration",
    track: "audio",
    start: 0,
    duration: 300,
    color: "#2563eb",
    src: "narration.wav",
  };
  const clips = [
    main,
    mainAudio,
    firstOverlay,
    firstOverlayAudio,
    topOverlay,
    topOverlayAudio,
    narration,
  ];

  assert.deepEqual(
    getPlaybackAudioClips(clips, 30).map((clip) => clip.id),
    [mainAudio.id],
  );
  assert.deepEqual(
    getPlaybackAudioClips(clips, 75).map((clip) => clip.id),
    [firstOverlayAudio.id],
  );
  assert.deepEqual(
    getPlaybackAudioClips(clips, 120).map((clip) => clip.id),
    [topOverlayAudio.id],
  );
});

test("falls back to main audio when the top overlay audio is muted", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "main-muted-overlay",
    audioId: "main-muted-overlay-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 240,
  });
  const [overlay, overlayAudio] = createVideoMediaPair({
    videoId: "muted-overlay",
    audioId: "muted-overlay-audio",
    track: "upper",
    label: "Muted overlay",
    src: "overlay.mp4",
    start: 0,
    duration: 120,
    overlayLane: 0,
  });
  const mutedOverlay = { ...overlay, volume: 0 };
  const mutedOverlayAudio = { ...overlayAudio, volume: 0 };

  assert.deepEqual(
    getPlaybackAudioClips(
      [main, mainAudio, mutedOverlay, mutedOverlayAudio],
      30,
    ).map((clip) => clip.id),
    [mainAudio.id],
  );
});

test("toggles one video layer with its audio and lets that audio be restored independently", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "visibility-main",
    audioId: "visibility-main-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 180,
  });
  const [overlay, overlayAudio] = createVideoMediaPair({
    videoId: "visibility-overlay",
    audioId: "visibility-overlay-audio",
    track: "upper",
    label: "Overlay",
    src: "overlay.mp4",
    start: 0,
    duration: 180,
    overlayLane: 1,
  });
  const clips = [main, mainAudio, overlay, overlayAudio];

  const hiddenOverlay = toggleTrackVisibility(clips, "upper", 2);
  assert.equal(
    hiddenOverlay.find((clip) => clip.id === overlay.id)?.hidden,
    true,
  );
  assert.equal(
    hiddenOverlay.find((clip) => clip.id === overlayAudio.id)?.hidden,
    true,
  );
  assert.equal(
    hiddenOverlay.find((clip) => clip.id === main.id)?.hidden,
    undefined,
  );
  assert.equal(isTrackHidden(hiddenOverlay, "upper", 2), true);

  const restoredOverlayAudio = toggleTrackVisibility(
    hiddenOverlay,
    "audio",
    null,
    [overlayAudio.id],
  );
  assert.equal(
    restoredOverlayAudio.find((clip) => clip.id === overlay.id)?.hidden,
    true,
  );
  assert.equal(
    restoredOverlayAudio.find((clip) => clip.id === overlayAudio.id)?.hidden,
    false,
  );
  assert.deepEqual(
    getIndependentPlaybackAudioClips(restoredOverlayAudio, 30).map(
      (clip) => clip.id,
    ),
    [overlayAudio.id],
  );

  const shownOverlay = toggleTrackVisibility(restoredOverlayAudio, "upper", 2);
  assert.equal(
    shownOverlay.find((clip) => clip.id === overlay.id)?.hidden,
    false,
  );
  assert.equal(
    shownOverlay.find((clip) => clip.id === overlayAudio.id)?.hidden,
    false,
  );
});

test("toggles every clip on a non-video track together", () => {
  const stickers: TimelineClip[] = [
    {
      id: "sticker-one",
      label: "One",
      track: "sticker",
      start: 0,
      duration: 60,
      color: "#f59e0b",
    },
    {
      id: "sticker-two",
      label: "Two",
      track: "sticker",
      start: 60,
      duration: 60,
      color: "#f59e0b",
    },
  ];

  const hidden = toggleTrackVisibility(stickers, "sticker");
  assert.equal(
    hidden.every((clip) => clip.hidden),
    true,
  );
  assert.equal(isTrackHidden(hidden, "sticker"), true);

  const shown = toggleTrackVisibility(hidden, "sticker");
  assert.equal(
    shown.every((clip) => clip.hidden === false),
    true,
  );
});

test("preserves occupied clips and snaps imported media after them on the target layer", () => {
  const [firstMain, firstMainAudio] = createVideoMediaPair({
    videoId: "main-a",
    audioId: "main-audio-a",
    track: "main",
    label: "Main A",
    src: "main-a.mp4",
    start: 0,
    duration: 120,
  });
  const [secondMain, secondMainAudio] = createVideoMediaPair({
    videoId: "main-b",
    audioId: "main-audio-b",
    track: "main",
    label: "Main B",
    src: "main-b.mp4",
    start: 80,
    duration: 140,
  });
  const [upper, upperAudio] = createVideoMediaPair({
    videoId: "upper",
    audioId: "upper-audio",
    track: "upper",
    label: "Upper",
    src: "upper.mp4",
    start: 90,
    duration: 100,
  });
  upper.videoLayer = 1;
  const [replacement, replacementAudio] = createVideoMediaPair({
    videoId: "replacement",
    audioId: "replacement-audio",
    track: "main",
    label: "Short replacement",
    src: "replacement.mp4",
    start: 90,
    duration: 45,
  });

  const result = placeVideoPairOnLayer(
    [firstMain, firstMainAudio, secondMain, secondMainAudio, upper, upperAudio],
    [replacement, replacementAudio],
    0,
    90,
  );

  assert.strictEqual(
    result.find((clip) => clip.id === firstMain.id),
    firstMain,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === firstMainAudio.id),
    firstMainAudio,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === secondMain.id),
    secondMain,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === secondMainAudio.id),
    secondMainAudio,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === upper.id),
    upper,
  );
  assert.strictEqual(
    result.find((clip) => clip.id === upperAudio.id),
    upperAudio,
  );
  assert.deepEqual(
    result
      .filter(
        (clip) => clip.id === replacement.id || clip.id === replacementAudio.id,
      )
      .map((clip) => ({
        id: clip.id,
        track: clip.track,
        start: clip.start,
        duration: clip.duration,
        videoLayer: clip.videoLayer,
      })),
    [
      {
        id: replacement.id,
        track: "main",
        start: 220,
        duration: 45,
        videoLayer: undefined,
      },
      {
        id: replacementAudio.id,
        track: "audio",
        start: 220,
        duration: 45,
        videoLayer: undefined,
      },
    ],
  );
});

test("inserts a new video layer between main and the first overlay layer", () => {
  const [main, mainAudio] = createVideoMediaPair({
    videoId: "main",
    audioId: "main-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 180,
  });
  const [existingOverlay, existingOverlayAudio] = createVideoMediaPair({
    videoId: "existing-overlay",
    audioId: "existing-overlay-audio",
    track: "upper",
    label: "Existing overlay",
    src: "existing.mp4",
    start: 0,
    duration: 120,
  });
  existingOverlay.videoLayer = 1;
  const [newOverlay, newOverlayAudio] = createVideoMediaPair({
    videoId: "new-overlay",
    audioId: "new-overlay-audio",
    track: "upper",
    label: "New overlay",
    src: "new.mp4",
    start: 30,
    duration: 90,
  });

  const result = placeVideoPairInInsertedLayer(
    [main, mainAudio, existingOverlay, existingOverlayAudio],
    [newOverlay, newOverlayAudio],
    1,
    30,
  );

  assert.equal(getVideoLayer(result.find((clip) => clip.id === "main")!), 0);
  assert.equal(
    getVideoLayer(result.find((clip) => clip.id === "new-overlay")!),
    1,
  );
  assert.equal(
    getVideoLayer(result.find((clip) => clip.id === "existing-overlay")!),
    2,
  );
  assert.equal(result.find((clip) => clip.id === "new-overlay")?.start, 30);
  assert.equal(
    result.find((clip) => clip.id === "new-overlay-audio")?.start,
    30,
  );
});

test("visual tools fall back to the highest visible signed video layer", () => {
  const [below] = createVideoMediaPair({
    videoId: "layer--1",
    audioId: "layer--1-audio",
    track: "upper",
    label: "Below",
    src: "below.mp4",
    start: 0,
    duration: 120,
  });
  below.videoLayer = -1;
  const [main] = createVideoMediaPair({
    videoId: "layer-0",
    audioId: "layer-0-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 120,
  });
  const [aboveOne] = createVideoMediaPair({
    videoId: "layer-1",
    audioId: "layer-1-audio",
    track: "upper",
    label: "Above one",
    src: "above-one.mp4",
    start: 0,
    duration: 120,
  });
  aboveOne.videoLayer = 1;
  const [aboveThree] = createVideoMediaPair({
    videoId: "layer-3",
    audioId: "layer-3-audio",
    track: "upper",
    label: "Above three",
    src: "above-three.mp4",
    start: 0,
    duration: 120,
  });
  aboveThree.videoLayer = 3;

  const clips = [aboveOne, main, aboveThree, below];

  assert.deepEqual(
    getActiveVideoLayersAtFrame(clips, 30).map(getVideoLayer),
    [-1, 0, 1, 3],
  );
  assert.equal(getTopVisibleVideoClipAtFrame(clips, 30)?.id, aboveThree.id);
  assert.equal(getVisualToolTargetClipId(clips, null, 30), aboveThree.id);
});

test("returns the original array when moving a video clip is a true no-op", () => {
  const [video, audio] = createVideoMediaPair({
    videoId: "video",
    audioId: "audio",
    track: "upper",
    label: "Video",
    src: "video.mp4",
    start: 40,
    duration: 90,
  });
  video.videoLayer = 2;
  const narration: TimelineClip = {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 0,
    duration: 180,
    color: "#2563eb",
    src: "narration.wav",
  };
  const clips = [video, audio, narration];

  assert.strictEqual(moveVideoClipToLayer(clips, video.id, 2, 40), clips);
});

test("snaps a moved clip flush after the front video for a small overlap", () => {
  const [oldClip] = createVideoMediaPair({
    videoId: "old",
    audioId: "old-audio",
    track: "main",
    label: "Old",
    src: "old.mp4",
    start: 0,
    duration: 120,
  });
  const [newClip, newAudio] = createVideoMediaPair({
    videoId: "new",
    audioId: "new-audio",
    track: "main",
    label: "New",
    src: "new.mp4",
    start: 240,
    duration: 90,
  });

  const clips = [oldClip, newClip, newAudio];
  const moved = moveVideoClipToLayer(
    clips,
    newClip.id,
    0,
    119,
  );

  assert.notStrictEqual(moved, clips);
  assert.equal(moved.find((clip) => clip.id === newClip.id)?.start, 120);
  assert.equal(moved.find((clip) => clip.id === newAudio.id)?.start, 120);
});

test("restores a later clip when it is dragged across an earlier clip", () => {
  const [oldClip] = createVideoMediaPair({
    videoId: "old",
    audioId: "old-audio",
    track: "main",
    label: "Old",
    src: "old.mp4",
    start: 120,
    duration: 120,
  });
  const [newClip] = createVideoMediaPair({
    videoId: "new",
    audioId: "new-audio",
    track: "main",
    label: "New",
    src: "new.mp4",
    start: 300,
    duration: 60,
  });

  const clips = [oldClip, newClip];
  const moved = moveVideoClipToLayer(clips, newClip.id, 0, 100);

  assert.strictEqual(moved, clips);
  assert.equal(newClip.start, 300);
});

test("allows moving a video exactly beside another video", () => {
  const [oldClip] = createVideoMediaPair({
    videoId: "old",
    audioId: "old-audio",
    track: "main",
    label: "Old",
    src: "old.mp4",
    start: 0,
    duration: 120,
  });
  const [newClip] = createVideoMediaPair({
    videoId: "new",
    audioId: "new-audio",
    track: "main",
    label: "New",
    src: "new.mp4",
    start: 300,
    duration: 60,
  });

  const moved = moveVideoClipToLayer([oldClip, newClip], newClip.id, 0, 120);

  assert.equal(moved.find((clip) => clip.id === newClip.id)?.start, 120);
});

test("restores a video moved onto an occupied video layer", () => {
  const [mainClip] = createVideoMediaPair({
    videoId: "main",
    audioId: "main-audio",
    track: "main",
    label: "Main",
    src: "main.mp4",
    start: 0,
    duration: 120,
  });
  const [upperClip] = createVideoMediaPair({
    videoId: "upper",
    audioId: "upper-audio",
    track: "upper",
    label: "Upper",
    src: "upper.mp4",
    start: 180,
    duration: 60,
  });
  upperClip.videoLayer = 1;
  const clips = [mainClip, upperClip];

  const moved = moveVideoClipToLayer(clips, upperClip.id, 0, 60);

  assert.strictEqual(moved, clips);
  assert.equal(upperClip.start, 180);
  assert.equal(upperClip.videoLayer, 1);
});

test("does not create an empty narration clip", () => {
  assert.equal(
    createRecordedAudioClip({
      id: "voice-1",
      label: "Voice recording",
      src: "blob:voice",
      start: 0,
      durationSeconds: 0,
      fps: 30,
    }),
    null,
  );
});

test("creates a three-second sticker clip at the playhead", () => {
  const sticker = createStickerClip({
    id: "sticker-1",
    label: "Star",
    src: "data:image/svg+xml,star",
    playheadFrame: 120,
  });

  assert.deepEqual(sticker, {
    id: "sticker-1",
    label: "Star",
    track: "sticker",
    start: 120,
    duration: 90,
    color: "#f59e0b",
    src: "data:image/svg+xml,star",
    sticker: { x: 50, y: 50, scale: 1, rotation: 0 },
  });
  assert.equal(
    getActiveClipAtFrame([sticker], "sticker", 120)?.id,
    "sticker-1",
  );
  assert.equal(
    getActiveClipAtFrame([sticker], "sticker", 209)?.id,
    "sticker-1",
  );
  assert.equal(getActiveClipAtFrame([sticker], "sticker", 210), undefined);
});

test("appends overlapping stickers without changing other tracks", () => {
  const main = historyClip("main");
  const audio: TimelineClip = {
    id: "audio",
    label: "Audio",
    track: "audio",
    start: 0,
    duration: 90,
    color: "#2563eb",
  };
  const firstSticker = createStickerClip({
    id: "sticker-1",
    label: "Star",
    src: "star.svg",
    playheadFrame: 30,
  });
  const secondSticker = createStickerClip({
    id: "sticker-2",
    label: "Heart",
    src: "heart.svg",
    playheadFrame: 30,
  });

  const result = appendStickerClip(
    appendStickerClip([main, audio], firstSticker),
    secondSticker,
  );

  assert.deepEqual(
    result.filter((clip) => clip.track === "sticker"),
    [firstSticker, secondSticker],
  );
  assert.strictEqual(result[0], main);
  assert.strictEqual(result[1], audio);
});

test("shows optional timeline tracks only while they contain clips", () => {
  const clips: TimelineClip[] = [
    historyClip("main"),
    createStickerClip({
      id: "sticker-1",
      label: "Star",
      src: "star.svg",
      playheadFrame: 0,
    }),
  ];

  assert.equal(hasClipsOnTrack(clips, "sticker"), true);
  assert.equal(hasClipsOnTrack(clips, "caption"), false);
  assert.equal(
    hasClipsOnTrack(deleteClipById(clips, "sticker-1"), "sticker"),
    false,
  );
});

test("does not show optional tracks for empty leftover records", () => {
  const emptyOptionalClips: TimelineClip[] = [
    {
      id: "empty-caption",
      label: "",
      track: "caption",
      start: 0,
      duration: 30,
      color: "#fff",
    },
    {
      id: "empty-text",
      label: "",
      track: "text",
      start: 0,
      duration: 30,
      color: "#fff",
    },
    {
      id: "empty-sticker",
      label: "",
      track: "sticker",
      start: 0,
      duration: 30,
      color: "#fff",
    },
    {
      id: "empty-cutout",
      label: "",
      track: "cutout",
      start: 0,
      duration: 30,
      color: "#fff",
    },
  ];

  for (const track of ["caption", "text", "sticker", "cutout"] as const) {
    assert.equal(hasClipsOnTrack(emptyOptionalClips, track), false);
  }
});

test("creates a three-second text clip at the playhead", () => {
  const textClip = createTextClip({
    id: "text-1",
    content: "Hello world",
    playheadFrame: 75,
  });

  assert.deepEqual(textClip, {
    id: "text-1",
    label: "Hello world",
    track: "text",
    start: 75,
    duration: 90,
    color: "#f97316",
    text: {
      content: "Hello world",
      x: 50,
      y: 78,
      fontSize: 42,
      color: "#ffffff",
      fontFamily: "Inter",
      fontWeight: "900",
      fontStyle: "normal",
      effect: "none",
      animation: "none",
      rotation: 0,
    },
  });
});

const layerControlClips: TimelineClip[] = [
  {
    id: "main-1",
    label: "Main 1",
    track: "main",
    start: 0,
    duration: 120,
    color: "#0891b2",
    speed: 1,
    volume: 1,
    linkedClipId: "main-audio-1",
  },
  {
    id: "main-audio-1",
    label: "Main 1 audio",
    track: "audio",
    start: 0,
    duration: 120,
    color: "#2563eb",
    speed: 1,
    volume: 1,
    linkedClipId: "main-1",
  },
  {
    id: "main-2",
    label: "Main 2",
    track: "main",
    start: 120,
    duration: 90,
    color: "#0891b2",
    speed: 1,
    volume: 1,
    linkedClipId: "main-audio-2",
  },
  {
    id: "main-audio-2",
    label: "Main 2 audio",
    track: "audio",
    start: 120,
    duration: 90,
    color: "#2563eb",
    speed: 1,
    volume: 1,
    linkedClipId: "main-2",
  },
  {
    id: "overlay",
    label: "Overlay",
    track: "upper",
    start: 0,
    duration: 60,
    color: "#7c3aed",
    speed: 1,
    volume: 1,
    videoLayer: 1,
    linkedClipId: "overlay-audio",
  },
  {
    id: "overlay-audio",
    label: "Overlay audio",
    track: "audio",
    start: 0,
    duration: 60,
    color: "#2563eb",
    speed: 1,
    volume: 1,
    linkedClipId: "overlay",
  },
  {
    id: "image",
    label: "Image",
    track: "upper",
    start: 0,
    duration: 45,
    color: "#f59e0b",
    mediaType: "image",
    speed: 1,
    volume: 0.8,
    videoLayer: 1,
  },
  {
    id: "narration",
    label: "Narration",
    track: "audio",
    start: 0,
    duration: 300,
    color: "#1d4ed8",
    speed: 1,
    volume: 1,
  },
  {
    id: "music",
    label: "Music",
    track: "audio",
    start: 0,
    duration: 300,
    color: "#1d4ed8",
    speed: 1,
    volume: 0.5,
  },
  {
    id: "caption",
    label: "Caption",
    track: "caption",
    start: 0,
    duration: 60,
    color: "#ef4444",
    content: "Unchanged",
  },
  {
    id: "legacy-main",
    label: "Legacy main",
    track: "main",
    start: 210,
    duration: 30,
    color: "#0891b2",
    speed: 1,
    volume: 1,
  },
];

test("sets exact speed on every video in one signed layer and its linked audio", () => {
  const result = setVideoLayerSpeed(layerControlClips, 0, 1.5);

  assert.deepEqual(
    result
      .filter((clip) =>
        [
          "main-1",
          "main-audio-1",
          "main-2",
          "main-audio-2",
          "legacy-main",
        ].includes(clip.id),
      )
      .map(({ id, speed }) => ({ id, speed })),
    [
      { id: "main-1", speed: 1.5 },
      { id: "main-audio-1", speed: 1.5 },
      { id: "main-2", speed: 1.5 },
      { id: "main-audio-2", speed: 1.5 },
      { id: "legacy-main", speed: 1.5 },
    ],
  );
  for (const id of [
    "overlay",
    "overlay-audio",
    "narration",
    "music",
    "caption",
  ]) {
    assert.strictEqual(
      result.find((clip) => clip.id === id),
      layerControlClips.find((clip) => clip.id === id),
    );
  }
});

const createRippleLayerClips = (): TimelineClip[] => [
  {
    id: "ripple-video-1",
    label: "Ripple video 1",
    track: "upper",
    start: 30,
    duration: 120,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1,
    videoLayer: -3,
    linkedClipId: "ripple-audio-1",
  },
  {
    id: "ripple-audio-1",
    label: "Ripple audio 1",
    track: "audio",
    start: 30,
    duration: 120,
    color: "#2563eb",
    speed: 1,
    linkedClipId: "ripple-video-1",
  },
  {
    id: "ripple-video-2",
    label: "Ripple video 2",
    track: "upper",
    start: 150,
    duration: 180,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1,
    videoLayer: -3,
    linkedClipId: "ripple-audio-2",
  },
  {
    id: "ripple-audio-2",
    label: "Ripple audio 2",
    track: "audio",
    start: 150,
    duration: 180,
    color: "#2563eb",
    speed: 1,
    linkedClipId: "ripple-video-2",
  },
  {
    id: "ripple-video-3",
    label: "Ripple video 3",
    track: "upper",
    start: 330,
    duration: 240,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1,
    videoLayer: -3,
    linkedClipId: "ripple-audio-3",
  },
  {
    id: "ripple-audio-3",
    label: "Ripple audio 3",
    track: "audio",
    start: 330,
    duration: 240,
    color: "#2563eb",
    speed: 1,
    linkedClipId: "ripple-video-3",
  },
  {
    id: "unrelated-video",
    label: "Unrelated video",
    track: "upper",
    start: 700,
    duration: 45,
    color: "#f59e0b",
    mediaType: "video",
    speed: 1,
    videoLayer: -2,
  },
  {
    id: "unrelated-caption",
    label: "Unrelated caption",
    track: "caption",
    start: 30,
    duration: 60,
    color: "#ef4444",
    content: "Unchanged",
  },
];

test("keeps a video layer contiguous when speeding up", () => {
  const clips = createRippleLayerClips();
  const result = setVideoLayerSpeed(clips, -3, 2);
  const videos = result.filter((clip) => clip.id.startsWith("ripple-video"));

  assert.deepEqual(
    videos.map(({ id, start, duration, speed }) => ({
      id,
      start,
      duration,
      speed,
    })),
    [
      { id: "ripple-video-1", start: 30, duration: 60, speed: 2 },
      { id: "ripple-video-2", start: 90, duration: 90, speed: 2 },
      { id: "ripple-video-3", start: 180, duration: 120, speed: 2 },
    ],
  );

  for (const video of videos) {
    const audio = result.find((clip) => clip.id === video.linkedClipId);
    assert.ok(audio);
    assert.equal(audio.start, video.start);
    assert.equal(audio.duration, video.duration);
    assert.equal(audio.speed, video.speed);
  }
  for (const id of ["unrelated-video", "unrelated-caption"]) {
    assert.strictEqual(
      result.find((clip) => clip.id === id),
      clips.find((clip) => clip.id === id),
    );
  }
});

test("keeps a video layer contiguous when slowing down", () => {
  const clips = createRippleLayerClips();
  const result = setVideoLayerSpeed(clips, -3, 0.5);
  const videos = result.filter((clip) => clip.id.startsWith("ripple-video"));

  assert.deepEqual(
    videos.map(({ id, start, duration, speed }) => ({
      id,
      start,
      duration,
      speed,
    })),
    [
      { id: "ripple-video-1", start: 30, duration: 240, speed: 0.5 },
      { id: "ripple-video-2", start: 270, duration: 360, speed: 0.5 },
      { id: "ripple-video-3", start: 630, duration: 480, speed: 0.5 },
    ],
  );

  assert.equal(
    videos[1]?.start,
    (videos[0]?.start ?? 0) + (videos[0]?.duration ?? 0),
  );
  assert.equal(
    videos[2]?.start,
    (videos[1]?.start ?? 0) + (videos[1]?.duration ?? 0),
  );
  for (const video of videos) {
    const audio = result.find((clip) => clip.id === video.linkedClipId);
    assert.ok(audio);
    assert.equal(audio.start, video.start);
    assert.equal(audio.duration, video.duration);
    assert.equal(audio.speed, video.speed);
  }
});

test("sets exact volume on every video in one signed layer and its linked audio", () => {
  const result = setVideoLayerVolume(layerControlClips, 1, 0.7);

  assert.equal(result.find((clip) => clip.id === "overlay")?.volume, 0.7);
  assert.equal(result.find((clip) => clip.id === "overlay-audio")?.volume, 0.7);
  for (const id of [
    "main-1",
    "main-audio-1",
    "legacy-main",
    "narration",
    "music",
    "caption",
  ]) {
    assert.strictEqual(
      result.find((clip) => clip.id === id),
      layerControlClips.find((clip) => clip.id === id),
    );
  }
});

test("leaves images unchanged when controlling their signed video layer", () => {
  const result = setVideoLayerSpeed(layerControlClips, 1, 2);
  const volumeResult = setVideoLayerVolume(layerControlClips, 1, 0.2);
  const image = layerControlClips.find((clip) => clip.id === "image");

  assert.strictEqual(
    result.find((clip) => clip.id === "image"),
    image,
  );
  assert.deepEqual(
    result.find((clip) => clip.id === "image"),
    {
      id: "image",
      label: "Image",
      track: "upper",
      start: 0,
      duration: 45,
      color: "#f59e0b",
      mediaType: "image",
      speed: 1,
      volume: 0.8,
      videoLayer: 1,
    },
  );
  assert.strictEqual(
    volumeResult.find((clip) => clip.id === "image"),
    image,
  );
});

test("derives layer controls from only non-image clips on the exact signed layer", () => {
  const belowVideo: TimelineClip = {
    id: "below-video",
    label: "Below video",
    track: "upper",
    start: 0,
    duration: 120,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1.25,
    volume: 0.6,
    videoLayer: -1,
  };
  const belowImage: TimelineClip = {
    ...belowVideo,
    id: "below-image",
    label: "Below image",
    mediaType: "image",
    speed: 0.5,
    volume: 0.1,
  };

  assert.deepEqual(getVideoLayerControlState([belowVideo, belowImage], -1), {
    hasSelectedVideoLayer: true,
    speed: 1.25,
    volume: 0.6,
  });
  assert.deepEqual(getVideoLayerControlState([belowImage], -1), {
    hasSelectedVideoLayer: false,
    speed: 1,
    volume: 1,
  });
});

test("keeps reciprocal audio duration synchronized after a signed-layer speed change", () => {
  const video: TimelineClip = {
    id: "below-video",
    label: "Below video",
    track: "upper",
    start: 0,
    duration: 120,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1,
    videoLayer: -1,
    linkedClipId: "below-audio",
  };
  const audio: TimelineClip = {
    id: "below-audio",
    label: "Below audio",
    track: "audio",
    start: 0,
    duration: 120,
    color: "#2563eb",
    speed: 1,
    linkedClipId: "below-video",
  };

  const result = setVideoLayerSpeed([video, audio], -1, 2);

  assert.equal(result[0]?.duration, 60);
  assert.equal(result[1]?.duration, 60);
  assert.equal(result[0]?.speed, 2);
  assert.equal(result[1]?.speed, 2);
});

test("leaves one-way linked audio untouched by signed-layer controls", () => {
  const video: TimelineClip = {
    id: "one-way-video",
    label: "One-way video",
    track: "upper",
    start: 0,
    duration: 120,
    color: "#7c3aed",
    mediaType: "video",
    speed: 1,
    volume: 1,
    videoLayer: -2,
    linkedClipId: "one-way-audio",
  };
  const audio: TimelineClip = {
    id: "one-way-audio",
    label: "One-way audio",
    track: "audio",
    start: 0,
    duration: 120,
    color: "#2563eb",
    speed: 1,
    volume: 1,
  };

  const spedUp = setVideoLayerSpeed([video, audio], -2, 2);
  const quieter = setVideoLayerVolume([video, audio], -2, 0.4);

  assert.equal(spedUp[0]?.duration, 60);
  assert.equal(spedUp[1], audio);
  assert.equal(quieter[0]?.volume, 0.4);
  assert.equal(quieter[1], audio);
});

test("finalizes multiple video-layer drag previews as one undoable history entry", () => {
  const original = layerControlClips.map((clip) => ({ ...clip }));
  const gesture = startVideoLayerControlHistoryGesture(original, 1, "speed");
  const firstPreview = previewVideoLayerControlHistoryGesture(gesture, 1.25);
  const secondPreview = previewVideoLayerControlHistoryGesture(gesture, 1.5);
  const completed = finishVideoLayerControlHistoryGesture(
    { ...createTimelineHistory(original), present: secondPreview },
    gesture,
  );

  assert.equal(firstPreview.find((clip) => clip.id === "overlay")?.speed, 1.25);
  assert.equal(completed.past.length, 1);
  assert.deepEqual(undoTimelineHistory(completed).present, original);
});

test("finalizes multiple video-layer volume previews as one undoable history entry", () => {
  const original = layerControlClips.map((clip) => ({ ...clip }));
  const gesture = startVideoLayerControlHistoryGesture(original, 1, "volume");
  const firstPreview = previewVideoLayerControlHistoryGesture(gesture, 0.8);
  const secondPreview = previewVideoLayerControlHistoryGesture(gesture, 0.5);
  const completed = finishVideoLayerControlHistoryGesture(
    { ...createTimelineHistory(original), present: secondPreview },
    gesture,
  );

  assert.equal(firstPreview.find((clip) => clip.id === "overlay")?.volume, 0.8);
  assert.equal(completed.past.length, 1);
  assert.deepEqual(undoTimelineHistory(completed).present, original);
});

test("rejects invalid video-layer speed and volume values", () => {
  assert.strictEqual(
    setVideoLayerSpeed(layerControlClips, 0, 0),
    layerControlClips,
  );
  assert.strictEqual(
    setVideoLayerSpeed(layerControlClips, 0, Number.NaN),
    layerControlClips,
  );
  assert.strictEqual(
    setVideoLayerVolume(layerControlClips, 0, -0.1),
    layerControlClips,
  );
  assert.strictEqual(
    setVideoLayerVolume(layerControlClips, 0, Number.NaN),
    layerControlClips,
  );
});

test("creates a three-second image cutout at the playhead", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-image-1",
    label: "Logo",
    src: "uploads/logo.png",
    playheadFrame: 75,
  });

  assert.deepEqual(cutout, {
    id: "cutout-image-1",
    label: "Logo",
    track: "cutout",
    start: 75,
    duration: 90,
    color: "#0d9488",
    src: "uploads/logo.png",
    cutout: {
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      mediaKind: "image",
      originalSrc: "uploads/logo.png",
    },
  });
});

test("creates a linked video cutout and audio pair at the playhead", () => {
  const [cutout, audio] = createCutoutVideoPair({
    videoId: "cutout-video-1",
    audioId: "cutout-audio-1",
    label: "Presenter",
    src: "uploads/presenter.mp4",
    start: 120,
    duration: 180,
  });

  assert.equal(cutout.track, "cutout");
  assert.equal(cutout.linkedClipId, audio.id);
  assert.deepEqual(cutout.cutout, {
    x: 50,
    y: 50,
    scale: 1,
    rotation: 0,
    mediaKind: "video",
  });
  assert.equal(audio.track, "audio");
  assert.equal(audio.linkedClipId, cutout.id);
  assert.equal(audio.start, cutout.start);
  assert.equal(audio.duration, cutout.duration);
  assert.deepEqual(getContextualAudioClips([cutout, audio], cutout.id), [
    audio,
  ]);
  assert.deepEqual(getPlaybackAudioClips([cutout, audio], 150), [audio]);
});

test("keeps a video cutout and its audio synchronized through edits", () => {
  const [cutout, audio] = createCutoutVideoPair({
    videoId: "cutout-video-edit",
    audioId: "cutout-audio-edit",
    label: "Object",
    src: "uploads/object.mp4",
    start: 60,
    duration: 180,
  });

  const trimmed = trimClipById([cutout, audio], cutout.id, "left", 30);
  assert.equal(trimmed.find((clip) => clip.id === cutout.id)?.start, 90);
  assert.equal(trimmed.find((clip) => clip.id === audio.id)?.start, 90);
  assert.equal(trimmed.find((clip) => clip.id === cutout.id)?.duration, 150);
  assert.equal(trimmed.find((clip) => clip.id === audio.id)?.duration, 150);

  const split = splitClipByIdAtFrame([cutout, audio], cutout.id, 150);
  assert.equal(split.filter((clip) => clip.track === "cutout").length, 2);
  assert.equal(split.filter((clip) => clip.track === "audio").length, 2);
  assert.equal(deleteClipById([cutout, audio], cutout.id).length, 0);
});

test("keeps video cutout speed and volume synchronized with linked audio", () => {
  const [cutout, audio] = createCutoutVideoPair({
    videoId: "cutout-video-controls",
    audioId: "cutout-audio-controls",
    label: "Speaker",
    src: "uploads/speaker.mp4",
    start: 0,
    duration: 240,
  });

  const spedUp = setClipSpeedById([cutout, audio], cutout.id, 2);
  assert.equal(spedUp.find((clip) => clip.id === cutout.id)?.duration, 120);
  assert.equal(spedUp.find((clip) => clip.id === audio.id)?.duration, 120);
  assert.equal(spedUp.find((clip) => clip.id === cutout.id)?.speed, 2);
  assert.equal(spedUp.find((clip) => clip.id === audio.id)?.speed, 2);

  const quieter = setClipVolumeById([cutout, audio], cutout.id, 0.35);
  assert.equal(quieter.find((clip) => clip.id === cutout.id)?.volume, 0.35);
  assert.equal(quieter.find((clip) => clip.id === audio.id)?.volume, 0.35);
});

test("sets a solid-color key on selected main and cutout videos", () => {
  const [videoCutout, audio] = createCutoutVideoPair({
    videoId: "cutout-video-key",
    audioId: "cutout-audio-key",
    label: "Green screen",
    src: "green.mp4",
    playheadFrame: 0,
    duration: 120,
  });
  const imageCutout = createCutoutImageClip({
    id: "cutout-image-key",
    label: "Poster",
    src: "poster.png",
    playheadFrame: 0,
  });

  const updated = setCutoutChromaKeyById(
    [videoCutout, audio, imageCutout],
    videoCutout.id,
    "green",
  );

  assert.equal(
    updated.find((clip) => clip.id === videoCutout.id)?.cutout?.chromaKey,
    "green",
  );
  assert.equal(updated.find((clip) => clip.id === audio.id)?.cutout, undefined);
  assert.equal(
    setCutoutChromaKeyById(updated, imageCutout.id, "white"),
    updated,
  );

  const mainVideo = {
    id: "main-video-key",
    label: "Main green screen",
    track: "main" as const,
    start: 0,
    duration: 120,
    color: "#0891b2",
    src: "main-green.mp4",
    mediaType: "video" as const,
  };
  const keyedMain = setCutoutChromaKeyById([mainVideo], mainVideo.id, "green");
  assert.equal(keyedMain[0]?.chromaKey, "green");

  const legacyMain = { ...mainVideo, id: "legacy-main-video" };
  delete (legacyMain as Partial<typeof legacyMain>).mediaType;
  const keyedLegacyMain = setCutoutChromaKeyById(
    [legacyMain],
    legacyMain.id,
    "white",
  );
  assert.equal(keyedLegacyMain[0]?.chromaKey, "white");
});

test("moves an image cutout horizontally on the timeline", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-image-move",
    label: "Logo",
    src: "uploads/logo.png",
    playheadFrame: 30,
  });

  const moved = moveCutoutClip([cutout], cutout.id, 180, 480);

  assert.equal(moved[0]?.start, 180);
  assert.strictEqual(moveCutoutClip(moved, cutout.id, 180, 480), moved);
});

test("moves a video cutout together with its reciprocal audio", () => {
  const [cutout, audio] = createCutoutVideoPair({
    videoId: "cutout-video-move",
    audioId: "cutout-audio-move",
    label: "Presenter",
    src: "uploads/presenter.mp4",
    start: 60,
    duration: 180,
  });

  const moved = moveCutoutClip([cutout, audio], cutout.id, 210, 600);

  assert.equal(moved.find((clip) => clip.id === cutout.id)?.start, 210);
  assert.equal(moved.find((clip) => clip.id === audio.id)?.start, 210);
});

test("stores erase and restore strokes and can reset the cutout mask", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-mask",
    label: "Person",
    src: "uploads/person.png",
    playheadFrame: 0,
  });
  const erased = appendCutoutMaskStroke([cutout], cutout.id, {
    mode: "erase",
    size: 12,
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
  });
  const restored = appendCutoutMaskStroke(erased, cutout.id, {
    mode: "restore",
    size: 8,
    points: [{ x: 20, y: 30 }],
  });

  assert.equal(restored[0]?.cutout?.maskStrokes?.length, 2);
  const maskUrl = createCutoutMaskDataUrl(restored[0]?.cutout);
  assert.match(maskUrl, /^data:image\/svg\+xml,/);
  const decodedMask = decodeURIComponent(maskUrl.split(",", 2)[1] ?? "");
  assert.match(decodedMask, /<mask id="cutout-mask"/);
  assert.match(decodedMask, /mask="url\(#cutout-mask\)"/);
  assert.deepEqual(
    resetCutoutMask(restored, cutout.id)[0]?.cutout?.maskStrokes,
    [],
  );
});

test("resetting an automatic cutout restores its original image source", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-reset-auto",
    label: "Bottle",
    src: "uploads/bottle-original.png",
    playheadFrame: 0,
  });
  const processed = applyAutomaticCutoutById(
    [cutout],
    cutout.id,
    "uploads/bottle-background-removed.png",
  );

  const reset = resetCutoutMask(processed, cutout.id);

  assert.equal(reset[0]?.src, "uploads/bottle-original.png");
  assert.equal(reset[0]?.cutout?.originalSrc, undefined);
  assert.deepEqual(reset[0]?.cutout?.maskStrokes, []);
});

test("resizes a cutout independently from all eight selection handles", () => {
  const transform = {
    x: 50,
    y: 50,
    scale: 1,
    rotation: 0,
    mediaKind: "image" as const,
  };
  const right = resizeCutoutTransform({
    transform,
    handle: "right",
    deltaX: 50,
    deltaY: 40,
    baseWidth: 100,
    baseHeight: 80,
    previewWidth: 500,
    previewHeight: 400,
  });
  assert.equal(right.scaleX, 1.5);
  assert.equal(right.scaleY, 1);
  assert.equal(right.x, 55);
  assert.equal(right.y, 50);

  const topLeft = resizeCutoutTransform({
    transform,
    handle: "top-left",
    deltaX: -20,
    deltaY: -16,
    baseWidth: 100,
    baseHeight: 80,
    previewWidth: 500,
    previewHeight: 400,
  });
  assert.equal(topLeft.scaleX, 1.2);
  assert.equal(topLeft.scaleY, 1.2);
  assert.equal(topLeft.x, 48);
  assert.equal(topLeft.y, 48);
});

test("automatic video cutout rebases a processed split segment and preserves timeline properties", () => {
  const [video, audio] = createCutoutVideoPair({
    videoId: "cutout-video-auto",
    audioId: "cutout-video-auto-audio",
    label: "Person",
    src: "uploads/person-original.mp4",
    start: 45,
    duration: 150,
  });
  const cutout = {
    ...video,
    sourceStart: 90,
    speed: 1.25,
    cutout: {
      ...video.cutout!,
      x: 42,
      y: 58,
      scale: 1.4,
      rotation: -12,
      chromaKey: "green" as const,
      maskStrokes: [
        { mode: "erase" as const, size: 12, points: [{ x: 10, y: 20 }] },
      ],
    },
  };
  const clips = [cutout, audio];

  const result = applyAutomaticCutoutById(
    clips,
    cutout.id,
    "uploads/person-transparent.webm",
  );

  assert.equal(result[0]?.src, "uploads/person-transparent.webm");
  assert.equal(result[0]?.id, cutout.id);
  assert.equal(result[0]?.start, cutout.start);
  assert.equal(result[0]?.duration, cutout.duration);
  assert.equal(result[0]?.sourceStart, 0);
  assert.equal(result[0]?.speed, cutout.speed);
  assert.deepEqual(result[0]?.cutout, {
    ...cutout.cutout,
    originalSrc: "uploads/person-original.mp4",
    originalSourceStart: 90,
    maskStrokes: [],
    chromaKey: "none",
  });
  assert.strictEqual(result[1], audio);

  const repeated = applyAutomaticCutoutById(
    result,
    cutout.id,
    "uploads/person-transparent-v2.webm",
  );

  assert.equal(repeated[0]?.src, "uploads/person-transparent-v2.webm");
  assert.equal(repeated[0]?.sourceStart, 0);
  assert.equal(repeated[0]?.cutout?.originalSrc, "uploads/person-original.mp4");
  assert.equal(repeated[0]?.cutout?.originalSourceStart, 90);
  assert.strictEqual(repeated[1], audio);
});

test("split and trim preserve effective original offsets for a processed 2x video cutout", () => {
  const [video, audio] = createCutoutVideoPair({
    videoId: "cutout-fast",
    audioId: "cutout-fast-audio",
    label: "Fast person",
    src: "uploads/person-original.mp4",
    start: 0,
    duration: 120,
  });
  const originalVideo = { ...video, sourceStart: 90, speed: 2 };
  const originalAudio = { ...audio, sourceStart: 90, speed: 2 };
  const processed = applyAutomaticCutoutById(
    [originalVideo, originalAudio],
    originalVideo.id,
    "uploads/person-transparent.webm",
  );

  const split = splitClipByIdAtFrame(processed, originalVideo.id, 30);
  const splitRight = split.find((clip) => clip.id === `${originalVideo.id}-b`)!;
  assert.equal(splitRight.sourceStart, 60);
  assert.equal(getEffectiveCutoutOriginalSourceStart(splitRight), 150);
  assert.equal(
    resetCutoutMask(split, splitRight.id).find(
      (clip) => clip.id === splitRight.id,
    )?.sourceStart,
    150,
  );

  const trimmed = trimClipById(processed, originalVideo.id, "left", 30);
  const trimmedVideo = trimmed.find((clip) => clip.id === originalVideo.id)!;
  assert.equal(trimmedVideo.sourceStart, 60);
  assert.equal(getEffectiveCutoutOriginalSourceStart(trimmedVideo), 150);
  assert.equal(
    resetCutoutMask(trimmed, originalVideo.id).find(
      (clip) => clip.id === originalVideo.id,
    )?.sourceStart,
    150,
  );
});

test("resetting an automatic video cutout restores its original source offset and audio sync", () => {
  const [video, createdAudio] = createCutoutVideoPair({
    videoId: "cutout-video-reset",
    audioId: "cutout-video-reset-audio",
    label: "Speaker",
    src: "uploads/speaker-original.mp4",
    start: 120,
    duration: 180,
  });
  const cutout = { ...video, sourceStart: 75, speed: 1.5 };
  const audio = { ...createdAudio, sourceStart: 75, speed: 1.5 };
  const processed = applyAutomaticCutoutById(
    [cutout, audio],
    cutout.id,
    "uploads/speaker-transparent.webm",
  );

  const reset = resetCutoutMask(processed, cutout.id);

  assert.equal(reset[0]?.src, "uploads/speaker-original.mp4");
  assert.equal(reset[0]?.sourceStart, 75);
  assert.equal(reset[0]?.start, cutout.start);
  assert.equal(reset[0]?.duration, cutout.duration);
  assert.equal(reset[0]?.speed, cutout.speed);
  assert.equal(reset[0]?.cutout?.originalSrc, undefined);
  assert.equal(reset[0]?.cutout?.originalSourceStart, undefined);
  assert.strictEqual(reset[1], audio);
  assert.equal(reset[1]?.sourceStart, reset[0]?.sourceStart);
});

test("automatically removes pixels matching the image corner background", () => {
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 20, 40, 80, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255,
  ]);

  const result = removeBackgroundPixels(pixels, 3, 3, 30);

  assert.deepEqual(
    Array.from(result),
    [
      255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0,
      20, 40, 80, 255, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0,
      255, 255, 255, 0,
    ],
  );
});

test("automatic cutout preserves pale object pixels enclosed by foreground", () => {
  const width = 5;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    const index = (y * width + x) * 4;
    pixels.set([...color, 255], index);
  };
  for (let position = 1; position <= 3; position += 1) {
    setPixel(position, 1, [20, 20, 20]);
    setPixel(position, 3, [20, 20, 20]);
    setPixel(1, position, [20, 20, 20]);
    setPixel(3, position, [20, 20, 20]);
  }
  setPixel(2, 2, [245, 225, 230]);

  const result = removeBackgroundPixels(pixels, width, height, 72);

  assert.equal(result[3], 0);
  assert.equal(result[(2 * width + 2) * 4 + 3], 255);
});

test("automatic cutout preserves near-white highlights that are not edge background", () => {
  const width = 5;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    pixels.set([...color, 255], (y * width + x) * 4);
  };
  for (let position = 1; position <= 3; position += 1) {
    setPixel(position, 1, [180, 130, 145]);
    setPixel(position, 3, [180, 130, 145]);
    setPixel(1, position, [180, 130, 145]);
    setPixel(3, position, [180, 130, 145]);
  }
  setPixel(2, 2, [248, 246, 247]);

  const result = removeBackgroundPixels(pixels, width, height, 72);

  assert.equal(result[3], 0);
  assert.equal(result[(2 * width + 2) * 4 + 3], 255);
});

test("automatic cutout removes a white poster background inside a beige screenshot", () => {
  const width = 7;
  const height = 7;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    pixels.set([...color, 255], (y * width + x) * 4);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, [246, 239, 226]);
    }
  }

  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 5; x += 1) {
      setPixel(x, y, [255, 255, 255]);
    }
  }
  setPixel(3, 3, [120, 30, 50]);

  const result = removeBackgroundPixels(pixels, width, height, 72);

  assert.equal(result[(0 * width + 0) * 4 + 3], 0);
  assert.equal(result[(1 * width + 1) * 4 + 3], 0);
  assert.equal(result[(3 * width + 3) * 4 + 3], 255);
});

test("automatic cutout keeps the central subject and removes off-center decorations", () => {
  const width = 9;
  const height = 5;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    pixels.set([...color, 255], (y * width + x) * 4);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(x, y, [40, 110, 170]);
    }
  }

  setPixel(1, 2, [20, 220, 120]);
  setPixel(4, 1, [160, 30, 50]);
  setPixel(4, 2, [160, 30, 50]);
  setPixel(4, 3, [160, 30, 50]);

  const result = removeBackgroundPixels(pixels, width, height, 72);

  assert.equal(result[(2 * width + 1) * 4 + 3], 0);
  assert.equal(result[(2 * width + 4) * 4 + 3], 255);
});

test("automatic cutout removes enclosed white background pixels", () => {
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255,
  ]);

  const result = removeBackgroundPixels(pixels, 3, 3, 72);

  assert.equal(result[(1 * 3 + 1) * 4 + 3], 0);
});

test("automatic cutout removes off-white fringe connected to enclosed white background", () => {
  const width = 7;
  const height = 7;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    pixels.set([...color, 255], (y * width + x) * 4);
  };
  for (let position = 1; position <= 5; position += 1) {
    setPixel(position, 1, [170, 110, 135]);
    setPixel(position, 5, [170, 110, 135]);
    setPixel(1, position, [170, 110, 135]);
    setPixel(5, position, [170, 110, 135]);
  }
  setPixel(3, 3, [255, 255, 255]);
  setPixel(3, 2, [246, 246, 246]);

  const result = removeBackgroundPixels(pixels, width, height, 72);

  assert.equal(result[(3 * width + 3) * 4 + 3], 0);
  assert.equal(result[(2 * width + 3) * 4 + 3], 0);
  assert.equal(result[(1 * width + 3) * 4 + 3], 255);
});

test("automatic cutout retains the original source for manual restoration", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-auto-source",
    label: "Bottle",
    src: "uploads/bottle-original.png",
    playheadFrame: 0,
  });
  const erased = appendCutoutMaskStroke([cutout], cutout.id, {
    mode: "erase",
    size: 12,
    points: [{ x: 50, y: 50 }],
  })[0];

  const processed = applyAutomaticCutoutById(
    [erased],
    cutout.id,
    "uploads/bottle-cutout.png",
  );
  const repeated = applyAutomaticCutoutById(
    processed,
    cutout.id,
    "uploads/bottle-cutout-2.png",
  );

  assert.equal(repeated[0]?.src, "uploads/bottle-cutout-2.png");
  assert.equal(repeated[0]?.cutout?.originalSrc, "uploads/bottle-original.png");
  assert.deepEqual(repeated[0]?.cutout?.maskStrokes, []);
});

test("restore mask reveals only areas painted with the restore brush", () => {
  const cutout = createCutoutImageClip({
    id: "cutout-restore-mask",
    label: "Bottle",
    src: "uploads/bottle.png",
    playheadFrame: 0,
  });
  const restored = appendCutoutMaskStroke([cutout], cutout.id, {
    mode: "restore",
    size: 10,
    points: [{ x: 50, y: 50 }],
  });

  const decoded = decodeURIComponent(
    createCutoutRestoreMaskDataUrl(restored[0]?.cutout).split(",", 2)[1] ?? "",
  );
  assert.match(decoded, /<rect width="100" height="100" fill="black"\/>/);
  assert.match(decoded, /fill="white"/);
});

test("updates selected text styling without moving the text clip", () => {
  const textClip = createTextClip({
    id: "text-1",
    content: "Title",
    playheadFrame: 75,
  });
  const result = setTextStyleById([textClip], "text-1", {
    fontSize: 64,
    color: "#ff00aa",
    fontFamily: "Georgia",
    fontWeight: "700",
    fontStyle: "italic",
    effect: "glow",
  });

  assert.deepEqual(result[0], {
    ...textClip,
    text: {
      ...textClip.text,
      fontSize: 64,
      color: "#ff00aa",
      fontFamily: "Georgia",
      fontWeight: "700",
      fontStyle: "italic",
      effect: "glow",
    },
  });
});

test("updates animation on only the selected text clip", () => {
  const first = createTextClip({
    id: "text-1",
    content: "First",
    playheadFrame: 30,
  });
  const second = createTextClip({
    id: "text-2",
    content: "Second",
    playheadFrame: 60,
  });

  const updated = setTextStyleById([first, second], "text-1", {
    animation: "pop",
  });

  assert.equal(updated[0].text?.animation, "pop");
  assert.strictEqual(updated[1], second);
});

test("returns deterministic one-time text entrance presentations", () => {
  const base = createTextClip({
    id: "text-1",
    content: "Title",
    playheadFrame: 30,
  });
  const withAnimation = (
    animation:
      | "pop"
      | "jump"
      | "fade"
      | "star-jump"
      | "bounce"
      | "typewriter"
      | "wave"
      | "flicker"
      | "spin-in",
  ) => ({
    ...base,
    text: { ...base.text!, animation },
  });

  assert.deepEqual(getTextAnimationPresentation(base, 30), {
    opacity: 1,
    scale: 1,
    translateY: 0,
    rotation: 0,
  });
  assert.deepEqual(getTextAnimationPresentation(withAnimation("fade"), 30), {
    opacity: 0,
    scale: 1,
    translateY: 0,
    rotation: 0,
  });
  assert.ok(getTextAnimationPresentation(withAnimation("pop"), 42).scale > 1);
  assert.ok(
    getTextAnimationPresentation(withAnimation("jump"), 30).translateY > 0,
  );
  assert.deepEqual(getTextAnimationPresentation(withAnimation("jump"), 45), {
    opacity: 1,
    scale: 1,
    translateY: 0,
    rotation: 0,
  });
});

test("creative text animations are deterministic and settle correctly", () => {
  const base = createTextClip({
    id: "text-creative",
    content: "Title",
    playheadFrame: 30,
  });
  const withAnimation = (
    animation:
      | "pop"
      | "jump"
      | "fade"
      | "star-jump"
      | "bounce"
      | "typewriter"
      | "wave"
      | "flicker"
      | "spin-in",
  ) => ({
    ...base,
    text: { ...base.text!, animation },
  });
  const starClip = withAnimation("star-jump");
  assert.deepEqual(
    getTextAnimationStars(starClip, 42, 1, 3),
    getTextAnimationStars(starClip, 42, 1, 3),
  );
  assert.ok(getTextAnimationStars(starClip, 42, 1, 3).length > 0);
  assert.deepEqual(getTextAnimationStars(starClip, 42, 0, 3), []);

  const bounce = getTextAnimationWordPresentation(
    withAnimation("bounce"),
    36,
    0,
    3,
  );
  assert.notEqual(bounce.translateY, 0);

  const wave = getTextAnimationWordPresentation(
    withAnimation("wave"),
    48,
    1,
    3,
  );
  assert.notEqual(wave.translateY, 0);

  const typewriter = withAnimation("typewriter");
  assert.equal(getTextAnimationVisibleCharacterCount(typewriter, 30), 0);
  assert.ok(getTextAnimationVisibleCharacterCount(typewriter, 45) > 0);
  assert.equal(
    getTextAnimationVisibleCharacterCount(typewriter, 120),
    typewriter.text?.content.length,
  );

  assert.ok(
    getTextAnimationPresentation(withAnimation("flicker"), 34).opacity < 1,
  );
  assert.notEqual(
    getTextAnimationPresentation(withAnimation("spin-in"), 34).rotation,
    0,
  );
  assert.deepEqual(getTextAnimationPresentation(withAnimation("spin-in"), 60), {
    opacity: 1,
    scale: 1,
    translateY: 0,
    rotation: 0,
  });
});

test("updates styling and animation on only the selected caption", () => {
  const first = createManualCaptionClip({
    id: "caption-first",
    content: "First caption",
    playheadFrame: 0,
    timelineDuration: 180,
    style: defaultCaptionStyle,
  })!;
  const second = createManualCaptionClip({
    id: "caption-second",
    content: "Second caption",
    playheadFrame: 90,
    timelineDuration: 180,
    style: defaultCaptionStyle,
  })!;

  const updated = setCaptionStyleById([first, second], first.id, {
    fontFamily: "Georgia",
    fontSize: 52,
    textColor: "#22d3ee",
    backgroundEnabled: false,
    backgroundColor: "#000000cc",
    fontWeight: "900",
    effect: "outline",
    animation: "pop",
    animationSpeed: 1.5,
  });

  assert.equal(updated[0]?.caption?.fontFamily, "Georgia");
  assert.equal(updated[0]?.caption?.animation, "pop");
  assert.equal(updated[0]?.caption?.animationSpeed, 1.5);
  assert.strictEqual(updated[1], second);
});

test("resizes selected text from preview drag distance", () => {
  const textClip = createTextClip({
    id: "text-1",
    content: "Title",
    playheadFrame: 75,
  });
  const largerFontSize = getResizedTextFontSize({
    startFontSize: 42,
    startX: 100,
    startY: 100,
    pointerX: 160,
    pointerY: 180,
  });
  const result = resizeTextOverlayById([textClip], "text-1", largerFontSize);

  assert.equal(result[0].text?.fontSize, 92);
  assert.equal(
    getResizedTextFontSize({
      startFontSize: 42,
      startX: 100,
      startY: 100,
      pointerX: -300,
      pointerY: -300,
    }),
    12,
  );
});

test("resizes a text box from every edge while keeping the opposite edge anchored", () => {
  const textClip = createTextClip({
    id: "text-box",
    content: "Animated title",
    playheadFrame: 0,
  });

  const fromRight = resizeTextOverlayBoxById([textClip], textClip.id, {
    handle: "right",
    startX: 50,
    startY: 50,
    startWidth: 40,
    startHeight: 20,
    deltaX: 10,
    deltaY: 0,
  })[0].text!;
  assert.equal(fromRight.boxWidth, 50);
  assert.equal(fromRight.x, 55);
  assert.equal(fromRight.boxHeight, 20);

  const fromTopLeft = resizeTextOverlayBoxById([textClip], textClip.id, {
    handle: "top-left",
    startX: 50,
    startY: 50,
    startWidth: 40,
    startHeight: 20,
    deltaX: -10,
    deltaY: -6,
  })[0].text!;
  assert.equal(fromTopLeft.boxWidth, 50);
  assert.equal(fromTopLeft.boxHeight, 26);
  assert.equal(fromTopLeft.x, 45);
  assert.equal(fromTopLeft.y, 47);
});

test("clamps resized text boxes inside the preview and preserves unrelated clips", () => {
  const textClip = createTextClip({
    id: "text-box",
    content: "Keep me visible",
    playheadFrame: 0,
  });
  const other = createTextClip({
    id: "other-text",
    content: "Other",
    playheadFrame: 0,
  });

  const result = resizeTextOverlayBoxById([textClip, other], textClip.id, {
    handle: "bottom-right",
    startX: 80,
    startY: 80,
    startWidth: 20,
    startHeight: 20,
    deltaX: 50,
    deltaY: 50,
  });

  assert.equal(result[0].text?.x, 85);
  assert.equal(result[0].text?.y, 85);
  assert.equal(result[0].text?.boxWidth, 30);
  assert.equal(result[0].text?.boxHeight, 30);
  assert.strictEqual(result[1], other);
});

test("projects screen pointer movement onto a rotated text box", () => {
  assert.deepEqual(
    getRotatedTextResizeDelta({
      deltaX: 20,
      deltaY: 0,
      rotation: 90,
      scale: 2,
      previewWidth: 200,
      previewHeight: 100,
    }),
    { deltaX: 0, deltaY: -10 },
  );
});

test("rotates selected text while preserving its style and timing", () => {
  const textClip = createTextClip({
    id: "text-1",
    content: "Title",
    playheadFrame: 75,
  });

  const result = setTextRotationById([textClip], "text-1", 47);

  assert.deepEqual(result[0], {
    ...textClip,
    text: {
      ...textClip.text,
      rotation: 47,
    },
  });
  assert.equal(
    setTextRotationById([textClip], "text-1", 250)[0].text?.rotation,
    180,
  );
  assert.equal(
    setTextRotationById([textClip], "text-1", -250)[0].text?.rotation,
    -180,
  );
});

test("serializes and parses a saved editor project", () => {
  const clip = createTextClip({
    id: "text-1",
    content: "Saved",
    playheadFrame: 30,
  });
  const mediaItem = {
    id: "media-1",
    label: "saved.mp4",
    src: "saved.mp4",
    duration: "00:05",
    durationInFrames: 150,
    kind: "public" as const,
  };
  const project = createSavedEditorProject({
    clips: [clip],
    mediaItems: [mediaItem],
    selectedMediaId: "media-1",
    nextSourceGroupIndex: 3,
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.deepEqual(project, {
    version: 1,
    savedAt: "2026-07-15T00:00:00.000Z",
    clips: [clip],
    mediaItems: [mediaItem],
    selectedMediaId: "media-1",
    nextSourceGroupIndex: 3,
  });
  assert.deepEqual(parseSavedEditorProject(JSON.stringify(project)), project);
  assert.equal(parseSavedEditorProject("{bad json"), null);
});

test("removes temporary browser media from saved projects", () => {
  const project = createSavedEditorProject({
    clips: [
      {
        id: "main-temp",
        label: "temporary",
        track: "main",
        start: 0,
        duration: 60,
        color: "#0891b2",
        src: "blob:http://localhost:5173/temporary-video",
      },
      {
        id: "main-saved",
        label: "saved",
        track: "main",
        start: 0,
        duration: 60,
        color: "#0891b2",
        src: "uploads/saved.mp4",
      },
    ],
    mediaItems: [
      {
        id: "media-temp",
        label: "temporary.mp4",
        src: "blob:http://localhost:5173/temporary-video",
        duration: "00:02",
        durationInFrames: 60,
        kind: "local",
      },
      {
        id: "media-saved",
        label: "saved.mp4",
        src: "uploads/saved.mp4",
        duration: "00:02",
        durationInFrames: 60,
        kind: "local",
      },
    ],
    selectedMediaId: "media-temp",
    nextSourceGroupIndex: 2,
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.deepEqual(removeBrowserOnlySavedMedia(project), {
    ...project,
    clips: [project.clips[1]],
    mediaItems: [project.mediaItems[1]],
    selectedMediaId: "media-saved",
  });
});

test("creates deterministic waveform bars for audio clips", () => {
  const first = createWaveformBars("audio-1", 8);
  const second = createWaveformBars("audio-1", 8);

  assert.equal(first.length, 8);
  assert.deepEqual(first, second);
  assert.ok(first.every((bar) => bar >= 0.18 && bar <= 1));
});

test("keeps ordinary text separate from captions", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Title",
    playheadFrame: 12,
  });
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Hello",
    playheadFrame: 120,
    timelineDuration: 480,
    style: defaultCaptionStyle,
  });

  assert.equal(text.track, "text");
  assert.equal(caption?.track, "caption");
  assert.equal(caption?.start, 120);
  assert.equal(caption?.duration, 90);
});

test("clamps a manual caption to the timeline end", () => {
  const caption = createManualCaptionClip({
    id: "caption-end",
    content: "End",
    playheadFrame: 470,
    timelineDuration: 480,
    style: defaultCaptionStyle,
  });

  assert.equal(caption?.duration, 10);
});

test("creates generated captions from transcript segments on the selected source clip", () => {
  const sourceClip: TimelineClip = {
    id: "main-1",
    label: "Video",
    track: "main",
    start: 90,
    duration: 180,
    sourceStart: 30,
    color: "#0891b2",
    speed: 1,
  };
  const result = createGeneratedCaptionClips({
    sourceClip,
    segments: [
      { startSeconds: 0.2, endSeconds: 1, text: "Trim boundary" },
      { startSeconds: 1.5, endSeconds: 3, text: "Second segment" },
      { startSeconds: 10, endSeconds: 11, text: "Out of range" },
    ],
    fps: 30,
    timelineDuration: 480,
    generationId: "gen-1",
    style: defaultCaptionStyle,
  });

  assert.deepEqual(result, [
    {
      id: "gen-1-1",
      label: "Second segment",
      track: "caption",
      start: 105,
      duration: 45,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "Second segment",
        sourceClipId: "main-1",
        generationId: "gen-1",
      },
    },
  ]);
});

test("drops malformed transcript segments before generating captions", () => {
  const sourceClip: TimelineClip = {
    id: "main-1",
    label: "Video",
    track: "main",
    start: 90,
    duration: 180,
    sourceStart: 30,
    color: "#0891b2",
    speed: 1,
  };

  const result = createGeneratedCaptionClips({
    sourceClip,
    segments: [
      { startSeconds: -1, endSeconds: 1, text: "Negative start" },
      { startSeconds: 2, endSeconds: 2, text: "Zero length" },
      { startSeconds: Number.NaN, endSeconds: 3, text: "Not finite" },
    ],
    fps: 30,
    timelineDuration: 480,
    generationId: "gen-2",
    style: defaultCaptionStyle,
  });

  assert.deepEqual(result, []);
});

test("replaces only generated captions for the selected source clip", () => {
  const manualCaption = {
    id: "manual-1",
    label: "Manual",
    track: "caption" as const,
    start: 10,
    duration: 30,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Manual",
    },
  };
  const oldGeneratedForMain = {
    id: "generated-main-old",
    label: "Old generated",
    track: "caption" as const,
    start: 20,
    duration: 20,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Old generated",
      sourceClipId: "main-1",
      generationId: "batch-old",
    },
  };
  const generatedForOverlay = {
    id: "generated-overlay",
    label: "Overlay generated",
    track: "caption" as const,
    start: 30,
    duration: 20,
    color: "#ef4444",
    caption: {
      ...defaultCaptionStyle,
      content: "Overlay generated",
      sourceClipId: "overlay-1",
      generationId: "batch-overlay",
    },
  };
  const replacement = [
    {
      id: "generated-main-new",
      label: "New generated",
      track: "caption" as const,
      start: 25,
      duration: 20,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "New generated",
        sourceClipId: "main-1",
        generationId: "batch-new",
      },
    },
  ];

  const result = replaceGeneratedCaptionBatch(
    [manualCaption, oldGeneratedForMain, generatedForOverlay],
    "main-1",
    replacement,
  );

  assert.ok(result.includes(manualCaption));
  assert.ok(result.includes(generatedForOverlay));
  assert.equal(
    result.some((clip) => clip.id === oldGeneratedForMain.id),
    false,
  );
  assert.ok(result.includes(replacement[0]));
});

test("moves only the selected text clip to the requested frame", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 20,
  });
  const other = createTextClip({
    id: "text-2",
    content: "Other",
    playheadFrame: 200,
  });

  const result = moveTextClip([text, other], "text-1", 120, 480);

  assert.equal(result[0].start, 120);
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].text, text.text);
  assert.strictEqual(result[1], other);
});

test("clamps text at zero and allows an expanded project boundary", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 20,
  });

  assert.equal(moveTextClip([text], "text-1", -30, 480)[0].start, 0);
  assert.equal(moveTextClip([text], "text-1", 460, 550)[0].start, 460);
  assert.equal(moveTextClip([text], "text-1", Number.NaN, 550)[0].start, 0);
});

test("keeps text clip arrays unchanged for invalid and no-op moves", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 20,
  });
  const clips = [text];

  assert.strictEqual(moveTextClip(clips, "missing", 100, 480), clips);
  assert.strictEqual(moveTextClip(clips, "text-1", 20, 480), clips);
});

test("does not move a transcript caption without text overlay metadata", () => {
  const transcriptCaption: TimelineClip = {
    id: "caption-1",
    label: "Transcript caption",
    track: "caption",
    start: 30,
    duration: 60,
    color: "#ef4444",
  };
  const clips = [transcriptCaption];

  assert.strictEqual(moveTextClip(clips, "caption-1", 120, 480), clips);
});

test("moves captions stickers and independent audio to a requested frame", () => {
  const clips: TimelineClip[] = [
    {
      id: "caption-1",
      label: "Caption",
      track: "caption",
      start: 20,
      duration: 60,
      color: "#ef4444",
      caption: { ...defaultCaptionStyle, content: "Caption" },
    },
    createStickerClip({
      id: "sticker-1",
      label: "Sticker",
      src: "sticker.png",
      playheadFrame: 40,
    }),
    createBackgroundMusicClip({
      id: "music-1",
      label: "Music",
      src: "music.mp3",
      playheadFrame: 60,
      durationInFrames: 120,
    }),
  ];

  const captionMoved = moveIndependentTimelineClip(
    clips,
    "caption-1",
    120,
    600,
  );
  const stickerMoved = moveIndependentTimelineClip(
    captionMoved,
    "sticker-1",
    180,
    600,
  );
  const musicMoved = moveIndependentTimelineClip(
    stickerMoved,
    "music-1",
    240,
    600,
  );

  assert.equal(musicMoved.find((clip) => clip.id === "caption-1")?.start, 120);
  assert.equal(musicMoved.find((clip) => clip.id === "sticker-1")?.start, 180);
  assert.equal(musicMoved.find((clip) => clip.id === "music-1")?.start, 240);
});

test("keeps linked audio locked to its video during independent moves", () => {
  const [, linkedAudio] = createVideoMediaPair({
    videoId: "video-1",
    audioId: "audio-1",
    track: "main",
    label: "Video",
    src: "video.mp4",
    start: 30,
    duration: 180,
  });
  const clips = [linkedAudio];

  assert.strictEqual(
    moveIndependentTimelineClip(clips, linkedAudio.id, 200, 600),
    clips,
  );
});

test("moves text in the preview while preserving timing and appearance", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 45,
  });

  const result = moveTextOverlay(
    [text],
    "text-1",
    { x: 30, y: 40 },
    { halfWidthPercent: 10, halfHeightPercent: 5 },
  );

  assert.equal(result[0].start, 45);
  assert.equal(result[0].duration, 90);
  assert.deepEqual(result[0].text, {
    ...text.text,
    x: 30,
    y: 40,
  });
});

test("moves only the selected caption and clamps it inside the preview", () => {
  const first = createManualCaptionClip({
    id: "caption-1",
    content: "First caption",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const second = createManualCaptionClip({
    id: "caption-2",
    content: "Second caption",
    playheadFrame: 90,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;

  assert.deepEqual(getCaptionPosition(first.caption!), { x: 50, y: 82 });
  const moved = moveCaptionOverlay(
    [first, second],
    first.id,
    { x: 98, y: 2 },
    { halfWidthPercent: 14, halfHeightPercent: 6 },
  );

  assert.deepEqual(getCaptionPosition(moved[0].caption!), { x: 86, y: 6 });
  assert.deepEqual(moved[1], second);
  assert.equal(moved[0].start, first.start);
  assert.equal(moved[0].duration, first.duration);
});

test("keeps caption clip arrays unchanged for invalid and no-op moves", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "First caption",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const positionedCaption = {
    ...caption,
    caption: {
      ...caption.caption!,
      x: 86,
      y: 82,
    },
  };
  const clips = [caption];
  const positionedClips = [positionedCaption];
  const bounds = { halfWidthPercent: 14, halfHeightPercent: 6 };

  assert.strictEqual(
    moveCaptionOverlay(clips, "missing", { x: 50, y: 82 }, bounds),
    clips,
  );
  assert.strictEqual(
    moveCaptionOverlay(positionedClips, caption.id, { x: 98, y: 82 }, bounds),
    positionedClips,
  );
});

test("resizes only the selected caption within readable limits", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Resize me",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const larger = getResizedCaptionFontSize({
    startFontSize: 36,
    startX: 100,
    startY: 100,
    pointerX: 160,
    pointerY: 180,
  });

  assert.equal(
    resizeCaptionOverlayById([caption], caption.id, larger)[0].caption
      ?.fontSize,
    86,
  );
  assert.equal(
    resizeCaptionOverlayById([caption], caption.id, 500)[0].caption?.fontSize,
    160,
  );
  assert.equal(
    resizeCaptionOverlayById([caption], caption.id, -20)[0].caption?.fontSize,
    1,
  );
});

test("projects caption resizing along cardinal and diagonal handle directions", () => {
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 40,
      startX: 100,
      startY: 100,
      pointerX: 140,
      pointerY: 100,
      handle: "right",
    }),
    60,
  );
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 40,
      startX: 100,
      startY: 100,
      pointerX: 140,
      pointerY: 100,
      handle: "left",
    }),
    20,
  );
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 40,
      startX: 100,
      startY: 100,
      pointerX: 100,
      pointerY: 60,
      handle: "top",
    }),
    60,
  );
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 40,
      startX: 100,
      startY: 100,
      pointerX: 100,
      pointerY: 60,
      handle: "bottom",
    }),
    20,
  );
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 40,
      startX: 100,
      startY: 100,
      pointerX: 120,
      pointerY: 120,
      handle: "bottom-right",
    }),
    54,
  );
});

test("clamps directional caption resizing to editable limits", () => {
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 150,
      startX: 100,
      startY: 100,
      pointerX: 200,
      pointerY: 100,
      handle: "right",
    }),
    160,
  );
  assert.equal(
    getResizedCaptionFontSizeFromHandle({
      startFontSize: 20,
      startX: 100,
      startY: 100,
      pointerX: 200,
      pointerY: 100,
      handle: "left",
    }),
    1,
  );
});

test("preserves caption resize references when the clamped size is unchanged", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "No resize",
    playheadFrame: 0,
    timelineDuration: 300,
    style: { ...defaultCaptionStyle, fontSize: 160 },
  })!;
  const clips = [caption];

  const unchanged = resizeCaptionOverlayById(clips, caption.id, 500);

  assert.strictEqual(unchanged, clips);
  assert.strictEqual(unchanged[0], caption);
  assert.strictEqual(unchanged[0].caption, caption.caption);
});

test("preserves references after a caption reaches its measured fit limit", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Already fitted",
    playheadFrame: 0,
    timelineDuration: 300,
    style: { ...defaultCaptionStyle, fontSize: 72 },
  })!;
  const clips = [caption];

  const unchanged = resizeCaptionOverlayById(clips, caption.id, 160, {
    halfWidthPercent: 40,
    halfHeightPercent: 20,
    maximumFontSize: 72,
  });

  assert.strictEqual(unchanged, clips);
  assert.strictEqual(unchanged[0], caption);
  assert.strictEqual(unchanged[0].caption, caption.caption);
});

test("keeps a resized caption box inside the preview frame", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "Near the edge",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const positionedCaption = {
    ...caption,
    caption: {
      ...caption.caption!,
      x: 90,
      y: 92,
      fontSize: 40,
    },
  };

  const resized = resizeCaptionOverlayById(
    [positionedCaption],
    positionedCaption.id,
    80,
    {
      halfWidthPercent: 8,
      halfHeightPercent: 5,
      referenceFontSize: 40,
    },
  );

  assert.equal(resized[0].caption?.fontSize, 80);
  assert.deepEqual(getCaptionPosition(resized[0].caption!), { x: 84, y: 90 });
});

test("caps caption font size at the largest measured size that fits the preview", () => {
  const caption = createManualCaptionClip({
    id: "caption-1",
    content: "A caption that wraps as it grows",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const previewWidth = 1000;
  const previewHeight = 500;
  const measure = (fontSize: number) => ({
    width: Math.min(880, fontSize * 12),
    height: fontSize <= 72 ? fontSize * 4 : fontSize * 7,
  });
  const maximumFontSize = getMaximumFittingCaptionFontSize({
    requestedFontSize: 160,
    previewWidth,
    previewHeight,
    measure,
  });
  const fittedBox = measure(maximumFontSize);

  const resized = resizeCaptionOverlayById([caption], caption.id, 160, {
    halfWidthPercent: (fittedBox.width / previewWidth) * 50,
    halfHeightPercent: (fittedBox.height / previewHeight) * 50,
    maximumFontSize,
  });

  assert.equal(maximumFontSize, 72);
  assert.equal(resized[0].caption?.fontSize, 72);
  assert.ok(fittedBox.width <= previewWidth);
  assert.ok(fittedBox.height <= previewHeight);
});

test("fits and clamps a resized near-edge caption without changing other clips", () => {
  const selected = createManualCaptionClip({
    id: "caption-1",
    content: "Near edge",
    playheadFrame: 0,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const other = createManualCaptionClip({
    id: "caption-2",
    content: "Leave me alone",
    playheadFrame: 90,
    timelineDuration: 300,
    style: defaultCaptionStyle,
  })!;
  const positioned = {
    ...selected,
    caption: { ...selected.caption!, x: 94, y: 8 },
  };
  const previewWidth = 800;
  const previewHeight = 450;
  const maximumFontSize = getMaximumFittingCaptionFontSize({
    requestedFontSize: 140,
    previewWidth,
    previewHeight,
    measure: (fontSize) => ({ width: fontSize * 9, height: fontSize * 4 }),
  });
  const fittedBox = {
    width: maximumFontSize * 9,
    height: maximumFontSize * 4,
  };

  const resized = resizeCaptionOverlayById(
    [positioned, other],
    positioned.id,
    140,
    {
      halfWidthPercent: (fittedBox.width / previewWidth) * 50,
      halfHeightPercent: (fittedBox.height / previewHeight) * 50,
      maximumFontSize,
    },
  );

  assert.equal(maximumFontSize, 88);
  assert.equal(resized[0].caption?.fontSize, 88);
  assert.deepEqual(getCaptionPosition(resized[0].caption!), {
    x: 50.5,
    y: 39.111111111111114,
  });
  assert.ok(fittedBox.width <= previewWidth);
  assert.ok(fittedBox.height <= previewHeight);
  assert.strictEqual(resized[1], other);
});

test("keeps the full text inside every preview edge", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 0,
  });
  const bounds = { halfWidthPercent: 12, halfHeightPercent: 8 };

  const topLeft = moveTextOverlay(
    [text],
    "text-1",
    { x: -20, y: -20 },
    bounds,
  )[0];
  const bottomRight = moveTextOverlay(
    [text],
    "text-1",
    { x: 120, y: 120 },
    bounds,
  )[0];

  assert.deepEqual({ x: topLeft.text?.x, y: topLeft.text?.y }, { x: 12, y: 8 });
  assert.deepEqual(
    { x: bottomRight.text?.x, y: bottomRight.text?.y },
    { x: 88, y: 92 },
  );
});

test("keeps arrays unchanged when preview text cannot move", () => {
  const text = createTextClip({
    id: "text-1",
    content: "Hello",
    playheadFrame: 0,
  });
  const clips = [text];
  const bounds = { halfWidthPercent: 10, halfHeightPercent: 5 };

  assert.strictEqual(
    moveTextOverlay(clips, "missing", { x: 30, y: 40 }, bounds),
    clips,
  );
  assert.strictEqual(
    moveTextOverlay(clips, "text-1", { x: 50, y: 78 }, bounds),
    clips,
  );
});

test("removes unused imported media and selects the first remaining item", () => {
  const firstItem = {
    id: "first",
    label: "First.mp4",
    src: "/media/first.mp4",
    duration: "00:10",
    durationInFrames: 300,
    kind: "public" as const,
  };
  const removedItem = {
    id: "unused",
    label: "Unused.mp4",
    src: "/media/unused.mp4",
    duration: "00:10",
    durationInFrames: 300,
    kind: "public" as const,
  };

  const result = removeUnusedMediaItem({
    mediaItems: [firstItem, removedItem],
    selectedMediaId: removedItem.id,
    mediaId: removedItem.id,
  });

  assert.equal(result.outcome, "removed");
  assert.deepEqual(result.mediaItems, [firstItem]);
  assert.equal(result.selectedMediaId, firstItem.id);
  assert.match(result.message, /removed/i);
});

test("removes media from the library without deleting timeline clips that use it", () => {
  const mediaItem = {
    id: "used",
    label: "Used.mp4",
    src: "/media/used.mp4",
    duration: "00:10",
    durationInFrames: 300,
    kind: "public" as const,
  };
  const clip: TimelineClip = {
    id: "clip-1",
    label: "Used clip",
    track: "main",
    start: 0,
    duration: 300,
    color: "#0891b2",
    src: mediaItem.src,
  };
  const mediaItems = [mediaItem];

  const result = removeUnusedMediaItem({
    mediaItems,
    selectedMediaId: mediaItem.id,
    mediaId: mediaItem.id,
  });

  assert.equal(result.outcome, "removed");
  assert.deepEqual(result.mediaItems, []);
  assert.equal(result.selectedMediaId, null);
  assert.equal(clip.src, mediaItem.src);
  assert.match(result.message, /removed/i);
});

test("updates only the selected text clip wording", () => {
  const selected = createTextClip({
    id: "text-selected",
    content: "hi",
    playheadFrame: 120,
  });
  const other = createTextClip({
    id: "text-other",
    content: "keep me",
    playheadFrame: 240,
  });
  const styled = setTextStyleById([selected, other], selected.id, {
    animation: "star-jump",
    color: "#22d3ee",
  });

  const result = setTextContentById(styled, selected.id, "New title");
  const updated = result.find((clip) => clip.id === selected.id);

  assert.equal(updated?.label, "New title");
  assert.equal(updated?.text?.content, "New title");
  assert.equal(updated?.start, selected.start);
  assert.equal(updated?.duration, selected.duration);
  assert.equal(updated?.text?.animation, "star-jump");
  assert.equal(updated?.text?.color, "#22d3ee");
  assert.equal(
    result.find((clip) => clip.id === other.id),
    other,
  );
});

test("does not replace text with empty wording", () => {
  const clip = createTextClip({
    id: "text-selected",
    content: "hi",
    playheadFrame: 0,
  });

  assert.equal(setTextContentById([clip], clip.id, "   ")[0], clip);
});

test("inserts media at the marker and ripples later main clips", () => {
  const existing: TimelineClip[] = [
    {
      id: "main-1",
      label: "First",
      track: "main",
      start: 0,
      duration: 300,
      color: "#0891b2",
      src: "/media/first.mp4",
      linkedClipId: "audio-1",
    },
    {
      id: "audio-1",
      label: "First audio",
      track: "audio",
      start: 0,
      duration: 300,
      color: "#2563eb",
      src: "/media/first.mp4",
      linkedClipId: "main-1",
    },
    {
      id: "main-2",
      label: "Second",
      track: "main",
      start: 300,
      duration: 120,
      color: "#0891b2",
      src: "/media/second.mp4",
    },
  ];
  const inserted: TimelineClip[] = [
    {
      id: "new-video",
      label: "New",
      track: "main",
      start: 0,
      duration: 90,
      color: "#0891b2",
      src: "/media/new.mp4",
      linkedClipId: "new-audio",
    },
    {
      id: "new-audio",
      label: "New audio",
      track: "audio",
      start: 0,
      duration: 90,
      color: "#2563eb",
      src: "/media/new.mp4",
      linkedClipId: "new-video",
    },
  ];

  const result = insertVideoPairOnLayerAtFrame(existing, inserted, 0, 150);
  const mainClips = result
    .filter((clip) => clip.track === "main")
    .sort((left, right) => left.start - right.start);

  assert.deepEqual(
    mainClips.map(({ id, start, duration }) => ({ id, start, duration })),
    [
      { id: "main-1-a", start: 0, duration: 150 },
      { id: "new-video", start: 150, duration: 90 },
      { id: "main-1-b", start: 240, duration: 150 },
      { id: "main-2", start: 390, duration: 120 },
    ],
  );
  assert.equal(result.find((clip) => clip.id === "new-audio")?.start, 150);
  assert.equal(result.find((clip) => clip.id === "audio-1-b")?.start, 240);
});
