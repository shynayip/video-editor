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
  duplicateClipById,
  detachAudioFromVideoClip,
  ensureLinkedAudioForVideo,
  keepDominantVoiceInLinkedVideo,
  getActiveClipsAtFrame,
  getActiveVideoLayersAtFrame,
  getClipSourceTime,
  getClipAudioFadeMultiplier,
  getClipTransitionPresentation,
  getPublicMediaFallbackSource,
  isPlayableMediaResponse,
  isStoredUploadSource,
  getDraggedClipStart,
  getDragEdgeAutoScrollDelta,
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
  getRemovedTranscriptWordIndexes,
  getVisualToolTargetClipId,
  getManualRotationAngle,
  getStableTimelineFrameDelta,
  getTimelineFrameFromPointer,
  getTimelineTransitionBoundaries,
  getTimelineDuration,
  getTimelineKeyboardNavigationTarget,
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
  movePreviewTransform,
  moveTextOverlay,
  moveCutoutClip,
  normalizeMediaSceneLabels,
  getNextVideoLayer,
  getClipAnimationPreviewFrame,
  getClipFilterCss,
  getCutoutLineEffectCss,
  getVideoLayer,
  getVideoLayerControlState,
  getVideoLayerEnd,
  moveVideoClipToLayer,
  placeVideoPairOnLayer,
  insertVideoPairOnLayerAtFrame,
  parseSavedEditorProject,
  removeUnusedMediaItem,
  replaceClipMediaById,
  replaceGeneratedCaptionBatch,
  removeBrowserOnlySavedMedia,
  removeSilenceFromLinkedVideo,
  removeTranscriptSentenceFromLinkedVideo,
  removeTranscriptWordsFromLinkedVideo,
  reconnectMediaSource,
  restoreDominantVideoSources,
  resetMediaItemEdits,
  redoTimelineHistory,
  reconcileClipSourceDuration,
  resizeTextOverlayBoxById,
  resizeCaptionOverlayById,
  resizeCutoutTransform,
  snapPreviewPositionToCenter,
  snapPreviewOffsetToCenter,
  setClipEffectById,
  setCutoutLineStyleById,
  setClipFilterById,
  setClipAdjustmentById,
  setClipSpeedById,
  setClipVolumeById,
  setClipAudioFadeById,
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
  toggleClipVisibilityById,
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
  CutoutLineStyle,
  TextEffect,
  TextEntranceAnimation,
  CaptionStyle,
  CaptionAnimationPreset,
  CaptionResizeHandle,
  ClipAdjustment,
  CutoutTransform,
  CutoutMaskStroke,
  PreviewAlignmentGuides,
  defaultCutoutLineStyle,
  isCustomizableCutoutLineEffect,
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
import { ExportComposition } from "./ExportComposition";

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

const focusTextareaOnPointerDown = (
  event: PointerEvent<HTMLTextAreaElement>,
) => {
  event.stopPropagation();
  event.currentTarget.focus();
};

type UploadedMediaResponse = {
  src: string;
  label: string;
  mimeType: string;
};

const fps = 30;
const defaultMediaDurationInFrames = 16 * fps;
const defaultImageDurationInFrames = 5 * fps;
const remotionRegistrationFallbackInFrames = 24 * 60 * 60 * fps;
const defaultTimelineScale = 1.15;
const timelineOrigin = 148;
const minimumTimelineScale = 0.35;
const maximumTimelineScale = 4;
const timelineZoomStep = 0.15;
const timelineDragActivationDistance = 6;
const mediaSelectionActivationDistance = 4;

type AudioLibraryTab = "music" | "sound-effects";

type AudioLibraryItem = {
  id: string;
  kind: AudioLibraryTab;
  label: string;
  creator: string;
  category: string;
  durationSeconds: number;
  accent: string;
  keywords: string[];
  preset: number;
};

const musicLibraryItems: AudioLibraryItem[] = [
  {
    id: "music-city-pop",
    kind: "music",
    label: "Hope, City Pop",
    creator: "Editor Studio",
    category: "Pop",
    durationSeconds: 30,
    accent: "#3157c7",
    keywords: ["background music", "happy", "city", "pop"],
    preset: 0,
  },
  {
    id: "music-hip-hop",
    kind: "music",
    label: "Dynamic Hip Hop",
    creator: "Editor Studio",
    category: "Hip hop",
    durationSeconds: 24,
    accent: "#a42374",
    keywords: ["background music", "phonk", "beat", "urban"],
    preset: 1,
  },
  {
    id: "music-healing",
    kind: "music",
    label: "Calm Morning",
    creator: "Editor Studio",
    category: "Healing",
    durationSeconds: 30,
    accent: "#3c7b62",
    keywords: ["calm", "healing", "soft", "relax"],
    preset: 2,
  },
  {
    id: "music-warm",
    kind: "music",
    label: "Warm Memories",
    creator: "Editor Studio",
    category: "Warm",
    durationSeconds: 28,
    accent: "#a55a2a",
    keywords: ["warm", "cinematic", "gentle", "story"],
    preset: 3,
  },
  {
    id: "music-rnb",
    kind: "music",
    label: "Midnight R&B",
    creator: "Editor Studio",
    category: "R&B",
    durationSeconds: 26,
    accent: "#653c91",
    keywords: ["r&b", "smooth", "night", "vocal"],
    preset: 4,
  },
  {
    id: "music-corporate",
    kind: "music",
    label: "Bright Presentation",
    creator: "Editor Studio",
    category: "Recommend",
    durationSeconds: 30,
    accent: "#237f8d",
    keywords: ["corporate", "background music", "clean", "business"],
    preset: 5,
  },
  {
    id: "music-electronic",
    kind: "music",
    label: "Electric Motion",
    creator: "Editor Studio",
    category: "Electronic",
    durationSeconds: 25,
    accent: "#266c9a",
    keywords: ["electronic", "energy", "technology", "dance"],
    preset: 6,
  },
  {
    id: "music-cinematic",
    kind: "music",
    label: "Cinematic Journey",
    creator: "Editor Studio",
    category: "Cinematic",
    durationSeconds: 30,
    accent: "#79553d",
    keywords: ["cinematic", "film", "travel", "dramatic"],
    preset: 7,
  },
  {
    id: "music-upbeat",
    kind: "music",
    label: "Good Day",
    creator: "Editor Studio",
    category: "Upbeat",
    durationSeconds: 24,
    accent: "#a36f22",
    keywords: ["happy", "upbeat", "fun", "vlog"],
    preset: 8,
  },
  {
    id: "music-lofi",
    kind: "music",
    label: "Lo-fi Study",
    creator: "Editor Studio",
    category: "Lo-fi",
    durationSeconds: 30,
    accent: "#58678d",
    keywords: ["lofi", "lo-fi", "study", "chill", "background music"],
    preset: 9,
  },
  {
    id: "music-fashion",
    kind: "music",
    label: "Runway Lights",
    creator: "Editor Studio",
    category: "Fashion",
    durationSeconds: 22,
    accent: "#9c3d65",
    keywords: ["fashion", "runway", "style", "modern"],
    preset: 10,
  },
  {
    id: "music-acoustic",
    kind: "music",
    label: "Sunday Acoustic",
    creator: "Editor Studio",
    category: "Acoustic",
    durationSeconds: 28,
    accent: "#70854a",
    keywords: ["acoustic", "gentle", "natural", "lifestyle"],
    preset: 11,
  },
  {
    id: "music-phonk-drift",
    kind: "music",
    label: "Midnight Drift Phonk",
    creator: "Editor Studio",
    category: "Phonk",
    durationSeconds: 24,
    accent: "#7c2948",
    keywords: ["phonk", "drift", "cowbell", "dark", "car"],
    preset: 12,
  },
  {
    id: "music-phonk-aggressive",
    kind: "music",
    label: "Aggressive Phonk",
    creator: "Editor Studio",
    category: "Phonk",
    durationSeconds: 22,
    accent: "#8d332d",
    keywords: ["phonk", "aggressive", "bass", "gym", "edit"],
    preset: 13,
  },
  {
    id: "music-phonk-brazilian",
    kind: "music",
    label: "Brazilian Phonk Energy",
    creator: "Editor Studio",
    category: "Phonk",
    durationSeconds: 26,
    accent: "#357648",
    keywords: ["phonk", "brazilian", "funk", "energy", "dance"],
    preset: 14,
  },
  {
    id: "music-phonk-chill",
    kind: "music",
    label: "Chill Phonk Drive",
    creator: "Editor Studio",
    category: "Phonk",
    durationSeconds: 28,
    accent: "#4d4f82",
    keywords: ["phonk", "chill", "drive", "night", "background music"],
    preset: 15,
  },
];

const soundEffectLibraryItems: AudioLibraryItem[] = [
  {
    id: "sfx-swish",
    kind: "sound-effects",
    label: "Swish",
    creator: "Editor Studio",
    category: "Performance",
    durationSeconds: 1,
    accent: "#7049a8",
    keywords: ["swish", "whoosh", "transition", "performance"],
    preset: 0,
  },
  {
    id: "sfx-vine-boom",
    kind: "sound-effects",
    label: "Vine Boom",
    creator: "Editor Studio",
    category: "Impact",
    durationSeconds: 1.2,
    accent: "#ad4937",
    keywords: ["vine boom", "boom", "impact", "bass"],
    preset: 1,
  },
  {
    id: "sfx-laugh",
    kind: "sound-effects",
    label: "Quick Laugh",
    creator: "Editor Studio",
    category: "Laugh",
    durationSeconds: 2,
    accent: "#a46b39",
    keywords: ["laugh", "funny", "comedy", "reaction"],
    preset: 2,
  },
  {
    id: "sfx-mechanical",
    kind: "sound-effects",
    label: "Mechanical Click",
    creator: "Editor Studio",
    category: "Mechanical",
    durationSeconds: 1.5,
    accent: "#52616c",
    keywords: ["mechanical", "click", "machine", "button"],
    preset: 3,
  },
  {
    id: "sfx-magic",
    kind: "sound-effects",
    label: "Magic Reveal",
    creator: "Editor Studio",
    category: "Magic",
    durationSeconds: 2,
    accent: "#6b45b9",
    keywords: ["magic", "reveal", "sparkle", "fantasy"],
    preset: 4,
  },
  {
    id: "sfx-explosion",
    kind: "sound-effects",
    label: "Explosion",
    creator: "Editor Studio",
    category: "Impact",
    durationSeconds: 2.5,
    accent: "#9a3f29",
    keywords: ["explosion", "boom", "impact", "action"],
    preset: 5,
  },
  {
    id: "sfx-notification",
    kind: "sound-effects",
    label: "Notification Pop",
    creator: "Editor Studio",
    category: "Interface",
    durationSeconds: 1,
    accent: "#2c7d86",
    keywords: ["notification", "pop", "interface", "message"],
    preset: 6,
  },
  {
    id: "sfx-camera",
    kind: "sound-effects",
    label: "Camera Shutter",
    creator: "Editor Studio",
    category: "Mechanical",
    durationSeconds: 1,
    accent: "#725b43",
    keywords: ["camera", "shutter", "photo", "click"],
    preset: 7,
  },
  {
    id: "sfx-pop",
    kind: "sound-effects",
    label: "Bubble Pop",
    creator: "Editor Studio",
    category: "Interface",
    durationSeconds: 1,
    accent: "#3c8d80",
    keywords: ["pop", "bubble", "button", "interface"],
    preset: 8,
  },
  {
    id: "sfx-applause",
    kind: "sound-effects",
    label: "Applause",
    creator: "Editor Studio",
    category: "Performance",
    durationSeconds: 3,
    accent: "#8b5843",
    keywords: ["applause", "clap", "crowd", "performance"],
    preset: 9,
  },
  {
    id: "sfx-error",
    kind: "sound-effects",
    label: "Error Alert",
    creator: "Editor Studio",
    category: "Interface",
    durationSeconds: 1.2,
    accent: "#a23e46",
    keywords: ["error", "alert", "warning", "interface"],
    preset: 10,
  },
  {
    id: "sfx-success",
    kind: "sound-effects",
    label: "Success Chime",
    creator: "Editor Studio",
    category: "Interface",
    durationSeconds: 1.5,
    accent: "#3d8a58",
    keywords: ["success", "complete", "chime", "interface"],
    preset: 11,
  },
  {
    id: "sfx-drum-roll",
    kind: "sound-effects",
    label: "Drum Roll",
    creator: "Editor Studio",
    category: "Performance",
    durationSeconds: 3,
    accent: "#87543a",
    keywords: ["drum", "roll", "reveal", "performance"],
    preset: 12,
  },
  {
    id: "sfx-sparkle",
    kind: "sound-effects",
    label: "Sparkle Trail",
    creator: "Editor Studio",
    category: "Magic",
    durationSeconds: 2.2,
    accent: "#7656b5",
    keywords: ["sparkle", "magic", "fairy", "glitter"],
    preset: 13,
  },
  {
    id: "sfx-door",
    kind: "sound-effects",
    label: "Door Close",
    creator: "Editor Studio",
    category: "Mechanical",
    durationSeconds: 1.4,
    accent: "#66584b",
    keywords: ["door", "close", "slam", "mechanical"],
    preset: 14,
  },
  {
    id: "sfx-riser",
    kind: "sound-effects",
    label: "Cinematic Riser",
    creator: "Editor Studio",
    category: "Impact",
    durationSeconds: 3,
    accent: "#77455a",
    keywords: ["riser", "cinematic", "tension", "transition"],
    preset: 15,
  },
];

const audioLibraryItems = [...musicLibraryItems, ...soundEffectLibraryItems];

const audioLibraryItemMatchesQuery = (
  item: AudioLibraryItem,
  normalizedQuery: string,
) =>
  [item.label, item.creator, item.category, ...item.keywords]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);

const formatAudioLibraryDuration = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const createAudioLibraryFile = (item: AudioLibraryItem): File => {
  const sampleRate = 22_050;
  const sampleCount = Math.ceil(item.durationSeconds * sampleRate);
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  let noiseState = 17_311 + item.preset * 9_973;
  const nextNoise = () => {
    noiseState = (noiseState * 48_271) % 2_147_483_647;
    return (noiseState / 2_147_483_647) * 2 - 1;
  };
  const musicRoots = [220, 164.81, 196, 146.83, 174.61, 246.94];

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let sample = 0;
    if (item.kind === "music") {
      const root = musicRoots[item.preset % musicRoots.length];
      const beat = time % 0.5;
      const beatEnvelope = Math.exp(-beat * 9);
      const phraseStep = Math.floor(time / 2) % 4;
      const ratios = [1, 1.25, 1.5, 1.125];
      const tone = root * ratios[phraseStep];
      sample =
        Math.sin(2 * Math.PI * tone * time) * 0.18 +
        Math.sin(2 * Math.PI * tone * 1.5 * time) * 0.09 +
        Math.sin(2 * Math.PI * (root / 2) * time) * 0.2 * beatEnvelope +
        nextNoise() * 0.025 * beatEnvelope;
      const fade = Math.min(1, time / 0.6, (item.durationSeconds - time) / 0.8);
      sample *= Math.max(0, fade);
    } else {
      const progress = Math.min(1, time / item.durationSeconds);
      const envelope = Math.pow(Math.max(0, 1 - progress), 1.7);
      switch (item.preset) {
        case 0:
          sample = nextNoise() * envelope * 0.38;
          break;
        case 1:
          sample =
            Math.sin(2 * Math.PI * (75 - progress * 35) * time) *
            envelope *
            0.72;
          break;
        case 2:
          sample =
            Math.sin(2 * Math.PI * (320 + Math.sin(time * 22) * 70) * time) *
            envelope *
            0.34;
          break;
        case 3:
          sample =
            Math.sign(Math.sin(2 * Math.PI * 120 * time)) *
            Math.exp(-((time % 0.28) * 24)) *
            0.32;
          break;
        case 4:
          sample =
            Math.sin(2 * Math.PI * (320 + progress * 900) * time) *
            envelope *
            0.38;
          break;
        case 5:
          sample =
            (nextNoise() * 0.52 +
              Math.sin(2 * Math.PI * (58 - progress * 24) * time) * 0.48) *
            envelope;
          break;
        case 6:
          sample =
            Math.sin(2 * Math.PI * (progress < 0.45 ? 660 : 880) * time) *
            envelope *
            0.42;
          break;
        case 7:
          sample =
            nextNoise() * Math.exp(-((time % 0.16) * 36)) * envelope * 0.42;
          break;
        case 8:
          sample =
            Math.sin(2 * Math.PI * (520 + progress * 240) * time) *
            Math.exp(-time * 8) *
            0.5;
          break;
        case 9:
          sample =
            nextNoise() *
            Math.pow(Math.max(0, Math.sin(time * Math.PI * 13)), 8) *
            envelope *
            0.28;
          break;
        case 10:
          sample =
            Math.sign(Math.sin(2 * Math.PI * 170 * time)) * envelope * 0.34;
          break;
        case 11:
          sample =
            Math.sin(
              2 *
                Math.PI *
                (progress < 0.34 ? 523.25 : progress < 0.68 ? 659.25 : 783.99) *
                time,
            ) *
            envelope *
            0.4;
          break;
        case 12:
          sample =
            nextNoise() *
            Math.pow(
              Math.max(0, Math.sin(time * Math.PI * (9 + progress * 24))),
              7,
            ) *
            0.36;
          break;
        case 13:
          sample =
            Math.sin(2 * Math.PI * (700 + progress * 1_200) * time) *
            (0.25 + nextNoise() * 0.08) *
            envelope;
          break;
        case 14:
          sample =
            (nextNoise() * 0.34 + Math.sin(2 * Math.PI * 92 * time) * 0.3) *
            Math.exp(-time * 3.2);
          break;
        default:
          sample =
            (nextNoise() * 0.2 +
              Math.sin(2 * Math.PI * (120 + progress * 680) * time) * 0.34) *
            Math.pow(progress, 0.8);
      }
    }
    view.setInt16(
      44 + index * bytesPerSample,
      Math.round(Math.max(-1, Math.min(1, sample)) * 32_767),
      true,
    );
  }

  return new File([buffer], `${item.id}.wav`, { type: "audio/wav" });
};

type MediaSelectionBox = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  initialIds: string[];
  additive: boolean;
  activated: boolean;
};

type TimelineSelectionBox = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  initialIds: string[];
  activated: boolean;
  startedFromTrackLabel: boolean;
};
const minimumTransitionDuration = 1;
const savedProjectStorageKey = "video-editor-project-v1";
const favoriteAnimationsStorageKey = "video-editor-favorite-animations-v1";
const recentAnimationsStorageKey = "video-editor-recent-animations-v1";
const workspaceLayoutStorageKey = "video-editor-workspace-layout-v1";
const maximumRecentAnimations = 4;

type WorkspaceLayout = {
  detailsWidth: number;
  previewWidth: number;
  timelineHeight: number;
};

type WorkspaceResizeTarget = "details" | "preview" | "timeline";

const clampWorkspaceSize = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const getDefaultWorkspaceLayout = (): WorkspaceLayout => {
  const viewportWidth =
    typeof window === "undefined" ? 1440 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 900 : window.innerHeight;
  return {
    detailsWidth: clampWorkspaceSize(viewportWidth * 0.24, 280, 380),
    previewWidth: clampWorkspaceSize(
      ((viewportHeight - 48) * 9) / 16,
      280,
      520,
    ),
    timelineHeight: clampWorkspaceSize(viewportHeight * 0.32, 220, 320),
  };
};

const readWorkspaceLayout = (): WorkspaceLayout => {
  const defaults = getDefaultWorkspaceLayout();
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(workspaceLayoutStorageKey) ?? "null",
    ) as Partial<WorkspaceLayout> | null;
    const viewportWidth = window.innerWidth;
    const detailsMaximum = Math.max(280, viewportWidth - 640);
    const previewMaximum = Math.max(280, viewportWidth - 620);
    return {
      detailsWidth: clampWorkspaceSize(
        typeof stored?.detailsWidth === "number"
          ? stored.detailsWidth
          : defaults.detailsWidth,
        280,
        detailsMaximum,
      ),
      previewWidth: clampWorkspaceSize(
        typeof stored?.previewWidth === "number"
          ? stored.previewWidth
          : defaults.previewWidth,
        280,
        previewMaximum,
      ),
      timelineHeight: clampWorkspaceSize(
        typeof stored?.timelineHeight === "number"
          ? stored.timelineHeight
          : defaults.timelineHeight,
        200,
        Math.max(220, window.innerHeight - 300),
      ),
    };
  } catch {
    return defaults;
  }
};

const readStoredStringList = (storageKey: string): string[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    );
    return Array.isArray(storedValue)
      ? storedValue.filter(
          (value): value is string => typeof value === "string",
        )
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
    !clip.audioDetached &&
    (clip.track === "main" || clip.track === "upper"
      ? !isImageClip(clip)
      : clip.track === "cutout" && clip.cutout?.mediaKind === "video"));

const getTimelineThumbnailCount = (clip: TimelineClip) =>
  Math.max(
    1,
    Math.min(12, Math.ceil((clip.duration * defaultTimelineScale) / 84)),
  );

const seekTimelineThumbnail = (
  video: HTMLVideoElement,
  clip: TimelineClip,
  index: number,
  count: number,
) => {
  const sourceStartSeconds = (clip.sourceStart ?? 0) / fps;
  const sourceDurationSeconds = (clip.duration * (clip.speed ?? 1)) / fps;
  const requestedTime =
    sourceStartSeconds +
    sourceDurationSeconds * ((index + 0.5) / Math.max(1, count));
  const latestSeekTime = Number.isFinite(video.duration)
    ? Math.max(0, video.duration - 0.05)
    : requestedTime;
  video.currentTime = Math.max(0, Math.min(requestedTime, latestSeekTime));
};

const decodedWaveformAudio = new Map<string, Promise<AudioBuffer | null>>();

const decodeWaveformAudio = (src: string) => {
  const resolvedSrc = resolveMediaSource(src);
  const cached = decodedWaveformAudio.get(resolvedSrc);
  if (cached) return cached;

  const pending = (async () => {
    if (typeof window === "undefined") return null;
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const response = await fetch(resolvedSrc);
    if (!response.ok) return null;
    const context = new AudioContextConstructor();
    try {
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return null;
    } finally {
      void context.close();
    }
  })();

  decodedWaveformAudio.set(resolvedSrc, pending);
  return pending;
};

const sampleWaveformAudio = async (
  src: string,
  count: number,
  sourceStartFrames: number,
  sourceDurationFrames: number,
) => {
  const audioBuffer = await decodeWaveformAudio(src);
  if (!audioBuffer || audioBuffer.length === 0) return null;

  const channel = audioBuffer.getChannelData(0);
  const startSample = Math.max(
    0,
    Math.min(
      channel.length - 1,
      Math.round((sourceStartFrames / fps) * audioBuffer.sampleRate),
    ),
  );
  const availableSamples = channel.length - startSample;
  const requestedSamples = Math.max(
    1,
    Math.round((sourceDurationFrames / fps) * audioBuffer.sampleRate),
  );
  const sampleLength = Math.min(availableSamples, requestedSamples);
  const levels = Array.from({ length: count }, (_, index) => {
    const bucketStart =
      startSample + Math.floor((index / count) * sampleLength);
    const bucketEnd = Math.max(
      bucketStart + 1,
      startSample + Math.floor(((index + 1) / count) * sampleLength),
    );
    const stride = Math.max(1, Math.floor((bucketEnd - bucketStart) / 180));
    let sumSquares = 0;
    let samples = 0;
    for (let sample = bucketStart; sample < bucketEnd; sample += stride) {
      const value = channel[sample] ?? 0;
      sumSquares += value * value;
      samples += 1;
    }
    return Math.sqrt(sumSquares / Math.max(1, samples));
  });
  const sortedLevels = [...levels].sort((left, right) => left - right);
  const noiseFloor = sortedLevels[Math.floor(sortedLevels.length * 0.05)] ?? 0;
  const peakLevel = Math.max(
    noiseFloor + 0.001,
    sortedLevels[Math.floor(sortedLevels.length * 0.95)] ?? 0,
  );
  const dynamicRange = peakLevel - noiseFloor;

  return levels.map((level) => {
    const normalized = Math.max(
      0,
      Math.min(1, (level - noiseFloor) / dynamicRange),
    );
    return Math.max(0.06, Math.pow(normalized, 0.85));
  });
};

