import assert from "node:assert/strict";
import {Buffer} from "node:buffer";
import test from "node:test";

import {detectSpeechInMedia} from "../server/voiceActivityDetection.mjs";

test("detects spoken ranges from decoded audio instead of background volume", async () => {
  const calls = [];
  const samples = new Float32Array([0, 0.1, -0.1]);
  const ranges = await detectSpeechInMedia({
    inputPath: "C:/media/input.mp4",
    outputPath: "C:/temp/audio.f32le",
    ffmpegPath: "ffmpeg",
    sourceStartSeconds: 2,
    durationSeconds: 8,
    execFileImpl: async (file, args, options) => calls.push({file, args, options}),
    readFileImpl: async () => Buffer.from(samples.buffer),
    analyzeVoiceActivityImpl: async (audio) => {
      assert.deepEqual([...audio], [...samples]);
      return [
        {startSeconds: 0.5, endSeconds: 1.5},
        {startSeconds: 4, endSeconds: 5},
      ];
    },
  });

  assert.deepEqual(ranges, [
    {startSeconds: 0.38, endSeconds: 1.62},
    {startSeconds: 3.88, endSeconds: 5.12},
  ]);
  assert.deepEqual(calls[0].args.slice(0, 8), [
    "-y", "-ss", "2", "-t", "8", "-i", "C:/media/input.mp4", "-vn",
  ]);
});
