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