const TimelineWaveform = ({
  clipId,
  duration,
  src,
  sourceStart = 0,
  speed = 1,
  fadeInFrames = 0,
  fadeOutFrames = 0,
  volume = 1,
}: {
  clipId: string;
  duration: number;
  src?: string;
  sourceStart?: number;
  speed?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  volume?: number;
}) => {
  const lineCount = Math.max(120, Math.min(900, Math.round(duration)));
  const fallbackAmplitudes = useMemo(
    () => createWaveformBars(clipId, lineCount),
    [clipId, lineCount],
  );
  const [amplitudes, setAmplitudes] = useState(fallbackAmplitudes);

  useEffect(() => {
    let cancelled = false;
    setAmplitudes(fallbackAmplitudes);
    if (!src) return () => undefined;

    void sampleWaveformAudio(
      src,
      lineCount,
      sourceStart,
      duration * speed,
    ).then((sampledAmplitudes) => {
      if (!cancelled && sampledAmplitudes) {
        setAmplitudes(sampledAmplitudes);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [duration, fallbackAmplitudes, lineCount, sourceStart, speed, src]);

  const step = 100 / amplitudes.length;
  const baselineY = 19;
  const volumeDecibels = gainToDecibels(volume);
  const volumeVisualMultiplier =
    volume <= 0
      ? 0.12
      : Math.max(0.18, Math.min(1.8, 1 + volumeDecibels / 24));

  return (
    <svg
      className="audio-waveform-svg"
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
    >
      {amplitudes.map((amplitude, index) => {
        const localFrame =
          ((index + 0.5) / Math.max(1, amplitudes.length)) * duration;
        const fadeInMultiplier =
          fadeInFrames > 0 ? Math.min(1, localFrame / fadeInFrames) : 1;
        const framesBeforeEnd = duration - localFrame;
        const fadeOutMultiplier =
          fadeOutFrames > 0
            ? Math.min(1, framesBeforeEnd / fadeOutFrames)
            : 1;
        const fadeMultiplier = Math.max(
          0.08,
          Math.min(fadeInMultiplier, fadeOutMultiplier),
        );
        const height = Math.max(
          volume <= 0 ? 0.25 : 0.8,
          Math.min(18, amplitude * 17 * fadeMultiplier * volumeVisualMultiplier),
        );
        const x = index * step + step / 2;
        return (
          <line
            className="audio-waveform-line"
            key={`${clipId}-wave-${index}`}
            x1={x}
            x2={x}
            y1={baselineY - height}
            y2={baselineY}
            opacity={fadeMultiplier}
          />
        );
      })}
    </svg>
  );
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

const MIN_AUDIO_DB = -60;
const MAX_AUDIO_DB = 20;
const MAX_AUDIO_GAIN = 10;

const clampAudioGain = (volume: number) =>
  Math.max(0, Math.min(MAX_AUDIO_GAIN, Number.isFinite(volume) ? volume : 1));

const gainToDecibels = (volume: number) =>
  volume <= 0 ? MIN_AUDIO_DB : 20 * Math.log10(clampAudioGain(volume));

const decibelsToGain = (decibels: number) =>
  decibels <= MIN_AUDIO_DB
    ? 0
    : clampAudioGain(10 ** (Math.min(MAX_AUDIO_DB, decibels) / 20));

const formatVolumeDecibels = (volume: number) => {
  if (volume <= 0) return "-inf dB";
  const decibels = gainToDecibels(volume);
  return `${decibels >= 0 ? "+" : ""}${decibels.toFixed(1)} dB`;
};

const getAudioVolumeLineY = (volume: number) => {
  const decibels = Math.max(
    MIN_AUDIO_DB,
    Math.min(MAX_AUDIO_DB, gainToDecibels(volume)),
  );
  const position = (MAX_AUDIO_DB - decibels) / (MAX_AUDIO_DB - MIN_AUDIO_DB);
  return 15 + position * 70;
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
  let translateX = 0;
  let translateY = 0;
  let rotate = 0;
  const cutoutLineEffect = getCutoutLineEffectCss(clip, frame, effectIntensity);

  const filterCss = getClipFilterCss(
    visual?.filter ?? "none",
    filterIntensity * 100,
  );
  if (filterCss !== "none") {
    filters.push(filterCss);
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
      if (cutoutLineEffect) break;
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
      if (cutoutLineEffect) break;
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
    case "moving-white-outline": {
      if (cutoutLineEffect) break;
      const angle = ((frame % 72) / 72) * Math.PI * 2;
      const distance = Math.max(2, 5 * effectIntensity);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const oppositeX = Math.cos(angle + Math.PI) * distance;
      const oppositeY = Math.sin(angle + Math.PI) * distance;
      filters.push(
        `drop-shadow(${x}px ${y}px 0 rgba(255, 255, 255, 1))`,
        `drop-shadow(${oppositeX}px ${oppositeY}px 0 rgba(255, 255, 255, 0.78))`,
        `drop-shadow(0 0 ${7 * effectIntensity}px rgba(255, 255, 255, 0.92))`,
      );
      break;
    }
    case "neon-outline": {
      if (cutoutLineEffect) break;
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
    case "hand-drawn": {
      const jitterX = Math.sin(frame * 2.17) * 1.6 * effectIntensity;
      const jitterY = Math.cos(frame * 1.83) * 1.3 * effectIntensity;
      translateX = jitterX * 0.18;
      translateY = jitterY * 0.18;
      rotate = Math.sin(frame * 1.11) * 0.45 * effectIntensity;
      filters.push(
        `contrast(${1 + 0.16 * effectIntensity})`,
        `saturate(${1 - 0.22 * effectIntensity})`,
        `drop-shadow(${2 + jitterX}px ${jitterY}px 0 rgba(15, 23, 42, 0.95))`,
        `drop-shadow(${-2 - jitterX}px ${-jitterY}px 0 rgba(255, 255, 255, 0.9))`,
      );
      break;
    }
    case "scribble": {
      const angle = frame * 0.19;
      const x = Math.cos(angle) * 4 * effectIntensity;
      const y = Math.sin(angle * 1.3) * 4 * effectIntensity;
      filters.push(
        `drop-shadow(${x}px ${y}px 0 rgba(250, 204, 21, 0.95))`,
        `drop-shadow(${-y}px ${x}px 0 rgba(244, 114, 182, 0.9))`,
        `drop-shadow(${-x}px ${-y}px 0 rgba(34, 211, 238, 0.9))`,
      );
      rotate = Math.sin(frame * 0.27) * 0.65 * effectIntensity;
      break;
    }
    case "float":
      translateY = Math.sin(frame * 0.08) * -3.2 * effectIntensity;
      rotate = Math.sin(frame * 0.055) * 1.8 * effectIntensity;
      break;
    case "bounce": {
      const bounce = Math.abs(Math.sin(frame * 0.13));
      translateY = -5 * bounce * effectIntensity;
      scale *= 1 + bounce * 0.055 * effectIntensity;
      break;
    }
    case "motion-trail": {
      const trail = 5 + Math.abs(Math.sin(frame * 0.1)) * 7;
      filters.push(
        `drop-shadow(${-trail * effectIntensity}px 0 0 rgba(34, 211, 238, 0.58))`,
        `drop-shadow(${-trail * 1.8 * effectIntensity}px 1px 0 rgba(244, 114, 182, 0.38))`,
        `drop-shadow(${-trail * 2.6 * effectIntensity}px 2px 0 rgba(250, 204, 21, 0.24))`,
      );
      translateX = Math.sin(frame * 0.12) * 0.9 * effectIntensity;
      break;
    }
    case "rainbow-edge": {
      if (cutoutLineEffect) break;
      const angle = frame * 0.09;
      const radius = Math.max(2, 4 * effectIntensity);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      filters.push(
        `drop-shadow(${x}px ${y}px 0 rgba(34, 211, 238, 0.95))`,
        `drop-shadow(${-y}px ${x}px 0 rgba(250, 204, 21, 0.92))`,
        `drop-shadow(${-x}px ${-y}px 0 rgba(244, 63, 94, 0.92))`,
        `drop-shadow(${y}px ${-x}px 0 rgba(168, 85, 247, 0.92))`,
      );
      break;
    }
    case "electric-glow": {
      if (cutoutLineEffect) break;
      const spark = 0.72 + Math.abs(Math.sin(frame * 0.48)) * 0.28;
      filters.push(
        `brightness(${1 + 0.12 * spark * effectIntensity})`,
        `drop-shadow(0 0 ${5 * spark * effectIntensity}px rgba(255, 255, 255, 0.98))`,
        `drop-shadow(0 0 ${18 * spark * effectIntensity}px rgba(34, 211, 238, 0.92))`,
      );
      break;
    }
    case "comic-pop": {
      const beat = Math.pow(Math.abs(Math.sin(frame * 0.16)), 5);
      scale *= 1 + beat * 0.13 * effectIntensity;
      rotate = Math.sin(frame * 0.16) * beat * 1.8 * effectIntensity;
      filters.push(
        `contrast(${1 + 0.2 * effectIntensity})`,
        `saturate(${1 + 0.3 * effectIntensity})`,
      );
      break;
    }
    case "sway":
      translateX = Math.sin(frame * 0.065) * 2.4 * effectIntensity;
      translateY = Math.cos(frame * 0.065) * 0.7 * effectIntensity;
      rotate = Math.sin(frame * 0.065) * 3.2 * effectIntensity;
      break;
    case "flicker-outline": {
      if (cutoutLineEffect) break;
      const flicker = 0.35 + Math.abs(Math.sin(frame * 0.83)) * 0.65;
      const width = Math.max(1, 3.5 * flicker * effectIntensity);
      filters.push(
        `drop-shadow(${width}px 0 0 rgba(255, 255, 255, ${flicker}))`,
        `drop-shadow(${-width}px 0 0 rgba(255, 255, 255, ${flicker}))`,
        `drop-shadow(0 ${width}px 0 rgba(255, 255, 255, ${flicker}))`,
        `drop-shadow(0 ${-width}px 0 rgba(255, 255, 255, ${flicker}))`,
      );
      break;
    }
    case "silhouette":
      filters.push("brightness(0)");
      break;
    case "retro":
      filters.push(
        `sepia(${0.55 * effectIntensity})`,
        `contrast(${1 + 0.18 * effectIntensity})`,
        `saturate(${1 - 0.28 * effectIntensity})`,
      );
      break;
    case "halo-blur":
      filters.push(
        `blur(${1.4 * effectIntensity}px)`,
        `brightness(${1 + 0.12 * effectIntensity})`,
        `drop-shadow(0 0 ${20 * effectIntensity}px rgba(255,255,255,0.7))`,
      );
      break;
    case "glass-flare":
      filters.push(
        `brightness(${1 + 0.22 * effectIntensity})`,
        `saturate(${1 + 0.22 * effectIntensity})`,
        `drop-shadow(${12 * effectIntensity}px ${-8 * effectIntensity}px ${18 * effectIntensity}px rgba(125,211,252,0.7))`,
      );
      break;
    case "colors-off":
      filters.push(
        `grayscale(${0.82 * effectIntensity})`,
        `contrast(${1 + 0.18 * effectIntensity})`,
      );
      break;
    case "shake":
      translateX = Math.sin(frame * 1.73) * 1.6 * effectIntensity;
      translateY = Math.cos(frame * 2.11) * 1.1 * effectIntensity;
      rotate = Math.sin(frame * 1.31) * 0.8 * effectIntensity;
      break;
    case "dynamic":
      scale *= 1 + Math.abs(Math.sin(frame * 0.16)) * 0.08 * effectIntensity;
      filters.push(`saturate(${1 + 0.28 * effectIntensity})`);
      break;
    case "glitch":
      translateX = Math.sin(frame * 2.7) * 1.8 * effectIntensity;
      filters.push(
        `hue-rotate(${Math.sin(frame * 0.7) * 28 * effectIntensity}deg)`,
        `contrast(${1 + 0.24 * effectIntensity})`,
      );
      break;
    case "dream":
      filters.push(
        `blur(${1.2 * effectIntensity}px)`,
        `brightness(${1 + 0.14 * effectIntensity})`,
        `saturate(${1 - 0.16 * effectIntensity})`,
      );
      break;
    case "vivid-pop":
      filters.push(
        `saturate(${1 + 0.65 * effectIntensity})`,
        `contrast(${1 + 0.22 * effectIntensity})`,
      );
      break;
    case "pulse":
      scale *= 1 + Math.abs(Math.sin(frame * 0.2)) * 0.1 * effectIntensity;
      break;
    case "flash":
      filters.push(
        `brightness(${1 + Math.abs(Math.sin(frame * 0.24)) * 0.55 * effectIntensity})`,
      );
      break;
    case "soft-focus":
      filters.push(
        `blur(${2.2 * effectIntensity}px)`,
        `contrast(${1 - 0.08 * effectIntensity})`,
        `brightness(${1 + 0.1 * effectIntensity})`,
      );
      break;
    case "warm-glow":
      filters.push(
        `sepia(${0.24 * effectIntensity})`,
        `saturate(${1 + 0.3 * effectIntensity})`,
        `drop-shadow(0 0 ${16 * effectIntensity}px rgba(251,191,36,0.65))`,
      );
      break;
    case "cool-glow":
      filters.push(
        `hue-rotate(${10 * effectIntensity}deg)`,
        `brightness(${1 + 0.08 * effectIntensity})`,
        `drop-shadow(0 0 ${16 * effectIntensity}px rgba(34,211,238,0.65))`,
      );
      break;
    case "contrast-pop":
      filters.push(
        `contrast(${1 + 0.42 * effectIntensity})`,
        `saturate(${1 + 0.18 * effectIntensity})`,
      );
      break;
    case "zoom":
      scale = 1 + 0.12 * effectIntensity;
      break;
    default:
      break;
  }

  if (cutoutLineEffect) {
    filters.push(cutoutLineEffect);
  }

  return {
    filter: filters.join(" "),
    opacity,
    scale,
    translateX,
    translateY,
    rotate,
  };
};

const getClipAnimationPresentation = (
  clip: TimelineClip | undefined,
  playheadFrame: number,
) => {
  if (!clip) {
    return {
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0,
    };
  }

  const animation = {
    ...defaultClipAnimation,
    ...clip.animation,
  };
  if (animation.preset === "none") {
    return {
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0,
    };
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
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let rotation = 0;

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
    case "slide-left-in":
      translateX = useStartWindow ? (1 - startProgress) * -24 : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "slide-right-in":
      translateX = useStartWindow ? (1 - startProgress) * 24 : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "slide-up-in":
      translateY = useStartWindow ? (1 - startProgress) * -24 : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "slide-down-in":
      translateY = useStartWindow ? (1 - startProgress) * 24 : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
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
    case "spin-in":
      scale = useStartWindow ? 0.74 + startProgress * 0.26 : 1;
      rotation = useStartWindow ? -180 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.35, startProgress) : 1;
      break;
    case "tilt-in":
      translateY = useStartWindow ? 10 * (1 - startProgress) : 0;
      rotation = useStartWindow ? -14 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.4, startProgress) : 1;
      break;
    case "bounce":
      translateY = useStartWindow
        ? -Math.abs(Math.sin(startProgress * Math.PI * 2.5)) *
          (1 - startProgress) *
          14
        : 0;
      opacity = useStartWindow ? Math.max(0.45, startProgress) : 1;
      break;
    case "shake":
      translateX = useStartWindow
        ? Math.sin(startProgress * Math.PI * 8) * (1 - startProgress) * 9
        : 0;
      opacity = useStartWindow ? Math.max(0.6, startProgress) : 1;
      break;
    case "pulse":
      scale = useStartWindow ? 1 + Math.sin(startProgress * Math.PI) * 0.18 : 1;
      opacity = useStartWindow ? Math.max(0.6, startProgress) : 1;
      break;
    case "flash":
      opacity = useStartWindow
        ? startProgress < 0.25
          ? 0.25
          : startProgress < 0.5
            ? 1
            : startProgress < 0.72
              ? 0.42
              : 1
        : 1;
      break;
    case "elastic-in":
      scale = useStartWindow
        ? 1 - Math.sin(startProgress * Math.PI * 3) * (1 - startProgress) * 0.28
        : 1;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "swing-in":
      rotation = useStartWindow
        ? Math.cos(startProgress * Math.PI * 3.5) * (1 - startProgress) * -24
        : 0;
      opacity = useStartWindow ? Math.max(0.35, startProgress) : 1;
      break;
    case "flip-horizontal":
      scale = useStartWindow
        ? Math.max(
            0.08,
            Math.abs(Math.cos((1 - startProgress) * Math.PI * 0.5)),
          )
        : 1;
      opacity = useStartWindow ? Math.max(0.35, startProgress) : 1;
      break;
    case "flip-vertical":
      scale = useStartWindow ? 0.72 + 0.28 * startProgress : 1;
      rotation = useStartWindow ? 90 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.35, startProgress) : 1;
      break;
    case "cube-turn":
      translateX = useStartWindow ? -18 * (1 - startProgress) : 0;
      scale = useStartWindow ? 0.76 + 0.24 * startProgress : 1;
      rotation = useStartWindow ? -42 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "roll-in":
      translateX = useStartWindow ? -34 * (1 - startProgress) : 0;
      rotation = useStartWindow ? -270 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "drop-in":
      translateY = useStartWindow
        ? -38 * (1 - startProgress) +
          Math.sin(startProgress * Math.PI * 3) * (1 - startProgress) * 7
        : 0;
      opacity = useStartWindow ? Math.max(0.3, startProgress) : 1;
      break;
    case "whip-pan":
      translateX = useStartWindow ? -58 * (1 - startProgress) : 0;
      rotation = useStartWindow ? -5 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.25, startProgress) : 1;
      break;
    case "spiral-in":
      scale = useStartWindow ? 0.35 + 0.65 * startProgress : 1;
      rotation = useStartWindow ? -360 * (1 - startProgress) : 0;
      opacity = useStartWindow ? Math.max(0.2, startProgress) : 1;
      break;
    case "drift":
      if (useStartWindow) {
        translateX = Math.sin(startProgress * Math.PI * 2) * 5;
        translateY = Math.cos(startProgress * Math.PI * 2) * 3;
        rotation = Math.sin(startProgress * Math.PI * 2) * 2;
      }
      break;
    case "heartbeat":
      scale = useStartWindow
        ? 1 +
          Math.max(0, Math.sin(startProgress * Math.PI * 4)) *
            0.16 *
            (1 - startProgress * 0.35)
        : 1;
      break;
    case "strobe":
      opacity =
        useStartWindow && Math.sin(startProgress * Math.PI * 10) <= -0.1
          ? 0.22
          : 1;
      break;
    case "wobble":
      if (useStartWindow) {
        translateX =
          Math.sin(startProgress * Math.PI * 6) * (1 - startProgress) * 6;
        rotation =
          Math.sin(startProgress * Math.PI * 6) * (1 - startProgress) * 9;
      }
      break;
    case "zoom-burst":
      scale = useStartWindow ? 1.7 - 0.7 * startProgress : 1;
      opacity = useStartWindow ? Math.max(0.25, startProgress) : 1;
      break;
    default:
      break;
  }

  return { opacity, translateX, translateY, scale, rotation };
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
  { id: "slide-left-in", label: "Slide left" },
  { id: "slide-right-in", label: "Slide right" },
  { id: "slide-up-in", label: "Slide up" },
  { id: "slide-down-in", label: "Slide down" },
  { id: "zoom-in", label: "Zoom in" },
  { id: "zoom-out", label: "Zoom out" },
  { id: "pop", label: "Pop" },
  { id: "spin-in", label: "Spin in" },
  { id: "tilt-in", label: "Tilt in" },
  { id: "bounce", label: "Bounce" },
  { id: "shake", label: "Shake" },
  { id: "pulse", label: "Pulse" },
  { id: "flash", label: "Flash" },
  { id: "elastic-in", label: "Elastic" },
  { id: "swing-in", label: "Swing" },
  { id: "flip-horizontal", label: "Flip H" },
  { id: "flip-vertical", label: "Flip V" },
  { id: "cube-turn", label: "Cube turn" },
  { id: "roll-in", label: "Roll in" },
  { id: "drop-in", label: "Drop in" },
  { id: "whip-pan", label: "Whip pan" },
  { id: "spiral-in", label: "Spiral" },
  { id: "drift", label: "Drift" },
  { id: "heartbeat", label: "Heartbeat" },
  { id: "strobe", label: "Strobe" },
  { id: "wobble", label: "Wobble" },
  { id: "zoom-burst", label: "Zoom burst" },
];

const animationCategories: Array<{
  id: string;
  label: string;
  optionIds: ClipAnimationPreset[];
}> = [
  {
    id: "trending",
    label: "Trending",
    optionIds: [
      "pop",
      "spin-in",
      "elastic-in",
      "whip-pan",
      "zoom-burst",
      "strobe",
      "bounce",
      "shake",
    ],
  },
  {
    id: "three-d",
    label: "3D & Flip",
    optionIds: [
      "flip-horizontal",
      "flip-vertical",
      "cube-turn",
      "roll-in",
      "spiral-in",
    ],
  },
  {
    id: "movement",
    label: "Movement",
    optionIds: [
      "slide-left-in",
      "slide-right-in",
      "slide-up-in",
      "slide-down-in",
      "tilt-in",
      "drop-in",
      "swing-in",
      "wobble",
      "drift",
    ],
  },
  {
    id: "rhythm",
    label: "Rhythm",
    optionIds: ["pulse", "heartbeat", "flash", "strobe", "bounce", "shake"],
  },
  {
    id: "classic",
    label: "Classic",
    optionIds: ["fade-in", "slide-in", "zoom-in"],
  },
  {
    id: "exit",
    label: "Exit",
    optionIds: ["fade-out", "slide-out", "zoom-out"],
  },
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

const effectOptions: Array<{ id: ClipEffect; label: string; preview: string }> =
  [
    { id: "none", label: "None", preview: "NO" },
    { id: "blur", label: "Blur", preview: "BL" },
    { id: "glow", label: "Glow", preview: "GL" },
    { id: "shake", label: "Shake", preview: "SH" },
    { id: "dynamic", label: "Dynamic", preview: "DY" },
    { id: "glitch", label: "Glitch", preview: "GX" },
    { id: "retro", label: "Retro", preview: "RT" },
    { id: "halo-blur", label: "Halo Blur", preview: "HB" },
    { id: "glass-flare", label: "Glass Flare", preview: "GF" },
    { id: "dream", label: "Dream", preview: "DR" },
    { id: "vivid-pop", label: "Vivid Pop", preview: "VP" },
    { id: "pulse", label: "Pulse", preview: "PL" },
    { id: "flash", label: "Flash", preview: "FL" },
    { id: "soft-focus", label: "Soft Focus", preview: "SF" },
    { id: "warm-glow", label: "Warm Glow", preview: "WG" },
    { id: "cool-glow", label: "Cool Glow", preview: "CG" },
    { id: "contrast-pop", label: "Contrast", preview: "CP" },
    { id: "colors-off", label: "Colors Off", preview: "BW" },
    { id: "grayscale", label: "B/W", preview: "BW" },
    { id: "invert", label: "Invert", preview: "IN" },
    { id: "fade", label: "Fade", preview: "FA" },
    { id: "shadow", label: "Shadow", preview: "SD" },
    { id: "outline", label: "Outline", preview: "OL" },
    { id: "zoom", label: "Zoom", preview: "ZM" },
  ];

const cutoutEffectOptions: Array<{
  id: ClipEffect;
  label: string;
  preview: string;
}> = [
  ...effectOptions,
  { id: "moving-outline", label: "Moving Outline", preview: "MO" },
  {
    id: "moving-white-outline",
    label: "Moving White Outline",
    preview: "WO",
  },
  { id: "neon-outline", label: "Neon Edge", preview: "NE" },
  { id: "hand-drawn", label: "Sketch Wobble", preview: "SK" },
  { id: "scribble", label: "Doodle Edge", preview: "DO" },
  { id: "float", label: "Float", preview: "FT" },
  { id: "bounce", label: "Bounce", preview: "BO" },
  { id: "motion-trail", label: "Motion Trail", preview: "MT" },
  { id: "rainbow-edge", label: "Rainbow Edge", preview: "RE" },
  { id: "electric-glow", label: "Electric Glow", preview: "EG" },
  { id: "comic-pop", label: "Comic Pop", preview: "CP" },
  { id: "sway", label: "Sway", preview: "SW" },
  { id: "flicker-outline", label: "Flicker Outline", preview: "FO" },
  { id: "silhouette", label: "Silhouette", preview: "SI" },
];

const EffectReferencePreview = () => (
  <span className="effect-card-preview" aria-hidden="true">
    <span className="effect-preview-stage">
      <i className="effect-preview-subject" />
      <i className="effect-preview-accent" />
    </span>
  </span>
);

const cutoutLineStyleOptions: Array<{
  id: CutoutLineStyle;
  label: string;
}> = [
  { id: "solid", label: "Solid" },
  { id: "glow", label: "Glow" },
  { id: "double", label: "Double" },
  { id: "sketch", label: "Sketch" },
];

const cutoutLinePresetOptions: Array<{
  id: string;
  label: string;
  effect: ClipEffect;
  style: CutoutLineStyle;
  color: string;
  opacity: number;
  width: number;
}> = [
  {
    id: "clean",
    label: "Clean Line",
    effect: "outline",
    style: "solid",
    color: "#ffffff",
    opacity: 100,
    width: 2,
  },
  {
    id: "color",
    label: "Color Line",
    effect: "outline",
    style: "solid",
    color: "#facc15",
    opacity: 100,
    width: 3,
  },
  {
    id: "bold",
    label: "Bold Line",
    effect: "outline",
    style: "solid",
    color: "#ffffff",
    opacity: 100,
    width: 6,
  },
  {
    id: "double",
    label: "Double Line",
    effect: "outline",
    style: "double",
    color: "#ffffff",
    opacity: 100,
    width: 2,
  },
  {
    id: "sketch",
    label: "Sketch Line",
    effect: "moving-outline",
    style: "sketch",
    color: "#facc15",
    opacity: 100,
    width: 3,
  },
  {
    id: "moving",
    label: "Moving Line",
    effect: "moving-outline",
    style: "solid",
    color: "#ffffff",
    opacity: 100,
    width: 3,
  },
];

const effectSections: Array<{
  label: string;
  ids: ClipEffect[];
}> = [
  {
    label: "Trending",
    ids: ["blur", "shake", "dynamic", "glitch", "halo-blur", "glass-flare"],
  },
  {
    label: "Classic",
    ids: ["retro", "colors-off", "soft-focus", "shadow", "outline", "zoom"],
  },
  {
    label: "Hits",
    ids: [
      "vivid-pop",
      "pulse",
      "flash",
      "dream",
      "warm-glow",
      "cool-glow",
      "contrast-pop",
    ],
  },
  { label: "More", ids: ["glow", "grayscale", "invert", "fade"] },
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
  { id: "classic-mv", label: "Classic MV" },
  { id: "summer-glow", label: "Summer Glow" },
  { id: "bare-skin", label: "Bare Skin" },
  { id: "filmic-haze", label: "Filmic Haze" },
  { id: "plum-haze", label: "Plum Haze" },
  { id: "flash-night", label: "Flash Night" },
  { id: "light-boost", label: "Light Boost" },
  { id: "cyber-soft", label: "Cyber Soft" },
  { id: "tokyo", label: "Tokyo" },
  { id: "dreamy-rose", label: "Dreamy Rose" },
  { id: "pearl-glow", label: "Pearl Glow" },
  { id: "lavender-dream", label: "Lavender Dream" },
  { id: "stage-light", label: "Stage Light" },
  { id: "violet-rush", label: "Violet Rush" },
  { id: "y2k", label: "Y2K Interlude" },
  { id: "stranger", label: "Stranger" },
  { id: "burgundy", label: "Burgundy" },
  { id: "misty-pink", label: "Misty Pink" },
  { id: "nude-tone", label: "Nude Tone" },
  { id: "olive-film", label: "Olive Film" },
  { id: "muted-gray", label: "Muted Gray" },
  { id: "coral-mood", label: "Coral Mood" },
  { id: "film-fade", label: "Film Fade" },
  { id: "ocean-glow", label: "Ocean Glow" },
  { id: "low-res", label: "Low Res Story" },
  { id: "gentle-cream", label: "Gentle Cream" },
  { id: "amorous", label: "Amorous" },
  { id: "timeless", label: "Timeless" },
  { id: "newspaper", label: "Newspaper" },
  { id: "hollywood", label: "Hollywood" },
  { id: "old-flame", label: "Old Flame" },
  { id: "light-pastel", label: "Light Pastel" },
  { id: "fluffy-snap", label: "Fluffy Snap" },
  { id: "sweet-paws", label: "Sweet Paws" },
  { id: "warm-caramel", label: "Warm Caramel" },
  { id: "cuddle-shade", label: "Cuddle Shade" },
  { id: "chestnut", label: "Chestnut" },
  { id: "soft-ginger", label: "Soft Ginger" },
];

const filterSections: Array<{ label: string; ids: ClipFilter[] }> = [
  {
    label: "Basic",
    ids: ["warm", "cool", "vivid", "vintage", "sepia", "cinema", "soft"],
  },
  {
    label: "Featured",
    ids: [
      "classic-mv",
      "summer-glow",
      "bare-skin",
      "filmic-haze",
      "plum-haze",
      "flash-night",
      "light-boost",
      "cyber-soft",
      "tokyo",
    ],
  },
  {
    label: "Hits",
    ids: [
      "dreamy-rose",
      "pearl-glow",
      "lavender-dream",
      "stage-light",
      "violet-rush",
      "y2k",
      "stranger",
      "burgundy",
    ],
  },
  {
    label: "Life",
    ids: [
      "misty-pink",
      "nude-tone",
      "olive-film",
      "muted-gray",
      "coral-mood",
      "film-fade",
      "ocean-glow",
    ],
  },
  {
    label: "Photo Booth",
    ids: [
      "low-res",
      "gentle-cream",
      "amorous",
      "burgundy",
      "timeless",
      "newspaper",
      "hollywood",
      "old-flame",
    ],
  },
  {
    label: "Pet",
    ids: [
      "light-pastel",
      "fluffy-snap",
      "sweet-paws",
      "warm-caramel",
      "cuddle-shade",
      "chestnut",
      "soft-ginger",
    ],
  },
];

const textFontOptions = [
  "Inter",
  "Arial",
  "Arial Black",
  "Segoe UI",
  "Impact",
  "Georgia",
  "Garamond",
  "Palatino Linotype",
  "Verdana",
  "Trebuchet MS",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Comic Sans MS",
  "Times New Roman",
  "Courier New",
  "Lucida Console",
  "Brush Script MT",
];

type TextStylePreset = {
  id: string;
  label: string;
  sample: string;
  style: Parameters<typeof setTextStyleById>[2];
};

const textStylePresets: TextStylePreset[] = [
  {
    id: "clean",
    label: "Clean",
    sample: "Simple title",
    style: {
      fontFamily: "Segoe UI",
      fontWeight: "700",
      fontStyle: "normal",
      color: "#ffffff",
      effect: "none",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    sample: "New story",
    style: {
      fontFamily: "Georgia",
      fontWeight: "700",
      fontStyle: "italic",
      color: "#fff7ed",
      effect: "shadow",
    },
  },
  {
    id: "impact",
    label: "Impact",
    sample: "WATCH THIS",
    style: {
      fontFamily: "Impact",
      fontWeight: "900",
      fontStyle: "normal",
      color: "#ffffff",
      effect: "outline",
    },
  },
  {
    id: "neon",
    label: "Neon",
    sample: "Glow up",
    style: {
      fontFamily: "Trebuchet MS",
      fontWeight: "900",
      fontStyle: "normal",
      color: "#5eead4",
      effect: "glow",
    },
  },
  {
    id: "comic",
    label: "Comic",
    sample: "WOW!",
    style: {
      fontFamily: "Comic Sans MS",
      fontWeight: "900",
      fontStyle: "normal",
      color: "#fde047",
      effect: "outline",
    },
  },
  {
    id: "retro",
    label: "Retro",
    sample: "PLAY BACK",
    style: {
      fontFamily: "Courier New",
      fontWeight: "900",
      fontStyle: "normal",
      color: "#fb923c",
      effect: "shadow",
    },
  },
  {
    id: "sport",
    label: "Sport",
    sample: "GAME ON",
    style: {
      fontFamily: "Arial Black",
      fontWeight: "900",
      fontStyle: "italic",
      color: "#f8fafc",
      effect: "outline",
    },
  },
  {
    id: "holiday",
    label: "Holiday",
    sample: "Celebrate",
    style: {
      fontFamily: "Brush Script MT",
      fontWeight: "700",
      fontStyle: "normal",
      color: "#f87171",
      effect: "outline",
    },
  },
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
    filter: visual.filter,
    opacity: visual.opacity * animation.opacity * transition.opacity,
    translate: `${visual.translateX + animation.translateX + transition.translateX}% ${visual.translateY + animation.translateY}%`,
    scale: visual.scale * animation.scale * transition.scale,
    rotate: `${visual.rotate + animation.rotation}deg`,
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
  category?: string;
  uploaded?: boolean;
};

const svgSticker = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${body}</svg>`,
  )}`;

const stickerTile = (
  label: string,
  background: string,
  body: string,
  textColor = "#f8fafc",
) =>
  svgSticker(
    `<rect width="160" height="160" rx="22" fill="${background}"/>${body}<text x="80" y="144" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="${textColor}">${label}</text>`,
  );

const builtInStickers: StickerItem[] = [
  {
    id: "sticker-star",
    label: "Star",
    category: "Stickers",
    src: svgSticker(
      '<path fill="#facc15" d="M80 12l20 42 46 6-33 32 8 46-41-22-41 22 8-46-33-32 46-6z"/>',
    ),
  },
  {
    id: "sticker-heart",
    label: "Heart",
    category: "Stickers",
    src: svgSticker(
      '<path fill="#fb496f" d="M80 140C24 108 10 77 20 47 31 15 68 16 80 42c12-26 49-27 60 5 10 30-4 61-60 93z"/>',
    ),
  },
  {
    id: "sticker-sparkles",
    label: "Sparkles",
    category: "Stickers",
    src: svgSticker(
      '<path fill="#a855f7" d="M80 8l12 45 44 12-44 12-12 45-12-45-44-12 44-12z"/><path fill="#facc15" d="M125 92l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/>',
    ),
  },
  {
    id: "sticker-smile",
    label: "Smile",
    category: "Stickers",
    src: svgSticker(
      '<circle cx="80" cy="80" r="65" fill="#facc15"/><circle cx="57" cy="66" r="7"/><circle cx="103" cy="66" r="7"/><path d="M48 92c12 28 52 28 64 0" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>',
    ),
  },
  {
    id: "sticker-fire",
    label: "Fire",
    category: "Stickers",
    src: svgSticker(
      '<path fill="#f97316" d="M84 8c9 31-13 40 1 59 7 9 18 3 21-9 30 25 38 80-24 94-57-7-68-57-30-91-3 26 15 28 20 13 8-24-8-36 12-66z"/><path fill="#facc15" d="M81 76c18 19 20 48 0 61-20-10-25-34 0-61z"/>',
    ),
  },
  {
    id: "sticker-check",
    label: "Check",
    category: "Stickers",
    src: svgSticker(
      '<circle cx="80" cy="80" r="66" fill="#22c55e"/><path d="M43 82l24 24 51-55" fill="none" stroke="white" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
  },
  {
    id: "sticker-rain-cloud",
    label: "Rain Cloud",
    category: "Stickers",
    src: stickerTile(
      "Rain Cloud",
      "#1f2937",
      '<path d="M45 76c-13 0-24-10-24-23s11-23 24-23c4 0 8 1 12 3 8-14 27-18 40-7 5 4 8 9 10 15h4c16 0 29 12 29 28s-13 28-29 28H45z" fill="#7dd3fc"/><path d="M42 106l-7 24M72 106l-7 24M102 106l-7 24M132 106l-7 24" stroke="#38bdf8" stroke-width="7" stroke-linecap="round"/><path d="M113 35l-12 27h18l-18 35" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
  },
  {
    id: "sticker-subscribe",
    label: "Subscribe",
    category: "Stickers",
    src: stickerTile(
      "Subscribe",
      "#111827",
      '<rect x="24" y="52" width="112" height="42" rx="8" fill="#ef4444" stroke="#fff" stroke-width="5"/><text x="80" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="white">SUBSCRIBE</text><path d="M99 96l20 12-14 5 7 16-10 4-7-17-12 10z" fill="white" stroke="#111827" stroke-width="3"/>',
    ),
  },
  {
    id: "sticker-down-arrow",
    label: "Down Arrow",
    category: "Stickers",
    src: stickerTile(
      "Down Arrow",
      "#172554",
      '<path d="M80 28v70" stroke="#7dd3fc" stroke-width="24" stroke-linecap="round"/><path d="M38 81l42 48 42-48z" fill="#38bdf8" stroke="#bae6fd" stroke-width="7" stroke-linejoin="round"/>',
    ),
  },
  {
    id: "sticker-blue-leaf",
    label: "Blue Leaf",
    category: "Stickers",
    src: stickerTile(
      "Blue Leaf",
      "#0f172a",
      '<path d="M42 125C46 51 101 22 132 30c-5 56-45 96-90 95z" fill="#60a5fa"/><path d="M45 122c34-31 58-55 83-90M63 102l-18-16M82 83l-23-22M101 63l-18-18" stroke="#1e3a8a" stroke-width="5" stroke-linecap="round"/>',
    ),
  },
  {
    id: "sticker-cream-cloud",
    label: "Cream Cloud",
    category: "Stickers",
    src: stickerTile(
      "Cream Cloud",
      "#111827",
      '<path d="M44 112c36 14 79 10 93-9 8-11 3-25-10-29 3-16-10-31-27-28-5-19-31-22-43-7-17-3-30 11-27 27-15 5-20 24-8 36 5 5 12 8 22 10z" fill="#fff7ed"/><path d="M55 77c20 4 40 4 61-3M48 96c26 9 55 9 83 0" stroke="#fed7aa" stroke-width="6" stroke-linecap="round"/>',
    ),
  },
  {
    id: "sticker-astronaut-waiting",
    label: "Still Waiting",
    category: "Giphy",
    src: stickerTile(
      "Still Waiting",
      "#020617",
      '<circle cx="80" cy="60" r="36" fill="#e5e7eb"/><circle cx="80" cy="60" r="26" fill="#111827"/><path d="M54 106c18 15 34 15 52 0v30H54z" fill="#d1d5db"/><text x="80" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#f8fafc">STILL</text>',
    ),
  },
  {
    id: "sticker-whatever",
    label: "Whatever",
    category: "Giphy",
    src: stickerTile(
      "Whatever",
      "#312e81",
      '<circle cx="80" cy="56" r="27" fill="#facc15"/><path d="M48 105c18-19 46-19 64 0v29H48z" fill="#111827"/><path d="M54 74c15 13 37 13 52 0" stroke="#111827" stroke-width="6" stroke-linecap="round"/><text x="80" y="102" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#fff">WHATEVER</text>',
    ),
  },
  {
    id: "sticker-running-cat",
    label: "Run Loop",
    category: "Giphy",
    src: stickerTile(
      "Run Loop",
      "#14532d",
      '<path d="M41 87c16-26 48-30 76-11l16-15v27c0 22-21 39-51 39-28 0-48-12-41-40z" fill="#f8fafc"/><circle cx="110" cy="74" r="6" fill="#111827"/><path d="M67 119l-15 18M98 119l15 18M44 101H20M47 83H24" stroke="#111827" stroke-width="7" stroke-linecap="round"/>',
    ),
  },
  {
    id: "sticker-laughing",
    label: "Laugh",
    category: "Giphy",
    src: stickerTile(
      "Laugh",
      "#7c2d12",
      '<circle cx="80" cy="64" r="38" fill="#fed7aa"/><path d="M52 53c10-12 46-17 61 3" stroke="#111827" stroke-width="7" stroke-linecap="round"/><path d="M52 79c21 25 53 25 56 0" fill="#111827"/><path d="M61 82c11 7 28 7 39 0" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
    ),
  },
  {
    id: "stock-color-bars",
    label: "Color Bars",
    category: "Stock videos",
    src: stickerTile(
      "00:01",
      "#27272a",
      '<rect x="30" y="36" width="100" height="64" fill="#fff"/><rect x="30" y="36" width="14" height="64" fill="#fef08a"/><rect x="44" y="36" width="14" height="64" fill="#22d3ee"/><rect x="58" y="36" width="14" height="64" fill="#22c55e"/><rect x="72" y="36" width="14" height="64" fill="#f0f"/><rect x="86" y="36" width="14" height="64" fill="#ef4444"/><rect x="100" y="36" width="14" height="64" fill="#2563eb"/><rect x="114" y="36" width="16" height="64" fill="#111827"/>',
    ),
  },
  {
    id: "stock-mountain",
    label: "Mountain",
    category: "Stock videos",
    src: stickerTile(
      "00:20",
      "#0c4a6e",
      '<rect x="20" y="24" width="120" height="86" rx="8" fill="#7dd3fc"/><path d="M20 110l40-55 24 32 18-22 38 45z" fill="#475569"/><path d="M54 64l6-9 7 9zM96 72l6-7 6 7z" fill="#f8fafc"/><path d="M20 104c34-9 76-7 120 3v20H20z" fill="#65a30d"/>',
    ),
  },
  {
    id: "stock-spark-sign",
    label: "Spark Sign",
    category: "Stock videos",
    src: stickerTile(
      "00:04",
      "#0f172a",
      '<path d="M52 54h56v17H70v15h34v17H52z" fill="none" stroke="#fde68a" stroke-width="8" stroke-linejoin="round"/><path d="M30 32l10 12M128 36l-12 12M132 102l-16-5M32 112l18-9M80 20v17" stroke="#f97316" stroke-width="5" stroke-linecap="round"/>',
    ),
  },
  {
    id: "photo-city",
    label: "City",
    category: "Photos",
    src: stickerTile(
      "City",
      "#0f172a",
      '<rect x="18" y="28" width="124" height="92" rx="9" fill="#93c5fd"/><path d="M23 93h114v27H23z" fill="#1e293b"/><rect x="38" y="62" width="16" height="58" fill="#f59e0b"/><rect x="62" y="48" width="20" height="72" fill="#475569"/><rect x="91" y="70" width="25" height="50" fill="#334155"/><path d="M18 46c36-16 83-12 124 8" stroke="#f8fafc" stroke-width="7"/>',
    ),
  },
  {
    id: "photo-ocean",
    label: "Ocean",
    category: "Photos",
    src: stickerTile(
      "Ocean",
      "#082f49",
      '<rect x="18" y="28" width="124" height="92" rx="9" fill="#67e8f9"/><path d="M18 74c29-10 49 11 75 0 17-7 31-4 49 5v41H18z" fill="#0891b2"/><path d="M105 59h29v13h-29zM115 48v42" stroke="#ef4444" stroke-width="5"/><path d="M31 90c21 7 41 7 61 0" stroke="#cffafe" stroke-width="5" stroke-linecap="round"/>',
    ),
  },
  {
    id: "photo-food",
    label: "Food",
    category: "Photos",
    src: stickerTile(
      "Food",
      "#292524",
      '<rect x="34" y="48" width="92" height="62" rx="12" fill="#f59e0b" transform="rotate(-12 80 79)"/><circle cx="62" cy="73" r="16" fill="#fee2e2"/><circle cx="94" cy="73" r="16" fill="#dc2626"/><path d="M45 100c25-16 48-17 77-5" stroke="#22c55e" stroke-width="9" stroke-linecap="round"/>',
    ),
  },
  {
    id: "photo-puppy",
    label: "Puppy",
    category: "Photos",
    src: stickerTile(
      "Puppy",
      "#365314",
      '<circle cx="80" cy="77" r="35" fill="#f8fafc"/><path d="M50 67c-25-9-25 30-2 29M110 67c25-9 25 30 2 29" fill="#e2e8f0"/><circle cx="67" cy="75" r="5" fill="#111827"/><circle cx="93" cy="75" r="5" fill="#111827"/><path d="M80 84l-8 9h16z" fill="#111827"/><path d="M68 101c9 7 15 7 24 0" stroke="#111827" stroke-width="4" stroke-linecap="round"/>',
    ),
  },
  {
    id: "avatar-pink",
    label: "AI Avatar 1",
    category: "AI avatars",
    src: stickerTile(
      "Avatar 1",
      "#27272a",
      '<circle cx="80" cy="50" r="24" fill="#fbcfe8"/><path d="M53 51c7-25 47-31 56 5-14-8-32-10-56-5z" fill="#111827"/><path d="M42 137c4-35 20-53 38-53s34 18 38 53z" fill="#ec4899"/><path d="M60 112h40" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>',
    ),
  },
  {
    id: "avatar-fitness",
    label: "AI Avatar 2",
    category: "AI avatars",
    src: stickerTile(
      "Avatar 2",
      "#1f2937",
      '<circle cx="80" cy="48" r="23" fill="#fed7aa"/><path d="M59 42c10-22 42-18 48 5-16-5-31-4-48-5z" fill="#7c2d12"/><path d="M48 137l12-49h40l12 49z" fill="#94a3b8"/><path d="M46 98l-20 17M114 98l20 17" stroke="#fed7aa" stroke-width="9" stroke-linecap="round"/>',
    ),
  },
  {
    id: "avatar-glasses",
    label: "AI Avatar 3",
    category: "AI avatars",
    src: stickerTile(
      "Avatar 3",
      "#27272a",
      '<circle cx="80" cy="48" r="23" fill="#fde68a"/><path d="M58 42c11-22 37-25 49 3-14-2-31-3-49-3z" fill="#475569"/><circle cx="69" cy="51" r="8" fill="none" stroke="#111827" stroke-width="4"/><circle cx="91" cy="51" r="8" fill="none" stroke="#111827" stroke-width="4"/><path d="M50 137V90h60v47z" fill="#cbd5e1"/>',
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
  subjectBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
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
    subjectBounds?: BackgroundRemovalResult["subjectBounds"];
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

  return {
    src: payload.src,
    mimeType: payload.mimeType,
    subjectBounds: payload.subjectBounds,
  };
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

type TranscriptSentenceEditorProps = {
  content: string;
  timestamp: string;
  onDeleteWords: (wordIndexes: number[]) => void;
};

const TranscriptSentenceEditor: React.FC<TranscriptSentenceEditorProps> = ({
  content,
  timestamp,
  onDeleteWords,
}) => {
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  const commitDeletedWords = () => {
    const removedWordIndexes = getRemovedTranscriptWordIndexes(content, draft);
    if (removedWordIndexes.length === 0) {
      setDraft(content);
      return;
    }
    onDeleteWords(removedWordIndexes);
  };

  return (
    <textarea
      className="transcript-sentence-editor"
      value={draft}
      aria-label={`Edit transcript at ${timestamp}`}
      title="Delete words, then click outside or press Ctrl+Enter to cut them from the video and audio"
      rows={2}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commitDeletedWords}
      onPointerDown={focusTextareaOnPointerDown}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const isVoiceoverClip = (clip: TimelineClip) =>
  clip.track === "audio" &&
  (clip.audioKind === "voiceover" || clip.id.startsWith("voice-"));

const isImportedAudioClip = (clip: TimelineClip) =>
  clip.track === "audio" && !clip.linkedClipId && !isVoiceoverClip(clip);

const isTranscriptSettingClip = (clip: TimelineClip) =>
  clip.track === "caption" &&
  clip.caption?.generationId?.startsWith("transcript-");

const timelineRowContainsClip = (row: TimelineRow, clip: TimelineClip) => {
  if (row.audioKind === "voiceover") {
    return isVoiceoverClip(clip);
  }
  if (row.audioKind === "imported") {
    return isImportedAudioClip(clip);
  }
  if (row.id === "caption" && isTranscriptSettingClip(clip)) {
    return false;
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
  toggleSelectionOnClick?: boolean;
  mediaIds?: string[];
  timelineClipIds?: string[];
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

type AudioFadeDrag = {
  clipId: string;
  edge: "in" | "out";
  startX: number;
  startFadeFrames: number;
  originalClips: TimelineClip[];
};

type AudioVolumeDrag = {
  clipId: string;
  startY: number;
  startVolume: number;
  boundsHeight: number;
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
  mode: "move" | "resize" | "rotate";
  handle?: CaptionResizeHandle;
  startX: number;
  startY: number;
  baseWidth: number;
  baseHeight: number;
  previewWidth: number;
  previewHeight: number;
  originalClips: TimelineClip[];
};

type TextTimelineDrag = {
  clipId: string;
  startX: number;
  startY: number;
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
  width: number;
  height: number;
};

type CaptionPreviewDrag = {
  clipId: string;
  startX: number;
  startY: number;
  originalClips: TimelineClip[];
  halfWidthPercent: number;
  halfHeightPercent: number;
  width: number;
  height: number;
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
  centerX: number;
  centerY: number;
  rotationOffset: number;
  baseWidth: number;
  baseHeight: number;
  originalClips: TimelineClip[];
};

const hasPreviewAlignmentGuides = (guides: PreviewAlignmentGuides) =>
  guides.horizontal || guides.vertical;

const renderPreviewAlignmentGuides = (
  guides: PreviewAlignmentGuides,
  tone: "yellow" | "white" = "yellow",
) => {
  if (!hasPreviewAlignmentGuides(guides)) return null;

  const verticalPositions =
    guides.verticalPositions && guides.verticalPositions.length > 0
      ? guides.verticalPositions
      : guides.vertical
        ? [50]
        : [];
  const horizontalPositions =
    guides.horizontalPositions && guides.horizontalPositions.length > 0
      ? guides.horizontalPositions
      : guides.horizontal
        ? [50]
        : [];

  return (
    <div
      className={`preview-alignment-guides preview-alignment-guides-${tone}`}
      aria-hidden="true"
    >
      {verticalPositions.map((position) => (
        <span
          className="preview-alignment-guide preview-alignment-guide-vertical"
          key={`vertical-${position}`}
          style={{ left: `${position}%` }}
        />
      ))}
      {horizontalPositions.map((position) => (
        <span
          className="preview-alignment-guide preview-alignment-guide-horizontal"
          key={`horizontal-${position}`}
          style={{ top: `${position}%` }}
        />
      ))}
      {verticalPositions.includes(50) && horizontalPositions.includes(50) ? (
        <span className="preview-alignment-center" />
      ) : null}
    </div>
  );
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

type CaptionRotateDrag = {
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

type PreviewScaleDrag = {
  clipId: string;
  centerX: number;
  centerY: number;
  startDistance: number;
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
      component={ExportComposition}
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
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const importChoiceDialogRef = useRef<HTMLDialogElement>(null);
  const mediaTrimDialogRef = useRef<HTMLDialogElement>(null);
  const mediaTrimVideoRef = useRef<HTMLVideoElement>(null);
  const pendingImportFilesRef = useRef<File[]>([]);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const captionFileInputRef = useRef<HTMLInputElement>(null);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewLayerVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const previewAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewMediaGainRefs = useRef(
    new Map<
      HTMLMediaElement,
      { source: MediaElementAudioSourceNode; gain: GainNode }
    >(),
  );
  const previewWindowRef = useRef<HTMLDivElement>(null);
  const editorShellRef = useRef<HTMLElement>(null);
  const videoLayerControlDragRef =
    useRef<VideoLayerControlHistoryGesture | null>(null);
  const mediaPreviewVolumeDragRef = useRef(false);
  const previewSourceRef = useRef<string | null>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const lastTimelineScrollLeftRef = useRef(0);
  const suppressTimelineScrollPlayheadFollowRef = useRef(false);
  const mediaLibraryRef = useRef<HTMLDivElement>(null);
  const mediaGridRef = useRef<HTMLDivElement>(null);
  const mediaSelectionBoxRef = useRef<MediaSelectionBox | null>(null);
  const mediaSelectionAnchorIdRef = useRef<string | null>(null);
  const timelineSelectionBoxRef = useRef<TimelineSelectionBox | null>(null);
  const timelineSelectionPointerRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const suppressTrackLabelClickRef = useRef(false);
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
    normalizeMediaSceneLabels(initialProject?.mediaItems ?? initialMediaItems),
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
  const [mediaSelectionBox, setMediaSelectionBox] =
    useState<MediaSelectionBox | null>(null);
  const [timelineSelectionBox, setTimelineSelectionBox] =
    useState<TimelineSelectionBox | null>(null);
  const [mediaPreviewTime, setMediaPreviewTime] = useState(0);
  const [mediaPreviewDuration, setMediaPreviewDuration] = useState(0);
  const [isMediaPreviewPlaying, setIsMediaPreviewPlaying] = useState(false);
  const [mediaPreviewVolume, setMediaPreviewVolume] = useState(1);
  const [mediaTrimDraft, setMediaTrimDraft] = useState<{
    mediaId?: string;
    clipId?: string;
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
  const [mediaTrimSourceDimensions, setMediaTrimSourceDimensions] = useState({
    width: 16,
    height: 9,
  });
  const [isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen] =
    useState(false);
  const [isMediaPreviewVolumeAdjusting, setIsMediaPreviewVolumeAdjusting] =
    useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [, setMediaPreviewFrame] = useState(0);
  const [projectStatus, setProjectStatus] = useState("");
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving">(
    "saved",
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"fast" | "hd">("fast");
  const [workspaceLayout, setWorkspaceLayout] =
    useState<WorkspaceLayout>(readWorkspaceLayout);
  const [timelineScale, setTimelineScale] = useState(defaultTimelineScale);
  const timelineScaleRef = useRef(timelineScale);
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const playheadFrameRef = useRef(0);
  const [timelineHoverFrame, setTimelineHoverFrame] = useState<number | null>(
    null,
  );
  const [selectedTrack, setSelectedTrack] = useState<TrackName>("main");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedVideoLayer, setSelectedVideoLayer] = useState<number | null>(
    null,
  );
  const selectedClipIdRef = useRef(selectedClipId);
  const selectedClipIdsRef = useRef(selectedClipIds);
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
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const pointerDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [trimDrag, setTrimDrag] = useState<TrimDrag | null>(null);
  const [audioFadeDrag, setAudioFadeDrag] =
    useState<AudioFadeDrag | null>(null);
  const [audioVolumeDrag, setAudioVolumeDrag] =
    useState<AudioVolumeDrag | null>(null);
  const [videoDropTarget, setVideoDropTarget] =
    useState<VideoDropTarget | null>(null);
  const [previewMode, setPreviewMode] = useState<"media" | "timeline">(
    "timeline",
  );
  const [isPreviewAxisVisible, setIsPreviewAxisVisible] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPointerId, setScrubPointerId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceRecordingStartFrame, setVoiceRecordingStartFrame] = useState<
    number | null
  >(null);
  const [recordingError, setRecordingError] = useState("");
  const [activeTool, setActiveTool] = useState<ActiveTool>("media");
  const activeToolRef = useRef(activeTool);
  const [audioLibraryTab, setAudioLibraryTab] =
    useState<AudioLibraryTab>("music");
  const [audioLibraryQuery, setAudioLibraryQuery] = useState("");
  const [audioLibraryCategory, setAudioLibraryCategory] = useState<
    string | null
  >(null);
  const [showAllAudioLibraryItems, setShowAllAudioLibraryItems] =
    useState(false);
  const hasAudioLibrarySearch = audioLibraryQuery.trim().length > 0;
  const [addingAudioLibraryItemId, setAddingAudioLibraryItemId] = useState<
    string | null
  >(null);
  const activeAudioLibraryItems = useMemo(
    () => audioLibraryItems.filter((item) => item.kind === audioLibraryTab),
    [audioLibraryTab],
  );
  const audioLibraryCategories = useMemo(
    () =>
      Array.from(new Set(activeAudioLibraryItems.map((item) => item.category))),
    [activeAudioLibraryItems],
  );
  const filteredAudioLibraryItems = useMemo(() => {
    const normalizedQuery = audioLibraryQuery.trim().toLowerCase();
    const matchingItems = activeAudioLibraryItems.filter((item) => {
      if (audioLibraryCategory && item.category !== audioLibraryCategory) {
        return false;
      }
      if (!normalizedQuery) return true;
      return audioLibraryItemMatchesQuery(item, normalizedQuery);
    });
    return normalizedQuery || audioLibraryCategory || showAllAudioLibraryItems
      ? matchingItems
      : matchingItems.slice(0, 6);
  }, [
    activeAudioLibraryItems,
    audioLibraryCategory,
    audioLibraryQuery,
    showAllAudioLibraryItems,
  ]);
  const updateAudioLibrarySearch = (value: string) => {
    const normalizedQuery = value.trim().toLowerCase();
    setAudioLibraryCategory(null);
    setAudioLibraryQuery(value);

    if (!normalizedQuery) return;
    const currentTabHasMatch = audioLibraryItems.some(
      (item) =>
        item.kind === audioLibraryTab &&
        audioLibraryItemMatchesQuery(item, normalizedQuery),
    );
    if (currentTabHasMatch) return;

    const otherTab: AudioLibraryTab =
      audioLibraryTab === "music" ? "sound-effects" : "music";
    const otherTabHasMatch = audioLibraryItems.some(
      (item) =>
        item.kind === otherTab &&
        audioLibraryItemMatchesQuery(item, normalizedQuery),
    );
    if (otherTabHasMatch) {
      setAudioLibraryTab(otherTab);
    }
  };
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
  const [videoQuickMenu, setVideoQuickMenu] = useState<{
    clipId: string;
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    if (!videoQuickMenu) return;

    const dismissVideoQuickMenu = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          ".video-quick-menu, .preview-layer-video, .preview-layer-image",
        )
      ) {
        return;
      }
      setVideoQuickMenu(null);
    };
    const dismissVideoQuickMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVideoQuickMenu(null);
    };

    document.addEventListener("pointerdown", dismissVideoQuickMenu, true);
    window.addEventListener("keydown", dismissVideoQuickMenuWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissVideoQuickMenu, true);
      window.removeEventListener("keydown", dismissVideoQuickMenuWithEscape);
    };
  }, [videoQuickMenu]);
  const [replaceVideoClipId, setReplaceVideoClipId] = useState<string | null>(
    null,
  );
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
  const [expandedStickerSections, setExpandedStickerSections] = useState<
    string[]
  >([]);
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
  const [previewAlignmentGuides, setPreviewAlignmentGuides] =
    useState<PreviewAlignmentGuides>({
      horizontal: false,
      vertical: false,
    });
  const [textResizeDrag, setTextResizeDrag] = useState<TextResizeDrag | null>(
    null,
  );
  const [captionResizeDrag, setCaptionResizeDrag] =
    useState<CaptionResizeDrag | null>(null);
  const [textRotateDrag, setTextRotateDrag] = useState<TextRotateDrag | null>(
    null,
  );
  const [captionRotateDrag, setCaptionRotateDrag] =
    useState<CaptionRotateDrag | null>(null);
  const useWhitePreviewAlignmentGuides = Boolean(
    stickerInteraction ||
    textPreviewDrag ||
    captionPreviewDrag ||
    textResizeDrag ||
    captionResizeDrag ||
    textRotateDrag ||
    captionRotateDrag,
  );
  const [cropInputMode, setCropInputMode] = useState<"sliders" | "manual">(
    "sliders",
  );
  const [cropDrag, setCropDrag] = useState<CropDrag | null>(null);
  const [adjustmentPanDrag, setAdjustmentPanDrag] =
    useState<AdjustmentPanDrag | null>(null);
  const [previewScaleDrag, setPreviewScaleDrag] =
    useState<PreviewScaleDrag | null>(null);
  const previewScaleDragRef = useRef<PreviewScaleDrag | null>(null);
  const [selectedPreviewFrameBase, setSelectedPreviewFrameBase] = useState<{
    clipId: string;
    widthPercent: number;
    heightPercent: number;
  } | null>(null);
  const [rotateDrag, setRotateDrag] = useState<RotateDrag | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        workspaceLayoutStorageKey,
        JSON.stringify(workspaceLayout),
      );
    }
  }, [workspaceLayout]);

  useEffect(() => {
    const fitWorkspaceToViewport = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const minimumDetailsWidth = 280;
      const minimumPreviewWidth = 280;
      const minimumMiddleWidth = 360;
      const availablePanelWidth = Math.max(
        minimumDetailsWidth + minimumPreviewWidth,
        viewportWidth - minimumMiddleWidth,
      );

      setWorkspaceLayout((current) => {
        let detailsWidth = clampWorkspaceSize(
          current.detailsWidth,
          minimumDetailsWidth,
          380,
        );
        let previewWidth = clampWorkspaceSize(
          current.previewWidth,
          minimumPreviewWidth,
          520,
        );

        if (detailsWidth + previewWidth > availablePanelWidth) {
          const overflow = detailsWidth + previewWidth - availablePanelWidth;
          const previewReduction = Math.min(
            overflow,
            previewWidth - minimumPreviewWidth,
          );
          previewWidth -= previewReduction;
          detailsWidth = Math.max(
            minimumDetailsWidth,
            detailsWidth - (overflow - previewReduction),
          );
        }

        const timelineHeight = clampWorkspaceSize(
          current.timelineHeight,
          200,
          Math.max(220, viewportHeight - 300),
        );

        if (
          detailsWidth === current.detailsWidth &&
          previewWidth === current.previewWidth &&
          timelineHeight === current.timelineHeight
        ) {
          return current;
        }

        return { detailsWidth, previewWidth, timelineHeight };
      });
    };

    fitWorkspaceToViewport();
    window.addEventListener("resize", fitWorkspaceToViewport);
    return () => window.removeEventListener("resize", fitWorkspaceToViewport);
  }, []);

  const resizeWorkspace = useCallback(
    (target: WorkspaceResizeTarget, clientPosition: number) => {
      const shell = editorShellRef.current;
      if (!shell) {
        return;
      }
      const bounds = shell.getBoundingClientRect();
      setWorkspaceLayout((current) => {
        if (target === "details") {
          const maximum = Math.max(
            260,
            bounds.width - current.previewWidth - 340,
          );
          return {
            ...current,
            detailsWidth: clampWorkspaceSize(
              clientPosition - bounds.left,
              260,
              maximum,
            ),
          };
        }
        if (target === "preview") {
          const maximum = Math.max(
            320,
            bounds.width - current.detailsWidth - 340,
          );
          return {
            ...current,
            previewWidth: clampWorkspaceSize(
              bounds.right - clientPosition,
              320,
              maximum,
            ),
          };
        }
        return {
          ...current,
          timelineHeight: clampWorkspaceSize(
            bounds.bottom - clientPosition,
            180,
            Math.max(180, bounds.height - 308),
          ),
        };
      });
    },
    [],
  );

  const startWorkspaceResize = useCallback(
    (target: WorkspaceResizeTarget, event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const pointerId = event.pointerId;
      event.currentTarget.setPointerCapture(pointerId);
      const handle = event.currentTarget;
      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        resizeWorkspace(
          target,
          target === "timeline" ? moveEvent.clientY : moveEvent.clientX,
        );
      };
      const finish = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [resizeWorkspace],
  );

  const nudgeWorkspaceResize = useCallback(
    (target: WorkspaceResizeTarget, delta: number) => {
      const shell = editorShellRef.current;
      if (!shell) {
        return;
      }
      const bounds = shell.getBoundingClientRect();
      const currentPosition =
        target === "details"
          ? bounds.left + workspaceLayout.detailsWidth
          : target === "preview"
            ? bounds.right - workspaceLayout.previewWidth
            : bounds.bottom - workspaceLayout.timelineHeight;
      resizeWorkspace(target, currentPosition + delta);
    },
    [resizeWorkspace, workspaceLayout],
  );

  const resetWorkspaceResize = useCallback((target: WorkspaceResizeTarget) => {
    const defaults = getDefaultWorkspaceLayout();
    setWorkspaceLayout((current) => ({
      ...current,
      [target === "details"
        ? "detailsWidth"
        : target === "preview"
          ? "previewWidth"
          : "timelineHeight"]:
        target === "details"
          ? defaults.detailsWidth
          : target === "preview"
            ? defaults.previewWidth
            : defaults.timelineHeight,
    }));
  }, []);

  const resetWorkspaceLayout = useCallback(() => {
    const defaults = getDefaultWorkspaceLayout();
    setWorkspaceLayout(defaults);
    setProjectStatus("Workspace layout reset");
  }, []);

  const togglePreviewFullscreen = useCallback(async () => {
    const previewWindow = previewWindowRef.current;
    if (!previewWindow) return;

    if (document.fullscreenElement === previewWindow) {
      await document.exitFullscreen();
      return;
    }

    await previewWindow.requestFullscreen();
  }, []);

  clipsRef.current = clips;
  pointerDragRef.current = pointerDrag;
  selectedClipIdRef.current = selectedClipId;
  selectedClipIdsRef.current = selectedClipIds;
  activeToolRef.current = activeTool;
  timelineScaleRef.current = timelineScale;
  playheadFrameRef.current = playheadFrame;

  const projectDuration = useMemo(() => getTimelineDuration(clips), [clips]);

  useEffect(() => {
    const detachedVideoIds = clips
      .filter(
        (clip) =>
          (clip.track === "main" ||
            clip.track === "upper" ||
            clip.track === "cutout") &&
          !clip.audioDetached &&
          clips.some(
            (audioClip) =>
              audioClip.track === "audio" &&
            audioClip.detachedFromVideo &&
              audioClip.src === clip.src,
          ),
      )
      .map((clip) => clip.id);
    const detachedAudioIds = clips
      .filter(
        (clip) =>
          clip.track === "audio" &&
          clip.detachedFromVideo &&
          clips.some(
            (videoClip) =>
              (videoClip.track === "main" ||
                videoClip.track === "upper" ||
                videoClip.track === "cutout") &&
              videoClip.src === clip.src,
          ),
      )
      .map((clip) => clip.id);

    if (detachedVideoIds.length === 0 && detachedAudioIds.length === 0) return;

    setTimelineHistory((currentHistory) => ({
      ...currentHistory,
      present: currentHistory.present.map((clip) =>
        detachedVideoIds.includes(clip.id)
          ? { ...clip, linkedClipId: undefined, audioDetached: true }
          : detachedAudioIds.includes(clip.id)
            ? { ...clip, linkedClipId: undefined, hidden: false }
          : clip,
      ),
    }));
  }, [clips]);

  useEffect(() => {
    setSelectedClipIds((currentIds) => {
      if (!selectedClipId) {
        return currentIds.length === 0 ? currentIds : [];
      }
      return currentIds.includes(selectedClipId)
        ? currentIds
        : [selectedClipId];
    });
  }, [selectedClipId]);

  const fitTimelineToViewport = useCallback(() => {
    const viewportWidth = timelineScrollRef.current?.clientWidth ?? 0;
    const availableWidth = Math.max(240, viewportWidth - timelineOrigin - 24);
    const nextScale = availableWidth / Math.max(1, projectDuration);
    const fittedScale = Math.max(
      minimumTimelineScale,
      Math.min(maximumTimelineScale, nextScale),
    );
    timelineScaleRef.current = fittedScale;
    setTimelineScale(fittedScale);
    setProjectStatus("Timeline fitted to viewport");
  }, [projectDuration]);

  const suppressNextTimelineScrollPlayheadFollow = useCallback(() => {
    suppressTimelineScrollPlayheadFollowRef.current = true;
    window.requestAnimationFrame(() => {
      const scrollArea = timelineScrollRef.current;
      if (scrollArea) {
        lastTimelineScrollLeftRef.current = scrollArea.scrollLeft;
      }
      suppressTimelineScrollPlayheadFollowRef.current = false;
    });
  }, []);

  const updatePlayheadFromTimelineScroll = useCallback(() => {
    const scrollArea = timelineScrollRef.current;
    if (!scrollArea) return;

    const currentScrollLeft = scrollArea.scrollLeft;
    if (
      Math.abs(currentScrollLeft - lastTimelineScrollLeftRef.current) < 1
    ) {
      return;
    }
    lastTimelineScrollLeftRef.current = currentScrollLeft;

    if (
      suppressTimelineScrollPlayheadFollowRef.current ||
      previewMode !== "timeline" ||
      isPreviewPlaying ||
      isScrubbing ||
      pointerDrag ||
      trimDrag
    ) {
      return;
    }

    const nextFrame = Math.max(
      0,
      Math.min(
        Math.max(0, projectDuration - 1),
        Math.round(currentScrollLeft / Math.max(0.001, timelineScale)),
      ),
    );

    if (nextFrame === playheadFrame) return;
    playheadFrameRef.current = nextFrame;
    setPlayheadFrame(nextFrame);
    setPreviewMode("timeline");
  }, [
    isPreviewPlaying,
    isScrubbing,
    playheadFrame,
    pointerDrag,
    previewMode,
    projectDuration,
    timelineScale,
    trimDrag,
  ]);

  const zoomTimelineBy = useCallback(
    (amount: number, anchorClientX?: number) => {
      const scrollArea = timelineScrollRef.current;
      const currentScale = timelineScaleRef.current;
      const nextScale = Math.max(
        minimumTimelineScale,
        Math.min(
          maximumTimelineScale,
          Number((currentScale + amount).toFixed(2)),
        ),
      );

      if (nextScale === currentScale) return;

      let nextScrollLeft: number | null = null;
      if (scrollArea) {
        const bounds = scrollArea.getBoundingClientRect();
        const anchorOffset = Math.max(
          0,
          Math.min(
            scrollArea.clientWidth,
            (anchorClientX ?? bounds.left + scrollArea.clientWidth / 2) -
              bounds.left,
          ),
        );
        const frameAtAnchor = Math.max(
          0,
          (scrollArea.scrollLeft + anchorOffset - timelineOrigin) /
            currentScale,
        );
        nextScrollLeft = Math.max(
          0,
          timelineOrigin + frameAtAnchor * nextScale - anchorOffset,
        );
      }

      timelineScaleRef.current = nextScale;
      setTimelineScale(nextScale);
      if (scrollArea && nextScrollLeft !== null) {
        requestAnimationFrame(() => {
          suppressNextTimelineScrollPlayheadFollow();
          scrollArea.scrollLeft = nextScrollLeft;
        });
      }
    },
    [suppressNextTimelineScrollPlayheadFollow],
  );
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
  const timelineGroupDragPreview = useMemo(() => {
    if (
      pointerDrag?.type !== "timeline" ||
      (pointerDrag.timelineClipIds?.length ?? 0) <= 1 ||
      pointerDrag.pointerStartX === undefined ||
      pointerDrag.originalStart === undefined
    ) {
      return null;
    }

    const ids = new Set(pointerDrag.timelineClipIds);
    clips.forEach((clip) => {
      if (ids.has(clip.id) && clip.linkedClipId) ids.add(clip.linkedClipId);
      if (clip.linkedClipId && ids.has(clip.linkedClipId)) ids.add(clip.id);
    });
    const movingClips = clips.filter((clip) => ids.has(clip.id));
    const earliestStart = Math.min(...movingClips.map((clip) => clip.start));
    const requestedDelta = Math.round(
      getDraggedClipStart({
        originalStart: pointerDrag.originalStart,
        pointerStartX: pointerDrag.pointerStartX,
        pointerX: pointerDrag.x,
        pixelsPerFrame: timelineScale,
      }) - pointerDrag.originalStart,
    );

    return {
      ids,
      frameDelta: Math.max(-earliestStart, requestedDelta),
    };
  }, [clips, pointerDrag]);
  const timelineDragPreviewOffsetY =
    pointerDrag?.activated &&
    pointerDrag.type === "timeline" &&
    pointerDrag.pointerStartY !== undefined
      ? pointerDrag.y - pointerDrag.pointerStartY
      : 0;
  const isVideoPointerDrag = Boolean(
    pointerDrag?.activated &&
    (draggedMediaItem ||
      (draggedTimelineClip && getVideoLayer(draggedTimelineClip) !== null)),
  );
  const mainAppendTargetWidth = draggedMediaItem
    ? Math.max(96, Math.min(draggedMediaDuration * timelineScale, 360))
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
    pointerDrag ? projectDuration * timelineScale + dragRunwayWidth : 0,
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
  const getPointerTimelineFrame = useCallback(
    (clientX: number) => {
      const bounds = timelineContentRef.current?.getBoundingClientRect();
      if (!bounds) return null;

      return getTimelineFrameFromPointer(
        clientX,
        bounds.left,
        timelineOrigin,
        timelineScale,
      );
    },
    [timelineScale],
  );

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
  const selectedClipVolume = clampAudioGain(
    clipControlTarget?.volume ?? selectedVideoLayerControlState.volume,
  );
  const selectedClipFadeInFrames = clipControlTarget?.audioFadeInFrames ?? 0;
  const selectedClipFadeOutFrames = clipControlTarget?.audioFadeOutFrames ?? 0;
  const selectedClipEffect = clipControlTarget?.visual?.effect ?? "none";
  const selectedClipFilter = clipControlTarget?.visual?.filter ?? "none";
  const selectedEffectIntensity =
    selectedClipEffect === "none"
      ? 0
      : (clipControlTarget?.visual?.effectIntensity ?? 100);
  const selectedCutoutLineColor =
    clipControlTarget?.visual?.cutoutLineColor ??
    (selectedClipEffect === "outline" ||
    selectedClipEffect === "moving-white-outline"
      ? "#ffffff"
      : defaultCutoutLineStyle.color);
  const selectedCutoutLineOpacity =
    clipControlTarget?.visual?.cutoutLineOpacity ??
    defaultCutoutLineStyle.opacity;
  const selectedCutoutLineWidth =
    clipControlTarget?.visual?.cutoutLineWidth ?? defaultCutoutLineStyle.width;
  const selectedCutoutLineStyle =
    clipControlTarget?.visual?.cutoutLineStyle ??
    (selectedClipEffect === "neon-outline" ||
    selectedClipEffect === "electric-glow"
      ? "glow"
      : defaultCutoutLineStyle.style);
  const canEditSelectedCutoutLine =
    clipControlTarget?.track === "cutout" &&
    isCustomizableCutoutLineEffect(selectedClipEffect);
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
  const canEditSelectedAudioFade = Boolean(
    clipControlTarget &&
    (clipControlTarget.track === "main" ||
      clipControlTarget.track === "upper" ||
      clipControlTarget.track === "cutout" ||
      clipControlTarget.track === "audio") &&
    clipControlTarget.mediaType !== "image" &&
    clipControlTarget.cutout?.mediaKind !== "image" &&
    (clipControlTarget.track === "audio" || !clipControlTarget.audioDetached),
  );
  const selectedClipDurationSeconds = Math.max(
    0,
    (clipControlTarget?.duration ?? 0) / fps,
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
    ? mediaTrimDraft.mediaId
      ? (mediaItems.find((item) => item.id === mediaTrimDraft.mediaId) ?? null)
      : (() => {
          const clip = clips.find((item) => item.id === mediaTrimDraft.clipId);
          if (!clip?.src) return null;
          return {
            id: clip.id,
            label: clip.label,
            src: clip.src,
            duration: formatMediaDuration(clip.duration),
            durationInFrames: clip.duration,
            kind: "public" as const,
            mediaType: isImageClip(clip)
              ? ("image" as const)
              : ("video" as const),
            sourceStart: clip.sourceStart,
            sourceDurationInFrames: clip.sourceDuration,
            adjustment: clip.adjustment,
          };
        })()
    : null;
  const mediaTrimSourceAspectRatio =
    mediaTrimSourceDimensions.width / mediaTrimSourceDimensions.height;
  const mediaTrimSourceStageStyle: CSSProperties = {
    aspectRatio: `${mediaTrimSourceDimensions.width} / ${mediaTrimSourceDimensions.height}`,
    ...(mediaTrimSourceAspectRatio >= 16 / 9
      ? { width: "100%" }
      : { height: "min(58vh, 580px)" }),
  };
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
  const timelinePreviewFrame =
    isPreviewAxisVisible &&
    !isPreviewPlaying &&
    !isScrubbing &&
    timelineHoverFrame !== null
      ? timelineHoverFrame
      : playheadFrame;
  const activeVideoLayers = getActiveVideoLayersAtFrame(
    clips,
    timelinePreviewFrame,
  );
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
        timelinePreviewFrame,
      );
      const participatesInTransition =
        transitionPresentation.opacity !== 1 ||
        transitionPresentation.translateX !== 0 ||
        transitionPresentation.scale !== 1;
      const isNearPlayhead =
        clip.start <= timelinePreviewFrame + fps * 5 &&
        clip.start + clip.duration >= timelinePreviewFrame - fps;

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
    timelinePreviewFrame,
  ).filter((clip) => clip.src);
  const activeCutoutClips = getActiveClipsAtFrame(
    clips,
    "cutout",
    timelinePreviewFrame,
  ).filter((clip) => clip.src && clip.cutout);
  const activeTextClips = getActiveClipsAtFrame(
    clips,
    "text",
    timelinePreviewFrame,
  ).filter((clip) => clip.text);
  const activeCaptionClips = getActiveClipsAtFrame(
    clips,
    "caption",
    timelinePreviewFrame,
  ).filter(
    (clip) =>
      clip.caption && !clip.caption.generationId?.startsWith("transcript-"),
  );
  const selectedTranscriptSourceClipId =
    selectedCaptionClip?.caption?.generationId?.startsWith("transcript-")
      ? selectedCaptionClip.caption.sourceClipId
      : selectedCaptionSourceClip
        ? (clips.find(
            (clip) =>
              clip.track === "caption" &&
              clip.caption?.generationId?.startsWith("transcript-") &&
              clip.caption.sourceClipId &&
              (selectedCaptionSourceClip.id === clip.caption.sourceClipId ||
                selectedCaptionSourceClip.id.startsWith(
                  `${clip.caption.sourceClipId}-speech-`,
                )),
          )?.caption?.sourceClipId ?? selectedCaptionSourceClip.id)
        : null;
  const transcriptClips = useMemo(
    () =>
      selectedTranscriptSourceClipId
        ? clips
            .filter(
              (clip) =>
                clip.track === "caption" &&
                clip.caption?.generationId?.startsWith("transcript-") &&
                clip.caption.sourceClipId === selectedTranscriptSourceClipId,
            )
            .sort((a, b) => a.start - b.start)
        : [],
    [clips, selectedTranscriptSourceClipId],
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
            ?.timelineRowOrder ?? 100 + videoLayer,
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
      ...(clips.some(
        (clip) => clip.track === "caption" && !isTranscriptSettingClip(clip),
      )
        ? [
            {
              key: "caption",
              id: "caption" as TrackName,
              label: "Caption track",
              order: 10_000,
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
            ?.timelineRowOrder ?? -10 + videoLayer,
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
      ? (topVisibleVideoClip?.volume ?? 1) *
        (topVisibleVideoClip
          ? getClipAudioFadeMultiplier(
              topVisibleVideoClip,
              timelinePreviewFrame,
            )
          : 1)
      : mainClipVolume;
  const previewVideoMuted =
    previewVolume === 0 ||
    (previewMode === "timeline" &&
      shouldMuteVideoNativeAudio(
        clips,
        timelinePreviewFrame,
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
    persistStoredStringList(favoriteAnimationsStorageKey, favoriteAnimationIds);
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
      setSaveState("unsaved");
      setTimelineHistory((currentHistory) =>
        applyTimelineHistoryEdit(
          currentHistory,
          updater(currentHistory.present),
        ),
      );
    },
    [],
  );

  const deleteTimelineClips = useCallback(
    (currentClips: TimelineClip[], clipIds: string[]) => {
      const selectedIds = new Set(clipIds);
      currentClips.forEach((clip) => {
        if (selectedIds.has(clip.id) && clip.linkedClipId) {
          selectedIds.add(clip.linkedClipId);
        }
      });

      return currentClips.filter((clip) => !selectedIds.has(clip.id));
    },
    [],
  );

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.repeat ||
        event.defaultPrevented ||
        (!selectedClipIdRef.current && selectedClipIdsRef.current.length === 0)
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
      const clipIds =
        selectedClipIdsRef.current.length > 0
          ? selectedClipIdsRef.current
          : selectedClipIdRef.current
            ? [selectedClipIdRef.current]
            : [];
      if (clipIds.length === 0) return;
      commitClipChange((currentClips) =>
        deleteTimelineClips(currentClips, clipIds),
      );
      setIsPreviewPlaying(false);
      setSelectedClipId(null);
      setSelectedClipIds([]);
      setSelectedVideoLayer(null);
      setStickerInteraction(null);
      setCutoutInteraction(null);
      setTextPreviewDrag(null);
      setCaptionPreviewDrag(null);
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
      setProjectStatus(
        `${clipIds.length} selected clip${clipIds.length === 1 ? "" : "s"} deleted`,
      );
    };

    window.addEventListener("keydown", handleDeleteShortcut);
    return () => window.removeEventListener("keydown", handleDeleteShortcut);
  }, [commitClipChange, deleteTimelineClips]);

  const undoLastClipChange = () => {
    setSaveState("unsaved");
    setTimelineHistory(undoTimelineHistory);
  };

  const redoLastClipChange = () => {
    setSaveState("unsaved");
    setTimelineHistory(redoTimelineHistory);
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "r") return;

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText || document.querySelector("dialog[open]")) return;

      event.preventDefault();
      if (key === "z") {
        setTimelineHistory(undoTimelineHistory);
        setProjectStatus("Undo");
        return;
      }

      setTimelineHistory(redoTimelineHistory);
      setProjectStatus("Redo");
    };

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, []);

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

  const chooseMedia = (
    mediaItem: MediaItem,
    additive = false,
    selectRange = false,
  ) => {
    previewVideoRef.current?.pause();
    const isAlreadySelected = selectedMediaIds.includes(mediaItem.id);
    const anchorId = mediaSelectionAnchorIdRef.current ?? selectedMediaId;
    const anchorIndex = mediaItems.findIndex((item) => item.id === anchorId);
    const targetIndex = mediaItems.findIndex(
      (item) => item.id === mediaItem.id,
    );
    const rangeIds =
      selectRange && anchorIndex >= 0 && targetIndex >= 0
        ? mediaItems
            .slice(
              Math.min(anchorIndex, targetIndex),
              Math.max(anchorIndex, targetIndex) + 1,
            )
            .map((item) => item.id)
        : [mediaItem.id];
    const nextSelectedIds = selectRange
      ? additive
        ? Array.from(new Set([...selectedMediaIds, ...rangeIds]))
        : rangeIds
      : additive
        ? isAlreadySelected
          ? selectedMediaIds.filter((id) => id !== mediaItem.id)
          : [...selectedMediaIds, mediaItem.id]
        : [mediaItem.id];
    const nextPrimaryId = selectRange
      ? mediaItem.id
      : additive && isAlreadySelected
        ? (nextSelectedIds[nextSelectedIds.length - 1] ?? null)
        : mediaItem.id;
    const nextPrimaryMedia =
      mediaItems.find((item) => item.id === nextPrimaryId) ?? mediaItem;

    setSelectedMediaIds(nextSelectedIds);
    setSelectedMediaId(nextPrimaryId);
    if (!selectRange) {
      mediaSelectionAnchorIdRef.current = mediaItem.id;
    }
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

  const clearMediaSelection = () => {
    setSelectedMediaIds([]);
    setSelectedMediaId(null);
    mediaSelectionAnchorIdRef.current = null;
  };

  const mediaSelectionPointerId = mediaSelectionBox?.pointerId;
  useEffect(() => {
    if (mediaSelectionPointerId === undefined) return;

    const clearSelectionBox = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== mediaSelectionPointerId) return;
      mediaSelectionBoxRef.current = null;
      setMediaSelectionBox(null);
    };

    window.addEventListener("pointerup", clearSelectionBox);
    window.addEventListener("pointercancel", clearSelectionBox);
    return () => {
      window.removeEventListener("pointerup", clearSelectionBox);
      window.removeEventListener("pointercancel", clearSelectionBox);
    };
  }, [mediaSelectionPointerId]);

  const startMediaSelection = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const bounds = event.currentTarget.getBoundingClientRect();
    const isScrollbarPointer = event.clientX >= bounds.right - 14;

    if (
      event.button !== 0 ||
      isScrollbarPointer ||
      target.closest(".media-thumb, .library-actions, button, input")
    ) {
      return;
    }

    const additive = event.ctrlKey || event.metaKey;
    if (!additive) {
      clearEditorSelection();
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextSelection: MediaSelectionBox = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      initialIds: additive ? selectedMediaIds : [],
      additive,
      activated: false,
    };
    mediaSelectionBoxRef.current = nextSelection;
    setMediaSelectionBox(nextSelection);
  };

  const moveMediaSelection = (event: PointerEvent<HTMLElement>) => {
    const activeSelection = mediaSelectionBoxRef.current;
    if (!activeSelection || event.pointerId !== activeSelection.pointerId) {
      return;
    }

    const library = mediaLibraryRef.current;
    const grid = mediaGridRef.current;
    if (!library || !grid) return;

    const bounds = library.getBoundingClientRect();
    const currentX = Math.max(
      bounds.left,
      Math.min(event.clientX, bounds.right),
    );
    const currentY = Math.max(
      bounds.top,
      Math.min(event.clientY, bounds.bottom),
    );
    const activated =
      activeSelection.activated ||
      Math.hypot(
        currentX - activeSelection.startX,
        currentY - activeSelection.startY,
      ) >= mediaSelectionActivationDistance;

    if (event.clientY < bounds.top + 34) {
      library.scrollBy({ top: -14 });
    } else if (event.clientY > bounds.bottom - 34) {
      library.scrollBy({ top: 14 });
    }

    if (activated) {
      const selectionBounds = {
        left: Math.min(activeSelection.startX, currentX),
        right: Math.max(activeSelection.startX, currentX),
        top: Math.min(activeSelection.startY, currentY),
        bottom: Math.max(activeSelection.startY, currentY),
      };
      const hitIds = Array.from(
        grid.querySelectorAll<HTMLElement>("[data-media-id]"),
      )
        .filter((element) => {
          const cardBounds = element.getBoundingClientRect();
          return (
            cardBounds.right >= selectionBounds.left &&
            cardBounds.left <= selectionBounds.right &&
            cardBounds.bottom >= selectionBounds.top &&
            cardBounds.top <= selectionBounds.bottom
          );
        })
        .map((element) => element.dataset.mediaId)
        .filter((id): id is string => Boolean(id));
      const nextIds = activeSelection.additive
        ? Array.from(new Set([...activeSelection.initialIds, ...hitIds]))
        : hitIds;

      setSelectedMediaIds(nextIds);
      setSelectedMediaId(
        hitIds[hitIds.length - 1] ?? nextIds[nextIds.length - 1] ?? null,
      );
    }

    const nextSelection = {
      ...activeSelection,
      currentX,
      currentY,
      activated,
    };
    mediaSelectionBoxRef.current = nextSelection;
    setMediaSelectionBox(nextSelection);
  };

  const finishMediaSelection = (event: PointerEvent<HTMLElement>) => {
    const activeSelection = mediaSelectionBoxRef.current;
    if (!activeSelection || event.pointerId !== activeSelection.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (activeSelection.activated) {
      suppressMediaClickRef.current = true;
      window.setTimeout(() => {
        suppressMediaClickRef.current = false;
      }, 0);
    }
    mediaSelectionBoxRef.current = null;
    setMediaSelectionBox(null);
  };

  const openMediaTrimEditor = (mediaItem: MediaItem) => {
    previewVideoRef.current?.pause();
    mediaTrimVideoRef.current?.pause();
    setIsMediaPreviewPlaying(false);
    setIsMediaTrimPreviewPlaying(false);
    setMediaTrimSourceDimensions({ width: 16, height: 9 });
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
    window.requestAnimationFrame(() => mediaTrimDialogRef.current?.showModal());
  };

  const openTimelineClipCropEditor = (clip: TimelineClip) => {
    if (!clip.src || (clip.track !== "main" && clip.track !== "upper")) return;
    previewVideoRef.current?.pause();
    mediaTrimVideoRef.current?.pause();
    setVideoQuickMenu(null);
    setIsPreviewPlaying(false);
    setIsMediaPreviewPlaying(false);
    setIsMediaTrimPreviewPlaying(false);
    setMediaTrimSourceDimensions({ width: 16, height: 9 });
    setMediaTrimPreviewFrame(0);
    setSelectedClipId(clip.id);
    setSelectedTrack(clip.track);
    setPreviewMode("timeline");
    setMediaTrimDraft({
      clipId: clip.id,
      startFrame: 0,
      endFrame: Math.max(1, clip.duration),
      adjustment: {
        ...defaultClipAdjustment,
        ...clip.adjustment,
      },
    });
    window.requestAnimationFrame(() => mediaTrimDialogRef.current?.showModal());
  };

  const closeMediaTrimEditor = () => {
    mediaTrimVideoRef.current?.pause();
    setIsMediaTrimPreviewPlaying(false);
    setMediaTrimPreviewFrame(0);
    mediaTrimDialogRef.current?.close();
    setMediaTrimDraft(null);
    setMediaTrimCanvasDrag(null);
    setMediaTrimRangeDrag(null);
    setMediaTrimSourceDimensions({ width: 16, height: 9 });
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
        currentDraft ? { ...currentDraft, startFrame } : null,
      );
      previewMediaTrimFrame(mediaTrimItem, startFrame);
      return;
    }

    const endFrame = Math.min(
      mediaTrimItem.durationInFrames,
      Math.max(pointerFrame, mediaTrimDraft.startFrame + 1),
    );
    setMediaTrimDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, endFrame } : null,
    );
    previewMediaTrimFrame(mediaTrimItem, Math.max(0, endFrame - 1));
  };

  const updateMediaTrimAdjustment = (adjustment: Partial<ClipAdjustment>) => {
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
          scale: clamp(next.scale, 0.05, 4),
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
    const preview =
      event.currentTarget.closest(".media-trim-source-stage") ??
      event.currentTarget.closest(".media-trim-preview");
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
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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
      const snappedOffset = snapPreviewOffsetToCenter({
        x: drag.adjustment.positionX + deltaX,
        y: drag.adjustment.positionY + deltaY,
      });
      setPreviewAlignmentGuides(snappedOffset.guides);
      updateMediaTrimAdjustment({
        positionX: snappedOffset.x,
        positionY: snappedOffset.y,
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
    video.currentTime = ((mediaItem.sourceStart ?? 0) + clampedFrame) / fps;
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

    if (mediaTrimDraft.clipId) {
      commitClipChange((currentClips) =>
        setClipAdjustmentById(
          currentClips,
          mediaTrimDraft.clipId ?? null,
          mediaTrimDraft.adjustment,
        ),
      );
      setSelectedClipId(mediaTrimDraft.clipId);
      setPreviewMode("timeline");
      setProjectStatus("Video crop applied");
      closeMediaTrimEditor();
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
    setProjectStatus(
      `Video trimmed to ${formatMediaDuration(durationInFrames)}`,
    );
    closeMediaTrimEditor();
  };

  const resetMediaTrimToOriginal = () => {
    if (!mediaTrimItem) return;

    if (mediaTrimDraft?.clipId) {
      setMediaTrimDraft((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              adjustment: { ...defaultClipAdjustment },
              startFrame: 0,
              endFrame: Math.max(1, mediaTrimItem.durationInFrames),
            }
          : null,
      );
      setMediaTrimPreviewFrame(0);
      setProjectStatus("Crop reset");
      return;
    }

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
    const nextVolume = clampAudioGain(volume);
    if (previewVideoLayerControlDrag(nextVolume)) return;

    commitClipChange((currentClips) =>
      clipControlTarget
        ? setClipVolumeById(currentClips, clipControlTarget.id, nextVolume)
        : selectedVideoLayer !== null
          ? setVideoLayerVolume(currentClips, selectedVideoLayer, nextVolume)
          : currentClips,
    );
  };

  const updateSelectedClipAudioFade = (
    property: "fadeInFrames" | "fadeOutFrames",
    seconds: number,
  ) => {
    if (!clipControlTarget) return;

    commitClipChange((currentClips) =>
      setClipAudioFadeById(currentClips, clipControlTarget.id, {
        [property]: Math.round(seconds * fps),
      }),
    );
  };

  const getPreviewAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!previewAudioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) return null;
      previewAudioContextRef.current = new AudioContextConstructor();
    }
    if (previewAudioContextRef.current.state === "suspended") {
      void previewAudioContextRef.current.resume().catch(() => undefined);
    }
    return previewAudioContextRef.current;
  }, []);

  const setPreviewMediaGain = useCallback(
    (media: HTMLMediaElement, gainValue: number) => {
      const audioContext = getPreviewAudioContext();
      if (!audioContext) {
        media.volume = Math.min(gainValue, 1);
        return;
      }

      let node = previewMediaGainRefs.current.get(media);
      if (!node) {
        try {
          node = {
            source: audioContext.createMediaElementSource(media),
            gain: audioContext.createGain(),
          };
          node.source.connect(node.gain).connect(audioContext.destination);
        } catch {
          media.volume = Math.min(gainValue, 1);
          return;
        }
        previewMediaGainRefs.current.set(media, node);
      }

      media.volume = 1;
      node.gain.gain.value = clampAudioGain(gainValue);
    },
    [getPreviewAudioContext],
  );

  const releasePreviewMediaGain = useCallback(
    (media: HTMLMediaElement | undefined) => {
      if (!media) return;
      const node = previewMediaGainRefs.current.get(media);
      if (!node) return;
      try {
        node.source.disconnect();
        node.gain.disconnect();
      } catch {
        // The browser may already detach media nodes while React unmounts.
      }
      previewMediaGainRefs.current.delete(media);
    },
    [],
  );

  const detachSelectedClipAudio = () => {
    if (
      !clipControlTarget ||
      (clipControlTarget.track !== "main" &&
        clipControlTarget.track !== "upper" &&
        clipControlTarget.track !== "cutout")
    ) {
      return;
    }

    commitClipChange((currentClips) =>
      detachAudioFromVideoClip(currentClips, clipControlTarget.id),
    );
    setIsAudioTrackVisible(true);
    setPreviewMode("timeline");
    setProjectStatus("Audio detached from video");
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

  const removeTranscriptSentence = (transcriptClipId: string) => {
    const transcriptClip = clips.find((clip) => clip.id === transcriptClipId);
    const sourceClipId = transcriptClip?.caption?.sourceClipId;
    if (!transcriptClip || !sourceClipId) return;

    const nextClips = removeTranscriptSentenceFromLinkedVideo(
      clips,
      transcriptClipId,
      fps,
    );
    if (nextClips === clips) {
      setCaptionStatus({
        kind: "error",
        message: "The matching video and linked audio could not be edited.",
      });
      return;
    }

    const sourceCandidates = nextClips.filter(
      (clip) =>
        (clip.track === "main" ||
          clip.track === "upper" ||
          clip.track === "cutout") &&
        (clip.id === sourceClipId ||
          clip.id.startsWith(`${sourceClipId}-speech-`)),
    );
    const nextSourceClip =
      sourceCandidates.find(
        (clip) =>
          clip.start <= transcriptClip.start &&
          clip.start + clip.duration > transcriptClip.start,
      ) ?? sourceCandidates[0];

    commitClipChange(() => nextClips);
    setSelectedClipId(nextSourceClip?.id ?? null);
    setSelectedTrack(nextSourceClip?.track ?? "main");
    setPreviewMode("timeline");
    setIsPreviewPlaying(false);
    setCaptionStatus({
      kind: "success",
      message: "Removed the sentence with its matching video and audio.",
    });
  };

  const removeTranscriptWords = (
    transcriptClipId: string,
    wordIndexes: number[],
  ) => {
    const transcriptClip = clips.find((clip) => clip.id === transcriptClipId);
    const sourceClipId = transcriptClip?.caption?.sourceClipId;
    if (!transcriptClip || !sourceClipId || wordIndexes.length === 0) return;

    const nextClips = removeTranscriptWordsFromLinkedVideo(
      clips,
      wordIndexes.map((wordIndex) => ({
        clipId: transcriptClipId,
        wordIndex,
      })),
      fps,
    );
    if (nextClips === clips) {
      setCaptionStatus({
        kind: "error",
        message:
          "Those words could not be matched to the linked video and audio.",
      });
      return;
    }

    const nextSourceClip = nextClips.find(
      (clip) =>
        (clip.track === "main" ||
          clip.track === "upper" ||
          clip.track === "cutout") &&
        (clip.id === sourceClipId ||
          clip.id.startsWith(`${sourceClipId}-speech-`)),
    );
    commitClipChange(() => nextClips);
    setSelectedClipId(nextSourceClip?.id ?? null);
    setSelectedTrack(nextSourceClip?.track ?? "main");
    setPreviewMode("timeline");
    setIsPreviewPlaying(false);
    setCaptionStatus({
      kind: "success",
      message: `Removed ${wordIndexes.length} word${wordIndexes.length === 1 ? "" : "s"} from the transcript, video, and audio.`,
    });
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
    setSaveState("saving");
    try {
      const nextProject = getCurrentSavedProject();
      const serializedProject = JSON.stringify(nextProject, null, 2);
      persistProjectToStorage(nextProject);
      downloadBrowserFile(
        new Blob([serializedProject], { type: "application/json" }),
        `video-editor-project-${Date.now()}.json`,
      );
      setProjectStatus("Project saved and downloaded");
      setSaveState("saved");
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : "Save failed.",
      );
      setSaveState("unsaved");
    }
  }, [getCurrentSavedProject]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "s" ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText) {
        return;
      }
      if (document.querySelector("dialog[open]")) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      saveProjectToStorage();
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [saveProjectToStorage]);

  useEffect(() => {
    const handleSelectAllShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "a" ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText) {
        return;
      }
      if (document.querySelector("dialog[open]")) {
        event.preventDefault();
        return;
      }

      const nextSelectedIds = clips.map((clip) => clip.id);
      if (nextSelectedIds.length === 0) {
        return;
      }

      event.preventDefault();
      const primaryClip = clips[0];
      selectedClipIdsRef.current = nextSelectedIds;
      setSelectedClipIds(nextSelectedIds);
      setSelectedClipId(primaryClip.id);
      setSelectedTrack(primaryClip.track);
      setSelectedVideoLayer(null);
      setPreviewMode("timeline");
      setProjectStatus(`${nextSelectedIds.length} clips selected`);
    };

    window.addEventListener("keydown", handleSelectAllShortcut);
    return () => window.removeEventListener("keydown", handleSelectAllShortcut);
  }, [clips]);

  useEffect(() => {
    const handleTimelineNavigationShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText || document.querySelector("dialog[open]")) {
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setPlayheadFrame(0);
        setPreviewMode("timeline");
        setProjectStatus("Moved to timeline start");
      } else if (event.key === "End") {
        event.preventDefault();
        setPlayheadFrame(projectDuration);
        setPreviewMode("timeline");
        setProjectStatus("Moved to timeline end");
      } else if (event.key === "Escape") {
        event.preventDefault();
        selectedClipIdsRef.current = [];
        setSelectedClipIds([]);
        setSelectedClipId(null);
        setSelectedVideoLayer(null);
        setTimelineSelectionBox(null);
        setProjectStatus("Selection cleared");
      }
    };

    window.addEventListener("keydown", handleTimelineNavigationShortcut);
    return () =>
      window.removeEventListener("keydown", handleTimelineNavigationShortcut);
  }, [projectDuration]);

  useEffect(() => {
    const autosave = createTrailingAutosaveScheduler(
      () => {
        persistProjectToStorage(getCurrentSavedProject());
        setSaveState("saved");
      },
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
    const exportAbortController = new AbortController();
    exportAbortControllerRef.current = exportAbortController;
    const exportJobId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `export-${Date.now()}`;
    let exportStatusTimer: number | null = null;
    let exportStatusRequestActive = false;
    const renderScale = exportMode === "fast" ? 0.75 : 1;
    setProjectStatus(
      exportMode === "fast"
        ? "Preparing fast 960 x 540 export..."
        : "Preparing HD 1280 x 720 export...",
    );

    const refreshExportStatus = async () => {
      if (exportStatusRequestActive || exportAbortController.signal.aborted) {
        return;
      }

      exportStatusRequestActive = true;
      try {
        const statusResponse = await fetch(
          `/api/export/status/${exportJobId}`,
          { signal: exportAbortController.signal },
        );
        if (!statusResponse.ok) return;

        const status = (await statusResponse.json()) as {
          progress?: number;
          phase?: string;
          state?: string;
          message?: string;
        };
        if (status.state === "failed") {
          setProjectStatus(
            `Export failed: ${status.message ?? "The renderer stopped."}`,
          );
          return;
        }

        const progress = Math.max(
          0,
          Math.min(100, Math.round(status.progress ?? 0)),
        );
        const phaseLabel =
          status.phase === "encoding"
            ? "Encoding MP4"
            : status.phase === "download_ready"
              ? "Preparing download"
              : status.phase === "preparing"
                ? "Preparing preview video"
                : "Rendering preview video";
        setProjectStatus(`${phaseLabel}... ${progress}% complete`);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setProjectStatus("Waiting for the local export server...");
        }
      } finally {
        exportStatusRequestActive = false;
      }
    };

    exportStatusTimer = window.setInterval(
      () => void refreshExportStatus(),
      750,
    );

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: nextProject,
          jobId: exportJobId,
          renderScale,
        }),
        signal: exportAbortController.signal,
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

      setProjectStatus("Preparing download... 100% complete");
      const blob = await response.blob();
      const exportFileName = `video-editor-export-${Date.now()}.mp4`;
      downloadBrowserFile(blob, exportFileName);
      window.setTimeout(() => {
        setProjectStatus(
          `Download started. Check your Downloads folder for ${exportFileName}`,
        );
      }, 900);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setProjectStatus("Export cancelled");
      } else {
        setProjectStatus(
          error instanceof Error
            ? `Export failed: ${error.message}`
            : "Export failed. Start the API with npm.cmd run web.",
        );
      }
    } finally {
      if (exportStatusTimer) {
        window.clearInterval(exportStatusTimer);
      }
      if (exportAbortControllerRef.current === exportAbortController) {
        exportAbortControllerRef.current = null;
      }
      setIsExporting(false);
    }
  }, [exportMode, getCurrentSavedProject, isExporting]);

  const cancelProjectExport = useCallback(() => {
    setProjectStatus("Cancelling export...");
    exportAbortControllerRef.current?.abort();
  }, []);

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

  const updateSelectedCutoutLineStyle = (
    updates: Partial<{
      color: string;
      opacity: number;
      width: number;
      style: CutoutLineStyle;
    }>,
  ) => {
    commitClipChange((currentClips) =>
      setCutoutLineStyleById(
        currentClips,
        clipControlTarget?.id ?? null,
        updates,
      ),
    );
    setPreviewMode("timeline");
  };

  const applySelectedCutoutLinePreset = (
    preset: (typeof cutoutLinePresetOptions)[number],
  ) => {
    const clipId = clipControlTarget?.id ?? null;
    commitClipChange((currentClips) =>
      setCutoutLineStyleById(
        setClipEffectById(currentClips, clipId, preset.effect),
        clipId,
        {
          color: preset.color,
          opacity: preset.opacity,
          width: preset.width,
          style: preset.style,
        },
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

  const resetSelectedClipAdjustment = () => {
    setCropDrag(null);
    setAdjustmentPanDrag(null);
    setRotateDrag(null);
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
    updateSelectedClipAdjustment(defaultClipAdjustment);
  };

  const fitTimelineClipToScreen = (clipId: string) => {
    setVideoQuickMenu(null);
    commitClipChange((currentClips) =>
      setClipAdjustmentById(currentClips, clipId, defaultClipAdjustment),
    );
    setSelectedClipId(clipId);
    setPreviewMode("timeline");
    setProjectStatus("Video fitted to screen");
  };

  const chooseReplacementVideo = (clipId: string) => {
    setVideoQuickMenu(null);
    setReplaceVideoClipId(clipId);
    replaceVideoInputRef.current?.click();
  };

  const replaceSelectedVideoFromGallery = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    const clipId = replaceVideoClipId;
    event.currentTarget.value = "";
    setReplaceVideoClipId(null);
    if (!file || !clipId || !file.type.startsWith("video/")) return;

    const previewSrc = URL.createObjectURL(file);
    try {
      const uploadedMedia = await uploadMediaFile(file);
      const label = (uploadedMedia.label || file.name).replace(/\.[^.]+$/, "");
      commitClipChange((currentClips) =>
        replaceClipMediaById(currentClips, clipId, {
          label,
          src: uploadedMedia.src,
        }),
      );
      setSelectedClipId(clipId);
      setPreviewMode("timeline");
      setProjectStatus(`${label} replaced the selected video`);
    } finally {
      URL.revokeObjectURL(previewSrc);
    }
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

  const startManualAdjustmentPan = (event: PointerEvent<HTMLElement>) => {
    if (!clipControlTarget || !canEditSelectedVisual) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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

  const showPreviewVideoControls = (
    event: React.MouseEvent<HTMLElement>,
    clip: TimelineClip,
    sourceWidth: number,
    sourceHeight: number,
  ) => {
    if (clip.track !== "main" && clip.track !== "upper") return false;
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    if (!previewBounds || sourceWidth <= 0 || sourceHeight <= 0) return false;

    const sourceAspect = sourceWidth / sourceHeight;
    const previewAspect = previewBounds.width / previewBounds.height;
    const widthPercent =
      sourceAspect >= previewAspect
        ? 100
        : (sourceAspect / previewAspect) * 100;
    const heightPercent =
      sourceAspect >= previewAspect
        ? (previewAspect / sourceAspect) * 100
        : 100;

    event.preventDefault();
    event.stopPropagation();

    setSelectedClipId(clip.id);
    setSelectedClipIds([clip.id]);
    setSelectedTrack(clip.track);
    setSelectedVideoLayer(null);
    setPreviewMode("timeline");
    setSelectedPreviewFrameBase({
      clipId: clip.id,
      widthPercent,
      heightPercent,
    });
    setVideoQuickMenu({
      clipId: clip.id,
      left: previewBounds.left + previewBounds.width / 2,
      top: previewBounds.top + 12,
    });
    return true;
  };

  const startPreviewScale = (event: PointerEvent<HTMLButtonElement>) => {
    if (!clipControlTarget || !canEditSelectedVisual) return;
    const bounds = previewWindowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const adjustment = {
      ...defaultClipAdjustment,
      ...clipControlTarget.adjustment,
    };
    const centerX =
      bounds.left + bounds.width * (0.5 + adjustment.positionX / 100);
    const centerY =
      bounds.top + bounds.height * (0.5 + adjustment.positionY / 100);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const dragState = {
      clipId: clipControlTarget.id,
      centerX,
      centerY,
      startDistance: Math.max(
        1,
        Math.hypot(event.clientX - centerX, event.clientY - centerY),
      ),
      originalClips: clips,
      originalAdjustment: adjustment,
    };
    previewScaleDragRef.current = dragState;
    setPreviewScaleDrag(dragState);
  };

  const updatePreviewScaleFromPointer = (
    event: globalThis.PointerEvent | PointerEvent<HTMLElement>,
  ) => {
    const dragState = previewScaleDragRef.current;
    if (!dragState) return;
    const distance = Math.max(
      1,
      Math.hypot(
        event.clientX - dragState.centerX,
        event.clientY - dragState.centerY,
      ),
    );
    const scale =
      dragState.originalAdjustment.scale * (distance / dragState.startDistance);
    setTimelineHistory((currentHistory) => ({
      ...currentHistory,
      present: setClipAdjustmentById(
        dragState.originalClips,
        dragState.clipId,
        { scale },
      ),
    }));
  };

  const finishPreviewScale = () => {
    const dragState = previewScaleDragRef.current;
    if (!dragState) return;
    previewScaleDragRef.current = null;
    setTimelineHistory((currentHistory) => {
      const currentClip = currentHistory.present.find(
        (clip) => clip.id === dragState.clipId,
      );
      const currentScale =
        currentClip?.adjustment?.scale ?? defaultClipAdjustment.scale;
      if (
        Math.abs(currentScale - dragState.originalAdjustment.scale) < 0.0001
      ) {
        return {
          ...currentHistory,
          present: dragState.originalClips,
        };
      }
      return {
        past: [...currentHistory.past, dragState.originalClips],
        present: currentHistory.present,
        future: [],
      };
    });
    setPreviewScaleDrag(null);
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

  const splitSelectedTrackClip = useCallback(() => {
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

    const nextClips = splitClipByIdAtFrame(
      clips,
      targetClip.id,
      playheadFrame,
      { splitLinkedAudio: false },
    );
    if (nextClips === clips) {
      setProjectStatus("Move the red playhead inside the selected clip");
      return;
    }

    commitClipChange(() => nextClips);
    setSelectedClipId(`${targetClip.id}-b`);
    setSelectedTrack(targetClip.track);
    setProjectStatus("Clip split at the red playhead");
  }, [clips, commitClipChange, playheadFrame, selectedClipId, selectedTrack]);

  useEffect(() => {
    const handleSplitShortcut = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyS" ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText || document.querySelector("dialog[open]")) {
        return;
      }

      event.preventDefault();
      splitSelectedTrackClip();
    };

    window.addEventListener("keydown", handleSplitShortcut);
    return () => window.removeEventListener("keydown", handleSplitShortcut);
  }, [splitSelectedTrackClip]);

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
    const clipIds =
      selectedClipIds.length > 0
        ? selectedClipIds
        : selectedClipId
          ? [selectedClipId]
          : [];
    if (clipIds.length === 0) return;
    commitClipChange((currentClips) =>
      deleteTimelineClips(currentClips, clipIds),
    );
    setSelectedClipId(null);
    setSelectedClipIds([]);
  };

  const duplicateSelectedClip = useCallback(() => {
    const clipIds =
      selectedClipIds.length > 0
        ? selectedClipIds
        : selectedClipId
          ? [selectedClipId]
          : [];
    if (clipIds.length === 0) return;

    const duplicatePrefix = `duplicate-${Date.now()}`;
    const sourceClip = clips.find((clip) => clip.id === clipIds[0]);
    commitClipChange((currentClips) =>
      clipIds.reduce(
        (nextClips, clipId, index) =>
          duplicateClipById(nextClips, clipId, `${duplicatePrefix}-${index}`),
        currentClips,
      ),
    );
    setSelectedClipId(
      sourceClip?.track === "audio" && sourceClip.linkedClipId
        ? `${duplicatePrefix}-0-video`
        : `${duplicatePrefix}-0-video`,
    );
    selectedClipIdsRef.current = [];
    setSelectedClipIds([]);
    setSelectedTrack("upper");
    setPreviewMode("timeline");
    setIsAudioTrackVisible(
      sourceClip?.track === "audio" || Boolean(sourceClip?.linkedClipId),
    );
  }, [clips, commitClipChange, selectedClipId, selectedClipIds]);

  useEffect(() => {
    const handleDuplicateShortcut = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyD" ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText || document.querySelector("dialog[open]")) {
        return;
      }

      event.preventDefault();
      duplicateSelectedClip();
    };

    window.addEventListener("keydown", handleDuplicateShortcut);
    return () => window.removeEventListener("keydown", handleDuplicateShortcut);
  }, [duplicateSelectedClip]);

  const toggleClipMute = (clipId: string) => {
    commitClipChange((currentClips) =>
      toggleClipMuteById(currentClips, clipId),
    );
    setPreviewMode("timeline");
  };

  const toggleClipVisibility = (clipId: string) => {
    const targetClip = clips.find((clip) => clip.id === clipId);
    commitClipChange((currentClips) =>
      toggleClipVisibilityById(currentClips, clipId),
    );
    setProjectStatus(
      targetClip?.hidden
        ? `${targetClip.label} is visible`
        : `${targetClip?.label ?? "Clip"} is hidden`,
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
    selectedClipIdsRef.current = [clip.id];
    setSelectedClipIds([clip.id]);
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

  const toggleTimelineClipSelection = (clip: TimelineClip) => {
    const currentIds = selectedClipIdsRef.current;
    const nextIds = currentIds.includes(clip.id)
      ? currentIds.filter((clipId) => clipId !== clip.id)
      : [...currentIds, clip.id];
    const primaryId = nextIds.includes(clip.id)
      ? clip.id
      : (nextIds[nextIds.length - 1] ?? null);

    selectedClipIdsRef.current = nextIds;
    setSelectedClipIds(nextIds);
    setSelectedClipId(primaryId);
    setSelectedVideoLayer(null);
    setPreviewMode("timeline");
    if (primaryId) {
      const primaryClip = clips.find((candidate) => candidate.id === primaryId);
      if (primaryClip) setSelectedTrack(primaryClip.track);
    }
  };

  const selectTimelineClipRange = (clip: TimelineClip) => {
    const anchor = clips.find((candidate) => candidate.id === selectedClipId);
    if (!anchor || anchor.track !== clip.track) {
      selectTimelineClip(clip);
      return;
    }

    const laneClips = clips
      .filter((candidate) => candidate.track === clip.track)
      .sort((left, right) => left.start - right.start);
    const anchorIndex = laneClips.findIndex(
      (candidate) => candidate.id === anchor.id,
    );
    const targetIndex = laneClips.findIndex(
      (candidate) => candidate.id === clip.id,
    );
    if (anchorIndex < 0 || targetIndex < 0) {
      selectTimelineClip(clip);
      return;
    }

    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    const nextIds = laneClips
      .slice(startIndex, endIndex + 1)
      .map((candidate) => candidate.id);
    selectedClipIdsRef.current = nextIds;
    setSelectedClipIds(nextIds);
    setSelectedClipId(clip.id);
    setSelectedTrack(clip.track);
    setSelectedVideoLayer(null);
    setPreviewMode("timeline");
  };

  useEffect(() => {
    const handleTimelineArrowNavigation = (event: KeyboardEvent) => {
      const direction =
        event.key === "ArrowLeft"
          ? "left"
          : event.key === "ArrowRight"
            ? "right"
            : event.key === "ArrowUp"
              ? "up"
              : event.key === "ArrowDown"
                ? "down"
                : null;
      if (
        !direction ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        !selectedClipIdRef.current ||
        (event.altKey && (direction === "up" || direction === "down"))
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

      const selectedClip = clips.find(
        (clip) => clip.id === selectedClipIdRef.current,
      );
      const canNudgeSelectedClip =
        selectedClip &&
        ["caption", "text", "sticker", "cutout"].includes(selectedClip.track);
      if (
        canNudgeSelectedClip &&
        (event.shiftKey || event.altKey) &&
        (direction === "left" || direction === "right")
      ) {
        event.preventDefault();
        const frameStep = event.altKey ? (event.shiftKey ? 10 : 1) : 5;
        const targetStart = Math.max(
          0,
          selectedClip.start + (direction === "left" ? -frameStep : frameStep),
        );
        const timelineBoundary = getExpandedTimelineBoundary(
          projectDuration,
          targetStart,
          selectedClip.duration,
        );
        commitClipChange((currentClips) => {
          if (selectedClip.track === "cutout") {
            return moveCutoutClip(
              currentClips,
              selectedClip.id,
              targetStart,
              timelineBoundary,
            );
          }
          if (selectedClip.track === "text") {
            return moveTextClip(
              currentClips,
              selectedClip.id,
              targetStart,
              timelineBoundary,
            );
          }
          return moveIndependentTimelineClip(
            currentClips,
            selectedClip.id,
            targetStart,
            timelineBoundary,
          );
        });
        setPlayheadFrame(targetStart);
        setProjectStatus(
          `${selectedClip.label} moved ${direction} ${frameStep} frames`,
        );
        return;
      }

      if (event.repeat) {
        return;
      }

      const targetClip = getTimelineKeyboardNavigationTarget({
        clips,
        selectedClipId: selectedClipIdRef.current,
        direction,
      });
      if (!targetClip) return;

      event.preventDefault();
      selectTimelineClip(targetClip, targetClip.start);
      setProjectStatus(
        `${direction === "left" || direction === "right" ? "Selected" : "Moved to"} ${targetClip.label}`,
      );
    };

    window.addEventListener("keydown", handleTimelineArrowNavigation);
    return () =>
      window.removeEventListener("keydown", handleTimelineArrowNavigation);
  }, [clips, commitClipChange, projectDuration]);

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
      category: "Uploaded",
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
                processedMedia.subjectBounds,
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
              processedMedia.subjectBounds,
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
        return applyAutomaticCutoutById(
          currentClips,
          clipId,
          payload.src,
          payload.subjectBounds,
        );
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

  const applyTextStylePreset = (preset: TextStylePreset) => {
    if (selectedTextClip?.text) {
      updateSelectedTextStyle(preset.style);
      setProjectStatus(`${preset.label} text style applied`);
      return;
    }

    const content = textDraft.trim();
    if (!content) {
      setProjectStatus("Type your text before choosing a style");
      return;
    }

    const id = `text-${Date.now()}`;
    const textClip = createTextClip({ id, content, playheadFrame });
    commitClipChange((currentClips) =>
      setTextStyleById([...currentClips, textClip], id, preset.style),
    );
    setSelectedClipId(id);
    setSelectedTrack("text");
    setIsAudioTrackVisible(false);
    setPreviewMode("timeline");
    setTextDraft("");
    setProjectStatus(`${preset.label} text added at the playhead`);
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
      setCaptionStatus({ kind: "error", message });
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
          { signal: abortController.signal },
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
            { type: referenceBlob.type || "video/mp4" },
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
        throw new Error(
          "Background-noise cleanup returned an invalid response.",
        );
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
          !isDominantVoiceRequestCurrent(snapshot, sourceClipId, currentClips)
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
          scaleX: selectedClip.sticker?.scaleX,
          scaleY: selectedClip.sticker?.scaleY,
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
    handle?: CaptionResizeHandle,
  ) => {
    const stickerBounds = event.currentTarget
      .closest<HTMLElement>(".preview-sticker")
      ?.getBoundingClientRect();
    const previewBounds = previewWindowRef.current?.getBoundingClientRect();
    if (!stickerBounds || !previewBounds) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
    setStickerInteraction({
      clipId: clip.id,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseWidth:
        stickerBounds.width /
        Math.max(0.08, clip.sticker?.scaleX ?? clip.sticker?.scale ?? 1),
      baseHeight:
        stickerBounds.height /
        Math.max(0.08, clip.sticker?.scaleY ?? clip.sticker?.scale ?? 1),
      previewWidth: previewBounds.width,
      previewHeight: previewBounds.height,
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
      startY: event.clientY,
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
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
    setTextPreviewDrag({
      clipId: clip.id,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      halfWidthPercent: (textBounds.width / previewBounds.width) * 50,
      halfHeightPercent: (textBounds.height / previewBounds.height) * 50,
      width: textBounds.width,
      height: textBounds.height,
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
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
    setCaptionPreviewDrag({
      clipId: clip.id,
      startX: event.clientX,
      startY: event.clientY,
      originalClips: clips,
      halfWidthPercent: (captionBounds.width / previewBounds.width) * 50,
      halfHeightPercent: (captionBounds.height / previewBounds.height) * 50,
      width: captionBounds.width,
      height: captionBounds.height,
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
    const controlElement =
      mode === "move"
        ? cutoutElement
        : (event.currentTarget.closest<HTMLElement>(".cutout-control-box") ??
          cutoutElement);
    const controlBounds = controlElement?.getBoundingClientRect();
    const centerX = controlBounds
      ? controlBounds.left + controlBounds.width / 2
      : event.clientX;
    const centerY = controlBounds
      ? controlBounds.top + controlBounds.height / 2
      : event.clientY;
    selectTimelineClip(clip);
    setPreviewAlignmentGuides({ horizontal: false, vertical: false });
    setCutoutInteraction({
      clipId: clip.id,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      centerX,
      centerY,
      rotationOffset:
        (clip.cutout?.rotation ?? 0) -
        getManualRotationAngle(
          centerX,
          centerY,
          event.clientX,
          event.clientY,
          0,
        ),
      baseWidth: controlElement?.offsetWidth ?? cutoutElement?.offsetWidth ?? 1,
      baseHeight:
        controlElement?.offsetHeight ?? cutoutElement?.offsetHeight ?? 1,
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
      startY: event.clientY,
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

  const startCaptionRotateDrag = (
    event: PointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => {
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || !clip.caption) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    setCaptionPreviewDrag(null);
    setCaptionResizeDrag(null);
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    setCaptionRotateDrag({
      clipId: clip.id,
      centerX,
      centerY,
      rotationOffset:
        (clip.caption.rotation ?? 0) -
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

  const startAudioFadeDrag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: TimelineClip,
    edge: "in" | "out",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectTimelineClip(clip);
    setSaveState("unsaved");
    setAudioFadeDrag({
      clipId: clip.id,
      edge,
      startX: event.clientX,
      startFadeFrames:
        edge === "in"
          ? (clip.audioFadeInFrames ?? 0)
          : (clip.audioFadeOutFrames ?? 0),
      originalClips: clips,
    });
  };

  const startAudioVolumeDrag = (
    event: PointerEvent<SVGLineElement>,
    clip: TimelineClip,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget
      .closest<HTMLElement>(".timeline-clip")
      ?.getBoundingClientRect();
    if (!bounds) return;

    selectTimelineClip(clip);
    setSaveState("unsaved");
    setAudioVolumeDrag({
      clipId: clip.id,
      startY: event.clientY,
      startVolume: clampAudioGain(clip.volume ?? 1),
      boundsHeight: bounds.height,
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

  const togglePreviewPlayback = useCallback(
    (requestedStartFrame?: number) => {
      previewVideoRef.current?.pause();
      setIsMediaPreviewPlaying(false);
      setPreviewMode("timeline");
      if (!isPreviewPlaying || previewMode !== "timeline") {
        const nextStartFrame = requestedStartFrame ?? playheadFrame;
        if (nextStartFrame >= videoPlaybackDuration - 1) {
          setPlayheadFrame(0);
        } else if (requestedStartFrame !== undefined) {
          setPlayheadFrame(requestedStartFrame);
        }
        setIsPreviewPlaying(true);
        return;
      }

      setIsPreviewPlaying(false);
    },
    [isPreviewPlaying, playheadFrame, previewMode, videoPlaybackDuration],
  );

  const toggleTimelinePlayback = useCallback(() => {
    const previewStartFrame = timelineHoverFrame ?? undefined;
    setTimelineHoverFrame(null);
    togglePreviewPlayback(previewStartFrame);
  }, [timelineHoverFrame, togglePreviewPlayback]);

  useEffect(() => {
    const handleSpacebarPlayback = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, [contenteditable='true']"),
          ));
      if (isEditingText || document.querySelector("dialog[open]")) {
        return;
      }

      event.preventDefault();
      toggleTimelinePlayback();
    };

    window.addEventListener("keydown", handleSpacebarPlayback);
    return () => window.removeEventListener("keydown", handleSpacebarPlayback);
  }, [toggleTimelinePlayback]);

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

  const addAudioLibraryItem = async (item: AudioLibraryItem) => {
    if (addingAudioLibraryItemId) return;
    setAddingAudioLibraryItemId(item.id);
    setProjectStatus(`Adding ${item.label}...`);

    try {
      const file = createAudioLibraryFile(item);
      const uploadedMedia = await uploadMediaFile(file);
      const clip = createBackgroundMusicClip({
        id: `library-audio-${item.id}-${Date.now()}`,
        label: item.label,
        src: uploadedMedia.src,
        playheadFrame,
        durationInFrames: Math.round(item.durationSeconds * fps),
      });
      const styledClip: TimelineClip = {
        ...clip,
        color: item.kind === "sound-effects" ? "#b8682b" : "#2563eb",
        volume: item.kind === "sound-effects" ? 1 : 0.7,
      };

      commitClipChange((currentClips) => [...currentClips, styledClip]);
      setSelectedClipId(styledClip.id);
      setSelectedClipIds([styledClip.id]);
      setSelectedTrack("audio");
      setIsAudioTrackVisible(true);
      setPreviewMode("timeline");
      setProjectStatus(
        `${item.label} added at ${formatTimelineClock(playheadFrame, fps)}`,
      );
    } catch (error) {
      setProjectStatus(
        error instanceof Error
          ? `Could not add audio: ${error.message}`
          : "Could not add audio.",
      );
    } finally {
      setAddingAudioLibraryItemId(null);
    }
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

  const updateTimelineHoverFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isPreviewPlaying || isScrubbing) {
        setTimelineHoverFrame(null);
        return;
      }
      if (event.buttons !== 0) return;

      const bounds = timelineContentRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const timelineStart = bounds.left + timelineOrigin;
      const timelineEnd =
        timelineStart + Math.max(0, projectDuration - 1) * timelineScale;
      if (event.clientX < timelineStart || event.clientX > timelineEnd) {
        setTimelineHoverFrame(null);
        return;
      }

      const frame = getPointerTimelineFrame(event.clientX);
      if (frame === null) return;
      setTimelineHoverFrame(
        Math.max(0, Math.min(Math.max(0, projectDuration - 1), frame)),
      );
      setPreviewMode("timeline");
    },
    [getPointerTimelineFrame, isPreviewPlaying, isScrubbing, projectDuration],
  );

  const holdTimelinePreviewFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isPreviewPlaying || isScrubbing) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "button, input, select, textarea, [contenteditable='true'], [data-timeline-clip-id], .timeline-playhead, .timeline-trim-handle, .timeline-transition-button",
        )
      ) {
        return;
      }

      const frame = getPointerTimelineFrame(event.clientX);
      if (frame === null) return;
      setTimelineHoverFrame(
        Math.max(0, Math.min(Math.max(0, projectDuration - 1), frame)),
      );
      setPreviewMode("timeline");
    },
    [getPointerTimelineFrame, isPreviewPlaying, isScrubbing, projectDuration],
  );

  const getTimelineSelectionPoint = (clientX: number, clientY: number) => {
    const timeline = timelineContentRef.current;
    if (!timeline) return null;
    const bounds = timeline.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, clientY - bounds.top)),
    };
  };

  const getTimelineClipsInsideSelection = (selection: TimelineSelectionBox) => {
    const timeline = timelineContentRef.current;
    if (!timeline) return [];
    const timelineBounds = timeline.getBoundingClientRect();
    const left =
      timelineBounds.left + Math.min(selection.startX, selection.currentX);
    const right =
      timelineBounds.left + Math.max(selection.startX, selection.currentX);
    const top =
      timelineBounds.top + Math.min(selection.startY, selection.currentY);
    const bottom =
      timelineBounds.top + Math.max(selection.startY, selection.currentY);

    return Array.from(
      timeline.querySelectorAll<HTMLElement>("[data-timeline-clip-id]"),
    )
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.right >= left &&
          bounds.left <= right &&
          bounds.bottom >= top &&
          bounds.top <= bottom
        );
      })
      .map((element) => element.dataset.timelineClipId)
      .filter((clipId): clipId is string => Boolean(clipId));
  };

  const applyTimelineSelectionBox = (selection: TimelineSelectionBox) => {
    const touchedIds = selection.activated
      ? getTimelineClipsInsideSelection(selection)
      : [];
    const nextIds = Array.from(
      new Set([...selection.initialIds, ...touchedIds]),
    );
    const primaryId =
      touchedIds[touchedIds.length - 1] ?? nextIds[nextIds.length - 1] ?? null;

    selectedClipIdsRef.current = nextIds;
    setSelectedClipIds(nextIds);
    setSelectedClipId(primaryId);
    setSelectedVideoLayer(null);
    if (primaryId) {
      const primaryClip = clipsRef.current.find(
        (clip) => clip.id === primaryId,
      );
      if (primaryClip) setSelectedTrack(primaryClip.track);
    }
  };

  const clearTimelineClipSelection = () => {
    setSelectedVideoLayer(null);
    selectedClipIdsRef.current = [];
    setSelectedClipIds([]);
    setSelectedClipId(null);
  };

  const clearEditorSelection = () => {
    clearTimelineClipSelection();
    clearMediaSelection();
  };

  const startTimelineSelection = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const point = getTimelineSelectionPoint(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPreviewPlaying(false);
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const selection: TimelineSelectionBox = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      initialIds: additive ? selectedClipIdsRef.current : [],
      activated: false,
      startedFromTrackLabel:
        event.currentTarget.classList.contains("track-label"),
    };
    timelineSelectionPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    timelineSelectionBoxRef.current = selection;
    setTimelineSelectionBox(selection);
    if (!additive) {
      clearEditorSelection();
    }
  };

  const updateTimelineSelection = (event: PointerEvent<HTMLDivElement>) => {
    const selection = timelineSelectionBoxRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    timelineSelectionPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    const point = getTimelineSelectionPoint(event.clientX, event.clientY);
    if (!point) return;
    const activated =
      selection.activated ||
      Math.hypot(point.x - selection.startX, point.y - selection.startY) >= 2;
    const nextSelection = {
      ...selection,
      currentX: point.x,
      currentY: point.y,
      activated,
    };
    timelineSelectionBoxRef.current = nextSelection;
    setTimelineSelectionBox(nextSelection);
    if (activated) {
      suppressTrackLabelClickRef.current = true;
      applyTimelineSelectionBox(nextSelection);
    }
  };

  const finishTimelineSelection = (event: PointerEvent<HTMLElement>) => {
    const selection = timelineSelectionBoxRef.current;
    if (!selection || selection.pointerId !== event.pointerId) return;
    if (!selection.activated) {
      updatePlayheadFromPointer(event.clientX);
      clearEditorSelection();
      setProjectStatus("Timeline selection cleared");
    } else {
      applyTimelineSelectionBox(selection);
      const selectedCount = new Set([
        ...selection.initialIds,
        ...getTimelineClipsInsideSelection(selection),
      ]).size;
      setProjectStatus(
        `${selectedCount} timeline clip${selectedCount === 1 ? "" : "s"} selected`,
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    timelineSelectionBoxRef.current = null;
    timelineSelectionPointerRef.current = null;
    setTimelineSelectionBox(null);
    window.setTimeout(() => {
      suppressTrackLabelClickRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (!timelineSelectionBox) return;

    let animationFrame = 0;
    const scrollWhileSelecting = () => {
      const scrollArea = timelineScrollRef.current;
      const selection = timelineSelectionBoxRef.current;
      const pointer = timelineSelectionPointerRef.current;
      if (!scrollArea || !selection || !pointer) return;

      const bounds = scrollArea.getBoundingClientRect();
      const laneViewportLeft = Math.min(
        bounds.right,
        bounds.left + timelineOrigin,
      );
      const isNearTimelineHorizontally =
        pointer.x >= laneViewportLeft - 64 && pointer.x <= bounds.right + 64;
      const isNearTimelineVertically =
        pointer.y >= bounds.top - 64 && pointer.y <= bounds.bottom + 64;
      const horizontalDelta = isNearTimelineVertically
        ? getDragEdgeAutoScrollDelta(
            pointer.x,
            laneViewportLeft,
            bounds.right,
            64,
            18,
          )
        : 0;
      const verticalDelta = isNearTimelineHorizontally
        ? getDragEdgeAutoScrollDelta(
            pointer.y,
            bounds.top,
            bounds.bottom,
            64,
            18,
          )
        : 0;
      const previousLeft = scrollArea.scrollLeft;
      const previousTop = scrollArea.scrollTop;

      scrollArea.scrollLeft += horizontalDelta;
      scrollArea.scrollTop += verticalDelta;

      if (
        scrollArea.scrollLeft !== previousLeft ||
        scrollArea.scrollTop !== previousTop
      ) {
        const point = getTimelineSelectionPoint(pointer.x, pointer.y);
        if (point) {
          const nextSelection = {
            ...selection,
            currentX: point.x,
            currentY: point.y,
            activated: true,
          };
          timelineSelectionBoxRef.current = nextSelection;
          setTimelineSelectionBox(nextSelection);
          applyTimelineSelectionBox(nextSelection);
        }
      }

      animationFrame = window.requestAnimationFrame(scrollWhileSelecting);
    };

    animationFrame = window.requestAnimationFrame(scrollWhileSelecting);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [timelineSelectionBox?.pointerId]);

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
    timelineClipIds: string[] = [clip.id],
    toggleSelectionOnClick = false,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragStartedRef.current = false;
    if (timelineClipIds.length > 1) {
      setProjectStatus(
        `Moving ${timelineClipIds.length} selected clips together`,
      );
    }
    const pointerFrame = getPointerTimelineFrame(event.clientX) ?? clip.start;
    const nextDrag: PointerDrag = {
      type: "timeline",
      id: clip.id,
      timelineClipIds: [...timelineClipIds],
      toggleSelectionOnClick,
      activated: false,
      label:
        timelineClipIds.length > 1
          ? `${timelineClipIds.length} selected clips`
          : clip.label,
      x: event.clientX,
      y: event.clientY,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originalStart: clip.start,
      grabOffsetFrames: pointerFrame - clip.start,
    };
    pointerDragRef.current = nextDrag;
    pointerDragPositionRef.current = { x: event.clientX, y: event.clientY };
    setPointerDrag(nextDrag);
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
    const nextDrag: PointerDrag = {
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
    };
    pointerDragRef.current = nextDrag;
    pointerDragPositionRef.current = { x: event.clientX, y: event.clientY };
    setPointerDrag(nextDrag);
  };

  const getSnappedTimelineStart = useCallback(
    ({
      currentClips,
      movingClipIds,
      targetStart,
      duration,
    }: {
      currentClips: TimelineClip[];
      movingClipIds: string[];
      targetStart: number;
      duration: number;
    }) => {
      const movingIds = new Set(movingClipIds);
      const snapPoints = new Set<number>([0, playheadFrame]);

      currentClips.forEach((clip) => {
        if (movingIds.has(clip.id)) return;
        snapPoints.add(clip.start);
        snapPoints.add(clip.start + clip.duration);
      });

      let closestStart = targetStart;
      let closestDistance = Number.POSITIVE_INFINITY;
      snapPoints.forEach((point) => {
        const startDistance = Math.abs(point - targetStart);
        const endDistance = Math.abs(point - (targetStart + duration));
        if (startDistance < closestDistance) {
          closestDistance = startDistance;
          closestStart = point;
        }
        if (endDistance < closestDistance) {
          closestDistance = endDistance;
          closestStart = point - duration;
        }
      });

      return closestDistance <= 8
        ? Math.max(0, Math.round(closestStart))
        : targetStart;
    },
    [playheadFrame],
  );

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
      pointerDragPositionRef.current = { x: event.clientX, y: event.clientY };
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
        setSelectedMediaIds(pointerDrag.mediaIds ?? [pointerDrag.id]);
        setSelectedMediaId(pointerDrag.id);
      }
      setPointerDrag((currentDrag) => {
        const nextDrag = currentDrag
          ? {
              ...currentDrag,
              activated: true,
              x: event.clientX,
              y: event.clientY,
            }
          : currentDrag;
        pointerDragRef.current = nextDrag;
        return nextDrag;
      });
      updateDropTarget(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (!pointerDragStartedRef.current) {
        if (pointerDrag.type === "timeline") {
          const clickedClip = clipsRef.current.find(
            (clip) => clip.id === pointerDrag.id,
          );
          if (clickedClip) {
            if (pointerDrag.toggleSelectionOnClick) {
              toggleTimelineClipSelection(clickedClip);
            } else {
              selectedClipIdsRef.current = [clickedClip.id];
              setSelectedClipIds([clickedClip.id]);
              setSelectedClipId(clickedClip.id);
              setSelectedTrack(clickedClip.track);
              setSelectedVideoLayer(null);
              setPreviewMode("timeline");
            }
          }
        } else if (pointerDrag.type === "media") {
          const clickedMedia = mediaItems.find(
            (item) => item.id === pointerDrag.id,
          );
          if (clickedMedia) {
            chooseMedia(clickedMedia, false, false);
          }
        }
        setPointerDrag(null);
        pointerDragRef.current = null;
        pointerDragPositionRef.current = null;
        setVideoDropTarget(null);
        return;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const target = getVideoDropTargetFromElement(element);
      const pointerFrame = getPointerTimelineFrame(event.clientX) ?? 0;
      const draggedClipAtDrop =
        pointerDrag.type === "timeline"
          ? clips.find((clip) => clip.id === pointerDrag.id) ?? null
          : null;
      const targetTimelineClipId =
        element instanceof HTMLElement
          ? element.closest<HTMLElement>("[data-timeline-clip-id]")?.dataset
              .timelineClipId ?? null
          : null;
      const elementTimelineClip = targetTimelineClipId
        ? clips.find((clip) => clip.id === targetTimelineClipId) ?? null
        : null;
      const frameTimelineClip = draggedClipAtDrop
        ? clips.find(
            (clip) =>
              clip.id !== draggedClipAtDrop.id &&
              getVideoLayer(clip) === getVideoLayer(draggedClipAtDrop) &&
              pointerFrame >= clip.start &&
              pointerFrame < clip.start + clip.duration,
          ) ?? null
        : null;
      const targetTimelineClip =
        elementTimelineClip?.id !== draggedClipAtDrop?.id
          ? elementTimelineClip
          : frameTimelineClip;
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
      const effectiveTargetVideoLayer =
        targetVideoLayer ??
        (pointerDrag.type === "timeline" && draggedClipAtDrop
          ? getVideoLayer(draggedClipAtDrop)
          : null);

      if (
        pointerDrag.type === "timeline" &&
        (pointerDrag.timelineClipIds?.length ?? 0) > 1
      ) {
        const draggedClip = clips.find((clip) => clip.id === pointerDrag.id);
        if (draggedClip) {
          const targetStart =
            pointerFrame - (pointerDrag.grabOffsetFrames ?? 0);
          const selectedIds = new Set(pointerDrag.timelineClipIds);
          const movingClips = clips.filter((clip) => selectedIds.has(clip.id));
          const groupStart = Math.min(...movingClips.map((clip) => clip.start));
          const groupEnd = Math.max(
            ...movingClips.map((clip) => clip.start + clip.duration),
          );
          const snappedGroupStart = getSnappedTimelineStart({
            currentClips: clips,
            movingClipIds: [...selectedIds],
            targetStart:
              groupStart + Math.round(targetStart - draggedClip.start),
            duration: groupEnd - groupStart,
          });
          const requestedDelta = snappedGroupStart - groupStart;
          const anchorVideoLayer = getVideoLayer(draggedClip);
          const anchorLayerForMove = anchorVideoLayer ?? 0;
          const videoLayerDelta =
            targetVideoLayer !== null && anchorVideoLayer !== null
              ? targetVideoLayer - anchorLayerForMove
              : null;

          commitClipChange((currentClips) => {
            const moveIds = new Set(selectedIds);
            currentClips.forEach((clip) => {
              if (moveIds.has(clip.id) && clip.linkedClipId) {
                moveIds.add(clip.linkedClipId);
              }
              if (clip.linkedClipId && moveIds.has(clip.linkedClipId)) {
                moveIds.add(clip.id);
              }
            });
            const movingClips = currentClips.filter((clip) =>
              moveIds.has(clip.id),
            );
            const earliestStart = Math.min(
              ...movingClips.map((clip) => clip.start),
            );
            const frameDelta = Math.max(-earliestStart, requestedDelta);

            return currentClips.map((clip) => {
              if (!moveIds.has(clip.id)) return clip;

              const movedClip = { ...clip, start: clip.start + frameDelta };
              const currentVideoLayer = getVideoLayer(clip);
              if (videoLayerDelta === null || currentVideoLayer === null) {
                return movedClip;
              }

              const nextVideoLayer = currentVideoLayer + videoLayerDelta;
              return {
                ...movedClip,
                track: nextVideoLayer === 0 ? "main" : "upper",
                videoLayer: nextVideoLayer === 0 ? undefined : nextVideoLayer,
                overlayLane: undefined,
                timelineRowOrder:
                  target?.kind === "row-gap"
                    ? target.rowOrder +
                      (currentVideoLayer - anchorLayerForMove) * 0.001
                    : movedClip.timelineRowOrder,
              };
            });
          });
          if (targetVideoLayer !== null) {
            setSelectedTrack(targetVideoLayer === 0 ? "main" : "upper");
          }
          setProjectStatus(`${selectedIds.size} selected clips moved together`);
        }
      } else if (pointerDrag.type === "media" && target?.kind === "track") {
        const draggedItems = mediaItems.filter((item) =>
          (pointerDrag.mediaIds ?? [pointerDrag.id]).includes(item.id),
        );
        if (draggedItems.length === 1) {
          placeMediaOnTimelineTrack(
            draggedItems[0],
            target.track,
            pointerFrame,
          );
        } else if (draggedItems.length > 1) {
          setProjectStatus(
            "Drop selected scenes on the Main track or an Overlay track",
          );
        }
      } else if (effectiveTargetVideoLayer !== null) {
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
                effectiveTargetVideoLayer,
                pointerFrame,
                "place",
                target.rowOrder,
              );
            } else {
              placeMediaBatchOnVideoLayer(
                draggedItems,
                effectiveTargetVideoLayer,
                pointerFrame,
                effectiveTargetVideoLayer === 0 ? "insert" : "place",
              );
            }
          }
        } else {
          const targetStart =
            pointerFrame - (pointerDrag.grabOffsetFrames ?? 0);
          const draggedClip = clips.find((clip) => clip.id === pointerDrag.id);
          const draggedVideoLayer = draggedClip
            ? getVideoLayer(draggedClip)
            : null;
          const canSwapTimelineClips = Boolean(
            draggedClip &&
              targetTimelineClip &&
              targetTimelineClip.id !== draggedClip.id &&
              draggedVideoLayer !== null &&
              draggedVideoLayer === getVideoLayer(targetTimelineClip),
          );
          const linkedClipIds = draggedClip?.linkedClipId
            ? [pointerDrag.id, draggedClip.linkedClipId]
            : [pointerDrag.id];
          const snappedTargetStart = draggedClip
            ? getSnappedTimelineStart({
                currentClips: clips,
                movingClipIds: linkedClipIds,
                targetStart,
                duration: draggedClip.duration,
              })
            : targetStart;
          const timelineBoundary = draggedClip
            ? getExpandedTimelineBoundary(
                projectDuration,
                snappedTargetStart,
                draggedClip.duration,
            )
            : projectDuration;
          commitClipChange((currentClips) => {
            if (canSwapTimelineClips && draggedClip && targetTimelineClip) {
              const laneClips = currentClips
                .filter((clip) => getVideoLayer(clip) === draggedVideoLayer)
                .sort((left, right) => left.start - right.start);
              const draggedIndex = laneClips.findIndex(
                (clip) => clip.id === draggedClip.id,
              );
              const targetIndex = laneClips.findIndex(
                (clip) => clip.id === targetTimelineClip.id,
              );

              if (draggedIndex >= 0 && targetIndex >= 0) {
                const reorderedLane = [...laneClips];
                const [removedClip] = reorderedLane.splice(draggedIndex, 1);
                const remainingTargetIndex = reorderedLane.findIndex(
                  (clip) => clip.id === targetTimelineClip.id,
                );
                const insertBefore =
                  pointerFrame <
                  targetTimelineClip.start + targetTimelineClip.duration / 2;
                reorderedLane.splice(
                  Math.max(
                    0,
                    remainingTargetIndex + (insertBefore ? 0 : 1),
                  ),
                  0,
                  removedClip,
                );

                const nextStartById = new Map<string, number>();
                reorderedLane.forEach((clip, index) => {
                  if (index === 0) {
                    nextStartById.set(clip.id, laneClips[0].start);
                    return;
                  }
                  const previousClip = reorderedLane[index - 1];
                  const originalPreviousClip = laneClips[index - 1];
                  const originalNextClip = laneClips[index];
                  const gap = Math.max(
                    0,
                    originalNextClip.start -
                      (originalPreviousClip.start +
                        originalPreviousClip.duration),
                  );
                  const previousStart =
                    nextStartById.get(previousClip.id) ?? previousClip.start;
                  nextStartById.set(
                    clip.id,
                    previousStart + previousClip.duration + gap,
                  );
                });

                const originalStartById = new Map(
                  laneClips.map((clip) => [clip.id, clip.start]),
                );
                return currentClips.map((clip) => {
                  const nextStart = nextStartById.get(clip.id);
                  if (nextStart !== undefined) {
                    return { ...clip, start: nextStart };
                  }

                  const linkedVideoId = clip.linkedClipId;
                  const linkedVideoNextStart = linkedVideoId
                    ? nextStartById.get(linkedVideoId)
                    : undefined;
                  const linkedVideoOriginalStart = linkedVideoId
                    ? originalStartById.get(linkedVideoId)
                    : undefined;
                  if (
                    linkedVideoNextStart !== undefined &&
                    linkedVideoOriginalStart !== undefined
                  ) {
                    return {
                      ...clip,
                      start:
                        clip.start +
                        (linkedVideoNextStart - linkedVideoOriginalStart),
                    };
                  }
                  return clip;
                });
              }
            }

            const movedClips = moveVideoClipToLayer(
              currentClips,
              pointerDrag.id,
              effectiveTargetVideoLayer,
              snappedTargetStart,
              timelineBoundary,
            );
            if (target?.kind !== "row-gap") return movedClips;

            return movedClips.map((clip) =>
              clip.id === pointerDrag.id
                ? { ...clip, timelineRowOrder: target.rowOrder }
                : clip,
            );
          });
          if (canSwapTimelineClips && draggedClip && targetTimelineClip) {
            setProjectStatus(
              `Reordered ${draggedClip.label} with ${targetTimelineClip.label}`,
            );
          }
          setSelectedTrack(
            effectiveTargetVideoLayer === 0 ? "main" : "upper",
          );
        }
      }

      setPointerDrag(null);
      pointerDragRef.current = null;
      pointerDragPositionRef.current = null;
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
    getSnappedTimelineStart,
    mediaItems,
    placeMediaOnTimelineTrack,
    placeMediaBatchOnVideoLayer,
    pointerDrag,
    projectDuration,
  ]);

  const activePointerDragKey = pointerDrag
    ? `${pointerDrag.type}:${pointerDrag.id}`
    : null;

  useEffect(() => {
    if (!activePointerDragKey) return;

    let animationFrame = 0;
    const scrollWhileDragging = () => {
      const scrollArea = timelineScrollRef.current;
      const activeDrag = pointerDragRef.current;
      const pointerPosition = pointerDragPositionRef.current;
      if (!scrollArea || !activeDrag || !pointerPosition) return;
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
        pointerPosition.x >= laneViewportLeft - 64 &&
        pointerPosition.x <= bounds.right + 64;
      const isNearTimelineVertically =
        pointerPosition.y >= bounds.top - 64 &&
        pointerPosition.y <= bounds.bottom + 64;
      const horizontalDelta = isNearTimelineVertically
        ? getDragEdgeAutoScrollDelta(
            pointerPosition.x,
            laneViewportLeft,
            bounds.right,
            72,
            24,
          )
        : 0;
      const verticalDelta = isNearTimelineHorizontally
        ? getDragEdgeAutoScrollDelta(
            pointerPosition.y,
            bounds.top,
            bounds.bottom,
            72,
            20,
          )
        : 0;
      const previousLeft = scrollArea.scrollLeft;
      const previousTop = scrollArea.scrollTop;

      scrollArea.scrollLeft += horizontalDelta;
      scrollArea.scrollTop += verticalDelta;

      if (
        scrollArea.scrollLeft !== previousLeft ||
        scrollArea.scrollTop !== previousTop
      ) {
        const element = document.elementFromPoint(
          pointerPosition.x,
          pointerPosition.y,
        );
        const target = getVideoDropTargetFromElement(element);
        const draggedClip =
          activeDrag.type === "timeline"
            ? clipsRef.current.find((clip) => clip.id === activeDrag.id)
            : null;
        const isVideoDrag =
          activeDrag.type === "media" ||
          (draggedClip ? getVideoLayer(draggedClip) !== null : false);
        setVideoDropTarget(target && isVideoDrag ? target : null);
        setPointerDrag((currentDrag) =>
          currentDrag ? { ...currentDrag } : currentDrag,
        );
      }

      animationFrame = requestAnimationFrame(scrollWhileDragging);
    };

    animationFrame = requestAnimationFrame(scrollWhileDragging);
    return () => cancelAnimationFrame(animationFrame);
  }, [activePointerDragKey, getVideoDropTargetFromElement]);

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
    if (!audioFadeDrag) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const frameDelta = Math.round(
        (event.clientX - audioFadeDrag.startX) / timelineScale,
      );
      const targetClip = audioFadeDrag.originalClips.find(
        (clip) => clip.id === audioFadeDrag.clipId,
      );
      if (!targetClip) return;

      const nextFadeFrames = Math.max(
        0,
        Math.min(
          Math.max(0, targetClip.duration - 1),
          audioFadeDrag.startFadeFrames +
            (audioFadeDrag.edge === "in" ? frameDelta : -frameDelta),
        ),
      );
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipAudioFadeById(
          audioFadeDrag.originalClips,
          audioFadeDrag.clipId,
          audioFadeDrag.edge === "in"
            ? { fadeInFrames: nextFadeFrames }
            : { fadeOutFrames: nextFadeFrames },
        ),
      }));
    };

    const handlePointerUp = () => {
      setTimelineHistory((currentHistory) => ({
        past: [...currentHistory.past, audioFadeDrag.originalClips],
        present: currentHistory.present,
        future: [],
      }));
      setAudioFadeDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [audioFadeDrag, timelineScale]);

  useEffect(() => {
    if (!audioVolumeDrag) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const decibelDelta =
        ((audioVolumeDrag.startY - event.clientY) /
          Math.max(1, audioVolumeDrag.boundsHeight)) *
        (MAX_AUDIO_DB - MIN_AUDIO_DB);
      const nextVolume = decibelsToGain(
        gainToDecibels(audioVolumeDrag.startVolume) + decibelDelta,
      );
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipVolumeById(
          audioVolumeDrag.originalClips,
          audioVolumeDrag.clipId,
          nextVolume,
        ),
      }));
    };

    const handlePointerUp = () => {
      setTimelineHistory((currentHistory) => ({
        past: [...currentHistory.past, audioVolumeDrag.originalClips],
        present: currentHistory.present,
        future: [],
      }));
      setAudioVolumeDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [audioVolumeDrag]);

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

      const deltaX =
        ((event.clientX - adjustmentPanDrag.startX) / bounds.width) * 100;
      const deltaY =
        ((event.clientY - adjustmentPanDrag.startY) / bounds.height) * 100;
      const snappedOffset = snapPreviewOffsetToCenter({
        x: adjustmentPanDrag.originalAdjustment.positionX + deltaX,
        y: adjustmentPanDrag.originalAdjustment.positionY + deltaY,
      });
      setPreviewAlignmentGuides(snappedOffset.guides);
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setClipAdjustmentById(
          adjustmentPanDrag.originalClips,
          adjustmentPanDrag.clipId,
          {
            positionX: snappedOffset.x,
            positionY: snappedOffset.y,
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
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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
    if (!previewScaleDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) =>
      updatePreviewScaleFromPointer(event);
    const finishScale = () => finishPreviewScale();

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishScale, { once: true });
    window.addEventListener("pointercancel", finishScale, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishScale);
      window.removeEventListener("pointercancel", finishScale);
    };
  }, [previewScaleDrag]);

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
    let animationFrame = 0;
    let pointerPosition = {
      x: textTimelineDrag.startX,
      y: textTimelineDrag.startY,
    };
    const moveClipToPointer = (clientX: number) => {
      if (
        !dragStarted &&
        Math.abs(clientX - textTimelineDrag.startX) <
          timelineDragActivationDistance
      ) {
        return;
      }
      dragStarted = true;
      const contentLeft =
        timelineContentRef.current?.getBoundingClientRect().left ??
        textTimelineDrag.contentLeft;
      const frameDelta = getStableTimelineFrameDelta(
        clientX,
        textTimelineDrag.startFrame,
        contentLeft,
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
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      pointerPosition = { x: event.clientX, y: event.clientY };
      moveClipToPointer(event.clientX);
    };
    const scrollWhileDragging = () => {
      const scrollArea = timelineScrollRef.current;
      if (scrollArea && dragStarted) {
        const bounds = scrollArea.getBoundingClientRect();
        const laneViewportLeft = Math.min(
          bounds.right,
          bounds.left + timelineOrigin,
        );
        const horizontalDelta = getDragEdgeAutoScrollDelta(
          pointerPosition.x,
          laneViewportLeft,
          bounds.right,
          72,
          24,
        );
        const verticalDelta = getDragEdgeAutoScrollDelta(
          pointerPosition.y,
          bounds.top,
          bounds.bottom,
          72,
          20,
        );
        const previousLeft = scrollArea.scrollLeft;
        const previousTop = scrollArea.scrollTop;
        scrollArea.scrollLeft += horizontalDelta;
        scrollArea.scrollTop += verticalDelta;
        if (
          scrollArea.scrollLeft !== previousLeft ||
          scrollArea.scrollTop !== previousTop
        ) {
          moveClipToPointer(pointerPosition.x);
        }
      }
      animationFrame = window.requestAnimationFrame(scrollWhileDragging);
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
      window.cancelAnimationFrame(animationFrame);
      setTextTimelineDrag(null);
    };

    animationFrame = window.requestAnimationFrame(scrollWhileDragging);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [projectDuration, textTimelineDrag]);

  useEffect(() => {
    if (!cutoutTimelineDrag) return;

    const originalClip = cutoutTimelineDrag.originalClips.find(
      (clip) => clip.id === cutoutTimelineDrag.clipId,
    );
    if (!originalClip?.cutout) return;

    let dragStarted = false;
    let animationFrame = 0;
    let pointerPosition = {
      x: cutoutTimelineDrag.startX,
      y: cutoutTimelineDrag.startY,
    };
    const moveClipToPointer = (clientX: number) => {
      if (
        !dragStarted &&
        Math.abs(clientX - cutoutTimelineDrag.startX) <
          timelineDragActivationDistance
      ) {
        return;
      }
      dragStarted = true;
      const contentLeft =
        timelineContentRef.current?.getBoundingClientRect().left ??
        cutoutTimelineDrag.contentLeft;
      const frameDelta = getStableTimelineFrameDelta(
        clientX,
        cutoutTimelineDrag.startFrame,
        contentLeft,
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
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      pointerPosition = { x: event.clientX, y: event.clientY };
      moveClipToPointer(event.clientX);
    };
    const scrollWhileDragging = () => {
      const scrollArea = timelineScrollRef.current;
      if (scrollArea && dragStarted) {
        const bounds = scrollArea.getBoundingClientRect();
        const laneViewportLeft = Math.min(
          bounds.right,
          bounds.left + timelineOrigin,
        );
        const horizontalDelta = getDragEdgeAutoScrollDelta(
          pointerPosition.x,
          laneViewportLeft,
          bounds.right,
          72,
          24,
        );
        const verticalDelta = getDragEdgeAutoScrollDelta(
          pointerPosition.y,
          bounds.top,
          bounds.bottom,
          72,
          20,
        );
        const previousLeft = scrollArea.scrollLeft;
        const previousTop = scrollArea.scrollTop;
        scrollArea.scrollLeft += horizontalDelta;
        scrollArea.scrollTop += verticalDelta;
        if (
          scrollArea.scrollLeft !== previousLeft ||
          scrollArea.scrollTop !== previousTop
        ) {
          moveClipToPointer(pointerPosition.x);
        }
      }
      animationFrame = window.requestAnimationFrame(scrollWhileDragging);
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
      window.cancelAnimationFrame(animationFrame);
      setCutoutTimelineDrag(null);
    };

    animationFrame = window.requestAnimationFrame(scrollWhileDragging);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.cancelAnimationFrame(animationFrame);
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

      const snappedPosition = snapPreviewPositionToCenter({ x, y });
      setPreviewAlignmentGuides(snappedPosition.guides);
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: moveTextOverlay(
          textPreviewDrag.originalClips,
          textPreviewDrag.clipId,
          snappedPosition,
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
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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

      const snappedPosition = snapPreviewPositionToCenter({ x, y });
      setPreviewAlignmentGuides(snappedPosition.guides);
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: moveCaptionOverlay(
          captionPreviewDrag.originalClips,
          captionPreviewDrag.clipId,
          snappedPosition,
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
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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
    if (!captionRotateDrag) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      setTimelineHistory((currentHistory) => ({
        ...currentHistory,
        present: setCaptionStyleById(
          captionRotateDrag.originalClips,
          captionRotateDrag.clipId,
          {
            rotation: getManualRotationAngle(
              captionRotateDrag.centerX,
              captionRotateDrag.centerY,
              event.clientX,
              event.clientY,
              captionRotateDrag.rotationOffset,
            ),
          },
        ),
      }));
    };

    const finishRotate = () => {
      setTimelineHistory((currentHistory) =>
        currentHistory.present === captionRotateDrag.originalClips
          ? currentHistory
          : {
              past: [...currentHistory.past, captionRotateDrag.originalClips],
              present: currentHistory.present,
              future: [],
            },
      );
      setCaptionRotateDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishRotate, { once: true });
    window.addEventListener("pointercancel", finishRotate, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishRotate);
      window.removeEventListener("pointercancel", finishRotate);
    };
  }, [captionRotateDrag]);

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
        const snappedPosition = snapPreviewPositionToCenter({
          x: originalTransform.x + (deltaX / bounds.width) * 100,
          y: originalTransform.y + (deltaY / bounds.height) * 100,
        });
        setPreviewAlignmentGuides(snappedPosition.guides);
        nextTransform = movePreviewTransform(originalTransform, {
          x: Math.max(0, Math.min(100, snappedPosition.x)),
          y: Math.max(0, Math.min(100, snappedPosition.y)),
        });
      } else if (
        stickerInteraction.mode === "resize" &&
        stickerInteraction.handle
      ) {
        const handleVectors: Record<
          CaptionResizeHandle,
          { x: number; y: number }
        > = {
          "top-left": { x: -1, y: -1 },
          top: { x: 0, y: -1 },
          "top-right": { x: 1, y: -1 },
          right: { x: 1, y: 0 },
          "bottom-right": { x: 1, y: 1 },
          bottom: { x: 0, y: 1 },
          "bottom-left": { x: -1, y: 1 },
          left: { x: -1, y: 0 },
        };
        const vector = handleVectors[stickerInteraction.handle];
        const radians = (originalTransform.rotation * Math.PI) / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        const localDeltaX = deltaX * cosine + deltaY * sine;
        const localDeltaY = -deltaX * sine + deltaY * cosine;
        const startScaleX = originalTransform.scaleX ?? originalTransform.scale;
        const startScaleY = originalTransform.scaleY ?? originalTransform.scale;
        const startWidth = stickerInteraction.baseWidth * startScaleX;
        const startHeight = stickerInteraction.baseHeight * startScaleY;
        const nextWidth =
          vector.x === 0
            ? startWidth
            : Math.max(
                stickerInteraction.baseWidth * 0.2,
                Math.min(
                  stickerInteraction.baseWidth * 4,
                  startWidth + vector.x * localDeltaX,
                ),
              );
        const nextHeight =
          vector.y === 0
            ? startHeight
            : Math.max(
                stickerInteraction.baseHeight * 0.2,
                Math.min(
                  stickerInteraction.baseHeight * 4,
                  startHeight + vector.y * localDeltaY,
                ),
              );
        const localShiftX = (vector.x * (nextWidth - startWidth)) / 2;
        const localShiftY = (vector.y * (nextHeight - startHeight)) / 2;
        const worldShiftX = localShiftX * cosine - localShiftY * sine;
        const worldShiftY = localShiftX * sine + localShiftY * cosine;
        nextTransform = {
          ...originalTransform,
          scale: 1,
          scaleX: nextWidth / stickerInteraction.baseWidth,
          scaleY: nextHeight / stickerInteraction.baseHeight,
          x: Math.max(
            0,
            Math.min(
              100,
              originalTransform.x +
                (worldShiftX / stickerInteraction.previewWidth) * 100,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              100,
              originalTransform.y +
                (worldShiftY / stickerInteraction.previewHeight) * 100,
            ),
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
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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
        const snappedPosition = snapPreviewPositionToCenter({
          x: originalTransform.x + (deltaX / bounds.width) * 100,
          y: originalTransform.y + (deltaY / bounds.height) * 100,
        });
        setPreviewAlignmentGuides(snappedPosition.guides);
        nextTransform = movePreviewTransform(originalTransform, {
          x: Math.max(0, Math.min(100, snappedPosition.x)),
          y: Math.max(0, Math.min(100, snappedPosition.y)),
        });
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
          rotation: getManualRotationAngle(
            cutoutInteraction.centerX,
            cutoutInteraction.centerY,
            event.clientX,
            event.clientY,
            cutoutInteraction.rotationOffset,
          ),
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
      setPreviewAlignmentGuides({ horizontal: false, vertical: false });
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
    setPreviewMediaGain(
      video,
      previewMode === "media"
        ? mediaPreviewVolume
        : previewVideoMuted
          ? 0
          : previewVolume,
    );
    video.muted = previewMode === "media" ? false : previewVideoMuted;

    if (previewSource?.src !== previewSourceRef.current) {
      previewSourceRef.current = previewSource?.src ?? null;
    }

    const desiredTime =
      previewMode === "timeline"
        ? topVisibleVideoClip
          ? Math.max(
              0,
              getClipSourceTime(topVisibleVideoClip, timelinePreviewFrame, fps),
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
    timelinePreviewFrame,
    previewSource?.src,
    previewSpeed,
    previewVolume,
    previewVideoMuted,
    previewMode,
    setPreviewMediaGain,
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
        releasePreviewMediaGain(video);
        previewLayerVideoRefs.current.delete(clipId);
        continue;
      }

      const isActive = activeIds.has(clipId);
      const transitionPresentation = getClipTransitionPresentation(
        clips,
        clipId,
        timelinePreviewFrame,
      );
      const participatesInTransition =
        transitionPresentation.opacity !== 1 ||
        transitionPresentation.translateX !== 0 ||
        transitionPresentation.scale !== 1;
      const previewFrame = isActive
        ? timelinePreviewFrame
        : timelinePreviewFrame < videoClip.start
          ? videoClip.start
          : videoClip.start + videoClip.duration - 1;
      const videoMuted =
        !isActive ||
        (videoClip.volume ?? 1) === 0 ||
        shouldMuteVideoNativeAudio(clips, timelinePreviewFrame, clipId);
      const desiredTime = Math.max(
        0,
        getClipSourceTime(videoClip, previewFrame, fps),
      );
      const seekTolerance = isPreviewPlaying && isActive ? 0.45 : 0.04;

      video.playbackRate = videoClip.speed ?? 1;
      setPreviewMediaGain(
        video,
        videoMuted
          ? 0
          : (videoClip.volume ?? 1) *
              getClipAudioFadeMultiplier(videoClip, timelinePreviewFrame),
      );
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
    releasePreviewMediaGain,
    setPreviewMediaGain,
    timelinePreviewFrame,
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
        releasePreviewMediaGain(audio);
        previewAudioRefs.current.delete(clipId);
        continue;
      }

      const desiredTime = Math.max(
        0,
        getClipSourceTime(audioClip, playheadFrame, fps),
      );
      const seekTolerance = isPreviewPlaying ? 0.45 : 0.04;
      audio.playbackRate = audioClip.speed ?? 1;
      setPreviewMediaGain(
        audio,
        (audioClip.volume ?? 1) *
          getClipAudioFadeMultiplier(audioClip, playheadFrame),
      );
      if (audio.readyState === 0) {
        if (audio.dataset.timelineLoadRequested !== "true") {
          audio.dataset.timelineLoadRequested = "true";
          audio.load();
        }
        continue;
      }
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
  }, [
    isPreviewPlaying,
    playbackAudioClips,
    playheadFrame,
    releasePreviewMediaGain,
    setPreviewMediaGain,
  ]);

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
    if (previewMode !== "timeline" || pointerDrag || trimDrag) {
      return;
    }

    const scrollArea = timelineScrollRef.current;
    if (!scrollArea) return;

    const nextScrollLeft = Math.max(0, playheadFrame * timelineScale);
    if (Math.abs(nextScrollLeft - scrollArea.scrollLeft) < 1) return;

    const animationFrame = window.requestAnimationFrame(() => {
      suppressNextTimelineScrollPlayheadFollow();
      scrollArea.scrollLeft = nextScrollLeft;
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    playheadFrame,
    pointerDrag,
    previewMode,
    suppressNextTimelineScrollPlayheadFollow,
    timelineScale,
    trimDrag,
  ]);

  return (
    <main
      className="editor-shell"
      ref={editorShellRef}
      style={
        {
          "--details-panel-width": `${workspaceLayout.detailsWidth}px`,
          "--preview-panel-width": `${workspaceLayout.previewWidth}px`,
          "--timeline-panel-height": `${workspaceLayout.timelineHeight}px`,
        } as CSSProperties
      }
    >
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
        </nav>
        <div className="project-actions">
          <span
            className={`save-state save-state-${saveState}`}
            role="status"
            aria-live="polite"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "unsaved"
                ? "Unsaved changes"
                : "Saved"}
          </span>
          {projectStatus ? (
            <span className="project-status" role="status">
              {projectStatus}
            </span>
          ) : null}
          <button
            className="shortcut-help-button"
            type="button"
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts"
            onClick={() => setIsShortcutHelpOpen(true)}
          >
            ?
          </button>
          <button
            className="secondary-action-button workspace-reset-button"
            type="button"
            title="Reset panel sizes for this screen"
            aria-label="Reset workspace layout"
            onClick={resetWorkspaceLayout}
          >
            Reset layout
          </button>
          {isExporting ? (
            <button
              className="cancel-export-button"
              type="button"
              onClick={cancelProjectExport}
            >
              Cancel
            </button>
          ) : null}
          <label className="export-mode-control">
            <span>Export quality</span>
            <select
              aria-label="Export quality"
              disabled={isExporting}
              value={exportMode}
              onChange={(event) =>
                setExportMode(event.target.value === "hd" ? "hd" : "fast")
              }
            >
              <option value="fast">Fast 540p</option>
              <option value="hd">HD 720p</option>
            </select>
          </label>
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
        <aside
          className={`media-panel ${mediaSelectionBox?.activated ? "is-selecting-media" : ""}`}
          onPointerDown={startMediaSelection}
          onPointerMove={moveMediaSelection}
          onPointerUp={finishMediaSelection}
          onPointerCancel={finishMediaSelection}
          onLostPointerCapture={() => {
            mediaSelectionBoxRef.current = null;
            setMediaSelectionBox(null);
          }}
        >
          <div
            className={`media-library ${mediaSelectionBox?.activated ? "is-selecting-media" : ""}`}
            ref={mediaLibraryRef}
          >
            {mediaSelectionBox?.activated ? (
              <div
                className="media-selection-box"
                aria-hidden="true"
                style={{
                  left: Math.min(
                    mediaSelectionBox.startX,
                    mediaSelectionBox.currentX,
                  ),
                  top: Math.min(
                    mediaSelectionBox.startY,
                    mediaSelectionBox.currentY,
                  ),
                  width: Math.abs(
                    mediaSelectionBox.currentX - mediaSelectionBox.startX,
                  ),
                  height: Math.abs(
                    mediaSelectionBox.currentY - mediaSelectionBox.startY,
                  ),
                }}
              />
            ) : null}
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

                <div
                  className="media-grid"
                  ref={mediaGridRef}
                  aria-label="Imported media"
                >
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
                      data-media-id={mediaItem.id}
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
                            event.shiftKey,
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
                <div
                  className="sticker-library-sections"
                  aria-label="Sticker library"
                >
                  {Array.from(
                    stickerItems.reduce((sections, stickerItem) => {
                      const category = stickerItem.category ?? "Stickers";
                      const items = sections.get(category) ?? [];
                      items.push(stickerItem);
                      sections.set(category, items);
                      return sections;
                    }, new Map<string, StickerItem[]>()),
                  ).map(([category, items]) => {
                    const isExpanded =
                      expandedStickerSections.includes(category);

                    return (
                      <section
                        className="sticker-library-section"
                        key={category}
                      >
                        <div className="sticker-library-section-header">
                          <h3>{category}</h3>
                          <button
                            type="button"
                            className="sticker-view-all-button"
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpandedStickerSections((currentSections) =>
                                currentSections.includes(category)
                                  ? currentSections.filter(
                                      (section) => section !== category,
                                    )
                                  : [...currentSections, category],
                              )
                            }
                          >
                            {isExpanded ? "Show less" : "View all"}
                          </button>
                        </div>
                        <div
                          className={`sticker-grid ${
                            isExpanded ? "expanded-sticker-grid" : ""
                          }`}
                        >
                          {items.map((stickerItem) => (
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
                      </section>
                    );
                  })}
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
                  onPointerDown={focusTextareaOnPointerDown}
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
                <section className="text-preset-section">
                  <div className="text-preset-heading">
                    <strong>Text styles</strong>
                    <span>
                      {selectedTextClip
                        ? "Apply to selected"
                        : "Add at playhead"}
                    </span>
                  </div>
                  <div className="text-preset-grid" aria-label="Text styles">
                    {textStylePresets.map((preset) => {
                      const isActive = Boolean(
                        selectedTextClip?.text &&
                        Object.entries(preset.style).every(
                          ([property, value]) =>
                            selectedTextClip.text?.[
                              property as keyof typeof preset.style
                            ] === value,
                        ),
                      );
                      return (
                        <button
                          className={`text-preset-card ${
                            isActive ? "active-text-preset" : ""
                          }`}
                          key={preset.id}
                          type="button"
                          aria-label={`Apply ${preset.label} text style`}
                          aria-pressed={isActive}
                          onClick={() => applyTextStylePreset(preset)}
                        >
                          <span
                            className="text-preset-preview"
                            style={{
                              color: preset.style.color,
                              fontFamily: preset.style.fontFamily,
                              fontWeight: preset.style.fontWeight,
                              fontStyle: preset.style.fontStyle,
                              ...getTextEffectStyle(preset.style.effect),
                            }}
                          >
                            {preset.sample}
                          </span>
                          <small>{preset.label}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
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
                      <div className="transcript-segment" key={clip.id}>
                        <div className="transcript-sentence-line">
                          <span className="transcript-sentence-time">
                            {formatTimelineClock(clip.start, fps)}
                          </span>
                          <TranscriptSentenceEditor
                            content={clip.caption?.content ?? ""}
                            timestamp={formatTimelineClock(clip.start, fps)}
                            onDeleteWords={(wordIndexes) =>
                              removeTranscriptWords(clip.id, wordIndexes)
                            }
                          />
                        </div>
                        <button
                          className="transcript-remove-sentence"
                          type="button"
                          aria-label={`Remove sentence: ${clip.caption?.content ?? clip.label}`}
                          title="Remove sentence with matching video and audio"
                          onClick={() => removeTranscriptSentence(clip.id)}
                        >
                          🗑
                        </button>
                      </div>
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
                          onPointerDown={focusTextareaOnPointerDown}
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
                <button
                  aria-label="Remove animation"
                  className={`visual-none-option ${
                    selectedClipAnimation.preset === "none"
                      ? "active-visual-option"
                      : ""
                  }`}
                  type="button"
                  disabled={!canEditSelectedVisual}
                  onClick={() => updateSelectedClipAnimation("none")}
                >
                  <span aria-hidden="true">×</span>
                  <strong>None</strong>
                  <em>Remove animation</em>
                </button>
                <div className="animation-category-list">
                  {animationCategories.map((category) => (
                    <section className="animation-category" key={category.id}>
                      <div className="animation-category-heading">
                        <strong>{category.label}</strong>
                        <span>{category.optionIds.length}</span>
                      </div>
                      <div className="animation-category-row">
                        {category.optionIds.map((optionId) => {
                          const option = animationOptions.find(
                            (candidate) => candidate.id === optionId,
                          );
                          if (!option) {
                            return null;
                          }
                          const isFavorite = favoriteAnimationIds.includes(
                            option.id,
                          );
                          return (
                            <div
                              className={`animation-option-card animation-thumbnail-card ${
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
                                aria-label={`Apply ${option.label} animation`}
                                onClick={() =>
                                  updateSelectedClipAnimation(option.id)
                                }
                              >
                                <span
                                  className={`animation-option-preview animation-preview-${option.id}`}
                                  aria-hidden="true"
                                >
                                  <span />
                                </span>
                                <span className="animation-option-label">
                                  {option.label}
                                </span>
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
                                  onClick={() =>
                                    toggleFavoriteAnimation(option.id)
                                  }
                                >
                                  {isFavorite ? "\u2665" : "\u2661"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
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
                <button
                  aria-label="Remove effect"
                  className={`visual-none-option ${
                    selectedClipEffect === "none" ? "active-visual-option" : ""
                  }`}
                  type="button"
                  disabled={!canEditSelectedVisual}
                  onClick={() => updateSelectedClipEffect("none")}
                >
                  <span aria-hidden="true">×</span>
                  <strong>None</strong>
                  <em>Remove effect</em>
                </button>
                <div className="effect-library" aria-label="Video effects">
                  {effectSections.map((section) => {
                    const availableOptions = section.ids
                      .map((effectId) =>
                        effectOptions.find((option) => option.id === effectId),
                      )
                      .filter(
                        (option): option is (typeof effectOptions)[number] =>
                          Boolean(option),
                      );

                    return (
                      <section
                        className="effect-library-section"
                        key={section.label}
                      >
                        <h3>{section.label}</h3>
                        <div className="effect-card-grid">
                          {availableOptions.map((option) => (
                            <button
                              aria-label={`Apply ${option.label} effect`}
                              className={
                                selectedClipEffect === option.id
                                  ? "effect-card active-visual-option"
                                  : "effect-card"
                              }
                              data-effect={option.id}
                              key={option.id}
                              type="button"
                              disabled={!canEditSelectedVisual}
                              onClick={() =>
                                updateSelectedClipEffect(option.id)
                              }
                            >
                              <EffectReferencePreview />
                              <strong>{option.label}</strong>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                  {clipControlTarget?.track === "cutout" ? (
                    <section className="effect-library-section">
                      <h3>Cutout lines</h3>
                      <div className="effect-card-grid">
                        {cutoutLinePresetOptions.map((preset) => {
                          const isActivePreset =
                            selectedClipEffect === preset.effect &&
                            selectedCutoutLineStyle === preset.style &&
                            selectedCutoutLineColor.toLowerCase() ===
                              preset.color.toLowerCase() &&
                            selectedCutoutLineWidth === preset.width;

                          return (
                            <button
                              aria-label={`Apply ${preset.label} cutout effect`}
                              className={
                                isActivePreset
                                  ? "effect-card cutout-line-preset-card active-visual-option"
                                  : "effect-card cutout-line-preset-card"
                              }
                              data-line-preset={preset.id}
                              key={preset.id}
                              type="button"
                              disabled={!canEditSelectedVisual}
                              onClick={() =>
                                applySelectedCutoutLinePreset(preset)
                              }
                            >
                              <span
                                className="effect-card-preview cutout-line-preset-preview"
                                aria-hidden="true"
                              >
                                <i />
                              </span>
                              <strong>{preset.label}</strong>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                  {clipControlTarget?.track === "cutout" ? (
                    <section className="effect-library-section">
                      <h3>Cutout motion &amp; doodles</h3>
                      <div className="effect-card-grid">
                        {cutoutEffectOptions
                          .filter((option) =>
                            [
                              "moving-outline",
                              "moving-white-outline",
                              "neon-outline",
                              "hand-drawn",
                              "scribble",
                              "float",
                              "bounce",
                              "motion-trail",
                              "rainbow-edge",
                              "electric-glow",
                              "comic-pop",
                              "sway",
                              "flicker-outline",
                              "silhouette",
                            ].includes(option.id),
                          )
                          .map((option) => (
                            <button
                              aria-label={`Apply ${option.label} effect`}
                              className={
                                selectedClipEffect === option.id
                                  ? "effect-card active-visual-option"
                                  : "effect-card"
                              }
                              data-effect={option.id}
                              key={option.id}
                              type="button"
                              disabled={!canEditSelectedVisual}
                              onClick={() =>
                                updateSelectedClipEffect(option.id)
                              }
                            >
                              <EffectReferencePreview />
                              <strong>{option.label}</strong>
                            </button>
                          ))}
                      </div>
                    </section>
                  ) : null}
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
                {canEditSelectedCutoutLine ? (
                  <section
                    className="cutout-line-controls"
                    aria-label="Cutout line controls"
                  >
                    <div className="cutout-line-heading">
                      <strong>Object line</strong>
                      <span>Customize the selected cutout edge.</span>
                    </div>
                    <label className="cutout-line-color-control">
                      <span>Line color</span>
                      <input
                        aria-label="Cutout line color"
                        type="color"
                        value={selectedCutoutLineColor}
                        onChange={(event) =>
                          updateSelectedCutoutLineStyle({
                            color: event.currentTarget.value,
                          })
                        }
                      />
                    </label>
                    <label className="cutout-line-range-control">
                      <span>
                        Opacity <em>{selectedCutoutLineOpacity}%</em>
                      </span>
                      <input
                        aria-label="Cutout line opacity"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={selectedCutoutLineOpacity}
                        onChange={(event) =>
                          updateSelectedCutoutLineStyle({
                            opacity: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                    <label className="cutout-line-range-control">
                      <span>
                        Thickness <em>{selectedCutoutLineWidth}px</em>
                      </span>
                      <input
                        aria-label="Cutout line thickness"
                        type="range"
                        min={1}
                        max={12}
                        step={1}
                        value={selectedCutoutLineWidth}
                        onChange={(event) =>
                          updateSelectedCutoutLineStyle({
                            width: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                    <div className="cutout-line-style-control">
                      <span>Line style</span>
                      <div role="group" aria-label="Cutout line style">
                        {cutoutLineStyleOptions.map((option) => (
                          <button
                            aria-pressed={selectedCutoutLineStyle === option.id}
                            className={
                              selectedCutoutLineStyle === option.id
                                ? "active-cutout-line-style"
                                : ""
                            }
                            key={option.id}
                            type="button"
                            onClick={() =>
                              updateSelectedCutoutLineStyle({
                                style: option.id,
                              })
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : activeTool === "filters" ? (
              <div className="visual-tool-panel filter-tool-panel">
                <div className="filter-panel-heading">
                  <strong>Filters</strong>
                  <span>Select a video clip, then choose a look.</span>
                </div>
                <button
                  aria-label="Remove filter"
                  className={`visual-none-option ${
                    selectedClipFilter === "none" ? "active-visual-option" : ""
                  }`}
                  type="button"
                  disabled={!canEditSelectedVisual}
                  onClick={() => updateSelectedClipFilter("none")}
                >
                  <span aria-hidden="true">×</span>
                  <strong>None</strong>
                  <em>Restore original color</em>
                </button>
                <div className="filter-library" aria-label="Video filters">
                  {filterSections.map((section) => {
                    const availableOptions = section.ids
                      .map((filterId) =>
                        filterOptions.find((option) => option.id === filterId),
                      )
                      .filter(
                        (option): option is (typeof filterOptions)[number] =>
                          Boolean(option),
                      );

                    return (
                      <section
                        className="filter-library-section"
                        key={section.label}
                      >
                        <h3>{section.label}</h3>
                        <div className="filter-card-row">
                          {availableOptions.map((option) => (
                            <button
                              aria-label={`Apply ${option.label} filter`}
                              className={
                                selectedClipFilter === option.id
                                  ? "filter-card active-visual-option"
                                  : "filter-card"
                              }
                              data-filter={option.id}
                              key={option.id}
                              type="button"
                              disabled={!canEditSelectedVisual}
                              onClick={() =>
                                updateSelectedClipFilter(option.id)
                              }
                            >
                              <span
                                className="filter-card-preview"
                                aria-hidden="true"
                              >
                                {clipControlTarget?.src ? (
                                  isImageClip(clipControlTarget) ? (
                                    <Img
                                      src={resolveMediaSource(
                                        clipControlTarget.src,
                                      )}
                                      style={{
                                        filter: getClipFilterCss(option.id),
                                      }}
                                    />
                                  ) : (
                                    // eslint-disable-next-line @remotion/warn-native-media-tag
                                    <video
                                      src={resolveMediaSource(
                                        clipControlTarget.src,
                                      )}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      style={{
                                        filter: getClipFilterCss(option.id),
                                      }}
                                    />
                                  )
                                ) : (
                                  <span
                                    className="filter-card-placeholder"
                                    style={{
                                      filter: getClipFilterCss(option.id),
                                    }}
                                  />
                                )}
                              </span>
                              <strong title={option.label}>
                                {option.label}
                              </strong>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
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
                    onClick={resetSelectedClipAdjustment}
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
              <div className="audio-library-panel">
                <div className="library-actions audio-library-actions">
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
                {recordingError ? (
                  <div className="recording-error" role="alert">
                    {recordingError}
                  </div>
                ) : null}

                <div className="audio-library-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={audioLibraryTab === "music"}
                    className={audioLibraryTab === "music" ? "active" : ""}
                    onClick={() => {
                      setAudioLibraryTab("music");
                      setAudioLibraryCategory(null);
                      setAudioLibraryQuery("");
                      setShowAllAudioLibraryItems(false);
                    }}
                  >
                    Music
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={audioLibraryTab === "sound-effects"}
                    className={
                      audioLibraryTab === "sound-effects" ? "active" : ""
                    }
                    onClick={() => {
                      setAudioLibraryTab("sound-effects");
                      setAudioLibraryCategory(null);
                      setAudioLibraryQuery("");
                      setShowAllAudioLibraryItems(false);
                    }}
                  >
                    Sound effects
                  </button>
                </div>

                <label className="audio-library-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={audioLibraryQuery}
                    placeholder={
                      audioLibraryTab === "music"
                        ? "Search music"
                        : "Search sound effects"
                    }
                    aria-label={
                      audioLibraryTab === "music"
                        ? "Search music"
                        : "Search sound effects"
                    }
                    onChange={(event) =>
                      updateAudioLibrarySearch(event.currentTarget.value)
                    }
                  />
                  {!hasAudioLibrarySearch ? (
                    <span
                      className="audio-filter-icon"
                      title="Filter by category"
                    >
                      ≡
                    </span>
                  ) : null}
                </label>

                {!hasAudioLibrarySearch ? (
                  <>
                    <div
                      className="audio-search-chips"
                      aria-label="Quick searches"
                    >
                      {(audioLibraryTab === "music"
                        ? ["background music", "phonk", "happy"]
                        : ["vine boom", "boom", "explosion"]
                      ).map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          className={
                            audioLibraryQuery === keyword ? "active" : ""
                          }
                          onClick={() => updateAudioLibrarySearch(keyword)}
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>

                    <section className="audio-library-categories">
                      <header>
                        <strong>Categories</strong>
                        <button
                          type="button"
                          onClick={() => {
                            setAudioLibraryCategory(null);
                            setAudioLibraryQuery("");
                            setShowAllAudioLibraryItems((current) => !current);
                          }}
                        >
                          {showAllAudioLibraryItems ? "Show less" : "View all"}
                        </button>
                      </header>
                      <div className="audio-category-grid">
                        {audioLibraryCategories.map((category, index) => {
                          const categoryItem = activeAudioLibraryItems.find(
                            (item) => item.category === category,
                          );
                          return (
                            <button
                              key={category}
                              type="button"
                              className={
                                audioLibraryCategory === category
                                  ? "active"
                                  : ""
                              }
                              style={
                                {
                                  "--audio-category-color":
                                    categoryItem?.accent ?? "#476778",
                                  "--audio-category-index": index,
                                } as CSSProperties
                              }
                              onClick={() =>
                                setAudioLibraryCategory((current) =>
                                  current === category ? null : category,
                                )
                              }
                            >
                              <span aria-hidden="true">
                                {audioLibraryTab === "music" ? "♪" : "✦"}
                              </span>
                              <strong>{category}</strong>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </>
                ) : null}

                <section className="audio-library-results">
                  <header>
                    <strong>
                      {audioLibraryCategory ||
                        (audioLibraryQuery
                          ? "Results"
                          : showAllAudioLibraryItems
                            ? audioLibraryTab === "music"
                              ? "All music"
                              : "All sound effects"
                            : "Recommended")}
                    </strong>
                    <span>{filteredAudioLibraryItems.length}</span>
                  </header>
                  <div className="audio-result-list">
                    {filteredAudioLibraryItems.map((item) => (
                      <button
                        className="audio-result-item"
                        key={item.id}
                        type="button"
                        title={`Add ${item.label} at the playhead`}
                        aria-label={`Add ${item.label} at the playhead`}
                        disabled={addingAudioLibraryItemId !== null}
                        onClick={() => void addAudioLibraryItem(item)}
                      >
                        <span
                          className="audio-result-art"
                          style={{ background: item.accent }}
                          aria-hidden="true"
                        >
                          {item.kind === "music" ? "♪" : "✦"}
                        </span>
                        <span className="audio-result-copy">
                          <strong title={item.label}>{item.label}</strong>
                          <small>
                            {formatAudioLibraryDuration(item.durationSeconds)} ·{" "}
                            {item.creator}
                          </small>
                        </span>
                        <span className="audio-add-button" aria-hidden="true">
                          {addingAudioLibraryItemId === item.id ? "…" : "+"}
                        </span>
                      </button>
                    ))}
                    {filteredAudioLibraryItems.length === 0 ? (
                      <p className="audio-library-empty">
                        No matches. Try another search or choose View all.
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            )}
          </div>
        </aside>

        <button
          className="workspace-resizer workspace-resizer-details"
          type="button"
          role="separator"
          aria-label="Resize controls and media panels"
          aria-orientation="vertical"
          title="Drag to resize. Double-click to reset."
          onPointerDown={(event) => startWorkspaceResize("details", event)}
          onDoubleClick={() => resetWorkspaceResize("details")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              nudgeWorkspaceResize(
                "details",
                event.key === "ArrowLeft" ? -12 : 12,
              );
            }
          }}
        >
          <span aria-hidden="true">↔</span>
        </button>

        <section className="preview-panel">
          <div className="preview-shell">
            <div
              className="preview-window"
              ref={previewWindowRef}
              onPointerDown={(event) => {
                setVideoQuickMenu(null);
                const target = event.target;
                if (
                  target instanceof HTMLElement &&
                  target.closest(
                    "button, input, textarea, select, [contenteditable='true']",
                  )
                ) {
                  return;
                }
                clearEditorSelection();
                setSelectedPreviewFrameBase(null);
                setCutoutInteraction(null);
              }}
              onMouseLeave={closeMediaPreviewVolumeIfInactive}
              onBlurCapture={handleMediaPreviewBlur}
            >
              {isTimelinePreview
                ? renderPreviewAlignmentGuides(
                    previewAlignmentGuides,
                    useWhitePreviewAlignmentGuides ? "white" : "yellow",
                  )
                : null}
              {previewSource?.src || isTimelinePreview ? (
                <>
                  {isTimelinePreview ? (
                    <Fragment>
                      {activeVideoLayers
                        .filter((videoClip) => isImageClip(videoClip))
                        .map((videoClip) => (
                          <Img
                            key={videoClip.id}
                            className={`preview-image preview-layer-image ${
                              activeTool === "adjustment" &&
                              clipControlTarget?.id === videoClip.id
                                ? "preview-layer-adjustable"
                                : ""
                            }`}
                            data-video-layer={getVideoLayer(videoClip)}
                            src={resolveMediaSource(videoClip.src ?? "")}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (
                                activeTool === "adjustment" &&
                                clipControlTarget?.id === videoClip.id
                              ) {
                                startManualAdjustmentPan(event);
                              }
                            }}
                            onClick={(event) =>
                              showPreviewVideoControls(
                                event,
                                videoClip,
                                event.currentTarget.naturalWidth,
                                event.currentTarget.naturalHeight,
                              )
                            }
                            style={{
                              ...getClipFrameStyle(
                                videoClip,
                                timelinePreviewFrame,
                              ),
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
                            timelinePreviewFrame,
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
                            timelinePreviewFrame,
                            videoClip.id,
                          );

                        return (
                          // eslint-disable-next-line @remotion/warn-native-media-tag
                          <video
                            key={videoClip.id}
                            className={`preview-video preview-layer-video ${
                              activeTool === "adjustment" &&
                              clipControlTarget?.id === videoClip.id
                                ? "preview-layer-adjustable"
                                : ""
                            }`}
                            data-video-layer={getVideoLayer(videoClip)}
                            src={resolveMediaSource(videoClip.src ?? "")}
                            muted={videoMuted}
                            playsInline
                            preload="auto"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (
                                activeTool === "adjustment" &&
                                clipControlTarget?.id === videoClip.id
                              ) {
                                startManualAdjustmentPan(event);
                              }
                            }}
                            onClick={(event) =>
                              showPreviewVideoControls(
                                event,
                                videoClip,
                                event.currentTarget.videoWidth,
                                event.currentTarget.videoHeight,
                              )
                            }
                            onLoadedMetadata={(event) => {
                              reconcileTimelineClipSourceDuration(
                                videoClip,
                                event,
                              );
                              const loadedPreviewFrame = activeVideoClipIds.has(
                                videoClip.id,
                              )
                                ? timelinePreviewFrame
                                : timelinePreviewFrame < videoClip.start
                                  ? videoClip.start
                                  : videoClip.start + videoClip.duration - 1;
                              const loadedPreviewTime = Math.max(
                                0,
                                getClipSourceTime(
                                  videoClip,
                                  loadedPreviewFrame,
                                  fps,
                                ),
                              );
                              if (
                                Number.isFinite(loadedPreviewTime) &&
                                Math.abs(
                                  event.currentTarget.currentTime -
                                    loadedPreviewTime,
                                ) > 0.01
                              ) {
                                event.currentTarget.currentTime =
                                  loadedPreviewTime;
                              }
                            }}
                            onError={() =>
                              recoverUnavailableVideo(videoClip.id)
                            }
                            style={{
                              ...getClipFrameStyle(
                                videoClip,
                                timelinePreviewFrame,
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
                                releasePreviewMediaGain(
                                  previewLayerVideoRefs.current.get(
                                    videoClip.id,
                                  ),
                                );
                                previewLayerVideoRefs.current.delete(
                                  videoClip.id,
                                );
                              }
                            }}
                          />
                        );
                      })}
                      {selectedClip &&
                      (selectedClip.track === "main" ||
                        selectedClip.track === "upper") &&
                      selectedPreviewFrameBase?.clipId === selectedClip.id &&
                      activeVideoLayers.some(
                        (activeClip) => activeClip.id === selectedClip.id,
                      )
                        ? (() => {
                            const adjustment = {
                              ...defaultClipAdjustment,
                              ...selectedClip.adjustment,
                            };
                            const transitionPresentation =
                              getClipTransitionPresentation(
                                clips,
                                selectedClip.id,
                                timelinePreviewFrame,
                              );
                            const framePresentation = getClipFrameStyle(
                              selectedClip,
                              timelinePreviewFrame,
                              transitionPresentation,
                            );

                            return (
                              <div
                                className="preview-video-transform-shell"
                                style={{
                                  transform: `translate(${adjustment.positionX}%, ${adjustment.positionY}%) scale(${adjustment.scale}) rotate(${adjustment.rotation}deg)`,
                                  translate: framePresentation.translate,
                                  scale: framePresentation.scale,
                                  rotate: framePresentation.rotate,
                                }}
                              >
                                <div
                                  className="preview-video-transform-frame"
                                  style={{
                                    width: `${selectedPreviewFrameBase.widthPercent}%`,
                                    height: `${selectedPreviewFrameBase.heightPercent}%`,
                                  }}
                                  onPointerDown={startManualAdjustmentPan}
                                >
                                  {[
                                    "top-left",
                                    "top-right",
                                    "bottom-right",
                                    "bottom-left",
                                  ].map((corner) => (
                                    <button
                                      aria-label={`Resize video from ${corner}`}
                                      className={`preview-video-resize-handle preview-video-resize-handle-${corner}`}
                                      key={corner}
                                      type="button"
                                      onPointerDown={startPreviewScale}
                                      onPointerMove={
                                        updatePreviewScaleFromPointer
                                      }
                                      onPointerUp={finishPreviewScale}
                                      onPointerCancel={finishPreviewScale}
                                    />
                                  ))}
                                  {["top", "right", "bottom", "left"].map(
                                    (edge) => (
                                      <button
                                        aria-label={`Resize video from ${edge} edge`}
                                        className={`preview-video-edge-handle preview-video-edge-handle-${edge}`}
                                        key={edge}
                                        type="button"
                                        onPointerDown={startPreviewScale}
                                        onPointerMove={
                                          updatePreviewScaleFromPointer
                                        }
                                        onPointerUp={finishPreviewScale}
                                        onPointerCancel={finishPreviewScale}
                                      />
                                    ),
                                  )}
                                  <button
                                    aria-label="Rotate video"
                                    className="preview-video-rotate-handle"
                                    type="button"
                                    onPointerDown={startManualRotate}
                                  >
                                    {"\u21bb"}
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        : null}
                    </Fragment>
                  ) : previewSource?.src && isImageClip(previewSource) ? (
                    <Img
                      className="preview-image"
                      src={resolveMediaSource(previewSource.src)}
                      style={{
                        ...getClipFrameStyle(undefined, timelinePreviewFrame),
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
                        ...getClipFrameStyle(undefined, timelinePreviewFrame),
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
                          preload="auto"
                          muted={false}
                          onLoadedMetadata={(event) => {
                            if (isPreviewPlaying) {
                              const audio = event.currentTarget;
                              void audio.play().catch(() => undefined);
                            }
                          }}
                          onCanPlay={(event) => {
                            if (isPreviewPlaying) {
                              const audio = event.currentTarget;
                              void audio.play().catch(() => undefined);
                            }
                          }}
                          ref={(audio) => {
                            if (audio) {
                              previewAudioRefs.current.set(audioClip.id, audio);
                            } else {
                              releasePreviewMediaGain(
                                previewAudioRefs.current.get(audioClip.id),
                              );
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
                        const subjectBounds = transform.subjectBounds;
                        const controlBoxStyle: CSSProperties = subjectBounds
                          ? {
                              left: `${subjectBounds.left}%`,
                              top: `${subjectBounds.top}%`,
                              width: `${subjectBounds.width}%`,
                              height: `${subjectBounds.height}%`,
                            }
                          : { inset: 0 };
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
                          timelinePreviewFrame,
                        );
                        const cutoutAnimation = getClipAnimationPresentation(
                          cutoutClip,
                          timelinePreviewFrame,
                        );
                        const cutoutChroma = getCutoutChromaKeyStyle(transform);
                        const cutoutFilters = [
                          cutoutChroma.filter,
                          cutoutVisual.filter,
                        ]
                          .filter((value) => value && value !== "none")
                          .join(" ");
                        const cutoutVisualTransformStyle: CSSProperties = {
                          translate: `${
                            cutoutVisual.translateX + cutoutAnimation.translateX
                          }% ${
                            cutoutVisual.translateY + cutoutAnimation.translateY
                          }%`,
                          scale: cutoutVisual.scale * cutoutAnimation.scale,
                          rotate: `${cutoutVisual.rotate}deg`,
                        };
                        const cutoutMediaStyle: CSSProperties = {
                          ...maskStyle,
                          ...cutoutChroma,
                          filter: cutoutFilters || undefined,
                          opacity:
                            cutoutVisual.opacity * cutoutAnimation.opacity,
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
                            <div
                              className="preview-cutout-visual"
                              style={cutoutVisualTransformStyle}
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
                                        timelinePreviewFrame,
                                        fps,
                                      ),
                                    );
                                    if (
                                      Math.abs(
                                        video.currentTime - desiredTime,
                                      ) > 0.12
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
                                  src={resolveMediaSource(
                                    transform.originalSrc,
                                  )}
                                  alt=""
                                  aria-hidden="true"
                                  draggable={false}
                                  style={restoreMaskStyle}
                                />
                              ) : null}
                              {isSelected ? (
                                <div
                                  className="cutout-control-box"
                                  style={controlBoxStyle}
                                >
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
                                </div>
                              ) : null}
                            </div>
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
                              ...(captionPreviewDrag?.clipId === captionClip.id
                                ? {
                                    width: `${captionPreviewDrag.width}px`,
                                    height: `${captionPreviewDrag.height}px`,
                                    maxWidth: "none",
                                  }
                                : {}),
                              color: captionDisplayColors.textColor,
                              fontSize: `${caption.fontSize}px`,
                              fontFamily: caption.fontFamily ?? "Inter",
                              fontWeight: caption.fontWeight ?? "900",
                              rotate: `${caption.rotation ?? 0}deg`,
                              background: captionDisplayColors.backgroundColor,
                              ...getTextEffectStyle(caption.effect ?? "shadow"),
                              ...getCaptionAnimationStyle(
                                caption,
                                captionClip,
                                timelinePreviewFrame,
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
                                  className="caption-rotate-handle"
                                  role="button"
                                  aria-label="Rotate caption"
                                  title="Drag to rotate caption"
                                  onPointerDown={(event) =>
                                    startCaptionRotateDrag(event, captionClip)
                                  }
                                >
                                  {"\u21bb"}
                                </span>
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
                        const stickerScaleX =
                          transform.scaleX ?? transform.scale;
                        const stickerScaleY =
                          transform.scaleY ?? transform.scale;
                        const fixedStickerControlScale: CSSProperties = {
                          scale: `${1 / Math.max(0.08, stickerScaleX)} ${1 / Math.max(0.08, stickerScaleY)}`,
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
                              scale: `${stickerScaleX} ${stickerScaleY}`,
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
                              <Fragment>
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
                                >
                                  {"\u21bb"}
                                </button>
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
                                    className={`sticker-resize-handle sticker-resize-handle-${handle}`}
                                    key={handle}
                                    role="presentation"
                                    style={fixedStickerControlScale}
                                    onPointerDown={(event) =>
                                      startStickerInteraction(
                                        event,
                                        stickerClip,
                                        "resize",
                                        handle,
                                      )
                                    }
                                  />
                                ))}
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
                              </Fragment>
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
                          timelinePreviewFrame,
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
                              ...(textPreviewDrag?.clipId === textClip.id
                                ? {
                                    width: `${textPreviewDrag.width}px`,
                                    height: `${textPreviewDrag.height}px`,
                                    maxWidth: "none",
                                    maxHeight: "none",
                                  }
                                : {}),
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
                                      timelinePreviewFrame,
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
                                          timelinePreviewFrame,
                                          currentWordIndex,
                                          wordCount,
                                        );
                                      const stars = getTextAnimationStars(
                                        textClip,
                                        timelinePreviewFrame,
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
                        <button
                          type="button"
                          className="media-preview-icon-button"
                          aria-label="Toggle fullscreen preview"
                          title="Fullscreen"
                          onClick={() => void togglePreviewFullscreen()}
                        >
                          ⛶
                        </button>
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
                    onPointerDown={focusTextareaOnPointerDown}
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
                <em>{formatVolumeDecibels(selectedClipVolume)}</em>
                <input
                  type="range"
                  min="0"
                  max={MAX_AUDIO_GAIN}
                  step="0.1"
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
              {canEditSelectedAudioFade ? (
                <>
                  <label>
                    <strong>Audio fade in</strong>
                    <em>{(selectedClipFadeInFrames / fps).toFixed(1)}s</em>
                    <input
                      aria-label="Audio fade in duration"
                      type="range"
                      min="0"
                      max={selectedClipDurationSeconds}
                      step="0.1"
                      value={selectedClipFadeInFrames / fps}
                      onChange={(event) =>
                        updateSelectedClipAudioFade(
                          "fadeInFrames",
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    <strong>Audio fade out</strong>
                    <em>{(selectedClipFadeOutFrames / fps).toFixed(1)}s</em>
                    <input
                      aria-label="Audio fade out duration"
                      type="range"
                      min="0"
                      max={selectedClipDurationSeconds}
                      step="0.1"
                      value={selectedClipFadeOutFrames / fps}
                      onChange={(event) =>
                        updateSelectedClipAudioFade(
                          "fadeOutFrames",
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                  </label>
                  {clipControlTarget &&
                  (clipControlTarget.track === "main" ||
                    clipControlTarget.track === "upper" ||
                    clipControlTarget.track === "cutout") &&
                  Boolean(clipControlTarget.src) &&
                  !isImageClip(clipControlTarget) &&
                  clipControlTarget.cutout?.mediaKind !== "image" &&
                  !clipControlTarget.audioDetached ? (
                    <button
                      className="audio-detach-button"
                      type="button"
                      onClick={detachSelectedClipAudio}
                    >
                      Extract audio from video
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </aside>
        <button
          className="workspace-resizer workspace-resizer-preview"
          type="button"
          role="separator"
          aria-label="Resize media and preview panels"
          aria-orientation="vertical"
          title="Drag to resize. Double-click to reset."
          onPointerDown={(event) => startWorkspaceResize("preview", event)}
          onDoubleClick={() => resetWorkspaceResize("preview")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              nudgeWorkspaceResize(
                "preview",
                event.key === "ArrowLeft" ? -12 : 12,
              );
            }
          }}
        >
          <span aria-hidden="true">↔</span>
        </button>
      </section>

      <section className="timeline-panel" aria-label="Timeline">
        <button
          className="workspace-resizer workspace-resizer-timeline"
          type="button"
          role="separator"
          aria-label="Resize timeline"
          aria-orientation="horizontal"
          title="Drag to resize. Double-click to reset."
          onPointerDown={(event) => startWorkspaceResize("timeline", event)}
          onDoubleClick={() => resetWorkspaceResize("timeline")}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              nudgeWorkspaceResize(
                "timeline",
                event.key === "ArrowUp" ? -12 : 12,
              );
            }
          }}
        >
          <span aria-hidden="true">↕</span>
        </button>
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
              className={`icon-tool-button preview-axis-tool ${
                isPreviewAxisVisible ? "is-active" : ""
              }`}
              type="button"
              aria-label={`${
                isPreviewAxisVisible ? "Turn off" : "Turn on"
              } preview playhead`}
              aria-pressed={isPreviewAxisVisible}
              title={`${
                isPreviewAxisVisible ? "Turn off" : "Turn on"
              } yellow preview playhead`}
              onClick={() => {
                const nextVisible = !isPreviewAxisVisible;
                setIsPreviewAxisVisible(nextVisible);
                setTimelineHoverFrame(nextVisible ? playheadFrame : null);
              }}
            >
              <span className="preview-axis-tool-icon" aria-hidden="true">
                <span />
                <span />
              </span>
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
              disabled={selectedClipIds.length === 0 && !selectedClipId}
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
              aria-label="Delete selected clips"
              title="Delete selected clips (Delete or Backspace)"
              onClick={deleteSelectedClip}
              disabled={selectedClipIds.length === 0 && !selectedClipId}
            >
              🗑
            </button>
          </div>
          <div
            className="timeline-zoom-controls"
            aria-label="Timeline zoom"
            title="Scroll here to zoom the timeline"
            onWheel={(event) => {
              event.preventDefault();
              zoomTimelineBy(
                event.deltaY < 0 ? timelineZoomStep : -timelineZoomStep,
              );
            }}
          >
            <button
              type="button"
              aria-label="Zoom timeline out"
              title="Zoom out"
              onClick={() => zoomTimelineBy(-timelineZoomStep)}
            >
              −
            </button>
            <input
              type="range"
              min={minimumTimelineScale}
              max={maximumTimelineScale}
              step="0.05"
              value={timelineScale}
              aria-label="Timeline zoom level"
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                timelineScaleRef.current = nextScale;
                setTimelineScale(nextScale);
              }}
            />
            <button
              type="button"
              aria-label="Zoom timeline in"
              title="Zoom in"
              onClick={() => zoomTimelineBy(timelineZoomStep)}
            >
              +
            </button>
            <button
              type="button"
              className="timeline-zoom-fit"
              onClick={fitTimelineToViewport}
            >
              Fit
            </button>
          </div>
          <strong>
            {formatTimelineTimecode(playheadFrame, fps)} /{" "}
            {formatTimelineTimecode(projectDuration, fps)}
          </strong>
        </div>
        <div
          className="timeline-scroll"
          ref={timelineScrollRef}
          onScroll={updatePlayheadFromTimelineScroll}
          onPointerDown={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLElement &&
              target.closest(
                "button, input, select, textarea, [contenteditable='true'], [data-timeline-clip-id], .timeline-playhead, .transition-anchor",
              )
            ) {
              return;
            }
            startTimelineSelection(event);
          }}
          onPointerMove={(event) => {
            updateTimelineSelection(event);
          }}
          onPointerUp={finishTimelineSelection}
          onPointerCancel={finishTimelineSelection}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            zoomTimelineBy(
              event.deltaY < 0 ? timelineZoomStep : -timelineZoomStep,
              event.clientX,
            );
          }}
        >
            <div
              className="timeline-content"
              ref={timelineContentRef}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  startTimelineSelection(event);
                }
              }}
              onPointerMove={(event) => {
                updateTimelineSelection(event);
                if (!timelineSelectionBoxRef.current) {
                updateTimelineHoverFromPointer(event);
              }
            }}
            onPointerUp={finishTimelineSelection}
            onPointerCancel={finishTimelineSelection}
            onPointerDownCapture={holdTimelinePreviewFromPointer}
            onPointerLeave={() => {
              if (!isPreviewAxisVisible && !timelineSelectionBoxRef.current) {
                setTimelineHoverFrame(null);
              }
            }}
            style={
              {
                "--timeline-origin": `${timelineOrigin}px`,
                minWidth: `${timelineOrigin + timelineCanvasWidth + 24}px`,
              } as CSSProperties
            }
          >
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
                    className={`timeline-track ${
                      (track.videoLayer !== undefined &&
                        selectedVideoLayer === track.videoLayer) ||
                      selectedClipIds.some((clipId) => {
                        const rowClip = clips.find(
                          (clip) => clip.id === clipId,
                        );
                        return (
                          rowClip !== undefined &&
                          timelineRowContainsClip(track, rowClip)
                        );
                      })
                        ? "selected-timeline-row"
                        : ""
                    } ${track.id === "upper" ? "overlay-timeline-track" : ""} ${
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
                      onPointerDown={(event) => {
                        if (event.target === event.currentTarget) {
                          startTimelineSelection(event);
                        }
                      }}
                      onClick={(event) => {
                        if (suppressTrackLabelClickRef.current) {
                          event.preventDefault();
                          event.stopPropagation();
                          suppressTrackLabelClickRef.current = false;
                          return;
                        }
                        clearEditorSelection();
                        setSelectedTrack(track.id);
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
                        (track.videoLayer !== undefined &&
                          selectedVideoLayer === track.videoLayer) ||
                        selectedClipIds.some((clipId) => {
                          const rowClip = clips.find(
                            (clip) => clip.id === clipId,
                          );
                          return (
                            rowClip !== undefined &&
                            timelineRowContainsClip(track, rowClip)
                          );
                        })
                          ? "selected-track-lane"
                          : ""
                      } ${track.id === "upper" ? "overlay-track-lane" : ""} ${
                        rowHasTimelineWaveform ? "waveform-track-lane" : ""
                      }`}
                      data-track-id={track.id}
                      data-video-layer={track.videoLayer}
                      onPointerDown={(event) => {
                        if (event.target === event.currentTarget) {
                          startTimelineSelection(event);
                        }
                      }}
                      onClick={(event) => {
                        if (suppressTrackLabelClickRef.current) {
                          event.preventDefault();
                          event.stopPropagation();
                          suppressTrackLabelClickRef.current = false;
                          return;
                        }
                        if (event.target !== event.currentTarget) return;
                        clearEditorSelection();
                        setSelectedTrack(track.id);
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
                            <TimelineWaveform
                              clipId="voice-recording-live"
                              duration={Math.max(
                                1,
                                playheadFrame - voiceRecordingStartFrame,
                              )}
                            />
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
                              ? (clips.find(
                                  (clip) => clip.id === selectedBoundaryClipId,
                                ) ?? null)
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
                              selectedClipIds.length > 1 &&
                              selectedClipIds.includes(clip.id)
                                ? "multi-selected-timeline-clip"
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
                              clip.track === "text" && clip.text
                                ? "text-timeline-clip"
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
                            } ${
                              pointerDrag?.activated &&
                              pointerDrag.type === "timeline" &&
                              (timelineGroupDragPreview?.ids.has(clip.id) ||
                                pointerDrag.id === clip.id)
                                ? "moving-timeline-clip"
                                : ""
                            }`}
                            key={clip.id}
                            data-timeline-clip-id={clip.id}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              const isAdditiveSelection =
                                event.shiftKey ||
                                event.ctrlKey ||
                                event.metaKey;
                              const selectedGroup =
                                isAdditiveSelection &&
                                selectedClipIdsRef.current.length > 1 &&
                                selectedClipIdsRef.current.includes(clip.id)
                                  ? selectedClipIdsRef.current
                                  : null;
                              if (selectedGroup) {
                                startPointerDrag(
                                  event,
                                  clip,
                                  selectedGroup,
                                  isAdditiveSelection,
                                );
                                return;
                              }
                              if (
                                event.shiftKey &&
                                !event.ctrlKey &&
                                !event.metaKey
                              ) {
                                event.preventDefault();
                                selectTimelineClipRange(clip);
                                return;
                              }
                              if (isAdditiveSelection) {
                                event.preventDefault();
                                toggleTimelineClipSelection(clip);
                                return;
                              }
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
                                timelineGroupDragPreview?.ids.has(clip.id)
                                  ? (clip.start +
                                      timelineGroupDragPreview.frameDelta) *
                                    timelineScale
                                  : pointerDrag?.type === "timeline" &&
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
                              translate:
                                pointerDrag?.activated &&
                                pointerDrag.type === "timeline" &&
                                (timelineGroupDragPreview?.ids.has(clip.id) ||
                                  pointerDrag.id === clip.id)
                                  ? `0 ${timelineDragPreviewOffsetY}px`
                                  : undefined,
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
                                <TimelineWaveform
                                  clipId={clip.id}
                                  duration={clip.duration}
                                  src={clip.src}
                                  sourceStart={clip.sourceStart}
                                  speed={clip.speed}
                                  fadeInFrames={clip.audioFadeInFrames}
                                  fadeOutFrames={clip.audioFadeOutFrames}
                                  volume={clip.volume}
                                />
                              </div>
                            ) : null}
                            {shouldShowTimelineWaveform(clip) &&
                            (clip.track === "audio" ||
                              clip.track === "main" ||
                              clip.track === "upper" ||
                              clip.track === "cutout") ? (
                              <>
                                <div
                                  className="audio-fade-zone audio-fade-zone-in"
                                  aria-hidden="true"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      ((clip.audioFadeInFrames ?? 0) /
                                        Math.max(1, clip.duration)) *
                                        100,
                                    )}%`,
                                  }}
                                />
                                <div
                                  className="audio-fade-zone audio-fade-zone-out"
                                  aria-hidden="true"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      ((clip.audioFadeOutFrames ?? 0) /
                                        Math.max(1, clip.duration)) *
                                        100,
                                    )}%`,
                                  }}
                                />
                                <button
                                  className="audio-fade-handle audio-fade-handle-in"
                                  type="button"
                                  aria-label={`Adjust fade in for ${clip.label}`}
                                  title={`Fade in ${(clip.audioFadeInFrames ?? 0) / fps}s`}
                                  style={{
                                    left: `calc(max(2%, ${Math.min(
                                      100,
                                      ((clip.audioFadeInFrames ?? 0) /
                                        Math.max(1, clip.duration)) *
                                        100,
                                    )}%) - 6px)`,
                                  }}
                                  onPointerDown={(event) =>
                                    startAudioFadeDrag(event, clip, "in")
                                  }
                                />
                                <button
                                  className="audio-fade-handle audio-fade-handle-out"
                                  type="button"
                                  aria-label={`Adjust fade out for ${clip.label}`}
                                  title={`Fade out ${(clip.audioFadeOutFrames ?? 0) / fps}s`}
                                  style={{
                                    right: `calc(max(2%, ${Math.min(
                                      100,
                                      ((clip.audioFadeOutFrames ?? 0) /
                                        Math.max(1, clip.duration)) *
                                        100,
                                    )}%) - 6px)`,
                                  }}
                                  onPointerDown={(event) =>
                                    startAudioFadeDrag(event, clip, "out")
                                  }
                                />
                              </>
                            ) : null}
                            {shouldShowTimelineWaveform(clip) &&
                            ((clip.audioFadeInFrames ?? 0) > 0 ||
                              (clip.audioFadeOutFrames ?? 0) > 0) ? (
                              <svg
                                className="audio-fade-overlay"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                              >
                                {(clip.audioFadeInFrames ?? 0) > 0 ? (
                                  <line
                                    className="audio-fade-ramp"
                                    x1="0"
                                    y1="100"
                                    x2={Math.min(
                                      100,
                                      ((clip.audioFadeInFrames ?? 0) /
                                        Math.max(1, clip.duration)) *
                                        100,
                                    )}
                                    y2="0"
                                  />
                                ) : null}
                                {(clip.audioFadeOutFrames ?? 0) > 0 ? (
                                  <line
                                    className="audio-fade-ramp"
                                    x1={100 -
                                      Math.min(
                                        100,
                                        ((clip.audioFadeOutFrames ?? 0) /
                                          Math.max(1, clip.duration)) *
                                          100,
                                      )}
                                    y1="0"
                                    x2="100"
                                    y2="100"
                                  />
                                ) : null}
                              </svg>
                            ) : null}
                            {shouldShowTimelineWaveform(clip) &&
                            (clip.track === "audio" ||
                              clip.track === "main" ||
                              clip.track === "upper" ||
                              clip.track === "cutout") ? (
                              <svg
                                className="audio-volume-overlay"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                              >
                                <line
                                  className="audio-volume-hit-line"
                                  x1="0"
                                  x2="100"
                                  y1={getAudioVolumeLineY(clip.volume ?? 1)}
                                  y2={getAudioVolumeLineY(clip.volume ?? 1)}
                                  onPointerDown={(event) =>
                                    startAudioVolumeDrag(event, clip)
                                  }
                                />
                                <line
                                  className="audio-volume-line"
                                  x1="0"
                                  x2="100"
                                  y1={getAudioVolumeLineY(clip.volume ?? 1)}
                                  y2={getAudioVolumeLineY(clip.volume ?? 1)}
                                />
                                <circle
                                  className="audio-volume-knob"
                                  cx="50"
                                  cy={getAudioVolumeLineY(clip.volume ?? 1)}
                                  r="2.2"
                                />
                              </svg>
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
                            {selectedClipId === clip.id ? (
                              <button
                                className={`clip-visibility-button ${
                                  clip.hidden ? "hidden-clip-button" : ""
                                }`}
                                type="button"
                                aria-label={
                                  clip.hidden
                                    ? `Show ${clip.label}`
                                    : `Hide ${clip.label}`
                                }
                                title={clip.hidden ? "Show clip" : "Hide clip"}
                                aria-pressed={Boolean(clip.hidden)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleClipVisibility(clip.id);
                                }}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                              >
                                <span
                                  className="track-visibility-eye"
                                  aria-hidden="true"
                                >
                                  <span className="track-visibility-pupil" />
                                </span>
                              </button>
                            ) : null}
                            <span className="timeline-clip-label">
                              {clip.track === "text" && clip.text
                                ? clip.text.content
                                : clip.track === "caption" && clip.caption
                                  ? clip.caption.content
                                  : clip.label}
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
            {timelineSelectionBox?.activated ? (
              <div
                className="timeline-selection-box"
                aria-hidden="true"
                style={{
                  left: `${Math.min(
                    timelineSelectionBox.startX,
                    timelineSelectionBox.currentX,
                  )}px`,
                  top: `${Math.min(
                    timelineSelectionBox.startY,
                    timelineSelectionBox.currentY,
                  )}px`,
                  width: `${Math.abs(
                    timelineSelectionBox.currentX - timelineSelectionBox.startX,
                  )}px`,
                  height: `${Math.abs(
                    timelineSelectionBox.currentY - timelineSelectionBox.startY,
                  )}px`,
                }}
              />
            ) : null}
            {isPreviewAxisVisible && !isPreviewPlaying && !isScrubbing ? (
              <div
                className="timeline-hover-playhead"
                aria-hidden="true"
                style={{
                  left: `calc(${timelineOrigin}px + ${(timelineHoverFrame ?? playheadFrame) * timelineScale}px)`,
                }}
              />
            ) : null}
            <div
              className={`timeline-playhead ${
                isPreviewPlaying ? "playing-playhead" : ""
              }`}
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
        open={isShortcutHelpOpen}
        className="shortcut-help-dialog"
        aria-labelledby="shortcut-help-title"
        onCancel={(event) => {
          event.preventDefault();
          setIsShortcutHelpOpen(false);
        }}
      >
        <div className="shortcut-help-heading">
          <div>
            <h2 id="shortcut-help-title">Keyboard shortcuts</h2>
            <p>Speed up your editing workflow.</p>
          </div>
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={() => setIsShortcutHelpOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="shortcut-help-list">
          <span>
            <kbd>Space</kbd>
            <em>Play / pause</em>
          </span>
          <span>
            <kbd>S</kbd>
            <em>Split at playhead</em>
          </span>
          <span>
            <kbd>D</kbd>
            <em>Duplicate selected clip</em>
          </span>
          <span>
            <kbd>Ctrl</kbd> + <kbd>A</kbd>
            <em>Select all clips</em>
          </span>
          <span>
            <kbd>Ctrl</kbd> + <kbd>Z</kbd>
            <em>Undo</em>
          </span>
          <span>
            <kbd>Ctrl</kbd> + <kbd>Y</kbd>
            <em>Redo</em>
          </span>
          <span>
            <kbd>Esc</kbd>
            <em>Clear selection</em>
          </span>
          <span>
            <kbd>Home</kbd> / <kbd>End</kbd>
            <em>Jump to start / end</em>
          </span>
        </div>
      </dialog>

      <input
        ref={replaceVideoInputRef}
        className="hidden-file-input"
        type="file"
        accept="video/*"
        onChange={(event) => void replaceSelectedVideoFromGallery(event)}
      />

      {videoQuickMenu ? (
        <div
          className="video-quick-menu"
          role="menu"
          aria-label="Video quick actions"
          style={{
            left: videoQuickMenu.left,
            top: videoQuickMenu.top,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            aria-label="Change video from gallery"
            title="Change video from gallery"
            onClick={() => chooseReplacementVideo(videoQuickMenu.clipId)}
          >
            <span aria-hidden="true">▣+</span>
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Fit full screen"
            title="Fit full screen"
            onClick={() => fitTimelineClipToScreen(videoQuickMenu.clipId)}
          >
            <span aria-hidden="true">▣</span>
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Crop video"
            title="Crop video"
            onClick={() => {
              const clip = clips.find(
                (candidate) => candidate.id === videoQuickMenu.clipId,
              );
              if (clip) {
                openTimelineClipCropEditor(clip);
              }
            }}
          >
            <span aria-hidden="true">⌗</span>
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label="Preview full screen"
            title="Preview full screen"
            onClick={() => {
              setVideoQuickMenu(null);
              void previewWindowRef.current?.requestFullscreen?.();
            }}
          >
            <span aria-hidden="true">⛶</span>
          </button>
          <span className="video-quick-divider" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            aria-label="Close video menu"
            title="Close"
            onClick={() => setVideoQuickMenu(null)}
          >
            <span aria-hidden="true">•••</span>
          </button>
        </div>
      ) : null}

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
                <h2 id="media-trim-title">
                  {mediaTrimDraft?.clipId ? "Crop" : "Canvas editor"}
                </h2>
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
              className={`media-trim-preview ${
                mediaTrimDraft.clipId ? "capcut-crop-preview" : ""
              }`}
              onPointerMove={moveMediaTrimCanvasDrag}
              onPointerUp={() => {
                setMediaTrimCanvasDrag(null);
                setPreviewAlignmentGuides({
                  horizontal: false,
                  vertical: false,
                });
              }}
              onPointerCancel={() => {
                setMediaTrimCanvasDrag(null);
                setPreviewAlignmentGuides({
                  horizontal: false,
                  vertical: false,
                });
              }}
            >
              <div
                className="media-trim-source-stage"
                style={mediaTrimSourceStageStyle}
              >
                {renderPreviewAlignmentGuides(previewAlignmentGuides)}
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
                    if (
                      event.currentTarget.videoWidth > 0 &&
                      event.currentTarget.videoHeight > 0
                    ) {
                      setMediaTrimSourceDimensions({
                        width: event.currentTarget.videoWidth,
                        height: event.currentTarget.videoHeight,
                      });
                    }
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
                      Math.floor(
                        event.currentTarget.currentTime * fps - sourceStart,
                      ),
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
            </div>
            <div className="media-trim-transform-controls">
              <label>
                <span>Size</span>
                <input
                  aria-label="Video size"
                  type="range"
                  min={0.05}
                  max={4}
                  step={0.05}
                  value={mediaTrimDraft.adjustment.scale}
                  onChange={(event) =>
                    updateMediaTrimAdjustment({
                      scale: Number(event.currentTarget.value),
                    })
                  }
                />
                <strong>
                  {Math.round(mediaTrimDraft.adjustment.scale * 100)}%
                </strong>
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
                <strong>
                  {Math.round(mediaTrimDraft.adjustment.rotation)}°
                </strong>
              </label>
              <button
                type="button"
                onClick={() => updateMediaTrimAdjustment(defaultClipAdjustment)}
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
                    Math.min(mediaTrimPreviewFrame, mediaTrimDraft.endFrame) -
                      mediaTrimDraft.startFrame,
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
            {!mediaTrimDraft?.clipId ? (
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
            ) : null}
            <div className="media-trim-actions">
              <button
                className="media-trim-reset-video"
                type="button"
                title="Restore the original duration and crop"
                onClick={resetMediaTrimToOriginal}
              >
                Reset
              </button>
              <button type="button" onClick={closeMediaTrimEditor}>
                Cancel
              </button>
              <button type="button" onClick={applyMediaTrim}>
                Apply
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
