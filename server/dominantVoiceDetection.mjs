import {execFile} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";

import ffmpegPath from "ffmpeg-static";

import {detectSilenceInMedia} from "./silenceDetection.mjs";

const RuntimeDOMException = globalThis.DOMException;
const cleanupOptions = {recursive: true, force: true};
const minimumCandidateSpeechSeconds = 0.6;
const minimumDominantSpeechSeconds = 1.2;
const minimumDominantRatio = 0.45;
const sampleRate = 16000;
const secondsEpsilon = 1e-6;
const execFileAsync = promisify(execFile);

const roundSeconds = (value) => Math.round(value * 1e6) / 1e6;

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new RuntimeDOMException("The operation was aborted.", "AbortError");
  }
};

const cleanupTempDirectory = async ({
  removeDirectoryImpl,
  tempDirectory,
  primaryFailureOccurred,
}) => {
  try {
    await removeDirectoryImpl(tempDirectory, cleanupOptions);
  } catch (cleanupError) {
    if (!primaryFailureOccurred) throw cleanupError;
  }
};

const complementSilenceRanges = (silenceRanges, durationSeconds) => {
  const candidates = [];
  let cursor = 0;
  const orderedSilences = (Array.isArray(silenceRanges) ? silenceRanges : [])
    .map((range) => ({
      startSeconds: Math.max(0, Number(range?.startSeconds)),
      endSeconds: Math.min(durationSeconds, Number(range?.endSeconds)),
    }))
    .filter((range) =>
      Number.isFinite(range.startSeconds) &&
      Number.isFinite(range.endSeconds) &&
      range.endSeconds > range.startSeconds,
    )
    .sort((left, right) => left.startSeconds - right.startSeconds);

  for (const silence of orderedSilences) {
    if (silence.startSeconds > cursor) {
      candidates.push({startSeconds: cursor, endSeconds: silence.startSeconds});
    }
    cursor = Math.max(cursor, silence.endSeconds);
  }

  if (cursor < durationSeconds) {
    candidates.push({startSeconds: cursor, endSeconds: durationSeconds});
  }

  return candidates;
};

const getCandidateSpeechWindows = (ranges, durationSeconds) =>
  (Array.isArray(ranges) ? ranges : []).flatMap((range) => {
    const startSeconds = Math.max(0, Number(range?.startSeconds));
    const endSeconds = Math.min(durationSeconds, Number(range?.endSeconds));

    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      endSeconds - startSeconds < minimumCandidateSpeechSeconds - secondsEpsilon
    ) {
      return [];
    }

    return [{startSeconds, endSeconds}];
  });

const defaultExtractAudio = async ({
  inputPath,
  outputWavPath,
  ffmpegPath: selectedFfmpegPath,
  sourceStartSeconds,
  durationSeconds,
  signal,
  execFileImpl,
}) => {
  await execFileImpl(selectedFfmpegPath, [
    "-y", "-ss", String(sourceStartSeconds), "-t", String(durationSeconds),
    "-i", inputPath, "-vn", "-ac", "1", "-ar", String(sampleRate),
    "-f", "f32le", outputWavPath,
  ], {signal});
  return outputWavPath;
};

const defaultFindCandidateSpeech = async ({
  inputPath,
  ffmpegPath: selectedFfmpegPath,
  sourceStartSeconds,
  durationSeconds,
  signal,
  detectSilenceInMediaImpl,
}) => complementSilenceRanges(await detectSilenceInMediaImpl({
  inputPath,
  ffmpegPath: selectedFfmpegPath,
  sourceStartSeconds,
  durationSeconds,
  signal,
}), durationSeconds);

let embeddingRuntimePromise = null;

const loadEmbeddingRuntime = () => {
  if (!embeddingRuntimePromise) {
    embeddingRuntimePromise = import("@huggingface/transformers").then(
      async ({AutoModel, AutoProcessor}) => {
        const modelId = "Xenova/wavlm-base-plus-sv";
        const [processor, model] = await Promise.all([
          AutoProcessor.from_pretrained(modelId),
          AutoModel.from_pretrained(modelId, {dtype: "q8"}),
        ]);
        return {processor, model};
      },
    ).catch((error) => {
      embeddingRuntimePromise = null;
      throw error;
    });
  }

  return embeddingRuntimePromise;
};

const defaultLoadAudio = async (audioPath, _runtime, readFileImpl) => {
  const audioBuffer = await readFileImpl(audioPath);
  const sampleBytes = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength,
  );

  if (sampleBytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("FFmpeg produced an invalid f32le audio stream.");
  }

  return new Float32Array(sampleBytes);
};

const defaultCreateEmbedding = async (audio, _range, runtime) => {
  const inputs = await runtime.processor(audio);
  const output = await runtime.model(inputs);
  return Array.from(output.embeddings.data);
};

export const cosineSimilarity = (left, right) => {
  if (!left?.length || left.length !== right?.length) return -1;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? dot / denominator : -1;
};

export const clusterSpeakerWindows = (
  windows,
  {similarityThreshold = 0.82} = {},
) => {
  const clusters = [];

  for (const window of windows) {
    let best = null;
    let bestSimilarity = -1;

    for (const cluster of clusters) {
      const similarity = cosineSimilarity(window.embedding, cluster.centroid);
      if (similarity > bestSimilarity) {
        best = cluster;
        bestSimilarity = similarity;
      }
    }

    if (!best || bestSimilarity < similarityThreshold) {
      clusters.push({
        centroid: [...window.embedding],
        windows: [window],
        durationSeconds: window.endSeconds - window.startSeconds,
      });
      continue;
    }

    best.windows.push(window);
    best.durationSeconds += window.endSeconds - window.startSeconds;
    best.centroid = best.centroid.map((value, index) =>
      (value * (best.windows.length - 1) + window.embedding[index]) /
      best.windows.length,
    );
  }

  return clusters.sort((left, right) =>
    right.durationSeconds - left.durationSeconds,
  );
};

