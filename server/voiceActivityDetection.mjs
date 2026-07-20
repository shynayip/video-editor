import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";

import {
  AutoModelForAudioFrameClassification,
  AutoProcessor,
} from "@huggingface/transformers";

import {createSpeechRanges} from "./speechDetection.mjs";

const execFileAsync = promisify(execFile);
const RuntimeDOMException = globalThis.DOMException;
const modelId = "onnx-community/pyannote-segmentation-3.0";
const cacheDir = fileURLToPath(new URL("../.models/", import.meta.url));
const sampleRate = 16000;
let runtimePromise = null;

const loadRuntime = () => {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      AutoModelForAudioFrameClassification.from_pretrained(modelId, {
        dtype: "q8",
        cache_dir: cacheDir,
      }),
      AutoProcessor.from_pretrained(modelId, {cache_dir: cacheDir}),
    ]).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
};

const analyzeVoiceActivity = async (audio, {signal} = {}) => {
  if (signal?.aborted) {
    throw new RuntimeDOMException("The operation was aborted.", "AbortError");
  }
  const [model, processor] = await loadRuntime();
  const inputs = await processor(audio);
  const {logits} = await model(inputs);
  if (signal?.aborted) {
    throw new RuntimeDOMException("The operation was aborted.", "AbortError");
  }

  const segments = processor.post_process_speaker_diarization(
    logits,
    audio.length,
  )[0] ?? [];
  return segments
    .filter((segment) => segment.id !== 0 && segment.confidence >= 0.45)
    .map((segment) => ({
      startSeconds: segment.start,
      endSeconds: segment.end,
    }));
};

export const detectSpeechInMedia = async ({
  inputPath,
  outputPath,
  ffmpegPath,
  sourceStartSeconds = 0,
  durationSeconds,
  signal,
  execFileImpl = execFileAsync,
  readFileImpl = readFile,
  analyzeVoiceActivityImpl = analyzeVoiceActivity,
}) => {
  await execFileImpl(
    ffmpegPath,
    [
      "-y", "-ss", String(sourceStartSeconds), "-t", String(durationSeconds),
      "-i", inputPath, "-vn", "-ac", "1", "-ar", String(sampleRate),
      "-f", "f32le", outputPath,
    ],
    {signal},
  );
  const audioBuffer = await readFileImpl(outputPath);
  const sampleBytes = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength,
  );
  const audio = new Float32Array(sampleBytes);
  const segments = await analyzeVoiceActivityImpl(audio, {signal});
  return createSpeechRanges(segments, {durationSeconds});
};
