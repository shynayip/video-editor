import {
  CalculateMetadataFunction,
  Composition,
  Img,
  staticFile,
} from "remotion";
import {
  ChangeEvent,
  CSSProperties,
  Fragment,
  PointerEvent,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  appendCutoutMaskStroke,
  applyAutomaticCutoutById,
  appendStickerClip,
  applyTimelineHistoryEdit,
  stepTimelinePlayback,
  clampPlayheadFrame,
  createImageMediaClip,
  createVideoMediaPair,
  createBackgroundMusicClip,
  createCutoutImageClip,
  createCutoutMaskDataUrl,
  createCutoutRestoreMaskDataUrl,
  createCutoutVideoPair,
  createSavedEditorProject,
  createSceneMediaItems as buildSceneMediaItems,
  createTrailingAutosaveScheduler,
  createTimelineHistory,
  createTimelineTicks,
  createWaveformBars,
  createRecordedAudioClip,
  createMainMediaPair,
  createStickerClip,
  createManualCaptionClip,
  createGeneratedCaptionClips,
  createTextClip,
  defaultCaptionStyle,
  defaultClipAdjustment,
  deleteClipById,
  duplicateClipById,
  ensureLinkedAudioForVideo,
  keepDominantVoiceInLinkedVideo,
  getActiveClipsAtFrame,
  getActiveVideoLayersAtFrame,
  getClipSourceTime,
  getClipTransitionPresentation,
  getPublicMediaFallbackSource,
  isPlayableMediaResponse,
  isStoredUploadSource,
  getDraggedClipStart,
  getDragEdgeAutoScrollDelta,
  getPlaybackFollowScrollLeft,
  getMediaTrimFrameFromPointer,
  getVideoClipDragPreviewStart,
  getContextualAudioClips,
  getCaptionPosition,
  getResizedCaptionFontSizeFromHandle,
  getMaximumFittingCaptionFontSize,
  getExpandedTimelineBoundary,
  getIndependentPlaybackAudioClips,
  getInitialNextSourceGroupIndex,
  getPlaybackAudioClips,
  getVisualToolTargetClipId,
  getManualRotationAngle,
  getVisibleRotateHandleTop,
  getStableTimelineFrameDelta,
  getTimelineFrameFromPointer,
  getTimelineTransitionBoundaries,
  getTimelineDuration,
  getVideoPlaybackDuration,
  formatTimelineClock,
  formatTimelineTimecode,
  hasClipsOnTrack,
  getTextAnimationStars,
  getTextAnimationPresentation,
  getTextAnimationVisibleCharacterCount,
  getTextAnimationWordPresentation,
  getTextualClipDisplayColors,
  getRotatedTextResizeDelta,
  moveTextClip,
  moveIndependentTimelineClip,
  moveCaptionOverlay,
  moveTextOverlay,
  moveCutoutClip,
  normalizeMediaSceneLabels,
  getNextVideoLayer,
  getClipAnimationPreviewFrame,
  getVideoLayer,
  getVideoLayerControlState,
  getVideoLayerEnd,
  moveVideoClipToLayer,
  placeVideoPairOnLayer,
  insertVideoPairOnLayerAtFrame,
  parseSavedEditorProject,
  removeUnusedMediaItem,
  replaceGeneratedCaptionBatch,
  removeBrowserOnlySavedMedia,
  removeSilenceFromLinkedVideo,
  reconnectMediaSource,
  restoreDominantVideoSources,
  resetMediaItemEdits,
  redoTimelineHistory,
  reconcileClipSourceDuration,
  resizeTextOverlayBoxById,
  resizeCaptionOverlayById,
  resizeCutoutTransform,
  setClipEffectById,
  setClipFilterById,
  setClipAdjustmentById,
  setClipSpeedById,
  setClipVolumeById,
  setVideoLayerSpeed,
  setVideoLayerVolume,
  finishVideoLayerControlHistoryGesture,
  previewVideoLayerControlHistoryGesture,
  startVideoLayerControlHistoryGesture,
  setCaptionStyleById,
  setTextContentById,
  setTextRotationById,
  setTextStyleById,
  resetCutoutMask,
  isTrackHidden,
  toggleClipMuteById,
  toggleTrackVisibility,
  shouldMovePlayheadDuringScrub,
  shouldMuteVideoNativeAudio,
  splitClipByIdAtFrame,
  intersectSourceRanges,
  subtractSourceRanges,
  ClipAnimationEasing,
  ClipAnimationPreset,
  ClipAnimationTiming,
  ClipTransitionPresentation,
  ClipEffect,
  ClipFilter,
  TextEffect,
  TextEntranceAnimation,
  CaptionStyle,
  CaptionAnimationPreset,
  CaptionResizeHandle,
  ClipAdjustment,
  CutoutTransform,
  CutoutMaskStroke,
  SavedEditorProject,
  TimelineClip,
  TrackName,
  trimClipById,
  trimMediaItemRange,
  undoTimelineHistory,
  VideoLayerDirection,
  VideoLayerControlHistoryGesture,
} from "./editorLogic";
import { parseCaptionFile } from "./captionFileParser";
import {
  createAutomaticCutoutRequestTiming,
  createCutoutRequestSnapshot,
  isCutoutRequestSnapshotCurrent,
} from "./cutoutRequest";
import {
  createDominantVoiceRequestSnapshot,
  isDominantVoiceRequestCurrent,
} from "./dominantVoiceRequest";
import { detectVideoScenes as requestVideoSceneDetection } from "./sceneDetectionClient";
import { BrowserVoiceRecorder } from "./voiceRecorder";

type Props = {
  project?: SavedEditorProject;
};

type MediaItem = {
  id: string;
  label: string;
  src: string;
  duration: string;
  durationInFrames: number;
  kind: "local" | "public";
  mediaType?: "video" | "image";
  sourceStart?: number;
  sourceDurationInFrames?: number;
  trimOriginalSourceStart?: number;
  trimOriginalDurationInFrames?: number;
  sourceFileId?: string;
  sceneIndex?: number;
  sourceGroupIndex?: number;
  sourceLabel?: string;
  adjustment?: ClipAdjustment;
};

export const isDetectedSceneMediaItem = (
  mediaItem: Pick<MediaItem, "sourceFileId"> | undefined,
) => Boolean(mediaItem?.sourceFileId);

type AnalyzingMediaItem = { id: string; label: string };

type ImportVideoMode = "whole" | "scenes";

type UploadedMediaResponse = {
  src: string;
  label: string;
  mimeType: string;
};

const fps = 30;
const defaultMediaDurationInFrames = 16 * fps;
const defaultImageDurationInFrames = 5 * fps;
const remotionRegistrationFallbackInFrames = 24 * 60 * 60 * fps;
const timelineScale = 1.15;
const timelineOrigin = 148;
const timelineDragActivationDistance = 6;
const minimumTransitionDuration = 1;
const savedProjectStorageKey = "video-editor-project-v1";
const favoriteAnimationsStorageKey = "video-editor-favorite-animations-v1";
const recentAnimationsStorageKey = "video-editor-recent-animations-v1";
const maximumRecentAnimations = 4;

const readStoredStringList = (storageKey: string): string[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    );
    return Array.isArray(storedValue)
      ? storedValue.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const persistStoredStringList = (storageKey: string, values: string[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(values));
};

type SilenceRemovalCommitSnapshot = {
  sourceClipId: string;
  sourceClipSrc: string;
  sourceClipSourceStart: number;
  sourceClipDuration: number;
  sourceClipSpeed: number;
  selectionVersion: number;
};

type SilenceRemovalPreflightDecision =
  | {
      outcome: "ready";
      clips: TimelineClip[];
      status: null;
    }
  | {
      outcome: "missing-linked-audio";
      clips: TimelineClip[];
      status: {
        kind: "error";
        message: "The selected video has no linked audio to clean up.";
      };
    };

export const decideSilenceRemovalPreflight = (
  currentClips: TimelineClip[],
  sourceClipId: string,
): SilenceRemovalPreflightDecision => {
  const sourceClip = currentClips.find((clip) => clip.id === sourceClipId);
  const hasReciprocalLinkedAudio = Boolean(
    sourceClip?.linkedClipId &&
    currentClips.some(
      (clip) =>
        clip.id === sourceClip.linkedClipId &&
        clip.track === "audio" &&
        clip.linkedClipId === sourceClip.id,
    ),
  );

  if (!hasReciprocalLinkedAudio) {
    return {
      outcome: "missing-linked-audio",
      clips: currentClips,
      status: {
        kind: "error",
        message: "The selected video has no linked audio to clean up.",
      },
    };
  }

  return { outcome: "ready", clips: currentClips, status: null };
};

type SilenceRemovalActionDecision =
  | {
      outcome: "stale";
      clips: TimelineClip[];
      selection: null;
      status: { kind: "idle"; message: "" };
    }
  | {
      outcome: "no-removable-silence";
      clips: TimelineClip[];
      selection: null;
      status: { kind: "success"; message: "No removable silence was found." };
    }
  | {
      outcome: "committed";
      clips: TimelineClip[];
      selection: { clipId: string; track: "main" | "upper" };
      status: { kind: "success"; message: string };
    };

export const decideSilenceRemovalAction = ({
  currentClips,
  selectedClipId,
  selectionVersion,
  requestIsActive,
  snapshot,
  ranges,
  fps: commitFps,
}: {
  currentClips: TimelineClip[];
  selectedClipId: string | null;
  selectionVersion: number;
  requestIsActive: boolean;
  snapshot: SilenceRemovalCommitSnapshot;
  ranges: Array<{ startSeconds: number; endSeconds: number }>;
  fps: number;
}): SilenceRemovalActionDecision => {
  if (
    !requestIsActive ||
    selectedClipId !== snapshot.sourceClipId ||
    selectionVersion !== snapshot.selectionVersion
  ) {
    return {
      outcome: "stale",
      clips: currentClips,
      selection: null,
      status: { kind: "idle", message: "" },
    };
  }

  const sourceClip = currentClips.find(
    (clip) => clip.id === snapshot.sourceClipId,
  );
  if (
    !sourceClip ||
    (sourceClip.track !== "main" && sourceClip.track !== "upper") ||
    sourceClip.src !== snapshot.sourceClipSrc ||
    (sourceClip.sourceStart ?? 0) !== snapshot.sourceClipSourceStart ||
    sourceClip.duration !== snapshot.sourceClipDuration ||
    (sourceClip.speed ?? 1) !== snapshot.sourceClipSpeed
  ) {
    return {
      outcome: "stale",
      clips: currentClips,
      selection: null,
      status: { kind: "idle", message: "" },
    };
  }

  if (ranges.length === 0) {
    return {
      outcome: "no-removable-silence",
      clips: currentClips,
      selection: null,
      status: {
        kind: "success",
        message: "No removable silence was found.",
      },
    };
  }

  const clips = removeSilenceFromLinkedVideo(
    currentClips,
    snapshot.sourceClipId,
    ranges,
    commitFps,
  );
  if (clips === currentClips) {
    return {
      outcome: "no-removable-silence",
      clips: currentClips,
      selection: null,
      status: {
        kind: "success",
        message: "No removable silence was found.",
      },
    };
  }

  const firstVideoSegment = clips.reduce<TimelineClip | null>(
    (firstSegment, clip) => {
      if (
        clip.track !== sourceClip.track ||
        !clip.id.startsWith(`${snapshot.sourceClipId}-speech-`)
      ) {
        return firstSegment;
      }
      if (!firstSegment || clip.start < firstSegment.start) {
        return clip;
      }
      return firstSegment;
    },
    null,
  );
  if (!firstVideoSegment) {
    return {
      outcome: "no-removable-silence",
      clips: currentClips,
      selection: null,
      status: {
        kind: "success",
        message: "No removable silence was found.",
      },
    };
  }

  return {
    outcome: "committed",
    clips,
    selection: {
      clipId: firstVideoSegment.id,
      track: sourceClip.track,
    },
    status: {
      kind: "success",
      message: `Removed ${ranges.length} silent pause${ranges.length === 1 ? "" : "s"}.`,
    },
  };
};

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.project?.clips
    ? getTimelineDuration(props.project.clips)
    : remotionRegistrationFallbackInFrames,
});

const resolveMediaSource = (src: string) => {
  return /^(blob:|data:|https?:)/.test(src) ? src : staticFile(src);
};

const imageExtensionPattern = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

const isImageSource = (src?: string) =>
  imageExtensionPattern.test((src ?? "").split(/[?#]/)[0] ?? "");

const getMediaFileType = (file: File): "video" | "image" | null => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return null;
};

const getMediaItemType = (mediaItem: Pick<MediaItem, "mediaType" | "src">) =>
  mediaItem.mediaType ?? (isImageSource(mediaItem.src) ? "image" : "video");

const isImageClip = (clip?: Pick<TimelineClip, "mediaType" | "src">) =>
  clip?.mediaType === "image" || (!clip?.mediaType && isImageSource(clip?.src));

const shouldShowTimelineFilmstrip = (clip: TimelineClip) =>
  Boolean(clip.src) &&
  (clip.track === "main" ||
    clip.track === "upper" ||
    (clip.track === "cutout" && clip.cutout?.mediaKind === "video"));

const shouldShowTimelineWaveform = (clip: TimelineClip) =>
  clip.track === "audio" ||
  (Boolean(clip.src) &&
    (clip.track === "main" || clip.track === "upper"
      ? !isImageClip(clip)
      : clip.track === "cutout" && clip.cutout?.mediaKind === "video"));

const getTimelineThumbnailCount = (clip: TimelineClip) =>
  Math.max(
    1,
    Math.min(12, Math.ceil((clip.duration * timelineScale) / 84)),
  );

const seekTimelineThumbnail = (
  video: HTMLVideoElement,
  clip: TimelineClip,
  index: number,
  count: number,
) => {
  const sourceStartSeconds = (clip.sourceStart ?? 0) / fps;
  const sourceDurationSeconds =
    (clip.duration * (clip.speed ?? 1)) / fps;
  const requestedTime =
    sourceStartSeconds +
    sourceDurationSeconds * ((index + 0.5) / Math.max(1, count));
  const latestSeekTime = Number.isFinite(video.duration)
    ? Math.max(0, video.duration - 0.05)
    : requestedTime;
  video.currentTime = Math.max(0, Math.min(requestedTime, latestSeekTime));
};

const createWaveformLinePoints = (clipId: string, duration: number) => {
  const amplitudes = createWaveformBars(
    clipId,
    Math.max(20, Math.min(72, Math.round(duration / 8))),
  );
  const seed = Array.from(clipId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return amplitudes
    .map((amplitude, index) => {
      const x =
        amplitudes.length === 1 ? 0 : (index / (amplitudes.length - 1)) * 100;
      const isQuiet = (index + seed) % 13 < 3;
      const direction = (index * 7 + seed) % 9 === 0 ? 1 : -1;
      const height = isQuiet ? amplitude * 1.1 : amplitude * 11.5;
      const y = Math.max(1, Math.min(19, 14 + direction * height));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

const durationToFrames = (durationInSeconds: number) => {
  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    return defaultMediaDurationInFrames;
  }

  return Math.max(1, Math.round(durationInSeconds * fps));
};

const formatMediaDuration = (durationInFrames: number) => {
  const totalSeconds = Math.max(0, Math.round(durationInFrames / fps));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatMediaPreviewTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatMediaTrimTime = (frame: number) => {
  const totalSeconds = Math.max(0, frame) / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds
    .toFixed(2)
    .padStart(5, "0")}`;
};

const defaultClipAnimation = {
  preset: "none" as ClipAnimationPreset,
  timing: "start" as ClipAnimationTiming,
  duration: 30,
  easing: "smooth" as ClipAnimationEasing,
};

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

const easeAnimationProgress = (value: number, easing: ClipAnimationEasing) => {
  const progress = clampUnit(value);
  switch (easing) {
    case "fast":
      return 1 - (1 - progress) ** 2;
    case "slow":
      return progress ** 2;
    default:
      return progress * progress * (3 - 2 * progress);
  }
};

const updateClipById = (
  clips: TimelineClip[],
  clipId: string | null,
  updater: (clip: TimelineClip) => TimelineClip,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  return clips.map((clip) => (clip.id === clipId ? updater(clip) : clip));
};

const getClipVisualPresentation = (clip?: TimelineClip, frame = 0) => {
  const visual = clip?.visual;
  const effectIntensity = (visual?.effectIntensity ?? 100) / 100;
  const filterIntensity = (visual?.filterIntensity ?? 100) / 100;
  const filters: string[] = [];
  let opacity = 1;
  let scale = 1;

  switch (visual?.filter ?? "none") {
    case "warm":
      filters.push(
        `sepia(${0.14 * filterIntensity})`,
        `saturate(${1 + 0.18 * filterIntensity})`,
      );
      break;
    case "cool":
      filters.push(
        `hue-rotate(${-8 * filterIntensity}deg)`,
        `saturate(${1 + 0.1 * filterIntensity})`,
      );
      break;
    case "vivid":
      filters.push(
        `contrast(${1 + 0.24 * filterIntensity})`,
        `saturate(${1 + 0.28 * filterIntensity})`,
      );
      break;
    case "vintage":
      filters.push(
        `sepia(${0.32 * filterIntensity})`,
        `contrast(${1 - 0.08 * filterIntensity})`,
      );
      break;
    case "sepia":
      filters.push(`sepia(${0.7 * filterIntensity})`);
      break;
    case "cinema":
      filters.push(
        `contrast(${1 + 0.18 * filterIntensity})`,
        `brightness(${1 - 0.06 * filterIntensity})`,
      );
      break;
    case "soft":
      filters.push(
        `brightness(${1 + 0.08 * filterIntensity})`,
        `saturate(${1 - 0.08 * filterIntensity})`,
      );
      break;
    default:
      break;
  }

  switch (visual?.effect ?? "none") {
    case "blur":
      filters.push(`blur(${Math.max(0, 6 * effectIntensity)}px)`);
      break;
    case "glow":
      filters.push(
        `drop-shadow(0 0 ${Math.max(2, 20 * effectIntensity)}px rgba(56, 214, 200, 0.55))`,
      );
      break;
    case "grayscale":
      filters.push(`grayscale(${0.95 * effectIntensity})`);
      break;
    case "invert":
      filters.push(`invert(${effectIntensity})`);
      break;
    case "fade":
      opacity = Math.max(0.15, 1 - 0.6 * effectIntensity);
      break;
    case "shadow":
      filters.push(
        `drop-shadow(0 ${Math.max(2, 8 * effectIntensity)}px ${Math.max(4, 24 * effectIntensity)}px rgba(15, 23, 42, 0.45))`,
      );
      break;
    case "outline": {
      const width = Math.max(1, 4 * effectIntensity);
      filters.push(
        `drop-shadow(${width}px 0 0 white)`,
        `drop-shadow(${-width}px 0 0 white)`,
        `drop-shadow(0 ${width}px 0 white)`,
        `drop-shadow(0 ${-width}px 0 white)`,
        `drop-shadow(${width}px ${width}px 0 white)`,
        `drop-shadow(${-width}px ${width}px 0 white)`,
        `drop-shadow(${width}px ${-width}px 0 white)`,
        `drop-shadow(${-width}px ${-width}px 0 white)`,
      );
      break;
    }
    case "moving-outline": {
      const angle = ((frame % 90) / 90) * Math.PI * 2;
      const distance = Math.max(2, 5 * effectIntensity);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      filters.push(
        `drop-shadow(${x}px ${y}px 0 rgba(34, 211, 238, 0.95))`,
        `drop-shadow(${-x}px ${-y}px 0 rgba(244, 114, 182, 0.9))`,
        `drop-shadow(0 0 ${8 * effectIntensity}px rgba(255, 255, 255, 0.75))`,
      );
      break;
    }
    case "neon-outline": {
      const width = Math.max(1, 3 * effectIntensity);
      filters.push(
        `drop-shadow(${width}px 0 0 #22d3ee)`,
        `drop-shadow(${-width}px 0 0 #22d3ee)`,
        `drop-shadow(0 ${width}px 0 #f472b6)`,
        `drop-shadow(0 ${-width}px 0 #f472b6)`,
        `drop-shadow(0 0 ${14 * effectIntensity}px rgba(34, 211, 238, 0.9))`,
      );
      break;
    }
    case "silhouette":
      filters.push("brightness(0)");
      break;
    case "zoom":
      scale = 1 + 0.12 * effectIntensity;
      break;
    default:
      break;
  }

  return {
    filter: filters.join(" "),
    opacity,
    scale,
  };
};

const getClipAnimationPresentation = (
  clip: TimelineClip | undefined,
  playheadFrame: number,
) => {
  if (!clip) {
    return { opacity: 1, translateX: 0, translateY: 0, scale: 1 };
  }

  const animation = {
    ...defaultClipAnimation,
    ...clip.animation,
  };
  if (animation.preset === "none") {
    return { opacity: 1, translateX: 0, translateY: 0, scale: 1 };
  }

  const endFrame = clip.start + clip.duration;
  const duration = Math.max(1, animation.duration);
  const startProgress = easeAnimationProgress(
    (playheadFrame - clip.start) / duration,
    animation.easing,
  );
  const endProgress = easeAnimationProgress(
    (endFrame - playheadFrame) / duration,
    animation.easing,
  );
  const useStartWindow =
    animation.timing === "start" || animation.timing === "both";
  const useEndWindow =
    animation.timing === "end" || animation.timing === "both";
  let opacity = 1;
  const translateX = 0;
  let translateY = 0;
  let scale = 1;

  switch (animation.preset) {
    case "fade-in":
      opacity = useStartWindow ? startProgress : 1;
      break;
    case "fade-out":
      opacity = useEndWindow ? endProgress : 1;
      break;
    case "slide-in":
      translateY = useStartWindow ? (1 - startProgress) * 18 : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "slide-out":
      translateY = useEndWindow ? (1 - endProgress) * 18 : 0;
      opacity = useEndWindow ? Math.max(0.3, endProgress) : 1;
      break;
    case "zoom-in":
      scale = useStartWindow ? 0.9 + startProgress * 0.1 : 1;
      opacity = useStartWindow ? Math.max(0.4, startProgress) : 1;
      break;
    case "zoom-out":
      scale = useEndWindow ? 0.9 + endProgress * 0.1 : 1;
      opacity = useEndWindow ? Math.max(0.4, endProgress) : 1;
      break;
    case "pop":
      scale = useStartWindow ? 0.86 + startProgress * 0.14 : 1;
      opacity = useStartWindow ? Math.max(0.45, startProgress) : 1;
      break;
    default:
      break;
  }

  return { opacity, translateX, translateY, scale };
};

const setClipEffectIntensityById = (
  clips: TimelineClip[],
  clipId: string | null,
  intensity: number,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    visual: {
      effect: clip.visual?.effect ?? "none",
      filter: clip.visual?.filter ?? "none",
      effectIntensity: intensity,
      filterIntensity: clip.visual?.filterIntensity,
    },
  }));

const setClipFilterIntensityById = (
  clips: TimelineClip[],
  clipId: string | null,
  intensity: number,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    visual: {
      effect: clip.visual?.effect ?? "none",
      filter: clip.visual?.filter ?? "none",
      effectIntensity: clip.visual?.effectIntensity,
      filterIntensity: intensity,
    },
  }));

const setClipAnimationById = (
  clips: TimelineClip[],
  clipId: string | null,
  preset: ClipAnimationPreset,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    animation: {
      ...defaultClipAnimation,
      ...clip.animation,
      preset,
      timing: preset.endsWith("-out") ? "end" : "start",
    },
  }));

const setClipAnimationTimingById = (
  clips: TimelineClip[],
  clipId: string | null,
  timing: ClipAnimationTiming,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    animation: {
      ...defaultClipAnimation,
      ...clip.animation,
      timing,
    },
  }));

const setClipAnimationDurationById = (
  clips: TimelineClip[],
  clipId: string | null,
  duration: number,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    animation: {
      ...defaultClipAnimation,
      ...clip.animation,
      duration,
    },
  }));

const setClipAnimationEasingById = (
  clips: TimelineClip[],
  clipId: string | null,
  easing: ClipAnimationEasing,
): TimelineClip[] =>
  updateClipById(clips, clipId, (clip) => ({
    ...clip,
    animation: {
      ...defaultClipAnimation,
      ...clip.animation,
      easing,
    },
  }));

const getCaptionSourceFileName = (clip: TimelineClip, blob: Blob) => {
  const extensionFromType = blob.type.startsWith("video/")
    ? blob.type.slice("video/".length)
    : "";
  const sanitizedLabel = clip.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const nameFromSource = clip.src?.split("/").pop()?.split("?")[0] ?? "";

  if (nameFromSource.includes(".")) {
    return nameFromSource;
  }

  const baseName = sanitizedLabel || clip.id || "clip";
  const extension = extensionFromType || "mp4";
  return `${baseName}.${extension}`;
};

const readVideoDurationInFrames = (src: string) =>
  new Promise<number>((resolve) => {
    const video = document.createElement("video");
    const finish = (durationInFrames: number) => {
      video.removeAttribute("src");
      video.load();
      resolve(durationInFrames);
    };

    video.preload = "metadata";
    video.addEventListener(
      "loadedmetadata",
      () => finish(durationToFrames(video.duration)),
      { once: true },
    );
    video.addEventListener(
      "error",
      () => finish(defaultMediaDurationInFrames),
      { once: true },
    );
    video.src = resolveMediaSource(src);
  });

const readAudioDurationInFrames = (src: string) =>
  new Promise<number>((resolve) => {
    const audio = document.createElement("audio");
    const finish = (durationInFrames: number) => {
      audio.removeAttribute("src");
      audio.load();
      resolve(durationInFrames);
    };

    audio.preload = "metadata";
    audio.addEventListener(
      "loadedmetadata",
      () => finish(durationToFrames(audio.duration)),
      { once: true },
    );
    audio.addEventListener(
      "error",
      () => finish(defaultMediaDurationInFrames),
      { once: true },
    );
    audio.src = resolveMediaSource(src);
  });

type ActiveTool =
  | "media"
  | "audio"
  | "text"
  | "cutout"
  | "captions"
  | "transcript"
  | "stickers"
  | "animations"
  | "effects"
  | "filters"
  | "adjustment";

const animationOptions: Array<{ id: ClipAnimationPreset; label: string }> = [
  { id: "none", label: "None" },
  { id: "fade-in", label: "Fade in" },
  { id: "fade-out", label: "Fade out" },
  { id: "slide-in", label: "Slide in" },
  { id: "slide-out", label: "Slide out" },
  { id: "zoom-in", label: "Zoom in" },
  { id: "zoom-out", label: "Zoom out" },
  { id: "pop", label: "Pop" },
];

const animationTimingOptions: Array<{
  id: ClipAnimationTiming;
  label: string;
}> = [
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "both", label: "Both" },
];

const animationEasingOptions: Array<{
  id: ClipAnimationEasing;
  label: string;
}> = [
  { id: "smooth", label: "Smooth" },
  { id: "fast", label: "Fast" },
  { id: "slow", label: "Slow" },
];

const effectOptions: Array<{ id: ClipEffect; label: string }> = [
  { id: "none", label: "None" },
  { id: "blur", label: "Blur" },
  { id: "glow", label: "Glow" },
  { id: "grayscale", label: "B/W" },
  { id: "invert", label: "Invert" },
  { id: "fade", label: "Fade" },
  { id: "shadow", label: "Shadow" },
  { id: "outline", label: "Outline" },
  { id: "zoom", label: "Zoom" },
];

const cutoutEffectOptions: Array<{ id: ClipEffect; label: string }> = [
  ...effectOptions,
  { id: "moving-outline", label: "Moving Outline" },
  { id: "neon-outline", label: "Neon Edge" },
  { id: "silhouette", label: "Silhouette" },
];

const filterOptions: Array<{ id: ClipFilter; label: string }> = [
  { id: "none", label: "None" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "vivid", label: "Vivid" },
  { id: "vintage", label: "Vintage" },
  { id: "sepia", label: "Sepia" },
  { id: "cinema", label: "Cinema" },
  { id: "soft", label: "Soft" },
];

const textFontOptions = [
  "Inter",
  "Arial",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
];

const textEffectOptions: Array<{ id: TextEffect; label: string }> = [
  { id: "none", label: "None" },
  { id: "shadow", label: "Shadow" },
  { id: "outline", label: "Outline" },
  { id: "glow", label: "Glow" },
];

const textAnimationOptions: Array<{
  id: TextEntranceAnimation;
  label: string;
}> = [
  { id: "none", label: "None" },
  { id: "pop", label: "Pop" },
  { id: "jump", label: "Jump" },
  { id: "fade", label: "Fade" },
  { id: "star-jump", label: "Star Jump" },
  { id: "bounce", label: "Bounce" },
  { id: "typewriter", label: "Typewriter" },
  { id: "wave", label: "Wave" },
  { id: "flicker", label: "Flicker" },
  { id: "spin-in", label: "Spin In" },
];

const captionAnimationOptions: Array<{
  id: CaptionAnimationPreset;
  label: string;
}> = [
  { id: "none", label: "None" },
  { id: "pop", label: "Pop" },
  { id: "bounce", label: "Bounce" },
  { id: "jump", label: "Jump" },
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
];

const getTextEffectStyle = (effect: TextEffect = "none"): CSSProperties => {
  switch (effect) {
    case "shadow":
      return { textShadow: "0 4px 12px rgba(0, 0, 0, 0.85)" };
    case "outline":
      return {
        WebkitTextStroke: "1.5px rgba(2, 6, 23, 0.95)",
        textShadow: "0 2px 8px rgba(2, 6, 23, 0.65)",
      };
    case "glow":
      return { textShadow: "0 0 14px rgba(56, 214, 200, 0.95)" };
    default:
      return {};
  }
};

const getCaptionAnimationStyle = (
  caption: NonNullable<TimelineClip["caption"]>,
  clip: TimelineClip,
  frame: number,
): CSSProperties => {
  const preset = caption.animation ?? "none";
  const speed = Math.max(0.25, caption.animationSpeed ?? 1);
  const localFrame = Math.max(0, frame - clip.start);
  const progress = Math.min(1, localFrame / Math.max(1, 12 / speed));

  switch (preset) {
    case "pop":
      return { transform: `scale(${0.55 + progress * 0.45})` };
    case "bounce":
      return {
        transform: `scale(${1 + Math.abs(Math.sin(localFrame * 0.28 * speed)) * 0.14})`,
      };
    case "jump":
      return {
        transform: `translateY(${-Math.abs(Math.sin(localFrame * 0.22 * speed)) * 18}px)`,
      };
    case "fade":
      return { opacity: progress };
    case "slide":
      return {
        transform: `translateX(${(1 - progress) * -42}px)`,
        opacity: progress,
      };
    default:
      return {};
  }
};

const getClipAdjustmentStyle = (clip?: TimelineClip) => {
  const adjustment = {
    ...defaultClipAdjustment,
    ...clip?.adjustment,
  };

  return {
    transform: `translate(${adjustment.positionX}%, ${adjustment.positionY}%) scale(${adjustment.scale}) rotate(${adjustment.rotation}deg)`,
    transformOrigin: "center",
    clipPath: `inset(${adjustment.cropTop}% ${adjustment.cropRight}% ${adjustment.cropBottom}% ${adjustment.cropLeft}%)`,
  };
};

const getClipFrameStyle = (
  clip: TimelineClip | undefined,
  playheadFrame: number,
  transitionPresentation?: ClipTransitionPresentation,
): CSSProperties => {
  const visual = getClipVisualPresentation(clip, playheadFrame);
  const animation = getClipAnimationPresentation(clip, playheadFrame);
  const transition = transitionPresentation ?? {
    opacity: 1,
    translateX: 0,
    scale: 1,
  };

  return {
    ...visual,
    opacity: visual.opacity * animation.opacity * transition.opacity,
    translate: `${animation.translateX + transition.translateX}% ${animation.translateY}%`,
    scale: visual.scale * animation.scale * transition.scale,
  };
};

const getCutoutChromaKeyStyle = (
  source?: Pick<TimelineClip, "chromaKey" | "cutout"> | CutoutTransform,
): CSSProperties => {
  const chromaKey =
    source && "cutout" in source
      ? (source.chromaKey ?? source.cutout?.chromaKey)
      : (source as CutoutTransform | undefined)?.chromaKey;
  switch (chromaKey) {
    case "green":
      return { filter: "url(#cutout-chroma-green)" };
    case "white":
      return { filter: "url(#cutout-chroma-white)" };
    case "black":
      return { filter: "url(#cutout-chroma-black)" };
    default:
      return {};
  }
};

type StickerItem = {
  id: string;
  label: string;
  src: string;
  uploaded?: boolean;
};

const svgSticker = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${body}</svg>`,
  )}`;

const builtInStickers: StickerItem[] = [
  {
    id: "sticker-star",
    label: "Star",
    src: svgSticker(
      '<path fill="#facc15" d="M80 12l20 42 46 6-33 32 8 46-41-22-41 22 8-46-33-32 46-6z"/>',
    ),
  },
  {
    id: "sticker-heart",
    label: "Heart",
    src: svgSticker(
      '<path fill="#fb496f" d="M80 140C24 108 10 77 20 47 31 15 68 16 80 42c12-26 49-27 60 5 10 30-4 61-60 93z"/>',
    ),
  },
  {
    id: "sticker-sparkles",
    label: "Sparkles",
    src: svgSticker(
      '<path fill="#a855f7" d="M80 8l12 45 44 12-44 12-12 45-12-45-44-12 44-12z"/><path fill="#facc15" d="M125 92l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/>',
    ),
  },
  {
    id: "sticker-smile",
    label: "Smile",
    src: svgSticker(
      '<circle cx="80" cy="80" r="65" fill="#facc15"/><circle cx="57" cy="66" r="7"/><circle cx="103" cy="66" r="7"/><path d="M48 92c12 28 52 28 64 0" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>',
    ),
  },
  {
    id: "sticker-fire",
    label: "Fire",
    src: svgSticker(
      '<path fill="#f97316" d="M84 8c9 31-13 40 1 59 7 9 18 3 21-9 30 25 38 80-24 94-57-7-68-57-30-91-3 26 15 28 20 13 8-24-8-36 12-66z"/><path fill="#facc15" d="M81 76c18 19 20 48 0 61-20-10-25-34 0-61z"/>',
    ),
  },
  {
    id: "sticker-check",
    label: "Check",
    src: svgSticker(
      '<circle cx="80" cy="80" r="66" fill="#22c55e"/><path d="M43 82l24 24 51-55" fill="none" stroke="white" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
  },
];

const initialMediaItems: MediaItem[] = [
  {
    id: "media-initial",
    label: "initialClips.mp4",
    src: "initialClips.mp4",
    duration: "00:16",
    durationInFrames: defaultMediaDurationInFrames,
    kind: "public",
    mediaType: "video",
  },
  {
    id: "media-screen-recording",
    label: "Screen Recording 2026-06-01 172454.mp4",
    src: "Screen Recording 2026-06-01 172454.mp4",
    duration: "Saved clip",
    durationInFrames: defaultMediaDurationInFrames,
    kind: "public",
    mediaType: "video",
  },
];

const initialClips: TimelineClip[] = createMainMediaPair({
  mainId: "main-1",
  audioId: "audio-1",
  label: "initialClips",
  src: "initialClips.mp4",
  start: 0,
  duration: defaultMediaDurationInFrames,
});

const readBrowserSavedProject = (): SavedEditorProject | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const savedProject = parseSavedEditorProject(
    window.localStorage.getItem(savedProjectStorageKey),
  );

  if (!savedProject) {
    return null;
  }

  const cleanedProject = removeBrowserOnlySavedMedia(savedProject);

  return cleanedProject.clips.length > 0 || cleanedProject.mediaItems.length > 0
    ? cleanedProject
    : null;
};

const persistProjectToStorage = (project: SavedEditorProject) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(savedProjectStorageKey, JSON.stringify(project));
};

const uploadMediaFile = async (file: File): Promise<UploadedMediaResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/media", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message || "Import failed.");
  }

  return response.json() as Promise<UploadedMediaResponse>;
};

type BackgroundRemovalResult = {
  src: string;
  mimeType: string;
};

const removeBackgroundFromFile = async ({
  file,
  mediaKind,
  sourceStartSeconds = 0,
  durationSeconds,
  signal,
}: {
  file: File;
  mediaKind: "image" | "video";
  sourceStartSeconds?: number;
  durationSeconds: number;
  signal?: AbortSignal;
}): Promise<BackgroundRemovalResult> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mediaKind", mediaKind);
  formData.append("sourceStart", String(sourceStartSeconds));
  formData.append("duration", String(durationSeconds));

  const response = await fetch("/api/remove-background", {
    method: "POST",
    body: formData,
    signal,
  });
  let payload: {
    src?: string;
    mimeType?: string;
    error?: { message?: string };
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error(
      response.ok
        ? "Background removal returned an invalid response."
        : "Automatic cutout failed.",
    );
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || "Automatic cutout failed.");
  }
  if (!payload.src || !payload.mimeType) {
    throw new Error("Background removal returned an invalid response.");
  }

  return { src: payload.src, mimeType: payload.mimeType };
};

export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer.");
  }

  const results = new Array<Output>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

type MergeImportedMediaItemsOptions = {
  currentItems: MediaItem[];
  newItems: MediaItem[];
  sourceFileId: string;
  orderedSourceFileIds: string[];
};

