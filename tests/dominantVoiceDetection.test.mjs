import assert from "node:assert/strict";
import {Buffer} from "node:buffer";
import {join} from "node:path";
import test from "node:test";

import * as dominantVoiceDetection from "../server/dominantVoiceDetection.mjs";

const {
  clusterSpeakerWindows,
  createDominantVoiceDetector,
  normalizeDominantVoiceRanges,
} = dominantVoiceDetection;

const AbortControllerCtor = globalThis.AbortController;

const createDetectorHarness = ({
  candidateSpeech = [
    {startSeconds: 0, endSeconds: 2},
    {startSeconds: 3, endSeconds: 5},
    {startSeconds: 6, endSeconds: 7},
  ],
  createEmbeddingImpl = async (_audio, range) =>
    range.startSeconds < 5 ? [1, 0] : [0, 1],
  removeDirectoryImpl,
} = {}) => {
  const calls = {removeDirectory: []};
  const detector = createDominantVoiceDetector({
    extractAudioImpl: async () => "C:/temp/selected.wav",
    findCandidateSpeechImpl: async () => candidateSpeech,
    loadAudioImpl: async () => new Float32Array(16000 * 8),
    createEmbeddingImpl,
    makeTempDirectoryImpl: async () => "C:/temp/dominant-job",
    removeDirectoryImpl: async (directory, options) => {
      calls.removeDirectory.push({directory, options});
      await removeDirectoryImpl?.(directory, options);
    },
  });

  return {calls, detector};
};

test("clusters matching speaker embeddings and selects duration independently", () => {
  const clusters = clusterSpeakerWindows([
    {startSeconds: 0, endSeconds: 2, embedding: [1, 0]},
    {startSeconds: 2.5, endSeconds: 4.5, embedding: [0.98, 0.02]},
    {startSeconds: 5, endSeconds: 6, embedding: [0, 1]},
  ], {similarityThreshold: 0.82});

  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].durationSeconds, 4);
  assert.equal(clusters[1].durationSeconds, 1);
});

test("pads, clamps, and merges nearby dominant ranges", () => {
  assert.deepEqual(normalizeDominantVoiceRanges([
    {startSeconds: 1, endSeconds: 2},
    {startSeconds: 2.2, endSeconds: 3},
  ], {durationSeconds: 4, paddingSeconds: 0.15, mergeGapSeconds: 0.3}), [
    {startSeconds: 0.85, endSeconds: 3.15},
  ]);
});

test("retains 0.6-second windows and merges a 0.3-second floating-point gap", async () => {
  assert.deepEqual(normalizeDominantVoiceRanges([
    {startSeconds: 0, endSeconds: 0.6},
    {startSeconds: 0.9, endSeconds: 1.5},
  ], {durationSeconds: 2, paddingSeconds: 0, mergeGapSeconds: 0.3}), [
    {startSeconds: 0, endSeconds: 1.5},
  ]);

  const {detector} = createDetectorHarness({
    candidateSpeech: [
      {startSeconds: 0, endSeconds: 0.6},
      {startSeconds: 0.9, endSeconds: 1.5},
    ],
    createEmbeddingImpl: async () => [1, 0],
  });

  const result = await detector.detect({
    inputPath: "C:/media/clip.mp4",
    durationSeconds: 2,
  });

  assert.deepEqual(result.ranges, [{startSeconds: 0, endSeconds: 1.65}]);
  assert.equal(result.dominantSpeechSeconds, 1.2);
});

test("bounds overlapping analysis windows without double-counting speech ownership", () => {
  assert.equal(
    typeof dominantVoiceDetection.createCandidateSpeechWindows,
    "function",
  );
  const windows = dominantVoiceDetection.createCandidateSpeechWindows([
    {startSeconds: 0, endSeconds: 900},
  ], 900);

  assert.ok(windows.length <= 256);
  assert.equal(windows[0].startSeconds, 0);
  assert.equal(windows.at(-1).endSeconds, 900);
  assert.ok(windows.every((window) =>
    window.analysisEndSeconds - window.analysisStartSeconds <= 5.000001,
  ));
  assert.ok(windows.slice(1).every((window, index) =>
    window.analysisStartSeconds < windows[index].analysisEndSeconds,
  ));
  assert.ok(windows.slice(1).every((window, index) =>
    window.startSeconds === windows[index].endSeconds,
  ));
});

test("distinguishes rapid adjacent speakers inside one non-silence region", async () => {
  const seenRanges = [];
  const {detector} = createDetectorHarness({
    candidateSpeech: [{startSeconds: 0, endSeconds: 4.5}],
    createEmbeddingImpl: async (_audio, range) => {
      seenRanges.push(range);
      const center = (range.analysisStartSeconds + range.analysisEndSeconds) / 2;
      return center >= 1.5 && center < 2.5 ? [0, 1] : [1, 0];
    },
  });

  const result = await detector.detect({
    inputPath: "C:/media/rapid-speakers.mp4",
    durationSeconds: 4.5,
  });

  assert.ok(seenRanges.length > 1);
  assert.ok(seenRanges.every((range) =>
    range.analysisEndSeconds - range.analysisStartSeconds <= 1.500001,
  ));
  assert.deepEqual(result.ranges, [
    {startSeconds: 0, endSeconds: 1.4625},
    {startSeconds: 2.2875, endSeconds: 4.5},
  ]);
  assert.equal(result.dominantSpeechSeconds, 3.375);
  assert.equal(result.analyzedSpeechSeconds, 4.5);
});

