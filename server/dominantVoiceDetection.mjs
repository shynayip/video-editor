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
const minimumReferenceSimilarity = 0.84;
const sampleRate = 16000;
const secondsEpsilon = 1e-6;
const preferredAnalysisWindowSeconds = 1.5;
const maximumAnalysisWindowSeconds = 5;
const analysisWindowOverlapRatio = 0.25;
const maximumAnalysisWindows = 256;
const execFileAsync = promisify(execFile);

const roundSeconds = (value) => Math.round(value * 1e6) / 1e6;

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new RuntimeDOMException("The operation was aborted.", "AbortError");
  }
};

const awaitWithAbort = (promise, signal) => {
  if (!signal) return promise;
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(new RuntimeDOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", abort, {once: true});
    Promise.resolve(promise).then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
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

export const createCandidateSpeechWindows = (ranges, durationSeconds) => {
  const validRanges = (Array.isArray(ranges) ? ranges : []).flatMap((range) => {
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

  const totalSpeechSeconds = validRanges.reduce(
    (total, range) => total + range.endSeconds - range.startSeconds,
    0,
  );
  if (totalSpeechSeconds <= 0) return [];

  const preferredStep =
    preferredAnalysisWindowSeconds * (1 - analysisWindowOverlapRatio);
  const preferredCount = validRanges.reduce(
    (total, range) =>
      total + (range.endSeconds - range.startSeconds > 3
        ? Math.max(1, Math.ceil((range.endSeconds - range.startSeconds) / preferredStep))
        : 1),
    0,
  );
  const analysisWindowSeconds = Math.min(
    maximumAnalysisWindowSeconds,
    Math.max(
      preferredAnalysisWindowSeconds,
      totalSpeechSeconds /
        Math.max(1, maximumAnalysisWindows * (1 - analysisWindowOverlapRatio)),
    ),
  );
  const countScale = Math.min(1, maximumAnalysisWindows / preferredCount);
  const windows = [];

  for (const range of validRanges) {
    const rangeDuration = range.endSeconds - range.startSeconds;
    const preferredRangeCount = rangeDuration > 3
      ? Math.max(1, Math.ceil(rangeDuration / preferredStep))
      : 1;
    const windowCount = Math.max(1, Math.floor(preferredRangeCount * countScale));
    const centers = Array.from({length: windowCount}, (_, index) => {
      if (windowCount === 1) return (range.startSeconds + range.endSeconds) / 2;
      const halfWindow = Math.min(analysisWindowSeconds, rangeDuration) / 2;
      const firstCenter = range.startSeconds + halfWindow;
      return Math.min(
        range.endSeconds - halfWindow,
        firstCenter + index * preferredStep,
      );
    });

    centers.forEach((center, index) => {
      const previousCenter = centers[index - 1];
      const nextCenter = centers[index + 1];
      const ownershipStart = previousCenter === undefined
        ? range.startSeconds
        : (previousCenter + center) / 2;
      const ownershipEnd = nextCenter === undefined
        ? range.endSeconds
        : (center + nextCenter) / 2;
      const halfWindow = Math.min(analysisWindowSeconds, rangeDuration) / 2;
      const analysisStart = windowCount === 1
        ? range.startSeconds
        : Math.max(range.startSeconds, center - halfWindow);
      const analysisEnd = windowCount === 1
        ? range.endSeconds
        : Math.min(range.endSeconds, center + halfWindow);

      windows.push({
        startSeconds: roundSeconds(ownershipStart),
        endSeconds: roundSeconds(ownershipEnd),
        analysisStartSeconds: roundSeconds(analysisStart),
        analysisEndSeconds: roundSeconds(analysisEnd),
      });
    });
  }

  return windows;
};

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
  const sampleBytes =
    audioBuffer.byteOffset === 0 &&
    audioBuffer.byteLength === audioBuffer.buffer.byteLength
      ? audioBuffer.buffer
      : audioBuffer.buffer.slice(
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
    referenceInputPath,
    referenceSourceStartSeconds = 0,
    referenceDurationSeconds,
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

      let candidateSpeech = createCandidateSpeechWindows(
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

      const requiresRuntime =
        createEmbeddingImpl === defaultCreateEmbedding ||
        (loadEmbeddingRuntimeImpl !== loadEmbeddingRuntime &&
          loadAudioImpl !== defaultLoadAudio);
      const runtime = requiresRuntime
        ? await awaitWithAbort(loadEmbeddingRuntimeImpl(), signal)
        : undefined;
      throwIfAborted(signal);
      const audio = await loadAudioImpl(audioPath, runtime, readFileImpl);
      let referenceEmbedding = null;
      if (
        referenceInputPath &&
        Number.isFinite(referenceDurationSeconds) &&
        referenceDurationSeconds > 0
      ) {
        const referenceOutputPath = join(tempDirectory, "reference.f32le");
        const referenceAudioPath = await extractAudioImpl({
          inputPath: referenceInputPath,
          outputWavPath: referenceOutputPath,
          ffmpegPath: selectedFfmpegPath,
          sourceStartSeconds: referenceSourceStartSeconds,
          durationSeconds: referenceDurationSeconds,
          signal,
          execFileImpl,
        });
        throwIfAborted(signal);
        const referenceAudio = await loadAudioImpl(
          referenceAudioPath,
          runtime,
          readFileImpl,
        );
        if (referenceAudio.length > 0) {
          referenceEmbedding = await awaitWithAbort(
            createEmbeddingImpl(
              referenceAudio,
              {
                startSeconds: 0,
                endSeconds: referenceAudio.length / sampleRate,
                analysisStartSeconds: 0,
                analysisEndSeconds: referenceAudio.length / sampleRate,
              },
              runtime,
            ),
            signal,
          );
        }
      }
      const decodedDurationSeconds = audio.length / sampleRate;
      const analysisDurationSeconds = Math.min(
        durationSeconds,
        decodedDurationSeconds,
      );
      candidateSpeech = candidateSpeech.flatMap((range) => {
        const startSeconds = Math.min(range.startSeconds, analysisDurationSeconds);
        const endSeconds = Math.min(range.endSeconds, analysisDurationSeconds);
        const analysisStartSeconds = Math.min(
          range.analysisStartSeconds,
          analysisDurationSeconds,
        );
        const analysisEndSeconds = Math.min(
          range.analysisEndSeconds,
          analysisDurationSeconds,
        );

        if (
          endSeconds - startSeconds <= secondsEpsilon ||
          analysisEndSeconds - analysisStartSeconds <= secondsEpsilon
        ) {
          return [];
        }

        return [{
          ...range,
          startSeconds: roundSeconds(startSeconds),
          endSeconds: roundSeconds(endSeconds),
          analysisStartSeconds: roundSeconds(analysisStartSeconds),
          analysisEndSeconds: roundSeconds(analysisEndSeconds),
        }];
      });

      if (candidateSpeech.length === 0) {
        throw new Error("No candidate speech was found in the decoded audio.");
      }
      const windows = [];

      for (const range of candidateSpeech) {
        throwIfAborted(signal);
        const startSample = Math.floor(range.analysisStartSeconds * sampleRate);
        const endSample = Math.ceil(range.analysisEndSeconds * sampleRate);
        const embedding = await awaitWithAbort(
          createEmbeddingImpl(
            audio.subarray(startSample, endSample),
            range,
            runtime,
          ),
          signal,
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
      let referenceSimilarity = null;
      const dominantCluster = referenceEmbedding
        ? clusters.reduce((best, cluster) => {
            const similarity = cosineSimilarity(
              cluster.centroid,
              referenceEmbedding,
            );
            if (!best || similarity > best.similarity) {
              return {cluster, similarity};
            }
            return best;
          }, null)
        : null;
      const selectedCluster = dominantCluster?.cluster ?? clusters[0];
      referenceSimilarity = dominantCluster?.similarity ?? null;
      const runnerUpCluster = clusters[1];
      const dominantSpeechSeconds = selectedCluster?.durationSeconds ?? 0;
      const analyzedSpeechSeconds = candidateSpeech.reduce(
        (total, range) => total + range.endSeconds - range.startSeconds,
        0,
      );

      if (
        referenceEmbedding &&
        (!Number.isFinite(referenceSimilarity) ||
          referenceSimilarity < minimumReferenceSimilarity)
      ) {
        return {
          ranges: [],
          dominantSpeechSeconds: 0,
          analyzedSpeechSeconds,
          referenceSimilarity,
        };
      }

      if (dominantSpeechSeconds < minimumDominantSpeechSeconds) {
        throw new Error("A reliable main voice needs at least 1.2 seconds of speech.");
      }

      if (
        !referenceEmbedding &&
        runnerUpCluster &&
        Math.abs(dominantSpeechSeconds - runnerUpCluster.durationSeconds) <=
          secondsEpsilon
      ) {
        throw new Error("A reliable main voice could not be identified: speakers are ambiguous.");
      }

      if (
        !referenceEmbedding &&
        dominantSpeechSeconds / analyzedSpeechSeconds < minimumDominantRatio
      ) {
        throw new Error(
          "A reliable main voice needs a 0.45 dominant-duration ratio.",
        );
      }

      return {
        ranges: normalizeDominantVoiceRanges(selectedCluster.windows, {
          durationSeconds: analysisDurationSeconds,
        }),
        dominantSpeechSeconds,
        analyzedSpeechSeconds,
        ...(referenceSimilarity === null ? {} : {referenceSimilarity}),
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
