import assert from "node:assert/strict";
import test from "node:test";

import {createSpeechRanges} from "../server/speechDetection.mjs";

test("turns word timestamps into padded speech ranges while preserving real gaps", () => {
  assert.deepEqual(
    createSpeechRanges(
      [
        {startSeconds: 1, endSeconds: 1.4, text: "one"},
        {startSeconds: 1.55, endSeconds: 2, text: "two"},
        {startSeconds: 4, endSeconds: 4.5, text: "three"},
      ],
      {durationSeconds: 6, speechPaddingSeconds: 0.1, mergeGapSeconds: 0.3},
    ),
    [
      {startSeconds: 0.9, endSeconds: 2.1},
      {startSeconds: 3.9, endSeconds: 4.6},
    ],
  );
});

test("clamps speech ranges to the selected source duration", () => {
  assert.deepEqual(
    createSpeechRanges(
      [
        {startSeconds: 0, endSeconds: 0.2},
        {startSeconds: 4.8, endSeconds: 5.2},
      ],
      {durationSeconds: 5, speechPaddingSeconds: 0.2},
    ),
    [
      {startSeconds: 0, endSeconds: 0.4},
      {startSeconds: 4.6, endSeconds: 5},
    ],
  );
});