export const mergeImportedMediaItemsInSelectionOrder = ({
  currentItems,
  newItems,
  sourceFileId,
  orderedSourceFileIds,
}: MergeImportedMediaItemsOptions): MediaItem[] => {
  const orderedSourceFileIdSet = new Set(orderedSourceFileIds);
  const getItemSourceFileId = (item: MediaItem) => {
    if (item.sourceFileId && orderedSourceFileIdSet.has(item.sourceFileId)) {
      return item.sourceFileId;
    }
    return orderedSourceFileIds.find((id) => item.id === `media-${id}`) ?? null;
  };
  const completedGroups = new Map<string, MediaItem[]>();
  const existingItems: MediaItem[] = [];

  for (const item of currentItems) {
    const itemSourceFileId = getItemSourceFileId(item);
    if (!itemSourceFileId) {
      existingItems.push(item);
      continue;
    }
    completedGroups.set(itemSourceFileId, [
      ...(completedGroups.get(itemSourceFileId) ?? []),
      item,
    ]);
  }
  completedGroups.set(sourceFileId, newItems);

  return [
    ...orderedSourceFileIds.flatMap((id) => completedGroups.get(id) ?? []),
    ...existingItems,
  ];
};

type AnalyzeImportedVideoResult = {
  sceneItems: MediaItem[];
  usedFallback: boolean;
};

type AnalyzeImportedVideoOptions = {
  file: File;
  sourceFileId: string;
  sourceGroupIndex?: number;
  previewSrc: string;
  detectVideoScenes?: typeof requestVideoSceneDetection;
  createSceneMediaItems?: typeof buildSceneMediaItems;
  readDurationInFrames?: typeof readVideoDurationInFrames;
  uploadMedia?: typeof uploadMediaFile;
};

export const analyzeImportedVideo = async ({
  file,
  sourceFileId,
  sourceGroupIndex,
  previewSrc,
  detectVideoScenes = requestVideoSceneDetection,
  createSceneMediaItems = buildSceneMediaItems,
  readDurationInFrames = readVideoDurationInFrames,
  uploadMedia = uploadMediaFile,
}: AnalyzeImportedVideoOptions): Promise<AnalyzeImportedVideoResult> => {
  const mediaPromise = Promise.all([
    readDurationInFrames(previewSrc),
    uploadMedia(file),
  ]);
  const detectionPromise = detectVideoScenes(file).then(
    (ranges) => ({ ranges, usedFallback: false }),
    () => ({ ranges: null, usedFallback: true }),
  );
  const [[durationInFrames, uploadedMedia], detection] = await Promise.all([
    mediaPromise,
    detectionPromise,
  ]);
  const ranges = detection.ranges ?? [
    {
      startSeconds: 0,
      endSeconds: durationInFrames / fps,
    },
  ];
  const sceneItems = createSceneMediaItems({
    sourceFileId,
    sourceGroupIndex,
    label: uploadedMedia.label || file.name,
    src: uploadedMedia.src,
    ranges,
    fps,
    sourceDurationInFrames: durationInFrames,
  });

  if (sceneItems.length === 0) {
    throw new Error("Scene analysis did not produce any media cards.");
  }

  return {
    sceneItems,
    usedFallback: detection.usedFallback,
  };
};

const isBrowserOnlySource = (src?: string) => src?.startsWith("blob:") ?? false;

const downloadBrowserFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type TimelineRow = {
  key: string;
  id: TrackName;
  label: string;
  order: number;
  videoLayer?: number;
  audioKind?: "voiceover" | "imported";
};

const isVoiceoverClip = (clip: TimelineClip) =>
  clip.track === "audio" &&
  (clip.audioKind === "voiceover" || clip.id.startsWith("voice-"));

const isImportedAudioClip = (clip: TimelineClip) =>
  clip.track === "audio" && !clip.linkedClipId && !isVoiceoverClip(clip);

const timelineRowContainsClip = (row: TimelineRow, clip: TimelineClip) => {
  if (row.audioKind === "voiceover") {
    return isVoiceoverClip(clip);
  }
  if (row.audioKind === "imported") {
    return isImportedAudioClip(clip);
  }

  return row.videoLayer !== undefined
    ? getVideoLayer(clip) === row.videoLayer
    : clip.track === row.id;
};

type VideoDropTarget =
  | { kind: "layer"; videoLayer: number }
  | { kind: "append-main" }
  | {
      kind: "row-gap";
      direction: VideoLayerDirection;
      rowOrder: number;
    }
  | {
      kind: "track";
      track: "audio" | "cutout" | "sticker" | "caption" | "text";
    };

type PointerDrag = {
  type: "timeline" | "media";
  id: string;
  activated: boolean;
  mediaIds?: string[];
  label: string;
  x: number;
  y: number;
  pointerStartX?: number;
  pointerStartY?: number;
  originalStart?: number;
  grabOffsetFrames?: number;
};

type TrimDrag = {
  clipId: string;
  edge: "left" | "right";
  startX: number;
  startFrame: number;
  contentLeft: number;
  originalClips: TimelineClip[];
};

type MediaTrimCanvasDrag = {
  mode: "pan" | "crop" | "rotate";
  handle?: CaptionResizeHandle;
  startX: number;
  startY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  startAngle: number;
  adjustment: ClipAdjustment;
};

type MediaTrimRangeDrag = {
  edge: "start" | "end";
  pointerId: number;
  boundsLeft: number;
  boundsWidth: number;
};

type StickerInteraction = {
  clipId: string;
  mode: "move" | "scale" | "rotate";
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
};

type TextTimelineDrag = {
  clipId: string;
  startX: number;
  startFrame: number;
  contentLeft: number;
  originalClips: TimelineClip[];
};

type TextPreviewDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  halfWidthPercent: number;
  halfHeightPercent: number;
};

type CaptionPreviewDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  halfWidthPercent: number;
  halfHeightPercent: number;
};

type CutoutMaskDrag = {
  clipId: string;
  mode: CutoutMaskStroke["mode"];
  size: number;
  points: CutoutMaskStroke["points"];
  originalClips: TimelineClip[];
  pointerId: number;
  bounds: { x: number; y: number; width: number; height: number };
};

type TextResizeDrag = {
  clipId: string;
  handle: CaptionResizeHandle;
  startX: number;
  startY: number;
  startCenterX: number;
  startCenterY: number;
  startWidth: number;
  startHeight: number;
  startRotation: number;
  startScale: number;
  previewWidth: number;
  previewHeight: number;
  originalClips: TimelineClip[];
};

type CutoutInteraction = {
  clipId: string;
  mode: "move" | "resize" | "rotate";
  handle?: CaptionResizeHandle;
  startX: number;
  startY: number;
  baseWidth: number;
  baseHeight: number;
  originalClips: TimelineClip[];
};

type CaptionResizeDrag = {
  clipId: string;
  handle: CaptionResizeHandle;
  startX: number;
  startY: number;
  startFontSize: number;
  maximumFontSize: number;
  measureBounds: (fontSize: number) => { width: number; height: number };
  previewWidth: number;
  previewHeight: number;
  originalClips: TimelineClip[];
};

type TextRotateDrag = {
  clipId: string;
  centerX: number;
  centerY: number;
  rotationOffset: number;
  originalClips: TimelineClip[];
};

type CropEdge =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type CropDrag = {
  clipId: string;
  edge: CropEdge;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  originalAdjustment: ClipAdjustment;
};

type AdjustmentPanDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  originalAdjustment: ClipAdjustment;
};

type RotateDrag = {
  clipId: string;
  centerX: number;
  centerY: number;
  rotationOffset: number;
  originalClips: TimelineClip[];
};

type CaptionPanelMode = "actions" | "manual" | "auto" | "upload" | "lyrics";

const captionActionTiles = [
  { mode: "auto" as const, label: "Auto captions", icon: "CC" },
  { mode: "manual" as const, label: "Manual captions", icon: "\u270E" },
  { mode: "upload" as const, label: "Upload caption file", icon: "\u2191" },
  { mode: "lyrics" as const, label: "Auto lyrics", icon: "\u266A" },
];

const createImportedCaptionClips = ({
  parsedCaptions,
  fps,
  timelineDuration,
  style,
  batchId,
}: {
  parsedCaptions: ReturnType<typeof parseCaptionFile>;
  fps: number;
  timelineDuration: number;
  style: CaptionStyle;
  batchId: string;
}): TimelineClip[] =>
  parsedCaptions.flatMap(({ startSeconds, endSeconds, text }, index) => {
    const start = Math.max(0, Math.round(startSeconds * fps));
    const end = Math.min(timelineDuration, Math.round(endSeconds * fps));

    if (!text || end <= start) {
      return [];
    }

    return [
      {
        id: `${batchId}-${index}`,
        label: text,
        track: "caption",
        start,
        duration: end - start,
        color: "#ef4444",
        caption: {
          ...style,
          content: text,
        },
      },
    ];
  });

export const MyComposition = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={remotionRegistrationFallbackInFrames}
      fps={fps}
      width={1280}
      height={720}
      calculateMetadata={calculateMetadata}
    />
  );
};

