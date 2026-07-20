import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSceneDetectionArgs,
  detectScenesInMedia,
  normalizeSceneRanges,
  parseSceneTimestamps,
} from "../server/sceneDetection.mjs";

test("parses visual cut timestamps from FFmpeg showinfo output", () => {
  const stderr = [
    "[Parsed_showinfo_1] n: 0 pts: 144000 pts_time:1.6 pos: 0",
    "[Parsed_showinfo_1] n: 1 pts: 432000 pts_time:4.8 pos: 200",
  ].join("\n");

  assert.deepEqual(parseSceneTimestamps(stderr), [1.6, 4.8]);
});

test("normalizes cuts into contiguous ranges and merges short scenes", () => {
  assert.deepEqual(normalizeSceneRanges({
    timestamps: [0, 0.2, 4.8, 4.8, 11.2, 99],
    durationSeconds: 12,
    minimumDurationSeconds: 0.75,
  }), [
    {startSeconds: 0, endSeconds: 4.8},
    {startSeconds: 4.8, endSeconds: 11.2},
    {startSeconds: 11.2, endSeconds: 12},
  ]);
});

test("returns one full-length range when no visual cut exists", () => {
  assert.deepEqual(normalizeSceneRanges({
    timestamps: [],
    durationSeconds: 7.5,
    minimumDurationSeconds: 0.75,
  }), [{startSeconds: 0, endSeconds: 7.5}]);
});

test("returns the whole valid source when it is shorter than the minimum scene duration", () => {
  assert.deepEqual(normalizeSceneRanges({
    timestamps: [0.2],
    durationSeconds: 0.5,
    minimumDurationSeconds: 0.75,
  }), [{startSeconds: 0, endSeconds: 0.5}]);
});

test("builds FFmpeg scene detection with the approved threshold", () => {
  assert.deepEqual(buildSceneDetectionArgs("C:/temp/input.mp4", 0.32), [
    "-hide_banner", "-i", "C:/temp/input.mp4",
    "-vf", "select='gt(scene,0.32)',showinfo",
    "-an", "-f", "null", "-",
  ]);
});

test("runs FFprobe and FFmpeg through the injected process runner", async () => {
  const calls = [];
  const abortController = new AbortController();
  const ranges = await detectScenesInMedia({
    inputPath: "C:/temp/input.mp4",
    ffmpegPath: "C:/tools/ffmpeg.exe",
    ffprobePath: "C:/tools/ffprobe.exe",
    threshold: 0.32,
    minimumDurationSeconds: 0.75,
    signal: abortController.signal,
    execFileImpl: async (file, args, options) => {
      calls.push({file, args, options});
      if (file.endsWith("ffprobe.exe")) return {stdout: "12\n"};
      return {stderr: "pts_time:4.8"};
    },
  });

  assert.deepEqual(calls, [
    {
      file: "C:/tools/ffprobe.exe",
      args: [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", "C:/temp/input.mp4",
      ],
      options: {signal: abortController.signal},
    },
    {
      file: "C:/tools/ffmpeg.exe",
      args: [
        "-hide_banner", "-i", "C:/temp/input.mp4",
        "-vf", "select='gt(scene,0.32)',showinfo",
        "-an", "-f", "null", "-",
      ],
      options: {
        signal: abortController.signal,
        maxBuffer: 64 * 1024 * 1024,
      },
    },
  ]);
  assert.deepEqual(ranges, [
    {startSeconds: 0, endSeconds: 4.8},
    {startSeconds: 4.8, endSeconds: 12},
  ]);
});

test("rethrows FFmpeg failures so the client can report fallback", async () => {
  const calls = [];
  await assert.rejects(
    detectScenesInMedia({
      inputPath: "C:/temp/input.mp4",
      ffmpegPath: "C:/tools/ffmpeg.exe",
      ffprobePath: "C:/tools/ffprobe.exe",
      execFileImpl: async (file, args) => {
        calls.push({file, args});
        if (file === "C:/tools/ffprobe.exe") return {stdout: "6.25\n"};
        throw new Error("scene detection failed");
      },
    }),
    /scene detection failed/,
  );

  assert.deepEqual(calls.map(({file}) => file), [
    "C:/tools/ffprobe.exe",
    "C:/tools/ffmpeg.exe",
  ]);
});
