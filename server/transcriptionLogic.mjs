const BlobCtor = globalThis.Blob;
const FormDataCtor = globalThis.FormData;
const cleanupOptions = {recursive: true, force: true};

const cleanupTempDirectory = async ({
  removeDirectoryImpl,
  tempDirectory,
  primaryError,
}) => {
  try {
    await removeDirectoryImpl(tempDirectory, cleanupOptions);
  } catch (cleanupError) {
    if (!primaryError) {
      throw cleanupError;
    }
  }
};

export const normalizeTranscriptSegments = (payload) => {
  const segments = Array.isArray(payload?.segments) ? payload.segments : [];
  const normalized = segments.flatMap((segment) => {
    const startSeconds = Number(segment?.start);
    const endSeconds = Number(segment?.end);
    const text = String(segment?.text ?? "").trim();

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

  if (normalized.length === 0) {
    throw new Error("Transcript has no usable timestamps");
  }

  return normalized;
};

export const transcribeMediaFile = async ({
  inputPath,
  outputPath,
  tempDirectory,
  apiKey,
  ffmpegPath,
  sourceStartSeconds = 0,
  durationSeconds,
  signal,
  execFileImpl,
  fetchImpl,
  readFileImpl,
  removeDirectoryImpl,
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
      "16000",
      outputPath,
    ];

    await execFileImpl(ffmpegPath, ffmpegArgs, {signal});

    const audioBuffer = await readFileImpl(outputPath);
    const formData = new FormDataCtor();
    formData.append("file", new BlobCtor([audioBuffer]), "output.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    const response = await fetchImpl(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {Authorization: `Bearer ${apiKey}`},
        body: formData,
        signal,
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "OpenAI transcription failed");
    }

    return normalizeTranscriptSegments(payload);
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
