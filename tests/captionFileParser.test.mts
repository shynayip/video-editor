import assert from "node:assert/strict";
import test from "node:test";

import {parseCaptionFile} from "../src/captionFileParser.ts";

test("parses a simple SRT cue into normalized seconds", () => {
  assert.deepEqual(
    parseCaptionFile({
      name: "captions.srt",
      content: "1\n00:00:01,000 --> 00:00:02,500\nHello world",
      fps: 30,
      timelineDuration: 480,
    }),
    [
      {
        startSeconds: 1,
        endSeconds: 2.5,
        text: "Hello world",
      },
    ],
  );
});

test("parses ASS dialogue rows after stripping override tags and escaped newlines", () => {
  assert.deepEqual(
    parseCaptionFile({
      name: "captions.ass",
      content:
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\an8}Hello\\Nworld",
      fps: 30,
      timelineDuration: 480,
    }),
    [
      {
        startSeconds: 1,
        endSeconds: 3.5,
        text: "Hello world",
      },
    ],
  );
});

test("parses LRC cues with repeated timestamps and a short default for the last cue", () => {
  assert.deepEqual(
    parseCaptionFile({
      name: "lyrics.lrc",
      content:
        "[ar:Sample Artist]\n[00:01.00][00:03.00]Shared line\n[00:05.00]Final line",
      fps: 30,
      timelineDuration: 480,
    }),
    [
      {
        startSeconds: 1,
        endSeconds: 3,
        text: "Shared line",
      },
      {
        startSeconds: 3,
        endSeconds: 5,
        text: "Shared line",
      },
      {
        startSeconds: 5,
        endSeconds: 8,
        text: "Final line",
      },
    ],
  );
});

test("rejects unsupported caption file extensions", () => {
  assert.throws(
    () =>
      parseCaptionFile({
        name: "captions.txt",
        content: "just text",
        fps: 30,
        timelineDuration: 480,
      }),
    /unsupported/i,
  );
});

test("rejects malformed caption content instead of returning partial results", () => {
  assert.throws(
    () =>
      parseCaptionFile({
        name: "captions.srt",
        content:
          "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> nope\nBroken cue",
        fps: 30,
        timelineDuration: 480,
      }),
    /malformed|invalid/i,
  );
});

test("validates finite positive composition timing", () => {
  const invalidOptions = [
    {fps: 0, timelineDuration: 480},
    {fps: Number.NaN, timelineDuration: 480},
    {fps: 30, timelineDuration: 0},
    {fps: 30, timelineDuration: Number.POSITIVE_INFINITY},
  ];

  for (const timing of invalidOptions) {
    assert.throws(
      () =>
        parseCaptionFile({
          name: "captions.srt",
          content: "1\n00:00:01,000 --> 00:00:02,000\nHello",
          ...timing,
        }),
      /fps|timeline duration/i,
    );
  }
});

test("clamps overlapping cues and drops wholly out-of-range cues for every format", () => {
  const files = [
    {
      name: "captions.srt",
      content:
        "1\n00:00:01,000 --> 00:00:03,000\nKeep me\n\n2\n00:00:04,000 --> 00:00:05,000\nDrop me",
    },
    {
      name: "captions.ass",
      content:
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Keep me\nDialogue: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,Drop me",
    },
    {
      name: "captions.lrc",
      content: "[00:01.00]Keep me\n[00:04.00]Drop me",
    },
  ];

  for (const file of files) {
    assert.deepEqual(
      parseCaptionFile({
        ...file,
        fps: 30,
        timelineDuration: 60,
      }),
      [{startSeconds: 1, endSeconds: 2, text: "Keep me"}],
      file.name,
    );
  }
});

test("parses ASS text commas when a custom Format places Text before later fields", () => {
  assert.deepEqual(
    parseCaptionFile({
      name: "custom.ass",
      content:
        "[Events]\nFormat: Layer, Text, Start, End, Effect\nDialogue: 0,Hello, with comma,0:00:01.00,0:00:02.00,fade",
      fps: 30,
      timelineDuration: 480,
    }),
    [{startSeconds: 1, endSeconds: 2, text: "Hello, with comma"}],
  );
});

test("rejects out-of-range minute and second timestamp components", () => {
  const files = [
    {
      name: "invalid.srt",
      content: "1\n00:60:00,000 --> 00:60:01,000\nInvalid",
    },
    {
      name: "invalid.ass",
      content:
        "[Events]\nFormat: Layer, Start, End, Text\nDialogue: 0,0:00:60.00,0:01:01.00,Invalid",
    },
    {
      name: "invalid.lrc",
      content: "[00:60.00]Invalid",
    },
  ];

  for (const file of files) {
    assert.throws(
      () =>
        parseCaptionFile({
          ...file,
          fps: 30,
          timelineDuration: 480,
        }),
      /invalid|malformed/i,
      file.name,
    );
  }
});
