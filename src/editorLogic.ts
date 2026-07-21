export type TrackName =
  | "upper"
  | "cutout"
  | "sticker"
  | "text"
  | "main"
  | "caption"
  | "audio";

export type CaptionStyle = {
  fontSize: number;
  textColor: string;
  backgroundEnabled: boolean;
  backgroundColor: string;
  fontFamily?: string;
  fontWeight?: "400" | "700" | "900";
  effect?: TextEffect;
  animation?: CaptionAnimationPreset;
  animationSpeed?: number;
};

export type CaptionAnimationPreset =
  | "none"
  | "pop"
  | "bounce"
  | "jump"
  | "fade"
  | "slide";

export type CaptionOverlay = CaptionStyle & {
  content: string;
  x?: number;
  y?: number;
  sourceClipId?: string;
  generationId?: string;
};

export type TranscriptionSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export const defaultCaptionStyle: CaptionStyle = {
  fontSize: 36,
  textColor: "#ffffff",
  backgroundEnabled: true,
  backgroundColor: "#000000cc",
  fontFamily: "Inter",
  fontWeight: "900",
  effect: "shadow",
  animation: "none",
  animationSpeed: 1,
};

export type StickerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type TextOverlay = {
  content: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: "400" | "700" | "900";
  fontStyle: "normal" | "italic";
  effect: TextEffect;
  animation: TextEntranceAnimation;
  rotation: number;
  boxWidth?: number;
  boxHeight?: number;
};

export type CutoutTransform = StickerTransform & {
  mediaKind: "image" | "video";
  scaleX?: number;
  scaleY?: number;
  chromaKey?: "none" | "green" | "white" | "black";
  maskStrokes?: CutoutMaskStroke[];
  originalSrc?: string;
  originalSourceStart?: number;
};

export type CutoutMaskPoint = { x: number; y: number };

export type CutoutMaskStroke = {
  mode: "erase" | "restore";
  size: number;
  points: CutoutMaskPoint[];
};

export type TextEffect = "none" | "shadow" | "outline" | "glow";

export type TextEntranceAnimation =
  | "none"
  | "pop"
  | "jump"
  | "fade"
  | "star-jump"
  | "bounce"
  | "typewriter"
  | "wave"
  | "flicker"
  | "spin-in";

export type TextAnimationPresentation = {
  opacity: number;
  scale: number;
  translateY: number;
  rotation: number;
};

export type TextAnimationStar = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
};

export type TextStyleUpdate = Partial<
  Pick<
    TextOverlay,
    | "fontSize"
    | "color"
    | "fontFamily"
    | "fontWeight"
    | "fontStyle"
    | "effect"
    | "animation"
    | "rotation"
  >
>;

export type SavedMediaItem = {
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

const sceneCardFps = 30;

const formatSceneCardDuration = (
  durationInFrames: number,
  fps: number,
): string => {
  const totalSeconds = Math.max(0, Math.round(durationInFrames / fps));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getSceneCardLabelBase = (label: string): string =>
  label.replace(/ - Scene \d+$/, "").replace(/\.[^.]+$/, "");

const getSceneCardId = (sourceFileId: string, sourceStart: number): string =>
  `scene-${sourceFileId}-${sourceStart}`;

export const createSceneMediaItems = ({
  sourceFileId,
  sourceGroupIndex,
  label,
  src,
  ranges,
  fps,
  sourceDurationInFrames,
}: {
  sourceFileId: string;
  sourceGroupIndex?: number;
  label: string;
  src: string;
  ranges: Array<{ startSeconds: number; endSeconds: number }>;
  fps: number;
  sourceDurationInFrames?: number;
}): SavedMediaItem[] => {
  if (!sourceFileId || !Number.isFinite(fps) || fps <= 0) return [];

  return ranges.flatMap((range, index) => {
    if (
      !Number.isFinite(range.startSeconds) ||
      !Number.isFinite(range.endSeconds) ||
      range.startSeconds < 0 ||
      range.endSeconds <= range.startSeconds
    ) {
      return [];
    }

    const sourceStart = Math.round(range.startSeconds * fps);
    const sourceEnd = Math.round(range.endSeconds * fps);
    const durationInFrames = sourceEnd - sourceStart;
    if (durationInFrames <= 0) return [];

    const sceneIndex = index + 1;
    return [
      {
        id: getSceneCardId(sourceFileId, sourceStart),
        label:
          sourceGroupIndex === undefined
            ? `${getSceneCardLabelBase(label)} - Scene ${sceneIndex}`
            : `Scene ${sourceGroupIndex}.${sceneIndex}`,
        src,
        duration: formatSceneCardDuration(durationInFrames, fps),
        durationInFrames,
        kind: "local" as const,
        mediaType: "video" as const,
        sourceStart,
        ...(Number.isFinite(sourceDurationInFrames)
          ? {
              sourceDurationInFrames: Math.max(
                sourceEnd,
                Math.round(sourceDurationInFrames ?? sourceEnd),
              ),
            }
          : {}),
        sourceFileId,
        ...(sourceGroupIndex === undefined
          ? {}
          : { sourceGroupIndex, sourceLabel: label }),
        sceneIndex,
      },
    ];
  });
};

export const splitSceneMediaItemAtFrame = ({
  mediaItems,
  mediaId,
  relativeFrame,
}: {
  mediaItems: SavedMediaItem[];
  mediaId: string;
  relativeFrame: number;
}): SavedMediaItem[] => {
  const target = mediaItems.find((item) => item.id === mediaId);
  const sourceStart = target?.sourceStart;
  if (
    !target ||
    !target.sourceFileId ||
    typeof sourceStart !== "number" ||
    !Number.isFinite(sourceStart) ||
    !Number.isFinite(target.durationInFrames) ||
    !Number.isInteger(relativeFrame) ||
    relativeFrame <= 0 ||
    relativeFrame >= target.durationInFrames
  ) {
    return mediaItems;
  }

  const firstDuration = relativeFrame;
  const secondDuration = target.durationInFrames - relativeFrame;
  const secondSourceStart = sourceStart + firstDuration;
  const firstScene: SavedMediaItem = {
    ...target,
    duration: formatSceneCardDuration(firstDuration, sceneCardFps),
    durationInFrames: firstDuration,
  };
  const secondScene: SavedMediaItem = {
    ...target,
    id: getSceneCardId(target.sourceFileId, secondSourceStart),
    duration: formatSceneCardDuration(secondDuration, sceneCardFps),
    durationInFrames: secondDuration,
    sourceStart: secondSourceStart,
  };
  const splitItems = mediaItems.flatMap((item) =>
    item.id === mediaId ? [firstScene, secondScene] : [item],
  );
  const sourceItems = splitItems
    .filter((item) => item.sourceFileId === target.sourceFileId)
    .sort((left, right) => (left.sourceStart ?? 0) - (right.sourceStart ?? 0));
  const renumbered = new Map(
    sourceItems.map((item, index) => [
      item.id,
      {
        ...item,
        label:
          item.sourceGroupIndex === undefined
            ? `${getSceneCardLabelBase(target.label)} - Scene ${index + 1}`
            : `Scene ${item.sourceGroupIndex}.${index + 1}`,
        sceneIndex: index + 1,
      },
    ]),
  );

  return splitItems.map((item) => renumbered.get(item.id) ?? item);
};

export const trimMediaItemRange = ({
  mediaItems,
  mediaId,
  startFrame,
  endFrame,
}: {
  mediaItems: SavedMediaItem[];
  mediaId: string;
  startFrame: number;
  endFrame: number;
}): SavedMediaItem[] => {
  const target = mediaItems.find((item) => item.id === mediaId);
  if (
    !target ||
    !Number.isInteger(startFrame) ||
    !Number.isInteger(endFrame) ||
    startFrame < 0 ||
    endFrame <= startFrame ||
    endFrame > target.durationInFrames
  ) {
    return mediaItems;
  }

  const durationInFrames = endFrame - startFrame;
  if (startFrame === 0 && durationInFrames === target.durationInFrames) {
    return mediaItems;
  }

  return mediaItems.map((item) =>
    item.id === mediaId
      ? {
          ...item,
          trimOriginalSourceStart:
            item.trimOriginalSourceStart ?? (item.sourceStart ?? 0),
          trimOriginalDurationInFrames:
            item.trimOriginalDurationInFrames ?? item.durationInFrames,
          sourceStart: (item.sourceStart ?? 0) + startFrame,
          sourceDurationInFrames:
            item.sourceDurationInFrames ?? item.durationInFrames,
          durationInFrames,
          duration: formatSceneCardDuration(durationInFrames, sceneCardFps),
        }
      : item,
  );
};

export type SavedEditorProject = {
  version: 1;
  savedAt: string;
  clips: TimelineClip[];
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  nextSourceGroupIndex?: number;
};

export const getInitialNextSourceGroupIndex = (
  mediaItems: SavedMediaItem[],
  savedNextSourceGroupIndex?: number,
): number =>
  Math.max(
    Number.isInteger(savedNextSourceGroupIndex)
      ? (savedNextSourceGroupIndex ?? 1)
      : 1,
    mediaItems.reduce(
      (maximum, item) => Math.max(maximum, item.sourceGroupIndex ?? 0),
      0,
    ) + 1,
  );

export const normalizeMediaSceneLabels = (
  mediaItems: SavedMediaItem[],
): SavedMediaItem[] =>
  mediaItems.map((item) => {
    if (item.sourceGroupIndex === undefined || item.mediaType !== "video") {
      return item;
    }

    const sourceLabel = item.sourceLabel ?? item.label;
    const label = item.sourceFileId
      ? `Scene ${item.sourceGroupIndex}.${item.sceneIndex ?? 1}`
      : `Scene ${item.sourceGroupIndex}`;

    return item.label === label && item.sourceLabel === sourceLabel
      ? item
      : { ...item, label, sourceLabel };
  });

export type ClipEffect =
  | "none"
  | "blur"
  | "glow"
  | "grayscale"
  | "invert"
  | "fade"
  | "shadow"
  | "outline"
  | "moving-outline"
  | "moving-white-outline"
  | "neon-outline"
  | "hand-drawn"
  | "scribble"
  | "float"
  | "bounce"
  | "motion-trail"
  | "rainbow-edge"
  | "electric-glow"
  | "comic-pop"
  | "sway"
  | "flicker-outline"
  | "silhouette"
  | "retro"
  | "halo-blur"
  | "glass-flare"
  | "colors-off"
  | "shake"
  | "dynamic"
  | "glitch"
  | "dream"
  | "vivid-pop"
  | "pulse"
  | "flash"
  | "soft-focus"
  | "warm-glow"
  | "cool-glow"
  | "contrast-pop"
  | "zoom";
export type ClipFilter =
  | "none"
  | "warm"
  | "cool"
  | "vivid"
  | "vintage"
  | "sepia"
  | "cinema"
  | "soft"
  | "classic-mv"
  | "summer-glow"
  | "bare-skin"
  | "filmic-haze"
  | "plum-haze"
  | "flash-night"
  | "light-boost"
  | "cyber-soft"
  | "tokyo"
  | "dreamy-rose"
  | "pearl-glow"
  | "lavender-dream"
  | "stage-light"
  | "violet-rush"
  | "y2k"
  | "stranger"
  | "burgundy"
  | "misty-pink"
  | "nude-tone"
  | "olive-film"
  | "muted-gray"
  | "coral-mood"
  | "film-fade"
  | "ocean-glow"
  | "low-res"
  | "gentle-cream"
  | "amorous"
  | "timeless"
  | "newspaper"
  | "hollywood"
  | "old-flame"
  | "light-pastel"
  | "fluffy-snap"
  | "sweet-paws"
  | "warm-caramel"
  | "cuddle-shade"
  | "chestnut"
  | "soft-ginger";

type ClipFilterFormula = {
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  hueRotate?: number;
  saturate?: number;
  sepia?: number;
  blur?: number;
};

const clipFilterFormulas: Record<ClipFilter, ClipFilterFormula> = {
  none: {},
  warm: { sepia: 0.28, saturate: 1.25, hueRotate: -10 },
  cool: { saturate: 1.12, hueRotate: 14, brightness: 1.05 },
  vivid: { contrast: 1.2, saturate: 1.45 },
  vintage: { sepia: 0.45, contrast: 0.92, saturate: 0.82 },
  sepia: { sepia: 1 },
  cinema: { contrast: 1.18, saturate: 0.88, brightness: 0.94 },
  soft: { contrast: 0.88, brightness: 1.08, blur: 0.8 },
  "classic-mv": { contrast: 1.12, saturate: 0.9, sepia: 0.08 },
  "summer-glow": { brightness: 1.08, saturate: 1.25, sepia: 0.12 },
  "bare-skin": { brightness: 1.06, contrast: 0.94, saturate: 0.88 },
  "filmic-haze": { contrast: 0.88, brightness: 1.08, saturate: 0.82 },
  "plum-haze": { sepia: 0.12, hueRotate: 285, saturate: 1.15 },
  "flash-night": { contrast: 1.28, brightness: 0.86, saturate: 0.9 },
  "light-boost": { brightness: 1.16, contrast: 1.08, saturate: 1.1 },
  "cyber-soft": { hueRotate: 165, saturate: 1.25, brightness: 1.05 },
  tokyo: { contrast: 1.2, saturate: 1.35, hueRotate: -8 },
  "dreamy-rose": { brightness: 1.08, saturate: 1.12, sepia: 0.16, hueRotate: 315 },
  "pearl-glow": { brightness: 1.14, contrast: 0.92, saturate: 0.8 },
  "lavender-dream": { hueRotate: 250, saturate: 0.95, brightness: 1.06 },
  "stage-light": { contrast: 1.15, brightness: 0.96, saturate: 0.78 },
  "violet-rush": { hueRotate: 255, saturate: 1.45, contrast: 1.08 },
  y2k: { contrast: 1.22, saturate: 1.4, brightness: 1.06 },
  stranger: { sepia: 0.35, contrast: 1.2, brightness: 0.8 },
  burgundy: { sepia: 0.25, hueRotate: 305, saturate: 1.35, contrast: 1.08 },
  "misty-pink": { brightness: 1.1, contrast: 0.88, sepia: 0.1, hueRotate: 320 },
  "nude-tone": { sepia: 0.22, saturate: 0.8, brightness: 1.04 },
  "olive-film": { sepia: 0.3, hueRotate: 45, saturate: 0.75, contrast: 1.08 },
  "muted-gray": { grayscale: 0.35, saturate: 0.55, contrast: 0.95 },
  "coral-mood": { sepia: 0.18, saturate: 1.18, hueRotate: 330 },
  "film-fade": { contrast: 0.82, brightness: 1.08, saturate: 0.72 },
  "ocean-glow": { hueRotate: 155, saturate: 1.2, brightness: 1.06 },
  "low-res": { contrast: 1.3, saturate: 0.7, grayscale: 0.1 },
  "gentle-cream": { sepia: 0.2, brightness: 1.12, contrast: 0.9 },
  amorous: { sepia: 0.15, hueRotate: 325, saturate: 1.1, brightness: 1.05 },
  timeless: { grayscale: 1, contrast: 1.08 },
  newspaper: { grayscale: 1, contrast: 1.45, brightness: 0.92 },
  hollywood: { grayscale: 0.75, sepia: 0.15, contrast: 1.25 },
  "old-flame": { grayscale: 0.65, sepia: 0.45, contrast: 1.15 },
  "light-pastel": { brightness: 1.12, contrast: 0.88, saturate: 0.9 },
  "fluffy-snap": { saturate: 1.3, brightness: 1.08 },
  "sweet-paws": { sepia: 0.2, saturate: 1.18 },
  "warm-caramel": { sepia: 0.38, saturate: 1.15, brightness: 0.98 },
  "cuddle-shade": { brightness: 0.94, contrast: 0.92, saturate: 0.85 },
  chestnut: { sepia: 0.5, hueRotate: 345, saturate: 0.9 },
  "soft-ginger": { sepia: 0.25, saturate: 1.35, brightness: 1.05 },
};

export const getClipFilterCss = (
  filter: ClipFilter,
  intensity = 100,
): string => {
  const amount = Math.max(0, Math.min(100, intensity)) / 100;
  const formula = clipFilterFormulas[filter];
  const parts: string[] = [];
  const interpolateFromOne = (target: number) => 1 + (target - 1) * amount;

  if (formula.brightness !== undefined) {
    parts.push(`brightness(${interpolateFromOne(formula.brightness)})`);
  }
  if (formula.contrast !== undefined) {
    parts.push(`contrast(${interpolateFromOne(formula.contrast)})`);
  }
  if (formula.saturate !== undefined) {
    parts.push(`saturate(${interpolateFromOne(formula.saturate)})`);
  }
  if (formula.sepia !== undefined) {
    parts.push(`sepia(${formula.sepia * amount})`);
  }
  if (formula.grayscale !== undefined) {
    parts.push(`grayscale(${formula.grayscale * amount})`);
  }
  if (formula.hueRotate !== undefined) {
    parts.push(`hue-rotate(${formula.hueRotate * amount}deg)`);
  }
  if (formula.blur !== undefined) {
    parts.push(`blur(${formula.blur * amount}px)`);
  }

  return parts.length > 0 ? parts.join(" ") : "none";
};

export type ClipVisualStyle = {
  effect: ClipEffect;
  filter: ClipFilter;
  effectIntensity?: number;
  filterIntensity?: number;
};

export type ClipVisualPresentation = {
  filter: string;
  opacity: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotate: number;
};

export type ClipAnimationPreset =
  | "none"
  | "fade-in"
  | "fade-out"
  | "slide-in"
  | "slide-out"
  | "slide-left-in"
  | "slide-right-in"
  | "slide-up-in"
  | "slide-down-in"
  | "zoom-in"
  | "zoom-out"
  | "pop"
  | "spin-in"
  | "tilt-in"
  | "bounce"
  | "shake"
  | "pulse"
  | "flash"
  | "elastic-in"
  | "swing-in"
  | "flip-horizontal"
  | "flip-vertical"
  | "cube-turn"
  | "roll-in"
  | "drop-in"
  | "whip-pan"
  | "spiral-in"
  | "drift"
  | "heartbeat"
  | "strobe"
  | "wobble"
  | "zoom-burst";

export type ClipAnimationTiming = "start" | "end" | "both";

export type ClipAnimationEasing = "smooth" | "fast" | "slow";

export type ClipAnimationStyle = {
  preset: ClipAnimationPreset;
  timing: ClipAnimationTiming;
  duration: number;
  easing?: ClipAnimationEasing;
};

export type ClipTransitionPreset =
  | "none"
  | "fade"
  | "dissolve"
  | "slide"
  | "zoom";

export type ClipTransitionStyle = {
  preset: Exclude<ClipTransitionPreset, "none">;
  duration: number;
};

export type ClipTransitionPresentation = {
  opacity: number;
  translateX: number;
  scale: number;
};

export type ClipAnimationPresentation = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
};

export type ClipAdjustment = {
  scale: number;
  rotation: number;
  positionX: number;
  positionY: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
};

export const defaultClipAdjustment: ClipAdjustment = {
  scale: 1,
  rotation: 0,
  positionX: 0,
  positionY: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
};

export const resetMediaItemEdits = ({
  mediaItems,
  mediaId,
}: {
  mediaItems: SavedMediaItem[];
  mediaId: string;
}): SavedMediaItem[] => {
  const target = mediaItems.find((item) => item.id === mediaId);
  if (!target) return mediaItems;

  const canRestoreLegacyFullSource =
    target.trimOriginalDurationInFrames === undefined &&
    target.sourceDurationInFrames !== undefined &&
    !target.sourceFileId;
  const sourceStart =
    target.trimOriginalSourceStart ??
    (canRestoreLegacyFullSource ? 0 : (target.sourceStart ?? 0));
  const durationInFrames =
    target.trimOriginalDurationInFrames ??
    (canRestoreLegacyFullSource
      ? (target.sourceDurationInFrames ?? target.durationInFrames)
      : target.durationInFrames);

  return mediaItems.map((item) => {
    if (item.id !== mediaId) return item;
    const restoredItem: SavedMediaItem = {
      ...item,
      sourceStart,
      durationInFrames,
      duration: formatSceneCardDuration(durationInFrames, sceneCardFps),
      adjustment: { ...defaultClipAdjustment },
    };
    delete restoredItem.trimOriginalSourceStart;
    delete restoredItem.trimOriginalDurationInFrames;
    return restoredItem;
  });
};

export type TimelineClip = {
  id: string;
  label: string;
  track: TrackName;
  start: number;
  duration: number;
  color: string;
  src?: string;
  mediaType?: "video" | "image";
  audioKind?: "linked" | "voiceover" | "music";
  hidden?: boolean;
  speed?: number;
  volume?: number;
  sourceStart?: number;
  sourceDuration?: number;
  linkedClipId?: string;
  overlayLane?: number;
  videoLayer?: number;
  timelineRowOrder?: number;
  transition?: ClipTransitionStyle;
  sticker?: StickerTransform;
  cutout?: CutoutTransform;
  chromaKey?: NonNullable<CutoutTransform["chromaKey"]>;
  text?: TextOverlay;
  caption?: CaptionOverlay;
  visual?: ClipVisualStyle;
  animation?: ClipAnimationStyle;
  adjustment?: ClipAdjustment;
};

const isTransparentDisplayColor = (color: string | undefined): boolean => {
  const normalized = color?.trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return true;
  }
  if (/^#[0-9a-f]{8}$/.test(normalized)) {
    return normalized.endsWith("00");
  }
  const rgbaMatch = normalized.match(
    /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/,
  );
  return rgbaMatch ? Number(rgbaMatch[1]) === 0 : false;
};

