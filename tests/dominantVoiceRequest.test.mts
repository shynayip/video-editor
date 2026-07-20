import assert from "node:assert/strict";
import test from "node:test";

import type {TimelineClip} from "../src/editorLogic";
import {
  createDominantVoiceRequestSnapshot,
  isDominantVoiceRequestCurrent,
} from "../src/dominantVoiceRequest.ts";

const mainVideo = (overrides: Partial<TimelineClip> = {}): TimelineClip => ({
  id: "main",
  label: "Main video",
  track: "main",
  start: 0,
  duration: 300,
  src: "/uploads/main.mp4",
  color: "#0ea5e9",
  linkedClipId: "main-audio",
  ...overrides,
});

const reciprocalAudio = (overrides: Partial<TimelineClip> = {}): TimelineClip => ({
  id: "main-audio",
  label: "Main audio",
  track: "audio",
  start: 0,
  duration: 300,
  src: "/uploads/main.mp4",
  sourceStart: 0,
  speed: 1,
  color: "#14b8a6",
  linkedClipId: "main",
  ...overrides,
});

test("accepts only an unchanged selected main clip", () => {
  const clip = mainVideo({id: "main", src: "/uploads/main.mp4", duration: 300});
  const audio = reciprocalAudio();
  const snapshot = createDominantVoiceRequestSnapshot(clip, [clip, audio])!;

  assert.equal(isDominantVoiceRequestCurrent(snapshot, "main", [clip, audio]), true);
  assert.equal(isDominantVoiceRequestCurrent(snapshot, "other", [clip, audio]), false);
  assert.equal(isDominantVoiceRequestCurrent(snapshot, "main", [
    {...clip, speed: 2},
    audio,
  ]), false);
});

test("rejects snapshots when analysis or linked-audio fields change", () => {
  const clip = mainVideo({sourceStart: 45, speed: 1.25});
  const audio = reciprocalAudio({sourceStart: 45, speed: 1.25});
  const snapshot = createDominantVoiceRequestSnapshot(clip, [clip, audio])!;

  for (const changedClip of [
    {...clip, src: "/uploads/replaced.mp4"},
    {...clip, sourceStart: 60},
    {...clip, duration: 240},
    {...clip, speed: 0.75},
    {...clip, linkedClipId: "other-audio"},
    {...clip, track: "upper" as const},
  ]) {
    assert.equal(
      isDominantVoiceRequestCurrent(snapshot, clip.id, [changedClip, audio]),
      false,
    );
  }
});

test("keeps the request current when only the repairable audio link changes", () => {
  const clip = mainVideo({sourceStart: 45, speed: 1.25});
  const audio = reciprocalAudio({sourceStart: 45, speed: 1.25});
  const snapshot = createDominantVoiceRequestSnapshot(clip, [clip, audio])!;

  for (const changedAudio of [
    {...audio, id: "replacement-audio"},
    {...audio, src: "/uploads/replaced.mp4"},
    {...audio, sourceStart: 60},
    {...audio, duration: 240},
    {...audio, speed: 0.75},
    {...audio, track: "narration" as const},
    {...audio, linkedClipId: "other-main"},
  ]) {
    assert.equal(
      isDominantVoiceRequestCurrent(snapshot, clip.id, [clip, changedAudio]),
      true,
    );
  }
});

test("accepts overlay videos and rejects deleted or unsupported clips", () => {
  const clip = mainVideo();
  const audio = reciprocalAudio();
  const snapshot = createDominantVoiceRequestSnapshot(clip, [clip, audio])!;

  assert.notEqual(
    createDominantVoiceRequestSnapshot({...clip, track: "upper"}, [clip, audio]),
    null,
  );
  assert.equal(createDominantVoiceRequestSnapshot({...clip, mediaType: "image"}, [clip, audio]), null);
  assert.equal(createDominantVoiceRequestSnapshot({...clip, track: "audio"}, [clip, audio]), null);
  assert.equal(isDominantVoiceRequestCurrent(snapshot, clip.id, []), false);
});
