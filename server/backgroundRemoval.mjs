import {execFile} from "node:child_process";
import {randomUUID} from "node:crypto";
import {copyFile, mkdir, mkdtemp, readdir, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";

import ffmpegPath from "ffmpeg-static";

import {createSubjectCutoutEngine} from "./subjectCutoutEngine.mjs";

const execFileAsync = promisify(execFile);
const RuntimeDOMException = globalThis.DOMException;
const cleanupOptions = {recursive: true, force: true};

const defaultPipelineFactory = async (task, selectedModelId, options) => {
  const {pipeline} = await import("@huggingface/transformers");
  return pipeline(task, selectedModelId, options);
};

const defaultRunFfmpeg = (args, options) =>
  execFileAsync(ffmpegPath, args, options);

const defaultLoadImage = async (inputPath) => {
  const {RawImage} = await import("@huggingface/transformers");
  return RawImage.read(inputPath);
};

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

const getResultMetadata = (mediaKind) => mediaKind === "image"
  ? {extension: ".png", mimeType: "image/png"}
  : {extension: ".webm", mimeType: "video/webm"};

const getFrameName = (frameNumber) =>
  `frame-${String(frameNumber).padStart(8, "0")}.png`;

export const createBackgroundRemovalProcessor = ({
  pipelineFactory = defaultPipelineFactory,
  subjectEngine,
  loadImageImpl = defaultLoadImage,
  RawImageCtor,
  runFfmpeg = defaultRunFfmpeg,
  copyFileImpl = copyFile,
  makeDirectoryImpl = mkdir,
  makeTempDirectoryImpl = mkdtemp,
  readDirectoryImpl = readdir,
  removeDirectoryImpl = rm,
  renameFileImpl = rename,
  videoMaskFps = 1,
} = {}) => {
  const engine = subjectEngine ?? createSubjectCutoutEngine({
    pipelineFactory,
    loadImageImpl,
    RawImageCtor,
  });
  return {
    async process({
      inputPath,
      mediaKind,
      startSeconds = 0,
      durationSeconds,
      outputDirectory,
      onProgress,
      signal,
    }) {
      if (mediaKind !== "image" && mediaKind !== "video") {
        throw new TypeError(`Unsupported media kind: ${mediaKind}`);
      }

      throwIfAborted(signal);
      onProgress?.(0);
      await makeDirectoryImpl(outputDirectory, {recursive: true});

      const tempDirectory = await makeTempDirectoryImpl(
        join(tmpdir(), "video-editor-background-removal-"),
      );
      const {extension, mimeType} = getResultMetadata(mediaKind);
      const outputPath = join(
        outputDirectory,
        `background-removed-${randomUUID()}${extension}`,
      );
      let primaryFailureOccurred = false;

      try {
        if (mediaKind === "image") {
          const {image} = await engine.process(inputPath, {mode: "image", signal});
          throwIfAborted(signal);
          const temporaryOutputPath = join(tempDirectory, "output.png");
          await image.save(temporaryOutputPath);
          throwIfAborted(signal);
          await renameFileImpl(temporaryOutputPath, outputPath);
          onProgress?.(100);

          return {outputPath, extension, mimeType};
        }

        const sourceFramesDirectory = join(tempDirectory, "source-frames");
        const processedFramesDirectory = join(tempDirectory, "processed-frames");
        await makeDirectoryImpl(sourceFramesDirectory, {recursive: true});
        await makeDirectoryImpl(processedFramesDirectory, {recursive: true});
        const targetFrameCount = Math.ceil(Number(durationSeconds) * 30);
        const normalizedMaskFps = Number.isFinite(videoMaskFps)
          ? Math.max(0.25, Math.min(5, Number(videoMaskFps)))
          : 1;
        const targetMaskFrameCount = Math.max(
          1,
          Math.ceil(Number(durationSeconds) * normalizedMaskFps),
        );
        const sourceFramePattern = join(
          sourceFramesDirectory,
          "frame-%08d.png",
        );
        await runFfmpeg([
          "-y",
          "-ss", String(startSeconds),
          "-t", String(durationSeconds),
          "-i", inputPath,
          "-map", "0:v:0",
          "-vf", `fps=${normalizedMaskFps}`,
          "-vsync", "0",
          "-frames:v", String(targetMaskFrameCount),
          sourceFramePattern,
        ], {signal});
        throwIfAborted(signal);
        onProgress?.(10);

        const extractedFrameNames = (await readDirectoryImpl(sourceFramesDirectory))
          .filter((name) => /^frame-\d{8}\.png$/i.test(name))
          .sort();
        if (extractedFrameNames.length === 0) {
          throw new Error("FFmpeg did not extract any video frames.");
        }

        const frameNames = extractedFrameNames.slice(0, targetMaskFrameCount);
        const lastExtractedFramePath = join(
          sourceFramesDirectory,
          extractedFrameNames.at(-1),
        );
        while (frameNames.length < targetMaskFrameCount) {
          throwIfAborted(signal);
          const paddedFrameName = getFrameName(frameNames.length + 1);
          await copyFileImpl(
            lastExtractedFramePath,
            join(sourceFramesDirectory, paddedFrameName),
          );
          throwIfAborted(signal);
          frameNames.push(paddedFrameName);
        }

        let previousSubject;
        for (const [frameIndex, frameName] of frameNames.entries()) {
          throwIfAborted(signal);
          const result = await engine.process(
            join(sourceFramesDirectory, frameName),
            {
              mode: frameIndex === 0 ? "video-first" : "video-next",
              previousSubject,
              signal,
            },
          );
          throwIfAborted(signal);
          await result.image.save(join(
            processedFramesDirectory,
            getFrameName(frameIndex + 1),
          ));
          previousSubject = result.subject;
          throwIfAborted(signal);
          onProgress?.(
            10 + Math.round(((frameIndex + 1) / frameNames.length) * 80),
          );
        }

        throwIfAborted(signal);
        const temporaryOutputPath = join(tempDirectory, "output.webm");
        await runFfmpeg([
          "-y",
          "-ss", String(startSeconds),
          "-t", String(durationSeconds),
          "-i", inputPath,
          "-framerate", String(normalizedMaskFps),
          "-i", join(processedFramesDirectory, "frame-%08d.png"),
          "-filter_complex",
          "[0:v]fps=30,format=rgba[video];"
            + "[1:v]format=rgba,alphaextract,"
            + "tpad=stop_mode=clone:stop_duration=1,"
            + "framerate=fps=30:interp_start=0:interp_end=255:flags=0,"
            + "format=gray[mask];"
            + "[video][mask]alphamerge[out]",
          "-map", "[out]",
          "-frames:v", String(targetFrameCount),
          "-c:v", "libvpx-vp9",
          "-deadline", "realtime",
          "-cpu-used", "8",
          "-row-mt", "1",
          "-pix_fmt", "yuva420p",
          "-auto-alt-ref", "0",
          "-an",
          temporaryOutputPath,
        ], {signal});
        throwIfAborted(signal);
        onProgress?.(95);
        await renameFileImpl(temporaryOutputPath, outputPath);
        onProgress?.(100);

        return {outputPath, extension, mimeType};
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
  };
};