export const getTextualClipDisplayColors = (
  clip: Pick<TimelineClip, "track" | "caption" | "text">,
): { backgroundColor: string; textColor: string } => {
  if (clip.track === "caption" && clip.caption) {
    const usesSystemColors =
      !clip.caption.backgroundEnabled ||
      isTransparentDisplayColor(clip.caption.backgroundColor);
    return {
      backgroundColor: usesSystemColors
        ? "#000000"
        : clip.caption.backgroundColor,
      textColor:
        usesSystemColors || isTransparentDisplayColor(clip.caption.textColor)
          ? "#ffffff"
          : clip.caption.textColor,
    };
  }

  return {
    backgroundColor: "#000000",
    textColor:
      clip.text && !isTransparentDisplayColor(clip.text.color)
        ? clip.text.color
        : "#ffffff",
  };
};

export const getTimelineDuration = (clips: TimelineClip[]): number =>
  Math.max(
    1,
    clips.reduce(
      (furthestEnd, clip) =>
        Math.max(
          furthestEnd,
          Math.max(0, clip.start) + Math.max(1, clip.duration),
        ),
      0,
    ),
  );

export const getVideoPlaybackDuration = (clips: TimelineClip[]): number =>
  Math.max(
    1,
    clips.reduce((furthestEnd, clip) => {
      const isVideoLayer =
        clip.track === "main" ||
        clip.track === "upper" ||
        clip.track === "cutout";
      if (!isVideoLayer || clip.hidden || !clip.src) {
        return furthestEnd;
      }

      return Math.max(
        furthestEnd,
        Math.max(0, clip.start) + Math.max(1, clip.duration),
      );
    }, 0),
  );

export const getTimelineFrameFromPointer = (
  clientX: number,
  contentLeft: number,
  timelineOrigin: number,
  scale: number,
): number => {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(contentLeft) ||
    !Number.isFinite(timelineOrigin) ||
    !Number.isFinite(scale) ||
    scale <= 0
  ) {
    return 0;
  }

  return Math.round((clientX - contentLeft - timelineOrigin) / scale);
};

export const getStableTimelineFrameDelta = (
  clientX: number,
  startFrame: number,
  capturedContentLeft: number,
  timelineOrigin: number,
  scale: number,
): number =>
  getTimelineFrameFromPointer(
    clientX,
    capturedContentLeft,
    timelineOrigin,
    scale,
  ) - (Number.isFinite(startFrame) ? Math.round(startFrame) : 0);

export const getDragEdgeAutoScrollDelta = (
  pointerPosition: number,
  viewportStart: number,
  viewportEnd: number,
  edgeSize = 64,
  maximumSpeed = 22,
): number => {
  if (
    !Number.isFinite(pointerPosition) ||
    !Number.isFinite(viewportStart) ||
    !Number.isFinite(viewportEnd) ||
    viewportEnd <= viewportStart ||
    edgeSize <= 0 ||
    maximumSpeed <= 0
  ) {
    return 0;
  }

  if (
    pointerPosition >= viewportStart - edgeSize &&
    pointerPosition < viewportStart + edgeSize
  ) {
    const intensity = Math.min(
      1,
      (viewportStart + edgeSize - pointerPosition) / (edgeSize * 2),
    );
    return -Math.max(1, Math.round(maximumSpeed * intensity));
  }

  if (
    pointerPosition > viewportEnd - edgeSize &&
    pointerPosition <= viewportEnd + edgeSize
  ) {
    const intensity = Math.min(
      1,
      (pointerPosition - (viewportEnd - edgeSize)) / (edgeSize * 2),
    );
    return Math.max(1, Math.round(maximumSpeed * intensity));
  }

  return 0;
};

export const getPlaybackFollowScrollLeft = ({
  scrollLeft,
  viewportWidth,
  contentWidth,
  playheadX,
}: {
  scrollLeft: number;
  viewportWidth: number;
  contentWidth: number;
  playheadX: number;
}): number => {
  if (
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(contentWidth) ||
    !Number.isFinite(playheadX) ||
    viewportWidth <= 0 ||
    contentWidth <= viewportWidth
  ) {
    return Math.max(0, Number.isFinite(scrollLeft) ? scrollLeft : 0);
  }

  const maximumScrollLeft = Math.max(0, contentWidth - viewportWidth);
  const currentScrollLeft = Math.min(
    maximumScrollLeft,
    Math.max(0, scrollLeft),
  );
  const edgePadding = Math.min(
    viewportWidth * 0.3,
    Math.max(72, viewportWidth * 0.18),
  );
  const visibleLeft = currentScrollLeft + edgePadding;
  const visibleRight = currentScrollLeft + viewportWidth - edgePadding;

  if (playheadX < visibleLeft) {
    return Math.max(0, Math.min(maximumScrollLeft, playheadX - edgePadding));
  }
  if (playheadX > visibleRight) {
    return Math.max(
      0,
      Math.min(
        maximumScrollLeft,
        playheadX - viewportWidth + edgePadding,
      ),
    );
  }

  return currentScrollLeft;
};

export const getMediaTrimFrameFromPointer = ({
  clientX,
  boundsLeft,
  boundsWidth,
  durationInFrames,
}: {
  clientX: number;
  boundsLeft: number;
  boundsWidth: number;
  durationInFrames: number;
}): number => {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(boundsLeft) ||
    !Number.isFinite(boundsWidth) ||
    !Number.isFinite(durationInFrames) ||
    boundsWidth <= 0 ||
    durationInFrames <= 0
  ) {
    return 0;
  }

  const progress = Math.max(
    0,
    Math.min(1, (clientX - boundsLeft) / boundsWidth),
  );
  return Math.round(progress * durationInFrames);
};

export const getManualRotationAngle = (
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number,
  rotationOffset: number,
): number => {
  if (
    !Number.isFinite(centerX) ||
    !Number.isFinite(centerY) ||
    !Number.isFinite(pointerX) ||
    !Number.isFinite(pointerY) ||
    !Number.isFinite(rotationOffset)
  ) {
    return 0;
  }

  const pointerAngle = Math.atan2(pointerY - centerY, pointerX - centerX);
  const degrees = Math.round(
    (pointerAngle * 180) / Math.PI + 90 + rotationOffset,
  );

  const normalized = ((degrees + 540) % 360) - 180;

  return normalized === -180 ? 180 : normalized;
};

export const getVisibleRotateHandleTop = (cropTopPercent: number): number => {
  const frameOffset = Number.isFinite(cropTopPercent) ? 0 : 0;

  return 4 + frameOffset;
};

export const clampPlayheadFrame = (
  frame: number,
  projectDuration: number,
): number => {
  const safeFrame = Number.isFinite(frame) ? Math.round(frame) : 0;
  const safeDuration = Number.isFinite(projectDuration)
    ? Math.max(0, Math.round(projectDuration))
    : 0;

  return Math.max(0, Math.min(safeFrame, safeDuration - 1));
};

export const advanceTimelinePlaybackFrame = (
  currentFrame: number,
  projectDuration: number,
  framesPerTick = 3,
): number => {
  const safeDuration = Number.isFinite(projectDuration)
    ? Math.max(0, Math.round(projectDuration))
    : 0;
  if (safeDuration === 0) return 0;

  const safeCurrentFrame = clampPlayheadFrame(currentFrame, safeDuration);
  const safeFramesPerTick =
    Number.isFinite(framesPerTick) && framesPerTick > 0
      ? Math.max(1, Math.round(framesPerTick))
      : 3;

  return clampPlayheadFrame(safeCurrentFrame + safeFramesPerTick, safeDuration);
};

export type TimelinePlaybackStep = {
  nextFrame: number;
  continues: boolean;
};

export const stepTimelinePlayback = (
  currentFrame: number,
  projectDuration: number,
  resetAtEnd = true,
): TimelinePlaybackStep => {
  const safeDuration = Number.isFinite(projectDuration)
    ? Math.max(0, Math.round(projectDuration))
    : 0;
  if (safeDuration === 0) return { nextFrame: 0, continues: false };

  const safeCurrentFrame = clampPlayheadFrame(currentFrame, safeDuration);
  if (safeCurrentFrame >= safeDuration - 1) {
    return {
      nextFrame: resetAtEnd ? 0 : Math.max(0, safeDuration - 1),
      continues: false,
    };
  }

  return {
    nextFrame: advanceTimelinePlaybackFrame(safeCurrentFrame, safeDuration),
    continues: true,
  };
};

export type TrailingAutosaveTimer = {
  schedule: (callback: () => void, delayMs: number) => number;
  cancel: (timerId: number) => void;
};

export const createTrailingAutosaveScheduler = (
  persist: () => void,
  timer: TrailingAutosaveTimer,
  delayMs = 250,
) => {
  let pendingTimerId: number | null = null;

  const cancel = () => {
    if (pendingTimerId === null) return;

    timer.cancel(pendingTimerId);
    pendingTimerId = null;
  };

  return {
    schedule: () => {
      cancel();
      pendingTimerId = timer.schedule(() => {
        pendingTimerId = null;
        persist();
      }, delayMs);
    },
    cancel,
  };
};

export const getExpandedTimelineBoundary = (
  currentDuration: number,
  targetStart: number,
  clipDuration: number,
): number => {
  const safeCurrentDuration = Number.isFinite(currentDuration)
    ? Math.max(1, Math.round(currentDuration))
    : 1;
  const safeTargetStart = Number.isFinite(targetStart)
    ? Math.max(0, Math.round(targetStart))
    : 0;
  const safeClipDuration = Number.isFinite(clipDuration)
    ? Math.max(1, Math.round(clipDuration))
    : 1;

  return Math.max(safeCurrentDuration, safeTargetStart + safeClipDuration);
};

const clampTimelineStart = (
  targetStart: number,
  clipDuration: number,
  timelineBoundary: number,
): number => {
  const safeTargetStart = Number.isFinite(targetStart)
    ? Math.round(targetStart)
    : 0;
  const safeClipDuration = Number.isFinite(clipDuration)
    ? Math.max(1, Math.round(clipDuration))
    : 1;
  const safeBoundary = Number.isFinite(timelineBoundary)
    ? Math.max(1, Math.round(timelineBoundary))
    : safeClipDuration;
  const maximumStart = Math.max(0, safeBoundary - safeClipDuration);

  return Math.max(0, Math.min(safeTargetStart, maximumStart));
};