export const normalizeDominantVoiceRanges = (
  ranges,
  {
    durationSeconds,
    paddingSeconds = 0.15,
    mergeGapSeconds = 0.3,
  } = {},
) => {
  const paddedRanges = ranges
    .map((range) => ({
      startSeconds: Math.max(0, range.startSeconds - paddingSeconds),
      endSeconds: Math.min(durationSeconds, range.endSeconds + paddingSeconds),
    }))
    .filter((range) => range.endSeconds > range.startSeconds)
    .sort((left, right) => left.startSeconds - right.startSeconds);

  const mergedRanges = [];
  for (const range of paddedRanges) {
    const previous = mergedRanges.at(-1);
    if (
      previous &&
      range.startSeconds - previous.endSeconds <= mergeGapSeconds + secondsEpsilon
    ) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
      continue;
    }

    mergedRanges.push({...range});
  }

  return mergedRanges.map((range) => ({
    startSeconds: roundSeconds(range.startSeconds),
    endSeconds: roundSeconds(range.endSeconds),
  }));
};

export const createDominantVoiceDetector = ({
  execFileImpl = execFileAsync,
  extractAudioImpl = defaultExtractAudio,
  findCandidateSpeechImpl = defaultFindCandidateSpeech,
  detectSilenceInMediaImpl = detectSilenceInMedia,
  loadEmbeddingRuntimeImpl = loadEmbeddingRuntime,
  loadAudioImpl = defaultLoadAudio,
  createEmbeddingImpl = defaultCreateEmbedding,
  makeTempDirectoryImpl = mkdtemp,
  readFileImpl = readFile,
  removeDirectoryImpl = rm,
} = {}) => ({
  async detect({
    inputPath,
    ffmpegPath: selectedFfmpegPath = ffmpegPath,
    sourceStartSeconds = 0,
    durationSeconds,
    signal,
  }) {
    throwIfAborted(signal);
    const tempDirectory = await makeTempDirectoryImpl(
      join(tmpdir(), "dominant-voice-"),
    );
    let primaryFailureOccurred = false;

    try {
      const outputWavPath = join(tempDirectory, "selected.f32le");
      const audioPath = await extractAudioImpl({
        inputPath,
        outputWavPath,
        ffmpegPath: selectedFfmpegPath,
        sourceStartSeconds,
        durationSeconds,
        signal,
        execFileImpl,
      });
      throwIfAborted(signal);

      const candidateSpeech = getCandidateSpeechWindows(
        await findCandidateSpeechImpl({
          inputPath,
          ffmpegPath: selectedFfmpegPath,
          sourceStartSeconds,
          durationSeconds,
          signal,
          detectSilenceInMediaImpl,
        }),
        durationSeconds,
      );
      throwIfAborted(signal);

      if (candidateSpeech.length === 0) {
        throw new Error("No candidate speech was found.");
      }

      const requiresRuntime = createEmbeddingImpl === defaultCreateEmbedding;
      const runtime = requiresRuntime ? await loadEmbeddingRuntimeImpl() : undefined;
      const audio = await loadAudioImpl(audioPath, runtime, readFileImpl);
      const windows = [];

      for (const range of candidateSpeech) {
        throwIfAborted(signal);
        const startSample = Math.floor(range.startSeconds * sampleRate);
        const endSample = Math.ceil(range.endSeconds * sampleRate);
        const embedding = await createEmbeddingImpl(
          audio.slice(startSample, endSample),
          range,
          runtime,
        );
        throwIfAborted(signal);

        let magnitude = 0;
        for (const value of embedding ?? []) {
          if (!Number.isFinite(value)) {
            throw new Error("Speaker embedding must contain finite non-zero values.");
          }
          magnitude += value ** 2;
        }

        if (!embedding?.length || !Number.isFinite(magnitude) || magnitude === 0) {
          throw new Error("Speaker embedding must contain finite non-zero values.");
        }

        windows.push({...range, embedding});
      }

      const clusters = clusterSpeakerWindows(windows);
      const dominantCluster = clusters[0];
      const runnerUpCluster = clusters[1];
      const dominantSpeechSeconds = dominantCluster?.durationSeconds ?? 0;
      const analyzedSpeechSeconds = candidateSpeech.reduce(
        (total, range) => total + range.endSeconds - range.startSeconds,
        0,
      );

      if (dominantSpeechSeconds < minimumDominantSpeechSeconds) {
        throw new Error("A reliable main voice needs at least 1.2 seconds of speech.");
      }

      if (
        runnerUpCluster &&
        Math.abs(dominantSpeechSeconds - runnerUpCluster.durationSeconds) <=
          secondsEpsilon
      ) {
        throw new Error("A reliable main voice could not be identified: speakers are ambiguous.");
      }

      if (dominantSpeechSeconds / analyzedSpeechSeconds < minimumDominantRatio) {
        throw new Error(
          "A reliable main voice needs a 0.45 dominant-duration ratio.",
        );
      }

      return {
        ranges: normalizeDominantVoiceRanges(dominantCluster.windows, {
          durationSeconds,
        }),
        dominantSpeechSeconds,
        analyzedSpeechSeconds,
      };
    } catch (error) {
      primaryFailureOccurred = true;
      throw error;
    } finally {
      await cleanupTempDirectory({
        removeDirectoryImpl,
        tempDirectory,
        primaryFailureOccurred,
      });
    }
  },
});
