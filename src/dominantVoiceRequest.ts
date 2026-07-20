import type {TimelineClip} from "./editorLogic";

export type DominantVoiceRequestSnapshot = {
  clipId: string;
  fingerprint: string;
};

const fingerprintClip = (clip: TimelineClip) => JSON.stringify({
  id: clip.id,
  track: clip.track,
  src: clip.src,
  sourceStart: clip.sourceStart ?? 0,
  duration: clip.duration,
  speed: clip.speed ?? 1,
  linkedClipId: clip.linkedClipId ?? null,
});

const isMainVideoClip = (clip: TimelineClip | null | undefined) =>
  clip?.track === "main" && clip.mediaType !== "image" && Boolean(clip.src);

export const createDominantVoiceRequestSnapshot = (
  clip: TimelineClip | null | undefined,
): DominantVoiceRequestSnapshot | null => {
  if (
    !clip ||
    !isMainVideoClip(clip)
  ) {
    return null;
  }

  return Object.freeze({
    clipId: clip.id,
    fingerprint: fingerprintClip(clip),
  });
};

export const isDominantVoiceRequestCurrent = (
  snapshot: DominantVoiceRequestSnapshot,
  selectedClipId: string | null,
  clips: TimelineClip[],
) => {
  if (selectedClipId !== snapshot.clipId) {
    return false;
  }

  const currentClip = clips.find((clip) => clip.id === snapshot.clipId);
  const currentSnapshot = createDominantVoiceRequestSnapshot(currentClip);
  return currentSnapshot?.fingerprint === snapshot.fingerprint;
};