export const formatTimelineClock = (frame: number, fps: number): string => {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteAndSecond = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${minuteAndSecond}`
    : minuteAndSecond;
};

export const formatTimelineTimecode = (frame: number, fps: number): string => {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

export const createTimelineTicks = (
  durationInFrames: number,
  fps: number,
  targetTickCount = 8,
) => {
  const safeFps = Math.max(1, fps);
  const durationSeconds = Math.max(1, Math.ceil(durationInFrames / safeFps));
  const intervals = [
    1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200,
  ];
  const desiredInterval = durationSeconds / Math.max(2, targetTickCount);
  const intervalSeconds =
    intervals.find((interval) => interval >= desiredInterval) ??
    Math.ceil(desiredInterval / 3600) * 3600;
  const frames = [0];
  for (
    let seconds = intervalSeconds;
    seconds < durationSeconds;
    seconds += intervalSeconds
  ) {
    frames.push(seconds * safeFps);
  }
  frames.push(durationInFrames);
  const ticks = frames.map((tickFrame) => ({
    frame: tickFrame,
    label: formatTimelineClock(tickFrame, safeFps),
  }));

  return ticks.filter(
    (tick, index) =>
      index === ticks.length - 1 || tick.label !== ticks[index + 1].label,
  );
};

export type TimelineHistoryState = {
  past: TimelineClip[][];
  present: TimelineClip[];
  future: TimelineClip[][];
};

export type VideoLayerControlHistoryGesture = {
  property: "speed" | "volume";
  videoLayer: number;
  originalClips: TimelineClip[];
};

export type VideoLayerControlState = {
  hasSelectedVideoLayer: boolean;
  speed: number;
  volume: number;
};

export type VideoLayerDirection = "above" | "below";

export const createTimelineHistory = (
  present: TimelineClip[],
): TimelineHistoryState => ({
  past: [],
  present,
  future: [],
});

export const applyTimelineHistoryEdit = (
  state: TimelineHistoryState,
  next: TimelineClip[],
): TimelineHistoryState => {
  if (next === state.present) {
    return state;
  }

  return {
    past: [...state.past, state.present],
    present: next,
    future: [],
  };
};

export const undoTimelineHistory = (
  state: TimelineHistoryState,
): TimelineHistoryState => {
  const previous = state.past[state.past.length - 1];

  if (!previous) {
    return state;
  }

  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
};

export const redoTimelineHistory = (
  state: TimelineHistoryState,
): TimelineHistoryState => {
  const next = state.future[0];

  if (!next) {
    return state;
  }

  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
};

export const shouldMovePlayheadDuringScrub = ({
  activePointerId,
  pointerId,
}: {
  activePointerId: number | null;
  pointerId: number;
  buttons: number;
}) => activePointerId === pointerId;

export const shouldShowAudioTrackForSelection = (track: TrackName) =>
  track === "main" || track === "cutout" || track === "audio";

export const getVisualToolTargetClipId = (
  clips: TimelineClip[],
  selectedClipId: string | null,
  playheadFrame: number,
): string | null => {
  const isVideoClip = (clip: TimelineClip) =>
    (clip.track === "main" || clip.track === "upper") && Boolean(clip.src);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);

  if (selectedClip && isVideoClip(selectedClip)) {
    return selectedClip.id;
  }

  return (
    getTopVisibleVideoClipAtFrame(clips, playheadFrame)?.id ??
    clips
      .filter((clip) => isVideoClip(clip) && !clip.hidden)
      .sort(
        (firstClip, secondClip) =>
          (getVideoLayer(secondClip) ?? 0) - (getVideoLayer(firstClip) ?? 0) ||
          firstClip.start - secondClip.start,
      )[0]?.id ??
    null
  );
};

type RecordedAudioOptions = {
  id: string;
  label: string;
  src: string;
  start: number;
  durationSeconds: number;
  fps: number;
};

export const createRecordedAudioClip = (
  options: RecordedAudioOptions,
): TimelineClip | null => {
  const duration = Math.round(options.durationSeconds * options.fps);

  if (duration < 1) {
    return null;
  }

  return {
    id: options.id,
    label: options.label,
    track: "audio",
    start: options.start,
    duration,
    color: "#2563eb",
    src: options.src,
    audioKind: "voiceover",
    volume: 1,
  };
};

export const createBackgroundMusicClip = ({
  id,
  label,
  src,
  playheadFrame,
  durationInFrames,
}: {
  id: string;
  label: string;
  src: string;
  playheadFrame: number;
  durationInFrames: number;
}): TimelineClip => ({
  id,
  label,
  track: "audio",
  start: Math.max(0, playheadFrame),
  duration: Math.max(1, durationInFrames),
  color: "#2563eb",
  src,
  audioKind: "music",
  volume: 0.7,
});

export type VideoMediaPairOptions = {
  videoId: string;
  audioId: string;
  track: "main" | "upper";
  label: string;
  src: string;
  start: number;
  duration: number;
  overlayLane?: number;
  sourceStart?: number;
  sourceDuration?: number;
  adjustment?: ClipAdjustment;
};

export const createVideoMediaPair = (
  options: VideoMediaPairOptions,
): [TimelineClip, TimelineClip] => {
  const video: TimelineClip = {
    id: options.videoId,
    label: options.label,
    track: options.track,
    start: options.start,
    duration: options.duration,
    sourceStart: Math.max(0, options.sourceStart ?? 0),
    ...(Number.isFinite(options.sourceDuration)
      ? { sourceDuration: Math.max(1, Math.round(options.sourceDuration ?? 1)) }
      : {}),
    color: options.track === "main" ? "#0891b2" : "#7c3aed",
    src: options.src,
    speed: 1,
    volume: 1,
    linkedClipId: options.audioId,
    ...(options.adjustment
      ? { adjustment: { ...options.adjustment } }
      : {}),
    ...(options.track === "upper"
      ? { overlayLane: options.overlayLane ?? 0 }
      : {}),
  };
  const audio: TimelineClip = {
    id: options.audioId,
    label: `${options.label} audio`,
    track: "audio",
    start: options.start,
    duration: options.duration,
    sourceStart: Math.max(0, options.sourceStart ?? 0),
    ...(Number.isFinite(options.sourceDuration)
      ? { sourceDuration: Math.max(1, Math.round(options.sourceDuration ?? 1)) }
      : {}),
    color: "#2563eb",
    src: options.src,
    audioKind: "linked",
    speed: 1,
    volume: 1,
    linkedClipId: options.videoId,
  };

  return [video, audio];
};

export const createImageMediaClip = (options: {
  id: string;
  track: "main" | "upper";
  label: string;
  src: string;
  start: number;
  duration: number;
  overlayLane?: number;
  adjustment?: ClipAdjustment;
}): TimelineClip => ({
  id: options.id,
  label: options.label,
  track: options.track,
  start: options.start,
  duration: options.duration,
  color: options.track === "main" ? "#0891b2" : "#7c3aed",
  src: options.src,
  speed: 1,
  volume: 1,
  mediaType: "image",
  ...(options.adjustment
    ? { adjustment: { ...options.adjustment } }
    : {}),
  ...(options.track === "upper"
    ? { overlayLane: options.overlayLane ?? 0 }
    : {}),
});

export const createMainMediaPair = (options: {
  mainId: string;
  audioId: string;
  label: string;
  src: string;
  start: number;
  duration: number;
}): [TimelineClip, TimelineClip] => {
  const [video, audio] = createVideoMediaPair({
    videoId: options.mainId,
    audioId: options.audioId,
    track: "main",
    label: options.label,
    src: options.src,
    start: options.start,
    duration: options.duration,
  });
  const legacyAudio = { ...audio };
  delete legacyAudio.speed;
  return [video, legacyAudio];
};

type StickerClipOptions = {
  id: string;
  label: string;
  src: string;
  playheadFrame: number;
};

export const createStickerClip = (
  options: StickerClipOptions,
): TimelineClip => ({
  id: options.id,
  label: options.label,
  track: "sticker",
  start: options.playheadFrame,
  duration: 90,
  color: "#f59e0b",
  src: options.src,
  sticker: { x: 50, y: 50, scale: 1, rotation: 0 },
});

export const appendStickerClip = (
  clips: TimelineClip[],
  sticker: TimelineClip,
): TimelineClip[] => [...clips, sticker];

export const createCutoutImageClip = ({
  id,
  label,
  src,
  playheadFrame,
}: {
  id: string;
  label: string;
  src: string;
  playheadFrame: number;
}): TimelineClip => ({
  id,
  label,
  track: "cutout",
  start: Math.max(0, playheadFrame),
  duration: 90,
  color: "#0d9488",
  src,
  cutout: {
    x: 50,
    y: 50,
    scale: 1,
    rotation: 0,
    mediaKind: "image",
    originalSrc: src,
  },
});

export const createCutoutVideoPair = ({
  videoId,
  audioId,
  label,
  src,
  start,
  duration,
}: {
  videoId: string;
  audioId: string;
  label: string;
  src: string;
  start: number;
  duration: number;
}): [TimelineClip, TimelineClip] => {
  const cutout: TimelineClip = {
    id: videoId,
    label,
    track: "cutout",
    start: Math.max(0, start),
    duration: Math.max(1, duration),
    color: "#0d9488",
    src,
    speed: 1,
    volume: 1,
    linkedClipId: audioId,
    cutout: { x: 50, y: 50, scale: 1, rotation: 0, mediaKind: "video" },
  };
  const audio: TimelineClip = {
    id: audioId,
    label: `${label} audio`,
    track: "audio",
    start: cutout.start,
    duration: cutout.duration,
    color: "#2563eb",
    src,
    speed: 1,
    volume: 1,
    linkedClipId: videoId,
  };

  return [cutout, audio];
};

export const moveCutoutClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  timelineDuration: number,
): TimelineClip[] => {
  const cutout = clips.find(
    (clip) => clip.id === clipId && clip.track === "cutout" && clip.cutout,
  );
  if (!cutout) return clips;

  const start = clampTimelineStart(
    targetStart,
    cutout.duration,
    timelineDuration,
  );
  if (start === cutout.start) return clips;

  const linkedAudio = getReciprocalLinkedAudio(clips, cutout);
  return clips.map((clip) =>
    clip.id === cutout.id || clip.id === linkedAudio?.id
      ? { ...clip, start }
      : clip,
  );
};

const clampMaskPercent = (value: number): number =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const appendCutoutMaskStroke = (
  clips: TimelineClip[],
  clipId: string,
  stroke: CutoutMaskStroke,
): TimelineClip[] => {
  if (stroke.points.length === 0) return clips;

  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "cutout" || !clip.cutout) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      cutout: {
        ...clip.cutout,
        maskStrokes: [
          ...(clip.cutout.maskStrokes ?? []),
          {
            mode: stroke.mode,
            size: Math.max(1, Math.min(40, stroke.size)),
            points: stroke.points.map((point) => ({
              x: clampMaskPercent(point.x),
              y: clampMaskPercent(point.y),
            })),
          },
        ],
      },
    };
  });

  return changed ? nextClips : clips;
};

export const setCutoutChromaKeyById = (
  clips: TimelineClip[],
  clipId: string,
  chromaKey: NonNullable<CutoutTransform["chromaKey"]>,
): TimelineClip[] => {
  let changed = false;
  const nextClips = clips.map((clip) => {
    const isVideoTrack =
      clip.track === "main" ||
      clip.track === "upper" ||
      clip.track === "cutout";
    const isVideo =
      clip.cutout?.mediaKind === "video" ||
      clip.mediaType === "video" ||
      (isVideoTrack &&
        Boolean(clip.src) &&
        clip.mediaType !== "image" &&
        clip.cutout?.mediaKind !== "image");
    if (clip.id !== clipId || !isVideo) {
      return clip;
    }

    if ((clip.cutout?.chromaKey ?? clip.chromaKey ?? "none") === chromaKey) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      chromaKey,
      ...(clip.cutout ? { cutout: { ...clip.cutout, chromaKey } } : {}),
    };
  });

  return changed ? nextClips : clips;
};

export const getEffectiveCutoutOriginalSourceStart = (
  clip: TimelineClip,
): number => {
  const sourceStart = clip.sourceStart ?? 0;
  if (clip.cutout?.mediaKind !== "video" || !clip.cutout.originalSrc) {
    return sourceStart;
  }

  return (clip.cutout.originalSourceStart ?? 0) + sourceStart;
};

export const resetCutoutMask = (
  clips: TimelineClip[],
  clipId: string,
): TimelineClip[] => {
  let changed = false;
  const nextClips = clips.map((clip) => {
    if (
      clip.id !== clipId ||
      clip.track !== "cutout" ||
      !clip.cutout ||
      ((clip.cutout.maskStrokes ?? []).length === 0 &&
        (!clip.cutout.originalSrc || clip.src === clip.cutout.originalSrc))
    ) {
      return clip;
    }

    changed = true;
    const effectiveOriginalSourceStart =
      getEffectiveCutoutOriginalSourceStart(clip);
    const { originalSrc, originalSourceStart, ...cutout } = clip.cutout;
    return {
      ...clip,
      ...(originalSrc ? { src: originalSrc } : {}),
      ...(originalSrc &&
      clip.cutout.mediaKind === "video" &&
      originalSourceStart !== undefined
        ? { sourceStart: effectiveOriginalSourceStart }
        : {}),
      cutout: { ...cutout, maskStrokes: [] },
    };
  });
  return changed ? nextClips : clips;
};

const createCutoutStrokeMaskDataUrl = (
  cutout: CutoutTransform | undefined,
  baseColor: "black" | "white",
): string => {
  const strokes = cutout?.maskStrokes ?? [];
  const paths = strokes
    .map((stroke) => {
      const points = stroke.points
        .map(
          (point) =>
            `${clampMaskPercent(point.x)},${clampMaskPercent(point.y)}`,
        )
        .join(" ");
      const color = stroke.mode === "erase" ? "black" : "white";
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        return `<circle cx="${clampMaskPercent(point.x)}" cy="${clampMaskPercent(point.y)}" r="${stroke.size / 2}" fill="${color}"/>`;
      }
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><mask id="cutout-mask" maskUnits="userSpaceOnUse"><rect width="100" height="100" fill="${baseColor}"/>${paths}</mask></defs><rect width="100" height="100" fill="white" mask="url(#cutout-mask)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const createCutoutMaskDataUrl = (cutout?: CutoutTransform): string =>
  createCutoutStrokeMaskDataUrl(cutout, "white");

export const createCutoutRestoreMaskDataUrl = (
  cutout?: CutoutTransform,
): string => createCutoutStrokeMaskDataUrl(cutout, "black");

export const removeBackgroundPixels = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(pixels);
  if (width <= 0 || height <= 0 || output.length < width * height * 4) {
    return output;
  }

  const cornerIndexes = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    (height * width - 1) * 4,
  ];
  const background = [0, 1, 2].map(
    (channel) =>
      cornerIndexes.reduce((sum, index) => sum + output[index + channel], 0) /
      cornerIndexes.length,
  );
  const edgeDistance = Math.max(1, Math.min(24, threshold));
  const enclosedWhiteDistance = Math.min(8, edgeDistance);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;
  const colorDistance = (pixelIndex: number) => {
    const index = pixelIndex * 4;
    return Math.hypot(
      output[index] - background[0],
      output[index + 1] - background[1],
      output[index + 2] - background[2],
    );
  };
  const enqueueBackground = (pixelIndex: number) => {
    if (
      pixelIndex < 0 ||
      pixelIndex >= pixelCount ||
      visited[pixelIndex] ||
      colorDistance(pixelIndex) > edgeDistance
    ) {
      return;
    }
    visited[pixelIndex] = 1;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueBackground(x);
    enqueueBackground((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueueBackground(y * width);
    enqueueBackground(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    output[pixelIndex * 4 + 3] = 0;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueueBackground(pixelIndex - 1);
    if (x + 1 < width) enqueueBackground(pixelIndex + 1);
    if (y > 0) enqueueBackground(pixelIndex - width);
    if (y + 1 < height) enqueueBackground(pixelIndex + width);
  }

  visited.fill(0);
  queueStart = 0;
  queueEnd = 0;
  const enqueueEnclosedBackground = (pixelIndex: number) => {
    const index = pixelIndex * 4;
    if (
      pixelIndex < 0 ||
      pixelIndex >= pixelCount ||
      visited[pixelIndex] ||
      output[index + 3] === 0 ||
      colorDistance(pixelIndex) > edgeDistance
    ) {
      return;
    }
    visited[pixelIndex] = 1;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  };

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const index = pixelIndex * 4;
    if (
      output[index + 3] > 0 &&
      colorDistance(pixelIndex) <= enclosedWhiteDistance
    ) {
      enqueueEnclosedBackground(pixelIndex);
    }
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    output[pixelIndex * 4 + 3] = 0;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueueEnclosedBackground(pixelIndex - 1);
    if (x + 1 < width) enqueueEnclosedBackground(pixelIndex + 1);
    if (y > 0) enqueueEnclosedBackground(pixelIndex - width);
    if (y + 1 < height) enqueueEnclosedBackground(pixelIndex + width);
  }

  visited.fill(0);
  const isBrightNeutralPixel = (pixelIndex: number) => {
    const index = pixelIndex * 4;
    if (output[index + 3] === 0) return false;
    const red = output[index];
    const green = output[index + 1];
    const blue = output[index + 2];
    const brightest = Math.max(red, green, blue);
    const darkest = Math.min(red, green, blue);

    return darkest >= 236 && brightest - darkest <= 18;
  };
  const minimumBrightRegionSize = Math.max(6, Math.floor(pixelCount * 0.03));

  for (let startPixel = 0; startPixel < pixelCount; startPixel += 1) {
    if (visited[startPixel] || !isBrightNeutralPixel(startPixel)) {
      continue;
    }

    queueStart = 0;
    queueEnd = 0;
    visited[startPixel] = 1;
    queue[queueEnd] = startPixel;
    queueEnd += 1;

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart];
      queueStart += 1;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x + 1 < width ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y + 1 < height ? pixelIndex + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          !visited[neighbor] &&
          isBrightNeutralPixel(neighbor)
        ) {
          visited[neighbor] = 1;
          queue[queueEnd] = neighbor;
          queueEnd += 1;
        }
      }
    }

    if (queueEnd >= minimumBrightRegionSize) {
      for (let index = 0; index < queueEnd; index += 1) {
        output[queue[index] * 4 + 3] = 0;
      }
    }
  }

  visited.fill(0);
  type OpaqueComponent = {
    pixels: number[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  const components: OpaqueComponent[] = [];

  for (let startPixel = 0; startPixel < pixelCount; startPixel += 1) {
    if (visited[startPixel] || output[startPixel * 4 + 3] === 0) {
      continue;
    }

    queueStart = 0;
    queueEnd = 0;
    visited[startPixel] = 1;
    queue[queueEnd] = startPixel;
    queueEnd += 1;
    const pixelsInComponent: number[] = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart];
      queueStart += 1;
      pixelsInComponent.push(pixelIndex);
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x + 1 < width ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y + 1 < height ? pixelIndex + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          !visited[neighbor] &&
          output[neighbor * 4 + 3] > 0
        ) {
          visited[neighbor] = 1;
          queue[queueEnd] = neighbor;
          queueEnd += 1;
        }
      }
    }

    components.push({ pixels: pixelsInComponent, minX, maxX, minY, maxY });
  }

  if (components.length > 1) {
    const centerLeft = width * 0.28;
    const centerRight = width * 0.72;
    const centerTop = height * 0.12;
    const centerBottom = height * 0.88;
    const intersectsFocusArea = (component: OpaqueComponent) =>
      component.maxX >= centerLeft &&
      component.minX <= centerRight &&
      component.maxY >= centerTop &&
      component.minY <= centerBottom;
    const focusedComponents = components.filter(intersectsFocusArea);
    const subjectComponents =
      focusedComponents.length > 0
        ? focusedComponents
        : [
            components.reduce((largest, component) =>
              component.pixels.length > largest.pixels.length
                ? component
                : largest,
            ),
          ];
    const largestSubjectSize = Math.max(
      ...subjectComponents.map((component) => component.pixels.length),
    );
    const minimumCompanionSize = Math.max(
      4,
      Math.floor(largestSubjectSize * 0.35),
    );
    const keepComponents = new Set(
      components.filter(
        (component) =>
          subjectComponents.includes(component) ||
          (intersectsFocusArea(component) &&
            component.pixels.length >= minimumCompanionSize),
      ),
    );

    for (const component of components) {
      if (keepComponents.has(component)) {
        continue;
      }

      for (const pixelIndex of component.pixels) {
        output[pixelIndex * 4 + 3] = 0;
      }
    }
  }

  return output;
};

export const applyAutomaticCutoutById = (
  clips: TimelineClip[],
  clipId: string,
  processedSrc: string,
): TimelineClip[] => {
  let changed = false;
  const nextClips = clips.map((clip) => {
    if (
      clip.id !== clipId ||
      clip.track !== "cutout" ||
      !clip.cutout ||
      !clip.src
    ) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      src: processedSrc,
      ...(clip.cutout.mediaKind === "video" ? { sourceStart: 0 } : {}),
      cutout: {
        ...clip.cutout,
        originalSrc: clip.cutout.originalSrc ?? clip.src,
        ...(clip.cutout.mediaKind === "video"
          ? {
              originalSourceStart: getEffectiveCutoutOriginalSourceStart(clip),
            }
          : {}),
        maskStrokes: [],
        chromaKey: "none" as const,
      },
    };
  });
  return changed ? nextClips : clips;
};

export const createTextClip = ({
  id,
  content,
  playheadFrame,
}: {
  id: string;
  content: string;
  playheadFrame: number;
}): TimelineClip => ({
  id,
  label: content,
  track: "text",
  start: playheadFrame,
  duration: 90,
  color: "#f97316",
  text: {
    content,
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

export const setTextContentById = (
  clips: TimelineClip[],
  clipId: string | null,
  content: string,
): TimelineClip[] => {
  const nextContent = content.trim();
  if (!clipId || !nextContent) {
    return clips;
  }

  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "text" || !clip.text) {
      return clip;
    }
    if (clip.label === nextContent && clip.text.content === nextContent) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      label: nextContent,
      text: {
        ...clip.text,
        content: nextContent,
      },
    };
  });

  return changed ? nextClips : clips;
};

const neutralTextAnimation: TextAnimationPresentation = {
  opacity: 1,
  scale: 1,
  translateY: 0,
  rotation: 0,
};

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const STAR_X = [-18, 4, 20];
const STAR_Y = [-16, -24, -10];

export const getTextAnimationVisibleCharacterCount = (
  clip: TimelineClip,
  playheadFrame: number,
): number => {
  const content = clip.text?.content ?? "";
  if (clip.text?.animation !== "typewriter") return content.length;
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const revealFrames = Math.max(15, Math.min(60, content.length * 2));
  return Math.min(
    content.length,
    Math.floor((localFrame / revealFrames) * content.length),
  );
};

export const getTextAnimationWordPresentation = (
  clip: TimelineClip,
  playheadFrame: number,
  wordIndex: number,
  wordCount: number,
): TextAnimationPresentation => {
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const animation = clip.text?.animation ?? "none";
  if (animation === "bounce") {
    const progress = clampUnit((localFrame - wordIndex * 3) / 15);
    return {
      ...neutralTextAnimation,
      translateY: -Math.sin(progress * Math.PI) * 22,
      scale: 1 + Math.sin(progress * Math.PI) * 0.08,
    };
  }
  if (animation === "wave") {
    return {
      ...neutralTextAnimation,
      translateY: Math.sin(localFrame / 5 - wordIndex * 0.8) * 8,
    };
  }
  if (animation === "star-jump") {
    const activeWord = Math.floor(localFrame / 12) % Math.max(1, wordCount);
    return activeWord === wordIndex
      ? { ...neutralTextAnimation, translateY: -5, scale: 1.06 }
      : neutralTextAnimation;
  }
  return neutralTextAnimation;
};

export const getTextAnimationStars = (
  clip: TimelineClip,
  playheadFrame: number,
  wordIndex: number,
  wordCount: number,
): TextAnimationStar[] => {
  if (clip.text?.animation !== "star-jump") return [];
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const activeWord = Math.floor(localFrame / 12) % Math.max(1, wordCount);
  if (activeWord !== wordIndex) return [];
  const phase = (localFrame % 12) / 12;
  return STAR_X.map((x, index) => ({
    x,
    y: STAR_Y[index] - Math.sin(phase * Math.PI) * 8,
    opacity: Math.sin(phase * Math.PI),
    scale: 0.65 + index * 0.15,
    rotation: phase * 180 + index * 35,
  }));
};

export const getTextAnimationPresentation = (
  clip: TimelineClip,
  playheadFrame: number,
  durationInFrames = 15,
): TextAnimationPresentation => {
  const preset = clip.text?.animation ?? "none";
  if (preset === "none") return neutralTextAnimation;

  const progress = clampUnit(
    (playheadFrame - clip.start) / Math.max(1, durationInFrames),
  );
  if (progress >= 1) return neutralTextAnimation;

  if (
    preset === "bounce" ||
    preset === "star-jump" ||
    preset === "typewriter" ||
    preset === "wave"
  ) {
    return neutralTextAnimation;
  }

  if (preset === "flicker") {
    const flickerOpacity = [0.2, 0.8, 0.35, 0.9, 0.55, 1];
    return {
      ...neutralTextAnimation,
      opacity:
        flickerOpacity[
          Math.min(
            flickerOpacity.length - 1,
            Math.max(0, playheadFrame - clip.start),
          )
        ] ?? 1,
    };
  }

  if (preset === "spin-in") {
    return {
      ...neutralTextAnimation,
      scale: 0.72 + progress * 0.28,
      rotation: (1 - progress) * -180,
    };
  }

  if (preset === "fade") {
    return { ...neutralTextAnimation, opacity: progress };
  }

  if (preset === "jump") {
    return {
      ...neutralTextAnimation,
      translateY: (1 - progress) * 34 * Math.cos(progress * Math.PI * 2),
    };
  }

  const overshoot = Math.sin(progress * Math.PI) * 0.16;
  return {
    ...neutralTextAnimation,
    scale: 0.55 + progress * 0.45 + overshoot,
  };
};

export const setTextStyleById = (
  clips: TimelineClip[],
  clipId: string | null,
  style: TextStyleUpdate,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  return clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "text" || !clip.text) {
      return clip;
    }

    return {
      ...clip,
      text: {
        ...clip.text,
        ...style,
      },
    };
  });
};

export const setCaptionStyleById = (
  clips: TimelineClip[],
  clipId: string | null,
  style: Partial<CaptionStyle>,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "caption" || !clip.caption) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      caption: {
        ...clip.caption,
        ...style,
      },
    };
  });

  return changed ? nextClips : clips;
};

export const resizeTextOverlayById = (
  clips: TimelineClip[],
  clipId: string | null,
  fontSize: number,
): TimelineClip[] =>
  setTextStyleById(clips, clipId, {
    fontSize: Math.max(12, Math.min(160, Math.round(fontSize))),
  });

export const setTextRotationById = (
  clips: TimelineClip[],
  clipId: string | null,
  rotation: number,
): TimelineClip[] =>
  setTextStyleById(clips, clipId, {
    rotation: Math.max(-180, Math.min(180, Math.round(rotation))),
  });

export const getResizedTextFontSize = ({
  startFontSize,
  startX,
  startY,
  pointerX,
  pointerY,
}: {
  startFontSize: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
}) => {
  const dragDistance = Math.hypot(pointerX - startX, pointerY - startY);
  const direction = pointerX + pointerY >= startX + startY ? 1 : -1;

  return Math.max(
    12,
    Math.min(160, Math.round(startFontSize + (direction * dragDistance) / 2)),
  );
};

export const createSavedEditorProject = ({
  clips,
  mediaItems,
  selectedMediaId,
  nextSourceGroupIndex,
  now = new Date(),
}: {
  clips: TimelineClip[];
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  nextSourceGroupIndex: number;
  now?: Date;
}): SavedEditorProject => ({
  version: 1,
  savedAt: now.toISOString(),
  clips,
  mediaItems,
  selectedMediaId,
  nextSourceGroupIndex,
});

export const removeUnusedMediaItem = ({
  mediaItems,
  selectedMediaId,
  mediaId,
}: {
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  mediaId: string;
}): {
  outcome: "removed" | "blocked" | "unchanged";
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  message: string;
} => {
  const mediaItem = mediaItems.find((item) => item.id === mediaId);

  if (!mediaItem) {
    return {
      outcome: "unchanged",
      mediaItems,
      selectedMediaId,
      message: "Imported media was not found.",
    };
  }

  const nextMediaItems = mediaItems.filter((item) => item.id !== mediaId);

  return {
    outcome: "removed",
    mediaItems: nextMediaItems,
    selectedMediaId:
      selectedMediaId === mediaId
        ? (nextMediaItems[0]?.id ?? null)
        : selectedMediaId,
    message: `${mediaItem.label} removed from imported media.`,
  };
};

const isBrowserOnlySavedSource = (src?: string) =>
  src?.startsWith("blob:") ?? false;

export const removeBrowserOnlySavedMedia = (
  project: SavedEditorProject,
): SavedEditorProject => {
  const mediaItems = project.mediaItems.filter(
    (mediaItem) => !isBrowserOnlySavedSource(mediaItem.src),
  );
  const clips = project.clips.filter(
    (clip) => !isBrowserOnlySavedSource(clip.src),
  );
  const selectedMediaId = mediaItems.some(
    (mediaItem) => mediaItem.id === project.selectedMediaId,
  )
    ? project.selectedMediaId
    : (mediaItems[0]?.id ?? null);

  return {
    ...project,
    clips,
    mediaItems,
    selectedMediaId,
  };
};

export const parseSavedEditorProject = (
  value: string | null,
): SavedEditorProject | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SavedEditorProject>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.clips) ||
      !Array.isArray(parsed.mediaItems)
    ) {
      return null;
    }

    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      clips: parsed.clips,
      mediaItems: parsed.mediaItems,
      selectedMediaId:
        typeof parsed.selectedMediaId === "string"
          ? parsed.selectedMediaId
          : null,
      ...(Number.isInteger(parsed.nextSourceGroupIndex) &&
      (parsed.nextSourceGroupIndex ?? 0) > 0
        ? { nextSourceGroupIndex: parsed.nextSourceGroupIndex }
        : {}),
    };
  } catch {
    return null;
  }
};

export const createWaveformBars = (
  clipId: string,
  numberOfBars: number,
): number[] => {
  const count = Math.max(1, numberOfBars);
  const seed = Array.from(clipId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0.5 : index / (count - 1);
    const edgeEnvelope = Math.pow(Math.sin(Math.PI * position), 0.48);
    const firstPeak = Math.exp(-Math.pow((position - 0.24) / 0.12, 2));
    const secondPeak = Math.exp(-Math.pow((position - 0.69) / 0.14, 2));
    const clusteredEnergy = 0.38 + Math.max(firstPeak, secondPeak) * 0.62;
    const fineDetail =
      0.82 +
      Math.sin((index + 1) * 1.91 + seed * 0.07) * 0.1 +
      Math.sin((index + 1) * 0.73 + seed * 0.11) * 0.08;

    return Math.max(
      0.1,
      Math.min(1, (0.1 + edgeEnvelope * 0.9) * clusteredEnergy * fineDetail),
    );
  });
};

export const moveTextClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  timelineDuration: number,
): TimelineClip[] => {
  const clip = clips.find(
    (candidate) =>
      candidate.id === clipId && candidate.track === "text" && candidate.text,
  );
  if (!clip) return clips;

  const start = clampTimelineStart(
    targetStart,
    clip.duration,
    timelineDuration,
  );
  if (start === clip.start) return clips;

  return clips.map((candidate) =>
    candidate.id === clipId ? { ...candidate, start } : candidate,
  );
};

export const moveIndependentTimelineClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  timelineDuration: number,
): TimelineClip[] => {
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (
    !clip ||
    !["sticker", "caption", "audio"].includes(clip.track) ||
    (clip.track === "audio" && Boolean(clip.linkedClipId))
  ) {
    return clips;
  }

  const start = clampTimelineStart(
    targetStart,
    clip.duration,
    timelineDuration,
  );
  if (start === clip.start) return clips;

  return clips.map((candidate) =>
    candidate.id === clipId ? { ...candidate, start } : candidate,
  );
};

type TextPosition = { x: number; y: number };
type TextPositionBounds = {
  halfWidthPercent: number;
  halfHeightPercent: number;
};

export const moveTextOverlay = (
  clips: TimelineClip[],
  clipId: string,
  position: TextPosition,
  bounds: TextPositionBounds,
): TimelineClip[] => {
  const clip = clips.find(
    (candidate) =>
      candidate.id === clipId && candidate.track === "text" && candidate.text,
  );
  if (!clip?.text) return clips;

  const halfWidth = Math.max(0, Math.min(50, bounds.halfWidthPercent));
  const halfHeight = Math.max(0, Math.min(50, bounds.halfHeightPercent));
  const x = Math.max(halfWidth, Math.min(100 - halfWidth, position.x));
  const y = Math.max(halfHeight, Math.min(100 - halfHeight, position.y));

  if (x === clip.text.x && y === clip.text.y) return clips;

  return clips.map((candidate) =>
    candidate.id === clipId
      ? { ...candidate, text: { ...candidate.text!, x, y } }
      : candidate,
  );
};

export const getCaptionPosition = (caption: CaptionOverlay) => ({
  x: caption.x ?? 50,
  y: caption.y ?? 82,
});

type CaptionPosition = { x: number; y: number };

type CaptionPositionBounds = {
  halfWidthPercent: number;
  halfHeightPercent: number;
};

export const moveCaptionOverlay = (
  clips: TimelineClip[],
  clipId: string | null,
  position: CaptionPosition,
  bounds: CaptionPositionBounds,
): TimelineClip[] => {
  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "caption" || !clip.caption) {
      return clip;
    }

    const halfWidth = Math.max(0, Math.min(50, bounds.halfWidthPercent));
    const halfHeight = Math.max(0, Math.min(50, bounds.halfHeightPercent));
    const x = Math.max(halfWidth, Math.min(100 - halfWidth, position.x));
    const y = Math.max(halfHeight, Math.min(100 - halfHeight, position.y));
    const currentPosition = getCaptionPosition(clip.caption);

    if (x === currentPosition.x && y === currentPosition.y) {
      return clip;
    }

    changed = true;

    return {
      ...clip,
      caption: {
        ...clip.caption,
        x,
        y,
      },
    };
  });

  return changed ? nextClips : clips;
};
export const createManualCaptionClip = ({
  id,
  content,
  playheadFrame,
  timelineDuration,
  style,
}: {
  id: string;
  content: string;
  playheadFrame: number;
  timelineDuration: number;
  style: CaptionStyle;
}): TimelineClip | null => {
  const text = content.trim();
  const start = Math.max(0, Math.round(playheadFrame));
  const duration = Math.min(90, timelineDuration - start);

  if (!text || duration < 1) {
    return null;
  }

  return {
    id,
    label: text,
    track: "caption",
    start,
    duration,
    color: "#ef4444",
    caption: { ...style, content: text },
  };
};

export const createGeneratedCaptionClips = ({
  sourceClip,
  segments,
  fps,
  timelineDuration,
  generationId,
  style,
}: {
  sourceClip: TimelineClip;
  segments: TranscriptionSegment[];
  fps: number;
  timelineDuration: number;
  generationId: string;
  style: CaptionStyle;
}): TimelineClip[] => {
  const speed = sourceClip.speed ?? 1;
  const sourceStartSeconds = (sourceClip.sourceStart ?? 0) / fps;
  const sourceEndSeconds =
    sourceStartSeconds + (sourceClip.duration * speed) / fps;

  return segments.flatMap((segment, index) => {
    const text = segment.text.trim();
    const valuesAreFinite =
      Number.isFinite(segment.startSeconds) &&
      Number.isFinite(segment.endSeconds) &&
      Number.isFinite(fps) &&
      fps > 0 &&
      Number.isFinite(sourceClip.start) &&
      Number.isFinite(sourceClip.duration) &&
      Number.isFinite(sourceClip.sourceStart ?? 0);

    if (
      !valuesAreFinite ||
      segment.startSeconds < 0 ||
      segment.endSeconds <= segment.startSeconds
    ) {
      return [];
    }

    const visibleStart = Math.max(segment.startSeconds, sourceStartSeconds);
    const visibleEnd = Math.min(segment.endSeconds, sourceEndSeconds);

    if (!text || visibleEnd <= visibleStart) {
      return [];
    }

    const start =
      sourceClip.start +
      Math.round(((visibleStart - sourceStartSeconds) * fps) / speed);
    const end = Math.min(
      timelineDuration,
      sourceClip.start +
        Math.round(((visibleEnd - sourceStartSeconds) * fps) / speed),
    );

    if (end <= start) {
      return [];
    }

    return [
      {
        id: `${generationId}-${index}`,
        label: text,
        track: "caption",
        start,
        duration: end - start,
        color: "#ef4444",
        caption: {
          ...style,
          content: text,
          sourceClipId: sourceClip.id,
          generationId,
        },
      },
    ];
  });
};

export const replaceGeneratedCaptionBatch = (
  clips: TimelineClip[],
  sourceClipId: string,
  generated: TimelineClip[],
): TimelineClip[] => [
  ...clips.filter(
    (clip) =>
      clip.track !== "caption" ||
      !clip.caption?.generationId ||
      clip.caption.sourceClipId !== sourceClipId,
  ),
  ...generated,
];

export const resizeCaptionOverlayById = (
  clips: TimelineClip[],
  clipId: string | null,
  fontSize: number,
  bounds?: CaptionPositionBounds & {
    maximumFontSize?: number;
    referenceFontSize?: number;
  },
): TimelineClip[] => {
  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "caption" || !clip.caption) {
      return clip;
    }

    const maximumFontSize = Math.max(
      1,
      Math.min(160, Math.round(bounds?.maximumFontSize ?? 160)),
    );
    const nextFontSize = Math.max(
      1,
      Math.min(maximumFontSize, Math.round(fontSize)),
    );
    if (nextFontSize === clip.caption.fontSize) {
      return clip;
    }

    const currentPosition = getCaptionPosition(clip.caption);
    const growthScale =
      bounds?.maximumFontSize === undefined && bounds?.referenceFontSize
        ? Math.max(1, nextFontSize / Math.max(1, bounds.referenceFontSize))
        : 1;
    const halfWidth = bounds
      ? Math.max(0, Math.min(50, bounds.halfWidthPercent * growthScale))
      : 0;
    const halfHeight = bounds
      ? Math.max(0, Math.min(50, bounds.halfHeightPercent * growthScale))
      : 0;
    const x = Math.max(halfWidth, Math.min(100 - halfWidth, currentPosition.x));
    const y = Math.max(
      halfHeight,
      Math.min(100 - halfHeight, currentPosition.y),
    );

    changed = true;

    return {
      ...clip,
      caption: {
        ...clip.caption,
        fontSize: nextFontSize,
        x,
        y,
      },
    };
  });

  return changed ? nextClips : clips;
};

export const getResizedCaptionFontSize = getResizedTextFontSize;

export type CaptionResizeHandle =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

const captionResizeHandleVectors: Record<
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

export const resizeCutoutTransform = ({
  transform,
  handle,
  deltaX,
  deltaY,
  baseWidth,
  baseHeight,
  previewWidth,
  previewHeight,
}: {
  transform: CutoutTransform;
  handle: CaptionResizeHandle;
  deltaX: number;
  deltaY: number;
  baseWidth: number;
  baseHeight: number;
  previewWidth: number;
  previewHeight: number;
}): CutoutTransform => {
  const vector = captionResizeHandleVectors[handle];
  const radians = (transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localDeltaX = deltaX * cosine + deltaY * sine;
  const localDeltaY = -deltaX * sine + deltaY * cosine;
  const startScaleX = transform.scaleX ?? transform.scale;
  const startScaleY = transform.scaleY ?? transform.scale;
  const safeBaseWidth = Math.max(1, baseWidth);
  const safeBaseHeight = Math.max(1, baseHeight);
  const startWidth = safeBaseWidth * startScaleX;
  const startHeight = safeBaseHeight * startScaleY;
  const nextWidth =
    vector.x === 0
      ? startWidth
      : Math.max(
          safeBaseWidth * 0.08,
          Math.min(safeBaseWidth * 6, startWidth + vector.x * localDeltaX),
        );
  const nextHeight =
    vector.y === 0
      ? startHeight
      : Math.max(
          safeBaseHeight * 0.08,
          Math.min(safeBaseHeight * 6, startHeight + vector.y * localDeltaY),
        );
  const localCenterShiftX = (vector.x * (nextWidth - startWidth)) / 2;
  const localCenterShiftY = (vector.y * (nextHeight - startHeight)) / 2;
  const worldCenterShiftX =
    localCenterShiftX * cosine - localCenterShiftY * sine;
  const worldCenterShiftY =
    localCenterShiftX * sine + localCenterShiftY * cosine;

  return {
    ...transform,
    scale: 1,
    scaleX: nextWidth / safeBaseWidth,
    scaleY: nextHeight / safeBaseHeight,
    x: Math.max(
      0,
      Math.min(
        100,
        transform.x + (worldCenterShiftX / Math.max(1, previewWidth)) * 100,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        100,
        transform.y + (worldCenterShiftY / Math.max(1, previewHeight)) * 100,
      ),
    ),
  };
};

export const getResizedCaptionFontSizeFromHandle = ({
  startFontSize,
  startX,
  startY,
  pointerX,
  pointerY,
  handle,
}: {
  startFontSize: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
  handle: CaptionResizeHandle;
}): number => {
  const vector = captionResizeHandleVectors[handle];
  const vectorLength = Math.hypot(vector.x, vector.y);
  const projectedDistance =
    ((pointerX - startX) * vector.x + (pointerY - startY) * vector.y) /
    vectorLength;

  return Math.max(
    1,
    Math.min(160, Math.round(startFontSize + projectedDistance / 2)),
  );
};

export const getMaximumFittingCaptionFontSize = ({
  requestedFontSize,
  previewWidth,
  previewHeight,
  measure,
}: {
  requestedFontSize: number;
  previewWidth: number;
  previewHeight: number;
  measure: (fontSize: number) => { width: number; height: number };
}): number => {
  const upperLimit = Math.max(1, Math.min(160, Math.round(requestedFontSize)));
  if (previewWidth <= 0 || previewHeight <= 0) return 1;

  let largestFittingSize = 1;
  for (let fontSize = 1; fontSize <= upperLimit; fontSize += 1) {
    const measured = measure(fontSize);
    if (
      Number.isFinite(measured.width) &&
      Number.isFinite(measured.height) &&
      measured.width <= previewWidth &&
      measured.height <= previewHeight
    ) {
      largestFittingSize = fontSize;
    }
  }

  return largestFittingSize;
};

export const getActiveClipAtFrame = (
  clips: TimelineClip[],
  track: TrackName,
  frame: number,
): TimelineClip | undefined => {
  return getActiveClipsAtFrame(clips, track, frame)[0];
};

export const hasClipsOnTrack = (
  clips: TimelineClip[],
  track: TrackName,
): boolean =>
  clips.some((clip) => {
    if (clip.track !== track || clip.duration <= 0) return false;

    if (track === "caption") {
      return (
        typeof clip.caption?.content === "string" &&
        clip.caption.content.trim().length > 0
      );
    }
    if (track === "text") {
      return (
        typeof clip.text?.content === "string" &&
        clip.text.content.trim().length > 0
      );
    }
    if (track === "sticker") {
      return Boolean(clip.sticker && clip.src);
    }
    if (track === "cutout") {
      return Boolean(clip.cutout && clip.src);
    }

    return true;
  });

export const getActiveClipsAtFrame = (
  clips: TimelineClip[],
  track: TrackName,
  frame: number,
): TimelineClip[] => {
  return clips
    .filter((clip) => clip.track === track && !clip.hidden)
    .sort((firstClip, secondClip) => firstClip.start - secondClip.start)
    .filter(
      (clip) => frame >= clip.start && frame < clip.start + clip.duration,
    );
};

export const getActiveOverlayClipsAtFrame = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip[] => {
  return getActiveClipsAtFrame(clips, "upper", frame)
    .filter((clip) => Boolean(clip.src))
    .sort(
      (firstClip, secondClip) =>
        (firstClip.overlayLane ?? 0) - (secondClip.overlayLane ?? 0),
    );
};

export const getActiveVideoLayersAtFrame = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip[] => {
  return clips
    .filter(
      (clip) =>
        getVideoLayer(clip) !== null &&
        Boolean(clip.src) &&
        !clip.hidden &&
        frame >= clip.start &&
        frame < clip.start + clip.duration,
    )
    .sort(
      (firstClip, secondClip) =>
        (getVideoLayer(firstClip) ?? 0) - (getVideoLayer(secondClip) ?? 0),
    );
};

export const getTopVisibleVideoClipAtFrame = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip | undefined => {
  const activeLayers = getActiveVideoLayersAtFrame(clips, frame);
  return activeLayers[activeLayers.length - 1];
};

export const getContextualAudioClips = (
  clips: TimelineClip[],
  selectedClipId: string | null,
): TimelineClip[] => {
  const selectedVideo = clips.find(
    (clip) =>
      clip.id === selectedClipId &&
      (clip.track === "main" ||
        clip.track === "upper" ||
        clip.track === "cutout"),
  );

  if (!selectedVideo?.linkedClipId) {
    return [];
  }

  const speechSegmentMatch = selectedVideo.id.match(/^(.*)-speech-\d+$/);
  if (speechSegmentMatch) {
    const speechSequenceId = speechSegmentMatch[1];
    const siblingVideos = clips.filter(
      (clip) =>
        (clip.track === "main" ||
          clip.track === "upper" ||
          clip.track === "cutout") &&
        clip.id.match(/^(.*)-speech-\d+$/)?.[1] === speechSequenceId,
    );

    return clips
      .filter(
        (clip) =>
          clip.track === "audio" &&
          siblingVideos.some(
            (videoClip) =>
              videoClip.linkedClipId === clip.id &&
              clip.linkedClipId === videoClip.id,
          ),
      )
      .sort((first, second) => first.start - second.start);
  }

  return clips.filter(
    (clip) => clip.track === "audio" && clip.id === selectedVideo.linkedClipId,
  );
};

const getWinningVideoClipAtFrame = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip | undefined => getTopVisibleVideoClipAtFrame(clips, frame);

const getAudibleLinkedAudioAtFrame = (
  clips: TimelineClip[],
  videoClip: TimelineClip,
  frame: number,
): TimelineClip | undefined => {
  const linkedAudio = getReciprocalLinkedAudio(clips, videoClip);
  if (
    !linkedAudio ||
    linkedAudio.hidden ||
    !linkedAudio.src ||
    (linkedAudio.volume ?? 1) === 0 ||
    (videoClip.volume ?? 1) === 0 ||
    frame < linkedAudio.start ||
    frame >= linkedAudio.start + linkedAudio.duration
  ) {
    return undefined;
  }

  return linkedAudio;
};

export const getPlaybackAudioClips = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip[] => {
  const linkedAudio = [...getActiveVideoLayersAtFrame(clips, frame)]
    .reverse()
    .map((videoClip) => getAudibleLinkedAudioAtFrame(clips, videoClip, frame))
    .find((audioClip): audioClip is TimelineClip => Boolean(audioClip));

  const cutoutAudio = getActiveClipsAtFrame(clips, "cutout", frame)
    .filter((clip) => clip.cutout?.mediaKind === "video")
    .map((clip) => getAudibleLinkedAudioAtFrame(clips, clip, frame))
    .filter((clip): clip is TimelineClip => Boolean(clip));

  return [...(linkedAudio ? [linkedAudio] : []), ...cutoutAudio];
};

export const getIndependentPlaybackAudioClips = (
  clips: TimelineClip[],
  frame: number,
): TimelineClip[] => {
  return getActiveClipsAtFrame(clips, "audio", frame)
    .filter((audioClip) => Boolean(audioClip.src))
    .filter(
      (audioClip) =>
        !clips.some(
          (videoClip) =>
            !videoClip.hidden && isAudioOwnedByVideo(audioClip, videoClip),
        ),
    );
};

const clipRangesOverlap = (
  firstStart: number,
  firstDuration: number,
  secondStart: number,
  secondDuration: number,
) =>
  firstStart < secondStart + secondDuration &&
  secondStart < firstStart + firstDuration;

export const findAvailableOverlayLane = (
  clips: TimelineClip[],
  start: number,
  duration: number,
): number => {
  const overlayClips = clips.filter((clip) => clip.track === "upper");
  const highestLane = overlayClips.reduce(
    (highest, clip) => Math.max(highest, clip.overlayLane ?? 0),
    -1,
  );

  for (let lane = 0; lane <= highestLane + 1; lane += 1) {
    const laneIsOccupied = overlayClips.some(
      (clip) =>
        (clip.overlayLane ?? 0) === lane &&
        clipRangesOverlap(start, duration, clip.start, clip.duration),
    );

    if (!laneIsOccupied) {
      return lane;
    }
  }

  return highestLane + 1;
};

const getReciprocalLinkedAudio = (
  clips: TimelineClip[],
  videoClip: TimelineClip,
): TimelineClip | undefined => {
  if (
    (videoClip.track !== "main" &&
      videoClip.track !== "upper" &&
      videoClip.track !== "cutout") ||
    !videoClip.linkedClipId
  ) {
    return undefined;
  }

  const audioClip = clips.find(
    (clip) =>
      clip.id === videoClip.linkedClipId &&
      clip.track === "audio" &&
      clip.linkedClipId === videoClip.id,
  );

  return audioClip;
};

export const getVideoLayer = (clip: TimelineClip): number | null => {
  if (clip.track === "main") return 0;
  if (clip.track !== "upper") return null;

  return clip.videoLayer ?? (clip.overlayLane ?? 0) + 1;
};

export type TimelineKeyboardDirection = "left" | "right" | "up" | "down";

const getTimelineKeyboardRow = (clip: TimelineClip) => {
  const videoLayer = getVideoLayer(clip);
  if (videoLayer !== null) {
    return {
      key: `video-${videoLayer}`,
      order:
        clip.timelineRowOrder ??
        (videoLayer > 0
          ? 100 + videoLayer
          : videoLayer < 0
            ? -10 + videoLayer
            : 0),
    };
  }

  const trackOrder: Record<Exclude<TrackName, "upper" | "main">, number> = {
    sticker: 80,
    cutout: 70,
    text: 60,
    caption: 50,
    audio: -90,
  };

  return {
    key: `track-${clip.track}`,
    order:
      clip.track === "upper" || clip.track === "main"
        ? 0
        : trackOrder[clip.track],
  };
};

export const getTimelineKeyboardNavigationTarget = ({
  clips,
  selectedClipId,
  direction,
}: {
  clips: TimelineClip[];
  selectedClipId: string | null;
  direction: TimelineKeyboardDirection;
}): TimelineClip | null => {
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  if (!selectedClip) return null;

  const selectedRow = getTimelineKeyboardRow(selectedClip);
  const rowClips = clips
    .filter((clip) => getTimelineKeyboardRow(clip).key === selectedRow.key)
    .sort(
      (firstClip, secondClip) =>
        firstClip.start - secondClip.start ||
        firstClip.duration - secondClip.duration ||
        firstClip.id.localeCompare(secondClip.id),
    );

  if (direction === "left" || direction === "right") {
    const selectedIndex = rowClips.findIndex(
      (clip) => clip.id === selectedClip.id,
    );
    const offset = direction === "left" ? -1 : 1;
    return rowClips[selectedIndex + offset] ?? null;
  }

  const rows = Array.from(
    clips.reduce((rowMap, clip) => {
      const row = getTimelineKeyboardRow(clip);
      const existing = rowMap.get(row.key);
      if (!existing) {
        rowMap.set(row.key, { ...row, clips: [clip] });
      } else {
        existing.clips.push(clip);
        existing.order = Math.max(existing.order, row.order);
      }
      return rowMap;
    }, new Map<string, { key: string; order: number; clips: TimelineClip[] }>()),
  )
    .map(([, row]) => row)
    .sort(
      (firstRow, secondRow) =>
        secondRow.order - firstRow.order ||
        firstRow.key.localeCompare(secondRow.key),
    );
  const selectedRowIndex = rows.findIndex((row) => row.key === selectedRow.key);
  const targetRow =
    rows[selectedRowIndex + (direction === "up" ? -1 : 1)];
  if (!targetRow) return null;

  const anchorFrame = selectedClip.start + selectedClip.duration / 2;
  const distanceFromAnchor = (clip: TimelineClip) => {
    const end = clip.start + clip.duration;
    if (anchorFrame < clip.start) return clip.start - anchorFrame;
    if (anchorFrame > end) return anchorFrame - end;
    return 0;
  };

  return (
    [...targetRow.clips].sort(
      (firstClip, secondClip) =>
        distanceFromAnchor(firstClip) - distanceFromAnchor(secondClip) ||
        Math.abs(firstClip.start + firstClip.duration / 2 - anchorFrame) -
          Math.abs(secondClip.start + secondClip.duration / 2 - anchorFrame) ||
        firstClip.start - secondClip.start ||
        firstClip.id.localeCompare(secondClip.id),
    )[0] ?? null
  );
};

export const resizeTextOverlayBoxById = (
  clips: TimelineClip[],
  clipId: string | null,
  {
    handle,
    startX,
    startY,
    startWidth,
    startHeight,
    deltaX,
    deltaY,
  }: {
    handle: CaptionResizeHandle;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    deltaX: number;
    deltaY: number;
  },
): TimelineClip[] => {
  const vector = captionResizeHandleVectors[handle];
  const minimumWidth = 8;
  const minimumHeight = 6;
  let left = startX - startWidth / 2;
  let right = startX + startWidth / 2;
  let top = startY - startHeight / 2;
  let bottom = startY + startHeight / 2;

  if (vector.x < 0) {
    left = Math.max(0, Math.min(right - minimumWidth, left + deltaX));
  } else if (vector.x > 0) {
    right = Math.min(100, Math.max(left + minimumWidth, right + deltaX));
  }
  if (vector.y < 0) {
    top = Math.max(0, Math.min(bottom - minimumHeight, top + deltaY));
  } else if (vector.y > 0) {
    bottom = Math.min(100, Math.max(top + minimumHeight, bottom + deltaY));
  }

  const boxWidth = Math.round((right - left) * 1000) / 1000;
  const boxHeight = Math.round((bottom - top) * 1000) / 1000;
  const x = Math.round(((left + right) / 2) * 1000) / 1000;
  const y = Math.round(((top + bottom) / 2) * 1000) / 1000;
  let changed = false;
  const nextClips = clips.map((clip) => {
    if (clip.id !== clipId || clip.track !== "text" || !clip.text) return clip;
    if (
      clip.text.x === x &&
      clip.text.y === y &&
      clip.text.boxWidth === boxWidth &&
      clip.text.boxHeight === boxHeight
    ) {
      return clip;
    }
    changed = true;
    return {
      ...clip,
      text: { ...clip.text, x, y, boxWidth, boxHeight },
    };
  });

  return changed ? nextClips : clips;
};

export const getRotatedTextResizeDelta = ({
  deltaX,
  deltaY,
  rotation,
  scale = 1,
  previewWidth,
  previewHeight,
}: {
  deltaX: number;
  deltaY: number;
  rotation: number;
  scale?: number;
  previewWidth: number;
  previewHeight: number;
}): { deltaX: number; deltaY: number } => {
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const safeScale = Math.max(0.01, Math.abs(scale));
  const localX = (deltaX * cosine + deltaY * sine) / safeScale;
  const localY = (-deltaX * sine + deltaY * cosine) / safeScale;

  return {
    deltaX:
      Math.abs(localX) < 0.000001
        ? 0
        : (localX / Math.max(1, previewWidth)) * 100,
    deltaY:
      Math.abs(localY) < 0.000001
        ? 0
        : (localY / Math.max(1, previewHeight)) * 100,
  };
};

export const isVideoLayerControlTarget = (
  clip: TimelineClip,
  videoLayer: number,
): boolean => getVideoLayer(clip) === videoLayer && clip.mediaType !== "image";

export const getVideoLayerControlState = (
  clips: TimelineClip[],
  videoLayer: number | null,
): VideoLayerControlState => {
  const targets =
    videoLayer === null
      ? []
      : clips.filter((clip) => isVideoLayerControlTarget(clip, videoLayer));
  const speeds = new Set(targets.map((clip) => clip.speed ?? 1));
  const volumes = new Set(targets.map((clip) => clip.volume ?? 1));

  return {
    hasSelectedVideoLayer: targets.length > 0,
    speed: speeds.size === 1 ? [...speeds][0]! : 1,
    volume: volumes.size === 1 ? [...volumes][0]! : 1,
  };
};

export const getVideoLayerEnd = (
  clips: TimelineClip[],
  videoLayer: number,
): number =>
  clips.reduce(
    (furthestEnd, clip) =>
      getVideoLayer(clip) === videoLayer
        ? Math.max(furthestEnd, clip.start + clip.duration)
        : furthestEnd,
    0,
  );

export type TimelineTransitionBoundary = {
  outgoingClipId: string;
  incomingClipId: string;
  frame: number;
};

const isTransitionTargetClip = (clip: TimelineClip): boolean =>
  (clip.track === "main" || clip.track === "upper") &&
  Boolean(clip.src) &&
  !clip.hidden &&
  clip.mediaType !== "image";

const getOrderedTransitionTargetClips = (
  clips: TimelineClip[],
  videoLayer: number,
) =>
  clips
    .map((clip, index) => ({ clip, index }))
    .filter(
      ({ clip }) =>
        isTransitionTargetClip(clip) && getVideoLayer(clip) === videoLayer,
    )
    .sort(
      (left, right) =>
        left.clip.start - right.clip.start || left.index - right.index,
    )
    .map(({ clip }) => clip);

export const getTimelineTransitionBoundaries = (
  clips: TimelineClip[],
  videoLayer: number,
): TimelineTransitionBoundary[] => {
  const orderedClips = getOrderedTransitionTargetClips(clips, videoLayer);
  const boundaries: TimelineTransitionBoundary[] = [];

  for (let index = 1; index < orderedClips.length; index += 1) {
    const previous = orderedClips[index - 1];
    const current = orderedClips[index];

    if (previous.start + previous.duration === current.start) {
      boundaries.push({
        outgoingClipId: previous.id,
        incomingClipId: current.id,
        frame: current.start,
      });
    }
  }

  return boundaries;
};

const withoutClipTransition = (clip: TimelineClip): TimelineClip => {
  if (!clip.transition) return clip;
  const clipWithoutTransition = {...clip};
  delete clipWithoutTransition.transition;
  return clipWithoutTransition;
};

const normalizeTimelineTransitions = (
  clips: TimelineClip[],
): TimelineClip[] => {
  const adjacentPredecessors = new Map<string, TimelineClip>();
  const videoLayers = new Set(
    clips
      .filter(isTransitionTargetClip)
      .map(getVideoLayer)
      .filter((videoLayer): videoLayer is number => videoLayer !== null),
  );

  for (const videoLayer of videoLayers) {
    const orderedClips = getOrderedTransitionTargetClips(clips, videoLayer);
    for (let index = 1; index < orderedClips.length; index += 1) {
      const previousClip = orderedClips[index - 1];
      const incomingClip = orderedClips[index];
      if (previousClip.start + previousClip.duration === incomingClip.start) {
        adjacentPredecessors.set(incomingClip.id, previousClip);
      }
    }
  }

  let changed = false;
  const normalizedClips = clips.map((clip) => {
    if (!clip.transition) return clip;

    const previousClip = adjacentPredecessors.get(clip.id);
    if (!previousClip) {
      changed = true;
      return withoutClipTransition(clip);
    }

    const requestedDuration = Number.isFinite(clip.transition.duration)
      ? Math.max(1, Math.round(clip.transition.duration))
      : 1;
    const duration = Math.max(
      1,
      Math.min(requestedDuration, previousClip.duration, clip.duration),
    );
    if (duration === clip.transition.duration) return clip;

    changed = true;
    return { ...clip, transition: { ...clip.transition, duration } };
  });

  return changed ? normalizedClips : clips;
};

export const setClipTransitionById = (
  clips: TimelineClip[],
  incomingClipId: string | null,
  preset: ClipTransitionPreset,
  duration: number,
): TimelineClip[] => {
  if (!incomingClipId) {
    return clips;
  }

  const incomingClipIndex = clips.findIndex(
    (clip) => clip.id === incomingClipId,
  );
  if (incomingClipIndex < 0) {
    return clips;
  }

  const incomingClip = clips[incomingClipIndex];
  if (!isTransitionTargetClip(incomingClip)) {
    return clips;
  }

  if (preset === "none") {
    if (!incomingClip.transition) {
      return clips;
    }

    return clips.map((clip) =>
      clip.id === incomingClipId ? withoutClipTransition(clip) : clip,
    );
  }

  const orderedClips = getOrderedTransitionTargetClips(
    clips,
    getVideoLayer(incomingClip) ?? 0,
  );
  const orderedIncomingIndex = orderedClips.findIndex(
    (clip) => clip.id === incomingClipId,
  );
  const previousClip =
    orderedIncomingIndex > 0
      ? orderedClips[orderedIncomingIndex - 1]
      : undefined;

  if (
    !previousClip ||
    previousClip.start + previousClip.duration !== incomingClip.start
  ) {
    return clips;
  }

  const safeDuration = Number.isFinite(duration)
    ? Math.max(1, Math.round(duration))
    : 1;
  const clampedDuration = Math.max(
    1,
    Math.min(safeDuration, previousClip.duration, incomingClip.duration),
  );

  if (
    incomingClip.transition?.preset === preset &&
    incomingClip.transition.duration === clampedDuration
  ) {
    return clips;
  }

  return clips.map((clip) =>
    clip.id === incomingClipId
      ? {
          ...clip,
          transition: {
            preset,
            duration: clampedDuration,
          },
        }
      : clip,
  );
};

const neutralClipTransitionPresentation: ClipTransitionPresentation = {
  opacity: 1,
  translateX: 0,
  scale: 1,
};

export const getClipTransitionPresentation = (
  clips: TimelineClip[],
  clipId: string,
  frame: number,
): ClipTransitionPresentation => {
  for (const incomingClip of clips) {
    if (!incomingClip.transition) continue;

    const boundary = getTimelineTransitionBoundaries(
      clips,
      getVideoLayer(incomingClip) ?? 0,
    ).find((candidate) => candidate.incomingClipId === incomingClip.id);
    if (
      !boundary ||
      (clipId !== boundary.outgoingClipId && clipId !== boundary.incomingClipId)
    ) {
      continue;
    }

    const start =
      boundary.frame - Math.floor(incomingClip.transition.duration / 2);
    const end =
      boundary.frame + Math.ceil(incomingClip.transition.duration / 2);
    if (frame < start || frame > end) continue;

    const progress =
      incomingClip.transition.duration === 1 && frame === boundary.frame
        ? 0.5
        : Math.max(0, Math.min(1, (frame - start) / Math.max(1, end - start)));
    const isOutgoing = clipId === boundary.outgoingClipId;
    const visibility = isOutgoing ? 1 - progress : progress;

    switch (incomingClip.transition.preset) {
      case "fade":
      case "dissolve":
        return { ...neutralClipTransitionPresentation, opacity: visibility };
      case "slide":
        return {
          ...neutralClipTransitionPresentation,
          translateX: isOutgoing ? -12 * progress : 12 * (1 - progress),
        };
      case "zoom":
        return {
          opacity: visibility,
          translateX: 0,
          scale: isOutgoing ? 1 + 0.06 * progress : 0.94 + 0.06 * progress,
        };
    }
  }

  return neutralClipTransitionPresentation;
};

export const getNextVideoLayer = (
  clips: TimelineClip[],
  direction: VideoLayerDirection,
): number => {
  const layers = clips
    .map(getVideoLayer)
    .filter((layer): layer is number => layer !== null && layer !== 0);

  return direction === "above"
    ? Math.max(0, ...layers) + 1
    : Math.min(0, ...layers) - 1;
};

export const replaceVideoLayerRange = (
  clips: TimelineClip[],
  target: {
    videoLayer: number;
    start: number;
    duration: number;
    excludeClipId?: string;
  },
): TimelineClip[] => {
  const start = Math.max(0, Math.round(target.start));
  const duration = Math.max(1, Math.round(target.duration));
  const replacedIds = new Set(
    clips
      .filter(
        (clip) =>
          clip.id !== target.excludeClipId &&
          getVideoLayer(clip) === target.videoLayer &&
          clipRangesOverlap(start, duration, clip.start, clip.duration),
      )
      .flatMap((clip) => {
        const linkedAudio = getReciprocalLinkedAudio(clips, clip);
        return [clip.id, ...(linkedAudio ? [linkedAudio.id] : [])];
      }),
  );

  if (replacedIds.size === 0) {
    return clips;
  }

  return normalizeTimelineTransitions(
    clips.filter((clip) => !replacedIds.has(clip.id)),
  );
};

const getSnappedVideoStart = (
  clips: TimelineClip[],
  clipId: string,
  videoLayer: number,
  proposedStart: number,
  duration: number,
): number => {
  const occupied = clips
    .filter((clip) => clip.id !== clipId && getVideoLayer(clip) === videoLayer)
    .sort((first, second) => first.start - second.start);
  let start = Math.max(0, Math.round(proposedStart));
  const firstCollision = occupied.find((clip) =>
    clipRangesOverlap(start, duration, clip.start, clip.duration),
  );

  if (!firstCollision) {
    return start;
  }

  const dropAfter =
    start + duration / 2 >= firstCollision.start + firstCollision.duration / 2;
  const scanOrder = dropAfter ? occupied : [...occupied].reverse();

  for (const clip of scanOrder) {
    if (!clipRangesOverlap(start, duration, clip.start, clip.duration)) {
      continue;
    }
    start = dropAfter
      ? clip.start + clip.duration
      : Math.max(0, clip.start - duration);
  }

  return start;
};

export const getVideoClipDragPreviewStart = (
  clips: TimelineClip[],
  clipId: string,
  proposedStart: number,
  timelineBoundary?: number,
): number => {
  const target = clips.find(
    (clip) => clip.id === clipId && getVideoLayer(clip) !== null,
  );
  if (!target) return Math.max(0, Math.round(proposedStart));

  return timelineBoundary === undefined
    ? Math.max(0, Math.round(proposedStart))
    : clampTimelineStart(proposedStart, target.duration, timelineBoundary);
};

const maximumAccidentalVideoOverlapFrames = 15;

const resolveVideoLayerCollision = (
  clips: TimelineClip[],
  clipId: string,
  videoLayer: number,
  start: number,
  duration: number,
): number | null => {
  const end = start + duration;
  const collisions = clips.filter(
    (clip) =>
      clip.id !== clipId &&
      getVideoLayer(clip) === videoLayer &&
      start < clip.start + clip.duration &&
      end > clip.start,
  );
  if (collisions.length === 0) return start;
  if (collisions.length !== 1) return null;

  const collision = collisions[0];
  const overlap =
    Math.min(end, collision.start + collision.duration) -
    Math.max(start, collision.start);
  if (overlap > maximumAccidentalVideoOverlapFrames) return null;

  const snappedStart =
    start >= collision.start
      ? collision.start + collision.duration
      : collision.start - duration;
  if (snappedStart < 0) return null;

  const hasSecondaryCollision = clips.some(
    (clip) =>
      clip.id !== clipId &&
      clip.id !== collision.id &&
      getVideoLayer(clip) === videoLayer &&
      clipRangesOverlap(
        snappedStart,
        duration,
        clip.start,
        clip.duration,
      ),
  );
  return hasSecondaryCollision ? null : snappedStart;
};

export const placeVideoPairOnLayer = (
  clips: TimelineClip[],
  pair: TimelineClip[],
  videoLayer: number,
  start: number,
): TimelineClip[] => {
  const video = pair.find(
    (clip) => clip.track === "main" || clip.track === "upper",
  );
  if (!video) return clips;

  const clampedStart = getSnappedVideoStart(
    clips,
    video.id,
    videoLayer,
    start,
    video.duration,
  );
  const track: "main" | "upper" = videoLayer === 0 ? "main" : "upper";

  return normalizeTimelineTransitions([
    ...clips,
    ...pair.map((clip) =>
      clip.id === video.id
        ? {
            ...clip,
            track,
            start: clampedStart,
            videoLayer: videoLayer === 0 ? undefined : videoLayer,
            overlayLane: undefined,
          }
        : { ...clip, start: clampedStart },
    ),
  ]);
};

const shiftVideoLayerForInsert = (
  clip: TimelineClip,
  insertedVideoLayer: number,
): TimelineClip => {
  const currentLayer = getVideoLayer(clip);
  if (currentLayer === null || currentLayer === 0) {
    return clip;
  }

  const shouldShiftUp =
    insertedVideoLayer > 0 && currentLayer >= insertedVideoLayer;
  const shouldShiftDown =
    insertedVideoLayer < 0 && currentLayer <= insertedVideoLayer;

  if (!shouldShiftUp && !shouldShiftDown) {
    return clip;
  }

  return {
    ...clip,
    videoLayer: currentLayer + (insertedVideoLayer > 0 ? 1 : -1),
    overlayLane: undefined,
  };
};

export const placeVideoPairInInsertedLayer = (
  clips: TimelineClip[],
  pair: TimelineClip[],
  insertedVideoLayer: number,
  start: number,
): TimelineClip[] => {
  if (insertedVideoLayer === 0) {
    return placeVideoPairOnLayer(clips, pair, 0, start);
  }

  const shiftedClips = clips.map((clip) =>
    shiftVideoLayerForInsert(clip, insertedVideoLayer),
  );
  return placeVideoPairOnLayer(shiftedClips, pair, insertedVideoLayer, start);
};

export const moveVideoClipToLayer = (
  clips: TimelineClip[],
  clipId: string,
  videoLayer: number,
  targetStart: number,
  timelineBoundary?: number,
): TimelineClip[] => {
  const target = clips.find(
    (clip) => clip.id === clipId && getVideoLayer(clip) !== null,
  );
  if (!target) return clips;

  const proposedStart =
    timelineBoundary === undefined
      ? Math.max(0, Math.round(targetStart))
      : clampTimelineStart(targetStart, target.duration, timelineBoundary);
  const currentLayer = getVideoLayer(target);
  const start = resolveVideoLayerCollision(
    clips,
    target.id,
    videoLayer,
    proposedStart,
    target.duration,
  );
  if (start === null) return clips;
  const linkedAudio = getReciprocalLinkedAudio(clips, target);

  if (start === target.start && videoLayer === currentLayer) {
    return clips;
  }

  const track: "main" | "upper" = videoLayer === 0 ? "main" : "upper";

  return normalizeTimelineTransitions(
    clips.map((clip) =>
      clip.id === target.id
        ? {
            ...clip,
            track,
            start,
            videoLayer: videoLayer === 0 ? undefined : videoLayer,
            overlayLane: undefined,
          }
        : clip.id === linkedAudio?.id
          ? { ...clip, start }
          : clip,
    ),
  );
};

const isAudioOwnedByVideo = (
  audioClip: TimelineClip,
  videoClip: TimelineClip,
): boolean => {
  if (
    audioClip.track !== "audio" ||
    (videoClip.track !== "main" &&
      videoClip.track !== "upper" &&
      videoClip.track !== "cutout")
  ) {
    return false;
  }

  const isReciprocalPair =
    videoClip.linkedClipId === audioClip.id &&
    audioClip.linkedClipId === videoClip.id;
  const isLegacyOriginalAudio =
    !audioClip.linkedClipId &&
    Boolean(videoClip.src) &&
    audioClip.src === videoClip.src &&
    audioClip.start === videoClip.start &&
    audioClip.duration === videoClip.duration &&
    (audioClip.sourceStart ?? 0) === (videoClip.sourceStart ?? 0);

  return isReciprocalPair || isLegacyOriginalAudio;
};

export const getOwnedAudioClip = (
  clips: TimelineClip[],
  videoClip: TimelineClip,
): TimelineClip | undefined => {
  return (
    getReciprocalLinkedAudio(clips, videoClip) ??
    clips.find((clip) => isAudioOwnedByVideo(clip, videoClip))
  );
};

export const shouldMuteVideoNativeAudio = (
  clips: TimelineClip[],
  frame: number,
  videoClipId: string | null,
): boolean => {
  const winningVideo = getWinningVideoClipAtFrame(clips, frame);

  return (
    !winningVideo ||
    winningVideo.id !== videoClipId ||
    Boolean(getOwnedAudioClip(clips, winningVideo))
  );
};

const resolvePairOperationTarget = (
  clips: TimelineClip[],
  selectedClip: TimelineClip,
): TimelineClip => {
  if (selectedClip.track !== "audio" || !selectedClip.linkedClipId) {
    return selectedClip;
  }

  return (
    clips.find(
      (clip) =>
        (clip.track === "main" || clip.track === "upper") &&
        clip.id === selectedClip.linkedClipId &&
        clip.linkedClipId === selectedClip.id,
    ) ?? selectedClip
  );
};

export const deleteClipById = (
  clips: TimelineClip[],
  clipId: string | null,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  const selectedClip = clips.find((clip) => clip.id === clipId);
  if (!selectedClip) {
    return clips;
  }

  const target = resolvePairOperationTarget(clips, selectedClip);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);
  const deletedIds = new Set([target.id, linkedAudio?.id]);

  return normalizeTimelineTransitions(
    clips.filter((clip) => !deletedIds.has(clip.id)),
  );
};

const duplicateLabel = (label: string): string =>
  `${label.replace(/ copy$/, "")} copy`;

export const duplicateClipById = (
  clips: TimelineClip[],
  clipId: string | null,
  idPrefix: string,
): TimelineClip[] => {
  if (!clipId || !idPrefix) {
    return clips;
  }

  const selectedClip = clips.find((clip) => clip.id === clipId);
  if (!selectedClip) {
    return clips;
  }

  const target = resolvePairOperationTarget(clips, selectedClip);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);
  const copyLayer = getNextVideoLayer(clips, "above");
  const copyStart = target.start;

  const duplicatedVideo: TimelineClip = {
    ...withoutClipTransition(target),
    id: `${idPrefix}-video`,
    label: duplicateLabel(target.label),
    track: "upper",
    start: copyStart,
    overlayLane: undefined,
    videoLayer: copyLayer,
    linkedClipId: linkedAudio ? `${idPrefix}-audio` : target.linkedClipId,
  };

  if (!linkedAudio) {
    return [...clips, duplicatedVideo];
  }

  const duplicatedAudio: TimelineClip = {
    ...withoutClipTransition(linkedAudio),
    id: `${idPrefix}-audio`,
    label: duplicateLabel(linkedAudio.label),
    start: copyStart,
    linkedClipId: duplicatedVideo.id,
  };

  return [...clips, duplicatedVideo, duplicatedAudio];
};

export const toggleClipMuteById = (
  clips: TimelineClip[],
  clipId: string | null,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  const selectedClip = clips.find((clip) => clip.id === clipId);
  if (!selectedClip) {
    return clips;
  }

  const target = resolvePairOperationTarget(clips, selectedClip);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);
  const targetIds = new Set([target.id, linkedAudio?.id]);
  const shouldUnmute = [target, linkedAudio]
    .filter((clip): clip is TimelineClip => Boolean(clip))
    .every((clip) => (clip.volume ?? 1) === 0);
  const nextVolume = shouldUnmute ? 1 : 0;

  return clips.map((clip) =>
    targetIds.has(clip.id) ? { ...clip, volume: nextVolume } : clip,
  );
};

export const toggleClipVisibilityById = (
  clips: TimelineClip[],
  clipId: string | null,
): TimelineClip[] => {
  if (!clipId || !clips.some((clip) => clip.id === clipId)) {
    return clips;
  }

  return clips.map((clip) =>
    clip.id === clipId ? { ...clip, hidden: !clip.hidden } : clip,
  );
};

const getTrackVisibilityTargets = (
  clips: TimelineClip[],
  track: TrackName,
  videoLayer: number | null,
  targetClipIds?: readonly string[],
): TimelineClip[] => {
  const targetIds = targetClipIds ? new Set(targetClipIds) : null;

  return clips.filter((clip) => {
    if (targetIds) {
      return targetIds.has(clip.id);
    }

    if ((track === "main" || track === "upper") && videoLayer !== null) {
      return getVideoLayer(clip) === videoLayer;
    }

    return clip.track === track;
  });
};

export const isTrackHidden = (
  clips: TimelineClip[],
  track: TrackName,
  videoLayer: number | null = null,
  targetClipIds?: readonly string[],
): boolean => {
  const targets = getTrackVisibilityTargets(
    clips,
    track,
    videoLayer,
    targetClipIds,
  );
  return targets.length > 0 && targets.every((clip) => clip.hidden);
};

export const toggleTrackVisibility = (
  clips: TimelineClip[],
  track: TrackName,
  videoLayer: number | null = null,
  targetClipIds?: readonly string[],
): TimelineClip[] => {
  const targets = getTrackVisibilityTargets(
    clips,
    track,
    videoLayer,
    targetClipIds,
  );
  if (targets.length === 0) {
    return clips;
  }

  const shouldHide = !targets.every((clip) => clip.hidden);
  const targetIds = new Set(targets.map((clip) => clip.id));
  const linkedAudioIds = new Set(
    targets
      .filter(
        (clip) =>
          clip.track === "main" ||
          clip.track === "upper" ||
          clip.track === "cutout",
      )
      .map((clip) => clip.linkedClipId)
      .filter((clipId): clipId is string => Boolean(clipId)),
  );

  return clips.map((clip) => {
    if (targetIds.has(clip.id)) {
      return { ...clip, hidden: shouldHide };
    }

    if (
      clip.track === "audio" &&
      linkedAudioIds.has(clip.id) &&
      targets.some((videoClip) => videoClip.id === clip.linkedClipId)
    ) {
      return { ...clip, hidden: shouldHide };
    }

    return clip;
  });
};

export const getClipSourceTime = (
  clip: TimelineClip,
  playheadFrame: number,
  fps: number,
): number => {
  const speed =
    Number.isFinite(clip.speed) && (clip.speed ?? 0) > 0
      ? (clip.speed ?? 1)
      : 1;
  const sourceFrame =
    (clip.sourceStart ?? 0) + Math.max(0, playheadFrame - clip.start) * speed;
  const boundedSourceFrame = Number.isFinite(clip.sourceDuration)
    ? Math.min(sourceFrame, Math.max(0, (clip.sourceDuration ?? 1) - 1))
    : sourceFrame;

  return boundedSourceFrame / fps;
};

export const synchronizeOriginalAudio = (
  clips: TimelineClip[],
): TimelineClip[] => {
  const linkedPairs = new Map<string, TimelineClip>();

  clips
    .filter((clip) => clip.track === "main" && clip.src)
    .forEach((mainClip) => {
      const audioClip = mainClip.linkedClipId
        ? clips.find(
            (clip) =>
              clip.id === mainClip.linkedClipId && clip.track === "audio",
          )
        : clips.find(
            (clip) =>
              clip.track === "audio" &&
              clip.src === mainClip.src &&
              clip.start === mainClip.start &&
              (clip.sourceStart ?? 0) === (mainClip.sourceStart ?? 0),
          );

      if (audioClip) {
        linkedPairs.set(mainClip.id, audioClip);
        linkedPairs.set(audioClip.id, mainClip);
      }
    });

  let changed = false;
  const synchronized = clips.map((clip) => {
    const partner = linkedPairs.get(clip.id);
    if (!partner) return clip;

    const mainClip = clip.track === "main" ? clip : partner;
    const nextClip =
      clip.track === "audio"
        ? {
            ...clip,
            start: mainClip.start,
            duration: mainClip.duration,
            sourceStart: mainClip.sourceStart ?? 0,
            linkedClipId: mainClip.id,
          }
        : {
            ...clip,
            linkedClipId: partner.id,
          };

    if (
      nextClip.start !== clip.start ||
      nextClip.duration !== clip.duration ||
      nextClip.sourceStart !== clip.sourceStart ||
      nextClip.linkedClipId !== clip.linkedClipId
    ) {
      changed = true;
    }

    return nextClip;
  });

  return changed ? synchronized : clips;
};

export const trimClipById = (
  clips: TimelineClip[],
  clipId: string,
  edge: "left" | "right",
  frameDelta: number,
  minimumDuration = 15,
): TimelineClip[] => {
  const target = clips.find((clip) => clip.id === clipId);

  if (!target) {
    return clips;
  }

  const sourceFramesRemaining = Number.isFinite(target.sourceDuration)
    ? Math.max(
        1,
        Math.floor(
          ((target.sourceDuration ?? 1) - (target.sourceStart ?? 0)) /
            Math.max(0.01, target.speed ?? 1),
        ),
      )
    : Number.POSITIVE_INFINITY;
  const appliedDelta =
    edge === "left"
      ? Math.max(
          -target.start,
          Math.min(frameDelta, target.duration - minimumDuration),
        )
      : Math.min(
          sourceFramesRemaining - target.duration,
          Math.max(minimumDuration - target.duration, frameDelta),
        );
  const nextStart =
    edge === "left" ? target.start + appliedDelta : target.start;
  const nextDuration =
    edge === "left"
      ? target.duration - appliedDelta
      : Math.max(minimumDuration, target.duration + appliedDelta);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);

  const trimmedClips = clips.map((clip) => {
    if (clip.id !== clipId && clip.id !== linkedAudio?.id) {
      return clip;
    }

    return {
      ...clip,
      start: nextStart,
      duration: nextDuration,
      sourceStart:
        edge === "left"
          ? Math.max(
              0,
              (clip.sourceStart ?? 0) +
                appliedDelta * Math.max(0.01, clip.speed ?? 1),
            )
          : (clip.sourceStart ?? 0),
    };
  });

  return normalizeTimelineTransitions(trimmedClips);
};

export const replaceClipMediaById = (
  clips: TimelineClip[],
  clipId: string,
  media: { label: string; src: string },
): TimelineClip[] => {
  const target = clips.find((clip) => clip.id === clipId);
  const linkedAudioId =
    target?.track === "audio" ? undefined : target?.linkedClipId;

  return clips.map((clip) => {
    if (clip.id !== clipId && clip.id !== linkedAudioId) {
      return clip;
    }

    return {
      ...clip,
      label: clip.id === linkedAudioId ? `${media.label} audio` : media.label,
      src: media.src,
    };
  });
};

export const getPublicMediaFallbackSource = (
  clip: Pick<TimelineClip, "label" | "src">,
): string | null => {
  const extension = (clip.src ?? "")
    .split(/[?#]/)[0]
    ?.match(/\.[a-z0-9]+$/i)?.[0];
  const label = clip.label
    .replace(/\s+audio$/i, "")
    .replace(/\s+-\s+Scene\s+\d+$/i, "")
    .trim();

  if (!extension || !label || /[\\/:*?"<>|]/.test(label)) {
    return null;
  }

  return new RegExp(`${extension.replace(".", "\\.")}$`, "i").test(label)
    ? label
    : `${label}${extension}`;
};

export const isPlayableMediaResponse = (response: {
  ok: boolean;
  headers: { get: (name: string) => string | null };
}): boolean =>
  response.ok &&
  /^(video|audio)\//i.test(response.headers.get("content-type") ?? "");

export const isStoredUploadSource = (src?: string): boolean =>
  /^\/?uploads\//i.test(src ?? "");

export const reconnectMediaSource = (
  clips: TimelineClip[],
  missingSrc: string,
  replacementSrc: string,
): TimelineClip[] => {
  if (!missingSrc || !replacementSrc || missingSrc === replacementSrc) {
    return clips;
  }

  let changed = false;
  const reconnected = clips.map((clip) => {
    if (clip.src !== missingSrc) return clip;

    changed = true;
    const reconnectedClip = { ...clip, src: replacementSrc };
    delete reconnectedClip.sourceDuration;
    return reconnectedClip;
  });

  return changed ? reconnected : clips;
};

export const addOverlayMediaClip = (
  clips: TimelineClip[],
  media: {
    id: string;
    label: string;
    src: string;
    start: number;
    duration: number;
  },
): TimelineClip[] => {
  return [
    ...clips,
    {
      id: media.id,
      label: media.label,
      track: "upper",
      start: media.start,
      duration: media.duration,
      color: "#7c3aed",
      src: media.src,
      speed: 1,
      volume: 1,
      overlayLane: findAvailableOverlayLane(clips, media.start, media.duration),
    },
  ];
};

export const splitClipByIdAtFrame = (
  clips: TimelineClip[],
  clipId: string,
  frame: number,
): TimelineClip[] => {
  const clipToSplit = clips.find(
    (clip) =>
      clip.id === clipId &&
      frame > clip.start &&
      frame < clip.start + clip.duration,
  );

  if (!clipToSplit) {
    return clips;
  }

  const firstDuration = frame - clipToSplit.start;
  const secondDuration = clipToSplit.duration - firstDuration;
  const linkedAudio = getReciprocalLinkedAudio(clips, clipToSplit);

  const splitClips = clips.flatMap((clip) => {
    if (clip.id !== clipId && clip.id !== linkedAudio?.id) {
      return [clip];
    }

    const isLinkedAudio = clip.id === linkedAudio?.id;
    const firstId = `${clip.id}-a`;
    const secondId = `${clip.id}-b`;
    const firstLinkedClipId = isLinkedAudio
      ? `${clipToSplit.id}-a`
      : linkedAudio
        ? `${linkedAudio.id}-a`
        : clip.linkedClipId;
    const secondLinkedClipId = isLinkedAudio
      ? `${clipToSplit.id}-b`
      : linkedAudio
        ? `${linkedAudio.id}-b`
        : clip.linkedClipId;

    return [
      {
        ...clip,
        id: firstId,
        duration: firstDuration,
        ...(linkedAudio ? { linkedClipId: firstLinkedClipId } : {}),
      },
      {
        ...withoutClipTransition(clip),
        id: secondId,
        start: frame,
        duration: secondDuration,
        sourceStart:
          (clip.sourceStart ?? 0) +
          firstDuration * Math.max(0.01, clip.speed ?? 1),
        ...(linkedAudio ? { linkedClipId: secondLinkedClipId } : {}),
      },
    ];
  });

  return normalizeTimelineTransitions(splitClips);
};

export const insertVideoPairOnLayerAtFrame = (
  clips: TimelineClip[],
  pair: TimelineClip[],
  videoLayer: number,
  frame: number,
): TimelineClip[] => {
  const video = pair.find(
    (clip) => clip.track === "main" || clip.track === "upper",
  );
  if (!video) return clips;

  const insertFrame = Math.max(0, Math.round(frame));
  const clipUnderMarker = clips.find(
    (clip) =>
      getVideoLayer(clip) === videoLayer &&
      insertFrame > clip.start &&
      insertFrame < clip.start + clip.duration,
  );
  const preparedClips = clipUnderMarker
    ? splitClipByIdAtFrame(clips, clipUnderMarker.id, insertFrame)
    : clips;
  const shiftedIds = new Set<string>();

  preparedClips.forEach((clip) => {
    if (getVideoLayer(clip) !== videoLayer || clip.start < insertFrame) return;
    shiftedIds.add(clip.id);
    const linkedAudio = getReciprocalLinkedAudio(preparedClips, clip);
    if (linkedAudio) shiftedIds.add(linkedAudio.id);
  });

  const track: "main" | "upper" = videoLayer === 0 ? "main" : "upper";
  const shiftedClips = preparedClips.map((clip) =>
    shiftedIds.has(clip.id)
      ? { ...clip, start: clip.start + video.duration }
      : clip,
  );
  const insertedPair = pair.map((clip) =>
    clip.id === video.id
      ? {
          ...clip,
          track,
          start: insertFrame,
          videoLayer: videoLayer === 0 ? undefined : videoLayer,
          overlayLane: undefined,
        }
      : { ...clip, start: insertFrame },
  );

  return normalizeTimelineTransitions([...shiftedClips, ...insertedPair]);
};

type SilenceRange = {
  startSeconds: number;
  endSeconds: number;
};

const hasValidSourceRanges = (ranges: unknown): ranges is SilenceRange[] =>
  Array.isArray(ranges) &&
  ranges.every((range) => {
    if (!range || typeof range !== "object") return false;

    const { startSeconds, endSeconds } = range as Partial<SilenceRange>;
    return (
      typeof startSeconds === "number" &&
      typeof endSeconds === "number" &&
      Number.isFinite(startSeconds) &&
      Number.isFinite(endSeconds) &&
      endSeconds > startSeconds
    );
  });

const normalizeSourceRanges = (
  ranges: SilenceRange[],
  sourceDurationSeconds: number,
): SilenceRange[] => {
  const normalized = ranges
    .flatMap((range) => {
      if (
        !Number.isFinite(range.startSeconds) ||
        !Number.isFinite(range.endSeconds) ||
        range.endSeconds <= range.startSeconds
      ) {
        return [];
      }

      const startSeconds = Math.max(
        0,
        Math.min(sourceDurationSeconds, range.startSeconds),
      );
      const endSeconds = Math.max(
        0,
        Math.min(sourceDurationSeconds, range.endSeconds),
      );

      return endSeconds > startSeconds ? [{ startSeconds, endSeconds }] : [];
    })
    .sort((left, right) => left.startSeconds - right.startSeconds);

  return normalized.reduce<SilenceRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.startSeconds > previous.endSeconds) {
      merged.push({ ...range });
      return merged;
    }

    previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    return merged;
  }, []);
};

export const subtractSourceRanges = (
  retainedRanges: SilenceRange[],
  removedRanges: SilenceRange[],
  sourceDurationSeconds: number,
): SilenceRange[] => {
  if (
    !hasValidSourceRanges(retainedRanges) ||
    !Array.isArray(removedRanges) ||
    !Number.isFinite(sourceDurationSeconds) ||
    sourceDurationSeconds <= 0
  ) {
    return [];
  }

  const retained = normalizeSourceRanges(retainedRanges, sourceDurationSeconds);
  const removed = normalizeSourceRanges(removedRanges, sourceDurationSeconds);

  return retained.flatMap((range) => {
    let fragments = [{ ...range }];

    for (const removedRange of removed) {
      fragments = fragments.flatMap((fragment) => {
        if (
          removedRange.endSeconds <= fragment.startSeconds ||
          removedRange.startSeconds >= fragment.endSeconds
        ) {
          return [fragment];
        }

        const nextFragments: SilenceRange[] = [];
        if (removedRange.startSeconds > fragment.startSeconds) {
          nextFragments.push({
            startSeconds: fragment.startSeconds,
            endSeconds: Math.min(
              fragment.endSeconds,
              removedRange.startSeconds,
            ),
          });
        }
        if (removedRange.endSeconds < fragment.endSeconds) {
          nextFragments.push({
            startSeconds: Math.max(
              fragment.startSeconds,
              removedRange.endSeconds,
            ),
            endSeconds: fragment.endSeconds,
          });
        }
        return nextFragments;
      });
    }

    return fragments;
  });
};

export const intersectSourceRanges = (
  leftRanges: SilenceRange[],
  rightRanges: SilenceRange[],
  sourceDurationSeconds: number,
): SilenceRange[] => {
  if (
    !hasValidSourceRanges(leftRanges) ||
    !hasValidSourceRanges(rightRanges) ||
    !Number.isFinite(sourceDurationSeconds) ||
    sourceDurationSeconds <= 0
  ) {
    return [];
  }

  const left = normalizeSourceRanges(leftRanges, sourceDurationSeconds);
  const right = normalizeSourceRanges(rightRanges, sourceDurationSeconds);
  const intersections: SilenceRange[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    const startSeconds = Math.max(
      left[leftIndex].startSeconds,
      right[rightIndex].startSeconds,
    );
    const endSeconds = Math.min(
      left[leftIndex].endSeconds,
      right[rightIndex].endSeconds,
    );
    if (endSeconds > startSeconds) {
      intersections.push({startSeconds, endSeconds});
    }

    if (left[leftIndex].endSeconds <= right[rightIndex].endSeconds) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }

  return intersections;
};

type TimelineSourceSegment = {
  start: number;
  duration: number;
  sourceOffset: number;
};

const createTimelineSourceSegments = (
  videoClip: TimelineClip,
  ranges: SilenceRange[],
  fps: number,
): TimelineSourceSegment[] => {
  const speed = videoClip.speed ?? 1;
  let compactDuration = 0;

  return ranges.flatMap((range) => {
    const timelineStart = Math.round((range.startSeconds * fps) / speed);
    const timelineEnd = Math.round((range.endSeconds * fps) / speed);
    const duration = timelineEnd - timelineStart;
    if (duration <= 0) {
      return [];
    }

    const segment = {
      start: videoClip.start + compactDuration,
      duration,
      sourceOffset: Math.round(range.startSeconds * fps),
    };
    compactDuration += duration;
    return [segment];
  });
};

const createSynchronizedLinkedSegments = (
  videoClip: TimelineClip,
  linkedAudio: TimelineClip,
  ranges: SilenceRange[],
  fps: number,
  segmentLabel: string,
  audioReplacementSrc?: string,
): {
  videoSegments: TimelineClip[];
  audioSegments: TimelineClip[];
  compactDuration: number;
} => {
  const timelineSegments = createTimelineSourceSegments(videoClip, ranges, fps);
  const compactDuration = timelineSegments.reduce(
    (total, segment) => total + segment.duration,
    0,
  );

  return {
    videoSegments: timelineSegments.map<TimelineClip>((segment, index) => ({
      ...(index === 0 ? videoClip : withoutClipTransition(videoClip)),
      id: `${videoClip.id}-${segmentLabel}-${index}`,
      start: segment.start,
      duration: segment.duration,
      sourceStart: (videoClip.sourceStart ?? 0) + segment.sourceOffset,
      linkedClipId: `${linkedAudio.id}-${segmentLabel}-${index}`,
    })),
    audioSegments: timelineSegments.map<TimelineClip>((segment, index) => ({
      ...linkedAudio,
      id: `${linkedAudio.id}-${segmentLabel}-${index}`,
      start: segment.start,
      duration: segment.duration,
      sourceStart: (linkedAudio.sourceStart ?? 0) + segment.sourceOffset,
      linkedClipId: `${videoClip.id}-${segmentLabel}-${index}`,
      ...(audioReplacementSrc ? {src: audioReplacementSrc} : {}),
    })),
    compactDuration,
  };
};

export const removeSilenceFromLinkedVideo = (
  clips: TimelineClip[],
  videoClipId: string,
  ranges: SilenceRange[],
  fps: number,
): TimelineClip[] => {
  const videoClip = clips.find(
    (clip) =>
      clip.id === videoClipId &&
      (clip.track === "main" ||
        clip.track === "upper" ||
        clip.track === "cutout") &&
      Boolean(clip.src),
  );
  const speed = videoClip?.speed ?? 1;
  const linkedAudio = videoClip
    ? getReciprocalLinkedAudio(clips, videoClip)
    : undefined;

  if (
    !videoClip ||
    !linkedAudio ||
    !Array.isArray(ranges) ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    !Number.isFinite(videoClip.start) ||
    !Number.isFinite(videoClip.duration) ||
    videoClip.duration <= 0 ||
    !Number.isFinite(videoClip.sourceStart ?? 0)
  ) {
    return clips;
  }

  const sourceDurationSeconds = (videoClip.duration * speed) / fps;
  const silenceRanges = normalizeSourceRanges(ranges, sourceDurationSeconds);
  if (silenceRanges.length === 0) {
    return clips;
  }

  const speechRanges: SilenceRange[] = [];
  let speechStartSeconds = 0;
  for (const silenceRange of silenceRanges) {
    if (silenceRange.startSeconds > speechStartSeconds) {
      speechRanges.push({
        startSeconds: speechStartSeconds,
        endSeconds: silenceRange.startSeconds,
      });
    }
    speechStartSeconds = silenceRange.endSeconds;
  }
  if (speechStartSeconds < sourceDurationSeconds) {
    speechRanges.push({
      startSeconds: speechStartSeconds,
      endSeconds: sourceDurationSeconds,
    });
  }

  const { videoSegments, audioSegments, compactDuration } =
    createSynchronizedLinkedSegments(
      videoClip,
      linkedAudio,
      speechRanges,
      fps,
      "speech",
    );
  const removedFrames = videoClip.duration - compactDuration;
  if (removedFrames <= 0) {
    return clips;
  }

  const selectedLayer = getVideoLayer(videoClip);
  const selectedEnd = videoClip.start + videoClip.duration;
  const rippleIds = new Set<string>();
  clips.forEach((clip) => {
    if (
      clip.id === videoClip.id ||
      getVideoLayer(clip) !== selectedLayer ||
      clip.start < selectedEnd
    ) {
      return;
    }

    rippleIds.add(clip.id);
    const clipAudio = getReciprocalLinkedAudio(clips, clip);
    if (clipAudio) {
      rippleIds.add(clipAudio.id);
    }
  });

  const nextClips = clips.flatMap((clip) => {
    if (
      clip.track === "caption" &&
      clip.caption?.generationId?.startsWith("transcript-") &&
      clip.caption.sourceClipId === videoClip.id
    ) {
      return [];
    }
    if (clip.id === videoClip.id) {
      return videoSegments;
    }
    if (clip.id === linkedAudio?.id) {
      return audioSegments;
    }
    if (rippleIds.has(clip.id)) {
      return [{ ...clip, start: clip.start - removedFrames }];
    }
    return [clip];
  });

  return normalizeTimelineTransitions(nextClips);
};

export const keepDominantVoiceInLinkedVideo = (
  clips: TimelineClip[],
  videoClipId: string,
  ranges: SilenceRange[],
  fps: number,
  cleanedSrc?: string,
): TimelineClip[] => {
  const videoClip = clips.find(
    (clip) =>
      clip.id === videoClipId &&
      (clip.track === "main" || clip.track === "upper") &&
      clip.mediaType !== "image" &&
      Boolean(clip.src),
  );
  const speed = videoClip?.speed ?? 1;
  const linkedAudio = videoClip
    ? getReciprocalLinkedAudio(clips, videoClip)
    : undefined;

  if (
    !videoClip ||
    !linkedAudio ||
    !hasValidSourceRanges(ranges) ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    !Number.isFinite(videoClip.start) ||
    !Number.isFinite(videoClip.duration) ||
    videoClip.duration <= 0 ||
    !Number.isFinite(videoClip.sourceStart ?? 0)
  ) {
    return clips;
  }

  const sourceDurationSeconds = (videoClip.duration * speed) / fps;
  const retainedRanges = normalizeSourceRanges(ranges, sourceDurationSeconds);
  if (retainedRanges.length === 0) {
    return clips;
  }

  const { videoSegments, audioSegments, compactDuration } =
    createSynchronizedLinkedSegments(
      videoClip,
      linkedAudio,
      retainedRanges,
      fps,
      "dominant",
      cleanedSrc,
    );
  const removedFrames = videoClip.duration - compactDuration;
  if (videoSegments.length === 0) {
    return clips;
  }

  if (removedFrames <= 0) {
    if (!cleanedSrc?.trim()) return clips;
    return clips.map((clip) =>
      clip.id === linkedAudio.id
        ? {...clip, src: cleanedSrc}
        : clip,
    );
  }

  const selectedEnd = videoClip.start + videoClip.duration;
  const nextClips = clips.flatMap((clip) => {
    if (
      clip.track === "caption" &&
      clip.caption?.generationId?.startsWith("transcript-") &&
      clip.caption.sourceClipId === videoClip.id
    ) {
      return [];
    }
    if (clip.id === videoClip.id) {
      return videoSegments;
    }
    if (clip.id === linkedAudio.id) {
      return audioSegments;
    }
    if (
      videoClip.track === "main" &&
      clip.track === "main" &&
      clip.mediaType !== "image" &&
      clip.start >= selectedEnd
    ) {
      return [{ ...clip, start: clip.start - removedFrames }];
    }
    return [clip];
  });

  return nextClips;
};

const getComparableMediaLabel = (label: string): string =>
  label
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const restoreDominantVideoSources = (
  clips: TimelineClip[],
  mediaItems: SavedMediaItem[],
): TimelineClip[] => {
  let changed = false;
  const restored = clips.map((clip) => {
    if (
      (clip.track !== "main" && clip.track !== "upper") ||
      !clip.id.includes("-dominant-") ||
      !clip.src
    ) {
      return clip;
    }

    const clipLabel = getComparableMediaLabel(clip.label);
    const sourceMedia = mediaItems.find(
      (item) =>
        item.mediaType !== "image" &&
        (getComparableMediaLabel(item.label) === clipLabel ||
          (item.sourceLabel
            ? getComparableMediaLabel(item.sourceLabel) === clipLabel
            : false)),
    );
    if (!sourceMedia || sourceMedia.src === clip.src) return clip;

    changed = true;
    return {...clip, src: sourceMedia.src};
  });

  return changed ? restored : clips;
};

export const ensureLinkedAudioForVideo = (
  clips: TimelineClip[],
  videoClipId: string,
): TimelineClip[] => {
  const videoClip = clips.find(
    (clip) =>
      clip.id === videoClipId &&
      (clip.track === "main" || clip.track === "upper") &&
      clip.mediaType !== "image" &&
      Boolean(clip.src),
  );
  if (!videoClip?.src) return clips;

  const reciprocalAudio = getReciprocalLinkedAudio(clips, videoClip);
  if (reciprocalAudio) return clips;

  const matchingAudio = clips.find(
    (clip) =>
      clip.track === "audio" &&
      clip.src === videoClip.src &&
      clip.start === videoClip.start &&
      (clip.sourceStart ?? 0) === (videoClip.sourceStart ?? 0),
  );
  if (matchingAudio) {
    return clips.map((clip) => {
      if (clip.id === videoClip.id) {
        return {...clip, linkedClipId: matchingAudio.id};
      }
      if (clip.id === matchingAudio.id) {
        return {
          ...clip,
          duration: videoClip.duration,
          linkedClipId: videoClip.id,
        };
      }
      return clip;
    });
  }

  const baseAudioId = `${videoClip.id}-audio`;
  let audioId = baseAudioId;
  let suffix = 2;
  while (clips.some((clip) => clip.id === audioId)) {
    audioId = `${baseAudioId}-${suffix}`;
    suffix += 1;
  }

  const linkedAudio: TimelineClip = {
    id: audioId,
    label: `${videoClip.label} audio`,
    track: "audio",
    start: videoClip.start,
    duration: videoClip.duration,
    sourceStart: videoClip.sourceStart ?? 0,
    ...(Number.isFinite(videoClip.sourceDuration)
      ? {sourceDuration: videoClip.sourceDuration}
      : {}),
    color: "#2563eb",
    src: videoClip.src,
    audioKind: "linked",
    speed: videoClip.speed ?? 1,
    volume: videoClip.volume ?? 1,
    linkedClipId: videoClip.id,
  };

  return [
    ...clips.map((clip) =>
      clip.id === videoClip.id ? {...clip, linkedClipId: audioId} : clip,
    ),
    linkedAudio,
  ];
};

export const moveClipToMainTrack = (
  clips: TimelineClip[],
  clipId: string,
): TimelineClip[] => {
  const mainTrackEnd = clips
    .filter((clip) => clip.track === "main")
    .reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);

  return normalizeTimelineTransitions(
    clips.map((clip) => {
      if (clip.id !== clipId) {
        return clip;
      }

      return {
        ...clip,
        track: "main",
        start: mainTrackEnd,
      };
    }),
  );
};

export const moveOverlayClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  targetLane: number,
  timelineDuration: number,
): TimelineClip[] => {
  const target = clips.find(
    (clip) => clip.id === clipId && clip.track === "upper",
  );

  if (!target) {
    return clips;
  }

  const start = clampTimelineStart(
    targetStart,
    target.duration,
    timelineDuration,
  );
  let overlayLane = Math.max(0, targetLane);

  while (
    clips.some(
      (clip) =>
        clip.id !== clipId &&
        clip.track === "upper" &&
        (clip.overlayLane ?? 0) === overlayLane &&
        clipRangesOverlap(start, target.duration, clip.start, clip.duration),
    )
  ) {
    overlayLane += 1;
  }

  if (start === target.start && overlayLane === (target.overlayLane ?? 0)) {
    return clips;
  }

  const linkedAudio = getReciprocalLinkedAudio(clips, target);

  return normalizeTimelineTransitions(
    clips.map((clip) =>
      clip.id === clipId
        ? { ...clip, start, overlayLane }
        : clip.id === linkedAudio?.id
          ? { ...clip, start }
          : clip,
    ),
  );
};

export const getDraggedClipStart = ({
  originalStart,
  pointerStartX,
  pointerX,
  pixelsPerFrame,
}: {
  originalStart: number;
  pointerStartX: number;
  pointerX: number;
  pixelsPerFrame: number;
}) => {
  const frameDelta = Math.round((pointerX - pointerStartX) / pixelsPerFrame);
  return Math.max(0, originalStart + frameDelta);
};

export const canDropClipOnMainTrack = (
  clips: TimelineClip[],
  clipId: string,
  targetTrack: TrackName,
): boolean => {
  const draggedClip = clips.find((clip) => clip.id === clipId);

  return draggedClip?.track === "upper" && targetTrack === "main";
};

export const splitFirstClipOnTrack = (
  clips: TimelineClip[],
  track: TrackName,
): TimelineClip[] => {
  const clipToSplit = clips.find(
    (clip) => clip.track === track && clip.duration > 1,
  );

  if (!clipToSplit) {
    return clips;
  }

  const firstDuration = Math.floor(clipToSplit.duration / 2);
  const secondDuration = clipToSplit.duration - firstDuration;

  const splitClips = clips.flatMap((clip) => {
    if (clip.id !== clipToSplit.id) {
      return [clip];
    }

    return [
      {
        ...clip,
        id: `${clip.id}-a`,
        label: clip.label,
        duration: firstDuration,
      },
      {
        ...withoutClipTransition(clip),
        id: `${clip.id}-b`,
        label: clip.label,
        start: clip.start + firstDuration,
        duration: secondDuration,
      },
    ];
  });

  return normalizeTimelineTransitions(splitClips);
};

export const splitClipOnTrackAtFrame = (
  clips: TimelineClip[],
  track: TrackName,
  frame: number,
): TimelineClip[] => {
  const clipToSplit = clips.find(
    (clip) =>
      clip.track === track &&
      frame > clip.start &&
      frame < clip.start + clip.duration,
  );

  if (!clipToSplit) {
    return clips;
  }

  const splitIds = new Map<string, { firstId: string; secondId: string }>();
  splitIds.set(clipToSplit.id, {
    firstId: `${clipToSplit.id}-a`,
    secondId: `${clipToSplit.id}-b`,
  });

  const splitClips = clips.flatMap((clip) => {
    const ids = splitIds.get(clip.id);

    if (!ids) {
      return [clip];
    }

    const clipFirstDuration = frame - clip.start;
    const clipSecondDuration = clip.duration - clipFirstDuration;
    return [
      {
        ...clip,
        id: ids.firstId,
        label: clip.label,
        duration: clipFirstDuration,
      },
      {
        ...withoutClipTransition(clip),
        id: ids.secondId,
        label: clip.label,
        start: frame,
        duration: clipSecondDuration,
        sourceStart:
          (clip.sourceStart ?? 0) +
          clipFirstDuration * Math.max(0.01, clip.speed ?? 1),
      },
    ];
  });

  return normalizeTimelineTransitions(splitClips);
};

export const replaceFirstClipOnTrack = (
  clips: TimelineClip[],
  track: TrackName,
): TimelineClip[] => {
  const clipToReplace = clips.find((clip) => clip.track === track);

  if (!clipToReplace) {
    return clips;
  }

  return clips.map((clip) => {
    if (clip.id !== clipToReplace.id) {
      return clip;
    }

    return {
      ...clip,
      id: `${clip.id}-replacement`,
      label: "Replacement clip",
      color: "#f59e0b",
    };
  });
};

export const addOverlayClip = (clips: TimelineClip[]): TimelineClip[] => {
  const hasOverlay = clips.some((clip) => clip.id === "overlay-1");

  if (hasOverlay) {
    return clips;
  }

  return [
    ...clips,
    {
      id: "overlay-1",
      label: "Overlay clip",
      track: "upper",
      start: 30,
      duration: 90,
      color: "#a855f7",
    },
  ];
};

export const hideFirstClipOnTrack = (
  clips: TimelineClip[],
  track: TrackName,
): TimelineClip[] => {
  const clipToHide = clips.find((clip) => clip.track === track && !clip.hidden);

  if (!clipToHide) {
    return clips;
  }

  return clips.map((clip) => {
    if (clip.id !== clipToHide.id) {
      return clip;
    }

    return {
      ...clip,
      hidden: true,
    };
  });
};

export const addTranscriptCaptions = (
  clips: TimelineClip[],
): TimelineClip[] => {
  const hasCaptions = clips.some((clip) => clip.track === "caption");

  if (hasCaptions) {
    return clips;
  }

  return [
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
  ];
};

export const changeFirstClipSpeed = (
  clips: TimelineClip[],
  track: TrackName,
  speed: number,
): TimelineClip[] => {
  const clipToChange = clips.find((clip) => clip.track === track);

  if (!clipToChange || speed <= 0) {
    return clips;
  }

  return normalizeTimelineTransitions(
    clips.map((clip) => {
      if (clip.id !== clipToChange.id) {
        return clip;
      }

      return {
        ...clip,
        label: `${clip.label.replace(/ \d+(\.\d+)?x$/, "")} ${speed}x`,
        duration: Math.max(
          1,
          Math.round((clip.duration * (clip.speed ?? 1)) / speed),
        ),
        speed,
      };
    }),
  );
};

export const setTrackVolume = (
  clips: TimelineClip[],
  track: TrackName,
  volume: number,
): TimelineClip[] => {
  const clipToAdjust = clips.find((clip) => clip.track === track);

  if (!clipToAdjust || volume < 0) {
    return clips;
  }

  const volumePercent = Math.round(volume * 100);

  return clips.map((clip) => {
    if (clip.id !== clipToAdjust.id) {
      return clip;
    }

    return {
      ...clip,
      label: `${clip.label.replace(/ \d+%$/, "")} ${volumePercent}%`,
      volume,
    };
  });
};

export const reconcileClipSourceDuration = (
  clips: TimelineClip[],
  src: string,
  sourceDuration: number,
): TimelineClip[] => {
  if (!src || !Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    return clips;
  }

  const normalizedSourceDuration = Math.max(1, Math.round(sourceDuration));
  let changed = false;
  const reconciled = clips.map((clip) => {
    if (
      clip.src !== src ||
      !["main", "upper", "cutout", "audio"].includes(clip.track)
    ) {
      return clip;
    }

    const sourceStart = Math.max(0, clip.sourceStart ?? 0);
    const speed =
      Number.isFinite(clip.speed) && (clip.speed ?? 0) > 0
        ? (clip.speed ?? 1)
        : 1;
    const availableSourceFrames = Math.max(
      1,
      normalizedSourceDuration - sourceStart,
    );
    const maximumTimelineDuration = Math.max(
      1,
      Math.floor(availableSourceFrames / speed),
    );
    const duration = Math.min(clip.duration, maximumTimelineDuration);

    if (
      duration === clip.duration &&
      clip.sourceDuration === normalizedSourceDuration
    ) {
      return clip;
    }

    changed = true;
    return {
      ...clip,
      duration,
      sourceStart,
      sourceDuration: normalizedSourceDuration,
    };
  });

  return changed ? normalizeTimelineTransitions(reconciled) : clips;
};

export const setVideoLayerSpeed = (
  clips: TimelineClip[],
  videoLayer: number,
  speed: number,
): TimelineClip[] => {
  if (!Number.isFinite(videoLayer) || !Number.isFinite(speed) || speed <= 0)
    return clips;
  const updates = new Map<
    string,
    { start: number; duration: number; speed: number }
  >();
  const videos = clips
    .map((clip, index) => ({ clip, index }))
    .filter(({ clip }) => isVideoLayerControlTarget(clip, videoLayer))
    .sort(
      (left, right) =>
        left.clip.start - right.clip.start || left.index - right.index,
    );
  let nextStart: number | undefined;

  for (const { clip: video } of videos) {
    const start = nextStart ?? video.start;
    const duration = Math.max(
      1,
      Math.round((video.duration * (video.speed ?? 1)) / speed),
    );
    const update = { start, duration, speed };
    updates.set(video.id, update);
    const linkedAudio = getReciprocalLinkedAudio(clips, video);
    if (linkedAudio) updates.set(linkedAudio.id, update);
    nextStart = start + duration;
  }

  if (updates.size === 0) return clips;
  return normalizeTimelineTransitions(
    clips.map((clip) => {
      const update = updates.get(clip.id);
      return update ? { ...clip, ...update } : clip;
    }),
  );
};

export const setVideoLayerVolume = (
  clips: TimelineClip[],
  videoLayer: number,
  volume: number,
): TimelineClip[] => {
  if (!Number.isFinite(videoLayer) || !Number.isFinite(volume) || volume < 0)
    return clips;
  const targetIds = new Set<string>();

  for (const video of clips.filter((clip) =>
    isVideoLayerControlTarget(clip, videoLayer),
  )) {
    targetIds.add(video.id);
    const linkedAudio = getReciprocalLinkedAudio(clips, video);
    if (linkedAudio) targetIds.add(linkedAudio.id);
  }

  if (targetIds.size === 0) return clips;
  return clips.map((clip) =>
    targetIds.has(clip.id) ? { ...clip, volume } : clip,
  );
};

export const startVideoLayerControlHistoryGesture = (
  originalClips: TimelineClip[],
  videoLayer: number,
  property: VideoLayerControlHistoryGesture["property"],
): VideoLayerControlHistoryGesture => ({ property, videoLayer, originalClips });

export const previewVideoLayerControlHistoryGesture = (
  gesture: VideoLayerControlHistoryGesture,
  value: number,
): TimelineClip[] =>
  gesture.property === "speed"
    ? setVideoLayerSpeed(gesture.originalClips, gesture.videoLayer, value)
    : setVideoLayerVolume(gesture.originalClips, gesture.videoLayer, value);

export const finishVideoLayerControlHistoryGesture = (
  state: TimelineHistoryState,
  gesture: VideoLayerControlHistoryGesture,
): TimelineHistoryState =>
  state.present === gesture.originalClips
    ? state
    : {
        past: [...state.past, gesture.originalClips],
        present: state.present,
        future: [],
      };

export const setClipSpeedById = (
  clips: TimelineClip[],
  clipId: string | null,
  speed: number,
): TimelineClip[] => {
  if (!clipId || speed <= 0) {
    return clips;
  }

  const selectedClip = clips.find((clip) => clip.id === clipId);
  if (!selectedClip) return clips;
  const target = resolvePairOperationTarget(clips, selectedClip);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);
  const targetIds = new Set([target.id, linkedAudio?.id]);
  const duration = Math.max(
    1,
    Math.round((target.duration * (target.speed ?? 1)) / speed),
  );

  return normalizeTimelineTransitions(
    clips.map((clip) => {
      if (!targetIds.has(clip.id)) {
        return clip;
      }

      return {
        ...clip,
        duration,
        speed,
      };
    }),
  );
};

export const setClipVolumeById = (
  clips: TimelineClip[],
  clipId: string | null,
  volume: number,
): TimelineClip[] => {
  if (!clipId || volume < 0) {
    return clips;
  }

  const selectedClip = clips.find((clip) => clip.id === clipId);
  if (!selectedClip) return clips;
  const target = resolvePairOperationTarget(clips, selectedClip);
  const linkedAudio = getReciprocalLinkedAudio(clips, target);
  const targetIds = new Set([target.id, linkedAudio?.id]);

  return clips.map((clip) =>
    targetIds.has(clip.id)
      ? {
          ...clip,
          volume,
        }
      : clip,
  );
};

const clampVisualIntensity = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

const presetIntensity = (preset: string, current?: number) =>
  preset === "none" ? 0 : clampVisualIntensity(current ?? 100);

const updateVisualVideoClip = (
  clips: TimelineClip[],
  clipId: string | null,
  updateVisual: (visual: ClipVisualStyle) => ClipVisualStyle,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  return clips.map((clip) => {
    if (
      clip.id !== clipId ||
      (clip.track !== "main" &&
        clip.track !== "upper" &&
        clip.track !== "cutout")
    ) {
      return clip;
    }

    const visual = clip.visual ?? {
      effect: "none" as ClipEffect,
      filter: "none" as ClipFilter,
    };

    return {
      ...clip,
      visual: updateVisual(visual),
    };
  });
};

export const setClipEffectById = (
  clips: TimelineClip[],
  clipId: string | null,
  effect: ClipEffect,
): TimelineClip[] =>
  updateVisualVideoClip(clips, clipId, (visual) => ({
    ...visual,
    effect,
  }));

export const setClipFilterById = (
  clips: TimelineClip[],
  clipId: string | null,
  filter: ClipFilter,
): TimelineClip[] =>
  updateVisualVideoClip(clips, clipId, (visual) => ({
    ...visual,
    filter,
  }));

export const setClipEffectIntensityById = (
  clips: TimelineClip[],
  clipId: string | null,
  intensity: number,
): TimelineClip[] =>
  updateVisualVideoClip(clips, clipId, (visual) => ({
    ...visual,
    effectIntensity: clampVisualIntensity(intensity),
  }));

export const setClipFilterIntensityById = (
  clips: TimelineClip[],
  clipId: string | null,
  intensity: number,
): TimelineClip[] =>
  updateVisualVideoClip(clips, clipId, (visual) => ({
    ...visual,
    filterIntensity: clampVisualIntensity(intensity),
  }));

export const getClipVisualPresentation = (
  clip?: TimelineClip,
  frame = 0,
): ClipVisualPresentation => {
  const visual = clip?.visual;
  const effect = visual?.effect ?? "none";
  const filter = visual?.filter ?? "none";
  const effectAmount = presetIntensity(effect, visual?.effectIntensity) / 100;
  const filterAmount = presetIntensity(filter, visual?.filterIntensity) / 100;
  const parts: string[] = [];
  const opacity = effect === "fade" ? 1 - 0.45 * effectAmount : 1;
  let scale = effect === "zoom" ? 1 + 0.08 * effectAmount : 1;
  let translateX = 0;
  let translateY = 0;
  let rotate = 0;

  const filterCss = getClipFilterCss(filter, filterAmount * 100);
  if (filterCss !== "none") {
    parts.push(filterCss);
  }

  if (effect === "blur") {
    parts.push(`blur(${6 * effectAmount}px)`);
  }
  if (effect === "glow") {
    parts.push(
      `brightness(${1 + 0.1 * effectAmount})`,
      `drop-shadow(0 0 ${18 * effectAmount}px rgba(56, 214, 200, ${0.55 * effectAmount}))`,
    );
  }
  if (effect === "grayscale") {
    parts.push(`grayscale(${effectAmount})`);
  }
  if (effect === "invert") {
    parts.push(`invert(${effectAmount})`);
  }
  if (effect === "shadow") {
    parts.push(
      `drop-shadow(0 ${8 * effectAmount}px ${18 * effectAmount}px rgba(0, 0, 0, ${0.65 * effectAmount}))`,
    );
  }
  if (effect === "outline") {
    const width = Math.max(1, 4 * effectAmount);
    parts.push(
      `drop-shadow(${width}px 0 0 white)`,
      `drop-shadow(${-width}px 0 0 white)`,
      `drop-shadow(0 ${width}px 0 white)`,
      `drop-shadow(0 ${-width}px 0 white)`,
      `drop-shadow(${width}px ${width}px 0 white)`,
      `drop-shadow(${-width}px ${width}px 0 white)`,
      `drop-shadow(${width}px ${-width}px 0 white)`,
      `drop-shadow(${-width}px ${-width}px 0 white)`,
    );
  }
  if (effect === "moving-outline") {
    const angle = ((frame % 90) / 90) * Math.PI * 2;
    const distance = Math.max(2, 5 * effectAmount);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    parts.push(
      `drop-shadow(${x}px ${y}px 0 rgba(34, 211, 238, 0.95))`,
      `drop-shadow(${-x}px ${-y}px 0 rgba(244, 114, 182, 0.9))`,
      `drop-shadow(0 0 ${8 * effectAmount}px rgba(255, 255, 255, 0.75))`,
    );
  }
  if (effect === "moving-white-outline") {
    const angle = ((frame % 72) / 72) * Math.PI * 2;
    const distance = Math.max(2, 5 * effectAmount);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const oppositeX = Math.cos(angle + Math.PI) * distance;
    const oppositeY = Math.sin(angle + Math.PI) * distance;
    parts.push(
      `drop-shadow(${x}px ${y}px 0 rgba(255, 255, 255, 1))`,
      `drop-shadow(${oppositeX}px ${oppositeY}px 0 rgba(255, 255, 255, 0.78))`,
      `drop-shadow(0 0 ${7 * effectAmount}px rgba(255, 255, 255, 0.92))`,
    );
  }
  if (effect === "neon-outline") {
    const width = Math.max(1, 3 * effectAmount);
    parts.push(
      `drop-shadow(${width}px 0 0 #22d3ee)`,
      `drop-shadow(${-width}px 0 0 #22d3ee)`,
      `drop-shadow(0 ${width}px 0 #f472b6)`,
      `drop-shadow(0 ${-width}px 0 #f472b6)`,
      `drop-shadow(0 0 ${14 * effectAmount}px rgba(34, 211, 238, 0.9))`,
    );
  }
  if (effect === "hand-drawn") {
    const jitterX = Math.sin(frame * 2.17) * 1.6 * effectAmount;
    const jitterY = Math.cos(frame * 1.83) * 1.3 * effectAmount;
    translateX = jitterX * 0.18;
    translateY = jitterY * 0.18;
    rotate = Math.sin(frame * 1.11) * 0.45 * effectAmount;
    parts.push(
      `contrast(${1 + 0.16 * effectAmount})`,
      `saturate(${1 - 0.22 * effectAmount})`,
      `drop-shadow(${2 + jitterX}px ${jitterY}px 0 rgba(15, 23, 42, 0.95))`,
      `drop-shadow(${-2 - jitterX}px ${-jitterY}px 0 rgba(255, 255, 255, 0.9))`,
    );
  }
  if (effect === "scribble") {
    const angle = frame * 0.19;
    const x = Math.cos(angle) * 4 * effectAmount;
    const y = Math.sin(angle * 1.3) * 4 * effectAmount;
    parts.push(
      `drop-shadow(${x}px ${y}px 0 rgba(250, 204, 21, 0.95))`,
      `drop-shadow(${-y}px ${x}px 0 rgba(244, 114, 182, 0.9))`,
      `drop-shadow(${-x}px ${-y}px 0 rgba(34, 211, 238, 0.9))`,
    );
    rotate = Math.sin(frame * 0.27) * 0.65 * effectAmount;
  }
  if (effect === "float") {
    translateY = Math.sin(frame * 0.08) * -3.2 * effectAmount;
    rotate = Math.sin(frame * 0.055) * 1.8 * effectAmount;
  }
  if (effect === "bounce") {
    const bounce = Math.abs(Math.sin(frame * 0.13));
    translateY = -5 * bounce * effectAmount;
    scale *= 1 + bounce * 0.055 * effectAmount;
  }
  if (effect === "motion-trail") {
    const trail = 5 + Math.abs(Math.sin(frame * 0.1)) * 7;
    parts.push(
      `drop-shadow(${-trail * effectAmount}px 0 0 rgba(34, 211, 238, 0.58))`,
      `drop-shadow(${-trail * 1.8 * effectAmount}px 1px 0 rgba(244, 114, 182, 0.38))`,
      `drop-shadow(${-trail * 2.6 * effectAmount}px 2px 0 rgba(250, 204, 21, 0.24))`,
    );
    translateX = Math.sin(frame * 0.12) * 0.9 * effectAmount;
  }
  if (effect === "rainbow-edge") {
    const angle = frame * 0.09;
    const radius = Math.max(2, 4 * effectAmount);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    parts.push(
      `drop-shadow(${x}px ${y}px 0 rgba(34, 211, 238, 0.95))`,
      `drop-shadow(${-y}px ${x}px 0 rgba(250, 204, 21, 0.92))`,
      `drop-shadow(${-x}px ${-y}px 0 rgba(244, 63, 94, 0.92))`,
      `drop-shadow(${y}px ${-x}px 0 rgba(168, 85, 247, 0.92))`,
    );
  }
  if (effect === "electric-glow") {
    const spark = 0.72 + Math.abs(Math.sin(frame * 0.48)) * 0.28;
    parts.push(
      `brightness(${1 + 0.12 * spark * effectAmount})`,
      `drop-shadow(0 0 ${5 * spark * effectAmount}px rgba(255, 255, 255, 0.98))`,
      `drop-shadow(0 0 ${18 * spark * effectAmount}px rgba(34, 211, 238, 0.92))`,
    );
  }
  if (effect === "comic-pop") {
    const beat = Math.pow(Math.abs(Math.sin(frame * 0.16)), 5);
    scale *= 1 + beat * 0.13 * effectAmount;
    rotate = Math.sin(frame * 0.16) * beat * 1.8 * effectAmount;
    parts.push(`contrast(${1 + 0.2 * effectAmount})`, `saturate(${1 + 0.3 * effectAmount})`);
  }
  if (effect === "sway") {
    translateX = Math.sin(frame * 0.065) * 2.4 * effectAmount;
    translateY = Math.cos(frame * 0.065) * 0.7 * effectAmount;
    rotate = Math.sin(frame * 0.065) * 3.2 * effectAmount;
  }
  if (effect === "flicker-outline") {
    const flicker = 0.35 + Math.abs(Math.sin(frame * 0.83)) * 0.65;
    const width = Math.max(1, 3.5 * flicker * effectAmount);
    parts.push(
      `drop-shadow(${width}px 0 0 rgba(255, 255, 255, ${flicker}))`,
      `drop-shadow(${-width}px 0 0 rgba(255, 255, 255, ${flicker}))`,
      `drop-shadow(0 ${width}px 0 rgba(255, 255, 255, ${flicker}))`,
      `drop-shadow(0 ${-width}px 0 rgba(255, 255, 255, ${flicker}))`,
    );
  }
  if (effect === "silhouette") {
    parts.push("brightness(0)");
  }
  if (effect === "retro") {
    parts.push(
      `sepia(${0.55 * effectAmount})`,
      `contrast(${1 + 0.18 * effectAmount})`,
      `saturate(${1 - 0.28 * effectAmount})`,
    );
  }
  if (effect === "halo-blur") {
    parts.push(
      `blur(${1.4 * effectAmount}px)`,
      `brightness(${1 + 0.12 * effectAmount})`,
      `drop-shadow(0 0 ${20 * effectAmount}px rgba(255,255,255,0.7))`,
    );
  }
  if (effect === "glass-flare") {
    parts.push(
      `brightness(${1 + 0.22 * effectAmount})`,
      `saturate(${1 + 0.22 * effectAmount})`,
      `drop-shadow(${12 * effectAmount}px ${-8 * effectAmount}px ${18 * effectAmount}px rgba(125,211,252,0.7))`,
    );
  }
  if (effect === "colors-off") {
    parts.push(
      `grayscale(${0.82 * effectAmount})`,
      `contrast(${1 + 0.18 * effectAmount})`,
    );
  }
  if (effect === "shake") {
    translateX = Math.sin(frame * 1.73) * 1.6 * effectAmount;
    translateY = Math.cos(frame * 2.11) * 1.1 * effectAmount;
    rotate = Math.sin(frame * 1.31) * 0.8 * effectAmount;
  }
  if (effect === "dynamic") {
    scale *= 1 + Math.abs(Math.sin(frame * 0.16)) * 0.08 * effectAmount;
    parts.push(`saturate(${1 + 0.28 * effectAmount})`);
  }
  if (effect === "glitch") {
    translateX = Math.sin(frame * 2.7) * 1.8 * effectAmount;
    parts.push(
      `hue-rotate(${Math.sin(frame * 0.7) * 28 * effectAmount}deg)`,
      `contrast(${1 + 0.24 * effectAmount})`,
    );
  }
  if (effect === "dream") {
    parts.push(
      `blur(${1.2 * effectAmount}px)`,
      `brightness(${1 + 0.14 * effectAmount})`,
      `saturate(${1 - 0.16 * effectAmount})`,
    );
  }
  if (effect === "vivid-pop") {
    parts.push(
      `saturate(${1 + 0.65 * effectAmount})`,
      `contrast(${1 + 0.22 * effectAmount})`,
    );
  }
  if (effect === "pulse") {
    scale *= 1 + Math.abs(Math.sin(frame * 0.2)) * 0.1 * effectAmount;
  }
  if (effect === "flash") {
    parts.push(
      `brightness(${1 + Math.abs(Math.sin(frame * 0.24)) * 0.55 * effectAmount})`,
    );
  }
  if (effect === "soft-focus") {
    parts.push(
      `blur(${2.2 * effectAmount}px)`,
      `contrast(${1 - 0.08 * effectAmount})`,
      `brightness(${1 + 0.1 * effectAmount})`,
    );
  }
  if (effect === "warm-glow") {
    parts.push(
      `sepia(${0.24 * effectAmount})`,
      `saturate(${1 + 0.3 * effectAmount})`,
      `drop-shadow(0 0 ${16 * effectAmount}px rgba(251,191,36,0.65))`,
    );
  }
  if (effect === "cool-glow") {
    parts.push(
      `hue-rotate(${10 * effectAmount}deg)`,
      `brightness(${1 + 0.08 * effectAmount})`,
      `drop-shadow(0 0 ${16 * effectAmount}px rgba(34,211,238,0.65))`,
    );
  }
  if (effect === "contrast-pop") {
    parts.push(
      `contrast(${1 + 0.42 * effectAmount})`,
      `saturate(${1 + 0.18 * effectAmount})`,
    );
  }

  return {
    filter: parts.length ? parts.join(" ") : "none",
    opacity,
    scale,
    translateX,
    translateY,
    rotate,
  };
};

