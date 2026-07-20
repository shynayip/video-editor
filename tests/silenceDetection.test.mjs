import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSilenceInMedia,
  parseSilenceRanges,
} from "../server/silenceDetection.mjs";

test("parses qualifying FFmpeg silence and preserves speech padding", () => {
  const ranges = parseSilenceRanges(`
    [silencedetect] silence_start: 1.2
    [silencedetect] silence_end: 2.4 | silence_duration: 1.2
  `, {
    durationSeconds: 5,
    minimumSilenceSeconds: 0.6,
    speechPaddingSeconds: 0.15,
  });

  assert.deepEqual(ranges, [{startSeconds: 1.35, endSeconds: 2.25}]);
});

test("drops silence exactly at the minimum duration", () => {
  const ranges = parseSilenceRanges(`
    silence_start: 1
    silence_end: 1.6 | silence_duration: 0.6
  `, {
    durationSeconds: 5,
    minimumSilenceSeconds: 0.6,
    speechPaddingSeconds: 0.15,
  });

  assert.deepEqual(ranges, []);
});

test("drops short pauses and clamps terminal silence", () => {
  const ranges = parseSilenceRanges(`
    silence_start: 0.2
    silence_end: 0.6 | silence_duration: 0.4
    silence_start: 4
  `, {
    durationSeconds: 5,
    minimumSilenceSeconds: 0.6,
    speechPaddingSeconds: 0.15,
  });

  assert.deepEqual(ranges, [{startSeconds: 4.15, endSeconds: 5}]);
});

test("runs silencedetect only over the selected visible source range", async () => {
  const calls = [];
  const ranges = await detectSilenceInMedia({
    inputPath: "C:/temp/video.mp4",
    ffmpegPath: "ffmpeg",
    sourceStartSeconds: 2,
    durationSeconds: 8,
    execFileImpl: async (file, args) => {
      calls.push({file, args});
      return {
        stderr: "silence_start: 1\nsilence_end: 2 | silence_duration: 1",
      };
    },
  });

  assert.deepEqual(calls[0].args, [
    "-hide_banner", "-ss", "2", "-t", "8", "-i", "C:/temp/video.mp4",
    "-vn", "-af", "silencedetect=noise=-40dB:d=0.6", "-f", "null", "-",
  ]);
  assert.deepEqual(ranges, [{startSeconds: 1.15, endSeconds: 1.85}]);
});

test("parses silence from a successful FFmpeg execution", async () => {
  const ranges = await detectSilenceInMedia({
    inputPath: "C:/temp/video.mp4",
    ffmpegPath: "ffmpeg",
    durationSeconds: 5,
    execFileImpl: async () => ({
      stderr: "silence_start: 1\nsilence_end: 2 | silence_duration: 1",
    }),
  });

  assert.deepEqual(ranges, [{startSeconds: 1.15, endSeconds: 1.85}]);
});

test("rethrows FFmpeg failures without silence events", async () => {
  const error = new Error("invalid media");
  error.stderr = "Could not decode input file";

  await assert.rejects(
    detectSilenceInMedia({
      inputPath: "C:/temp/video.mp4",
      ffmpegPath: "ffmpeg",
      durationSeconds: 5,
      execFileImpl: async () => {
        throw error;
      },
    }),
    (receivedError) => receivedError === error,
  );
});

test("rethrows max-buffer failures with partial silence output", async () => {
  const error = new Error("stderr maxBuffer length exceeded");
  error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
  error.stderr = "silence_start: 1\nsilence_end: 2 | silence_duration: 1";

  await assert.rejects(
    detectSilenceInMedia({
      inputPath: "C:/temp/video.mp4",
      ffmpegPath: "ffmpeg",
      durationSeconds: 5,
      execFileImpl: async () => {
        throw error;
      },
    }),
    (receivedError) => receivedError === error,
  );
});

test("rethrows abort failures with partial silence output", async () => {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  error.code = "ABORT_ERR";
  error.stderr = "silence_start: 1\nsilence_end: 2 | silence_duration: 1";

  await assert.rejects(
    detectSilenceInMedia({
      inputPath: "C:/temp/video.mp4",
      ffmpegPath: "ffmpeg",
      durationSeconds: 5,
      execFileImpl: async () => {
        throw error;
      },
    }),
    (receivedError) => receivedError === error,
  );
});
