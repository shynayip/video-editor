import assert from "node:assert/strict";
import test from "node:test";
import {
  createGeneratedCaptionClips,
  defaultCaptionStyle,
} from "../src/editorLogic.ts";
import type {TimelineClip} from "../src/editorLogic.ts";

test("maps caption timing correctly when the selected source clip runs at 2x speed", () => {
  const sourceClip: TimelineClip = {
    id: "main-2x",
    label: "Main clip",
    track: "main",
    start: 90,
    duration: 120,
    sourceStart: 30,
    color: "#0891b2",
    speed: 2,
  };

  const result = createGeneratedCaptionClips({
    sourceClip,
    segments: [{startSeconds: 2, endSeconds: 4, text: "Two times"}],
    fps: 30,
    timelineDuration: 480,
    generationId: "gen-2x",
    style: defaultCaptionStyle,
  });

  assert.deepEqual(result, [
    {
      id: "gen-2x-0",
      label: "Two times",
      track: "caption",
      start: 105,
      duration: 30,
      color: "#ef4444",
      caption: {
        ...defaultCaptionStyle,
        content: "Two times",
        sourceClipId: "main-2x",
        generationId: "gen-2x",
      },
    },
  ]);
});

test("drops invalid caption segments with non-finite endSeconds values", () => {
  const sourceClip: TimelineClip = {
    id: "main-invalid",
    label: "Main clip",
    track: "main",
    start: 90,
    duration: 120,
    sourceStart: 30,
    color: "#0891b2",
    speed: 2,
  };

  const result = createGeneratedCaptionClips({
    sourceClip,
    segments: [
      {startSeconds: 1, endSeconds: Number.NaN, text: "Bad NaN"},
      {startSeconds: 1, endSeconds: Number.POSITIVE_INFINITY, text: "Bad Infinity"},
    ],
    fps: 30,
    timelineDuration: 480,
    generationId: "gen-invalid",
    style: defaultCaptionStyle,
  });

  assert.deepEqual(result, []);
});