test("reads FFmpeg f32le output without invoking the browser-only audio loader", async () => {
  const samples = new Float32Array([0.25, -0.5, 0.75]);
  const ffmpegCalls = [];
  const readFilePaths = [];
  let embeddingAudio;
  let embeddingRuntimeLoaded = false;
  const detector = createDominantVoiceDetector({
    execFileImpl: async (file, args, options) => {
      ffmpegCalls.push({file, args, options});
    },
    detectSilenceInMediaImpl: async () => [],
    readFileImpl: async (audioPath) => {
      readFilePaths.push(audioPath);
      return Buffer.from(samples.buffer);
    },
    loadEmbeddingRuntimeImpl: async () => {
      embeddingRuntimeLoaded = true;
      return {
        readAudio: async () => {
          throw new Error("AudioContext is not available");
        },
      };
    },
    createEmbeddingImpl: async (audio) => {
      embeddingAudio = audio;
      return [1, 0];
    },
    makeTempDirectoryImpl: async () => "C:/temp/dominant-f32le-job",
    removeDirectoryImpl: async () => undefined,
  });

  await detector.detect({
    inputPath: "C:/media/clip.mp4",
    ffmpegPath: "ffmpeg-custom",
    durationSeconds: 2,
  });

  const outputPath = join("C:/temp/dominant-f32le-job", "selected.f32le");
  assert.deepEqual(ffmpegCalls, [{
    file: "ffmpeg-custom",
    args: [
      "-y", "-ss", "0", "-t", "2", "-i", "C:/media/clip.mp4",
      "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", outputPath,
    ],
    options: {signal: undefined},
  }]);
  assert.deepEqual(readFilePaths, [outputPath]);
  assert.deepEqual([...embeddingAudio], [...samples]);
  assert.equal(embeddingAudio.buffer, samples.buffer);
  assert.equal(embeddingRuntimeLoaded, false);
});

test("returns only the longest-speaking cluster", async () => {
  const {detector} = createDetectorHarness();

  const result = await detector.detect({
    inputPath: "C:/media/clip.mp4",
    sourceStartSeconds: 2,
    durationSeconds: 8,
  });

  assert.deepEqual(result, {
    ranges: [
      {startSeconds: 0, endSeconds: 2.15},
      {startSeconds: 2.85, endSeconds: 5.15},
    ],
    dominantSpeechSeconds: 4,
    analyzedSpeechSeconds: 5,
  });
});

test("rejects when no candidate speech is found and cleans up", async () => {
  const {calls, detector} = createDetectorHarness({candidateSpeech: []});

  await assert.rejects(
    detector.detect({
      inputPath: "C:/media/clip.mp4",
      durationSeconds: 8,
    }),
    /No candidate speech was found/,
  );

  assert.deepEqual(calls.removeDirectory, [{
    directory: "C:/temp/dominant-job",
    options: {recursive: true, force: true},
  }]);
});

test("rejects dominant speech shorter than 1.2 seconds", async () => {
  const {detector} = createDetectorHarness({
    candidateSpeech: [{startSeconds: 0, endSeconds: 1}],
  });

  await assert.rejects(
    detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
    /at least 1.2 seconds/,
  );
});

test("rejects speakers without a 0.45 dominant-duration ratio", async () => {
  const {detector} = createDetectorHarness({
    candidateSpeech: [
      {startSeconds: 0, endSeconds: 2},
      {startSeconds: 2.1, endSeconds: 3.7},
      {startSeconds: 3.8, endSeconds: 4.8},
    ],
    createEmbeddingImpl: async (_audio, range) => {
      if (range.startSeconds === 0) return [1, 0];
      if (range.startSeconds === 2.1) return [0, 1];
      return [-1, 0];
    },
  });

  await assert.rejects(
    detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
    /0.45 dominant-duration ratio/,
  );
});

test("rejects tied and numerically indistinguishable dominant clusters", async () => {
  for (const secondEndSeconds of [5, 5.0000001]) {
    const {detector} = createDetectorHarness({
      candidateSpeech: [
        {startSeconds: 0, endSeconds: 2},
        {startSeconds: 3, endSeconds: secondEndSeconds},
      ],
      createEmbeddingImpl: async (_audio, range) =>
        range.startSeconds === 0 ? [1, 0] : [0, 1],
    });

    await assert.rejects(
      detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
      /ambiguous/,
    );
  }
});

