import {fileURLToPath} from "node:url";

const RuntimeDOMException = globalThis.DOMException;
const RuntimeURL = globalThis.URL;
const cleanupOptions = {recursive: true, force: true};
const defaultModelId = "onnx-community/whisper-small.en";
const sampleRate = 16000;

const normalizeChunks = (output, audioDurationSeconds) => {
  const chunks = Array.isArray(output?.chunks) ? output.chunks : [];
  const segments = chunks.flatMap((chunk) => {
    const timestamps = Array.isArray(chunk?.timestamp) ? chunk.timestamp : [];
    const startSeconds = Number(timestamps[0]);
    const endSeconds = Number(timestamps[1]);
    const text = String(chunk?.text ?? "").trim();

    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      startSeconds < 0 ||
      endSeconds <= startSeconds ||
      text.length === 0
    ) {
      return [];
    }

    return [{startSeconds, endSeconds, text}];
  });

  if (segments.length > 0) return segments;

  const text = String(output?.text ?? "").trim();
  if (!text || !Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) {
    throw new Error("Local transcript has no usable timestamps.");
  }

  return [{startSeconds: 0, endSeconds: audioDurationSeconds, text}];
};

const defaultPipelineFactory = async (task, modelId, options) => {
  const {env, pipeline} = await import("@huggingface/transformers");
  if (options?.cacheDir) {
    env.cacheDir = options.cacheDir;
  }

  return pipeline(task, modelId, {
    dtype: "q8",
    progress_callback: options?.onProgress,
  });
};

export const createLocalWhisper = ({
  pipelineFactory = defaultPipelineFactory,
  modelId = defaultModelId,
  cacheDir = fileURLToPath(new RuntimeURL("../.models/", import.meta.url)),
  onProgress,
} = {}) => {
  let pipelinePromise = null;

  const loadPipeline = () => {
    if (!pipelinePromise) {
      pipelinePromise = pipelineFactory(
        "automatic-speech-recognition",
        modelId,
        {cacheDir, onProgress},
      ).catch((error) => {
        pipelinePromise = null;
        throw error;
      });
    }

    return pipelinePromise;
  };

  return {
    async transcribeAudio(audio, {signal} = {}) {
      if (signal?.aborted) {
        throw new RuntimeDOMException("The operation was aborted.", "AbortError");
      }

      const transcriber = await loadPipeline();
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });

      if (signal?.aborted) {
        throw new RuntimeDOMException("The operation was aborted.", "AbortError");
      }

      return normalizeChunks(output, audio.length / sampleRate);
    },
  };
};

const defaultWhisper = createLocalWhisper();

const cleanupTempDirectory = async ({
  removeDirectoryImpl,
  tempDirectory,
  primaryError,
}) => {
  try {
    await removeDirectoryImpl(tempDirectory, cleanupOptions);
  } catch (cleanupError) {
    if (!primaryError) throw cleanupError;
  }
};

export const transcribeMediaFileLocally = async ({
  inputPath,
  outputPath,
  tempDirectory,
  ffmpegPath,
  sourceStartSeconds = 0,
  durationSeconds,
  signal,
  execFileImpl,
  readFileImpl,
  removeDirectoryImpl,
  transcribeAudioImpl = (audio, options) =>
    defaultWhisper.transcribeAudio(audio, options),
}) => {
  let primaryError = null;

  try {
    const ffmpegArgs = [
      "-y",
      "-ss",
      String(sourceStartSeconds),
      "-t",
      String(durationSeconds),
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      outputPath,
    ];
    await execFileImpl(ffmpegPath, ffmpegArgs, {signal});

    const audioBuffer = await readFileImpl(outputPath);
    const sampleBytes = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength,
    );
    const audio = new Float32Array(sampleBytes);
    return await transcribeAudioImpl(audio, {signal});
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    await cleanupTempDirectory({
      removeDirectoryImpl,
      tempDirectory,
      primaryError,
    });
  }
};