const neutralAnimationPresentation: ClipAnimationPresentation = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0,
};

const clampAnimationDuration = (duration: number) =>
  Math.min(120, Math.max(6, Math.round(duration)));

const updateAnimationVideoClip = (
  clips: TimelineClip[],
  clipId: string | null,
  updateAnimation: (animation: ClipAnimationStyle) => ClipAnimationStyle,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  return clips.map((clip) => {
    if (
      clip.id !== clipId ||
      (clip.track !== "main" &&
        clip.track !== "upper" &&
        clip.track !== "cutout")
    ) {
      return clip;
    }

    const animation = clip.animation ?? {
      preset: "none" as ClipAnimationPreset,
      timing: "start" as ClipAnimationTiming,
      duration: 30,
      easing: "smooth" as ClipAnimationEasing,
    };

    return {
      ...clip,
      animation: updateAnimation(animation),
    };
  });
};

export const setClipAnimationById = (
  clips: TimelineClip[],
  clipId: string | null,
  preset: ClipAnimationPreset,
): TimelineClip[] =>
  updateAnimationVideoClip(clips, clipId, (animation) => ({
    ...animation,
    preset,
    timing: preset.endsWith("-out") ? "end" : "start",
    duration: clampAnimationDuration(animation.duration ?? 30),
    easing: animation.easing ?? "smooth",
  }));