test("rejects speaker embeddings with NaN or Infinity", async () => {
  for (const embedding of [[Number.NaN, 0], [Number.POSITIVE_INFINITY, 0]]) {
    const {detector} = createDetectorHarness({
      candidateSpeech: [{startSeconds: 0, endSeconds: 2}],
      createEmbeddingImpl: async () => embedding,
    });

    await assert.rejects(
      detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
      /finite non-zero/,
    );
  }
});

test("rejects zero-magnitude speaker embeddings", async () => {
  const {detector} = createDetectorHarness({
    candidateSpeech: [{startSeconds: 0, endSeconds: 2}],
    createEmbeddingImpl: async () => [0, 0],
  });

  await assert.rejects(
    detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
    /finite non-zero/,
  );
});

test("preserves model failures when temporary-directory cleanup fails", async () => {
  const {calls, detector} = createDetectorHarness({
    createEmbeddingImpl: async () => {
      throw new Error("model inference failed");
    },
    removeDirectoryImpl: async () => {
      throw new Error("cleanup failed");
    },
  });

  await assert.rejects(
    detector.detect({inputPath: "C:/media/clip.mp4", durationSeconds: 8}),
    /model inference failed/,
  );
  assert.equal(calls.removeDirectory.length, 1);
});

test("aborts between embeddings and cleans up its temporary directory", async () => {
  const abortController = new AbortControllerCtor();
  const {calls, detector} = createDetectorHarness({
    createEmbeddingImpl: async () => {
      abortController.abort();
      return [1, 0];
    },
  });

  await assert.rejects(
    detector.detect({
      inputPath: "C:/media/clip.mp4",
      durationSeconds: 8,
      signal: abortController.signal,
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(calls.removeDirectory.length, 1);
});

test("aborts promptly while the embedding runtime is still loading", async () => {
  const abortController = new AbortControllerCtor();
  let runtimeStarted;
  const runtimeStartedPromise = new Promise((resolve) => {
    runtimeStarted = resolve;
  });
  const detector = createDominantVoiceDetector({
    extractAudioImpl: async () => "C:/temp/selected.f32le",
    findCandidateSpeechImpl: async () => [{startSeconds: 0, endSeconds: 2}],
    loadEmbeddingRuntimeImpl: async () => {
      runtimeStarted();
      return new Promise(() => {});
    },
    loadAudioImpl: async () => {
      assert.fail("aborted runtime loading must not read decoded audio");
    },
    createEmbeddingImpl: async () => [1, 0],
    makeTempDirectoryImpl: async () => "C:/temp/dominant-runtime-abort",
    removeDirectoryImpl: async () => undefined,
  });

  const detection = detector.detect({
    inputPath: "C:/media/clip.mp4",
    durationSeconds: 2,
    signal: abortController.signal,
  });
  await runtimeStartedPromise;
  abortController.abort();

  await assert.rejects(
    Promise.race([
      detection,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("runtime abort did not reject promptly")),
        100,
      )),
    ]),
    (error) => error?.name === "AbortError",
  );
});

test("aborts promptly while a speaker embedding inference is unresolved", async () => {
  const abortController = new AbortControllerCtor();
  let inferenceStarted;
  const inferenceStartedPromise = new Promise((resolve) => {
    inferenceStarted = resolve;
  });
  const {detector} = createDetectorHarness({
    candidateSpeech: [{startSeconds: 0, endSeconds: 2}],
    createEmbeddingImpl: async () => {
      inferenceStarted();
      return new Promise(() => {});
    },
  });

  const detection = detector.detect({
    inputPath: "C:/media/clip.mp4",
    durationSeconds: 2,
    signal: abortController.signal,
  });
  await inferenceStartedPromise;
  abortController.abort();

  await assert.rejects(
    Promise.race([
      detection,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("inference abort did not reject promptly")),
        100,
      )),
    ]),
    (error) => error?.name === "AbortError",
  );
});

test("extracts the selected source range and uses the silence complement", async () => {
  const ffmpegCalls = [];
  const detector = createDominantVoiceDetector({
    execFileImpl: async (file, args, options) => {
      ffmpegCalls.push({file, args, options});
    },
    detectSilenceInMediaImpl: async () => [{startSeconds: 1, endSeconds: 2}],
    loadAudioImpl: async () => new Float32Array(16000 * 4),
    createEmbeddingImpl: async (_audio, range) =>
      range.startSeconds < 2 ? [1, 0] : [0, 1],
    makeTempDirectoryImpl: async () => "C:/temp/dominant-default-job",
    removeDirectoryImpl: async () => undefined,
  });

  const result = await detector.detect({
    inputPath: "C:/media/clip.mp4",
    ffmpegPath: "ffmpeg-custom",
    sourceStartSeconds: 9,
    durationSeconds: 4,
  });

  assert.deepEqual(ffmpegCalls, [{
    file: "ffmpeg-custom",
    args: [
      "-y", "-ss", "9", "-t", "4", "-i", "C:/media/clip.mp4",
      "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le",
      join("C:/temp/dominant-default-job", "selected.f32le"),
    ],
    options: {signal: undefined},
  }]);
  assert.deepEqual(result.ranges, [{startSeconds: 1.85, endSeconds: 4}]);
});
