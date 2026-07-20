import type {TimelineClip} from "./editorLogic";

export type CutoutRequestSnapshot = {
  clipId: string;
  serializedClip: string;
};

export type CutoutRequestSource = {
  src: string;
  sourceStart: number;
};

export type AutomaticCutoutRequestTiming = {
  requestSnapshot: CutoutRequestSnapshot;
  requestSource: CutoutRequestSource;
  sourceStartSeconds: number;
  durationSeconds: number;
};

export const getCutoutRequestSource = (
  clip: TimelineClip | null | undefined,
): CutoutRequestSource | null => {
  if (clip?.track !== "cutout" || !clip.cutout || !clip.src) {
    return null;
  }

  return {
    src: clip.cutout.originalSrc ?? clip.src,
    sourceStart: clip.cutout.mediaKind === "video"
      ? (clip.cutout.originalSrc
        ? (clip.cutout.originalSourceStart ?? 0) + (clip.sourceStart ?? 0)
        : clip.sourceStart ?? 0)
      : clip.sourceStart ?? 0,
  };
};

export const createCutoutRequestSnapshot = (
  clip: TimelineClip | null | undefined,
): CutoutRequestSnapshot | null => {
  if (clip?.track !== "cutout" || !clip.cutout || !clip.src) {
    return null;
  }

  return {
    clipId: clip.id,
    serializedClip: JSON.stringify(clip),
  };
};

export const createAutomaticCutoutRequestTiming = (
  clip: TimelineClip | null | undefined,
  fps: number,
): AutomaticCutoutRequestTiming | null => {
  const requestSnapshot = createCutoutRequestSnapshot(clip);
  const requestSource = getCutoutRequestSource(clip);
  if (!requestSnapshot || !requestSource || !clip) {
    return null;
  }

  return {
    requestSnapshot,
    requestSource,
    sourceStartSeconds: requestSource.sourceStart / fps,
    durationSeconds: (clip.duration * (clip.speed ?? 1)) / fps,
  };
};

export const isCutoutRequestSnapshotCurrent = (
  snapshot: CutoutRequestSnapshot,
  selectedClipId: string | null,
  clip: TimelineClip | null | undefined,
): boolean => {
  if (selectedClipId !== snapshot.clipId) {
    return false;
  }

  const currentSnapshot = createCutoutRequestSnapshot(clip);
  return currentSnapshot?.clipId === snapshot.clipId &&
    currentSnapshot.serializedClip === snapshot.serializedClip;
};