export const getClipAnimationPreviewFrame = (
  clip: TimelineClip,
  preset: ClipAnimationPreset = clip.animation?.preset ?? "none",
): number => {
  if (!preset.endsWith("-out")) {
    return clip.start;
  }

  const duration = clampAnimationDuration(clip.animation?.duration ?? 30);
  return Math.max(clip.start, clip.start + clip.duration - duration);
};

export const setClipAnimationTimingById = (
  clips: TimelineClip[],
  clipId: string | null,
  timing: ClipAnimationTiming,
): TimelineClip[] =>
  updateAnimationVideoClip(clips, clipId, (animation) => ({
    ...animation,
    timing,
  }));

export const setClipAnimationDurationById = (
  clips: TimelineClip[],
  clipId: string | null,
  duration: number,
): TimelineClip[] =>
  updateAnimationVideoClip(clips, clipId, (animation) => ({
    ...animation,
    duration: clampAnimationDuration(duration),
  }));

export const setClipAnimationEasingById = (
  clips: TimelineClip[],
  clipId: string | null,
  easing: ClipAnimationEasing,
): TimelineClip[] =>
  updateAnimationVideoClip(clips, clipId, (animation) => ({
    ...animation,
    easing,
  }));

const clampProgress = (value: number) => Math.min(1, Math.max(0, value));

