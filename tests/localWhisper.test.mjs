import assert from "node:assert/strict";
import {Buffer} from "node:buffer";
import test from "node:test";

import {
  createLocalWhisper,
  transcribeMediaFileLocally,
} from "../server/localWhisper.mjs";

test("loads the local Whisper pipeline once and normalizes timed chunks", async () => {
  let pipelineLoads = 0;
  let loadedModelId = null;
  const whisper = createLocalWhisper({
    pipelineFactory: async (_task, modelId) => {
      pipelineLoads += 1;
      loadedModelId = modelId;
      return async () => ({
        chunks: [
          {text: " Hello ", timestamp: [0, 0.8]},
          {text: "world", timestamp: [0.8, 1.4]},
        ],
      });
    },
  });
  const audio = new Float32Array([0, 0.25, -0.25]);

  const first = await whisper.transcribeAudio(audio);
  await whisper.transcribeAudio(audio);

  assert.equal(pipelineLoads, 1);
  assert.equal(loadedModelId, "onnx-community/whisper-small.en");
  assert.deepEqual(first, [
    {startSeconds: 0, endSeconds: 0.8, text: "Hello"},
    {startSeconds: 0.8, endSeconds: 1.4, text: "world"},
  ]);
});

test("extracts trimmed mono float audio and cleans up after local transcription", async () => {
  const ffmpegCalls = [];
  const cleanupCalls = [];
  const samples = new Float32Array([0, 0.5, -0.5]);

  const segments = await transcribeMediaFileLocally({
    inputPath: "C:/temp/input.mp4",
    outputPath: "C:/temp/output.f32le",
    tempDirectory: "C:/temp/job-local",
    ffmpegPath: "ffmpeg",
    sourceStartSeconds: 1.5,
    durationSeconds: 3,
    execFileImpl: async (file, args) => ffmpegCalls.push({file, args}),
    readFileImpl: async () => Buffer.from(samples.buffer),
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({directory, options});
    },
    transcribeAudioImpl: async (audio) => {
      assert.deepEqual([...audio], [...samples]);
      return [{startSeconds: 0, endSeconds: 1, text: "Local transcript"}];
    },
  });

  assert.deepEqual(ffmpegCalls, [{
    file: "ffmpeg",
    args: [
      "-y", "-ss", "1.5", "-t", "3", "-i", "C:/temp/input.mp4",
      "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le",
      "C:/temp/output.f32le",
    ],
  }]);
  assert.deepEqual(segments, [
    {startSeconds: 0, endSeconds: 1, text: "Local transcript"},
  ]);
  assert.deepEqual(cleanupCalls, [{
    directory: "C:/temp/job-local",
    options: {recursive: true, force: true},
  }]);
});
