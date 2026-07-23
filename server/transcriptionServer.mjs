const runtimeConsole = globalThis.console;
const RuntimeAbortController = globalThis.AbortController;
const runtimeFetch = globalThis.fetch;
const runtimeProcess = globalThis.process;
const RuntimeURL = globalThis.URL;

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { bundle } from "@remotion/bundler";
import dotenv from "dotenv";
import express from "express";
import ffmpegPath from "ffmpeg-static";
import multer from "multer";
import {
  makeCancelSignal,
  openBrowser,
  renderMedia,
} from "@remotion/renderer";
import { dir as remotionWindowsBinariesDirectory } from "@remotion/compositor-win32-x64-msvc";
import ffprobeStatic from "ffprobe-static";

import { createBackgroundRemovalProcessor } from "./backgroundRemoval.mjs";
import { createDominantVoiceDetector } from "./dominantVoiceDetection.mjs";
import { transcribeMediaFileLocally } from "./localWhisper.mjs";
import { detectSpeechInMedia } from "./voiceActivityDetection.mjs";
import { detectScenesInMedia } from "./sceneDetection.mjs";
import { detectSilenceInMedia } from "./silenceDetection.mjs";
import { cleanVoiceAudio } from "./voiceAudioCleanup.mjs";

const isCancelledRenderError = (error) =>
  error instanceof Error &&
  error.message.includes("renderMedia() got cancelled");

dotenv.config({ quiet: true });

const execFileAsync = promisify(execFile);
const defaultMaxFileSizeBytes = 2 * 1024 * 1024 * 1024;
const defaultMaxMediaFileSizeBytes = 2 * 1024 * 1024 * 1024;
const defaultMaxBackgroundRemovalFileSizeBytes = 250 * 1024 * 1024;
const defaultMaxTrimDurationSeconds = 6 * 60 * 60;
const defaultRenderConcurrency = Math.max(
  2,
  Math.min(12, availableParallelism() - 2),
);
const useAmdHardwareEncoder = ({ args }) =>
  args.map((argument) =>
    argument === "libx264" ? "h264_amf" : argument,
  );
const getAdaptiveRenderConcurrency = (composition) =>
  Math.max(
    1,
    Math.min(
      defaultRenderConcurrency,
      Math.ceil(
        composition.durationInFrames / Math.max(1, composition.fps * 6),
      ),
    ),
  );
const createExportComposition = (project) => ({
  id: "MyComp",
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: Math.max(
    1,
    project.clips.reduce(
      (furthestEnd, clip) =>
        Math.max(
          furthestEnd,
          Math.max(0, Number(clip.start) || 0) +
            Math.max(1, Number(clip.duration) || 1),
        ),
      0,
    ),
  ),
  props: { project },
  defaultProps: {},
  defaultCodec: null,
  defaultOutName: null,
  defaultVideoImageFormat: null,
  defaultPixelFormat: null,
  defaultProResProfile: null,
  defaultSampleRate: null,
});
const cleanupOptions = { recursive: true, force: true };
const allowedBrowserOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const allowedApiHostnames = new Set(["localhost", "127.0.0.1"]);
const dominantVoiceDetector = createDominantVoiceDetector();

const sendError = (res, status, code, message) =>
  res.status(status).json({
    error: { code, message },
  });

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

const toInputPath = (directory, originalName) => {
  const safeName = basename(originalName || "upload.bin");
  const extension = extname(safeName);
  return join(directory, `input${extension || ".bin"}`);
};