const easeProgress = (progress: number, easing: ClipAnimationEasing) => {
  const eased = clampProgress(progress);

  if (easing === "fast") {
    return 1 - Math.pow(1 - eased, 3);
  }
  if (easing === "slow") {
    return Math.pow(eased, 2);
  }

  return eased * eased * (3 - 2 * eased);
};

const shouldAnimateAtStart = (
  animation: ClipAnimationStyle,
  preset: ClipAnimationPreset,
) =>
  animation.timing === "start" ||
  animation.timing === "both" ||
  preset.endsWith("-in") ||
  preset === "pop";

const shouldAnimateAtEnd = (
  animation: ClipAnimationStyle,
  preset: ClipAnimationPreset,
) =>
  animation.timing === "end" ||
  animation.timing === "both" ||
  preset.endsWith("-out");

const applyAnimationPreset = (
  preset: ClipAnimationPreset,
  progress: number,
  direction: "in" | "out",
): ClipAnimationPresentation => {
  const amount = direction === "in" ? progress : 1 - progress;

  if (preset.startsWith("fade")) {
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
    };
  }

  if (preset.startsWith("slide")) {
    const offset = 24 * (1 - progress);
    const translateX =
      preset === "slide-right-in"
        ? offset
        : preset === "slide-up-in" || preset === "slide-down-in"
          ? 0
          : -offset;
    const translateY =
      preset === "slide-up-in"
        ? -offset
        : preset === "slide-down-in"
          ? offset
          : 0;
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
      translateX:
        direction === "in" ? translateX : Math.abs(translateX || 24) * progress,
      translateY: direction === "in" ? translateY : 0,
    };
  }

  if (preset.startsWith("zoom")) {
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
      scale: direction === "in" ? 0.82 + 0.18 * progress : 1 + 0.18 * progress,
    };
  }

  if (preset === "pop") {
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
      scale: 0.72 + 0.34 * progress,
    };
  }

  if (preset === "spin-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
      scale: 0.74 + 0.26 * progress,
      rotation: -180 * (1 - progress),
    };
  }

  if (preset === "tilt-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: amount,
      translateY: 10 * (1 - progress),
      rotation: -14 * (1 - progress),
    };
  }

  if (preset === "bounce") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.45, amount),
      translateY:
        -Math.abs(Math.sin(progress * Math.PI * 2.5)) *
        (1 - progress) *
        14,
    };
  }

  if (preset === "shake") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.6, amount),
      translateX:
        Math.sin(progress * Math.PI * 8) * (1 - progress) * 9,
    };
  }

  if (preset === "pulse") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.6, amount),
      scale: 1 + Math.sin(progress * Math.PI) * 0.18,
    };
  }

  if (preset === "flash") {
    const flashOpacity =
      progress < 0.25
        ? 0.25
        : progress < 0.5
          ? 1
          : progress < 0.72
            ? 0.42
            : 1;
    return {
      ...neutralAnimationPresentation,
      opacity: flashOpacity,
    };
  }

  if (preset === "elastic-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.3, amount),
      scale: 1 - Math.sin(progress * Math.PI * 3) * (1 - progress) * 0.28,
    };
  }

  if (preset === "swing-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.35, amount),
      rotation: Math.cos(progress * Math.PI * 3.5) * (1 - progress) * -24,
    };
  }

  if (preset === "flip-horizontal") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.35, amount),
      scale: Math.max(0.08, Math.abs(Math.cos((1 - progress) * Math.PI * 0.5))),
    };
  }

  if (preset === "flip-vertical") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.35, amount),
      scale: 0.72 + 0.28 * progress,
      rotation: 90 * (1 - progress),
    };
  }

  if (preset === "cube-turn") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.3, amount),
      translateX: -18 * (1 - progress),
      scale: 0.76 + 0.24 * progress,
      rotation: -42 * (1 - progress),
    };
  }

  if (preset === "roll-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.3, amount),
      translateX: -34 * (1 - progress),
      rotation: -270 * (1 - progress),
    };
  }

  if (preset === "drop-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.3, amount),
      translateY: -38 * (1 - progress) + Math.sin(progress * Math.PI * 3) * (1 - progress) * 7,
    };
  }

  if (preset === "whip-pan") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.25, amount),
      translateX: -58 * (1 - progress),
      rotation: -5 * (1 - progress),
    };
  }

  if (preset === "spiral-in") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.2, amount),
      scale: 0.35 + 0.65 * progress,
      rotation: -360 * (1 - progress),
    };
  }

  if (preset === "drift") {
    return {
      ...neutralAnimationPresentation,
      translateX: Math.sin(progress * Math.PI * 2) * 5,
      translateY: Math.cos(progress * Math.PI * 2) * 3,
      rotation: Math.sin(progress * Math.PI * 2) * 2,
    };
  }

  if (preset === "heartbeat") {
    const beat = Math.max(0, Math.sin(progress * Math.PI * 4));
    return {
      ...neutralAnimationPresentation,
      scale: 1 + beat * 0.16 * (1 - progress * 0.35),
    };
  }

  if (preset === "strobe") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.sin(progress * Math.PI * 10) > -0.1 ? 1 : 0.22,
    };
  }

  if (preset === "wobble") {
    return {
      ...neutralAnimationPresentation,
      translateX: Math.sin(progress * Math.PI * 6) * (1 - progress) * 6,
      rotation: Math.sin(progress * Math.PI * 6) * (1 - progress) * 9,
    };
  }

  if (preset === "zoom-burst") {
    return {
      ...neutralAnimationPresentation,
      opacity: Math.max(0.25, amount),
      scale: 1.7 - 0.7 * progress,
    };
  }

  return neutralAnimationPresentation;
};