export const MyComponent: React.FC<Props> = ({ project }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importChoiceDialogRef = useRef<HTMLDialogElement>(null);
  const mediaTrimDialogRef = useRef<HTMLDialogElement>(null);
  const mediaTrimVideoRef = useRef<HTMLVideoElement>(null);
  const pendingImportFilesRef = useRef<File[]>([]);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const captionFileInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewLayerVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const previewAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const previewWindowRef = useRef<HTMLDivElement>(null);
  const videoLayerControlDragRef =
    useRef<VideoLayerControlHistoryGesture | null>(null);
  const mediaPreviewVolumeDragRef = useRef(false);
  const previewSourceRef = useRef<string | null>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const suppressMediaClickRef = useRef(false);
  const pointerDragStartedRef = useRef(false);
  const animationQuickMenuRef = useRef<HTMLDivElement>(null);
  const voiceRecorderRef = useRef<BrowserVoiceRecorder | null>(null);
  const [initialProject] = useState<SavedEditorProject | null>(
    () => project ?? readBrowserSavedProject(),
  );
  const [timelineHistory, setTimelineHistory] = useState(() =>
    createTimelineHistory(
      initialProject
        ? restoreDominantVideoSources(
            initialProject.clips,
            initialProject.mediaItems,
          )
        : initialClips,
    ),
  );
  const clips = timelineHistory.present;
  const clipsRef = useRef(clips);
  const unavailableRecoveryRef = useRef(new Set<string>());
  const sourceAvailabilityChecksRef = useRef(new Set<string>());
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() =>
    normalizeMediaSceneLabels(
      initialProject?.mediaItems ?? initialMediaItems,
    ),
  );
  const [nextSourceGroupIndex, setNextSourceGroupIndex] = useState(() =>
    getInitialNextSourceGroupIndex(
      initialProject?.mediaItems ?? initialMediaItems,
      initialProject?.nextSourceGroupIndex,
    ),
  );
  const nextSourceGroupIndexRef = useRef(nextSourceGroupIndex);
  const [analyzingMediaItems, setAnalyzingMediaItems] = useState<
    AnalyzingMediaItem[]
  >([]);
  const [pendingImportVideoCount, setPendingImportVideoCount] = useState(0);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(
    initialProject?.selectedMediaId ??
      initialProject?.mediaItems[0]?.id ??
      initialMediaItems[0].id,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(() => {
    const initialId =
      initialProject?.selectedMediaId ??
      initialProject?.mediaItems[0]?.id ??
      initialMediaItems[0]?.id;
    return initialId ? [initialId] : [];
  });
  const [mediaPreviewTime, setMediaPreviewTime] = useState(0);
  const [mediaPreviewDuration, setMediaPreviewDuration] = useState(0);
  const [isMediaPreviewPlaying, setIsMediaPreviewPlaying] = useState(false);
  const [mediaPreviewVolume, setMediaPreviewVolume] = useState(1);
  const [mediaTrimDraft, setMediaTrimDraft] = useState<{
    mediaId: string;
    startFrame: number;
    endFrame: number;
    adjustment: ClipAdjustment;
  } | null>(null);
  const [mediaTrimCanvasDrag, setMediaTrimCanvasDrag] =
    useState<MediaTrimCanvasDrag | null>(null);
  const [mediaTrimRangeDrag, setMediaTrimRangeDrag] =
    useState<MediaTrimRangeDrag | null>(null);
  const [mediaTrimPreviewFrame, setMediaTrimPreviewFrame] = useState(0);
  const [isMediaTrimPreviewPlaying, setIsMediaTrimPreviewPlaying] =
    useState(false);
  const [isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen] =
    useState(false);
  const [isMediaPreviewVolumeAdjusting, setIsMediaPreviewVolumeAdjusting] =
    useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [, setMediaPreviewFrame] = useState(0);
  const [projectStatus, setProjectStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<TrackName>("main");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedVideoLayer, setSelectedVideoLayer] = useState<number | null>(
    null,
  );
  const selectedClipIdRef = useRef(selectedClipId);
  const autoCaptionRequestRef = useRef<symbol | null>(null);
  const autoCaptionAbortControllerRef = useRef<AbortController | null>(null);
  const autoCaptionSelectionVersionRef = useRef(0);
  const autoCutoutRequestRef = useRef<symbol | null>(null);
  const autoCutoutAbortControllerRef = useRef<AbortController | null>(null);
  const keepMainVoiceRequestRef = useRef<symbol | null>(null);
  const keepMainVoiceAbortControllerRef = useRef<AbortController | null>(null);
  const pendingAutoCutoutCommitRef = useRef<{
    clipId: string;
    processedSrc: string;
  } | null>(null);
  const [, setIsAudioTrackVisible] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<PointerDrag | null>(null);
  const [trimDrag, setTrimDrag] = useState<TrimDrag | null>(null);
  const [videoDropTarget, setVideoDropTarget] =
    useState<VideoDropTarget | null>(null);
  const [previewMode, setPreviewMode] = useState<"media" | "timeline">(
    "timeline",
  );
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPointerId, setScrubPointerId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceRecordingStartFrame, setVoiceRecordingStartFrame] = useState<
    number | null
  >(null);
  const [recordingError, setRecordingError] = useState("");
  const [activeTool, setActiveTool] = useState<ActiveTool>("media");
  const activeToolRef = useRef(activeTool);
  const [favoriteAnimationIds, setFavoriteAnimationIds] = useState<
    ClipAnimationPreset[]
  >(() =>
    readStoredStringList(favoriteAnimationsStorageKey).filter(
      (id): id is ClipAnimationPreset =>
        animationOptions.some((option) => option.id === id && id !== "none"),
    ),
  );
  const [recentAnimationIds, setRecentAnimationIds] = useState<
    ClipAnimationPreset[]
  >(() =>
    readStoredStringList(recentAnimationsStorageKey).filter(
      (id): id is ClipAnimationPreset =>
        animationOptions.some((option) => option.id === id && id !== "none"),
    ),
  );
  const [animationQuickMenu, setAnimationQuickMenu] = useState<{
    clipId: string;
    left: number;
    top: number;
  } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [captionDraft, setCaptionDraft] = useState("");
  const [captionMode, setCaptionMode] = useState<
    "actions" | "manual" | "auto" | "upload" | "lyrics"
  >("actions");
  const [captionStyle, setCaptionStyle] =
    useState<CaptionStyle>(defaultCaptionStyle);
  const [captionStatus, setCaptionStatus] = useState<{
    kind: "idle" | "loading" | "error" | "success";
    message: string;
  }>({ kind: "idle", message: "" });
  const [isAutoCaptionLoading, setIsAutoCaptionLoading] = useState(false);
  const [isKeepMainVoiceLoading, setIsKeepMainVoiceLoading] = useState(false);
  const [stickerItems, setStickerItems] =
    useState<StickerItem[]>(builtInStickers);
  const [stickerInteraction, setStickerInteraction] =
    useState<StickerInteraction | null>(null);
  const [cutoutInteraction, setCutoutInteraction] =
    useState<CutoutInteraction | null>(null);
  const [cutoutTimelineDrag, setCutoutTimelineDrag] =
    useState<TextTimelineDrag | null>(null);
  const cutoutMaskDragRef = useRef<CutoutMaskDrag | null>(null);
  const cutoutMaskCleanupRef = useRef<(() => void) | null>(null);
  const [cutoutBrushMode, setCutoutBrushMode] = useState<
    "move" | "erase" | "restore"
  >("move");
  const [cutoutBrushSize, setCutoutBrushSize] = useState(12);
  const [isAutoCutoutLoading, setIsAutoCutoutLoading] = useState(false);
  const [textTimelineDrag, setTextTimelineDrag] =
    useState<TextTimelineDrag | null>(null);
  const [textPreviewDrag, setTextPreviewDrag] =
    useState<TextPreviewDrag | null>(null);
  const [captionPreviewDrag, setCaptionPreviewDrag] =
    useState<CaptionPreviewDrag | null>(null);
  const [textResizeDrag, setTextResizeDrag] = useState<TextResizeDrag | null>(
    null,
  );
  const [captionResizeDrag, setCaptionResizeDrag] =
    useState<CaptionResizeDrag | null>(null);
  const [textRotateDrag, setTextRotateDrag] = useState<TextRotateDrag | null>(
    null,
  );
  const [cropInputMode, setCropInputMode] = useState<"sliders" | "manual">(
    "sliders",
  );
  const [cropDrag, setCropDrag] = useState<CropDrag | null>(null);
  const [adjustmentPanDrag, setAdjustmentPanDrag] =
    useState<AdjustmentPanDrag | null>(null);
  const [rotateDrag, setRotateDrag] = useState<RotateDrag | null>(null);

  clipsRef.current = clips;
  selectedClipIdRef.current = selectedClipId;
  activeToolRef.current = activeTool;

  const projectDuration = useMemo(() => getTimelineDuration(clips), [clips]);
  const videoPlaybackDuration = useMemo(
    () => getVideoPlaybackDuration(clips),
    [clips],
  );
  const mainVideoLayerEnd = useMemo(() => getVideoLayerEnd(clips, 0), [clips]);
  const draggedMediaItems =
    pointerDrag?.type === "media"
      ? mediaItems.filter((item) =>
          (pointerDrag.mediaIds ?? [pointerDrag.id]).includes(item.id),
        )
      : [];
  const draggedMediaItem = draggedMediaItems[0] ?? null;
  const draggedMediaDuration = draggedMediaItems.reduce(
    (total, item) => total + item.durationInFrames,
    0,
  );
  const draggedTimelineClip =
    pointerDrag?.type === "timeline"
      ? clips.find((clip) => clip.id === pointerDrag.id)
      : null;
  const isVideoPointerDrag = Boolean(
    pointerDrag?.activated &&
      (draggedMediaItem ||
        (draggedTimelineClip && getVideoLayer(draggedTimelineClip) !== null)),
  );
  const mainAppendTargetWidth = draggedMediaItem
    ? Math.max(
        96,
        Math.min(draggedMediaDuration * timelineScale, 360),
      )
    : 0;
  const mainAppendVisibleOverlap = 48;
  const mainAppendTargetLeft = Math.max(
    0,
    mainVideoLayerEnd * timelineScale - mainAppendVisibleOverlap,
  );
  const dragRunwayWidth = pointerDrag
      ? Math.max(
          960,
          (draggedMediaDuration || (draggedTimelineClip?.duration ?? 0)) *
            timelineScale,
        )
    : 0;
  const timelineCanvasWidth = Math.max(
    projectDuration * timelineScale,
    mainAppendTargetLeft + mainAppendTargetWidth,
    pointerDrag
      ? projectDuration * timelineScale + dragRunwayWidth
      : 0,
  );

  useEffect(() => {
    setPlayheadFrame((currentFrame) =>
      clampPlayheadFrame(currentFrame, projectDuration),
    );
  }, [projectDuration]);

  useEffect(() => {
    const pendingCommit = pendingAutoCutoutCommitRef.current;
    if (!pendingCommit) return;

    pendingAutoCutoutCommitRef.current = null;
    const committedClip = clips.find(
      (clip) => clip.id === pendingCommit.clipId,
    );
    if (committedClip?.src === pendingCommit.processedSrc) {
      setProjectStatus("Background removed");
    }
  }, [clips]);

  const timelineTicks = useMemo(
    () => createTimelineTicks(projectDuration, fps),
    [projectDuration],
  );
  const getPointerTimelineFrame = useCallback((clientX: number) => {
    const bounds = timelineContentRef.current?.getBoundingClientRect();
    if (!bounds) return null;

    return getTimelineFrameFromPointer(
      clientX,
      bounds.left,
      timelineOrigin,
      timelineScale,
    );
  }, []);

  const mainClip = clips.find((clip) => clip.track === "main");
  const mainClipSpeed = mainClip?.speed ?? 1;
  const mainClipVolume = mainClip?.volume ?? 1;
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedCaptionClip =
    selectedClip?.track === "caption" && selectedClip.caption
      ? selectedClip
      : null;
  const selectedCaptionSourceClip =
    selectedClip &&
    (selectedClip.track === "main" || selectedClip.track === "upper") &&
    selectedClip.src
      ? selectedClip
      : null;
  const selectedMainVoiceClip =
    (selectedClip?.track === "main" || selectedClip?.track === "upper") &&
    selectedClip.mediaType !== "image" &&
    selectedClip.src
      ? selectedClip
      : null;
  const canKeepMainVoice = Boolean(selectedMainVoiceClip);

  useEffect(() => {
    autoCaptionSelectionVersionRef.current += 1;
  }, [
    selectedCaptionSourceClip?.id,
    selectedCaptionSourceClip?.src,
    selectedCaptionSourceClip?.sourceStart,
    selectedCaptionSourceClip?.duration,
    selectedCaptionSourceClip?.speed,
  ]);
  const transitionBoundariesByLayer = useMemo(() => {
    const videoLayers = new Set(
      clips
        .map(getVideoLayer)
        .filter((videoLayer): videoLayer is number => videoLayer !== null),
    );
    const boundariesByLayer = new Map<
      number,
      Array<{
        outgoingClipId: string;
        incomingClipId: string;
        frame: number;
        outgoingLabel: string;
        incomingLabel: string;
        maxDuration: number;
        duration: number;
      }>
    >();

    for (const videoLayer of videoLayers) {
      const boundaries = getTimelineTransitionBoundaries(clips, videoLayer)
        .map((boundary) => {
          const outgoingClip = clips.find(
            (clip) => clip.id === boundary.outgoingClipId,
          );
          const incomingClip = clips.find(
            (clip) => clip.id === boundary.incomingClipId,
          );
          if (!outgoingClip || !incomingClip) {
            return null;
          }

          const maxDuration = Math.min(
            outgoingClip.duration,
            incomingClip.duration,
          );

          return {
            ...boundary,
            outgoingLabel: outgoingClip.label,
            incomingLabel: incomingClip.label,
            maxDuration,
            duration: Math.max(
              minimumTransitionDuration,
              Math.min(
                incomingClip.transition?.duration ?? Math.min(12, maxDuration),
                maxDuration,
              ),
            ),
          };
        })
        .filter((boundary) => boundary !== null);

      boundariesByLayer.set(videoLayer, boundaries);
    }

    return boundariesByLayer;
  }, [clips]);
  const contextualAudioSelectionId =
    selectedClip?.track === "audio"
      ? (selectedClip.linkedClipId ?? null)
      : selectedClipId;
  const contextualAudioClips = useMemo(
    () => getContextualAudioClips(clips, contextualAudioSelectionId),
    [clips, contextualAudioSelectionId],
  );
  const contextualAudioClipIds = useMemo(
    () => new Set(contextualAudioClips.map((clip) => clip.id)),
    [contextualAudioClips],
  );
  const selectedVisibilityVideoLayer =
    selectedTrack === "main" || selectedTrack === "upper"
      ? (selectedVideoLayer ??
        (selectedClip ? getVideoLayer(selectedClip) : null))
      : null;
  const selectedVisibilityClipIds =
    selectedTrack === "audio" && contextualAudioClips.length > 0
      ? contextualAudioClips.map((clip) => clip.id)
      : undefined;
  const selectedVisibilityTargets = clips.filter((clip) => {
    if (selectedVisibilityClipIds) {
      return selectedVisibilityClipIds.includes(clip.id);
    }
    if (
      (selectedTrack === "main" || selectedTrack === "upper") &&
      selectedVisibilityVideoLayer !== null
    ) {
      return getVideoLayer(clip) === selectedVisibilityVideoLayer;
    }
    return clip.track === selectedTrack;
  });
  const canToggleSelectedTrackVisibility = selectedVisibilityTargets.length > 0;
  const isSelectedTrackHidden = isTrackHidden(
    clips,
    selectedTrack,
    selectedVisibilityVideoLayer,
    selectedVisibilityClipIds,
  );
  const clipControlTarget = selectedClip;
  const selectedVideoLayerControlState = getVideoLayerControlState(
    clips,
    selectedVideoLayer,
  );
  const { hasSelectedVideoLayer } = selectedVideoLayerControlState;
  const selectedTextClip =
    clipControlTarget?.track === "text" && clipControlTarget.text
      ? clipControlTarget
      : null;
  const selectedTextContent = selectedTextClip?.text?.content ?? null;
  const selectedCutoutClip =
    clipControlTarget?.track === "cutout" && clipControlTarget.cutout
      ? clipControlTarget
      : null;
  const selectedCutoutRequestFingerprint =
    createCutoutRequestSnapshot(selectedCutoutClip)?.serializedClip ?? "";
  const activeCutoutAtPlayhead =
    clips.find(
      (clip) =>
        clip.track === "cutout" &&
        Boolean(clip.cutout) &&
        !clip.hidden &&
        playheadFrame >= clip.start &&
        playheadFrame < clip.start + clip.duration,
    ) ?? null;
  const selectedCutoutCanSplit = Boolean(
    selectedCutoutClip &&
    playheadFrame > selectedCutoutClip.start &&
    playheadFrame < selectedCutoutClip.start + selectedCutoutClip.duration,
  );
  const splitCutoutTarget = selectedCutoutCanSplit
    ? selectedCutoutClip
    : (activeCutoutAtPlayhead ?? selectedCutoutClip);
  const canSplitSelectedCutout = Boolean(
    splitCutoutTarget &&
    playheadFrame > splitCutoutTarget.start &&
    playheadFrame < splitCutoutTarget.start + splitCutoutTarget.duration,
  );
  const canResetSelectedCutout = Boolean(
    selectedCutoutClip &&
    ((selectedCutoutClip.cutout?.maskStrokes?.length ?? 0) > 0 ||
      (selectedCutoutClip.cutout?.originalSrc &&
        selectedCutoutClip.src !== selectedCutoutClip.cutout.originalSrc)),
  );
  const selectedTextStyle = {
    fontSize: selectedTextClip?.text?.fontSize ?? 42,
    color: selectedTextClip?.text?.color ?? "#ffffff",
    fontFamily: selectedTextClip?.text?.fontFamily ?? "Inter",
    fontWeight: selectedTextClip?.text?.fontWeight ?? "900",
    fontStyle: selectedTextClip?.text?.fontStyle ?? "normal",
    effect: selectedTextClip?.text?.effect ?? "none",
    animation: selectedTextClip?.text?.animation ?? "none",
    rotation: selectedTextClip?.text?.rotation ?? 0,
  };
  const selectedCaptionStyle: CaptionStyle = {
    ...defaultCaptionStyle,
    ...selectedCaptionClip?.caption,
  };
  const selectedClipSpeed =
    clipControlTarget?.speed ?? selectedVideoLayerControlState.speed;
  const selectedClipVolume =
    clipControlTarget?.volume ?? selectedVideoLayerControlState.volume;
  const selectedClipEffect = clipControlTarget?.visual?.effect ?? "none";
  const selectedClipFilter = clipControlTarget?.visual?.filter ?? "none";
  const selectedEffectIntensity =
    selectedClipEffect === "none"
      ? 0
      : (clipControlTarget?.visual?.effectIntensity ?? 100);
  const selectedFilterIntensity =
    selectedClipFilter === "none"
      ? 0
      : (clipControlTarget?.visual?.filterIntensity ?? 100);
  const selectedClipAnimation = clipControlTarget?.animation ?? {
    preset: "none" as ClipAnimationPreset,
    timing: "start" as ClipAnimationTiming,
    duration: 30,
    easing: "smooth" as ClipAnimationEasing,
  };
  const selectedClipAdjustment = {
    ...defaultClipAdjustment,
    ...clipControlTarget?.adjustment,
  };
  const rotateHandleLeft =
    selectedClipAdjustment.cropLeft +
    (100 - selectedClipAdjustment.cropLeft - selectedClipAdjustment.cropRight) /
      2;
  const rotateHandleTop = getVisibleRotateHandleTop(
    selectedClipAdjustment.cropTop,
  );
  const canEditSelectedSpeed =
    hasSelectedVideoLayer ||
    clipControlTarget?.track === "main" ||
    clipControlTarget?.track === "upper" ||
    clipControlTarget?.track === "cutout" ||
    clipControlTarget?.track === "audio";
  const canEditSelectedVisual =
    clipControlTarget?.track === "main" ||
    clipControlTarget?.track === "upper" ||
    clipControlTarget?.track === "cutout";
  const canEditSelectedVolume =
    hasSelectedVideoLayer ||
    Boolean(
      clipControlTarget &&
      clipControlTarget.track !== "sticker" &&
      clipControlTarget.cutout?.mediaKind !== "image",
    );
  const layerControlLabel =
    selectedVideoLayer === 0
      ? "Main track"
      : selectedVideoLayer === null
        ? ""
        : `Video layer ${selectedVideoLayer > 0 ? "+" : ""}${selectedVideoLayer}`;
  const clipControlHeading =
    activeTool === "audio"
      ? "Audio controls"
      : activeTool === "animations"
        ? "Animation controls"
        : activeTool === "effects"
          ? "Effect controls"
          : activeTool === "filters"
            ? "Filter controls"
            : "Clip controls";
  const selectedMedia = mediaItems.find((item) => item.id === selectedMediaId);
  const selectedMediaType = selectedMedia
    ? getMediaItemType(selectedMedia)
    : null;
  const isSelectedMediaScene =
    selectedMediaType === "video" &&
    Boolean(
      isDetectedSceneMediaItem(selectedMedia) ||
        (selectedMedia &&
          ((selectedMedia.sourceStart ?? 0) > 0 ||
            (selectedMedia.sourceDurationInFrames ??
              selectedMedia.durationInFrames) > selectedMedia.durationInFrames)),
    );
  const mediaTrimItem = mediaTrimDraft
    ? mediaItems.find((item) => item.id === mediaTrimDraft.mediaId) ?? null
    : null;
  const mediaPreviewStartSeconds = (selectedMedia?.sourceStart ?? 0) / fps;
  const mediaPreviewEndSeconds =
    mediaPreviewStartSeconds + (selectedMedia?.durationInFrames ?? 0) / fps;
  const mediaPreviewSceneDurationSeconds =
    (selectedMedia?.durationInFrames ?? 0) / fps;
  const hasValidStoredMediaDuration =
    Number.isFinite(mediaPreviewSceneDurationSeconds) &&
    mediaPreviewSceneDurationSeconds > 0;
  const mediaPreviewSeekMinSeconds = isSelectedMediaScene
    ? mediaPreviewStartSeconds
    : 0;
  const hasValidMediaPreviewDuration =
    Number.isFinite(mediaPreviewDuration) && mediaPreviewDuration > 0;
  const hasValidMediaPreviewSceneRange =
    Number.isFinite(mediaPreviewStartSeconds) &&
    Number.isFinite(mediaPreviewEndSeconds) &&
    mediaPreviewEndSeconds > mediaPreviewStartSeconds;
  const isMediaPreviewSeekEnabled = isSelectedMediaScene
    ? hasValidMediaPreviewSceneRange
    : hasValidMediaPreviewDuration || hasValidStoredMediaDuration;
  const mediaPreviewSeekMaxSeconds = isSelectedMediaScene
    ? hasValidMediaPreviewSceneRange
      ? mediaPreviewEndSeconds
      : mediaPreviewSeekMinSeconds
    : hasValidMediaPreviewDuration
      ? mediaPreviewDuration
      : hasValidStoredMediaDuration
        ? mediaPreviewSceneDurationSeconds
        : mediaPreviewSeekMinSeconds;
  const mediaPreviewDisplayTime = isSelectedMediaScene
    ? Math.max(
        0,
        Math.min(
          mediaPreviewSceneDurationSeconds,
          mediaPreviewTime - mediaPreviewStartSeconds,
        ),
      )
    : mediaPreviewTime;
  const mediaPreviewDisplayDuration = isSelectedMediaScene
    ? mediaPreviewSceneDurationSeconds
    : hasValidMediaPreviewDuration
      ? mediaPreviewDuration
      : mediaPreviewSceneDurationSeconds;
  const getMediaPreviewFrame = (currentTime: number) =>
    Math.max(
      0,
      Math.min(
        selectedMedia?.durationInFrames ?? 0,
        Math.round((currentTime - mediaPreviewStartSeconds) * fps),
      ),
    );
  const compareTimelinePreviewVideoClips = (
    firstClip: TimelineClip,
    secondClip: TimelineClip,
  ) =>
    (getVideoLayer(firstClip) ?? 0) - (getVideoLayer(secondClip) ?? 0) ||
    firstClip.start - secondClip.start ||
    firstClip.id.localeCompare(secondClip.id);
  const activeVideoLayers = getActiveVideoLayersAtFrame(clips, playheadFrame);
  const activeVideoClipIds = new Set(activeVideoLayers.map((clip) => clip.id));
  const timelinePreviewVideoClips = clips
    .filter((clip) => {
      if (
        (clip.track !== "main" && clip.track !== "upper") ||
        !clip.src ||
        clip.hidden ||
        isImageClip(clip)
      ) {
        return false;
      }

      const transitionPresentation = getClipTransitionPresentation(
        clips,
        clip.id,
        playheadFrame,
      );
      const participatesInTransition =
        transitionPresentation.opacity !== 1 ||
        transitionPresentation.translateX !== 0 ||
        transitionPresentation.scale !== 1;
      const isNearPlayhead =
        clip.start <= playheadFrame + fps * 5 &&
        clip.start + clip.duration >= playheadFrame - fps;

      return (
        activeVideoClipIds.has(clip.id) ||
        participatesInTransition ||
        isNearPlayhead
      );
    })
    .sort(compareTimelinePreviewVideoClips);
  const previewVideoLayers = Array.from(
    new Set(
      clips
        .filter(
          (clip) =>
            (clip.track === "main" || clip.track === "upper") &&
            clip.src &&
            !clip.hidden,
        )
        .map(getVideoLayer)
        .filter((videoLayer): videoLayer is number => videoLayer !== null),
    ),
  ).sort((firstLayer, secondLayer) => firstLayer - secondLayer);
  const getPreviewVideoLayerZIndex = (clip: TimelineClip) => {
    const videoLayer = getVideoLayer(clip);
    return videoLayer === null ? 0 : previewVideoLayers.indexOf(videoLayer) + 1;
  };
  const topVisibleVideoClip = activeVideoLayers[activeVideoLayers.length - 1];
  const activeStickerClips = getActiveClipsAtFrame(
    clips,
    "sticker",
    playheadFrame,
  ).filter((clip) => clip.src);
  const activeCutoutClips = getActiveClipsAtFrame(
    clips,
    "cutout",
    playheadFrame,
  ).filter((clip) => clip.src && clip.cutout);
  const activeTextClips = getActiveClipsAtFrame(
    clips,
    "text",
    playheadFrame,
  ).filter((clip) => clip.text);
  const activeCaptionClips = getActiveClipsAtFrame(
    clips,
    "caption",
    playheadFrame,
  ).filter((clip) => clip.caption);
  const transcriptClips = useMemo(
    () =>
      clips
        .filter(
          (clip) =>
            clip.track === "caption" &&
            clip.caption?.generationId?.startsWith("transcript-"),
        )
        .sort((a, b) => a.start - b.start),
    [clips],
  );
  const playbackAudioClips = useMemo(
    () => [
      ...getPlaybackAudioClips(clips, playheadFrame),
      ...getIndependentPlaybackAudioClips(clips, playheadFrame),
    ],
    [clips, playheadFrame],
  );
  const timelineRows = useMemo<TimelineRow[]>(() => {
    const secondaryVideoLayers = Array.from(
      new Set(
        clips
          .map(getVideoLayer)
          .filter((layer): layer is number => layer !== null && layer !== 0),
      ),
    );
    const upperLayers = secondaryVideoLayers
      .filter((layer) => layer > 0)
      .sort((a, b) => b - a);
    const lowerLayers = secondaryVideoLayers
      .filter((layer) => layer < 0)
      .sort((a, b) => b - a);

    const rows: TimelineRow[] = [
      ...upperLayers.map((videoLayer) => ({
        key: `video-${videoLayer}`,
        id: "upper" as TrackName,
        label: "",
        videoLayer,
        order:
          clips.find((clip) => getVideoLayer(clip) === videoLayer)
            ?.timelineRowOrder ??
          100 + videoLayer,
      })),
      ...(hasClipsOnTrack(clips, "sticker")
        ? [
            {
              key: "sticker",
              id: "sticker" as TrackName,
              label: "Sticker track",
              order: 80,
            },
          ]
        : []),
      ...(hasClipsOnTrack(clips, "cutout")
        ? [
            {
              key: "cutout",
              id: "cutout" as TrackName,
              label: "Cutout track",
              order: 70,
            },
          ]
        : []),
      ...(hasClipsOnTrack(clips, "text")
        ? [
            {
              key: "text",
              id: "text" as TrackName,
              label: "Text track",
              order: 60,
            },
          ]
        : []),
      ...(hasClipsOnTrack(clips, "caption")
        ? [
            {
              key: "caption",
              id: "caption" as TrackName,
              label: "Caption track",
              order: 50,
            },
          ]
        : []),
      {
        key: "main",
        id: "main" as TrackName,
        label: "Main track",
        videoLayer: 0,
        order: 0,
      },
      ...lowerLayers.map((videoLayer) => ({
        key: `video-${videoLayer}`,
        id: "upper" as TrackName,
        label: "",
        videoLayer,
        order:
          clips.find((clip) => getVideoLayer(clip) === videoLayer)
            ?.timelineRowOrder ??
          -10 + videoLayer,
      })),
      ...(clips.some(isImportedAudioClip)
        ? [
            {
              key: "imported-audio",
              id: "audio" as TrackName,
              label: "Imported audio",
              audioKind: "imported" as const,
              order: -90,
            },
          ]
        : []),
      ...(clips.some(isVoiceoverClip) || isRecording
        ? [
            {
              key: "voiceover",
              id: "audio" as TrackName,
              label: "Voiceover track",
              audioKind: "voiceover" as const,
              order: -100,
            },
          ]
        : []),
    ];

    return rows.sort((left, right) => right.order - left.order);
  }, [clips, isRecording]);
  const previewSource =
    previewMode === "timeline"
      ? topVisibleVideoClip
      : selectedMedia
        ? {
            id: selectedMedia.id,
            label: selectedMedia.label,
            src: selectedMedia.src,
            mediaType: getMediaItemType(selectedMedia),
            start: 0,
            speed: mainClipSpeed,
            volume: mainClipVolume,
          }
        : undefined;
  const isTimelinePreview = previewMode === "timeline";
  const isCanvasPreviewPlaying =
    previewMode === "media" ? isMediaPreviewPlaying : isPreviewPlaying;
  const previewSpeed =
    previewMode === "timeline"
      ? (topVisibleVideoClip?.speed ?? 1)
      : mainClipSpeed;
  const previewVolume =
    previewMode === "timeline"
      ? (topVisibleVideoClip?.volume ?? 1)
      : mainClipVolume;
  const previewVideoMuted =
    previewVolume === 0 ||
    (previewMode === "timeline" &&
      shouldMuteVideoNativeAudio(
        clips,
        playheadFrame,
        topVisibleVideoClip?.id ?? null,
      ));
  useEffect(() => {
    mediaPreviewVolumeDragRef.current = false;
    setIsMediaPreviewVolumeAdjusting(false);
    setIsMediaPreviewVolumeOpen(false);
  }, [previewMode, selectedMediaId]);

  useEffect(() => {
    if (activeTool !== "captions" || !selectedCaptionClip?.caption) {
      return;
    }
    setCaptionDraft(selectedCaptionClip.caption.content);
    setCaptionStyle({
      ...defaultCaptionStyle,
      ...selectedCaptionClip.caption,
      fontSize: selectedCaptionClip.caption.fontSize,
      textColor: selectedCaptionClip.caption.textColor,
      backgroundEnabled: selectedCaptionClip.caption.backgroundEnabled,
      backgroundColor: selectedCaptionClip.caption.backgroundColor,
    });
  }, [activeTool, selectedCaptionClip]);

  useEffect(() => {
    if (activeTool !== "text" || selectedTextContent === null) {
      return;
    }
    setTextDraft(selectedTextContent);
  }, [activeTool, selectedTextClip?.id, selectedTextContent]);

  useEffect(() => {
    persistStoredStringList(
      favoriteAnimationsStorageKey,
      favoriteAnimationIds,
    );
  }, [favoriteAnimationIds]);

  useEffect(() => {
    persistStoredStringList(recentAnimationsStorageKey, recentAnimationIds);
  }, [recentAnimationIds]);

  useEffect(() => {
    if (!animationQuickMenu) {
      return;
    }

    const closeQuickMenu = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        animationQuickMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setAnimationQuickMenu(null);
    };
    const closeQuickMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAnimationQuickMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeQuickMenu);
    window.addEventListener("keydown", closeQuickMenuWithEscape);
    return () => {
      window.removeEventListener("pointerdown", closeQuickMenu);
      window.removeEventListener("keydown", closeQuickMenuWithEscape);
    };
  }, [animationQuickMenu]);

  const commitClipChange = useCallback(
    (updater: (currentClips: TimelineClip[]) => TimelineClip[]) => {
      setTimelineHistory((currentHistory) =>
        applyTimelineHistoryEdit(
          currentHistory,
          updater(currentHistory.present),
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (
        event.key !== "Delete" ||
        event.repeat ||
        event.defaultPrevented ||
        !selectedClipIdRef.current
      ) {
        return;
      }

      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditing || document.querySelector("dialog[open]")) {
        return;
      }

      event.preventDefault();
      const clipId = selectedClipIdRef.current;
      commitClipChange((currentClips) => deleteClipById(currentClips, clipId));
      setSelectedClipId(null);
      setSelectedVideoLayer(null);
      setProjectStatus("Selected clip deleted");
    };

    window.addEventListener("keydown", handleDeleteShortcut);
    return () => window.removeEventListener("keydown", handleDeleteShortcut);
  }, [commitClipChange]);

  const undoLastClipChange = () => {
    setTimelineHistory(undoTimelineHistory);
  };

  const redoLastClipChange = () => {
    setTimelineHistory(redoTimelineHistory);
  };

  const resetCaptionStatus = () => {
    if (captionStatus.kind !== "idle") {
      setCaptionStatus({ kind: "idle", message: "" });
    }
  };

  const abortAutoCaptionRequest = useCallback(() => {
    autoCaptionAbortControllerRef.current?.abort();
    autoCaptionAbortControllerRef.current = null;
    autoCaptionRequestRef.current = null;
    setIsAutoCaptionLoading(false);
  }, []);

  const abortKeepMainVoiceRequest = useCallback(() => {
    keepMainVoiceAbortControllerRef.current?.abort();
    keepMainVoiceAbortControllerRef.current = null;
    keepMainVoiceRequestRef.current = null;
    setIsKeepMainVoiceLoading(false);
    setCaptionStatus({ kind: "idle", message: "" });
  }, []);

  useEffect(() => {
    abortAutoCaptionRequest();
  }, [
    selectedCaptionSourceClip?.id,
    selectedCaptionSourceClip?.src,
    selectedCaptionSourceClip?.sourceStart,
    selectedCaptionSourceClip?.duration,
    selectedCaptionSourceClip?.speed,
    abortAutoCaptionRequest,
  ]);

  useEffect(() => {
    abortKeepMainVoiceRequest();
  }, [
    abortKeepMainVoiceRequest,
    canKeepMainVoice,
    selectedMainVoiceClip?.duration,
    selectedMainVoiceClip?.id,
    selectedMainVoiceClip?.linkedClipId,
    selectedMainVoiceClip?.sourceStart,
    selectedMainVoiceClip?.speed,
    selectedMainVoiceClip?.src,
  ]);

  useEffect(() => {
    return () => abortAutoCaptionRequest();
  }, [abortAutoCaptionRequest]);

  const abortAutoCutoutRequest = useCallback(() => {
    autoCutoutAbortControllerRef.current?.abort();
    autoCutoutAbortControllerRef.current = null;
    autoCutoutRequestRef.current = null;
    setIsAutoCutoutLoading(false);
    setProjectStatus((currentStatus) =>
      currentStatus === "Removing background..." ? "" : currentStatus,
    );
  }, []);

  useEffect(() => {
    abortAutoCutoutRequest();
  }, [selectedCutoutRequestFingerprint, activeTool, abortAutoCutoutRequest]);

  useEffect(() => {
    return () => abortAutoCutoutRequest();
  }, [abortAutoCutoutRequest]);

  const openCaptionMode = (mode: Exclude<CaptionPanelMode, "actions">) => {
    abortAutoCaptionRequest();
    setCaptionMode(mode);
    resetCaptionStatus();
  };

  const goBackToCaptionActions = () => {
    setCaptionMode("actions");
    abortAutoCaptionRequest();
    resetCaptionStatus();
  };

  const chooseMedia = (mediaItem: MediaItem, additive = false) => {
    previewVideoRef.current?.pause();
    const isAlreadySelected = selectedMediaIds.includes(mediaItem.id);
    const nextSelectedIds = additive
      ? isAlreadySelected
        ? selectedMediaIds.filter((id) => id !== mediaItem.id)
        : [...selectedMediaIds, mediaItem.id]
      : [mediaItem.id];
    const nextPrimaryId =
      additive && isAlreadySelected
        ? (nextSelectedIds[nextSelectedIds.length - 1] ?? null)
        : mediaItem.id;
    const nextPrimaryMedia =
      mediaItems.find((item) => item.id === nextPrimaryId) ?? mediaItem;

    setSelectedMediaIds(nextSelectedIds);
    setSelectedMediaId(nextPrimaryId);
    if (isDetectedSceneMediaItem(nextPrimaryMedia)) {
      setMediaPreviewTime((nextPrimaryMedia.sourceStart ?? 0) / fps);
    } else {
      setMediaPreviewTime(0);
    }
    setMediaPreviewDuration(0);
    setMediaPreviewFrame(0);
    setIsPreviewPlaying(false);
    setIsMediaPreviewPlaying(false);
    setPreviewMode("media");
  };

  const openMediaTrimEditor = (mediaItem: MediaItem) => {
    previewVideoRef.current?.pause();
    mediaTrimVideoRef.current?.pause();
    setIsMediaPreviewPlaying(false);
    setIsMediaTrimPreviewPlaying(false);
    setMediaTrimPreviewFrame(0);
    setMediaTrimDraft({
      mediaId: mediaItem.id,
      startFrame: 0,
      endFrame: Math.max(1, mediaItem.durationInFrames),
      adjustment: {
        ...defaultClipAdjustment,
        ...mediaItem.adjustment,
      },
    });
    window.requestAnimationFrame(() =>
      mediaTrimDialogRef.current?.showModal(),
    );
  };

  const closeMediaTrimEditor = () => {
    mediaTrimVideoRef.current?.pause();
    setIsMediaTrimPreviewPlaying(false);
    setMediaTrimPreviewFrame(0);
    mediaTrimDialogRef.current?.close();
    setMediaTrimDraft(null);
    setMediaTrimCanvasDrag(null);
    setMediaTrimRangeDrag(null);
  };

  const startMediaTrimRangeDrag = (
    event: PointerEvent<HTMLButtonElement>,
    edge: MediaTrimRangeDrag["edge"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const range = event.currentTarget.closest(".media-trim-range-visual");
    const bounds = range?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setMediaTrimRangeDrag({
      edge,
      pointerId: event.pointerId,
      boundsLeft: bounds.left,
      boundsWidth: bounds.width,
    });
  };

  const moveMediaTrimRangeDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !mediaTrimRangeDrag ||
      event.pointerId !== mediaTrimRangeDrag.pointerId ||
      !mediaTrimDraft ||
      !mediaTrimItem
    ) {
      return;
    }

    event.preventDefault();
    const pointerFrame = getMediaTrimFrameFromPointer({
      clientX: event.clientX,
      boundsLeft: mediaTrimRangeDrag.boundsLeft,
      boundsWidth: mediaTrimRangeDrag.boundsWidth,
      durationInFrames: mediaTrimItem.durationInFrames,
    });

    if (mediaTrimRangeDrag.edge === "start") {
      const startFrame = Math.max(
        0,
        Math.min(pointerFrame, mediaTrimDraft.endFrame - 1),
      );
      setMediaTrimDraft((currentDraft) =>
        currentDraft ? {...currentDraft, startFrame} : null,
      );
      previewMediaTrimFrame(mediaTrimItem, startFrame);
      return;
    }

    const endFrame = Math.min(
      mediaTrimItem.durationInFrames,
      Math.max(pointerFrame, mediaTrimDraft.startFrame + 1),
    );
    setMediaTrimDraft((currentDraft) =>
      currentDraft ? {...currentDraft, endFrame} : null,
    );
    previewMediaTrimFrame(mediaTrimItem, Math.max(0, endFrame - 1));
  };

  const updateMediaTrimAdjustment = (
    adjustment: Partial<ClipAdjustment>,
  ) => {
    setMediaTrimDraft((currentDraft) => {
      if (!currentDraft) return null;
      const next = {
        ...currentDraft.adjustment,
        ...adjustment,
      };
      const clamp = (value: number, minimum: number, maximum: number) =>
        Math.max(minimum, Math.min(maximum, value));

      return {
        ...currentDraft,
        adjustment: {
          scale: clamp(next.scale, 0.25, 4),
          rotation: clamp(next.rotation, -180, 180),
          positionX: clamp(next.positionX, -100, 100),
          positionY: clamp(next.positionY, -100, 100),
          cropTop: clamp(next.cropTop, 0, 45),
          cropRight: clamp(next.cropRight, 0, 45),
          cropBottom: clamp(next.cropBottom, 0, 45),
          cropLeft: clamp(next.cropLeft, 0, 45),
        },
      };
    });
  };

  const startMediaTrimCanvasDrag = (
    event: PointerEvent<HTMLElement>,
    mode: MediaTrimCanvasDrag["mode"],
    handle?: CaptionResizeHandle,
  ) => {
    if (!mediaTrimDraft) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const preview = event.currentTarget.closest(".media-trim-preview");
    const bounds = preview?.getBoundingClientRect();
    if (!bounds) return;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    setMediaTrimCanvasDrag({
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      centerX,
      centerY,
      startAngle:
        (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
        Math.PI,
      adjustment: { ...mediaTrimDraft.adjustment },
    });
  };

  const moveMediaTrimCanvasDrag = (event: PointerEvent<HTMLElement>) => {
    if (!mediaTrimCanvasDrag) return;
    event.preventDefault();
    const drag = mediaTrimCanvasDrag;

    if (drag.mode === "rotate") {
      const angle =
        (Math.atan2(
          event.clientY - drag.centerY,
          event.clientX - drag.centerX,
        ) *
          180) /
        Math.PI;
      updateMediaTrimAdjustment({
        rotation: drag.adjustment.rotation + angle - drag.startAngle,
      });
      return;
    }

    const deltaX = ((event.clientX - drag.startX) / drag.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / drag.height) * 100;
    if (drag.mode === "pan") {
      updateMediaTrimAdjustment({
        positionX: drag.adjustment.positionX + deltaX,
        positionY: drag.adjustment.positionY + deltaY,
      });
      return;
    }

    const handle = drag.handle;
    if (!handle) return;
    updateMediaTrimAdjustment({
      ...(handle.includes("left") || handle === "left"
        ? { cropLeft: drag.adjustment.cropLeft + deltaX }
        : {}),
      ...(handle.includes("right") || handle === "right"
        ? { cropRight: drag.adjustment.cropRight - deltaX }
        : {}),
      ...(handle.includes("top") || handle === "top"
        ? { cropTop: drag.adjustment.cropTop + deltaY }
        : {}),
      ...(handle.includes("bottom") || handle === "bottom"
        ? { cropBottom: drag.adjustment.cropBottom - deltaY }
        : {}),
    });
  };

  const previewMediaTrimFrame = (
    mediaItem: MediaItem,
    relativeFrame: number,
  ) => {
    const video = mediaTrimVideoRef.current;
    if (!video) {
      return;
    }
    video.pause();
    const clampedFrame = Math.max(
      0,
      Math.min(relativeFrame, mediaItem.durationInFrames),
    );
    video.currentTime =
      ((mediaItem.sourceStart ?? 0) + clampedFrame) / fps;
    setMediaTrimPreviewFrame(clampedFrame);
    setIsMediaTrimPreviewPlaying(false);
  };

  const toggleMediaTrimPlayback = () => {
    const video = mediaTrimVideoRef.current;
    if (!video || !mediaTrimDraft || !mediaTrimItem) {
      return;
    }

    if (!video.paused) {
      video.pause();
      setIsMediaTrimPreviewPlaying(false);
      return;
    }

    const { startFrame, endFrame } = mediaTrimDraft;
    const shouldRestart =
      mediaTrimPreviewFrame < startFrame ||
      mediaTrimPreviewFrame >= endFrame - 1;
    if (shouldRestart) {
      const sourceStart = mediaTrimItem.sourceStart ?? 0;
      video.currentTime = (sourceStart + startFrame) / fps;
      setMediaTrimPreviewFrame(startFrame);
    }

    void video.play().catch(() => {
      setIsMediaTrimPreviewPlaying(false);
    });
  };

  const applyMediaTrim = () => {
    if (!mediaTrimDraft || !mediaTrimItem) {
      return;
    }

    const startFrame = Math.max(
      0,
      Math.min(mediaTrimDraft.startFrame, mediaTrimItem.durationInFrames - 1),
    );
    const endFrame = Math.max(
      startFrame + 1,
      Math.min(mediaTrimDraft.endFrame, mediaTrimItem.durationInFrames),
    );
    const durationInFrames = endFrame - startFrame;
    const sourceStart = (mediaTrimItem.sourceStart ?? 0) + startFrame;

    setMediaItems((currentItems) =>
      trimMediaItemRange({
        mediaItems: currentItems,
        mediaId: mediaTrimItem.id,
        startFrame,
        endFrame,
      }).map((item) =>
        item.id === mediaTrimItem.id
          ? { ...item, adjustment: { ...mediaTrimDraft.adjustment } }
          : item,
      ),
    );
    setSelectedMediaId(mediaTrimItem.id);
    setSelectedMediaIds([mediaTrimItem.id]);
    setMediaPreviewTime(sourceStart / fps);
    setMediaPreviewDuration(0);
    setMediaPreviewFrame(0);
    setPreviewMode("media");
    setProjectStatus(`Video trimmed to ${formatMediaDuration(durationInFrames)}`);
    closeMediaTrimEditor();
  };

  const resetMediaTrimToOriginal = () => {
    if (!mediaTrimItem) return;

    const restoredItems = resetMediaItemEdits({
      mediaItems,
      mediaId: mediaTrimItem.id,
    });
    const restoredItem =
      restoredItems.find((item) => item.id === mediaTrimItem.id) ??
      mediaTrimItem;

    setMediaItems(restoredItems);
    setSelectedMediaId(restoredItem.id);
    setSelectedMediaIds([restoredItem.id]);
    setMediaPreviewTime((restoredItem.sourceStart ?? 0) / fps);
    setMediaPreviewDuration(0);
    setMediaPreviewFrame(0);
    setPreviewMode("media");
    setProjectStatus(`${restoredItem.label} restored to the original video`);
    closeMediaTrimEditor();
  };

  const deleteMediaItem = (mediaId: string) => {
    const result = removeUnusedMediaItem({
      mediaItems,
      selectedMediaId,
      mediaId,
    });

    setMediaItems(result.mediaItems);
    setSelectedMediaId(result.selectedMediaId);
    setSelectedMediaIds((currentIds) => {
      const remainingIds = currentIds.filter((id) => id !== mediaId);
      if (remainingIds.length > 0) return remainingIds;
      return result.selectedMediaId ? [result.selectedMediaId] : [];
    });
    setProjectStatus(result.message);
  };

  const openVisualTool = (
    tool: "animations" | "effects" | "filters" | "adjustment",
  ) => {
    const targetClipId = getVisualToolTargetClipId(
      clips,
      selectedClipId,
      playheadFrame,
    );
    const targetClip = clips.find((clip) => clip.id === targetClipId);

    setSelectedClipId(targetClipId);
    if (targetClip) {
      setSelectedVideoLayer(null);
      setSelectedTrack(targetClip.track);
      setPreviewMode("timeline");
    }
    setActiveTool(tool);
  };

  const startVideoLayerControlDrag = (property: "speed" | "volume") => {
    if (clipControlTarget || selectedVideoLayer === null) return;

    videoLayerControlDragRef.current = startVideoLayerControlHistoryGesture(
      clipsRef.current,
      selectedVideoLayer,
      property,
    );
  };

  const previewVideoLayerControlDrag = (value: number) => {
    const drag = videoLayerControlDragRef.current;
    if (!drag) return false;

    setTimelineHistory((currentHistory) => ({
      ...currentHistory,
      present: previewVideoLayerControlHistoryGesture(drag, value),
    }));
    return true;
  };

  const finishVideoLayerControlDrag = () => {
    const drag = videoLayerControlDragRef.current;
    if (!drag) return;

    setTimelineHistory((currentHistory) =>
      finishVideoLayerControlHistoryGesture(currentHistory, drag),
    );
    videoLayerControlDragRef.current = null;
  };

  const updateSelectedClipSpeed = (speed: number) => {
    if (previewVideoLayerControlDrag(speed)) return;

    commitClipChange((currentClips) =>
      clipControlTarget
        ? setClipSpeedById(currentClips, clipControlTarget.id, speed)
        : selectedVideoLayer !== null
          ? setVideoLayerSpeed(currentClips, selectedVideoLayer, speed)
          : currentClips,
    );
  };

  const updateSelectedClipVolume = (volume: number) => {
    if (previewVideoLayerControlDrag(volume)) return;

    commitClipChange((currentClips) =>
      clipControlTarget
        ? setClipVolumeById(currentClips, clipControlTarget.id, volume)
        : selectedVideoLayer !== null
          ? setVideoLayerVolume(currentClips, selectedVideoLayer, volume)
          : currentClips,
    );
  };

  const updateSelectedTextStyle = (
    style: Parameters<typeof setTextStyleById>[2],
  ) => {
    commitClipChange((currentClips) =>
      setTextStyleById(currentClips, selectedTextClip?.id ?? null, style),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedCaptionStyle = (style: Partial<CaptionStyle>) => {
    commitClipChange((currentClips) =>
      setCaptionStyleById(currentClips, selectedCaptionClip?.id ?? null, style),
    );
    setCaptionStyle((currentStyle) => ({ ...currentStyle, ...style }));
    setPreviewMode("timeline");
  };

  const updateSelectedCaptionContent = (content: string) => {
    if (!selectedCaptionClip?.caption) return;
    setCaptionDraft(content);
    commitClipChange((currentClips) =>
      currentClips.map((clip) =>
        clip.id === selectedCaptionClip.id && clip.caption
          ? { ...clip, label: content, caption: { ...clip.caption, content } }
          : clip,
      ),
    );
    setPreviewMode("timeline");
  };

  const commitSelectedCaptionContent = () => {
    if (!selectedCaptionClip?.caption) return;

    const content = captionDraft.trim();
    if (!content) return;

    updateSelectedCaptionContent(content);
    setCaptionDraft(content);
  };

  const updateSelectedTextRotation = (rotation: number) => {
    commitClipChange((currentClips) =>
      setTextRotationById(currentClips, selectedTextClip?.id ?? null, rotation),
    );
    setPreviewMode("timeline");
  };

  const getCurrentSavedProject = useCallback(
    () =>
      createSavedEditorProject({
        clips,
        mediaItems,
        selectedMediaId,
        nextSourceGroupIndex,
      }),
    [clips, mediaItems, nextSourceGroupIndex, selectedMediaId],
  );

  const saveProjectToStorage = useCallback(() => {
    try {
      const nextProject = getCurrentSavedProject();
      const serializedProject = JSON.stringify(nextProject, null, 2);
      persistProjectToStorage(nextProject);
      downloadBrowserFile(
        new Blob([serializedProject], { type: "application/json" }),
        `video-editor-project-${Date.now()}.json`,
      );
      setProjectStatus("Project saved and downloaded");
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : "Save failed.",
      );
    }
  }, [getCurrentSavedProject]);

  useEffect(() => {
    const autosave = createTrailingAutosaveScheduler(
      () => persistProjectToStorage(getCurrentSavedProject()),
      {
        schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
        cancel: (timerId) => window.clearTimeout(timerId),
      },
    );
    autosave.schedule();

    return autosave.cancel;
  }, [getCurrentSavedProject]);

  useEffect(() => {
    if (previewMode !== "media" || !isSelectedMediaScene) {
      return;
    }

    const video = previewVideoRef.current;
    if (!video) {
      return;
    }

    const seekToMediaPreviewStart = () => {
      video.currentTime = mediaPreviewStartSeconds;
      setMediaPreviewTime(mediaPreviewStartSeconds);
      setMediaPreviewFrame(0);
    };

    if (video.readyState >= 1) {
      seekToMediaPreviewStart();
      return;
    }

    video.addEventListener("loadedmetadata", seekToMediaPreviewStart);
    return () => {
      video.removeEventListener("loadedmetadata", seekToMediaPreviewStart);
    };
  }, [
    isSelectedMediaScene,
    mediaPreviewStartSeconds,
    previewMode,
    selectedMediaId,
  ]);

  const exportProjectVideo = useCallback(async () => {
    if (isExporting) {
      return;
    }

    const nextProject = getCurrentSavedProject();
    persistProjectToStorage(nextProject);

    if (
      nextProject.clips.some((clip) => isBrowserOnlySource(clip.src)) ||
      nextProject.mediaItems.some((mediaItem) =>
        isBrowserOnlySource(mediaItem.src),
      )
    ) {
      setProjectStatus(
        "Please import old browser-only clips again before exporting.",
      );
      return;
    }

    setIsExporting(true);
    setProjectStatus("Rendering video... this can take a few minutes");

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: nextProject }),
      });

      if (!response.ok) {
        const responseBody = await response.text();
        let message = responseBody;
        try {
          const parsed = JSON.parse(responseBody) as {
            error?: { message?: string };
          };
          message = parsed.error?.message ?? responseBody;
        } catch {
          // Keep the server's plain-text response.
        }
        throw new Error(message || "Export failed.");
      }

      const blob = await response.blob();
      downloadBrowserFile(blob, `video-editor-export-${Date.now()}.mp4`);
      setProjectStatus("Video exported");
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Export failed: ${error.message}`
          : "Export failed. Start the API with npm.cmd run web.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [getCurrentSavedProject, isExporting]);

  const updateSelectedClipEffect = (effect: ClipEffect) => {
    commitClipChange((currentClips) =>
      setClipEffectById(currentClips, clipControlTarget?.id ?? null, effect),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedClipFilter = (filter: ClipFilter) => {
    commitClipChange((currentClips) =>
      setClipFilterById(currentClips, clipControlTarget?.id ?? null, filter),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedEffectIntensity = (intensity: number) => {
    commitClipChange((currentClips) =>
      setClipEffectIntensityById(
        currentClips,
        clipControlTarget?.id ?? null,
        intensity,
      ),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedFilterIntensity = (intensity: number) => {
    commitClipChange((currentClips) =>
      setClipFilterIntensityById(
        currentClips,
        clipControlTarget?.id ?? null,
        intensity,
      ),
    );
    setPreviewMode("timeline");
  };

  const rememberAnimation = (preset: ClipAnimationPreset) => {
    if (preset === "none") {
      return;
    }
    setRecentAnimationIds((currentIds) =>
      [preset, ...currentIds.filter((id) => id !== preset)].slice(
        0,
        maximumRecentAnimations,
      ),
    );
  };

  const applyAnimationToClip = (
    clipId: string | null,
    preset: ClipAnimationPreset,
  ) => {
    if (!clipId) {
      return;
    }
    commitClipChange((currentClips) =>
      setClipAnimationById(currentClips, clipId, preset),
    );
    rememberAnimation(preset);
    setPreviewMode("timeline");
    const targetClip = clips.find((clip) => clip.id === clipId);
    if (targetClip) {
      setPlayheadFrame(getClipAnimationPreviewFrame(targetClip, preset));
      setIsPreviewPlaying(preset !== "none");
    }
    setAnimationQuickMenu(null);
  };

  const updateSelectedClipAnimation = (preset: ClipAnimationPreset) => {
    applyAnimationToClip(clipControlTarget?.id ?? null, preset);
  };

  const toggleFavoriteAnimation = (preset: ClipAnimationPreset) => {
    if (preset === "none") {
      return;
    }
    setFavoriteAnimationIds((currentIds) =>
      currentIds.includes(preset)
        ? currentIds.filter((id) => id !== preset)
        : [...currentIds, preset],
    );
  };

  const updateSelectedAnimationTiming = (timing: ClipAnimationTiming) => {
    commitClipChange((currentClips) =>
      setClipAnimationTimingById(
        currentClips,
        clipControlTarget?.id ?? null,
        timing,
      ),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedAnimationDuration = (duration: number) => {
    commitClipChange((currentClips) =>
      setClipAnimationDurationById(
        currentClips,
        clipControlTarget?.id ?? null,
        duration,
      ),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedAnimationEasing = (easing: ClipAnimationEasing) => {
    commitClipChange((currentClips) =>
      setClipAnimationEasingById(
        currentClips,
        clipControlTarget?.id ?? null,
        easing,
      ),
    );
    setPreviewMode("timeline");
  };

  const updateSelectedClipAdjustment = (
    adjustment: Partial<ClipAdjustment>,
  ) => {
    commitClipChange((currentClips) =>
      setClipAdjustmentById(
        currentClips,
        clipControlTarget?.id ?? null,
        adjustment,
      ),
    );
    setPreviewMode("timeline");
  };

  const startManualCrop = (
    event: PointerEvent<HTMLButtonElement>,
    edge: CropEdge,
  ) => {
    if (!clipControlTarget || !canEditSelectedVisual) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCropDrag({
      clipId: clipControlTarget.id,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      originalAdjustment: {
        ...defaultClipAdjustment,
        ...clipControlTarget.adjustment,
      },
    });
  };

  const startManualAdjustmentPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!clipControlTarget || !canEditSelectedVisual) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setAdjustmentPanDrag({
      clipId: clipControlTarget.id,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      originalAdjustment: {
        ...defaultClipAdjustment,
        ...clipControlTarget.adjustment,
      },
    });
  };

  const startManualRotate = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipControlTarget || !canEditSelectedVisual) return;

    const bounds = previewWindowRef.current?.getBoundingClientRect();
    if (!bounds) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRotateDrag({
      clipId: clipControlTarget.id,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      rotationOffset:
        selectedClipAdjustment.rotation -
        getManualRotationAngle(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
          event.clientX,
          event.clientY,
          0,
        ),
      originalClips: clips,
    });
  };

  const splitSelectedTrackClip = () => {
    const targetClip = selectedClipId
      ? clips.find((clip) => clip.id === selectedClipId)
      : clips.find(
          (clip) =>
            clip.track === selectedTrack &&
            playheadFrame > clip.start &&
            playheadFrame < clip.start + clip.duration,
        );

    if (!targetClip) {
      setProjectStatus("Select a clip and move the red playhead inside it");
      return;
    }

    const nextClips = splitClipByIdAtFrame(clips, targetClip.id, playheadFrame);
    if (nextClips === clips) {
      setProjectStatus("Move the red playhead inside the selected clip");
      return;
    }

    commitClipChange(() => nextClips);
    setSelectedClipId(`${targetClip.id}-b`);
    setSelectedTrack(targetClip.track);
    setProjectStatus("Clip split at the red playhead");
  };

  const splitSelectedCutoutAtPlayhead = () => {
    if (isAutoCutoutLoading) return;
    if (!splitCutoutTarget) return;
    if (!canSplitSelectedCutout) {
      setProjectStatus(
        "Move the red playhead inside the cutout before splitting",
      );
      return;
    }
    const nextClips = splitClipByIdAtFrame(
      clips,
      splitCutoutTarget.id,
      playheadFrame,
    );
    if (nextClips === clips) return;

    commitClipChange(() => nextClips);
    setSelectedClipId(`${splitCutoutTarget.id}-b`);
    setSelectedTrack("cutout");
    setCutoutBrushMode("move");
    setProjectStatus("Cutout split at the red playhead");
  };

  const deleteSelectedClip = () => {
    commitClipChange((currentClips) =>
      deleteClipById(currentClips, selectedClipId),
    );
    setSelectedClipId(null);
  };

  const duplicateSelectedClip = () => {
    if (!selectedClipId) return;

    const duplicatePrefix = `duplicate-${Date.now()}`;
    const sourceClip = clips.find((clip) => clip.id === selectedClipId);
    commitClipChange((currentClips) =>
      duplicateClipById(currentClips, selectedClipId, duplicatePrefix),
    );
    setSelectedClipId(
      sourceClip?.track === "audio" && sourceClip.linkedClipId
        ? `${duplicatePrefix}-video`
        : `${duplicatePrefix}-video`,
    );
    setSelectedTrack("upper");
    setPreviewMode("timeline");
    setIsAudioTrackVisible(
      sourceClip?.track === "audio" || Boolean(sourceClip?.linkedClipId),
    );
  };

  const toggleClipMute = (clipId: string) => {
    commitClipChange((currentClips) =>
      toggleClipMuteById(currentClips, clipId),
    );
    setPreviewMode("timeline");
  };

  const toggleSelectedTrackVisibility = () => {
    if (!canToggleSelectedTrackVisibility) {
      return;
    }

    commitClipChange((currentClips) =>
      toggleTrackVisibility(
        currentClips,
        selectedTrack,
        selectedVisibilityVideoLayer,
        selectedVisibilityClipIds,
      ),
    );
    if (
      selectedTrack === "main" ||
      selectedTrack === "upper" ||
      selectedTrack === "cutout"
    ) {
      setIsAudioTrackVisible(true);
    }
    setPreviewMode("timeline");
  };

  const selectTransitionBoundary = useCallback(
    (incomingClipId: string, track: TrackName) => {
      setSelectedVideoLayer(null);
      setSelectedClipId(incomingClipId);
      setSelectedTrack(track);
      setIsAudioTrackVisible(false);
      setActiveTool("animations");
      setPreviewMode("timeline");
    },
    [],
  );

  const selectTimelineClip = (clip: TimelineClip, pointerFrame?: number) => {
    setSelectedVideoLayer(null);
    setSelectedClipId(clip.id);
    setSelectedTrack(clip.track);
    setPreviewMode("timeline");
    if (pointerFrame !== undefined && clip.track !== "audio") {
      setPlayheadFrame(
        Math.max(
          clip.start,
          Math.min(
            clip.start + Math.max(0, clip.duration - 1),
            Math.round(pointerFrame),
          ),
        ),
      );
    }
    if (clip.track === "text") {
      setActiveTool("text");
    } else if (clip.track === "caption") {
      setCaptionMode("manual");
      setActiveTool("captions");
    }
    const contextualSelectionId =
      clip.track === "audio" ? (clip.linkedClipId ?? null) : clip.id;
    setIsAudioTrackVisible(
      getContextualAudioClips(clips, contextualSelectionId).length > 0,
    );
  };

  const selectTrackClipAtFrame = (
    track: TrackName,
    frame: number,
    clipFilter?: (clip: TimelineClip) => boolean,
  ) => {
    setSelectedVideoLayer(null);
    const trackClips = clips.filter(
      (candidate) =>
        candidate.track === track && (!clipFilter || clipFilter(candidate)),
    );
    const clip =
      trackClips.find(
        (candidate) =>
          frame >= candidate.start &&
          frame < candidate.start + candidate.duration,
      ) ?? trackClips[0];

    setSelectedTrack(track);
    setSelectedClipId(clip?.id ?? null);
    const contextualSelectionId =
      clip?.track === "audio"
        ? (clip.linkedClipId ?? null)
        : (clip?.id ?? null);
    setIsAudioTrackVisible(
      getContextualAudioClips(clips, contextualSelectionId).length > 0,
    );
  };

  const selectVideoLayerClipAtFrame = (videoLayer: number, frame: number) => {
    setSelectedVideoLayer(null);
    const clip =
      clips.find(
        (candidate) =>
          getVideoLayer(candidate) === videoLayer &&
          frame >= candidate.start &&
          frame < candidate.start + candidate.duration,
      ) ?? clips.find((candidate) => getVideoLayer(candidate) === videoLayer);

    setSelectedTrack(videoLayer === 0 ? "main" : "upper");
    setSelectedClipId(clip?.id ?? null);
    const contextualSelectionId =
      clip?.track === "audio"
        ? (clip.linkedClipId ?? null)
        : (clip?.id ?? null);
    setIsAudioTrackVisible(
      getContextualAudioClips(clips, contextualSelectionId).length > 0,
    );
  };
  void selectVideoLayerClipAtFrame;

  const selectWholeVideoLayer = (videoLayer: number) => {
    setSelectedVideoLayer(videoLayer);
    setSelectedClipId(null);
    setSelectedTrack(videoLayer === 0 ? "main" : "upper");
    setIsAudioTrackVisible(
      clips.some(
        (clip) =>
          getVideoLayer(clip) === videoLayer && Boolean(clip.linkedClipId),
      ),
    );
  };

  const openAudioControls = () => {
    setActiveTool("audio");
    selectTrackClipAtFrame("audio", playheadFrame);
  };

  const addStickerAtPlayhead = useCallback(
    (stickerItem: StickerItem) => {
      const id = `sticker-${Date.now()}-${stickerItem.id}`;
      const stickerClip = createStickerClip({
        id,
        label: stickerItem.label,
        src: stickerItem.src,
        playheadFrame,
      });

      commitClipChange((currentClips) =>
        appendStickerClip(currentClips, stickerClip),
      );
      setSelectedClipId(id);
      setSelectedTrack("sticker");
      setIsAudioTrackVisible(false);
      setPreviewMode("timeline");
    },
    [commitClipChange, playheadFrame],
  );

  const uploadSticker = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
      ["image/png", "image/webp", "image/gif"].includes(file.type),
    );

    if (files.length === 0) return;

    const uploadedItems = files.map((file, index) => ({
      id: `uploaded-sticker-${Date.now()}-${index}`,
      label: file.name.replace(/\.[^.]+$/, ""),
      src: URL.createObjectURL(file),
      uploaded: true,
    }));
    setStickerItems((currentItems) => [...uploadedItems, ...currentItems]);
    addStickerAtPlayhead(uploadedItems[0]);
    event.currentTarget.value = "";
  };

  const importCutoutFromGallery = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []).filter(
      (file) =>
        file.type.startsWith("image/") || file.type.startsWith("video/"),
    );

    if (selectedFiles.length === 0) return;

    setIsAutoCutoutLoading(true);
    setProjectStatus("Importing cutout and removing background...");
    try {
      const timestamp = Date.now();
      const importedGroups = await mapWithConcurrency(
        selectedFiles,
        1,
        async (file, index): Promise<TimelineClip[]> => {
          const previewSrc = URL.createObjectURL(file);
          try {
            const isVideo = file.type.startsWith("video/");
            const [durationInFrames, uploadedMedia] = await Promise.all([
              isVideo
                ? readVideoDurationInFrames(previewSrc)
                : Promise.resolve(90),
              uploadMediaFile(file),
            ]);
            const processedMedia = await removeBackgroundFromFile({
              file,
              mediaKind: isVideo ? "video" : "image",
              durationSeconds: durationInFrames / fps,
            });
            const label = (uploadedMedia.label || file.name).replace(
              /\.[^.]+$/,
              "",
            );

            if (!isVideo) {
              const clip = createCutoutImageClip({
                id: `cutout-image-${timestamp}-${index}`,
                label,
                src: uploadedMedia.src,
                playheadFrame,
              });
              return applyAutomaticCutoutById(
                [clip],
                clip.id,
                processedMedia.src,
              );
            }

            const pair = createCutoutVideoPair({
              videoId: `cutout-video-${timestamp}-${index}`,
              audioId: `cutout-audio-${timestamp}-${index}`,
              label,
              src: uploadedMedia.src,
              start: playheadFrame,
              duration: durationInFrames,
            });
            return applyAutomaticCutoutById(
              pair,
              pair[0].id,
              processedMedia.src,
            );
          } finally {
            URL.revokeObjectURL(previewSrc);
          }
        },
      );
      const importedClips = importedGroups.flat();
      const firstCutout = importedClips.find((clip) => clip.track === "cutout");

      commitClipChange((currentClips) => [...currentClips, ...importedClips]);
      setSelectedClipId(firstCutout?.id ?? null);
      setSelectedTrack("cutout");
      setIsAudioTrackVisible(Boolean(firstCutout?.linkedClipId));
      setPreviewMode("timeline");
      setProjectStatus("Cutout added with background removed");
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Cutout import failed: ${error.message}`
          : "Cutout import failed.",
      );
    } finally {
      setIsAutoCutoutLoading(false);
      input.value = "";
    }
  };

  const processSelectedCutoutAutomatically = async (): Promise<void> => {
    const requestTiming = createAutomaticCutoutRequestTiming(
      selectedCutoutClip,
      fps,
    );
    const mediaKind = selectedCutoutClip?.cutout?.mediaKind;
    if (
      !requestTiming ||
      !selectedCutoutClip?.src ||
      !selectedCutoutClip.cutout ||
      (mediaKind !== "image" && mediaKind !== "video")
    ) {
      return;
    }

    abortAutoCutoutRequest();

    const requestToken = Symbol("auto-cutout-request");
    const abortController = new AbortController();
    const {
      requestSnapshot,
      requestSource,
      sourceStartSeconds,
      durationSeconds,
    } = requestTiming;
    const clipId = requestSnapshot.clipId;
    const originalSource = requestSource.src;
    const selectionStillMatches = (currentClips: TimelineClip[]) => {
      const currentClip = currentClips.find((clip) => clip.id === clipId);
      return (
        activeToolRef.current === "cutout" &&
        isCutoutRequestSnapshotCurrent(
          requestSnapshot,
          selectedClipIdRef.current,
          currentClip,
        )
      );
    };
    const requestIsActive = () =>
      autoCutoutRequestRef.current === requestToken &&
      selectionStillMatches(clipsRef.current);

    autoCutoutRequestRef.current = requestToken;
    autoCutoutAbortControllerRef.current = abortController;
    setIsAutoCutoutLoading(true);
    setProjectStatus("Removing background...");

    try {
      const sourceResponse = await fetch(resolveMediaSource(originalSource), {
        signal: abortController.signal,
      });
      if (!requestIsActive()) return;
      if (!sourceResponse.ok) {
        throw new Error("Could not load the selected cutout source.");
      }

      const sourceBlob = await sourceResponse.blob();
      if (!requestIsActive()) return;
      const sourceFile = new File(
        [sourceBlob],
        getCaptionSourceFileName(selectedCutoutClip, sourceBlob),
        {
          type:
            sourceBlob.type ||
            (mediaKind === "image" ? "image/png" : "video/mp4"),
        },
      );
      const payload = await removeBackgroundFromFile({
        file: sourceFile,
        mediaKind,
        sourceStartSeconds,
        durationSeconds,
        signal: abortController.signal,
      });
      if (!requestIsActive()) return;

      commitClipChange((currentClips) => {
        if (!selectionStillMatches(currentClips)) return currentClips;

        pendingAutoCutoutCommitRef.current = {
          clipId,
          processedSrc: payload.src,
        };
        return applyAutomaticCutoutById(currentClips, clipId, payload.src);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof Error && error.name === "AbortError") return;
      if (!requestIsActive()) return;
      setProjectStatus(
        error instanceof Error ? error.message : "Automatic cutout failed.",
      );
    } finally {
      if (autoCutoutRequestRef.current === requestToken) {
        autoCutoutRequestRef.current = null;
        autoCutoutAbortControllerRef.current = null;
        setIsAutoCutoutLoading(false);
      }
    }
  };

  const addTextAtPlayhead = () => {
    const content = textDraft.trim();
    if (!content) return;

    const id = `text-${Date.now()}`;
    const textClip = createTextClip({ id, content, playheadFrame });
    commitClipChange((currentClips) => [...currentClips, textClip]);
    setSelectedClipId(id);
    setSelectedTrack("text");
    setIsAudioTrackVisible(false);
    setPreviewMode("timeline");
    setTextDraft("");
  };

  const commitSelectedTextContent = () => {
    if (!selectedTextClip?.text) return;

    const content = textDraft.trim();
    if (!content) return;

    commitClipChange((currentClips) =>
      setTextContentById(currentClips, selectedTextClip.id, content),
    );
    setTextDraft(content);
    setPreviewMode("timeline");
  };

  const addCaptionAtPlayhead = () => {
    const id = `caption-${Date.now()}`;
    const captionClip = createManualCaptionClip({
      id,
      content: captionDraft,
      playheadFrame,
      timelineDuration: projectDuration,
      style: captionStyle,
    });
    if (!captionClip?.caption) {
      setCaptionStatus({
        kind: "error",
        message: "Move the playhead to an open spot in the timeline.",
      });
      return;
    }

    commitClipChange((currentClips) => [...currentClips, captionClip]);
    setSelectedClipId(id);
    setSelectedTrack("caption");
    setIsAudioTrackVisible(false);
    setPreviewMode("timeline");
    setCaptionDraft(captionClip.caption.content);
    setCaptionStyle({
      ...defaultCaptionStyle,
      ...captionClip.caption,
      fontSize: captionClip.caption.fontSize,
      textColor: captionClip.caption.textColor,
      backgroundEnabled: captionClip.caption.backgroundEnabled,
      backgroundColor: captionClip.caption.backgroundColor,
    });
    setCaptionMode("manual");
    setCaptionStatus({ kind: "success", message: "Caption added" });
  };

  const uploadCaptionFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      event.currentTarget.value = "";
      return;
    }

    resetCaptionStatus();

    try {
      const content = await file.text();
      const parsedCaptions = parseCaptionFile({
        name: file.name,
        content,
        fps,
        timelineDuration: projectDuration,
      });
      const importedCaptions = createImportedCaptionClips({
        parsedCaptions,
        fps,
        timelineDuration: projectDuration,
        style: captionStyle,
        batchId: `caption-import-${Date.now()}`,
      });

      if (importedCaptions.length === 0) {
        throw new Error(
          "No valid caption cues could be imported from this file.",
        );
      }

      commitClipChange((currentClips) => [
        ...currentClips,
        ...importedCaptions,
      ]);
      setSelectedClipId(importedCaptions[0]?.id ?? null);
      setSelectedTrack("caption");
      setIsAudioTrackVisible(false);
      setPreviewMode("timeline");
      setCaptionStatus({
        kind: "success",
        message: `Imported ${importedCaptions.length} captions from ${file.name}.`,
      });
    } catch (error) {
      setCaptionStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Caption file import failed. Please try another file.",
      });
    }

    event.currentTarget.value = "";
  };

  const generateCaptionBatch = useCallback(
    async (kind: "auto" | "lyrics" | "transcript") => {
      if (autoCaptionRequestRef.current) {
        abortAutoCaptionRequest();
      }

      if (!selectedCaptionSourceClip) {
        setCaptionStatus({
          kind: "error",
          message:
            kind === "lyrics"
              ? "Select a main or upper video clip before generating auto lyrics."
              : kind === "transcript"
                ? "Select a main or upper video clip before generating a transcript."
                : "Select a main or upper video clip before generating auto captions.",
        });
        return;
      }

      const requestToken = Symbol("auto-caption-request");
      const selectionVersion = autoCaptionSelectionVersionRef.current;
      const sourceClipId = selectedCaptionSourceClip.id;
      const sourceClipSrc = selectedCaptionSourceClip.src;
      const sourceClipSourceStart = selectedCaptionSourceClip.sourceStart ?? 0;
      const sourceClipDuration = selectedCaptionSourceClip.duration;
      const sourceClipSpeed = selectedCaptionSourceClip.speed ?? 1;
      const sourceStartSeconds =
        (selectedCaptionSourceClip.sourceStart ?? 0) / fps;
      const sourceDurationSeconds =
        (selectedCaptionSourceClip.duration *
          (selectedCaptionSourceClip.speed ?? 1)) /
        fps;
      const abortController = new AbortController();
      const isActiveAutoCaptionRequest = () =>
        autoCaptionRequestRef.current === requestToken &&
        autoCaptionSelectionVersionRef.current === selectionVersion;
      autoCaptionRequestRef.current = requestToken;
      autoCaptionAbortControllerRef.current = abortController;
      setIsAutoCaptionLoading(true);
      setCaptionStatus({
        kind: "loading",
        message:
          kind === "lyrics"
            ? "Generating auto lyrics..."
            : kind === "transcript"
              ? "Transcribing selected clip..."
              : "Generating auto captions...",
      });

      try {
        const clipResponse = await fetch(
          resolveMediaSource(selectedCaptionSourceClip.src!),
          {
            signal: abortController.signal,
          },
        );
        if (!isActiveAutoCaptionRequest()) {
          return;
        }
        if (!clipResponse.ok) {
          throw new Error(
            "Could not load the selected clip for auto captions.",
          );
        }

        const clipBlob = await clipResponse.blob();
        if (!isActiveAutoCaptionRequest()) {
          return;
        }
        const clipFileName = getCaptionSourceFileName(
          selectedCaptionSourceClip,
          clipBlob,
        );
        const clipFile = new File([clipBlob], clipFileName, {
          type: clipBlob.type || "application/octet-stream",
        });
        const formData = new FormData();
        formData.append("file", clipFile);
        formData.append("sourceStart", String(sourceStartSeconds));
        formData.append("duration", String(sourceDurationSeconds));

        const transcriptionResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });
        if (!isActiveAutoCaptionRequest()) {
          return;
        }

        let payload: unknown;
        try {
          payload = await transcriptionResponse.json();
        } catch {
          if (!isActiveAutoCaptionRequest()) {
            return;
          }
          throw new Error(
            transcriptionResponse.ok
              ? "Transcription response did not include caption segments."
              : kind === "lyrics"
                ? "Auto lyric generation failed. Please try again."
                : kind === "transcript"
                  ? "Transcript generation failed. Please try again."
                  : "Auto caption generation failed. Please try again.",
          );
        }
        if (!isActiveAutoCaptionRequest()) {
          return;
        }
        const serverErrorMessage =
          typeof payload === "object" &&
          payload !== null &&
          !Array.isArray(payload) &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string" &&
          payload.error.message.trim()
            ? payload.error.message.trim()
            : null;
        if (!transcriptionResponse.ok) {
          throw new Error(
            serverErrorMessage ??
              (kind === "lyrics"
                ? "Auto lyric generation failed. Please try again."
                : kind === "transcript"
                  ? "Transcript generation failed. Please try again."
                  : "Auto caption generation failed. Please try again."),
          );
        }
        if (
          typeof payload !== "object" ||
          payload === null ||
          Array.isArray(payload) ||
          !("segments" in payload) ||
          !Array.isArray(payload.segments)
        ) {
          throw new Error(
            "Transcription response did not include caption segments.",
          );
        }

        const currentSourceClip = clipsRef.current.find(
          (clip) => clip.id === sourceClipId,
        );
        if (
          !isActiveAutoCaptionRequest() ||
          selectedClipIdRef.current !== sourceClipId ||
          !currentSourceClip ||
          (currentSourceClip.track !== "main" &&
            currentSourceClip.track !== "upper") ||
          !currentSourceClip.src ||
          currentSourceClip.src !== sourceClipSrc ||
          (currentSourceClip.sourceStart ?? 0) !== sourceClipSourceStart ||
          currentSourceClip.duration !== sourceClipDuration ||
          (currentSourceClip.speed ?? 1) !== sourceClipSpeed
        ) {
          return;
        }

        const generatedCaptions = createGeneratedCaptionClips({
          sourceClip: {
            ...currentSourceClip,
            sourceStart: 0,
          },
          segments: payload.segments,
          fps,
          timelineDuration: getTimelineDuration(clipsRef.current),
          generationId: `${kind === "lyrics" ? "lyric" : kind === "transcript" ? "transcript" : "caption"}-batch-${Date.now()}`,
          style: captionStyle,
        });
        if (generatedCaptions.length === 0) {
          throw new Error(
            kind === "lyrics"
              ? "No lyric segments were returned for the selected clip."
              : kind === "transcript"
                ? "No speech was found in the selected clip."
                : "No caption segments were returned for the selected clip.",
          );
        }

        commitClipChange((currentClips) => {
          const commitSourceClip = currentClips.find(
            (clip) => clip.id === sourceClipId,
          );
          if (
            selectedClipIdRef.current !== sourceClipId ||
            !commitSourceClip ||
            (commitSourceClip.track !== "main" &&
              commitSourceClip.track !== "upper") ||
            !commitSourceClip.src ||
            commitSourceClip.src !== sourceClipSrc ||
            (commitSourceClip.sourceStart ?? 0) !== sourceClipSourceStart ||
            commitSourceClip.duration !== sourceClipDuration ||
            (commitSourceClip.speed ?? 1) !== sourceClipSpeed
          ) {
            return currentClips;
          }

          return replaceGeneratedCaptionBatch(
            currentClips,
            sourceClipId,
            generatedCaptions,
          );
        });
        if (kind !== "transcript") {
          setSelectedClipId(generatedCaptions[0]?.id ?? null);
          setSelectedTrack("caption");
          setIsAudioTrackVisible(false);
        }
        setPreviewMode("timeline");
        setCaptionStatus({
          kind: "success",
          message:
            kind === "lyrics"
              ? `Added ${generatedCaptions.length} lyric captions.`
              : kind === "transcript"
                ? `Transcript ready with ${generatedCaptions.length} timed segments.`
                : `Added ${generatedCaptions.length} auto captions.`,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!isActiveAutoCaptionRequest()) {
          return;
        }
        setCaptionStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : kind === "lyrics"
                ? "Auto lyric generation failed. Please try again."
                : kind === "transcript"
                  ? "Transcript generation failed. Please try again."
                  : "Auto caption generation failed. Please try again.",
        });
      } finally {
        if (autoCaptionRequestRef.current === requestToken) {
          autoCaptionRequestRef.current = null;
          setIsAutoCaptionLoading(false);
        }
        if (autoCaptionAbortControllerRef.current === abortController) {
          autoCaptionAbortControllerRef.current = null;
        }
      }
    },
    [
      abortAutoCaptionRequest,
      captionStyle,
      commitClipChange,
      selectedCaptionSourceClip,
    ],
  );

  const generateAutoCaptions = useCallback(async () => {
    await generateCaptionBatch("auto");
  }, [generateCaptionBatch]);

  const generateAutoLyrics = useCallback(async () => {
    await generateCaptionBatch("lyrics");
  }, [generateCaptionBatch]);

  const generateTranscript = useCallback(async () => {
    await generateCaptionBatch("transcript");
  }, [generateCaptionBatch]);

  const keepMainVoiceAutomatically = useCallback(async () => {
    if (keepMainVoiceRequestRef.current) {
      abortKeepMainVoiceRequest();
    }

    const snapshot = createDominantVoiceRequestSnapshot(selectedMainVoiceClip);
    if (!snapshot || !canKeepMainVoice || !selectedMainVoiceClip?.src) {
      setCaptionStatus({
        kind: "error",
        message:
          "Select a main or overlay video clip before keeping the main voice.",
      });
      return;
    }

    const requestToken = Symbol("keep-main-voice-request");
    const sourceClipId = snapshot.clipId;
    const sourceClipSrc = selectedMainVoiceClip.src;
    const sourceClipSourceStart = selectedMainVoiceClip.sourceStart ?? 0;
    const sourceClipDuration = selectedMainVoiceClip.duration;
    const sourceClipSpeed = selectedMainVoiceClip.speed ?? 1;
    const sourceStartSeconds = sourceClipSourceStart / fps;
    const sourceDurationSeconds = (sourceClipDuration * sourceClipSpeed) / fps;
    const referenceVoiceClip = clipsRef.current
      .filter(
        (clip) =>
          clip.id !== sourceClipId &&
          clip.track === "main" &&
          clip.mediaType !== "image" &&
          Boolean(clip.src) &&
          clip.start < selectedMainVoiceClip.start,
      )
      .sort(
        (left, right) =>
          right.duration - left.duration || left.start - right.start,
      )[0];
    const abortController = new AbortController();
    const isCurrentRequest = () =>
      keepMainVoiceRequestRef.current === requestToken &&
      isDominantVoiceRequestCurrent(
        snapshot,
        selectedClipIdRef.current,
        clipsRef.current,
      );
    const preserveUncertainScene = (message: string) => {
      if (!isCurrentRequest()) return;
      setCaptionStatus({kind: "error", message});
      setPreviewMode("timeline");
    };

    keepMainVoiceRequestRef.current = requestToken;
    keepMainVoiceAbortControllerRef.current = abortController;
    setIsKeepMainVoiceLoading(true);
    setCaptionStatus({ kind: "loading", message: "Extracting audio..." });

    try {
      const clipResponse = await fetch(resolveMediaSource(sourceClipSrc), {
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) {
        return;
      }
      if (!clipResponse.ok) {
        throw new Error(
          "Could not load the selected clip for main voice detection.",
        );
      }

      const clipBlob = await clipResponse.blob();
      if (!isCurrentRequest()) {
        return;
      }
      const clipFile = new File(
        [clipBlob],
        getCaptionSourceFileName(selectedMainVoiceClip, clipBlob),
        {
          type: clipBlob.type || "video/mp4",
        },
      );
      const formData = new FormData();
      formData.append("file", clipFile);
      formData.append("sourceStart", String(sourceStartSeconds));
      formData.append("duration", String(sourceDurationSeconds));
      if (referenceVoiceClip?.src) {
        setCaptionStatus({
          kind: "loading",
          message: "Comparing with the main-track speaker...",
        });
        const referenceResponse = await fetch(
          resolveMediaSource(referenceVoiceClip.src),
          {signal: abortController.signal},
        );
        if (!isCurrentRequest()) return;
        if (!referenceResponse.ok) {
          throw new Error("Could not load the main-track voice reference.");
        }
        const referenceBlob = await referenceResponse.blob();
        if (!isCurrentRequest()) return;
        formData.append(
          "referenceFile",
          new File(
            [referenceBlob],
            getCaptionSourceFileName(referenceVoiceClip, referenceBlob),
            {type: referenceBlob.type || "video/mp4"},
          ),
        );
        formData.append(
          "referenceSourceStart",
          String((referenceVoiceClip.sourceStart ?? 0) / fps),
        );
        formData.append(
          "referenceDuration",
          String(
            (referenceVoiceClip.duration * (referenceVoiceClip.speed ?? 1)) /
              fps,
          ),
        );
      }

      setCaptionStatus({ kind: "loading", message: "Detecting speakers..." });
      const dominantVoiceResponse = await fetch("/api/detect-dominant-voice", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) {
        return;
      }

      let payload: unknown;
      try {
        payload = await dominantVoiceResponse.json();
      } catch {
        if (!isCurrentRequest()) {
          return;
        }
        throw new Error(
          dominantVoiceResponse.ok
            ? "Main voice detection response did not include ranges."
            : "Main voice detection failed. Please try again.",
        );
      }
      if (!isCurrentRequest()) {
        return;
      }

      const serverErrorMessage =
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload) &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error !== null &&
        "message" in payload.error &&
        typeof payload.error.message === "string" &&
        payload.error.message.trim()
          ? payload.error.message.trim()
          : null;
      if (!dominantVoiceResponse.ok) {
        throw new Error(
          serverErrorMessage ??
            "Main voice detection failed. Please try again.",
        );
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload) ||
        !("ranges" in payload) ||
        !Array.isArray(payload.ranges)
      ) {
        throw new Error(
          "Main voice detection response did not include ranges.",
        );
      }

      setCaptionStatus({
        kind: "loading",
        message: "Finding the main voice...",
      });
      if (!isCurrentRequest()) {
        return;
      }
      const ranges = payload.ranges.map((range) => {
        if (
          typeof range !== "object" ||
          range === null ||
          Array.isArray(range) ||
          !("startSeconds" in range) ||
          typeof range.startSeconds !== "number" ||
          !Number.isFinite(range.startSeconds) ||
          !("endSeconds" in range) ||
          typeof range.endSeconds !== "number" ||
          !Number.isFinite(range.endSeconds)
        ) {
          throw new Error(
            "Main voice detection response included an invalid range.",
          );
        }

        return {
          startSeconds: range.startSeconds,
          endSeconds: range.endSeconds,
        };
      });

      if (!isCurrentRequest()) {
        return;
      }
      const silenceFormData = new FormData();
      silenceFormData.append("file", clipFile);
      silenceFormData.append("sourceStart", String(sourceStartSeconds));
      silenceFormData.append("duration", String(sourceDurationSeconds));

      setCaptionStatus({
        kind: "loading",
        message: "Detecting silent sections...",
      });
      const silenceResponse = await fetch("/api/detect-silence", {
        method: "POST",
        body: silenceFormData,
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) {
        return;
      }

      let silencePayload: unknown;
      try {
        silencePayload = await silenceResponse.json();
      } catch {
        if (!isCurrentRequest()) {
          return;
        }
        throw new Error(
          silenceResponse.ok
            ? "Silence detection response did not include ranges."
            : "Silence detection failed. Please try again.",
        );
      }
      if (!isCurrentRequest()) {
        return;
      }
      if (!silenceResponse.ok) {
        const silenceServerMessage =
          typeof silencePayload === "object" &&
          silencePayload !== null &&
          !Array.isArray(silencePayload) &&
          "error" in silencePayload &&
          typeof silencePayload.error === "object" &&
          silencePayload.error !== null &&
          "message" in silencePayload.error &&
          typeof silencePayload.error.message === "string" &&
          silencePayload.error.message.trim()
            ? silencePayload.error.message.trim()
            : null;
        throw new Error(
          silenceServerMessage ?? "Silence detection failed. Please try again.",
        );
      }
      if (
        typeof silencePayload !== "object" ||
        silencePayload === null ||
        Array.isArray(silencePayload) ||
        !("ranges" in silencePayload) ||
        !Array.isArray(silencePayload.ranges)
      ) {
        throw new Error("Silence detection response did not include ranges.");
      }

      const silenceRanges = silencePayload.ranges.map((range) => {
        if (
          typeof range !== "object" ||
          range === null ||
          Array.isArray(range) ||
          !("startSeconds" in range) ||
          typeof range.startSeconds !== "number" ||
          !Number.isFinite(range.startSeconds) ||
          !("endSeconds" in range) ||
          typeof range.endSeconds !== "number" ||
          !Number.isFinite(range.endSeconds)
        ) {
          throw new Error(
            "Silence detection response included an invalid range.",
          );
        }

        return {
          startSeconds: range.startSeconds,
          endSeconds: range.endSeconds,
        };
      });

      const speechFormData = new FormData();
      speechFormData.append("file", clipFile);
      speechFormData.append("sourceStart", String(sourceStartSeconds));
      speechFormData.append("duration", String(sourceDurationSeconds));
      setCaptionStatus({
        kind: "loading",
        message: "Finding spoken words...",
      });
      const speechResponse = await fetch("/api/detect-speech", {
        method: "POST",
        body: speechFormData,
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) return;

      let speechPayload: unknown;
      try {
        speechPayload = await speechResponse.json();
      } catch {
        throw new Error("Speech detection returned an invalid response.");
      }
      if (!speechResponse.ok) {
        const speechServerMessage =
          typeof speechPayload === "object" &&
          speechPayload !== null &&
          !Array.isArray(speechPayload) &&
          "error" in speechPayload &&
          typeof speechPayload.error === "object" &&
          speechPayload.error !== null &&
          "message" in speechPayload.error &&
          typeof speechPayload.error.message === "string"
            ? speechPayload.error.message
            : null;
        throw new Error(speechServerMessage ?? "Speech detection failed.");
      }
      if (
        typeof speechPayload !== "object" ||
        speechPayload === null ||
        Array.isArray(speechPayload) ||
        !("ranges" in speechPayload) ||
        !Array.isArray(speechPayload.ranges)
      ) {
        throw new Error("Speech detection response did not include ranges.");
      }
      const speechRanges = speechPayload.ranges.map((range) => {
        if (
          typeof range !== "object" ||
          range === null ||
          Array.isArray(range) ||
          !("startSeconds" in range) ||
          typeof range.startSeconds !== "number" ||
          !Number.isFinite(range.startSeconds) ||
          !("endSeconds" in range) ||
          typeof range.endSeconds !== "number" ||
          !Number.isFinite(range.endSeconds)
        ) {
          throw new Error("Speech detection returned an invalid range.");
        }
        return {
          startSeconds: range.startSeconds,
          endSeconds: range.endSeconds,
        };
      });
      if (speechRanges.length === 0) {
        preserveUncertainScene(
          "No reliable spoken section was detected. The video was kept unchanged.",
        );
        return;
      }

      const spokenMainVoiceRanges = intersectSourceRanges(
        ranges,
        speechRanges,
        sourceDurationSeconds,
      );
      const retainedRanges = subtractSourceRanges(
        spokenMainVoiceRanges,
        silenceRanges,
        sourceDurationSeconds,
      );
      if (retainedRanges.length === 0) {
        preserveUncertainScene(
          "No reliable main-voice section was detected. The video was kept unchanged.",
        );
        return;
      }

      const cleanupFormData = new FormData();
      cleanupFormData.append("file", clipFile);
      setCaptionStatus({
        kind: "loading",
        message: "Reducing background noise...",
      });
      const cleanupResponse = await fetch("/api/clean-voice-audio", {
        method: "POST",
        body: cleanupFormData,
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) {
        return;
      }

      let cleanupPayload: unknown;
      try {
        cleanupPayload = await cleanupResponse.json();
      } catch {
        throw new Error("Background-noise cleanup returned an invalid response.");
      }
      const cleanedSrc =
        typeof cleanupPayload === "object" &&
        cleanupPayload !== null &&
        !Array.isArray(cleanupPayload) &&
        "src" in cleanupPayload &&
        typeof cleanupPayload.src === "string" &&
        cleanupPayload.src.trim()
          ? cleanupPayload.src.trim()
          : null;
      if (!cleanupResponse.ok || !cleanedSrc) {
        const cleanupServerMessage =
          typeof cleanupPayload === "object" &&
          cleanupPayload !== null &&
          !Array.isArray(cleanupPayload) &&
          "error" in cleanupPayload &&
          typeof cleanupPayload.error === "object" &&
          cleanupPayload.error !== null &&
          "message" in cleanupPayload.error &&
          typeof cleanupPayload.error.message === "string"
            ? cleanupPayload.error.message
            : null;
        throw new Error(
          cleanupServerMessage ?? "Background-noise cleanup failed.",
        );
      }

      setCaptionStatus({
        kind: "loading",
        message: "Removing silent scenes and other voices...",
      });
      if (!isCurrentRequest()) {
        return;
      }
      commitClipChange((currentClips) => {
        if (
          !isDominantVoiceRequestCurrent(
            snapshot,
            sourceClipId,
            currentClips,
          )
        ) {
          return currentClips;
        }

        const clipsWithLinkedAudio = ensureLinkedAudioForVideo(
          currentClips,
          sourceClipId,
        );
        const trimmedClips = keepDominantVoiceInLinkedVideo(
          clipsWithLinkedAudio,
          sourceClipId,
          retainedRanges,
          fps,
          cleanedSrc,
        );
        const hasSelectedVideoSegment = trimmedClips.some(
          (clip) =>
            clip.id === sourceClipId ||
            clip.id.startsWith(`${sourceClipId}-dominant-`),
        );

        return hasSelectedVideoSegment ? trimmedClips : currentClips;
      });
      setCaptionStatus({
        kind: "success",
        message: "Removed non-speaking scenes and cleaned the remaining voice.",
      });
      setPreviewMode("timeline");
      setIsAudioTrackVisible(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (!isCurrentRequest()) {
        return;
      }
      setCaptionStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Main voice detection failed. Please try again.",
      });
    } finally {
      if (keepMainVoiceRequestRef.current === requestToken) {
        keepMainVoiceRequestRef.current = null;
        setIsKeepMainVoiceLoading(false);
      }
      if (keepMainVoiceAbortControllerRef.current === abortController) {
        keepMainVoiceAbortControllerRef.current = null;
      }
    }
  }, [
    abortKeepMainVoiceRequest,
    canKeepMainVoice,
    commitClipChange,
    selectedMainVoiceClip,
  ]);

  const duplicateSelectedSticker = () => {
    if (!selectedClip || selectedClip.track !== "sticker") return;

    const id = `sticker-${Date.now()}-copy`;
    commitClipChange((currentClips) => [
      ...currentClips,
      {
        ...selectedClip,
        id,
        sticker: {
          x: Math.min(95, (selectedClip.sticker?.x ?? 50) + 4),
          y: Math.min(95, (selectedClip.sticker?.y ?? 50) + 4),
          scale: selectedClip.sticker?.scale ?? 1,
          rotation: selectedClip.sticker?.rotation ?? 0,
        },
      },
    ]);
    setSelectedClipId(id);
  };

  const startStickerInteraction = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    mode: StickerInteraction["mode"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    setStickerInteraction({
      clipId: clip.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
    });
  };

  const startTextTimelineDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const contentLeft =
      timelineContentRef.current?.getBoundingClientRect().left ?? 0;
    const startFrame = getTimelineFrameFromPointer(
      event.clientX,
      contentLeft,
      timelineOrigin,
      timelineScale,
    );
    selectTimelineClip(clip);
    setTextTimelineDrag({
      clipId: clip.id,
      startX: event.clientX,
      startFrame,
      contentLeft,
      originalClips: clips,
    });
  };

  const startTextPreviewDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    if (!previewBounds || !clip.text) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const textBounds = event.currentTarget.getBoundingClientRect();
    selectTimelineClip(clip);
    setTextResizeDrag(null);
    setTextPreviewDrag({
      clipId: clip.id,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      halfWidthPercent: (textBounds.width / previewBounds.width) * 50,
      halfHeightPercent: (textBounds.height / previewBounds.height) * 50,
    });
  };

  const startCaptionPreviewDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    if (!previewBounds || !clip.caption) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const captionBounds = event.currentTarget.getBoundingClientRect();
    selectTimelineClip(clip);
    setCaptionResizeDrag(null);
    setCaptionPreviewDrag({
      clipId: clip.id,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      halfWidthPercent: (captionBounds.width / previewBounds.width) * 50,
      halfHeightPercent: (captionBounds.height / previewBounds.height) * 50,
    });
  };

  const startCutoutInteraction = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    mode: CutoutInteraction["mode"],
    handle?: CaptionResizeHandle,
  ) => {
    if (isAutoCutoutLoading) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const cutoutElement =
      event.currentTarget.closest<HTMLElement>(".preview-cutout");
    selectTimelineClip(clip);
    setCutoutInteraction({
      clipId: clip.id,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: cutoutElement?.offsetWidth ?? 1,
      baseHeight: cutoutElement?.offsetHeight ?? 1,
      originalClips: clips,
    });
  };

  const startCutoutTimelineDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const contentLeft =
      timelineContentRef.current?.getBoundingClientRect().left ?? 0;
    const startFrame = getTimelineFrameFromPointer(
      event.clientX,
      contentLeft,
      timelineOrigin,
      timelineScale,
    );
    selectTimelineClip(clip);
    setCutoutTimelineDrag({
      clipId: clip.id,
      startX: event.clientX,
      startFrame,
      contentLeft,
      originalClips: clips,
    });
  };

  const startCutoutMaskStroke = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    mode: CutoutMaskStroke["mode"],
  ) => {
    if (isAutoCutoutLoading) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    event.preventDefault();
    event.stopPropagation();
    selectTimelineClip(clip);
    const point = {
      x: ((event.clientX - bounds.x) / bounds.width) * 100,
      y: ((event.clientY - bounds.y) / bounds.height) * 100,
    };
    const stroke = { mode, size: cutoutBrushSize, points: [point] };
    const originalClips = clipsRef.current;
    setTimelineHistory((currentHistory) => ({
      ...currentHistory,
      present: appendCutoutMaskStroke(originalClips, clip.id, stroke),
    }));
    cutoutMaskDragRef.current = {
      clipId: clip.id,
      mode,
      size: cutoutBrushSize,
      points: [point],
      originalClips,
      pointerId: event.pointerId,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };

    cutoutMaskCleanupRef.current?.();
    const cleanup = () => {
      window.removeEventListener("pointermove", continueCutoutMaskStroke);
      window.removeEventListener("pointerup", finishCutoutMaskStroke);
      window.removeEventListener("pointercancel", finishCutoutMaskStroke);
      cutoutMaskCleanupRef.current = null;
    };
    cutoutMaskCleanupRef.current = cleanup;
    window.addEventListener("pointermove", continueCutoutMaskStroke);
    window.addEventListener("pointerup", finishCutoutMaskStroke);
    window.addEventListener("pointercancel", finishCutoutMaskStroke);
  };

  const continueCutoutMaskStroke = (event: globalThis.PointerEvent) => {
    const drag = cutoutMaskDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const bounds = drag.bounds;
    if (!bounds.width || !bounds.height) return;
    const point = {
      x: ((event.clientX - bounds.x) / bounds.width) * 100,
      y: ((event.clientY - bounds.y) / bounds.height) * 100,
    };
    drag.points = [...drag.points, point];
    setTimelineHistory((currentHistory) => ({
      ...currentHistory,
      present: appendCutoutMaskStroke(drag.originalClips, drag.clipId, {
        mode: drag.mode,
        size: drag.size,
        points: drag.points,
      }),
    }));
  };

  const finishCutoutMaskStroke = (event: globalThis.PointerEvent) => {
    const drag = cutoutMaskDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    cutoutMaskCleanupRef.current?.();
    setTimelineHistory((currentHistory) => ({
      past: [...currentHistory.past, drag.originalClips],
      present: currentHistory.present,
      future: [],
    }));
    cutoutMaskDragRef.current = null;
  };

  const resetSelectedCutoutMask = () => {
    if (isAutoCutoutLoading) return;
    const clipId = selectedCutoutClip?.id;
    if (!clipId) return;
    commitClipChange((currentClips) => resetCutoutMask(currentClips, clipId));
    setCutoutBrushMode("move");
    setProjectStatus("Cutout restored to the original image");
  };

  const startTextResizeDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    handle: CaptionResizeHandle,
  ) => {
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    const textBounds =
      event.currentTarget.parentElement?.getBoundingClientRect();
    if (!clip.text || !previewBounds || !textBounds) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPreviewPlaying(false);
    selectTimelineClip(clip);
    setTextPreviewDrag(null);
    const animationPresentation = getTextAnimationPresentation(
      clip,
      playheadFrame,
    );
    setTextResizeDrag({
      clipId: clip.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: clip.text.x,
      startCenterY: clip.text.y,
      startWidth:
        (event.currentTarget.parentElement!.offsetWidth / previewBounds.width) *
        100,
      startHeight:
        (event.currentTarget.parentElement!.offsetHeight /
          previewBounds.height) *
        100,
      startRotation: (clip.text.rotation ?? 0) + animationPresentation.rotation,
      startScale: animationPresentation.scale,
      previewWidth: previewBounds.width,
      previewHeight: previewBounds.height,
      originalClips: clips,
    });
  };

  const startCaptionResizeDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
    handle: CaptionResizeHandle,
  ) => {
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    const captionElement = previewWindowRef.current?.querySelector<HTMLElement>(
      ".selected-preview-caption",
    );
    const captionBounds = captionElement?.getBoundingClientRect();
    if (!clip.caption || !previewBounds || !captionBounds || !captionElement)
      return;

    const measureBounds = (fontSize: number) => {
      if (Math.round(fontSize) === Math.round(clip.caption!.fontSize)) {
        return { width: captionBounds.width, height: captionBounds.height };
      }
      const clone = captionElement.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(".caption-resize-handle")
        .forEach((resizeHandle) => {
          resizeHandle.remove();
        });
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.left = "0";
      clone.style.top = "0";
      clone.style.translate = "none";
      clone.style.fontSize = `${fontSize}px`;
      previewWindowRef.current?.append(clone);
      const measured = clone.getBoundingClientRect();
      clone.remove();
      return { width: measured.width, height: measured.height };
    };
    const maximumFontSize = getMaximumFittingCaptionFontSize({
      requestedFontSize: 160,
      previewWidth: previewBounds.width,
      previewHeight: previewBounds.height,
      measure: measureBounds,
    });

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    setCaptionPreviewDrag(null);
    setCaptionResizeDrag({
      clipId: clip.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startFontSize: clip.caption.fontSize,
      maximumFontSize,
      measureBounds,
      previewWidth: previewBounds.width,
      previewHeight: previewBounds.height,
      originalClips: clips,
    });
  };

  const startTextRotateDrag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: TimelineClip,
  ) => {
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || !clip.text) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    setTextRotateDrag({
      clipId: clip.id,
      centerX,
      centerY,
      rotationOffset:
        clip.text.rotation -
        getManualRotationAngle(
          centerX,
          centerY,
          event.clientX,
          event.clientY,
          0,
        ),
      originalClips: clips,
    });
  };

  const startTrimDrag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: TimelineClip,
    edge: "left" | "right",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const contentLeft =
      timelineContentRef.current?.getBoundingClientRect().left ?? 0;
    const startFrame = getTimelineFrameFromPointer(
      event.clientX,
      contentLeft,
      timelineOrigin,
      timelineScale,
    );
    selectTimelineClip(clip);
    setTrimDrag({
      clipId: clip.id,
      edge,
      startX: event.clientX,
      startFrame,
      contentLeft,
      originalClips: clips,
    });
  };

  const createMediaTimelineClips = useCallback(
    (mediaItem: MediaItem, videoLayer: number, startFrame: number) => {
      const timestamp = Date.now();
      const videoId = `video-${timestamp}-${mediaItem.id}`;
      const label = mediaItem.label.replace(/\.[^.]+$/, "");
      const duration = Math.max(1, mediaItem.durationInFrames);

      if (getMediaItemType(mediaItem) === "image") {
        const track = videoLayer === 0 ? "main" : "upper";
        return {
          videoId,
          clips: [
            createImageMediaClip({
              id: videoId,
              track,
              label,
              src: mediaItem.src,
              start: Math.max(0, startFrame),
              duration,
              adjustment: mediaItem.adjustment,
            }),
          ] as TimelineClip[],
        };
      }

      const audioId = `video-audio-${timestamp}-${mediaItem.id}`;
      return {
        videoId,
        clips: createVideoMediaPair({
          videoId,
          audioId,
          track: videoLayer === 0 ? "main" : "upper",
          label,
          src: mediaItem.src,
          start: Math.max(0, startFrame),
          duration: mediaItem.durationInFrames,
          sourceStart: mediaItem.sourceStart ?? 0,
          sourceDuration: mediaItem.sourceDurationInFrames,
          adjustment: mediaItem.adjustment,
        }) as TimelineClip[],
      };
    },
    [],
  );

  const recoverUnavailableVideo = useCallback(async (clipId: string) => {
    const unavailableClip = clipsRef.current.find((clip) => clip.id === clipId);
    const missingSrc = unavailableClip?.src;
    const fallbackSrc = unavailableClip
      ? getPublicMediaFallbackSource(unavailableClip)
      : null;

    if (
      !missingSrc ||
      !fallbackSrc ||
      unavailableRecoveryRef.current.has(missingSrc)
    ) {
      return;
    }

    unavailableRecoveryRef.current.add(missingSrc);
    try {
      const response = await fetch(resolveMediaSource(fallbackSrc), {
        method: "HEAD",
      });
      if (!isPlayableMediaResponse(response)) {
        setProjectStatus(
          `The file for ${unavailableClip.label} is missing. Import that same video again to reconnect it.`,
        );
        return;
      }

      setTimelineHistory((currentHistory) => {
        const present = reconnectMediaSource(
          currentHistory.present,
          missingSrc,
          fallbackSrc,
        );
        return present === currentHistory.present
          ? currentHistory
          : { ...currentHistory, present };
      });
      setMediaItems((currentItems) =>
        currentItems.map((mediaItem) => {
          if (mediaItem.src !== missingSrc) return mediaItem;
          const reconnectedItem = { ...mediaItem, src: fallbackSrc };
          delete reconnectedItem.sourceDurationInFrames;
          return reconnectedItem;
        }),
      );
      setProjectStatus(
        `Reconnected ${unavailableClip.label} to its matching public video.`,
      );
    } catch {
      setProjectStatus(
        `The file for ${unavailableClip.label} is missing. Import that same video again to reconnect it.`,
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const savedUploadClips = clips.filter(
      (clip) =>
        (clip.track === "main" ||
          clip.track === "upper" ||
          clip.track === "cutout") &&
        isStoredUploadSource(clip.src),
    );

    savedUploadClips.forEach((clip) => {
      if (!clip.src || sourceAvailabilityChecksRef.current.has(clip.src))
        return;
      sourceAvailabilityChecksRef.current.add(clip.src);
      void fetch(resolveMediaSource(clip.src), { method: "HEAD" })
        .then((response) => {
          if (!isPlayableMediaResponse(response) && !cancelled) {
            void recoverUnavailableVideo(clip.id);
          }
        })
        .catch(() => {
          if (!cancelled) void recoverUnavailableVideo(clip.id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [clips, recoverUnavailableVideo]);

  const reconcileTimelineClipSourceDuration = useCallback(
    (videoClip: TimelineClip, event: SyntheticEvent<HTMLVideoElement>) => {
      if (!videoClip.src) return;
      const sourceDuration = durationToFrames(event.currentTarget.duration);
      setTimelineHistory((currentHistory) => {
        const present = reconcileClipSourceDuration(
          currentHistory.present,
          videoClip.src ?? "",
          sourceDuration,
        );
        return present === currentHistory.present
          ? currentHistory
          : { ...currentHistory, present };
      });
    },
    [],
  );

  const placeMediaBatchOnVideoLayer = useCallback(
    (
      batchItems: MediaItem[],
      videoLayer: number,
      startFrame: number,
      mode: "insert" | "append" | "place",
      rowOrder?: number,
    ) => {
      if (batchItems.length === 0) return;

      const preparedItems = batchItems.map((mediaItem) => ({
        mediaItem,
        ...createMediaTimelineClips(mediaItem, videoLayer, 0),
      }));

      commitClipChange((currentClips) => {
        let updatedClips = currentClips;
        let cursorFrame =
          mode === "append"
            ? getVideoLayerEnd(currentClips, videoLayer)
            : Math.max(0, startFrame);

        for (const preparedItem of preparedItems) {
          const positionedClips = preparedItem.clips.map((clip) => {
            const positionedClip = { ...clip, start: cursorFrame };
            return rowOrder !== undefined && getVideoLayer(clip) === videoLayer
              ? { ...positionedClip, timelineRowOrder: rowOrder }
              : positionedClip;
          });

          updatedClips =
            mode === "insert" && videoLayer === 0
              ? insertVideoPairOnLayerAtFrame(
                  updatedClips,
                  positionedClips,
                  videoLayer,
                  cursorFrame,
                )
              : placeVideoPairOnLayer(
                  updatedClips,
                  positionedClips,
                  videoLayer,
                  cursorFrame,
                );
          cursorFrame += preparedItem.mediaItem.durationInFrames;
        }

        return updatedClips;
      });

      setSelectedClipId(preparedItems[0].videoId);
      setSelectedVideoLayer(null);
      setSelectedTrack(videoLayer === 0 ? "main" : "upper");
      setIsAudioTrackVisible(
        batchItems.some((item) => getMediaItemType(item) === "video"),
      );
      setProjectStatus(
        `${batchItems.length} selected ${batchItems.length === 1 ? "scene" : "scenes"} added together`,
      );
    },
    [commitClipChange, createMediaTimelineClips],
  );

  const placeMediaOnTimelineTrack = useCallback(
    (
      mediaItem: MediaItem,
      track: "audio" | "cutout" | "sticker" | "caption" | "text",
      startFrame: number,
    ) => {
      const mediaType = getMediaItemType(mediaItem);
      const timestamp = Date.now();
      const label = mediaItem.label.replace(/\.[^.]+$/, "");

      if (track === "caption" || track === "text") {
        setProjectStatus(
          `Video files cannot be placed on the ${track} track. Use the ${track === "caption" ? "Captions" : "Text"} tool instead.`,
        );
        return;
      }

      if (track === "audio") {
        if (mediaType !== "video") {
          setProjectStatus("Images do not contain audio.");
          return;
        }
        const audioClip = createBackgroundMusicClip({
          id: `media-audio-${timestamp}`,
          label: `${label} audio`,
          src: mediaItem.src,
          playheadFrame: startFrame,
          durationInFrames: mediaItem.durationInFrames,
        });
        commitClipChange((currentClips) => [...currentClips, audioClip]);
        setSelectedClipId(audioClip.id);
        setSelectedTrack("audio");
        setIsAudioTrackVisible(true);
        setProjectStatus("Audio added at the drop position");
        return;
      }

      if (track === "sticker") {
        if (mediaType !== "image") {
          setProjectStatus("Use the Cutout track for a video overlay.");
          return;
        }
        const stickerClip = createStickerClip({
          id: `media-sticker-${timestamp}`,
          label,
          src: mediaItem.src,
          playheadFrame: startFrame,
        });
        commitClipChange((currentClips) =>
          appendStickerClip(currentClips, stickerClip),
        );
        setSelectedClipId(stickerClip.id);
        setSelectedTrack("sticker");
        setProjectStatus("Sticker added at the drop position");
        return;
      }

      const cutoutClips =
        mediaType === "image"
          ? [
              createCutoutImageClip({
                id: `media-cutout-image-${timestamp}`,
                label,
                src: mediaItem.src,
                playheadFrame: startFrame,
              }),
            ]
          : createCutoutVideoPair({
              videoId: `media-cutout-video-${timestamp}`,
              audioId: `media-cutout-audio-${timestamp}`,
              label,
              src: mediaItem.src,
              start: startFrame,
              duration: mediaItem.durationInFrames,
            });
      commitClipChange((currentClips) => [...currentClips, ...cutoutClips]);
      setSelectedClipId(cutoutClips[0].id);
      setSelectedTrack("cutout");
      setIsAudioTrackVisible(mediaType === "video");
      setProjectStatus("Cutout added at the drop position");
    },
    [commitClipChange],
  );

  const togglePreviewPlayback = () => {
    previewVideoRef.current?.pause();
    setIsMediaPreviewPlaying(false);
    setPreviewMode("timeline");
    if (!isPreviewPlaying || previewMode !== "timeline") {
      if (playheadFrame >= videoPlaybackDuration - 1) {
        setPlayheadFrame(0);
      }
      setIsPreviewPlaying(true);
      return;
    }

    setIsPreviewPlaying(false);
  };

  const toggleTimelinePlayback = togglePreviewPlayback;

  const toggleMediaPreviewPlayback = () => {
    if (
      previewMode !== "media" ||
      !selectedMedia ||
      getMediaItemType(selectedMedia) === "image"
    ) {
      return;
    }

    if (isMediaPreviewPlaying) {
      previewVideoRef.current?.pause();
      setIsMediaPreviewPlaying(false);
      return;
    }

    if (
      isSelectedMediaScene &&
      previewVideoRef.current &&
      previewVideoRef.current.currentTime >= mediaPreviewEndSeconds
    ) {
      previewVideoRef.current.currentTime = mediaPreviewStartSeconds;
      setMediaPreviewTime(mediaPreviewStartSeconds);
      setMediaPreviewFrame(0);
    }

    setIsPreviewPlaying(false);
    setIsMediaPreviewPlaying(true);
  };

  const toggleVoiceRecording = async () => {
    setRecordingError("");

    if (isRecording) {
      const recorder = voiceRecorderRef.current;
      if (!recorder) return;

      setIsPreviewPlaying(false);
      try {
        const recording = await recorder.stop();
        const src = URL.createObjectURL(recording.blob);
        const id = `voice-${Date.now()}`;
        const clip = createRecordedAudioClip({
          id,
          label: "Voice recording",
          src,
          start: voiceRecordingStartFrame ?? playheadFrame,
          durationSeconds: recording.durationSeconds,
          fps,
        });

        if (clip) {
          commitClipChange((currentClips) => [...currentClips, clip]);
          setSelectedClipId(id);
          setSelectedTrack("audio");
          setIsAudioTrackVisible(false);
        } else {
          URL.revokeObjectURL(src);
          setRecordingError("The recording was too short to add.");
        }
      } catch (error) {
        setRecordingError(
          error instanceof Error ? error.message : "Recording failed.",
        );
      } finally {
        voiceRecorderRef.current = null;
        setIsRecording(false);
        setVoiceRecordingStartFrame(null);
      }
      return;
    }

    if (!BrowserVoiceRecorder.isSupported()) {
      setRecordingError(
        "Microphone recording is not supported in this browser.",
      );
      return;
    }

    try {
      const recorder = new BrowserVoiceRecorder();
      await recorder.start();
      const recordingStartFrame =
        playheadFrame >= projectDuration ? 0 : playheadFrame;
      voiceRecorderRef.current = recorder;
      setVoiceRecordingStartFrame(recordingStartFrame);
      previewVideoRef.current?.pause();
      setIsMediaPreviewPlaying(false);
      setPreviewMode("timeline");
      setPlayheadFrame(recordingStartFrame);
      setIsRecording(true);
      setIsPreviewPlaying(true);
    } catch {
      setRecordingError("Allow microphone access to record your voice.");
    }
  };

  const handleMediaPreviewMetadata = (
    event: SyntheticEvent<HTMLVideoElement>,
  ) => {
    if (previewMode !== "media") return;
    const video = event.currentTarget;
    if (isSelectedMediaScene) {
      video.currentTime = mediaPreviewStartSeconds;
    }
    const { duration } = video;
    setMediaPreviewDuration(Number.isFinite(duration) ? duration : 0);
    setMediaPreviewTime(video.currentTime);
    setMediaPreviewFrame(0);
  };

  const handleMediaPreviewTimeUpdate = (
    event: SyntheticEvent<HTMLVideoElement>,
  ) => {
    if (previewMode !== "media") return;
    const video = event.currentTarget;
    setMediaPreviewTime(video.currentTime);
    if (!isSelectedMediaScene) {
      return;
    }

    if (
      mediaPreviewEndSeconds > mediaPreviewStartSeconds &&
      video.currentTime >= mediaPreviewEndSeconds
    ) {
      video.currentTime = mediaPreviewStartSeconds;
      setMediaPreviewTime(mediaPreviewStartSeconds);
      setMediaPreviewFrame(0);
      if (isMediaPreviewPlaying) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
      return;
    }

    setMediaPreviewFrame(getMediaPreviewFrame(video.currentTime));
  };

  const handleMediaPreviewEnded = () => {
    if (previewMode !== "media") return;
    setIsMediaPreviewPlaying(false);
  };

  const handleMediaPreviewSeek = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isMediaPreviewSeekEnabled) return;

    const nextTime = Number(event.currentTarget.value);
    const boundedNextTime = Math.min(
      mediaPreviewSeekMaxSeconds,
      Math.max(mediaPreviewSeekMinSeconds, nextTime),
    );
    const video = previewVideoRef.current;
    if (video) {
      video.currentTime = boundedNextTime;
    }
    setMediaPreviewTime(boundedNextTime);
    setMediaPreviewFrame(getMediaPreviewFrame(boundedNextTime));
  };

  const handleMediaPreviewVolumeChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextVolume = Math.max(
      0,
      Math.min(1, Number(event.currentTarget.value)),
    );
    setMediaPreviewVolume(nextVolume);
    if (previewVideoRef.current && previewMode === "media") {
      previewVideoRef.current.volume = nextVolume;
    }
  };

  const closeMediaPreviewVolumeIfInactive = () => {
    requestAnimationFrame(() => {
      const previewWindow = previewWindowRef.current;
      if (
        !previewWindow ||
        mediaPreviewVolumeDragRef.current ||
        previewWindow.matches(":hover") ||
        previewWindow.contains(document.activeElement)
      ) {
        return;
      }
      setIsMediaPreviewVolumeOpen(false);
    });
  };

  const handleMediaPreviewBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    closeMediaPreviewVolumeIfInactive();
  };

  const handleMediaPreviewVolumePointerDown = (
    event: PointerEvent<HTMLInputElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    mediaPreviewVolumeDragRef.current = true;
    setIsMediaPreviewVolumeAdjusting(true);
    setIsMediaPreviewVolumeOpen(true);
  };

  const handleMediaPreviewVolumePointerEnd = () => {
    mediaPreviewVolumeDragRef.current = false;
    setIsMediaPreviewVolumeAdjusting(false);
    closeMediaPreviewVolumeIfInactive();
  };

  const importSelectedMediaFiles = async (
    selectedFiles: File[],
    videoMode: ImportVideoMode,
  ) => {
    const importTimestamp = Date.now();
    const firstSourceGroupIndex = nextSourceGroupIndexRef.current;
    const videoFileCount = selectedFiles.filter(
      (file) => getMediaFileType(file) === "video",
    ).length;
    nextSourceGroupIndexRef.current += videoFileCount;
    setNextSourceGroupIndex(nextSourceGroupIndexRef.current);
    let videoGroupOffset = 0;
    const imports = selectedFiles.map((file, index) => {
      const mediaType = getMediaFileType(file) as "video" | "image";
      const sourceGroupIndex =
        mediaType === "video"
          ? firstSourceGroupIndex + videoGroupOffset++
          : undefined;
      return {
        file,
        mediaType,
        sourceFileId: `source-${importTimestamp}-${index}`,
        sourceGroupIndex,
        analyzingId: `analyzing-${importTimestamp}-${index}`,
      };
    });
    const orderedSourceFileIds = imports.map(
      ({ sourceFileId }) => sourceFileId,
    );
    const newAnalyzingItems = imports
      .filter(
        ({ mediaType }) => mediaType === "video" && videoMode === "scenes",
      )
      .map(({ file, analyzingId }) => ({ id: analyzingId, label: file.name }));

    if (newAnalyzingItems.length > 0) {
      setAnalyzingMediaItems((currentItems) => [
        ...newAnalyzingItems,
        ...currentItems,
      ]);
    }
    setProjectStatus("Importing media...");

    try {
      const results = await mapWithConcurrency(
        imports,
        2,
        async ({
          file,
          mediaType,
          sourceFileId,
          sourceGroupIndex,
          analyzingId,
        }) => {
          const previewSrc = URL.createObjectURL(file);
          try {
            if (mediaType === "video" && videoMode === "scenes") {
              const { sceneItems, usedFallback } = await analyzeImportedVideo({
                file,
                sourceFileId,
                sourceGroupIndex,
                previewSrc,
              });
              setMediaItems((currentItems) =>
                mergeImportedMediaItemsInSelectionOrder({
                  currentItems,
                  newItems: sceneItems,
                  sourceFileId,
                  orderedSourceFileIds,
                }),
              );
              return {
                fileName: file.name,
                mediaId: sceneItems[0].id,
                outcome: usedFallback
                  ? ("fallback" as const)
                  : ("imported" as const),
              };
            }

            if (mediaType === "video") {
              const [durationInFrames, uploadedMedia] = await Promise.all([
                readVideoDurationInFrames(previewSrc),
                uploadMediaFile(file),
              ]);
              const videoItem: MediaItem = {
                id: `media-${sourceFileId}`,
                label: `Scene ${sourceGroupIndex}`,
                src: uploadedMedia.src,
                duration: formatMediaDuration(durationInFrames),
                durationInFrames,
                sourceDurationInFrames: durationInFrames,
                kind: "public",
                mediaType: "video",
                sourceGroupIndex,
                sourceLabel: uploadedMedia.label || file.name,
              };
              setMediaItems((currentItems) =>
                mergeImportedMediaItemsInSelectionOrder({
                  currentItems,
                  newItems: [videoItem],
                  sourceFileId,
                  orderedSourceFileIds,
                }),
              );
              return {
                fileName: file.name,
                mediaId: videoItem.id,
                outcome: "imported" as const,
              };
            }

            const [durationInFrames, uploadedMedia] = await Promise.all([
              Promise.resolve(defaultImageDurationInFrames),
              uploadMediaFile(file),
            ]);
            const imageItem: MediaItem = {
              id: `media-${sourceFileId}`,
              label: uploadedMedia.label || file.name,
              src: uploadedMedia.src,
              duration: formatMediaDuration(durationInFrames),
              durationInFrames,
              kind: "public",
              mediaType: "image",
              sourceGroupIndex,
            };
            setMediaItems((currentItems) =>
              mergeImportedMediaItemsInSelectionOrder({
                currentItems,
                newItems: [imageItem],
                sourceFileId,
                orderedSourceFileIds,
              }),
            );
            return {
              fileName: file.name,
              mediaId: imageItem.id,
              outcome: "imported" as const,
            };
          } catch (error) {
            return {
              fileName: file.name,
              outcome: "failed" as const,
              message:
                error instanceof Error ? error.message : "Import failed.",
            };
          } finally {
            URL.revokeObjectURL(previewSrc);
            if (mediaType === "video" && videoMode === "scenes") {
              setAnalyzingMediaItems((currentItems) =>
                currentItems.filter((item) => item.id !== analyzingId),
              );
            }
          }
        },
      );

      const firstSuccessfulImport = results.find(
        (result) => result.outcome !== "failed",
      );
      if (firstSuccessfulImport) {
        setSelectedMediaId(firstSuccessfulImport.mediaId);
        setSelectedMediaIds([firstSuccessfulImport.mediaId]);
        setIsPreviewPlaying(false);
        setIsMediaPreviewPlaying(false);
        setPreviewMode("media");
      }
      const fallbackFiles = results.filter(
        (result) => result.outcome === "fallback",
      );
      const failedFiles = results.filter(
        (result) => result.outcome === "failed",
      );

      if (fallbackFiles.length > 0) {
        const failedSuffix =
          failedFiles.length > 0
            ? ` ${failedFiles.length} other file${failedFiles.length === 1 ? "" : "s"} failed to import.`
            : "";
        setProjectStatus(
          `Scene detection was unavailable for ${fallbackFiles.map(({ fileName }) => fileName).join(", ")}; imported as full-duration scenes.${failedSuffix}`,
        );
      } else if (failedFiles.length > 0) {
        setProjectStatus(
          `Import failed for ${failedFiles.map(({ fileName }) => fileName).join(", ")}: ${failedFiles[0].message}`,
        );
      } else {
        setProjectStatus("Media imported and saved");
      }
    } finally {
      setAnalyzingMediaItems((currentItems) =>
        currentItems.filter(
          (item) => !newAnalyzingItems.some(({ id }) => id === item.id),
        ),
      );
    }
  };

  const closeImportChoiceDialog = () => {
    importChoiceDialogRef.current?.close();
    pendingImportFilesRef.current = [];
    setPendingImportVideoCount(0);
  };

  const confirmMediaImport = (videoMode: ImportVideoMode) => {
    const selectedFiles = pendingImportFilesRef.current;
    closeImportChoiceDialog();
    if (selectedFiles.length > 0) {
      void importSelectedMediaFiles(selectedFiles, videoMode);
    }
  };

  const importMediaFromGallery = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []).filter(
      (file) => getMediaFileType(file) !== null,
    );
    input.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const videoCount = selectedFiles.filter(
      (file) => getMediaFileType(file) === "video",
    ).length;
    if (videoCount === 0) {
      void importSelectedMediaFiles(selectedFiles, "whole");
      return;
    }

    pendingImportFilesRef.current = selectedFiles;
    setPendingImportVideoCount(videoCount);
    importChoiceDialogRef.current?.showModal();
  };

  const importAudioSources = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []).filter(
      (file) =>
        file.type.startsWith("audio/") || file.type.startsWith("video/"),
    );

    if (selectedFiles.length === 0) {
      return;
    }

    setProjectStatus("Importing audio...");

    try {
      const timestamp = Date.now();
      const newMusicClips = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const previewSrc = URL.createObjectURL(file);
          try {
            const isVideoSource = file.type.startsWith("video/");
            const [durationInFrames, uploadedMedia] = await Promise.all([
              isVideoSource
                ? readVideoDurationInFrames(previewSrc)
                : readAudioDurationInFrames(previewSrc),
              uploadMediaFile(file),
            ]);
            const sourceLabel = (uploadedMedia.label || file.name).replace(
              /\.[^.]+$/,
              "",
            );
            return createBackgroundMusicClip({
              id: `imported-audio-${timestamp}-${index}`,
              label: isVideoSource ? `${sourceLabel} audio` : sourceLabel,
              src: uploadedMedia.src,
              playheadFrame,
              durationInFrames,
            });
          } finally {
            URL.revokeObjectURL(previewSrc);
          }
        }),
      );

      commitClipChange((currentClips) => [...currentClips, ...newMusicClips]);
      setSelectedClipId(newMusicClips[0].id);
      setSelectedTrack("audio");
      setIsAudioTrackVisible(true);
      setActiveTool("audio");
      setPreviewMode("timeline");
      setProjectStatus(
        `${newMusicClips.length} audio clip${newMusicClips.length === 1 ? "" : "s"} imported`,
      );
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Audio import failed: ${error.message}`
          : "Audio import failed.",
      );
    } finally {
      input.value = "";
    }
  };

  const updatePlayheadFromPointer = useCallback(
    (clientX: number) => {
      const frame = getPointerTimelineFrame(clientX);
      if (frame === null) return;

      const maximumFrame = Math.max(0, projectDuration - 1);
      setPlayheadFrame(Math.max(0, Math.min(maximumFrame, frame)));
      setPreviewMode("timeline");
    },
    [getPointerTimelineFrame, projectDuration],
  );

  const startTimelineScrub = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPreviewPlaying(false);
    setIsScrubbing(true);
    setScrubPointerId(event.pointerId);
    updatePlayheadFromPointer(event.clientX);
  };

  const getVideoDropTargetFromElement = useCallback(
    (element: Element | null): VideoDropTarget | null => {
      if (element?.closest("[data-append-main-track]")) {
        return { kind: "append-main" };
      }

      const rowGapElement = element?.closest("[data-video-row-order]");
      const rowOrder = Number(
        rowGapElement?.getAttribute("data-video-row-order"),
      );
      const direction = rowGapElement?.getAttribute("data-video-row-direction");
      if (
        Number.isFinite(rowOrder) &&
        (direction === "above" || direction === "below")
      ) {
        return { kind: "row-gap", direction, rowOrder };
      }

      const videoLayerElement = element?.closest("[data-video-layer]");
      if (videoLayerElement) {
        const videoLayerValue =
          videoLayerElement.getAttribute("data-video-layer");
        const videoLayer = Number(videoLayerValue);
        if (videoLayerValue !== null && Number.isFinite(videoLayer)) {
          return { kind: "layer", videoLayer };
        }
      }

      const trackElement = element?.closest("[data-track-id]");
      const track = trackElement?.getAttribute("data-track-id");
      if (
        track === "audio" ||
        track === "cutout" ||
        track === "sticker" ||
        track === "caption" ||
        track === "text"
      ) {
        return { kind: "track", track };
      }
      return null;
    },
    [],
  );

  const startPointerDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragStartedRef.current = false;
    const pointerFrame = getPointerTimelineFrame(event.clientX) ?? clip.start;
    setPointerDrag({
      type: "timeline",
      id: clip.id,
      activated: false,
      label: clip.label,
      x: event.clientX,
      y: event.clientY,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originalStart: clip.start,
      grabOffsetFrames: pointerFrame - clip.start,
    });
  };

  const startMediaDrag = (
    event: PointerEvent<HTMLElement>,
    mediaItem: MediaItem,
  ) => {
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragStartedRef.current = false;
    const mediaIds = selectedMediaIds.includes(mediaItem.id)
      ? selectedMediaIds
      : [mediaItem.id];
    if (!selectedMediaIds.includes(mediaItem.id)) {
      setSelectedMediaIds(mediaIds);
      setSelectedMediaId(mediaItem.id);
    }
    setPointerDrag({
      type: "media",
      id: mediaItem.id,
      activated: false,
      mediaIds,
      label:
        mediaIds.length > 1
          ? `${mediaIds.length} selected scenes`
          : mediaItem.label.replace(/\.[^.]+$/, ""),
      x: event.clientX,
      y: event.clientY,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
    });
  };

  useEffect(() => {
    if (!pointerDrag) {
      return;
    }

    const updateDropTarget = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y);
      const target = getVideoDropTargetFromElement(element);

      const draggedClip =
        pointerDrag.type === "timeline"
          ? clips.find((clip) => clip.id === pointerDrag.id)
          : null;
      const isVideoDrag =
        pointerDrag.type === "media" ||
        (draggedClip ? getVideoLayer(draggedClip) !== null : false);

      if (target && isVideoDrag) {
        setVideoDropTarget(target);
        return;
      }

      setVideoDropTarget(null);
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const dragDistance = Math.hypot(
        event.clientX - (pointerDrag.pointerStartX ?? event.clientX),
        event.clientY - (pointerDrag.pointerStartY ?? event.clientY),
      );
      if (dragDistance < timelineDragActivationDistance) {
        return;
      }
      pointerDragStartedRef.current = true;
      if (pointerDrag.type === "media") {
        suppressMediaClickRef.current = true;
      }
      setPointerDrag((currentDrag) =>
        currentDrag
          ? {
              ...currentDrag,
              activated: true,
              x: event.clientX,
              y: event.clientY,
            }
          : currentDrag,
      );
      updateDropTarget(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (!pointerDragStartedRef.current) {
        setPointerDrag(null);
        setVideoDropTarget(null);
        return;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const target = getVideoDropTargetFromElement(element);
      const pointerFrame = getPointerTimelineFrame(event.clientX) ?? 0;
      const targetVideoLayer = target
        ? target.kind === "row-gap"
          ? target.direction === "above"
            ? getNextVideoLayer(clips, "above")
            : getNextVideoLayer(clips, "below")
          : target.kind === "append-main"
              ? 0
              : target.kind === "layer"
                ? target.videoLayer
                : null
        : null;

      if (pointerDrag.type === "media" && target?.kind === "track") {
        const draggedItems = mediaItems.filter((item) =>
          (pointerDrag.mediaIds ?? [pointerDrag.id]).includes(item.id),
        );
        if (draggedItems.length === 1) {
          placeMediaOnTimelineTrack(draggedItems[0], target.track, pointerFrame);
        } else if (draggedItems.length > 1) {
          setProjectStatus(
            "Drop selected scenes on the Main track or an Overlay track",
          );
        }
      } else if (targetVideoLayer !== null) {
        if (pointerDrag.type === "media") {
          const draggedItems = mediaItems.filter((item) =>
            (pointerDrag.mediaIds ?? [pointerDrag.id]).includes(item.id),
          );

          if (draggedItems.length > 0) {
            if (target?.kind === "append-main") {
              placeMediaBatchOnVideoLayer(
                draggedItems,
                0,
                getVideoLayerEnd(clips, 0),
                "append",
              );
            } else if (target?.kind === "row-gap") {
              placeMediaBatchOnVideoLayer(
                draggedItems,
                targetVideoLayer,
                pointerFrame,
                "place",
                target.rowOrder,
              );
            } else {
              placeMediaBatchOnVideoLayer(
                draggedItems,
                targetVideoLayer,
                pointerFrame,
                targetVideoLayer === 0 ? "insert" : "place",
              );
            }
          }
        } else {
          const targetStart =
            pointerFrame - (pointerDrag.grabOffsetFrames ?? 0);
          const draggedClip = clips.find((clip) => clip.id === pointerDrag.id);
          const timelineBoundary = draggedClip
            ? getExpandedTimelineBoundary(
                projectDuration,
                targetStart,
                draggedClip.duration,
              )
            : projectDuration;
          commitClipChange((currentClips) => {
            const movedClips = moveVideoClipToLayer(
              currentClips,
              pointerDrag.id,
              targetVideoLayer,
              targetStart,
              timelineBoundary,
            );
            if (target?.kind !== "row-gap") return movedClips;

            return movedClips.map((clip) =>
              clip.id === pointerDrag.id
                ? { ...clip, timelineRowOrder: target.rowOrder }
                : clip,
            );
          });
          setSelectedTrack(targetVideoLayer === 0 ? "main" : "upper");
        }
      }

      setPointerDrag(null);
      setVideoDropTarget(null);
      pointerDragStartedRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    clips,
    commitClipChange,
    getPointerTimelineFrame,
    getVideoDropTargetFromElement,
    mediaItems,
    placeMediaOnTimelineTrack,
    placeMediaBatchOnVideoLayer,
    pointerDrag,
    projectDuration,
  ]);

  useEffect(() => {
    if (!pointerDrag) return;

    let animationFrame = 0;
    const scrollWhileDragging = () => {
      const scrollArea = timelineScrollRef.current;
      if (!scrollArea) return;
      if (!pointerDragStartedRef.current) {
        animationFrame = requestAnimationFrame(scrollWhileDragging);
        return;
      }

      const bounds = scrollArea.getBoundingClientRect();
      const laneViewportLeft = Math.min(
        bounds.right,
        bounds.left + timelineOrigin,
      );
      const isNearTimelineHorizontally =
        pointerDrag.x >= laneViewportLeft - 64 &&
        pointerDrag.x <= bounds.right + 64;
      const isNearTimelineVertically =
        pointerDrag.y >= bounds.top - 64 && pointerDrag.y <= bounds.bottom + 64;
      const horizontalDelta = isNearTimelineVertically
        ? getDragEdgeAutoScrollDelta(
            pointerDrag.x,
            laneViewportLeft,
            bounds.right,
          )
        : 0;
      const verticalDelta = isNearTimelineHorizontally
        ? getDragEdgeAutoScrollDelta(pointerDrag.y, bounds.top, bounds.bottom)
        : 0;
      const previousLeft = scrollArea.scrollLeft;
      const previousTop = scrollArea.scrollTop;

      scrollArea.scrollLeft += horizontalDelta;
      scrollArea.scrollTop += verticalDelta;

      if (
        scrollArea.scrollLeft !== previousLeft ||
        scrollArea.scrollTop !== previousTop
      ) {
        const element = document.elementFromPoint(pointerDrag.x, pointerDrag.y);
        const target = getVideoDropTargetFromElement(element);
        const draggedClip =
          pointerDrag.type === "timeline"
            ? clips.find((clip) => clip.id === pointerDrag.id)
            : null;
        const isVideoDrag =
          pointerDrag.type === "media" ||
          (draggedClip ? getVideoLayer(draggedClip) !== null : false);
        setVideoDropTarget(target && isVideoDrag ? target : null);
      }

      animationFrame = requestAnimationFrame(scrollWhileDragging);
    };

    animationFrame = requestAnimationFrame(scrollWhileDragging);
    return () => cancelAnimationFrame(animationFrame);
  }, [
    clips,
    getPointerTimelineFrame,
    getVideoDropTargetFromElement,
    pointerDrag,
  ]);

  useEffect(() => {
    if (!trimDrag) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const frameDelta = getStableTimelineFrameDelta(
        event.clientX,
        trimDrag.startFrame,
        trimDrag.contentLeft,
        timelineOrigin,
        timelineScale,
      );
      const targetClip = trimDrag.originalClips.find(
        (clip) => clip.id === trimDrag.clipId,
      );
      const minimumDuration =
        targetClip &&
        (targetClip.track === "caption" ||
          targetClip.track === "text" ||
          targetClip.track === "sticker" ||
          targetClip.track === "cutout")
          ? 1
          : 15;

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: trimClipById(
          trimDrag.originalClips,
          trimDrag.clipId,
          trimDrag.edge,
          frameDelta,
          minimumDuration,
        ),
      }));
    };

    const handlePointerUp = () => {
      setTimelineHistory((currentHistory) => ({
        past: [...currentHistory.past, trimDrag.originalClips],
        present: currentHistory.present,
        future: [],
      }));
      setTrimDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [trimDrag]);

  useEffect(() => {
    if (!cropDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const deltaX = ((event.clientX - cropDrag.startX) / bounds.width) * 100;
      const deltaY = ((event.clientY - cropDrag.startY) / bounds.height) * 100;
      const next: Partial<ClipAdjustment> = {};

      if (cropDrag.edge.includes("top")) {
        next.cropTop = cropDrag.originalAdjustment.cropTop + deltaY;
      }
      if (cropDrag.edge.includes("bottom")) {
        next.cropBottom = cropDrag.originalAdjustment.cropBottom - deltaY;
      }
      if (cropDrag.edge.includes("left")) {
        next.cropLeft = cropDrag.originalAdjustment.cropLeft + deltaX;
      }
      if (cropDrag.edge.includes("right")) {
        next.cropRight = cropDrag.originalAdjustment.cropRight - deltaX;
      }

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipAdjustmentById(
          cropDrag.originalClips,
          cropDrag.clipId,
          next,
        ),
      }));
    };

    const finishCrop = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === cropDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, cropDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setCropDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishCrop, { once: true });
    window.addEventListener("pointercancel", finishCrop, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishCrop);
      window.removeEventListener("pointercancel", finishCrop);
    };
  }, [cropDrag]);

  useEffect(() => {
    if (!adjustmentPanDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const deltaX = ((event.clientX - adjustmentPanDrag.startX) / bounds.width) *
        100;
      const deltaY =
        ((event.clientY - adjustmentPanDrag.startY) / bounds.height) * 100;
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipAdjustmentById(
          adjustmentPanDrag.originalClips,
          adjustmentPanDrag.clipId,
          {
            positionX:
              adjustmentPanDrag.originalAdjustment.positionX + deltaX,
            positionY:
              adjustmentPanDrag.originalAdjustment.positionY + deltaY,
          },
        ),
      }));
    };

    const finishPan = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === adjustmentPanDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, adjustmentPanDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setAdjustmentPanDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPan, { once: true });
    window.addEventListener("pointercancel", finishPan, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPan);
      window.removeEventListener("pointercancel", finishPan);
    };
  }, [adjustmentPanDrag]);

  useEffect(() => {
    if (!rotateDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipAdjustmentById(
          rotateDrag.originalClips,
          rotateDrag.clipId,
          {
            rotation: getManualRotationAngle(
              rotateDrag.centerX,
              rotateDrag.centerY,
              event.clientX,
              event.clientY,
              rotateDrag.rotationOffset,
            ),
          },
        ),
      }));
    };

    const finishRotate = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === rotateDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, rotateDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setRotateDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishRotate, { once: true });
    window.addEventListener("pointercancel", finishRotate, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishRotate);
      window.removeEventListener("pointercancel", finishRotate);
    };
  }, [rotateDrag]);

  useEffect(() => {
    if (!textTimelineDrag) return;

    const originalClip = textTimelineDrag.originalClips.find(
      (clip) => clip.id === textTimelineDrag.clipId,
    );
    if (!originalClip) return;

    let dragStarted = false;
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (
        !dragStarted &&
        Math.abs(event.clientX - textTimelineDrag.startX) <
          timelineDragActivationDistance
      ) {
        return;
      }
      dragStarted = true;
      const frameDelta = getStableTimelineFrameDelta(
        event.clientX,
        textTimelineDrag.startFrame,
        textTimelineDrag.contentLeft,
        timelineOrigin,
        timelineScale,
      );
      const targetStart = originalClip.start + frameDelta;
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: (originalClip.track === "text"
          ? moveTextClip
          : moveIndependentTimelineClip)(
          textTimelineDrag.originalClips,
          textTimelineDrag.clipId,
          targetStart,
          getExpandedTimelineBoundary(
            projectDuration,
            targetStart,
            originalClip.duration,
          ),
        ),
      }));
    };

    const finishDrag = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === textTimelineDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, textTimelineDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setTextTimelineDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [projectDuration, textTimelineDrag]);

  useEffect(() => {
    if (!cutoutTimelineDrag) return;

    const originalClip = cutoutTimelineDrag.originalClips.find(
      (clip) => clip.id === cutoutTimelineDrag.clipId,
    );
    if (!originalClip?.cutout) return;

    let dragStarted = false;
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (
        !dragStarted &&
        Math.abs(event.clientX - cutoutTimelineDrag.startX) <
          timelineDragActivationDistance
      ) {
        return;
      }
      dragStarted = true;
      const frameDelta = getStableTimelineFrameDelta(
        event.clientX,
        cutoutTimelineDrag.startFrame,
        cutoutTimelineDrag.contentLeft,
        timelineOrigin,
        timelineScale,
      );
      const targetStart = originalClip.start + frameDelta;
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: moveCutoutClip(
          cutoutTimelineDrag.originalClips,
          cutoutTimelineDrag.clipId,
          targetStart,
          getExpandedTimelineBoundary(
            projectDuration,
            targetStart,
            originalClip.duration,
          ),
        ),
      }));
    };

    const finishDrag = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === cutoutTimelineDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, cutoutTimelineDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setCutoutTimelineDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [cutoutTimelineDrag, projectDuration]);

  useEffect(() => {
    if (!textPreviewDrag) return;

    const originalClip = textPreviewDrag.originalClips.find(
      (clip) => clip.id === textPreviewDrag.clipId,
    );
    const originalText = originalClip?.text;
    if (!originalText) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const previewBounds = previewWindowRef.current?.getBoundingClientRect();
      if (!previewBounds) return;

      const x =
        originalText.x +
        ((event.clientX - textPreviewDrag.startX) / previewBounds.width) * 100;
      const y =
        originalText.y +
        ((event.clientY - textPreviewDrag.startY) / previewBounds.height) * 100;

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: moveTextOverlay(
          textPreviewDrag.originalClips,
          textPreviewDrag.clipId,
          { x, y },
          {
            halfWidthPercent: textPreviewDrag.halfWidthPercent,
            halfHeightPercent: textPreviewDrag.halfHeightPercent,
          },
        ),
      }));
    };

    const finishDrag = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === textPreviewDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, textPreviewDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setTextPreviewDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [textPreviewDrag]);

  useEffect(() => {
    if (!captionPreviewDrag) return;

    const originalCaption = captionPreviewDrag.originalClips.find(
      (clip) => clip.id === captionPreviewDrag.clipId,
    )?.caption;
    if (!originalCaption) return;

    const originalPosition = getCaptionPosition(originalCaption);

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const x =
        originalPosition.x +
        ((event.clientX - captionPreviewDrag.startX) / bounds.width) * 100;
      const y =
        originalPosition.y +
        ((event.clientY - captionPreviewDrag.startY) / bounds.height) * 100;

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: moveCaptionOverlay(
          captionPreviewDrag.originalClips,
          captionPreviewDrag.clipId,
          { x, y },
          {
            halfWidthPercent: captionPreviewDrag.halfWidthPercent,
            halfHeightPercent: captionPreviewDrag.halfHeightPercent,
          },
        ),
      }));
    };

    const finishDrag = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === captionPreviewDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, captionPreviewDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setCaptionPreviewDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [captionPreviewDrag]);

  useEffect(() => {
    if (!textResizeDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const resizeDelta = getRotatedTextResizeDelta({
        deltaX: event.clientX - textResizeDrag.startX,
        deltaY: event.clientY - textResizeDrag.startY,
        rotation: textResizeDrag.startRotation,
        scale: textResizeDrag.startScale,
        previewWidth: textResizeDrag.previewWidth,
        previewHeight: textResizeDrag.previewHeight,
      });
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: resizeTextOverlayBoxById(
          textResizeDrag.originalClips,
          textResizeDrag.clipId,
          {
            handle: textResizeDrag.handle,
            startX: textResizeDrag.startCenterX,
            startY: textResizeDrag.startCenterY,
            startWidth: textResizeDrag.startWidth,
            startHeight: textResizeDrag.startHeight,
            deltaX: resizeDelta.deltaX,
            deltaY: resizeDelta.deltaY,
          },
        ),
      }));
    };

    const finishResize = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === textResizeDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, textResizeDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setTextResizeDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [textResizeDrag]);

  useEffect(() => {
    if (!captionResizeDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const requestedFontSize = getResizedCaptionFontSizeFromHandle({
        startFontSize: captionResizeDrag.startFontSize,
        startX: captionResizeDrag.startX,
        startY: captionResizeDrag.startY,
        pointerX: event.clientX,
        pointerY: event.clientY,
        handle: captionResizeDrag.handle,
      });
      const fittedFontSize = Math.min(
        requestedFontSize,
        captionResizeDrag.maximumFontSize,
      );
      const measuredBounds = captionResizeDrag.measureBounds(fittedFontSize);
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: resizeCaptionOverlayById(
          captionResizeDrag.originalClips,
          captionResizeDrag.clipId,
          requestedFontSize,
          {
            halfWidthPercent:
              (measuredBounds.width / captionResizeDrag.previewWidth) * 50,
            halfHeightPercent:
              (measuredBounds.height / captionResizeDrag.previewHeight) * 50,
            maximumFontSize: captionResizeDrag.maximumFontSize,
          },
        ),
      }));
    };

    const finishResize = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === captionResizeDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, captionResizeDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setCaptionResizeDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [captionResizeDrag]);

  useEffect(() => {
    if (!textRotateDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setTextRotationById(
          textRotateDrag.originalClips,
          textRotateDrag.clipId,
          getManualRotationAngle(
            textRotateDrag.centerX,
            textRotateDrag.centerY,
            event.clientX,
            event.clientY,
            textRotateDrag.rotationOffset,
          ),
        ),
      }));
    };

    const finishRotate = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === textRotateDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, textRotateDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setTextRotateDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishRotate, { once: true });
    window.addEventListener("pointercancel", finishRotate, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishRotate);
      window.removeEventListener("pointercancel", finishRotate);
    };
  }, [textRotateDrag]);

  useEffect(() => {
    if (!stickerInteraction) return;

    const originalClip = stickerInteraction.originalClips.find(
      (clip) => clip.id === stickerInteraction.clipId,
    );
    if (!originalClip) return;

    const originalTransform = originalClip.sticker ?? {
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const deltaX = event.clientX - stickerInteraction.startX;
      const deltaY = event.clientY - stickerInteraction.startY;
      let nextTransform = originalTransform;

      if (stickerInteraction.mode === "move") {
        nextTransform = {
          ...originalTransform,
          x: Math.max(
            0,
            Math.min(100, originalTransform.x + (deltaX / bounds.width) * 100),
          ),
          y: Math.max(
            0,
            Math.min(100, originalTransform.y + (deltaY / bounds.height) * 100),
          ),
        };
      } else if (stickerInteraction.mode === "scale") {
        nextTransform = {
          ...originalTransform,
          scale: Math.max(
            0.2,
            Math.min(4, originalTransform.scale + (deltaX + deltaY) / 180),
          ),
        };
      } else {
        nextTransform = {
          ...originalTransform,
          rotation: originalTransform.rotation + deltaX,
        };
      }

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: currentHistory.present.map((clip) =>
          clip.id === stickerInteraction.clipId
            ? { ...clip, sticker: nextTransform }
            : clip,
        ),
      }));
    };

    const handlePointerUp = () => {
      setTimelineHistory((currentHistory) => ({
        past: [...currentHistory.past, stickerInteraction.originalClips],
        present: currentHistory.present,
        future: [],
      }));
      setStickerInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [stickerInteraction]);

  useEffect(() => {
    if (!cutoutInteraction) return;

    const originalClip = cutoutInteraction.originalClips.find(
      (clip) => clip.id === cutoutInteraction.clipId,
    );
    if (!originalClip?.cutout) return;

    const originalTransform = originalClip.cutout;
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const deltaX = event.clientX - cutoutInteraction.startX;
      const deltaY = event.clientY - cutoutInteraction.startY;
      let nextTransform = originalTransform;

      if (cutoutInteraction.mode === "move") {
        nextTransform = {
          ...originalTransform,
          x: Math.max(
            0,
            Math.min(100, originalTransform.x + (deltaX / bounds.width) * 100),
          ),
          y: Math.max(
            0,
            Math.min(100, originalTransform.y + (deltaY / bounds.height) * 100),
          ),
        };
      } else if (
        cutoutInteraction.mode === "resize" &&
        cutoutInteraction.handle
      ) {
        nextTransform = resizeCutoutTransform({
          transform: originalTransform,
          handle: cutoutInteraction.handle,
          deltaX,
          deltaY,
          baseWidth: cutoutInteraction.baseWidth,
          baseHeight: cutoutInteraction.baseHeight,
          previewWidth: bounds.width,
          previewHeight: bounds.height,
        });
      } else {
        nextTransform = {
          ...originalTransform,
          rotation: originalTransform.rotation + deltaX,
        };
      }

      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: currentHistory.present.map((clip) =>
          clip.id === cutoutInteraction.clipId
            ? { ...clip, cutout: nextTransform }
            : clip,
        ),
      }));
    };

    const finishInteraction = () => {
      setTimelineHistory((currentHistory) => ({
        past: [...currentHistory.past, cutoutInteraction.originalClips],
        present: currentHistory.present,
        future: [],
      }));
      setCutoutInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishInteraction, { once: true });
    window.addEventListener("pointercancel", finishInteraction, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
    };
  }, [cutoutInteraction]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (
        !shouldMovePlayheadDuringScrub({
          activePointerId: scrubPointerId,
          pointerId: event.pointerId,
          buttons: event.buttons,
        })
      ) {
        setIsScrubbing(false);
        setScrubPointerId(null);
        return;
      }

      updatePlayheadFromPointer(event.clientX);
    };
    const stopScrubbing = () => {
      setIsScrubbing(false);
      setScrubPointerId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopScrubbing, { once: true });
    window.addEventListener("pointercancel", stopScrubbing, { once: true });
    window.addEventListener("blur", stopScrubbing, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopScrubbing);
      window.removeEventListener("pointercancel", stopScrubbing);
      window.removeEventListener("blur", stopScrubbing);
    };
  }, [isScrubbing, scrubPointerId, updatePlayheadFromPointer]);

  useEffect(() => {
    const video = previewVideoRef.current;

    if (!video) {
      return;
    }

    video.playbackRate = previewMode === "media" ? 1 : previewSpeed;
    video.volume =
      previewMode === "media" ? mediaPreviewVolume : Math.min(previewVolume, 1);
    video.muted = previewMode === "media" ? false : previewVideoMuted;

    if (previewSource?.src !== previewSourceRef.current) {
      previewSourceRef.current = previewSource?.src ?? null;
    }

    const desiredTime =
      previewMode === "timeline"
        ? topVisibleVideoClip
          ? Math.max(
              0,
              getClipSourceTime(topVisibleVideoClip, playheadFrame, fps),
            )
          : 0
        : mediaPreviewTime;
    if (Math.abs(video.currentTime - desiredTime) > 0.12) {
      video.currentTime = desiredTime;
    }

    const shouldPlay =
      previewMode === "media" ? isMediaPreviewPlaying : isPreviewPlaying;
    if (!shouldPlay) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [
    isPreviewPlaying,
    isMediaPreviewPlaying,
    mediaPreviewTime,
    mediaPreviewVolume,
    playheadFrame,
    previewSource?.src,
    previewSpeed,
    previewVolume,
    previewVideoMuted,
    previewMode,
    topVisibleVideoClip,
  ]);

  useEffect(() => {
    const activeIds = new Set(activeVideoLayers.map((clip) => clip.id));
    const renderedClips = new Map<string, TimelineClip>();
    for (const clip of timelinePreviewVideoClips) {
      renderedClips.set(clip.id, clip);
    }

    for (const [clipId, video] of previewLayerVideoRefs.current) {
      const videoClip = renderedClips.get(clipId);
      if (!videoClip || !video.isConnected) {
        video.pause();
        previewLayerVideoRefs.current.delete(clipId);
        continue;
      }

      const isActive = activeIds.has(clipId);
      const transitionPresentation = getClipTransitionPresentation(
        clips,
        clipId,
        playheadFrame,
      );
      const participatesInTransition =
        transitionPresentation.opacity !== 1 ||
        transitionPresentation.translateX !== 0 ||
        transitionPresentation.scale !== 1;
      const previewFrame = isActive
        ? playheadFrame
        : playheadFrame < videoClip.start
          ? videoClip.start
          : videoClip.start + videoClip.duration - 1;
      const videoMuted =
        !isActive ||
        (videoClip.volume ?? 1) === 0 ||
        shouldMuteVideoNativeAudio(clips, playheadFrame, clipId);
      const desiredTime = Math.max(
        0,
        getClipSourceTime(videoClip, previewFrame, fps),
      );
      const seekTolerance = isPreviewPlaying && isActive ? 0.45 : 0.04;

      video.playbackRate = videoClip.speed ?? 1;
      video.volume = Math.min(videoClip.volume ?? 1, 1);
      video.muted = videoMuted;
      if (Math.abs(video.currentTime - desiredTime) > seekTolerance) {
        video.currentTime = desiredTime;
      }

      if (isPreviewPlaying && (isActive || participatesInTransition)) {
        if (video.paused) {
          void video.play().catch(() => undefined);
        }
      } else if (!video.paused) {
        video.pause();
      }
    }
  }, [
    activeVideoLayers,
    clips,
    isPreviewPlaying,
    playheadFrame,
    timelinePreviewVideoClips,
  ]);

  useEffect(() => {
    const activeAudio = new Map(
      playbackAudioClips.map((audioClip) => [audioClip.id, audioClip]),
    );

    for (const [clipId, audio] of previewAudioRefs.current) {
      const audioClip = activeAudio.get(clipId);
      if (!audioClip || !audio.isConnected) {
        audio.pause();
        previewAudioRefs.current.delete(clipId);
        continue;
      }

      const desiredTime = Math.max(
        0,
        getClipSourceTime(audioClip, playheadFrame, fps),
      );
      const seekTolerance = isPreviewPlaying ? 0.45 : 0.04;
      audio.playbackRate = audioClip.speed ?? 1;
      audio.volume = Math.min(audioClip.volume ?? 1, 1);
      if (Math.abs(audio.currentTime - desiredTime) > seekTolerance) {
        audio.currentTime = desiredTime;
      }

      if (isPreviewPlaying) {
        if (audio.paused) {
          void audio.play().catch(() => undefined);
        }
      } else if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPreviewPlaying, playbackAudioClips, playheadFrame]);

  useEffect(() => {
    if (previewMode === "timeline") {
      previewVideoRef.current?.pause();
      setIsMediaPreviewPlaying(false);
    } else {
      setIsPreviewPlaying(false);
    }
  }, [previewMode]);

  useEffect(() => {
    return () => voiceRecorderRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!isPreviewPlaying || previewMode !== "timeline") {
      return;
    }

    const playbackTimer = window.setInterval(() => {
      setPlayheadFrame((currentFrame) => {
        const playbackStep = stepTimelinePlayback(
          currentFrame,
          videoPlaybackDuration,
          false,
        );

        if (!playbackStep.continues) {
          setIsPreviewPlaying(false);
        }

        return playbackStep.nextFrame;
      });
    }, 100);

    return () => {
      window.clearInterval(playbackTimer);
    };
  }, [isPreviewPlaying, previewMode, videoPlaybackDuration]);

  useEffect(() => {
    if (
      !isPreviewPlaying ||
      previewMode !== "timeline" ||
      isScrubbing ||
      pointerDrag ||
      trimDrag
    ) {
      return;
    }

    const scrollArea = timelineScrollRef.current;
    const timelineContent = timelineContentRef.current;
    if (!scrollArea || !timelineContent) return;

    const nextScrollLeft = getPlaybackFollowScrollLeft({
      scrollLeft: scrollArea.scrollLeft,
      viewportWidth: scrollArea.clientWidth,
      contentWidth: timelineContent.scrollWidth,
      playheadX: timelineOrigin + playheadFrame * timelineScale,
    });
    if (Math.abs(nextScrollLeft - scrollArea.scrollLeft) < 1) return;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollArea.scrollLeft = nextScrollLeft;
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    isPreviewPlaying,
    isScrubbing,
    playheadFrame,
    pointerDrag,
    previewMode,
    timelineOrigin,
    timelineScale,
    trimDrag,
  ]);

  return (
    <main className="editor-shell">
      <svg className="chroma-key-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="cutout-chroma-green" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 -1.15 1 0 0"
            />
          </filter>
          <filter id="cutout-chroma-white" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 2.85"
            />
          </filter>
          <filter id="cutout-chroma-black" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"
            />
          </filter>
        </defs>
      </svg>
      <section className="topbar">
        <div className="brand">Video Editor</div>
        <nav className="tool-tabs" aria-label="Editing tools">
          <button
            className={activeTool === "media" ? "active-tool" : ""}
            type="button"
            onClick={() => {
              setActiveTool("media");
              abortAutoCaptionRequest();
            }}
          >
            Media
          </button>
          <button
            className={activeTool === "audio" ? "active-tool" : ""}
            type="button"
            onClick={openAudioControls}
          >
            Audio
          </button>
          <button
            className={activeTool === "text" ? "active-tool" : ""}
            type="button"
            onClick={() => setActiveTool("text")}
          >
            Text
          </button>
          <button
            className={activeTool === "stickers" ? "active-tool" : ""}
            type="button"
            onClick={() => setActiveTool("stickers")}
          >
            Stickers
          </button>
          <button
            className={activeTool === "cutout" ? "active-tool" : ""}
            type="button"
            onClick={() => setActiveTool("cutout")}
          >
            Cutout
          </button>
          <button
            className={activeTool === "animations" ? "active-tool" : ""}
            type="button"
            onClick={() => openVisualTool("animations")}
          >
            Animations
          </button>
          <button
            className={activeTool === "effects" ? "active-tool" : ""}
            type="button"
            onClick={() => openVisualTool("effects")}
          >
            Effects
          </button>
          <button
            className={activeTool === "captions" ? "active-tool" : ""}
            type="button"
            onClick={() => setActiveTool("captions")}
          >
            Captions
          </button>
          <button
            className={activeTool === "transcript" ? "active-tool" : ""}
            type="button"
            onClick={() => setActiveTool("transcript")}
          >
            Transcript
          </button>
          <button
            className={activeTool === "filters" ? "active-tool" : ""}
            type="button"
            onClick={() => openVisualTool("filters")}
          >
            Filters
          </button>
          <button
            className={activeTool === "adjustment" ? "active-tool" : ""}
            type="button"
            onClick={() => openVisualTool("adjustment")}
          >
            Adjustment
          </button>
        </nav>
        <div className="project-actions">
          {projectStatus ? (
            <span className="project-status" role="status">
              {projectStatus}
            </span>
          ) : null}
          <button
            className="save-button"
            type="button"
            onClick={saveProjectToStorage}
          >
            Save
          </button>
          <button
            className="export-button"
            type="button"
            disabled={isExporting}
            onClick={() => void exportProjectVideo()}
          >
            {isExporting ? "Rendering..." : "Export"}
          </button>
        </div>
      </section>

      <section
        className={`workspace ${activeTool === "cutout" ? "cutout-workspace" : ""} ${
          activeTool === "text" || activeTool === "stickers"
            ? "library-left-workspace"
            : ""
        }`}
      >
        <aside className="media-panel">
          <div className="media-library">
            {activeTool === "media" ? (
              <>
                <div className="library-actions">
                  <button
                    className="import-button"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import
                  </button>
                  <button
                    className={`record-button ${isRecording ? "is-recording" : ""}`}
                    type="button"
                    onClick={() => void toggleVoiceRecording()}
                    aria-label={
                      isRecording
                        ? "Stop voice recording"
                        : "Record voice narration"
                    }
                  >
                    {isRecording ? "Stop" : "Record"}
                  </button>
                  <input
                    ref={fileInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={importMediaFromGallery}
                  />
                </div>
                {recordingError ? (
                  <div className="recording-error" role="alert">
                    {recordingError}
                  </div>
                ) : null}

                <div className="media-grid" aria-label="Imported media">
                  {analyzingMediaItems.map((analyzingItem) => (
                    <div
                      className="media-thumb is-analyzing"
                      draggable={false}
                      key={analyzingItem.id}
                      role="status"
                    >
                      <div className="media-analysis-content">
                        <span
                          className="media-analysis-spinner"
                          aria-hidden="true"
                        />
                        <span>Detecting scenes...</span>
                      </div>
                      <strong>{analyzingItem.label}</strong>
                    </div>
                  ))}
                  {mediaItems.map((mediaItem) => (
                    <div
                      className={`media-thumb ${selectedMediaIds.includes(mediaItem.id) ? "selected-media" : ""} ${selectedMediaId === mediaItem.id ? "active-media" : ""}`}
                      key={mediaItem.id}
                    >
                      <button
                        className="media-thumb-select"
                        type="button"
                        aria-pressed={selectedMediaIds.includes(mediaItem.id)}
                        onPointerDown={(event) => {
                          startMediaDrag(event, mediaItem);
                        }}
                        onClick={(event) => {
                          if (suppressMediaClickRef.current) {
                            suppressMediaClickRef.current = false;
                            return;
                          }
                          chooseMedia(
                            mediaItem,
                            event.ctrlKey || event.metaKey,
                          );
                        }}
                      >
                        {mediaItem.sourceGroupIndex !== undefined ? (
                          <span className="added-chip scene-chip">
                            {mediaItem.label}
                          </span>
                        ) : (
                          <span className="added-chip">Added</span>
                        )}
                        {getMediaItemType(mediaItem) === "image" ? (
                          <Img
                            className="media-thumb-image"
                            src={resolveMediaSource(mediaItem.src)}
                          />
                        ) : (
                          // eslint-disable-next-line @remotion/warn-native-media-tag
                          <video
                            className="media-thumb-video"
                            src={resolveMediaSource(mediaItem.src)}
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(event) => {
                              if (mediaItem.sourceFileId) {
                                event.currentTarget.currentTime =
                                  (mediaItem.sourceStart ?? 0) / fps;
                                return;
                              }
                              const durationInFrames = durationToFrames(
                                event.currentTarget.duration,
                              );
                              setMediaItems((currentItems) =>
                                currentItems.map((item) =>
                                  item.id === mediaItem.id
                                    ? {
                                        ...item,
                                        durationInFrames,
                                        duration:
                                          formatMediaDuration(durationInFrames),
                                        mediaType: "video",
                                      }
                                    : item,
                                ),
                              );
                            }}
                          />
                        )}
                        <span className="media-duration">
                          {mediaItem.duration}
                        </span>
                        <strong>{mediaItem.label}</strong>
                      </button>
                      {selectedMediaId === mediaItem.id &&
                      getMediaItemType(mediaItem) === "video" ? (
                        <button
                          aria-label={`Trim ${mediaItem.label}`}
                          title="Trim video"
                          className="media-split-button"
                          type="button"
                          disabled={mediaItem.durationInFrames <= 1}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openMediaTrimEditor(mediaItem);
                          }}
                        >
                          <span aria-hidden="true">&#9986;</span>
                        </button>
                      ) : null}
                      <button
                        aria-label={`Delete ${mediaItem.label}`}
                        title={`Delete ${mediaItem.label}`}
                        className="media-delete-button"
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          deleteMediaItem(mediaItem.id);
                        }}
                      >
                        <span aria-hidden="true">&#128465;</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : activeTool === "cutout" ? (
              <div className="cutout-tool-panel">
                <button
                  className="import-button"
                  type="button"
                  onClick={() => cutoutInputRef.current?.click()}
                  disabled={isAutoCutoutLoading}
                >
                  {isAutoCutoutLoading
                    ? "Removing background..."
                    : "Import cutout"}
                </button>
                <input
                  ref={cutoutInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(event) => void importCutoutFromGallery(event)}
                />
                <p>Image and video backgrounds are removed automatically.</p>
                <div className="cutout-format-hint">
                  The original source stays available for restore and audio.
                </div>
                <div className="cutout-mask-controls">
                  <strong>Background</strong>
                  <div
                    className="cutout-mode-control"
                    role="group"
                    aria-label="Cutout editing mode"
                  >
                    <button
                      type="button"
                      className={
                        cutoutBrushMode === "move" ? "selected-option" : ""
                      }
                      aria-label="Move cutout"
                      title="Move and resize"
                      onClick={() => setCutoutBrushMode("move")}
                      disabled={isAutoCutoutLoading}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      className={
                        cutoutBrushMode === "erase" ? "selected-option" : ""
                      }
                      aria-label="Erase cutout background"
                      title="Erase background manually"
                      onClick={() => setCutoutBrushMode("erase")}
                      disabled={!selectedCutoutClip || isAutoCutoutLoading}
                    >
                      Erase
                    </button>
                    <button
                      type="button"
                      className={
                        cutoutBrushMode === "restore" ? "selected-option" : ""
                      }
                      aria-label="Restore cutout background"
                      title="Restore erased areas"
                      onClick={() => setCutoutBrushMode("restore")}
                      disabled={!selectedCutoutClip || isAutoCutoutLoading}
                    >
                      Restore
                    </button>
                  </div>
                  <label className="cutout-brush-control">
                    <span>
                      Brush <strong>{cutoutBrushSize}</strong>
                    </span>
                    <input
                      type="range"
                      min="2"
                      max="32"
                      value={cutoutBrushSize}
                      aria-label="Cutout brush size"
                      onChange={(event) =>
                        setCutoutBrushSize(Number(event.currentTarget.value))
                      }
                      disabled={
                        !selectedCutoutClip ||
                        cutoutBrushMode === "move" ||
                        isAutoCutoutLoading
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-action-button auto-cutout-button"
                    onClick={() => void processSelectedCutoutAutomatically()}
                    disabled={!selectedCutoutClip || isAutoCutoutLoading}
                  >
                    {isAutoCutoutLoading ? "Working..." : "Auto cutout"}
                  </button>
                  <div className="cutout-action-row">
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Split cutout at playhead"
                      title={
                        canSplitSelectedCutout
                          ? "Split at red playhead"
                          : "Place the red playhead inside the selected cutout"
                      }
                      onClick={splitSelectedCutoutAtPlayhead}
                      disabled={!splitCutoutTarget || isAutoCutoutLoading}
                    >
                      ✂
                    </button>
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Reset cutout mask"
                      title="Reset erased areas"
                      onClick={resetSelectedCutoutMask}
                      disabled={!canResetSelectedCutout || isAutoCutoutLoading}
                    >
                      ↺
                    </button>
                  </div>
                  <div className="cutout-history-row">
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Undo cutout edit"
                      title="Undo"
                      onClick={undoLastClipChange}
                      disabled={
                        timelineHistory.past.length === 0 || isAutoCutoutLoading
                      }
                    >
                      ↶
                    </button>
                    <button
                      type="button"
                      className="icon-tool-button"
                      aria-label="Redo cutout edit"
                      title="Redo"
                      onClick={redoLastClipChange}
                      disabled={
                        timelineHistory.future.length === 0 ||
                        isAutoCutoutLoading
                      }
                    >
                      ↷
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTool === "stickers" ? (
              <>
                <div className="library-actions">
                  <button
                    className="import-button"
                    type="button"
                    onClick={() => stickerInputRef.current?.click()}
                  >
                    Upload sticker
                  </button>
                  <input
                    ref={stickerInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/png,image/webp,image/gif"
                    multiple
                    onChange={uploadSticker}
                  />
                </div>
                <div className="sticker-grid" aria-label="Sticker library">
                  {stickerItems.map((stickerItem) => (
                    <button
                      className="sticker-library-item"
                      key={stickerItem.id}
                      type="button"
                      title={`Add ${stickerItem.label} at playhead`}
                      onClick={() => addStickerAtPlayhead(stickerItem)}
                    >
                      {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
                      <img src={stickerItem.src} alt="" />
                      <span>{stickerItem.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : activeTool === "text" ? (
              <div className="text-tool-panel">
                <label htmlFor="text-overlay-input">
                  {selectedTextClip ? "Edit text" : "Text"}
                </label>
                <textarea
                  id="text-overlay-input"
                  value={textDraft}
                  maxLength={120}
                  placeholder={
                    selectedTextClip
                      ? "Edit the selected text"
                      : "Type your text"
                  }
                  onChange={(event) => setTextDraft(event.currentTarget.value)}
                />
                <button
                  className="import-button"
                  type="button"
                  disabled={
                    !textDraft.trim() ||
                    Boolean(
                      selectedTextClip?.text &&
                      textDraft.trim() === selectedTextClip.text.content,
                    )
                  }
                  onClick={
                    selectedTextClip
                      ? commitSelectedTextContent
                      : addTextAtPlayhead
                  }
                >
                  {selectedTextClip ? "Commit changes" : "Add text at playhead"}
                </button>
              </div>
            ) : activeTool === "transcript" ? (
              <div className="transcript-tool-panel">
                <div className="transcript-panel-header">
                  <strong>Audio transcript</strong>
                  <span>{transcriptClips.length} segments</span>
                </div>
                <p className="caption-auto-copy">
                  Select a video on the main or overlay track, then generate a
                  timed transcript from its audio.
                </p>
                {!selectedCaptionSourceClip ? (
                  <p className="caption-auto-hint">
                    Select the video clip you want to transcribe first.
                  </p>
                ) : (
                  <p className="transcript-selected-source">
                    Selected: {selectedCaptionSourceClip.label}
                  </p>
                )}
                <div className="transcript-actions">
                  <button
                    className="import-button"
                    type="button"
                    disabled={
                      isAutoCaptionLoading || !selectedCaptionSourceClip
                    }
                    onClick={generateTranscript}
                  >
                    {isAutoCaptionLoading
                      ? "Working..."
                      : "Generate transcript"}
                  </button>
                  <button
                    className="secondary-action-button"
                    type="button"
                    disabled={isKeepMainVoiceLoading || !canKeepMainVoice}
                    onClick={keepMainVoiceAutomatically}
                  >
                    {isKeepMainVoiceLoading ? "Working..." : "Keep main voice"}
                  </button>
                </div>
                {captionStatus.message ? (
                  <div
                    className={`caption-status caption-status-${captionStatus.kind}`}
                    role={captionStatus.kind === "error" ? "alert" : "status"}
                  >
                    {captionStatus.message}
                  </div>
                ) : null}
                {transcriptClips.length > 0 ? (
                  <div
                    className="transcript-segment-list"
                    aria-label="Transcript segments"
                  >
                    {transcriptClips.map((clip) => (
                      <button
                        className="transcript-segment"
                        key={clip.id}
                        type="button"
                        onClick={() => {
                          setSelectedClipId(clip.id);
                          setSelectedTrack("caption");
                          setCaptionMode("manual");
                          setActiveTool("captions");
                          setPreviewMode("timeline");
                        }}
                      >
                        <span>{formatTimelineClock(clip.start, fps)}</span>
                        <strong>{clip.caption?.content}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : activeTool === "captions" ? (
              <div className="caption-tool-panel">
                {captionMode === "actions" ? (
                  <div
                    className="caption-action-grid"
                    aria-label="Caption actions"
                  >
                    {captionActionTiles.map((tile) => (
                      <button
                        key={tile.mode}
                        className="caption-action-tile"
                        type="button"
                        onClick={() => openCaptionMode(tile.mode)}
                      >
                        <span
                          className="caption-action-icon"
                          aria-hidden="true"
                        >
                          {tile.icon}
                        </span>
                        <span className="caption-action-label">
                          {tile.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="caption-panel-header">
                      <button
                        className="caption-back-button"
                        type="button"
                        onClick={goBackToCaptionActions}
                      >
                        Back
                      </button>
                      <strong>
                        {
                          captionActionTiles.find(
                            (tile) => tile.mode === captionMode,
                          )?.label
                        }
                      </strong>
                    </div>
                    {captionMode === "manual" ? (
                      <div className="caption-manual-form">
                        <label htmlFor="caption-overlay-input">
                          {selectedCaptionClip ? "Edit caption" : "Caption"}
                        </label>
                        <textarea
                          id="caption-overlay-input"
                          value={captionDraft}
                          maxLength={180}
                          placeholder={
                            selectedCaptionClip
                              ? "Edit the selected caption"
                              : "Type your caption"
                          }
                          onChange={(event) => {
                            setCaptionDraft(event.currentTarget.value);
                            resetCaptionStatus();
                          }}
                        />
                        <button
                          className="import-button"
                          type="button"
                          disabled={
                            !captionDraft.trim() ||
                            Boolean(
                              selectedCaptionClip?.caption &&
                              captionDraft.trim() ===
                                selectedCaptionClip.caption.content,
                            )
                          }
                          onClick={
                            selectedCaptionClip
                              ? commitSelectedCaptionContent
                              : addCaptionAtPlayhead
                          }
                        >
                          {selectedCaptionClip
                            ? "Commit changes"
                            : "Add caption at playhead"}
                        </button>
                        {selectedCaptionClip ? (
                          <button
                            className="secondary-action-button"
                            type="button"
                            onClick={() => {
                              setSelectedClipId(null);
                              setCaptionDraft("");
                              resetCaptionStatus();
                            }}
                          >
                            New caption
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {captionMode === "upload" ? (
                      <div className="caption-auto-panel">
                        <p className="caption-auto-copy">
                          Import .srt, .ass, or .lrc captions from a local file.
                        </p>
                        <input
                          ref={captionFileInputRef}
                          className="caption-file-input"
                          type="file"
                          accept=".srt,.ass,.lrc"
                          onChange={uploadCaptionFile}
                        />
                        <p className="caption-auto-hint">
                          Files are parsed locally in your browser and never
                          uploaded.
                        </p>
                      </div>
                    ) : null}
                    {captionMode === "auto" ? (
                      <div className="caption-auto-panel">
                        <p className="caption-auto-copy">
                          Generate captions from the selected main or upper
                          video clip.
                        </p>
                        {!selectedCaptionSourceClip ? (
                          <p className="caption-auto-hint">
                            Select a main or upper video clip before generating
                            auto captions.
                          </p>
                        ) : null}
                        <button
                          className="import-button"
                          type="button"
                          disabled={
                            isAutoCaptionLoading || !selectedCaptionSourceClip
                          }
                          onClick={generateAutoCaptions}
                        >
                          {isAutoCaptionLoading
                            ? "Generating..."
                            : "Generate auto captions"}
                        </button>
                      </div>
                    ) : null}
                    {captionMode === "lyrics" ? (
                      <div className="caption-auto-panel">
                        <p className="caption-auto-copy">
                          Generate lyric captions from the selected main or
                          upper video clip.
                        </p>
                        {!selectedCaptionSourceClip ? (
                          <p className="caption-auto-hint">
                            Select a main or upper video clip before generating
                            auto lyrics.
                          </p>
                        ) : null}
                        <button
                          className="import-button"
                          type="button"
                          disabled={
                            isAutoCaptionLoading || !selectedCaptionSourceClip
                          }
                          onClick={generateAutoLyrics}
                        >
                          {isAutoCaptionLoading
                            ? "Generating..."
                            : "Generate auto lyrics"}
                        </button>
                      </div>
                    ) : null}
                    {captionStatus.message ? (
                      <div
                        className={`caption-status caption-status-${captionStatus.kind}`}
                        role={
                          captionStatus.kind === "error" ? "alert" : "status"
                        }
                      >
                        {captionStatus.message}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : activeTool === "animations" ? (
              <div className="visual-tool-panel animation-tool-panel">
                <strong>Animations</strong>
                <span>
                  Select a main or overlay clip, then choose how it appears.
                </span>
                <div className="visual-option-grid">
                  {animationOptions.map((option) => {
                    const isFavorite = favoriteAnimationIds.includes(option.id);
                    return (
                      <div
                        className={`animation-option-card ${
                          selectedClipAnimation.preset === option.id
                            ? "active-visual-option"
                            : ""
                        }`}
                        key={option.id}
                      >
                        <button
                          className="animation-apply-button"
                          type="button"
                          disabled={!canEditSelectedVisual}
                          onClick={() => updateSelectedClipAnimation(option.id)}
                        >
                          {option.label}
                        </button>
                        {option.id !== "none" ? (
                          <button
                            className={`animation-favorite-button ${
                              isFavorite ? "is-favorite" : ""
                            }`}
                            type="button"
                            aria-label={
                              isFavorite
                                ? `Remove ${option.label} from favorites`
                                : `Favorite ${option.label}`
                            }
                            title={
                              isFavorite
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                            onClick={() => toggleFavoriteAnimation(option.id)}
                          >
                            {isFavorite ? "\u2665" : "\u2661"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div
                  className="animation-segment-control"
                  aria-label="Animation timing"
                >
                  {animationTimingOptions.map((option) => (
                    <button
                      className={
                        selectedClipAnimation.timing === option.id
                          ? "active-animation-choice"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      disabled={!canEditSelectedVisual}
                      onClick={() => updateSelectedAnimationTiming(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="visual-intensity-control">
                  <span>
                    Duration{" "}
                    <em>
                      {(selectedClipAnimation.duration / fps).toFixed(1)}s
                    </em>
                  </span>
                  <input
                    aria-label="Animation duration"
                    type="range"
                    min={6}
                    max={120}
                    step={3}
                    value={selectedClipAnimation.duration}
                    disabled={
                      !canEditSelectedVisual ||
                      selectedClipAnimation.preset === "none"
                    }
                    onChange={(event) =>
                      updateSelectedAnimationDuration(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                </label>
                <div
                  className="animation-segment-control"
                  aria-label="Animation speed feel"
                >
                  {animationEasingOptions.map((option) => (
                    <button
                      className={
                        selectedClipAnimation.easing === option.id
                          ? "active-animation-choice"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      disabled={
                        !canEditSelectedVisual ||
                        selectedClipAnimation.preset === "none"
                      }
                      onClick={() => updateSelectedAnimationEasing(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : activeTool === "effects" ? (
              <div className="visual-tool-panel">
                <strong>Effects</strong>
                <span>
                  Select a main or overlay clip, then choose an effect.
                </span>
                <div className="visual-option-grid">
                  {(clipControlTarget?.track === "cutout"
                    ? cutoutEffectOptions
                    : effectOptions
                  ).map((option) => (
                    <button
                      className={
                        selectedClipEffect === option.id
                          ? "active-visual-option"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      disabled={!canEditSelectedVisual}
                      onClick={() => updateSelectedClipEffect(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="visual-intensity-control">
                  <span>
                    Intensity <em>{selectedEffectIntensity}%</em>
                  </span>
                  <input
                    aria-label="Effect intensity"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={selectedEffectIntensity}
                    disabled={
                      !canEditSelectedVisual || selectedClipEffect === "none"
                    }
                    onChange={(event) =>
                      updateSelectedEffectIntensity(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                </label>
              </div>
            ) : activeTool === "filters" ? (
              <div className="visual-tool-panel">
                <strong>Filters</strong>
                <span>Select a main or overlay clip, then choose a look.</span>
                <div className="visual-option-grid">
                  {filterOptions.map((option) => (
                    <button
                      className={
                        selectedClipFilter === option.id
                          ? "active-visual-option"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      disabled={!canEditSelectedVisual}
                      onClick={() => updateSelectedClipFilter(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="visual-intensity-control">
                  <span>
                    Intensity <em>{selectedFilterIntensity}%</em>
                  </span>
                  <input
                    aria-label="Filter intensity"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={selectedFilterIntensity}
                    disabled={
                      !canEditSelectedVisual || selectedClipFilter === "none"
                    }
                    onChange={(event) =>
                      updateSelectedFilterIntensity(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                </label>
              </div>
            ) : activeTool === "adjustment" ? (
              <div className="adjustment-tool-panel">
                <div className="adjustment-panel-heading">
                  <strong>Transform</strong>
                  <button
                    type="button"
                    disabled={!canEditSelectedVisual}
                    onClick={() =>
                      updateSelectedClipAdjustment(defaultClipAdjustment)
                    }
                  >
                    Reset
                  </button>
                </div>
                <span>Select a main or overlay clip.</span>
                <label>
                  <strong>Zoom</strong>
                  <em>{Math.round(selectedClipAdjustment.scale * 100)}%</em>
                  <input
                    aria-label="Video zoom"
                    type="range"
                    min="0.25"
                    max="4"
                    step="0.05"
                    value={selectedClipAdjustment.scale}
                    disabled={!canEditSelectedVisual}
                    onChange={(event) =>
                      updateSelectedClipAdjustment({
                        scale: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
                <label>
                  <strong>Rotation</strong>
                  <em>{selectedClipAdjustment.rotation}°</em>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={selectedClipAdjustment.rotation}
                    disabled={!canEditSelectedVisual}
                    onChange={(event) =>
                      updateSelectedClipAdjustment({
                        rotation: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
                <div className="rotation-actions" aria-label="Rotate video">
                  <button
                    type="button"
                    title="Rotate left 90 degrees"
                    aria-label="Rotate left 90 degrees"
                    disabled={!canEditSelectedVisual}
                    onClick={() =>
                      updateSelectedClipAdjustment({
                        rotation: Math.max(
                          -180,
                          selectedClipAdjustment.rotation - 90,
                        ),
                      })
                    }
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    title="Rotate right 90 degrees"
                    aria-label="Rotate right 90 degrees"
                    disabled={!canEditSelectedVisual}
                    onClick={() =>
                      updateSelectedClipAdjustment({
                        rotation: Math.min(
                          180,
                          selectedClipAdjustment.rotation + 90,
                        ),
                      })
                    }
                  >
                    ↷
                  </button>
                </div>
                <strong className="crop-heading">Crop edges</strong>
                <div className="crop-mode-switch" aria-label="Crop input mode">
                  <button
                    className={
                      cropInputMode === "sliders" ? "active-crop-mode" : ""
                    }
                    type="button"
                    onClick={() => setCropInputMode("sliders")}
                  >
                    Sliders
                  </button>
                  <button
                    className={
                      cropInputMode === "manual" ? "active-crop-mode" : ""
                    }
                    type="button"
                    disabled={!canEditSelectedVisual}
                    onClick={() => {
                      setCropInputMode("manual");
                      setPreviewMode("timeline");
                    }}
                  >
                    On canvas
                  </button>
                </div>
                {cropInputMode === "sliders" ? (
                  <div className="crop-control-grid">
                    {(
                      [
                        ["Top", "cropTop"],
                        ["Right", "cropRight"],
                        ["Bottom", "cropBottom"],
                        ["Left", "cropLeft"],
                      ] as Array<[string, keyof ClipAdjustment]>
                    ).map(([label, property]) => (
                      <label key={property}>
                        <span>{label}</span>
                        <em>{selectedClipAdjustment[property]}%</em>
                        <input
                          type="range"
                          min="0"
                          max="45"
                          step="1"
                          value={selectedClipAdjustment[property]}
                          disabled={!canEditSelectedVisual}
                          onChange={(event) =>
                            updateSelectedClipAdjustment({
                              [property]: Number(event.currentTarget.value),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="library-actions">
                <button
                  className="import-button"
                  type="button"
                  onClick={() => musicInputRef.current?.click()}
                >
                  Import audio
                </button>
                <button
                  className={`record-button ${isRecording ? "is-recording" : ""}`}
                  type="button"
                  onClick={() => void toggleVoiceRecording()}
                  aria-label={
                    isRecording
                      ? "Stop voice recording"
                      : "Record voice narration"
                  }
                >
                  {isRecording ? "Stop" : "Record"}
                </button>
                <input
                  ref={musicInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept="audio/*,video/*"
                  multiple
                  onChange={importAudioSources}
                />
              </div>
            )}
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-shell">
            <div
              className="preview-window"
              ref={previewWindowRef}
              onMouseLeave={closeMediaPreviewVolumeIfInactive}
              onBlurCapture={handleMediaPreviewBlur}
            >
              {previewSource?.src || isTimelinePreview ? (
                <>
                  {isTimelinePreview ? (
                    <Fragment>
                      {activeVideoLayers
                        .filter((videoClip) => isImageClip(videoClip))
                        .map((videoClip) => (
                          <Img
                            key={videoClip.id}
                            className="preview-image preview-layer-image"
                            data-video-layer={getVideoLayer(videoClip)}
                            src={resolveMediaSource(videoClip.src ?? "")}
                            style={{
                              ...getClipFrameStyle(videoClip, playheadFrame),
                              ...getClipAdjustmentStyle(videoClip),
                              ...getCutoutChromaKeyStyle(videoClip),
                              zIndex: getPreviewVideoLayerZIndex(videoClip),
                            }}
                          />
                        ))}
                      {timelinePreviewVideoClips.map((videoClip) => {
                        const activeIndex = activeVideoLayers.findIndex(
                          (activeClip) => activeClip.id === videoClip.id,
                        );
                        const isActiveVideoClip = activeIndex >= 0;
                        const transitionPresentation =
                          getClipTransitionPresentation(
                            clips,
                            videoClip.id,
                            playheadFrame,
                          );
                        const isTransitionPreviewClip =
                          transitionPresentation.opacity !== 1 ||
                          transitionPresentation.translateX !== 0 ||
                          transitionPresentation.scale !== 1;
                        const isVisibleVideoClip =
                          isActiveVideoClip || isTransitionPreviewClip;
                        const videoMuted =
                          !isActiveVideoClip ||
                          (videoClip.volume ?? 1) === 0 ||
                          shouldMuteVideoNativeAudio(
                            clips,
                            playheadFrame,
                            videoClip.id,
                          );

                        return (
                          // eslint-disable-next-line @remotion/warn-native-media-tag
                          <video
                            key={videoClip.id}
                            className="preview-video preview-layer-video"
                            data-video-layer={getVideoLayer(videoClip)}
                            src={resolveMediaSource(videoClip.src ?? "")}
                            muted={videoMuted}
                            playsInline
                            preload="auto"
                            onLoadedMetadata={(event) =>
                              reconcileTimelineClipSourceDuration(
                                videoClip,
                                event,
                              )
                            }
                            onError={() =>
                              recoverUnavailableVideo(videoClip.id)
                            }
                            style={{
                              ...getClipFrameStyle(
                                videoClip,
                                playheadFrame,
                                transitionPresentation,
                              ),
                              ...getClipAdjustmentStyle(videoClip),
                              visibility: isVisibleVideoClip
                                ? "visible"
                                : "hidden",
                              zIndex: getPreviewVideoLayerZIndex(videoClip),
                            }}
                            ref={(video) => {
                              if (video) {
                                previewLayerVideoRefs.current.set(
                                  videoClip.id,
                                  video,
                                );
                              } else {
                                previewLayerVideoRefs.current.delete(
                                  videoClip.id,
                                );
                              }
                            }}
                          />
                        );
                      })}
                    </Fragment>
                  ) : previewSource?.src && isImageClip(previewSource) ? (
                    <Img
                      className="preview-image"
                      src={resolveMediaSource(previewSource.src)}
                      style={{
                        ...getClipFrameStyle(undefined, playheadFrame),
                        ...getClipAdjustmentStyle(),
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @remotion/warn-native-media-tag
                    <video
                      ref={previewVideoRef}
                      className="preview-video"
                      src={resolveMediaSource(previewSource?.src ?? "")}
                      muted={
                        previewMode === "media" ? false : previewVideoMuted
                      }
                      playsInline
                      onLoadedMetadata={handleMediaPreviewMetadata}
                      onTimeUpdate={handleMediaPreviewTimeUpdate}
                      onEnded={handleMediaPreviewEnded}
                      style={{
                        ...getClipFrameStyle(undefined, playheadFrame),
                        ...getClipAdjustmentStyle(),
                      }}
                    />
                  )}
                  {isTimelinePreview
                    ? playbackAudioClips.map((audioClip) => (
                        // eslint-disable-next-line @remotion/warn-native-media-tag
                        <audio
                          key={audioClip.id}
                          src={resolveMediaSource(audioClip.src ?? "")}
                          ref={(audio) => {
                            if (audio) {
                              previewAudioRefs.current.set(audioClip.id, audio);
                            } else {
                              previewAudioRefs.current.delete(audioClip.id);
                            }
                          }}
                        />
                      ))
                    : null}
                  {isTimelinePreview
                    ? activeCutoutClips.map((cutoutClip, cutoutIndex) => {
                        const transform = cutoutClip.cutout!;
                        const cutoutScaleX =
                          transform.scaleX ?? transform.scale;
                        const cutoutScaleY =
                          transform.scaleY ?? transform.scale;
                        const fixedControlScale: CSSProperties = {
                          scale: `${1 / Math.max(0.08, cutoutScaleX)} ${1 / Math.max(0.08, cutoutScaleY)}`,
                        };
                        const rotateControlStyle: CSSProperties = {
                          ...fixedControlScale,
                          top: `${-30 / Math.max(0.08, cutoutScaleY)}px`,
                        };
                        const deleteControlStyle: CSSProperties = {
                          ...fixedControlScale,
                          top: `${-25 / Math.max(0.08, cutoutScaleY)}px`,
                          right: `${-25 / Math.max(0.08, cutoutScaleX)}px`,
                        };
                        const isSelected = selectedClipId === cutoutClip.id;
                        const isMasking =
                          isSelected &&
                          (cutoutBrushMode === "erase" ||
                            cutoutBrushMode === "restore");
                        const cutoutCursorClass = !isMasking
                          ? ""
                          : cutoutBrushMode === "erase"
                            ? "erase-cutout-cursor"
                            : "restore-cutout-cursor";
                        const maskUrl = transform.maskStrokes?.length
                          ? createCutoutMaskDataUrl(transform)
                          : undefined;
                        const maskStyle: CSSProperties = maskUrl
                          ? {
                              WebkitMaskImage: `url("${maskUrl}")`,
                              maskImage: `url("${maskUrl}")`,
                              WebkitMaskSize: "100% 100%",
                              maskSize: "100% 100%",
                              WebkitMaskRepeat: "no-repeat",
                              maskRepeat: "no-repeat",
                            }
                          : {};
                        const restoreMaskUrl = transform.originalSrc
                          ? createCutoutRestoreMaskDataUrl(transform)
                          : undefined;
                        const restoreMaskStyle: CSSProperties = restoreMaskUrl
                          ? {
                              WebkitMaskImage: `url("${restoreMaskUrl}")`,
                              maskImage: `url("${restoreMaskUrl}")`,
                              WebkitMaskSize: "100% 100%",
                              maskSize: "100% 100%",
                              WebkitMaskRepeat: "no-repeat",
                              maskRepeat: "no-repeat",
                            }
                          : {};
                        const cutoutVisual = getClipVisualPresentation(
                          cutoutClip,
                          playheadFrame,
                        );
                        const cutoutChroma = getCutoutChromaKeyStyle(transform);
                        const cutoutFilters = [
                          cutoutChroma.filter,
                          cutoutVisual.filter,
                        ]
                          .filter((value) => value && value !== "none")
                          .join(" ");
                        const cutoutMediaStyle: CSSProperties = {
                          ...maskStyle,
                          ...cutoutChroma,
                          filter: cutoutFilters || undefined,
                          opacity: cutoutVisual.opacity,
                          scale: cutoutVisual.scale,
                        };

                        return (
                          <div
                            className={`preview-cutout ${isSelected ? "selected-preview-cutout" : ""} ${isMasking ? "is-masking" : ""} ${cutoutCursorClass}`}
                            key={cutoutClip.id}
                            data-cutout-id={cutoutClip.id}
                            style={{
                              left: `${transform.x}%`,
                              top: `${transform.y}%`,
                              translate: "-50% -50%",
                              scale: `${cutoutScaleX} ${cutoutScaleY}`,
                              rotate: `${transform.rotation}deg`,
                              zIndex: 20 + cutoutIndex,
                            }}
                            onPointerDown={(event) => {
                              if (isMasking) {
                                startCutoutMaskStroke(
                                  event,
                                  cutoutClip,
                                  cutoutBrushMode,
                                );
                              } else {
                                startCutoutInteraction(
                                  event,
                                  cutoutClip,
                                  "move",
                                );
                              }
                            }}
                          >
                            {transform.mediaKind === "video" ? (
                              // eslint-disable-next-line @remotion/warn-native-media-tag
                              <video
                                className="preview-cutout-media"
                                src={resolveMediaSource(cutoutClip.src ?? "")}
                                muted
                                playsInline
                                disablePictureInPicture
                                controlsList="nodownload noplaybackrate nopictureinpicture"
                                draggable={false}
                                style={cutoutMediaStyle}
                                ref={(video) => {
                                  if (!video) return;
                                  video.playbackRate = cutoutClip.speed ?? 1;
                                  const desiredTime = Math.max(
                                    0,
                                    getClipSourceTime(
                                      cutoutClip,
                                      playheadFrame,
                                      fps,
                                    ),
                                  );
                                  if (
                                    Math.abs(video.currentTime - desiredTime) >
                                    0.12
                                  ) {
                                    video.currentTime = desiredTime;
                                  }
                                  if (isPreviewPlaying) {
                                    void video.play().catch(() => undefined);
                                  } else {
                                    video.pause();
                                  }
                                }}
                              />
                            ) : (
                              // eslint-disable-next-line @remotion/warn-native-media-tag
                              <img
                                className="preview-cutout-media"
                                src={resolveMediaSource(cutoutClip.src ?? "")}
                                alt={cutoutClip.label}
                                draggable={false}
                                style={cutoutMediaStyle}
                              />
                            )}
                            {transform.mediaKind === "image" &&
                            transform.originalSrc ? (
                              // eslint-disable-next-line @remotion/warn-native-media-tag
                              <img
                                className="preview-cutout-original"
                                src={resolveMediaSource(transform.originalSrc)}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                style={restoreMaskStyle}
                              />
                            ) : null}
                            {isSelected ? (
                              <>
                                <button
                                  className="cutout-rotate-handle"
                                  style={rotateControlStyle}
                                  type="button"
                                  aria-label="Rotate cutout"
                                  title="Drag to rotate"
                                  onPointerDown={(event) =>
                                    startCutoutInteraction(
                                      event,
                                      cutoutClip,
                                      "rotate",
                                    )
                                  }
                                />
                                {(
                                  [
                                    "top-left",
                                    "top",
                                    "top-right",
                                    "right",
                                    "bottom-right",
                                    "bottom",
                                    "bottom-left",
                                    "left",
                                  ] as CaptionResizeHandle[]
                                ).map((handle) => (
                                  <span
                                    className={`cutout-resize-handle cutout-resize-handle-${handle}`}
                                    key={handle}
                                    role="presentation"
                                    style={fixedControlScale}
                                    onPointerDown={(event) =>
                                      startCutoutInteraction(
                                        event,
                                        cutoutClip,
                                        "resize",
                                        handle,
                                      )
                                    }
                                  />
                                ))}
                                <button
                                  className="cutout-delete-button"
                                  style={deleteControlStyle}
                                  type="button"
                                  aria-label="Delete cutout"
                                  title="Delete cutout"
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onClick={deleteSelectedClip}
                                >
                                  ×
                                </button>
                              </>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                  {activeTool === "adjustment" &&
                  cropInputMode === "manual" &&
                  canEditSelectedVisual &&
                  isTimelinePreview ? (
                    <>
                      <div
                        className="manual-crop-frame"
                        style={{
                          top: `${selectedClipAdjustment.cropTop}%`,
                          right: `${selectedClipAdjustment.cropRight}%`,
                          bottom: `${selectedClipAdjustment.cropBottom}%`,
                          left: `${selectedClipAdjustment.cropLeft}%`,
                        }}
                      >
                        <div
                          className={`crop-pan-surface ${
                            adjustmentPanDrag ? "is-panning" : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          aria-label="Drag to reposition video"
                          title="Drag to reposition. Scroll to zoom."
                          onPointerDown={startManualAdjustmentPan}
                          onWheel={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            updateSelectedClipAdjustment({
                              scale:
                                selectedClipAdjustment.scale +
                                (event.deltaY < 0 ? 0.1 : -0.1),
                            });
                          }}
                        />
                        <div
                          className="crop-canvas-toolbar"
                          aria-label="Canvas zoom controls"
                        >
                          <button
                            type="button"
                            aria-label="Zoom out"
                            title="Zoom out"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() =>
                              updateSelectedClipAdjustment({
                                scale: selectedClipAdjustment.scale - 0.1,
                              })
                            }
                          >
                            &minus;
                          </button>
                          <output>
                            {Math.round(selectedClipAdjustment.scale * 100)}%
                          </output>
                          <button
                            type="button"
                            aria-label="Zoom in"
                            title="Zoom in"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() =>
                              updateSelectedClipAdjustment({
                                scale: selectedClipAdjustment.scale + 0.1,
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                        {(
                          [
                            "top",
                            "right",
                            "bottom",
                            "left",
                            "top-left",
                            "top-right",
                            "bottom-left",
                            "bottom-right",
                          ] as CropEdge[]
                        ).map((edge) => (
                          <button
                            className={`crop-handle crop-handle-${edge}`}
                            key={edge}
                            type="button"
                            aria-label={`Crop ${edge}`}
                            onPointerDown={(event) =>
                              startManualCrop(event, edge)
                            }
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                  {isTimelinePreview && activeCaptionClips.length > 0 ? (
                    <div className="preview-caption-stack">
                      {activeCaptionClips.map((captionClip, captionIndex) => {
                        const caption = captionClip.caption;
                        if (!caption) {
                          return null;
                        }

                        const captionPosition = getCaptionPosition(caption);
                        const captionDisplayColors =
                          getTextualClipDisplayColors(captionClip);

                        return (
                          <button
                            aria-label={`Select caption: ${caption.content}`}
                            className={`preview-caption ${
                              selectedClipId === captionClip.id
                                ? "selected-preview-caption"
                                : ""
                            }`}
                            key={captionClip.id}
                            type="button"
                            style={{
                              left: `${captionPosition.x}%`,
                              top: `${captionPosition.y}%`,
                              color: captionDisplayColors.textColor,
                              fontSize: `${caption.fontSize}px`,
                              fontFamily: caption.fontFamily ?? "Inter",
                              fontWeight: caption.fontWeight ?? "900",
                              background:
                                captionDisplayColors.backgroundColor,
                              ...getTextEffectStyle(caption.effect ?? "shadow"),
                              ...getCaptionAnimationStyle(
                                caption,
                                captionClip,
                                playheadFrame,
                              ),
                              zIndex: 24 + captionIndex,
                            }}
                            onPointerDown={(event) =>
                              startCaptionPreviewDrag(event, captionClip)
                            }
                            onClick={() => selectTimelineClip(captionClip)}
                          >
                            {caption.content}
                            {selectedClipId === captionClip.id ? (
                              <>
                                <span
                                  className="caption-resize-handle caption-resize-handle-top-left"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "top-left",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-top"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "top",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-top-right"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "top-right",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-right"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "right",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-bottom-right"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "bottom-right",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-bottom"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "bottom",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-bottom-left"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "bottom-left",
                                    )
                                  }
                                />
                                <span
                                  className="caption-resize-handle caption-resize-handle-left"
                                  onPointerDown={(event) =>
                                    startCaptionResizeDrag(
                                      event,
                                      captionClip,
                                      "left",
                                    )
                                  }
                                />
                              </>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {isTimelinePreview
                    ? activeStickerClips.map((stickerClip, stickerIndex) => {
                        if (!stickerClip.src) {
                          return null;
                        }

                        const transform = stickerClip.sticker ?? {
                          x: 50,
                          y: 50,
                          scale: 1,
                          rotation: 0,
                        };
                        const isSelected = selectedClipId === stickerClip.id;
                        return (
                          <div
                            className={`preview-sticker ${isSelected ? "selected-preview-sticker" : ""}`}
                            key={stickerClip.id}
                            style={{
                              left: `${transform.x}%`,
                              top: `${transform.y}%`,
                              translate: "-50% -50%",
                              scale: transform.scale,
                              rotate: `${transform.rotation}deg`,
                              zIndex: 30 + stickerIndex,
                            }}
                            onPointerDown={(event) =>
                              startStickerInteraction(
                                event,
                                stickerClip,
                                "move",
                              )
                            }
                          >
                            {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
                            <img
                              src={stickerClip.src ?? ""}
                              alt={stickerClip.label}
                              draggable={false}
                            />
                            {isSelected ? (
                              <>
                                <button
                                  className="sticker-rotate-handle"
                                  type="button"
                                  aria-label="Rotate sticker"
                                  title="Drag to rotate"
                                  onPointerDown={(event) =>
                                    startStickerInteraction(
                                      event,
                                      stickerClip,
                                      "rotate",
                                    )
                                  }
                                />
                                <button
                                  className="sticker-scale-handle"
                                  type="button"
                                  aria-label="Resize sticker"
                                  title="Drag to resize"
                                  onPointerDown={(event) =>
                                    startStickerInteraction(
                                      event,
                                      stickerClip,
                                      "scale",
                                    )
                                  }
                                />
                                <div className="sticker-quick-actions">
                                  <button
                                    type="button"
                                    aria-label="Duplicate sticker"
                                    title="Duplicate"
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onClick={duplicateSelectedSticker}
                                  >
                                    ⧉
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Delete sticker"
                                    title="Delete"
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onClick={deleteSelectedClip}
                                  >
                                    ×
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                  {isTimelinePreview
                    ? activeTextClips.map((textClip, textIndex) => {
                        const text = textClip.text;
                        if (!text) return null;
                        const textDisplayColors =
                          getTextualClipDisplayColors(textClip);
                        const textAnimation = getTextAnimationPresentation(
                          textClip,
                          playheadFrame,
                        );
                        const rendersWords = [
                          "star-jump",
                          "bounce",
                          "wave",
                        ].includes(text.animation ?? "none");
                        const wordTokens = rendersWords
                          ? text.content.split(/(\s+)/)
                          : [];
                        const wordCount = wordTokens.filter(
                          (token) => token && !/^\s+$/.test(token),
                        ).length;
                        let wordIndex = 0;

                        return (
                          <div
                            aria-label={`Move text: ${text.content}`}
                            className={`preview-text-overlay text-animation-${text.animation ?? "none"} ${
                              selectedClipId === textClip.id
                                ? "selected-preview-text"
                                : ""
                            } ${textPreviewDrag?.clipId === textClip.id ? "dragging-preview-text" : ""}`}
                            key={textClip.id}
                            role="button"
                            tabIndex={0}
                            style={{
                              left: `${text.x}%`,
                              top: `${text.y}%`,
                              rotate: `${(text.rotation ?? 0) + textAnimation.rotation}deg`,
                              opacity: textAnimation.opacity,
                              color: textDisplayColors.textColor,
                              background: textDisplayColors.backgroundColor,
                              fontFamily: text.fontFamily ?? "Inter",
                              fontSize: `${text.fontSize}px`,
                              fontStyle: text.fontStyle ?? "normal",
                              fontWeight: text.fontWeight ?? "900",
                              width: text.boxWidth
                                ? `${text.boxWidth}%`
                                : undefined,
                              height: text.boxHeight
                                ? `${text.boxHeight}%`
                                : undefined,
                              scale: textAnimation.scale,
                              translate: `-50% calc(-50% + ${textAnimation.translateY}px)`,
                              ...getTextEffectStyle(text.effect ?? "none"),
                              zIndex: 50 + textIndex,
                            }}
                            onClick={() => selectTimelineClip(textClip)}
                            onPointerDown={(event) =>
                              startTextPreviewDrag(event, textClip)
                            }
                          >
                            <span className="preview-text-content">
                              {text.animation === "typewriter"
                                ? text.content.slice(
                                    0,
                                    getTextAnimationVisibleCharacterCount(
                                      textClip,
                                      playheadFrame,
                                    ),
                                  )
                                : rendersWords
                                  ? wordTokens.map((token, tokenIndex) => {
                                      if (!token || /^\s+$/.test(token)) {
                                        return (
                                          <Fragment
                                            key={`${textClip.id}-space-${tokenIndex}`}
                                          >
                                            {token}
                                          </Fragment>
                                        );
                                      }

                                      const currentWordIndex = wordIndex;
                                      wordIndex += 1;
                                      const wordAnimation =
                                        getTextAnimationWordPresentation(
                                          textClip,
                                          playheadFrame,
                                          currentWordIndex,
                                          wordCount,
                                        );
                                      const stars = getTextAnimationStars(
                                        textClip,
                                        playheadFrame,
                                        currentWordIndex,
                                        wordCount,
                                      );

                                      return (
                                        <span
                                          className="animated-text-word"
                                          key={`${textClip.id}-word-${tokenIndex}`}
                                          style={{
                                            opacity: wordAnimation.opacity,
                                            rotate: `${wordAnimation.rotation}deg`,
                                            scale: wordAnimation.scale,
                                            translate: `0 ${wordAnimation.translateY}px`,
                                          }}
                                        >
                                          {token}
                                          {stars.map((star, starIndex) => (
                                            <span
                                              aria-hidden="true"
                                              className="text-animation-star"
                                              key={`${textClip.id}-star-${currentWordIndex}-${starIndex}`}
                                              style={{
                                                opacity: star.opacity,
                                                rotate: `${star.rotation}deg`,
                                                scale: star.scale,
                                                translate: `calc(-50% + ${star.x}px) ${star.y}px`,
                                              }}
                                            >
                                              ★
                                            </span>
                                          ))}
                                        </span>
                                      );
                                    })
                                  : text.content}
                            </span>
                            {selectedClipId === textClip.id ? (
                              <>
                                <button
                                  className="text-rotate-handle"
                                  type="button"
                                  aria-label="Rotate text"
                                  title="Drag to rotate text"
                                  onPointerDown={(event) =>
                                    startTextRotateDrag(event, textClip)
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-top-left"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "top-left",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-top"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(event, textClip, "top")
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-top-right"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "top-right",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-right"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "right",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-bottom-right"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "bottom-right",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-bottom"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "bottom",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-bottom-left"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(
                                      event,
                                      textClip,
                                      "bottom-left",
                                    )
                                  }
                                />
                                <span
                                  className="text-resize-handle text-resize-handle-left"
                                  onPointerDown={(event) =>
                                    startTextResizeDrag(event, textClip, "left")
                                  }
                                />
                              </>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                  {previewMode === "media" &&
                  selectedMedia &&
                  getMediaItemType(selectedMedia) === "video" ? (
                    <div
                      className={`media-preview-overlay${isMediaPreviewVolumeOpen ? " volume-open" : ""}`}
                    >
                      <div
                        className="media-preview-filename"
                        title={selectedMedia.label}
                      >
                        {selectedMedia.label}
                      </div>
                      <div className="media-preview-transport">
                        <button
                          type="button"
                          className="media-preview-icon-button"
                          aria-label={
                            isMediaPreviewPlaying
                              ? "Pause imported video"
                              : "Play imported video"
                          }
                          title={isMediaPreviewPlaying ? "Pause" : "Play"}
                          onClick={toggleMediaPreviewPlayback}
                        >
                          {isMediaPreviewPlaying ? "\u23f8" : "\u25b6"}
                        </button>
                        <span>
                          {formatMediaPreviewTime(mediaPreviewDisplayTime)}
                        </span>
                        <input
                          className="media-preview-seek"
                          type="range"
                          min={mediaPreviewSeekMinSeconds}
                          max={mediaPreviewSeekMaxSeconds}
                          step="0.01"
                          value={Math.min(
                            mediaPreviewSeekMaxSeconds,
                            Math.max(
                              mediaPreviewSeekMinSeconds,
                              mediaPreviewTime,
                            ),
                          )}
                          aria-label="Seek imported video"
                          disabled={!isMediaPreviewSeekEnabled}
                          onChange={handleMediaPreviewSeek}
                        />
                        <span>
                          {formatMediaPreviewTime(mediaPreviewDisplayDuration)}
                        </span>
                        <div className="media-preview-volume-control">
                          <button
                            type="button"
                            className="media-preview-icon-button"
                            aria-label="Adjust imported video volume"
                            title="Volume"
                            aria-expanded={isMediaPreviewVolumeOpen}
                            onClick={() =>
                              setIsMediaPreviewVolumeOpen((open) => !open)
                            }
                          >
                            {mediaPreviewVolume === 0
                              ? "\ud83d\udd07"
                              : "\ud83d\udd0a"}
                          </button>
                          {isMediaPreviewVolumeOpen ? (
                            <div className="media-preview-volume-popover">
                              <input
                                className="media-preview-volume-slider"
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={mediaPreviewVolume}
                                aria-label="Imported video volume"
                                aria-orientation="vertical"
                                aria-valuetext={`${Math.round(mediaPreviewVolume * 100)}%`}
                                onPointerDown={
                                  handleMediaPreviewVolumePointerDown
                                }
                                onPointerUp={handleMediaPreviewVolumePointerEnd}
                                onPointerCancel={
                                  handleMediaPreviewVolumePointerEnd
                                }
                                onLostPointerCapture={
                                  handleMediaPreviewVolumePointerEnd
                                }
                                onChange={handleMediaPreviewVolumeChange}
                              />
                              {isMediaPreviewVolumeAdjusting ? (
                                <output className="media-preview-volume-value">
                                  {Math.round(mediaPreviewVolume * 100)}%
                                </output>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {isTimelinePreview ? (
                    <button
                      className="preview-play-button"
                      type="button"
                      aria-label={
                        isCanvasPreviewPlaying
                          ? "Pause preview"
                          : "Play preview"
                      }
                      title={isCanvasPreviewPlaying ? "Pause" : "Play"}
                      onClick={toggleTimelinePlayback}
                    >
                      {isCanvasPreviewPlaying ? "❚❚" : "▶"}
                    </button>
                  ) : null}
                  {isTimelinePreview && previewSource ? (
                    <div className="preview-badge">{previewSource.label}</div>
                  ) : null}
                </>
              ) : (
                <div className="empty-preview">
                  {previewMode === "media" ? "Choose a video from Media" : null}
                </div>
              )}
            </div>
            {activeTool === "adjustment" &&
            cropInputMode === "manual" &&
            canEditSelectedVisual &&
            isTimelinePreview ? (
              <button
                className="rotate-handle canvas-rotate-handle"
                type="button"
                aria-label="Rotate selected clip"
                title="Drag to rotate"
                style={{
                  left: `${rotateHandleLeft}%`,
                  top: `${rotateHandleTop}px`,
                }}
                onPointerDown={startManualRotate}
              />
            ) : null}
          </div>
        </section>

        <aside className="details-panel">
          {selectedCaptionClip ? (
            <div className="clip-controls caption-selected-controls">
              <div className="caption-inspector-header">
                <strong>Caption</strong>
                <span>{selectedCaptionClip.label}</span>
              </div>
              <section className="caption-control-section">
                <label className="caption-words-field">
                  <strong>Words</strong>
                  <textarea
                    aria-label="Caption words"
                    value={selectedCaptionClip.caption?.content ?? ""}
                    onChange={(event) =>
                      updateSelectedCaptionContent(event.currentTarget.value)
                    }
                  />
                </label>
              </section>
              <section className="caption-control-section">
                <strong className="caption-section-title">Typography</strong>
                <div className="caption-compact-grid">
                  <label>
                    <strong>Font</strong>
                    <select
                      aria-label="Caption font"
                      value={selectedCaptionStyle.fontFamily ?? "Inter"}
                      onChange={(event) =>
                        updateSelectedCaptionStyle({
                          fontFamily: event.currentTarget.value,
                        })
                      }
                    >
                      {textFontOptions.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="caption-control-heading">
                      <strong>Size</strong>
                      <em>{selectedCaptionStyle.fontSize}px</em>
                    </span>
                    <input
                      aria-label="Caption font size"
                      type="range"
                      min="1"
                      max="160"
                      step="1"
                      value={selectedCaptionStyle.fontSize}
                      onChange={(event) =>
                        updateSelectedCaptionStyle({
                          fontSize: Number(event.currentTarget.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="caption-inline-controls">
                  <label className="caption-color-control">
                    <strong>Text</strong>
                    <input
                      aria-label="Caption text color"
                      type="color"
                      value={selectedCaptionStyle.textColor}
                      onChange={(event) =>
                        updateSelectedCaptionStyle({
                          textColor: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label className="caption-background-toggle">
                    <input
                      aria-label="Caption background enabled"
                      type="checkbox"
                      checked={selectedCaptionStyle.backgroundEnabled}
                      onChange={(event) =>
                        updateSelectedCaptionStyle({
                          backgroundEnabled: event.currentTarget.checked,
                        })
                      }
                    />
                    <strong>Background</strong>
                  </label>
                  <label className="caption-color-control">
                    <input
                      aria-label="Caption background color"
                      title="Background color"
                      type="color"
                      disabled={!selectedCaptionStyle.backgroundEnabled}
                      value={selectedCaptionStyle.backgroundColor.slice(0, 7)}
                      onChange={(event) =>
                        updateSelectedCaptionStyle({
                          backgroundColor: `${event.currentTarget.value}cc`,
                        })
                      }
                    />
                  </label>
                  <button
                    className={`caption-bold-button ${selectedCaptionStyle.fontWeight === "900" ? "active-text-toggle" : ""}`}
                    type="button"
                    aria-label="Bold caption"
                    title="Bold"
                    onClick={() =>
                      updateSelectedCaptionStyle({
                        fontWeight:
                          selectedCaptionStyle.fontWeight === "900"
                            ? "400"
                            : "900",
                      })
                    }
                  >
                    B
                  </button>
                </div>
              </section>
              <section className="caption-control-section">
                <strong className="caption-section-title">Style</strong>
                <div className="text-effect-grid" aria-label="Caption effects">
                  {textEffectOptions.map((option) => (
                    <button
                      className={
                        selectedCaptionStyle.effect === option.id
                          ? "active-text-effect"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      onClick={() =>
                        updateSelectedCaptionStyle({ effect: option.id })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="caption-control-section">
                <strong className="caption-section-title">Animation</strong>
                <div
                  className="text-effect-grid"
                  aria-label="Caption animation"
                >
                  {captionAnimationOptions.map((option) => (
                    <button
                      className={
                        selectedCaptionStyle.animation === option.id
                          ? "active-text-effect"
                          : ""
                      }
                      key={option.id}
                      type="button"
                      onClick={() =>
                        updateSelectedCaptionStyle({ animation: option.id })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="caption-speed-control">
                  <span className="caption-control-heading">
                    <strong>Speed</strong>
                    <em>
                      {(selectedCaptionStyle.animationSpeed ?? 1).toFixed(2)}x
                    </em>
                  </span>
                  <input
                    aria-label="Caption animation speed"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={selectedCaptionStyle.animationSpeed ?? 1}
                    disabled={selectedCaptionStyle.animation === "none"}
                    onChange={(event) =>
                      updateSelectedCaptionStyle({
                        animationSpeed: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
              </section>
            </div>
          ) : selectedTextClip ? (
            <div className="clip-controls text-style-controls">
              <span>Text controls: {selectedTextClip.label}</span>
              <label>
                <strong>Font</strong>
                <select
                  aria-label="Text font"
                  value={selectedTextStyle.fontFamily}
                  onChange={(event) =>
                    updateSelectedTextStyle({
                      fontFamily: event.currentTarget.value,
                    })
                  }
                >
                  {textFontOptions.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <strong>Size</strong>
                <em>{selectedTextStyle.fontSize}px</em>
                <input
                  aria-label="Text size"
                  type="range"
                  min="1"
                  max="160"
                  step="1"
                  value={selectedTextStyle.fontSize}
                  onChange={(event) =>
                    updateSelectedTextStyle({
                      fontSize: Number(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label>
                <strong>Rotation</strong>
                <em>{selectedTextStyle.rotation}Â°</em>
                <input
                  aria-label="Text rotation"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={selectedTextStyle.rotation}
                  onChange={(event) =>
                    updateSelectedTextRotation(
                      Number(event.currentTarget.value),
                    )
                  }
                />
              </label>
              <label>
                <strong>Color</strong>
                <input
                  aria-label="Text color"
                  type="color"
                  value={selectedTextStyle.color}
                  onChange={(event) =>
                    updateSelectedTextStyle({
                      color: event.currentTarget.value,
                    })
                  }
                />
              </label>
              <div className="text-toggle-row" aria-label="Text style">
                <button
                  className={
                    selectedTextStyle.fontWeight === "900"
                      ? "active-text-toggle"
                      : ""
                  }
                  type="button"
                  aria-label="Bold text"
                  onClick={() =>
                    updateSelectedTextStyle({
                      fontWeight:
                        selectedTextStyle.fontWeight === "900" ? "400" : "900",
                    })
                  }
                >
                  B
                </button>
                <button
                  className={
                    selectedTextStyle.fontStyle === "italic"
                      ? "active-text-toggle"
                      : ""
                  }
                  type="button"
                  aria-label="Italic text"
                  onClick={() =>
                    updateSelectedTextStyle({
                      fontStyle:
                        selectedTextStyle.fontStyle === "italic"
                          ? "normal"
                          : "italic",
                    })
                  }
                >
                  I
                </button>
              </div>
              <div className="text-effect-grid" aria-label="Text effects">
                {textEffectOptions.map((option) => (
                  <button
                    className={
                      selectedTextStyle.effect === option.id
                        ? "active-text-effect"
                        : ""
                    }
                    key={option.id}
                    type="button"
                    onClick={() =>
                      updateSelectedTextStyle({ effect: option.id })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="text-animation-control">
                <strong>Animation</strong>
                <div
                  className="text-animation-options"
                  aria-label="Text animation"
                >
                  {textAnimationOptions.map((option) => (
                    <button
                      className={
                        selectedTextStyle.animation === option.id
                          ? "active-text-animation"
                          : ""
                      }
                      aria-pressed={selectedTextStyle.animation === option.id}
                      key={option.id}
                      type="button"
                      onClick={() =>
                        updateSelectedTextStyle({ animation: option.id })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : clipControlTarget || selectedVideoLayer !== null ? (
            <div className="clip-controls">
              <span>
                {clipControlTarget
                  ? `${clipControlHeading}: ${clipControlTarget.label}`
                  : `Track controls: ${layerControlLabel}`}
              </span>
              <label>
                <strong>Speed</strong>
                <em>{selectedClipSpeed.toFixed(2)}x</em>
                <input
                  type="range"
                  min="0.25"
                  max="2"
                  step="0.05"
                  value={selectedClipSpeed}
                  disabled={!canEditSelectedSpeed}
                  onPointerDown={() => startVideoLayerControlDrag("speed")}
                  onPointerUp={finishVideoLayerControlDrag}
                  onPointerCancel={finishVideoLayerControlDrag}
                  onChange={(event) => {
                    updateSelectedClipSpeed(Number(event.currentTarget.value));
                  }}
                />
              </label>
              <label>
                <strong>Volume</strong>
                <em>{Math.round(selectedClipVolume * 100)}%</em>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedClipVolume}
                  disabled={!canEditSelectedVolume}
                  onPointerDown={() => startVideoLayerControlDrag("volume")}
                  onPointerUp={finishVideoLayerControlDrag}
                  onPointerCancel={finishVideoLayerControlDrag}
                  onChange={(event) => {
                    updateSelectedClipVolume(Number(event.currentTarget.value));
                  }}
                />
              </label>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="timeline-panel" aria-label="Timeline">
        <div className="timeline-toolbar">
          <div className="timeline-tools">
            <button
              className="icon-tool-button primary-icon-tool"
              type="button"
              aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
              title={isPreviewPlaying ? "Pause" : "Play"}
              onClick={toggleTimelinePlayback}
            >
              {isPreviewPlaying ? "❚❚" : "▶"}
            </button>
            <button
              className="icon-tool-button"
              type="button"
              aria-label="Undo last edit"
              title="Undo"
              onClick={undoLastClipChange}
              disabled={timelineHistory.past.length === 0}
            >
              ↶
            </button>
            <button
              className="icon-tool-button"
              type="button"
              aria-label="Redo last edit"
              title="Redo"
              onClick={redoLastClipChange}
              disabled={timelineHistory.future.length === 0}
            >
              ↷
            </button>
            <button
              className="icon-tool-button"
              type="button"
              aria-label={`Split ${selectedTrack} track`}
              title={`Split ${selectedTrack} track`}
              onClick={splitSelectedTrackClip}
            >
              ✂
            </button>
            <button
              className="icon-tool-button"
              type="button"
              aria-label="Duplicate selected clip"
              title="Duplicate selected clip"
              onClick={duplicateSelectedClip}
              disabled={!selectedClipId}
            >
              ⧉
            </button>
            <button
              className={`icon-tool-button visibility-icon-tool ${
                isSelectedTrackHidden ? "hidden-track-tool" : ""
              }`}
              type="button"
              aria-label={
                isSelectedTrackHidden
                  ? `Show ${selectedTrack} track`
                  : `Hide ${selectedTrack} track`
              }
              title={
                isSelectedTrackHidden
                  ? `Show ${selectedTrack} track`
                  : `Hide ${selectedTrack} track`
              }
              aria-pressed={isSelectedTrackHidden}
              onClick={toggleSelectedTrackVisibility}
              disabled={!canToggleSelectedTrackVisibility}
            >
              <span className="track-visibility-eye" aria-hidden="true">
                <span className="track-visibility-pupil" />
              </span>
            </button>
            <button
              className="icon-tool-button danger-icon-tool"
              type="button"
              aria-label="Delete selected clip"
              title="Delete selected clip"
              onClick={deleteSelectedClip}
              disabled={!selectedClipId}
            >
              🗑
            </button>
          </div>
          <strong>
            {formatTimelineTimecode(playheadFrame, fps)} /{" "}
            {formatTimelineTimecode(projectDuration, fps)}
          </strong>
        </div>
        <div className="timeline-scroll" ref={timelineScrollRef}>
          <div
            className="timeline-content"
            ref={timelineContentRef}
            style={
              {
                "--timeline-origin": `${timelineOrigin}px`,
                minWidth: `${timelineOrigin + timelineCanvasWidth + 24}px`,
              } as CSSProperties
            }
          >
            <div
              className="timeline-playhead"
              role="slider"
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, projectDuration - 1)}
              aria-valuenow={playheadFrame}
              tabIndex={0}
              onPointerDown={startTimelineScrub}
              style={{
                left: `calc(${timelineOrigin}px + ${playheadFrame * timelineScale}px)`,
              }}
            />
            <div className="timeline-ruler" onPointerDown={startTimelineScrub}>
              {timelineTicks.map((tick) => (
                <span
                  key={tick.frame}
                  style={{
                    left: `${timelineOrigin + tick.frame * timelineScale}px`,
                  }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
            {timelineRows.map((track, index) => {
              const orderAbove =
                index === 0 ? track.order + 100 : timelineRows[index - 1].order;
              const rowGapOrder = (orderAbove + track.order) / 2;
              const rowGapDirection: VideoLayerDirection =
                rowGapOrder > 0 ? "above" : "below";
              const rowHasTimelineWaveform =
                clips.some(
                  (clip) =>
                    timelineRowContainsClip(track, clip) &&
                    shouldShowTimelineWaveform(clip),
                ) ||
                (track.audioKind === "voiceover" && isRecording);

              return (
                <Fragment key={track.key}>
                  <div
                    className={`timeline-track new-video-layer-drop ${isVideoPointerDrag ? "video-drag-active" : ""} ${
                      videoDropTarget?.kind === "row-gap" &&
                      videoDropTarget.rowOrder === rowGapOrder
                        ? "drop-target"
                        : ""
                    }`}
                    data-video-row-order={rowGapOrder}
                    data-video-row-direction={rowGapDirection}
                    role="group"
                    aria-label={`Place video above ${track.label || "video track"}`}
                  >
                    <div className="track-label" aria-hidden="true" />
                    <div className="track-lane" />
                  </div>
                  <div
                    className={`timeline-track ${track.id === "upper" ? "overlay-timeline-track" : ""} ${
                      track.id === "audio" ? "audio-timeline-track" : ""
                    } ${
                      rowHasTimelineWaveform ? "waveform-timeline-track" : ""
                    }`}
                  >
                    <div
                      className={`track-label ${selectedTrack === track.id ? "selected-track-label" : ""}`}
                      role={
                        track.videoLayer !== undefined && track.videoLayer !== 0
                          ? "group"
                          : undefined
                      }
                      aria-label={
                        track.videoLayer !== undefined && track.videoLayer !== 0
                          ? `Video layer ${track.videoLayer > 0 ? `+${track.videoLayer}` : track.videoLayer}`
                          : undefined
                      }
                      onClick={() => {
                        if (track.videoLayer !== undefined) {
                          selectWholeVideoLayer(track.videoLayer);
                          return;
                        }
                        selectTrackClipAtFrame(
                          track.id,
                          playheadFrame,
                          track.audioKind === "voiceover"
                            ? isVoiceoverClip
                            : track.audioKind === "imported"
                              ? isImportedAudioClip
                            : undefined,
                        );
                      }}
                    >
                      {track.videoLayer !== undefined && track.videoLayer !== 0
                        ? ""
                        : track.label}
                    </div>
                    <div
                      className={`track-lane ${
                        (videoDropTarget?.kind === "layer" &&
                          videoDropTarget.videoLayer === track.videoLayer) ||
                        (videoDropTarget?.kind === "append-main" &&
                          track.videoLayer === 0) ||
                        (videoDropTarget?.kind === "track" &&
                          videoDropTarget.track === track.id)
                          ? "drop-target"
                          : ""
                      } ${
                        track.videoLayer !== undefined &&
                        selectedVideoLayer === track.videoLayer
                          ? "selected-track-lane"
                          : ""
                      } ${track.id === "upper" ? "overlay-track-lane" : ""} ${
                        rowHasTimelineWaveform ? "waveform-track-lane" : ""
                      }`}
                      data-track-id={track.id}
                      data-video-layer={track.videoLayer}
                      onPointerDown={(event) => {
                        if (event.target === event.currentTarget) {
                          const frame =
                            getPointerTimelineFrame(event.clientX) ??
                            playheadFrame;
                          if (track.videoLayer !== undefined) {
                            selectWholeVideoLayer(track.videoLayer);
                            return;
                          }
                          selectTrackClipAtFrame(
                            track.id,
                            Math.max(0, frame),
                            track.audioKind === "voiceover"
                              ? isVoiceoverClip
                              : track.audioKind === "imported"
                                ? isImportedAudioClip
                              : undefined,
                          );
                        }
                      }}
                      onDoubleClick={(event) => {
                        if (event.target !== event.currentTarget) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        updatePlayheadFromPointer(event.clientX);
                      }}
                    >
                      {track.audioKind === "voiceover" &&
                      isRecording &&
                      voiceRecordingStartFrame !== null ? (
                        <div
                          className="timeline-clip audio-timeline-clip has-timeline-waveform voiceover-timeline-clip voiceover-recording-clip"
                          role="status"
                          aria-label="Voice recording in progress"
                          style={{
                            left: `${voiceRecordingStartFrame * timelineScale}px`,
                            width: `${
                              Math.max(
                                1,
                                playheadFrame - voiceRecordingStartFrame,
                              ) * timelineScale
                            }px`,
                          }}
                        >
                          <div className="audio-waveform" aria-hidden="true">
                            <svg
                              className="audio-waveform-svg"
                              viewBox="0 0 100 20"
                              preserveAspectRatio="none"
                            >
                              <polyline
                                className="audio-waveform-line"
                                points={createWaveformLinePoints(
                                  "voice-recording-live",
                                  Math.max(
                                    1,
                                    playheadFrame - voiceRecordingStartFrame,
                                  ),
                                )}
                              />
                            </svg>
                          </div>
                          <span>Recording...</span>
                        </div>
                      ) : null}
                      {track.videoLayer === 0 &&
                      draggedMediaItem &&
                      pointerDrag?.activated ? (
                        <div
                          className={`main-track-append-target ${
                            videoDropTarget?.kind === "append-main"
                              ? "is-active"
                              : ""
                          }`}
                          data-append-main-track
                          role="button"
                          aria-label="Append media to main track"
                          title="Append after the last main clip"
                          style={{
                            left: `${mainAppendTargetLeft}px`,
                            width: `${mainAppendTargetWidth}px`,
                          }}
                        >
                          +
                        </div>
                      ) : null}
                      {track.videoLayer !== undefined
                        ? (
                            transitionBoundariesByLayer.get(track.videoLayer) ??
                            []
                          ).map((boundary) => {
                            const transitionTrack =
                              track.videoLayer === 0 ? "main" : "upper";
                            const transitionLabel = `Open animations for ${boundary.incomingLabel}`;
                            const selectedBoundaryClipId =
                              selectedClipId === boundary.outgoingClipId
                                ? boundary.outgoingClipId
                                : selectedClipId === boundary.incomingClipId
                                  ? boundary.incomingClipId
                                  : null;
                            const selectedBoundaryClip = selectedBoundaryClipId
                              ? clips.find(
                                  (clip) => clip.id === selectedBoundaryClipId,
                                ) ?? null
                              : null;
                            const selectedBoundaryEdge =
                              selectedBoundaryClipId === boundary.outgoingClipId
                                ? "right"
                                : selectedBoundaryClipId ===
                                    boundary.incomingClipId
                                  ? "left"
                                  : null;

                            return (
                              <div
                                key={`${boundary.outgoingClipId}-${boundary.incomingClipId}`}
                                className="transition-anchor"
                                style={{
                                  left: `${boundary.frame * timelineScale}px`,
                                }}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <button
                                  className={`transition-node ${
                                    selectedBoundaryClip && selectedBoundaryEdge
                                      ? "transition-trim-priority"
                                      : ""
                                  }`}
                                  type="button"
                                  aria-label={
                                    selectedBoundaryClip && selectedBoundaryEdge
                                      ? `Trim ${selectedBoundaryClip.label} ${
                                          selectedBoundaryEdge === "left"
                                            ? "start"
                                            : "end"
                                        }`
                                      : `Open animations for ${boundary.incomingLabel}`
                                  }
                                  title={
                                    selectedBoundaryClip && selectedBoundaryEdge
                                      ? selectedBoundaryEdge === "left"
                                        ? "Trim start"
                                        : "Trim end"
                                      : transitionLabel
                                  }
                                  onPointerDown={(event) => {
                                    if (
                                      selectedBoundaryClip &&
                                      selectedBoundaryEdge
                                    ) {
                                      startTrimDrag(
                                        event,
                                        selectedBoundaryClip,
                                        selectedBoundaryEdge,
                                      );
                                    }
                                  }}
                                  onClick={(event) => {
                                    if (
                                      selectedBoundaryClip &&
                                      selectedBoundaryEdge
                                    ) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      return;
                                    }
                                    const bounds =
                                      event.currentTarget.getBoundingClientRect();
                                    selectTransitionBoundary(
                                      boundary.incomingClipId,
                                      transitionTrack,
                                    );
                                    setAnimationQuickMenu({
                                      clipId: boundary.incomingClipId,
                                      left: Math.max(
                                        8,
                                        Math.min(
                                          bounds.left - 106,
                                          window.innerWidth - 264,
                                        ),
                                      ),
                                      top: Math.max(
                                        8,
                                        Math.min(
                                          bounds.bottom + 8,
                                          window.innerHeight - 330,
                                        ),
                                      ),
                                    });
                                  }}
                                >
                                  {selectedBoundaryClip && selectedBoundaryEdge
                                    ? ""
                                    : "+"}
                                </button>
                              </div>
                            );
                          })
                        : null}
                      {clips
                        .filter(
                          (clip) =>
                            timelineRowContainsClip(track, clip) &&
                            (track.id !== "audio" ||
                              activeTool === "audio" ||
                              track.audioKind === "voiceover" ||
                              track.audioKind === "imported" ||
                              contextualAudioClipIds.has(clip.id)),
                        )
                        .map((clip) => (
                          <div
                            className={`timeline-clip ${
                              clip.track === "main" ||
                              clip.track === "upper" ||
                              clip.track === "cutout" ||
                              (clip.track === "text" && clip.text)
                                ? "draggable-clip"
                                : ""
                            } ${clip.hidden ? "hidden-clip" : ""} ${
                              selectedClipId === clip.id
                                ? "selected-timeline-clip"
                                : ""
                            } ${
                              shouldShowTimelineWaveform(clip)
                                ? "has-timeline-waveform"
                                : ""
                            } ${clip.track === "audio" ? "audio-timeline-clip" : ""} ${isImportedAudioClip(clip) ? "imported-audio-timeline-clip" : ""} ${isVoiceoverClip(clip) ? "voiceover-timeline-clip" : ""} ${
                              shouldShowTimelineFilmstrip(clip)
                                ? "video-timeline-clip"
                                : ""
                            } ${
                              shouldShowTimelineFilmstrip(clip) &&
                              clip.duration * timelineScale < 180
                                ? "compact-video-timeline-clip"
                                : ""
                            } ${
                              clip.track === "caption"
                                ? "caption-timeline-clip"
                                : ""
                            } ${
                              (clip.track === "caption" ||
                                clip.track === "text" ||
                                clip.track === "sticker" ||
                                clip.track === "cutout") &&
                              clip.duration * timelineScale < 120
                                ? "compact-overlay-clip"
                                : ""
                            } ${
                              (clip.track === "caption" ||
                                clip.track === "text" ||
                                clip.track === "sticker" ||
                                clip.track === "cutout") &&
                              clip.duration * timelineScale < 48
                                ? "tiny-overlay-clip"
                                : ""
                            }`}
                            key={clip.id}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              selectTimelineClip(clip);
                              if (
                                clip.track === "main" ||
                                clip.track === "upper"
                              ) {
                                startPointerDrag(event, clip);
                              } else if (
                                clip.track === "cutout" &&
                                clip.cutout
                              ) {
                                startCutoutTimelineDrag(event, clip);
                              } else if (
                                (clip.track === "text" && clip.text) ||
                                clip.track === "sticker" ||
                                clip.track === "caption" ||
                                (clip.track === "audio" && !clip.linkedClipId)
                              ) {
                                startTextTimelineDrag(event, clip);
                              }
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (
                                event.target instanceof HTMLElement &&
                                event.target.closest("button")
                              ) {
                                return;
                              }
                              const contentLeft =
                                timelineContentRef.current?.getBoundingClientRect()
                                  .left ?? 0;
                              const pointerFrame = getTimelineFrameFromPointer(
                                event.clientX,
                                contentLeft,
                                timelineOrigin,
                                timelineScale,
                              );
                              selectTimelineClip(clip, pointerFrame);
                            }}
                            style={{
                              left: `${
                                pointerDrag?.type === "timeline" &&
                                pointerDrag.id === clip.id &&
                                pointerDrag.pointerStartX !== undefined &&
                                pointerDrag.originalStart !== undefined
                                  ? getVideoClipDragPreviewStart(
                                      clips,
                                      clip.id,
                                      getDraggedClipStart({
                                        originalStart:
                                          pointerDrag.originalStart,
                                        pointerStartX:
                                          pointerDrag.pointerStartX,
                                        pointerX: pointerDrag.x,
                                        pixelsPerFrame: timelineScale,
                                      }),
                                      projectDuration,
                                    ) * timelineScale
                                  : clip.start * timelineScale
                              }px`,
                              width: `${clip.duration * timelineScale}px`,
                              ...(clip.track === "caption" ||
                              clip.track === "text"
                                ? {
                                    background:
                                      getTextualClipDisplayColors(clip)
                                        .backgroundColor,
                                    color:
                                      getTextualClipDisplayColors(clip)
                                        .textColor,
                                  }
                                : {
                                    background: isVoiceoverClip(clip)
                                      ? "#05070b"
                                      : clip.color,
                                  }),
                            }}
                          >
                            <button
                              className="trim-handle trim-handle-left"
                              type="button"
                              aria-label={`Trim ${clip.label} start`}
                              title="Trim start"
                              tabIndex={selectedClipId === clip.id ? 0 : -1}
                              onPointerDown={(event) => {
                                startTrimDrag(event, clip, "left");
                              }}
                            />
                            <button
                              className="trim-handle trim-handle-right"
                              type="button"
                              aria-label={`Trim ${clip.label} end`}
                              title="Trim end"
                              tabIndex={selectedClipId === clip.id ? 0 : -1}
                              onPointerDown={(event) => {
                                startTrimDrag(event, clip, "right");
                              }}
                            />
                            {shouldShowTimelineFilmstrip(clip) ? (
                              <>
                                <div className="timeline-video-thumbnail-strip">
                                  {Array.from(
                                    {
                                      length: getTimelineThumbnailCount(clip),
                                    },
                                    (_, thumbnailIndex) =>
                                      isImageClip(clip) ? (
                                        <Img
                                          className="timeline-clip-image timeline-video-thumbnail"
                                          key={`${clip.id}-thumbnail-${thumbnailIndex}`}
                                          src={resolveMediaSource(clip.src!)}
                                        />
                                      ) : (
                                        // eslint-disable-next-line @remotion/warn-native-media-tag
                                        <video
                                          className="timeline-clip-video timeline-video-thumbnail"
                                          key={`${clip.id}-thumbnail-${thumbnailIndex}`}
                                          src={resolveMediaSource(clip.src!)}
                                          onLoadedMetadata={(event) =>
                                            seekTimelineThumbnail(
                                              event.currentTarget,
                                              clip,
                                              thumbnailIndex,
                                              getTimelineThumbnailCount(clip),
                                            )
                                          }
                                          onError={() =>
                                            recoverUnavailableVideo(clip.id)
                                          }
                                          muted
                                          playsInline
                                          preload="metadata"
                                          style={
                                            clip.track === "cutout" &&
                                            clip.cutout
                                              ? getCutoutChromaKeyStyle(
                                                  clip.cutout,
                                                )
                                              : undefined
                                          }
                                        />
                                      ),
                                  )}
                                </div>
                                <div className="timeline-clip-filmstrip" />
                              </>
                            ) : null}
                            {clip.src &&
                            clip.track === "cutout" &&
                            clip.cutout?.mediaKind !== "video" ? (
                                // eslint-disable-next-line @remotion/warn-native-media-tag
                                <img
                                  className="timeline-cutout-media"
                                  src={resolveMediaSource(clip.src)}
                                  alt=""
                                />
                            ) : null}
                            {clip.src && clip.track === "sticker" ? (
                              <>
                                {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
                                <img
                                  className="timeline-sticker-image"
                                  src={clip.src}
                                  alt=""
                                />
                              </>
                            ) : null}
                            {shouldShowTimelineWaveform(clip) ? (
                              <div
                                className="audio-waveform"
                                aria-hidden="true"
                              >
                                <svg
                                  className="audio-waveform-svg"
                                  viewBox="0 0 100 20"
                                  preserveAspectRatio="none"
                                >
                                  <polyline
                                    className="audio-waveform-line"
                                    points={createWaveformLinePoints(
                                      clip.id,
                                      clip.duration,
                                    )}
                                  />
                                </svg>
                              </div>
                            ) : null}
                            {shouldShowTimelineWaveform(clip) ? (
                            <button
                              className={`clip-mute-button ${(clip.volume ?? 1) === 0 ? "muted-clip-button" : ""}`}
                              type="button"
                              aria-label={
                                (clip.volume ?? 1) === 0
                                  ? "Unmute clip"
                                  : "Mute clip"
                              }
                              title={
                                (clip.volume ?? 1) === 0
                                  ? "Unmute clip"
                                  : "Mute clip"
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleClipMute(clip.id);
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                            >
                              {(clip.volume ?? 1) === 0 ? "🔇" : "🔊"}
                            </button>
                            ) : null}
                            <span className="timeline-clip-label">
                              {clip.label}
                            </span>
                            <small className="timeline-clip-duration">
                              {clip.track === "audio"
                                ? formatMediaDuration(clip.duration)
                                : clip.track === "main" && clip.speed
                                ? `${clip.speed.toFixed(2)}x`
                                : `${clip.duration}f`}
                            </small>
                          </div>
                        ))}
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {(() => {
              const lastRowOrder =
                timelineRows[timelineRows.length - 1]?.order ?? 0;
              const rowGapOrder = lastRowOrder - 100;
              return (
                <div
                  className={`timeline-track new-video-layer-drop ${isVideoPointerDrag ? "video-drag-active" : ""} ${
                    videoDropTarget?.kind === "row-gap" &&
                    videoDropTarget.rowOrder === rowGapOrder
                      ? "drop-target"
                      : ""
                  }`}
                  data-video-row-order={rowGapOrder}
                  data-video-row-direction="below"
                  role="group"
                  aria-label="Place video below the last track"
                >
                  <div className="track-label" aria-hidden="true" />
                  <div className="track-lane" />
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      <dialog
        ref={importChoiceDialogRef}
        className="import-choice-dialog"
        aria-labelledby="import-choice-title"
        onCancel={(event) => {
          event.preventDefault();
          closeImportChoiceDialog();
        }}
        onClose={() => {
          pendingImportFilesRef.current = [];
          setPendingImportVideoCount(0);
        }}
      >
        <div className="import-choice-heading">
          <span className="import-choice-icon" aria-hidden="true">
            ✂
          </span>
          <div>
            <h2 id="import-choice-title">Separate into scenes?</h2>
            <p>
              {pendingImportVideoCount === 1
                ? "Choose how this video should appear in your media library."
                : `Choose how these ${pendingImportVideoCount} videos should appear in your media library.`}
            </p>
          </div>
        </div>
        <div className="import-choice-actions">
          <button
            className="import-choice-primary"
            type="button"
            onClick={() => confirmMediaImport("scenes")}
          >
            Separate into scenes
          </button>
          <button
            className="import-choice-secondary"
            type="button"
            onClick={() => confirmMediaImport("whole")}
          >
            Keep full video
          </button>
          <button
            className="import-choice-cancel"
            type="button"
            onClick={closeImportChoiceDialog}
          >
            Cancel
          </button>
        </div>
      </dialog>

      <dialog
        ref={mediaTrimDialogRef}
        className="media-trim-dialog"
        aria-labelledby="media-trim-title"
        onCancel={(event) => {
          event.preventDefault();
          closeMediaTrimEditor();
        }}
      >
        {mediaTrimDraft && mediaTrimItem ? (
          <div className="media-trim-content">
            <div className="media-trim-heading">
              <div>
                <h2 id="media-trim-title">Canvas editor</h2>
                <p>{mediaTrimItem.label}</p>
              </div>
              <button
                type="button"
                aria-label="Close trim editor"
                title="Close"
                onClick={closeMediaTrimEditor}
              >
                {"\u00d7"}
              </button>
            </div>
            <div
              className="media-trim-preview"
              onPointerMove={moveMediaTrimCanvasDrag}
              onPointerUp={() => setMediaTrimCanvasDrag(null)}
              onPointerCancel={() => setMediaTrimCanvasDrag(null)}
            >
              {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
              <video
                ref={mediaTrimVideoRef}
                src={resolveMediaSource(mediaTrimItem.src)}
                playsInline
                preload="metadata"
                style={{
                  transform: `translate(${mediaTrimDraft.adjustment.positionX}%, ${mediaTrimDraft.adjustment.positionY}%) scale(${mediaTrimDraft.adjustment.scale}) rotate(${mediaTrimDraft.adjustment.rotation}deg)`,
                  transformOrigin: "center",
                  clipPath: `inset(${mediaTrimDraft.adjustment.cropTop}% ${mediaTrimDraft.adjustment.cropRight}% ${mediaTrimDraft.adjustment.cropBottom}% ${mediaTrimDraft.adjustment.cropLeft}%)`,
                }}
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime =
                    ((mediaTrimItem.sourceStart ?? 0) +
                      mediaTrimDraft.startFrame) /
                    fps;
                  setMediaTrimPreviewFrame(mediaTrimDraft.startFrame);
                }}
                onPlay={() => setIsMediaTrimPreviewPlaying(true)}
                onPause={() => setIsMediaTrimPreviewPlaying(false)}
                onTimeUpdate={(event) => {
                  const sourceStart = mediaTrimItem.sourceStart ?? 0;
                  const relativeFrame = Math.max(
                    0,
                    Math.floor(event.currentTarget.currentTime * fps - sourceStart),
                  );

                  if (relativeFrame >= mediaTrimDraft.endFrame) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime =
                      (sourceStart + mediaTrimDraft.endFrame) / fps;
                    setMediaTrimPreviewFrame(mediaTrimDraft.endFrame);
                    return;
                  }

                  setMediaTrimPreviewFrame(relativeFrame);
                }}
              />
              <div
                className="media-trim-crop-frame"
                style={{
                  top: `${mediaTrimDraft.adjustment.cropTop}%`,
                  right: `${mediaTrimDraft.adjustment.cropRight}%`,
                  bottom: `${mediaTrimDraft.adjustment.cropBottom}%`,
                  left: `${mediaTrimDraft.adjustment.cropLeft}%`,
                }}
                onPointerDown={(event) =>
                  startMediaTrimCanvasDrag(event, "pan")
                }
              >
                <button
                  type="button"
                  className="media-trim-rotate-handle"
                  aria-label="Rotate video on canvas"
                  title="Drag to rotate"
                  onPointerDown={(event) =>
                    startMediaTrimCanvasDrag(event, "rotate")
                  }
                />
                {(
                  [
                    "top-left",
                    "top",
                    "top-right",
                    "right",
                    "bottom-right",
                    "bottom",
                    "bottom-left",
                    "left",
                  ] as CaptionResizeHandle[]
                ).map((handle) => (
                  <button
                    type="button"
                    key={handle}
                    className={`media-trim-crop-handle media-trim-crop-handle-${handle}`}
                    aria-label={`Crop video from ${handle}`}
                    title={`Crop ${handle}`}
                    onPointerDown={(event) =>
                      startMediaTrimCanvasDrag(event, "crop", handle)
                    }
                  />
                ))}
              </div>
            </div>
            <div className="media-trim-transform-controls">
              <label>
                <span>Size</span>
                <input
                  aria-label="Video size"
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={mediaTrimDraft.adjustment.scale}
                  onChange={(event) =>
                    updateMediaTrimAdjustment({
                      scale: Number(event.currentTarget.value),
                    })
                  }
                />
                <strong>{Math.round(mediaTrimDraft.adjustment.scale * 100)}%</strong>
              </label>
              <label>
                <span>Rotate</span>
                <input
                  aria-label="Video rotation"
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={mediaTrimDraft.adjustment.rotation}
                  onChange={(event) =>
                    updateMediaTrimAdjustment({
                      rotation: Number(event.currentTarget.value),
                    })
                  }
                />
                <strong>{Math.round(mediaTrimDraft.adjustment.rotation)}°</strong>
              </label>
              <button
                type="button"
                onClick={() =>
                  updateMediaTrimAdjustment(defaultClipAdjustment)
                }
              >
                Reset crop
              </button>
            </div>
            <div className="media-trim-playback">
              <button
                type="button"
                aria-label={
                  isMediaTrimPreviewPlaying
                    ? "Pause trim preview"
                    : "Play trim preview"
                }
                title={isMediaTrimPreviewPlaying ? "Pause" : "Play"}
                onClick={toggleMediaTrimPlayback}
              >
                <span
                  aria-hidden="true"
                  className={
                    isMediaTrimPreviewPlaying
                      ? "media-trim-pause-icon"
                      : "media-trim-play-icon"
                  }
                />
              </button>
              <span>
                {formatMediaTrimTime(
                  Math.max(
                    0,
                    Math.min(
                      mediaTrimPreviewFrame,
                      mediaTrimDraft.endFrame,
                    ) - mediaTrimDraft.startFrame,
                  ),
                )}
              </span>
              <input
                aria-label="Trim preview position"
                type="range"
                min={mediaTrimDraft.startFrame}
                max={mediaTrimDraft.endFrame}
                step={1}
                value={Math.max(
                  mediaTrimDraft.startFrame,
                  Math.min(mediaTrimPreviewFrame, mediaTrimDraft.endFrame),
                )}
                onChange={(event) =>
                  previewMediaTrimFrame(
                    mediaTrimItem,
                    Number(event.currentTarget.value),
                  )
                }
              />
              <span>
                {formatMediaTrimTime(
                  mediaTrimDraft.endFrame - mediaTrimDraft.startFrame,
                )}
              </span>
            </div>
            <div className="media-trim-controls">
              <div className="media-trim-range-heading">
                <span>Drag the in and out points to shorten the video</span>
                <strong>
                  {formatMediaTrimTime(
                    mediaTrimDraft.endFrame - mediaTrimDraft.startFrame,
                  )}
                </strong>
              </div>
              <div
                className="media-trim-range-visual"
                role="group"
                aria-label="Video trim range"
                onPointerMove={moveMediaTrimRangeDrag}
                onPointerUp={() => setMediaTrimRangeDrag(null)}
                onPointerCancel={() => setMediaTrimRangeDrag(null)}
              >
                <span
                  className="media-trim-range-selection"
                  style={{
                    left: `${(mediaTrimDraft.startFrame / mediaTrimItem.durationInFrames) * 100}%`,
                    right: `${100 - (mediaTrimDraft.endFrame / mediaTrimItem.durationInFrames) * 100}%`,
                  }}
                />
                <button
                  className="media-trim-range-handle media-trim-range-handle-start"
                  type="button"
                  aria-label="Trim beginning"
                  title="Drag to trim the beginning"
                  style={{
                    left: `${(mediaTrimDraft.startFrame / mediaTrimItem.durationInFrames) * 100}%`,
                  }}
                  onPointerDown={(event) =>
                    startMediaTrimRangeDrag(event, "start")
                  }
                />
                <button
                  className="media-trim-range-handle media-trim-range-handle-end"
                  type="button"
                  aria-label="Trim ending"
                  title="Drag to trim the ending"
                  style={{
                    left: `${(mediaTrimDraft.endFrame / mediaTrimItem.durationInFrames) * 100}%`,
                  }}
                  onPointerDown={(event) =>
                    startMediaTrimRangeDrag(event, "end")
                  }
                />
              </div>
              <div className="media-trim-summary">
                <span>New duration</span>
                <strong>
                  {formatMediaTrimTime(
                    mediaTrimDraft.endFrame - mediaTrimDraft.startFrame,
                  )}
                </strong>
              </div>
            </div>
            <div className="media-trim-actions">
              <button
                className="media-trim-reset-video"
                type="button"
                title="Restore the original duration and crop"
                onClick={resetMediaTrimToOriginal}
              >
                Reset video
              </button>
              <button type="button" onClick={closeMediaTrimEditor}>
                Cancel
              </button>
              <button type="button" onClick={applyMediaTrim}>
                Apply edits
              </button>
            </div>
          </div>
        ) : null}
      </dialog>

      {animationQuickMenu ? (
        <div
          ref={animationQuickMenuRef}
          className="animation-quick-menu"
          role="dialog"
          aria-label="Quick animations"
          style={{
            left: animationQuickMenu.left,
            top: animationQuickMenu.top,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="animation-quick-heading">
            <strong>Quick animations</strong>
            <button
              type="button"
              aria-label="Close quick animations"
              title="Close"
              onClick={() => setAnimationQuickMenu(null)}
            >
              {"\u00d7"}
            </button>
          </div>
          <section className="animation-quick-section">
            <span>Favorites</span>
            {favoriteAnimationIds.length > 0 ? (
              <div className="animation-quick-options">
                {animationOptions
                  .filter((option) => favoriteAnimationIds.includes(option.id))
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        applyAnimationToClip(
                          animationQuickMenu.clipId,
                          option.id,
                        )
                      }
                    >
                      <span aria-hidden="true">{"\u2665"}</span>
                      {option.label}
                    </button>
                  ))}
              </div>
            ) : (
              <small>Heart an animation to keep it here.</small>
            )}
          </section>
          <section className="animation-quick-section">
            <span>Recently used</span>
            {recentAnimationIds.length > 0 ? (
              <div className="animation-quick-options">
                {recentAnimationIds
                  .map((id) =>
                    animationOptions.find((option) => option.id === id),
                  )
                  .filter((option) => option !== undefined)
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        applyAnimationToClip(
                          animationQuickMenu.clipId,
                          option.id,
                        )
                      }
                    >
                      <span aria-hidden="true">{"\u21bb"}</span>
                      {option.label}
                    </button>
                  ))}
              </div>
            ) : (
              <small>Applied animations will appear here.</small>
            )}
          </section>
        </div>
      ) : null}

      {pointerDrag?.type === "media" ? (
        <div
          className="drag-preview"
          style={{
            left: pointerDrag.x,
            top: pointerDrag.y,
          }}
        >
          <span>{pointerDrag.label}</span>
        </div>
      ) : null}
    </main>
  );
};