const toStoredMediaName = (originalName, storedExtension) => {
  const safeName = basename(originalName || "media.bin")
    .replace(/\.[^.]*$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const extension =
    (storedExtension ?? extname(originalName || "").toLowerCase()) || ".bin";
  return `${safeName || "media"}-${randomUUID()}${extension}`;
};

const hasBrowserOnlySource = (project) =>
  [...(project.clips ?? []), ...(project.mediaItems ?? [])].some(
    (item) => typeof item?.src === "string" && item.src.startsWith("blob:"),
  );

const getHostName = (hostHeader) => {
  if (!hostHeader) return null;

  try {
    return new RuntimeURL(`http://${hostHeader}`).hostname;
  } catch {
    return null;
  }
};

const validateLocalRequest = (req, { allowOriginlessRequests }) => {
  const hostName = getHostName(req.get("host"));
  if (!hostName || !allowedApiHostnames.has(hostName)) {
    return {
      status: 403,
      code: "forbidden_host",
      message: "Caption transcription requests must target the local API.",
    };
  }

  const origin = req.get("origin");
  if (!origin) {
    return allowOriginlessRequests
      ? null
      : {
          status: 403,
          code: "forbidden_origin",
          message:
            "Caption transcription requests must come from the local editor.",
        };
  }

  if (!allowedBrowserOrigins.has(origin)) {
    return {
      status: 403,
      code: "forbidden_origin",
      message:
        "Caption transcription requests must come from the local editor.",
    };
  }

  return null;
};

const parseTrimRange = (body, maxTrimDurationSeconds) => {
  const sourceStartSeconds = Number(body?.sourceStart);
  const durationSeconds = Number(body?.duration);

  if (
    !Number.isFinite(sourceStartSeconds) ||
    sourceStartSeconds < 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > maxTrimDurationSeconds
  ) {
    return null;
  }

  return { sourceStartSeconds, durationSeconds };
};

const isFiniteNonnegativeNumber = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

const parseBackgroundRemovalRequest = (body, maxDurationSeconds) => {
  const mediaKind = body?.mediaKind;
  if (mediaKind !== "image" && mediaKind !== "video") return null;

  const startValue = body?.startSeconds ?? body?.sourceStart ?? 0;
  if (!isFiniteNonnegativeNumber(startValue)) return null;

  const durationValue = body?.durationSeconds ?? body?.duration;
  if (mediaKind === "video") {
    if (
      !isFiniteNonnegativeNumber(durationValue) ||
      Number(durationValue) <= 0 ||
      Number(durationValue) > maxDurationSeconds
    ) {
      return null;
    }
  } else if (
    durationValue !== undefined &&
    (!isFiniteNonnegativeNumber(durationValue) ||
      Number(durationValue) > maxDurationSeconds)
  ) {
    return null;
  }

  return {
    mediaKind,
    startSeconds: Number(startValue),
    durationSeconds: durationValue === undefined ? 0 : Number(durationValue),
  };
};

const isAbortError = (error) =>
  error?.name === "AbortError" || error?.code === "ABORT_ERR";

const isDominantVoiceNotFoundError = (error) => {
  const message = error instanceof Error ? error.message : "";
  return (
    message.startsWith("No candidate speech") ||
    message.startsWith("A reliable main voice")
  );
};

const isMultipartParserError = (error) =>
  error instanceof Error &&
  (error.message === "Malformed content type" ||
    error.message === "Missing Content-Type" ||
    error.message.startsWith("Multipart:") ||
    error.message.startsWith("Unsupported content type:") ||
    error.message === "Malformed part header" ||
    error.message === "Unexpected end of file" ||
    error.message === "Unexpected end of form");

export const prepareRemotionRenderBinaries = async ({
  copyDirectoryImpl = cp,
  copyFileImpl = copyFile,
  ffmpegBinaryPath = ffmpegPath,
  ffprobeBinaryPath = ffprobeStatic.path,
  makeTempDirectory = (prefix) => mkdtemp(prefix),
} = {}) => {
  const binariesDirectory = await makeTempDirectory(
    join(tmpdir(), "video-editor-remotion-binaries-"),
  );

  await copyDirectoryImpl(remotionWindowsBinariesDirectory, binariesDirectory, {
    recursive: true,
  });
  await Promise.all([
    copyFileImpl(ffmpegBinaryPath, join(binariesDirectory, "ffmpeg.exe")),
    copyFileImpl(ffprobeBinaryPath, join(binariesDirectory, "ffprobe.exe")),
  ]);

  return binariesDirectory;
};

export const createTranscriptionApp = ({
  apiKey = runtimeProcess.env.OPENAI_API_KEY,
  captionApiPort = runtimeProcess.env.CAPTION_API_PORT ?? "5174",
  ffmpegBinaryPath = ffmpegPath,
  ffprobeBinaryPath = ffprobeStatic.path,
  backgroundRemovalProcessor,
  copyFileImpl = copyFile,
  execFileImpl = execFileAsync,
  fetchImpl = runtimeFetch,
  readFileImpl = readFile,
  removeDirectoryImpl = rm,
  statFileImpl = stat,
  detectDominantVoiceImpl = (options) => dominantVoiceDetector.detect(options),
  detectScenesInMediaImpl = detectScenesInMedia,
  detectSilenceInMediaImpl = detectSilenceInMedia,
  detectSpeechInMediaImpl = detectSpeechInMedia,
  cleanVoiceAudioImpl = cleanVoiceAudio,
  transcribeMediaFileImpl = transcribeMediaFileLocally,
  writeFileImpl = writeFile,
  makeDirectoryImpl = mkdir,
  bundleImpl = bundle,
  openBrowserImpl = openBrowser,
  renderMediaImpl = renderMedia,
  getRenderBinariesDirectoryImpl = prepareRemotionRenderBinaries,
  maxFileSizeBytes = defaultMaxFileSizeBytes,
  maxMediaFileSizeBytes = defaultMaxMediaFileSizeBytes,
  maxBackgroundRemovalFileSizeBytes = defaultMaxBackgroundRemovalFileSizeBytes,
  mediaUploadDirectory = resolve(runtimeProcess.cwd(), "public", "uploads"),
  maxTrimDurationSeconds = defaultMaxTrimDurationSeconds,
  allowOriginlessRequests = runtimeProcess.env.NODE_ENV === "test",
  makeTempDirectory = (prefix) => mkdtemp(prefix),
} = {}) => {
  const app = express();
  const exportJobs = new Map();
  const updateExportJob = (jobId, update) => {
    if (!jobId) return;

    exportJobs.set(jobId, {
      ...(exportJobs.get(jobId) ?? {}),
      ...update,
      updatedAt: Date.now(),
    });
  };
  const processor =
    backgroundRemovalProcessor ??
    createBackgroundRemovalProcessor({
      runFfmpeg: (args, options) =>
        execFileImpl(ffmpegBinaryPath, args, options),
      getVideoFpsImpl: async (inputPath, { signal } = {}) => {
        const { stdout } = await execFileImpl(
          ffprobeBinaryPath,
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=avg_frame_rate",
            "-of",
            "default=nw=1:nk=1",
            inputPath,
          ],
          { signal },
        );
        const fps = String(stdout).trim();
        const [numerator, denominator = "1"] = fps.split("/");
        if (!(Number(numerator) > 0) || !(Number(denominator) > 0)) {
          throw new Error("Unable to determine the source video frame rate.");
        }

        return fps;
      },
      makeDirectoryImpl,
      makeTempDirectoryImpl: makeTempDirectory,
      removeDirectoryImpl,
    });
  let renderBinariesDirectoryPromise = null;
  let renderBrowserPromise = null;
  let renderBundlePromise = null;
  const getRenderBinariesDirectory = () => {
    if (!renderBinariesDirectoryPromise) {
      renderBinariesDirectoryPromise = getRenderBinariesDirectoryImpl();
    }

    return renderBinariesDirectoryPromise;
  };
  const getRenderBundle = () => {
    if (!renderBundlePromise) {
      renderBundlePromise = bundleImpl({
        entryPoint: resolve(runtimeProcess.cwd(), "src/index.ts"),
      }).catch((error) => {
        renderBundlePromise = null;
        throw error;
      });
    }

    return renderBundlePromise;
  };
  const getRenderBrowser = () => {
    if (!renderBrowserPromise) {
      renderBrowserPromise = openBrowserImpl("chrome", {
        chromeMode: "headless-shell",
      }).catch((error) => {
        renderBrowserPromise = null;
        throw error;
      });
    }

    return renderBrowserPromise;
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes },
  });
  const backgroundRemovalUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBackgroundRemovalFileSizeBytes },
  });
  const mediaUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, mediaUploadDirectory);
      },
      filename: (_req, file, callback) => {
        callback(null, toStoredMediaName(file.originalname));
      },
    }),
    limits: { fileSize: maxMediaFileSizeBytes },
  });
  const ensureMediaUploadDirectory = async (_req, _res, next) => {
    try {
      await makeDirectoryImpl(mediaUploadDirectory, { recursive: true });
      next();
    } catch (error) {
      next(error);
    }
  };

  app.use("/api", (req, res, next) => {
    const policyError = validateLocalRequest(req, { allowOriginlessRequests });
    if (policyError) {
      return sendError(
        res,
        policyError.status,
        policyError.code,
        policyError.message,
      );
    }

    return next();
  });

  app.use("/api/export", express.json({ limit: "8mb" }));

  app.get("/api/export/status/:jobId", (req, res) => {
    const job = exportJobs.get(req.params.jobId);
    if (!job) {
      return sendError(res, 404, "export_not_found", "Export job not found.");
    }

    return res.json(job);
  });

  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return sendError(res, 400, "missing_file", "No media file was uploaded.");
    }

    const trimRange = parseTrimRange(req.body, maxTrimDurationSeconds);
    if (!trimRange) {
      return sendError(
        res,
        400,
        "invalid_trim_range",
        "Transcription trim range must include a finite nonnegative sourceStart and a positive bounded duration.",
      );
    }

    let tempDirectory = null;
    let serviceOwnsCleanup = false;
    const requestAbortController = new RuntimeAbortController();
    const abortRequest = () => {
      requestAbortController.abort();
    };
    req.on("aborted", abortRequest);
    req.on("close", () => {
      if (!req.complete) {
        abortRequest();
      }
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        abortRequest();
      }
    });

    try {
      tempDirectory = await makeTempDirectory(
        join(tmpdir(), "video-editor-caption-"),
      );
      const inputPath = toInputPath(tempDirectory, req.file.originalname);
      const outputPath = join(tempDirectory, "output.f32le");

      await writeFileImpl(inputPath, req.file.buffer);

      serviceOwnsCleanup = true;
      const segments = await transcribeMediaFileImpl({
        inputPath,
        outputPath,
        tempDirectory,
        apiKey,
        ffmpegPath: ffmpegBinaryPath,
        sourceStartSeconds: trimRange.sourceStartSeconds,
        durationSeconds: trimRange.durationSeconds,
        signal: requestAbortController.signal,
        execFileImpl,
        fetchImpl,
        readFileImpl,
        removeDirectoryImpl,
      });

      return res.json({ segments });
    } catch (error) {
      if (tempDirectory && !serviceOwnsCleanup) {
        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError: error,
        });
      }

      if (isAbortError(error) || requestAbortController.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Transcription failed.";
      return sendError(res, 500, "transcription_failed", message);
    }
  });

  app.post("/api/detect-silence", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return sendError(res, 400, "missing_file", "No media file was uploaded.");
    }

    const trimRange = parseTrimRange(req.body, maxTrimDurationSeconds);
    if (!trimRange) {
      return sendError(
        res,
        400,
        "invalid_trim_range",
        "Transcription trim range must include a finite nonnegative sourceStart and a positive bounded duration.",
      );
    }

    let tempDirectory = null;
    const requestAbortController = new RuntimeAbortController();
    const abortRequest = () => {
      requestAbortController.abort();
    };
    req.on("aborted", abortRequest);
    req.on("close", () => {
      if (!req.complete) {
        abortRequest();
      }
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        abortRequest();
      }
    });

    try {
      tempDirectory = await makeTempDirectory(
        join(tmpdir(), "video-editor-silence-"),
      );
      const inputPath = toInputPath(tempDirectory, req.file.originalname);
      await writeFileImpl(inputPath, req.file.buffer);

      const ranges = await detectSilenceInMediaImpl({
        inputPath,
        ffmpegPath: ffmpegBinaryPath,
        sourceStartSeconds: trimRange.sourceStartSeconds,
        durationSeconds: trimRange.durationSeconds,
        signal: requestAbortController.signal,
        execFileImpl,
        minimumSilenceSeconds: 0.35,
        speechPaddingSeconds: 0.08,
        noiseThresholdDb: -32,
      });

      await cleanupTempDirectory({
        removeDirectoryImpl,
        tempDirectory,
        primaryError: null,
      });
      tempDirectory = null;
      return res.json({ ranges });
    } catch (error) {
      if (tempDirectory) {
        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError: error,
        });
      }

      if (isAbortError(error) || requestAbortController.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Silence detection failed.";
      return sendError(res, 500, "silence_detection_failed", message);
    }
  });

  app.post("/api/detect-speech", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return sendError(res, 400, "missing_file", "No media file was uploaded.");
    }

    const trimRange = parseTrimRange(req.body, maxTrimDurationSeconds);
    if (!trimRange) {
      return sendError(
        res,
        400,
        "invalid_trim_range",
        "Speech detection requires a valid source range.",
      );
    }

    let tempDirectory = null;
    const requestAbortController = new RuntimeAbortController();
    const abortRequest = () => requestAbortController.abort();
    req.on("aborted", abortRequest);
    req.on("close", () => {
      if (!req.complete) abortRequest();
    });
    res.on("close", () => {
      if (!res.writableEnded) abortRequest();
    });

    try {
      tempDirectory = await makeTempDirectory(
        join(tmpdir(), "video-editor-speech-"),
      );
      const inputPath = toInputPath(tempDirectory, req.file.originalname);
      const outputPath = join(tempDirectory, "output.f32le");
      await writeFileImpl(inputPath, req.file.buffer);

      const ranges = await detectSpeechInMediaImpl({
        inputPath,
        outputPath,
        ffmpegPath: ffmpegBinaryPath,
        sourceStartSeconds: trimRange.sourceStartSeconds,
        durationSeconds: trimRange.durationSeconds,
        signal: requestAbortController.signal,
        execFileImpl,
        readFileImpl,
      });
      await cleanupTempDirectory({
        removeDirectoryImpl,
        tempDirectory,
        primaryError: null,
      });
      tempDirectory = null;
      return res.json({ ranges });
    } catch (error) {
      if (tempDirectory) {
        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError: error,
        });
      }
      if (isAbortError(error) || requestAbortController.signal.aborted) return;

      const message =
        error instanceof Error ? error.message : "Speech detection failed.";
      return sendError(res, 500, "speech_detection_failed", message);
    }
  });

  app.post(
    "/api/clean-voice-audio",
    upload.single("file"),
    async (req, res) => {
      if (!req.file || !req.file.mimetype.startsWith("video/")) {
        return sendError(
          res,
          400,
          "invalid_voice_cleanup_request",
          "Select a video with audio to clean.",
        );
      }

      const requestAbortController = new RuntimeAbortController();
      const abortRequest = () => requestAbortController.abort();
      req.on("aborted", abortRequest);
      req.on("close", () => {
        if (!req.complete) abortRequest();
      });
      res.on("close", () => {
        if (!res.writableEnded) abortRequest();
      });

      let tempDirectory = null;
      let storedPath = null;
      try {
        tempDirectory = await makeTempDirectory(
          join(tmpdir(), "video-editor-voice-cleanup-"),
        );
        const inputPath = toInputPath(tempDirectory, req.file.originalname);
        const outputPath = join(tempDirectory, "cleaned.mp4");
        await writeFileImpl(inputPath, req.file.buffer);
        const cleaned = await cleanVoiceAudioImpl({
          inputPath,
          outputPath,
          ffmpegPath: ffmpegBinaryPath,
          signal: requestAbortController.signal,
          execFileImpl,
        });
        const outputStats = await statFileImpl(cleaned.outputPath);
        if (!outputStats.isFile()) {
          throw new Error("Voice cleanup did not create an output file.");
        }

        await makeDirectoryImpl(mediaUploadDirectory, { recursive: true });
        const storedName = toStoredMediaName(
          req.file.originalname,
          cleaned.extension,
        );
        storedPath = join(mediaUploadDirectory, storedName);
        await copyFileImpl(cleaned.outputPath, storedPath);

        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError: null,
        });
        tempDirectory = null;
        storedPath = null;
        return res.json({
          src: `uploads/${storedName}`,
          mimeType: cleaned.mimeType,
        });
      } catch (error) {
        if (storedPath) {
          await removeDirectoryImpl(storedPath, { force: true }).catch(
            () => undefined,
          );
        }
        if (tempDirectory) {
          await cleanupTempDirectory({
            removeDirectoryImpl,
            tempDirectory,
            primaryError: error,
          });
        }
        if (isAbortError(error) || requestAbortController.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Voice cleanup failed.";
        return sendError(res, 500, "voice_cleanup_failed", message);
      }
    },
  );

  app.post(
    "/api/detect-dominant-voice",
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "referenceFile", maxCount: 1 },
    ]),
    async (req, res) => {
      const selectedFile = req.files?.file?.[0];
      const referenceFile = req.files?.referenceFile?.[0];
      if (!selectedFile || !selectedFile.mimetype.startsWith("video/")) {
        return sendError(
          res,
          400,
          "invalid_dominant_voice_request",
          "Select a valid video range.",
        );
      }

      const trimRange = parseTrimRange(req.body, maxTrimDurationSeconds);
      if (!trimRange) {
        return sendError(
          res,
          400,
          "invalid_dominant_voice_request",
          "Select a valid video range.",
        );
      }
      const referenceTrimRange = referenceFile
        ? parseTrimRange(
            {
              sourceStart: req.body.referenceSourceStart,
              duration: req.body.referenceDuration,
            },
            maxTrimDurationSeconds,
          )
        : null;
      if (
        referenceFile &&
        (!referenceFile.mimetype.startsWith("video/") || !referenceTrimRange)
      ) {
        return sendError(
          res,
          400,
          "invalid_dominant_voice_reference",
          "The main voice reference must be a valid video range.",
        );
      }

      let tempDirectory = null;
      const requestAbortController = new RuntimeAbortController();
      const abortRequest = () => {
        requestAbortController.abort();
      };
      req.on("aborted", abortRequest);
      req.on("close", () => {
        if (!req.complete) {
          abortRequest();
        }
      });
      res.on("close", () => {
        if (!res.writableEnded) {
          abortRequest();
        }
      });

      try {
        tempDirectory = await makeTempDirectory(
          join(tmpdir(), "video-editor-dominant-voice-"),
        );
        const inputPath = toInputPath(tempDirectory, selectedFile.originalname);
        await writeFileImpl(inputPath, selectedFile.buffer);
        const referenceInputPath = referenceFile
          ? join(
              tempDirectory,
              `reference-${basename(referenceFile.originalname)}`,
            )
          : undefined;
        if (referenceFile && referenceInputPath) {
          await writeFileImpl(referenceInputPath, referenceFile.buffer);
        }

        const result = await detectDominantVoiceImpl({
          inputPath,
          sourceStartSeconds: trimRange.sourceStartSeconds,
          durationSeconds: trimRange.durationSeconds,
          referenceInputPath,
          referenceSourceStartSeconds: referenceTrimRange?.sourceStartSeconds,
          referenceDurationSeconds: referenceTrimRange?.durationSeconds,
          signal: requestAbortController.signal,
        });

        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError: null,
        });
        tempDirectory = null;
        return res.json(result);
      } catch (error) {
        if (tempDirectory) {
          await cleanupTempDirectory({
            removeDirectoryImpl,
            tempDirectory,
            primaryError: error,
          });
        }

        if (isAbortError(error) || requestAbortController.signal.aborted) {
          return;
        }

        if (isDominantVoiceNotFoundError(error)) {
          return sendError(
            res,
            422,
            "dominant_voice_not_found",
            "A reliable main voice could not be identified.",
          );
        }

        return sendError(
          res,
          500,
          "dominant_voice_detection_failed",
          "Dominant voice detection failed.",
        );
      }
    },
  );

  app.post("/api/detect-scenes", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return sendError(res, 400, "missing_file", "No video file was uploaded.");
    }

    if (!req.file.mimetype.startsWith("video/")) {
      return sendError(
        res,
        400,
        "unsupported_media",
        "Scene detection requires a video file.",
      );
    }

    let tempDirectory = null;
    let primaryError = null;
    let scenes = null;
    const requestAbortController = new RuntimeAbortController();
    const abortRequest = () => {
      requestAbortController.abort();
    };
    req.on("aborted", abortRequest);
    req.on("close", () => {
      if (!req.complete) {
        abortRequest();
      }
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        abortRequest();
      }
    });

    try {
      tempDirectory = await makeTempDirectory(
        join(tmpdir(), "video-editor-scenes-"),
      );
      const inputPath = toInputPath(tempDirectory, req.file.originalname);
      await writeFileImpl(inputPath, req.file.buffer);
      scenes = await detectScenesInMediaImpl({
        inputPath,
        ffmpegPath: ffmpegBinaryPath,
        ffprobePath: ffprobeBinaryPath,
        signal: requestAbortController.signal,
      });
    } catch (error) {
      primaryError = error;
    } finally {
      if (tempDirectory) {
        await cleanupTempDirectory({
          removeDirectoryImpl,
          tempDirectory,
          primaryError,
        });
      }
    }

    if (isAbortError(primaryError) || requestAbortController.signal.aborted) {
      return;
    }

    if (primaryError) {
      const message =
        primaryError instanceof Error
          ? primaryError.message
          : "Scene detection failed.";
      return sendError(res, 500, "scene_detection_failed", message);
    }

    return res.json({ scenes });
  });

  app.post(
    "/api/remove-background",
    backgroundRemovalUpload.single("file"),
    async (req, res) => {
      const request = parseBackgroundRemovalRequest(
        req.body,
        maxTrimDurationSeconds,
      );
      const matchesMediaKind =
        request?.mediaKind === "image"
          ? req.file?.mimetype.startsWith("image/")
          : request?.mediaKind === "video" &&
            req.file?.mimetype.startsWith("video/");
      if (!req.file || !request || !matchesMediaKind) {
        return sendError(
          res,
          400,
          "invalid_background_removal_request",
          "Background removal requires a matching image or video upload with a valid source range.",
        );
      }

      let tempDirectory = null;
      let primaryError = null;
      let result = null;
      let storedPath = null;
      const requestAbortController = new RuntimeAbortController();
      const abortRequest = () => {
        requestAbortController.abort();
      };
      req.on("aborted", abortRequest);
      req.on("close", () => {
        if (!req.complete) abortRequest();
      });
      res.on("close", () => {
        if (!res.writableEnded) abortRequest();
      });

      try {
        tempDirectory = await makeTempDirectory(
          join(tmpdir(), "video-editor-background-removal-"),
        );
        const inputPath = toInputPath(tempDirectory, req.file.originalname);
        const outputDirectory = join(tempDirectory, "output");
        await writeFileImpl(inputPath, req.file.buffer);
        const processed = await processor.process({
          inputPath,
          mediaKind: request.mediaKind,
          startSeconds: request.startSeconds,
          durationSeconds: request.durationSeconds,
          outputDirectory,
          signal: requestAbortController.signal,
        });
        const expectedOutput =
          request.mediaKind === "image"
            ? { extension: ".png", mimeType: "image/png" }
            : { extension: ".webm", mimeType: "video/webm" };
        if (
          processed?.extension !== expectedOutput.extension ||
          processed?.mimeType !== expectedOutput.mimeType ||
          typeof processed.outputPath !== "string"
        ) {
          throw new Error("Background removal returned an invalid output.");
        }

        const processedStats = await statFileImpl(processed.outputPath);
        if (!processedStats.isFile()) {
          throw new Error("Background removal did not create an output file.");
        }

        await makeDirectoryImpl(mediaUploadDirectory, { recursive: true });
        const storedName = toStoredMediaName(
          req.file.originalname,
          expectedOutput.extension,
        );
        storedPath = join(mediaUploadDirectory, storedName);
        await copyFileImpl(processed.outputPath, storedPath);
        const storedStats = await statFileImpl(storedPath);
        if (!storedStats.isFile()) {
          throw new Error("Background removal output could not be stored.");
        }
        result = {
          src: `uploads/${storedName}`,
          mimeType: expectedOutput.mimeType,
          subjectBounds: processed.subjectBounds ?? null,
        };
      } catch (error) {
        primaryError = error;
      }

      const removeStoredOutput = async () => {
        if (!storedPath) return;

        const pathToRemove = storedPath;
        storedPath = null;
        try {
          await removeDirectoryImpl(pathToRemove, { force: true });
        } catch (cleanupError) {
          if (!primaryError) primaryError = cleanupError;
        }
      };

      if (primaryError || requestAbortController.signal.aborted) {
        await removeStoredOutput();
      }

      try {
        if (tempDirectory) {
          await cleanupTempDirectory({
            removeDirectoryImpl,
            tempDirectory,
            primaryError,
          });
        }
      } catch (cleanupError) {
        if (!primaryError) primaryError = cleanupError;
      }

      if (primaryError || requestAbortController.signal.aborted) {
        await removeStoredOutput();
      }

      if (isAbortError(primaryError) || requestAbortController.signal.aborted) {
        if (!res.destroyed && !res.writableEnded && res.writable) {
          return sendError(
            res,
            499,
            "background_removal_cancelled",
            "Background removal was cancelled.",
          );
        }

        return;
      }

      if (primaryError) {
        const message =
          primaryError instanceof Error
            ? primaryError.message
            : "Background removal failed.";
        return sendError(res, 500, "background_removal_failed", message);
      }

      try {
        const response = res.json(result);
        storedPath = null;
        return response;
      } catch (error) {
        primaryError = error;
        await removeStoredOutput();
        const message =
          error instanceof Error ? error.message : "Background removal failed.";
        return sendError(res, 500, "background_removal_failed", message);
      }
    },
  );

  app.post(
    "/api/media",
    ensureMediaUploadDirectory,
    mediaUpload.single("file"),
    async (req, res) => {
      if (!req.file) {
        return sendError(
          res,
          400,
          "missing_file",
          "No media file was uploaded.",
        );
      }

      if (
        !req.file.mimetype.startsWith("video/") &&
        !req.file.mimetype.startsWith("audio/") &&
        !req.file.mimetype.startsWith("image/")
      ) {
        await removeDirectoryImpl(req.file.path, { force: true });
        return sendError(
          res,
          400,
          "unsupported_media",
          "Only video, audio, and image files can be imported.",
        );
      }

      return res.json({
        src: `uploads/${req.file.filename}`,
        label: req.file.originalname || req.file.filename,
        mimeType: req.file.mimetype,
      });
    },
  );

  app.post("/api/export", async (req, res) => {
    const project = req.body?.project;
    const jobId =
      typeof req.body?.jobId === "string" &&
      /^[a-zA-Z0-9-]{8,80}$/.test(req.body.jobId)
        ? req.body.jobId
        : null;
    const renderScale = Number(req.body?.renderScale) === 1 ? 1 : 0.75;
    if (!project || !Array.isArray(project.clips)) {
      return sendError(
        res,
        400,
        "invalid_project",
        "Export needs a saved project with timeline clips.",
      );
    }

    if (hasBrowserOnlySource(project)) {
      return sendError(
        res,
        400,
        "browser_only_media",
        "Some imported files only exist inside the browser. Please import those clips again, then export.",
      );
    }

    let tempDirectory;
    let clientDisconnected = false;
    const { cancelSignal, cancel } = makeCancelSignal();
    const cancelDisconnectedRender = () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
        cancel();
      }
    };
    req.once("aborted", cancelDisconnectedRender);
    res.once("close", cancelDisconnectedRender);
    updateExportJob(jobId, {
      state: "running",
      phase: "preparing",
      progress: 0,
    });

    try {
      tempDirectory = await makeTempDirectory(
        join(tmpdir(), "video-editor-export-"),
      );
      await makeDirectoryImpl(tempDirectory, { recursive: true });

      const serveUrl = await getRenderBundle();
      updateExportJob(jobId, {
        state: "running",
        phase: "preparing",
        progress: 2,
      });
      const inputProps = { project };
      const composition = createExportComposition(project);
      const renderConcurrency = getAdaptiveRenderConcurrency(composition);
      const outputLocation = join(tempDirectory, "video-editor-export.mp4");
      const [binariesDirectory, puppeteerInstance] = await Promise.all([
        getRenderBinariesDirectory(),
        getRenderBrowser(),
      ]);
      updateExportJob(jobId, {
        state: "running",
        phase: "rendering",
        progress: 3,
      });

      await renderMediaImpl({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation,
        inputProps,
        binariesDirectory,
        puppeteerInstance,
        // ffmpeg-static includes libmp3lame, while libfdk_aac is optional and
        // unavailable in its Windows build. MP4 supports MP3 audio here.
        audioCodec: "mp3",
        scale: renderScale,
        videoBitrate: renderScale === 1 ? "8M" : "5M",
        hardwareAcceleration: "disable",
        ffmpegOverride: useAmdHardwareEncoder,
        concurrency: renderConcurrency,
        disallowParallelEncoding: false,
        cancelSignal,
        onProgress: ({ progress }) => {
          updateExportJob(jobId, {
            state: "running",
            phase: progress >= 1 ? "encoding" : "rendering",
            progress: Math.min(99, Math.max(3, Math.round(progress * 96))),
          });
        },
      });

      updateExportJob(jobId, {
        state: "complete",
        phase: "download_ready",
        progress: 100,
      });

      return res.download(
        outputLocation,
        "video-editor-export.mp4",
        async () => {
          if (tempDirectory) {
            await removeDirectoryImpl(tempDirectory, cleanupOptions);
          }
        },
      );
    } catch (error) {
      if (tempDirectory) {
        await removeDirectoryImpl(tempDirectory, cleanupOptions);
      }
      if (clientDisconnected || isCancelledRenderError(error)) {
        updateExportJob(jobId, {
          state: "cancelled",
          phase: "cancelled",
        });
        if (!res.headersSent && !res.destroyed) {
          return sendError(res, 499, "export_cancelled", "Export cancelled.");
        }
        return;
      }
      const message =
        error instanceof Error ? error.message : "Video export failed.";
      updateExportJob(jobId, {
        state: "failed",
        phase: "failed",
        message,
      });
      return sendError(res, 500, "export_failed", message);
    } finally {
      req.off("aborted", cancelDisconnectedRender);
      res.off("close", cancelDisconnectedRender);
    }
  });

  app.use((error, req, res, next) => {
    const isBackgroundRemoval = req.path === "/api/remove-background";
    const isDominantVoiceDetection = req.path === "/api/detect-dominant-voice";
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      const isMediaImport = req.originalUrl === "/api/media";
      return sendError(
        res,
        400,
        "file_too_large",
        isMediaImport
          ? "Imported files must be 2 GB or smaller."
          : isBackgroundRemoval
            ? "Background-removal media must be 250 MB or smaller."
            : "Transcript media must be 2 GB or smaller.",
      );
    }

    if (isBackgroundRemoval && error instanceof multer.MulterError) {
      return sendError(
        res,
        400,
        "invalid_background_removal_request",
        "Background removal received invalid multipart data.",
      );
    }

    if (isBackgroundRemoval && isMultipartParserError(error)) {
      return sendError(
        res,
        400,
        "invalid_background_removal_request",
        "Background removal received malformed multipart data.",
      );
    }

    if (
      isDominantVoiceDetection &&
      (error instanceof multer.MulterError || isMultipartParserError(error))
    ) {
      return sendError(
        res,
        400,
        "invalid_dominant_voice_request",
        "Select a valid video range.",
      );
    }

    if (error) {
      const message =
        error instanceof Error ? error.message : "Transcription failed.";
      return sendError(res, 500, "transcription_failed", message);
    }

    return next();
  });

  app.set(
    "captionApiPort",
    Number.parseInt(String(captionApiPort), 10) || 5174,
  );
  app.set("warmRenderResources", () =>
    Promise.all([
      getRenderBundle(),
      getRenderBrowser(),
      getRenderBinariesDirectory(),
    ]),
  );

  return app;
};

export const startTranscriptionServer = (options = {}) => {
  const app = createTranscriptionApp(options);
  const port = app.get("captionApiPort");
  return app.listen(port, "127.0.0.1", () => {
    runtimeConsole.log(
      `Caption transcription API listening on http://127.0.0.1:${port}`,
    );
    void app
      .get("warmRenderResources")()
      .catch((error) =>
        runtimeConsole.warn("Could not prewarm the export renderer.", error),
      );
  });
};

if (
  runtimeProcess.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(runtimeProcess.argv[1])
) {
  startTranscriptionServer();
}