export const getClipAnimationPresentation = (
  clip: TimelineClip | undefined,
  playheadFrame: number,
): ClipAnimationPresentation => {
  const animation = clip?.animation;
  const preset = animation?.preset ?? "none";
  if (!clip || preset === "none" || !animation) {
    return neutralAnimationPresentation;
  }

  const duration = clampAnimationDuration(animation.duration);
  const easing = animation.easing ?? "smooth";
  const clipEnd = clip.start + clip.duration;

  if (shouldAnimateAtStart(animation, preset)) {
    const rawProgress = (playheadFrame - clip.start) / duration;
    if (rawProgress >= 0 && rawProgress < 1) {
      return applyAnimationPreset(
        preset,
        easeProgress(rawProgress, easing),
        "in",
      );
    }
  }

  if (shouldAnimateAtEnd(animation, preset)) {
    const rawProgress = (clipEnd - playheadFrame) / duration;
    if (rawProgress >= 0 && rawProgress < 1) {
      return applyAnimationPreset(
        preset,
        easeProgress(rawProgress, easing),
        "out",
      );
    }
  }

  return neutralAnimationPresentation;
};

export const setClipAdjustmentById = (
  clips: TimelineClip[],
  clipId: string | null,
  adjustment: Partial<ClipAdjustment>,
): TimelineClip[] => {
  if (!clipId) {
    return clips;
  }

  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, value));

  return clips.map((clip) => {
    if (
      clip.id !== clipId ||
      (clip.track !== "main" && clip.track !== "upper")
    ) {
      return clip;
    }

    const next = {
      ...defaultClipAdjustment,
      ...clip.adjustment,
      ...adjustment,
    };

    return {
      ...clip,
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
