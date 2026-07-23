import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCaptionStyle,
  removeTranscriptWordsFromLinkedVideo,
  type TimelineClip,
} from "../src/editorLogic.ts";

test("removes several edited words in one synchronized media rebuild", () => {
  const clips: TimelineClip[] = [
    {
      id: "video",
      label: "Lesson",
      track: "main",
      start: 0,
      duration: 150,
      sourceStart: 0,
      src: "lesson.mp4",
      color: "#0891b2",
      linkedClipId: "audio",
    },
    {
      id: "audio",
      label: "Lesson audio",
      track: "audio",
      start: 0,
      duration: 150,
      sourceStart: 0,
      src: "lesson.mp4",
      color: "#2563eb",
      linkedClipId: "video",
    },
    {
      id: "transcript-segment",
      label: "one two three four five",
      track: "caption",
      start: 0,
      duration: 150,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "one two three four five",
        sourceClipId: "video",
        generationId: "transcript-batch",
      },
    },
  ];

  const result = removeTranscriptWordsFromLinkedVideo(
    clips,
    [
      { clipId: "transcript-segment", wordIndex: 1 },
      { clipId: "transcript-segment", wordIndex: 3 },
    ],
    30,
  );

  const videoSegments = result.filter((clip) => clip.track === "main");
  const audioSegments = result.filter((clip) => clip.track === "audio");
  assert.deepEqual(
    videoSegments.map((clip) => clip.id),
    ["video-speech-0", "video-speech-1", "video-speech-2"],
  );
  assert.equal(
    videoSegments.reduce((total, clip) => total + clip.duration, 0),
    90,
  );
  assert.equal(
    audioSegments.reduce((total, clip) => total + clip.duration, 0),
    90,
  );
  assert.equal(
    result.find((clip) => clip.id === "transcript-segment")?.caption?.content,
    "one three five",
  );
});

test("removes transcript words from video and its extracted audio", () => {
  const clips: TimelineClip[] = [
    {
      id: "video",
      label: "Lesson",
      track: "main",
      start: 0,
      duration: 150,
      sourceStart: 0,
      src: "lesson.mp4",
      color: "#0891b2",
      audioDetached: true,
    },
    {
      id: "extracted-audio",
      label: "Lesson audio",
      track: "audio",
      start: 0,
      duration: 150,
      sourceStart: 0,
      src: "lesson.mp4",
      color: "#2563eb",
      detachedFromVideo: true,
      detachedSourceClipId: "video",
    },
    {
      id: "transcript-segment",
      label: "one two three",
      track: "caption",
      start: 0,
      duration: 150,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "one two three",
        sourceClipId: "video",
        generationId: "transcript-batch",
      },
    },
  ];

  const result = removeTranscriptWordsFromLinkedVideo(
    clips,
    [{ clipId: "transcript-segment", wordIndex: 1 }],
    30,
  );

  const videoSegments = result.filter((clip) => clip.track === "main");
  const audioSegments = result.filter((clip) => clip.track === "audio");

  assert.equal(
    videoSegments.reduce((total, clip) => total + clip.duration, 0),
    100,
  );
  assert.equal(
    audioSegments.reduce((total, clip) => total + clip.duration, 0),
    100,
  );
  assert.deepEqual(
    audioSegments.map((clip) => clip.detachedSourceClipId),
    videoSegments.map((clip) => clip.id),
  );
  assert.ok(audioSegments.every((clip) => clip.detachedFromVideo));
  assert.ok(audioSegments.every((clip) => !clip.linkedClipId));
});

test("cuts native video audio and ripples later media with its transcript", () => {
  const clips: TimelineClip[] = [
    {
      id: "first-video",
      label: "First scene",
      track: "main",
      start: 0,
      duration: 150,
      sourceStart: 0,
      src: "first.mp4",
      color: "#0891b2",
    },
    {
      id: "later-video",
      label: "Later scene",
      track: "main",
      start: 150,
      duration: 60,
      sourceStart: 0,
      src: "later.mp4",
      color: "#0891b2",
    },
    {
      id: "first-transcript",
      label: "one two three",
      track: "caption",
      start: 0,
      duration: 150,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "one two three",
        sourceClipId: "first-video",
        generationId: "transcript-native-audio",
      },
    },
    {
      id: "later-transcript",
      label: "next scene",
      track: "caption",
      start: 150,
      duration: 60,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "next scene",
        sourceClipId: "later-video",
        generationId: "transcript-native-audio",
      },
    },
  ];

  const result = removeTranscriptWordsFromLinkedVideo(
    clips,
    [{ clipId: "first-transcript", wordIndex: 1 }],
    30,
  );

  const firstVideoSegments = result.filter((clip) =>
    clip.id.startsWith("first-video-speech-"),
  );
  assert.equal(
    firstVideoSegments.reduce((total, clip) => total + clip.duration, 0),
    100,
  );
  assert.ok(firstVideoSegments.every((clip) => !clip.audioDetached));
  assert.equal(result.find((clip) => clip.id === "later-video")?.start, 100);
  assert.equal(result.find((clip) => clip.id === "later-transcript")?.start, 100);
  assert.equal(
    result.find((clip) => clip.id === "first-transcript")?.caption?.content,
    "one three",
  );
});
