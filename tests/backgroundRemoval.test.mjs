import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdir, mkdtemp, rm, copyFile, writeFile} from "node:fs/promises";
import {basename, dirname, join} from "node:path";
import {tmpdir} from "node:os";
import {promisify} from "node:util";
import test from "node:test";

import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

import {createBackgroundRemovalProcessor} from "../server/backgroundRemoval.mjs";

const AbortControllerCtor = globalThis.AbortController;
const DOMExceptionCtor = globalThis.DOMException;
const execFileAsync = promisify(execFile);

const createFilesystemHarness = ({
  frameNames = [],
  removeDirectoryImpl,
  tempDirectories = ["C:/temp/background-removal-job"],
} = {}) => {
  const calls = {
    makeDirectory: [],
    removeDirectory: [],
    renameFile: [],
  };
  let tempDirectoryIndex = 0;

  return {
    calls,
    helpers: {
      makeDirectoryImpl: async (directory, options) => {
        calls.makeDirectory.push({directory, options});
      },
      makeTempDirectoryImpl: async () =>
        tempDirectories[tempDirectoryIndex++],
      readDirectoryImpl: async () => frameNames,
      removeDirectoryImpl: async (directory, options) => {
        calls.removeDirectory.push({directory, options});
        await removeDirectoryImpl?.(directory, options);
      },
      renameFileImpl: async (from, to) => {
        calls.renameFile.push({from, to});
      },
    },
  };
};

const probeDurationSeconds = async (inputPath) => {
  const {stdout} = await execFileAsync(ffprobeStatic.path, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1",
    inputPath,
  ]);

  return Number(String(stdout).trim());
};

const makeSyntheticVideo = async (outputPath, durationSeconds) => {
  await execFileAsync(ffmpegPath, [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=white:s=64x64:r=30:d=${durationSeconds}`,
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuv420p",
    "-an",
    outputPath,
  ]);
};

const writePlaceholderFile = async (outputPath, contents) => {
  await mkdir(dirname(outputPath), {recursive: true});
  await writeFile(outputPath, contents);
};

const createRawImageHarness = () => {
  const savedImages = [];

  class FakeRawImage {
    constructor(data, width, height, channels) {
      this.data = data;
      this.width = width;
      this.height = height;
      this.channels = channels;
    }

    async save(outputPath) {
      savedImages.push({
        outputPath,
        data: [...this.data],
        width: this.width,
        height: this.height,
        channels: this.channels,
      });
    }
  }

  return {FakeRawImage, savedImages};
};

const makeSourceImage = (frameNumber) => ({
  data: new Uint8ClampedArray([
    frameNumber,
    frameNumber + 20,
    frameNumber + 40,
  ]),
  width: 1,
  height: 1,
  channels: 3,
});

test("uses the subject engine and writes transparent image results as PNG", async () => {
  const engineCalls = [];
  const savedPaths = [];
  const progressByJob = [[], []];
  const filesystem = createFilesystemHarness({
    tempDirectories: ["C:/temp/image-job-1", "C:/temp/image-job-2"],
  });
  const subjectEngine = {
    process: async (...args) => {
      engineCalls.push(args);
      return {
        image: {
          save: async (outputPath) => savedPaths.push(outputPath),
        },
      };
    },
  };
  const processor = createBackgroundRemovalProcessor({
    subjectEngine,
    pipelineFactory: async () => async () => ({
      save: async (outputPath) => savedPaths.push(outputPath),
    }),
    ...filesystem.helpers,
  });

  const first = await processor.process({
    inputPath: "C:/media/person.jpg",
    mediaKind: "image",
    outputDirectory: "C:/output",
    onProgress: (progress) => progressByJob[0].push(progress),
  });
  const second = await processor.process({
    inputPath: "C:/media/product.webp",
    mediaKind: "image",
    outputDirectory: "C:/output",
    onProgress: (progress) => progressByJob[1].push(progress),
  });

  assert.deepEqual(engineCalls, [
    ["C:/media/person.jpg", {mode: "image", signal: undefined}],
    ["C:/media/product.webp", {mode: "image", signal: undefined}],
  ]);
  assert.deepEqual(savedPaths, [
    join("C:/temp/image-job-1", "output.png"),
    join("C:/temp/image-job-2", "output.png"),
  ]);
  assert.deepEqual(
    [first.extension, first.mimeType, second.extension, second.mimeType],
    [".png", "image/png", ".png", "image/png"],
  );
  assert.equal(basename(first.outputPath).endsWith(".png"), true);
  assert.equal(basename(second.outputPath).endsWith(".png"), true);
  assert.deepEqual(progressByJob.map((values) => [values[0], values.at(-1)]), [
    [0, 100],
    [0, 100],
  ]);
  assert.deepEqual(filesystem.calls.removeDirectory, [
    {
      directory: "C:/temp/image-job-1",
      options: {recursive: true, force: true},
    },
    {
      directory: "C:/temp/image-job-2",
      options: {recursive: true, force: true},
    },
  ]);
});

test("uses sparse AI masks and lets FFmpeg interpolate the 30 fps alpha", async () => {
  const engineCalls = [];
  const ffmpegCalls = [];
  const progressValues = [];
  const copiedFiles = [];
  const loadedFrameNames = [];
  const {FakeRawImage, savedImages} = createRawImageHarness();
  const filesystem = createFilesystemHarness({
    frameNames: [
      "frame-00000007.png",
      "frame-00000002.png",
      "ignore.txt",
      "frame-00000001.png",
      "frame-00000006.png",
      "frame-00000004.png",
      "frame-00000003.png",
      "frame-00000005.png",
    ],
    tempDirectories: ["C:/temp/smooth-video-job"],
  });
  const keyframeAlpha = new Map([
    ["frame-00000001.png", 0],
    ["frame-00000007.png", 180],
  ]);
  const abortController = new AbortControllerCtor();
  const processor = createBackgroundRemovalProcessor({
    videoMaskFps: 2,
    subjectEngine: {
      process: async (inputPath, options) => {
        engineCalls.push({frameName: basename(inputPath), options});
        const alpha = keyframeAlpha.get(basename(inputPath));
        assert.notEqual(alpha, undefined);
        return {
          alpha: new Uint8ClampedArray([alpha]),
          subject: {frameName: basename(inputPath), route: "portrait"},
          image: new FakeRawImage(
            new Uint8ClampedArray([1, 21, 41, alpha]),
            1,
            1,
            4,
          ),
        };
      },
    },
    pipelineFactory: async () => async (inputPath) => ({
      save: async (outputPath) => {
        await writePlaceholderFile(outputPath, basename(inputPath));
      },
    }),
    loadImageImpl: async (inputPath) => {
      const frameName = basename(inputPath);
      loadedFrameNames.push(frameName);
      const frameNumber = Number(frameName.slice(6, 14));
      return makeSourceImage(frameNumber);
    },
    RawImageCtor: FakeRawImage,
    copyFileImpl: async (from, to) => copiedFiles.push({from, to}),
    runFfmpeg: async (args, options) => ffmpegCalls.push({args, options}),
    ...filesystem.helpers,
  });

  const result = await processor.process({
    inputPath: "C:/media/source.mp4",
    mediaKind: "video",
    startSeconds: 2.5,
    durationSeconds: 0.26,
    outputDirectory: "C:/output",
    onProgress: (progress) => progressValues.push(progress),
    signal: abortController.signal,
  });

  assert.deepEqual(engineCalls, [
    {
      frameName: "frame-00000001.png",
      options: {
        mode: "video-first",
        previousSubject: undefined,
        signal: abortController.signal,
      },
    },
  ]);
  assert.equal(ffmpegCalls.length, 2);
  assert.deepEqual(ffmpegCalls[0].args.slice(0, 13), [
    "-y", "-ss", "2.5", "-t", "0.26", "-i", "C:/media/source.mp4",
    "-map", "0:v:0", "-vf", "fps=2", "-vsync", "0",
  ]);
  assert.equal(ffmpegCalls[0].args.at(-1).endsWith("frame-%08d.png"), true);
  assert.deepEqual(ffmpegCalls[0].options, {signal: abortController.signal});
  assert.deepEqual(ffmpegCalls[1].args, [
    "-y", "-ss", "2.5", "-t", "0.26",
    "-i", "C:/media/source.mp4",
    "-framerate", "2",
    "-i", join(
      "C:/temp/smooth-video-job",
      "processed-frames",
      "frame-%08d.png",
    ),
    "-filter_complex",
    "[0:v]fps=30,format=rgba[video];"
      + "[1:v]format=rgba,alphaextract,"
      + "tpad=stop_mode=clone:stop_duration=1,"
      + "framerate=fps=30:interp_start=0:interp_end=255:flags=0,"
      + "format=gray[mask];"
      + "[video][mask]alphamerge[out]",
    "-map", "[out]",
    "-frames:v", "8",
    "-c:v", "libvpx-vp9", "-deadline", "realtime",
    "-cpu-used", "8", "-row-mt", "1", "-pix_fmt", "yuva420p",
    "-auto-alt-ref", "0", "-an",
    join("C:/temp/smooth-video-job", "output.webm"),
  ]);
  assert.equal(ffmpegCalls[1].args.includes("-t"), true);
  assert.deepEqual(ffmpegCalls[1].options, {signal: abortController.signal});
  assert.deepEqual(copiedFiles, []);
  assert.deepEqual(loadedFrameNames, []);
  assert.deepEqual(savedImages.map(({outputPath, data, channels}) => ({
    frameName: basename(outputPath),
    data,
    channels,
  })), [
    {frameName: "frame-00000001.png", data: [1, 21, 41, 0], channels: 4},
  ]);
  assert.deepEqual([result.extension, result.mimeType], [".webm", "video/webm"]);
  assert.equal(result.outputPath.endsWith(".webm"), true);
  assert.equal(progressValues[0], 0);
  assert.equal(progressValues.at(-1), 100);
  assert.equal(progressValues.every((value) => value >= 0 && value <= 100), true);
  assert.deepEqual(progressValues, [...progressValues].sort((a, b) => a - b));
  assert.deepEqual(filesystem.calls.removeDirectory, [{
    directory: "C:/temp/smooth-video-job",
    options: {recursive: true, force: true},
  }]);
});

test("pads the encoded video so it is never shorter than the requested duration", async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), "background-removal-integration-"));
  const inputPath = join(workingDirectory, "input.webm");
  const outputDirectory = join(workingDirectory, "output");
  const requestedDurationSeconds = 0.83;
  const expectedDurationSeconds = Math.ceil(requestedDurationSeconds * 30) / 30;

  t.after(() => rm(workingDirectory, {recursive: true, force: true}));

  await makeSyntheticVideo(inputPath, 1.2);

  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async (framePath) => {
        const {RawImage} = await import("@huggingface/transformers");
        const image = await RawImage.read(framePath);
        const rgba = new Uint8ClampedArray(image.width * image.height * 4);
        for (let index = 0; index < image.width * image.height; index += 1) {
          rgba[index * 4] = image.data[index * image.channels];
          rgba[index * 4 + 1] = image.data[index * image.channels + 1];
          rgba[index * 4 + 2] = image.data[index * image.channels + 2];
          rgba[index * 4 + 3] = 255;
        }
        return {
          image: new RawImage(rgba, image.width, image.height, 4),
          alpha: new Uint8ClampedArray(image.width * image.height).fill(255),
          subject: null,
        };
      },
    },
    pipelineFactory: async () => async (framePath) => ({
      save: async (outputPath) => copyFile(framePath, outputPath),
    }),
  });

  const result = await processor.process({
    inputPath,
    mediaKind: "video",
    startSeconds: 0,
    durationSeconds: requestedDurationSeconds,
    outputDirectory,
  });

  const durationSeconds = await probeDurationSeconds(result.outputPath);

  assert.equal(result.extension, ".webm");
  assert.equal(result.mimeType, "video/webm");
  assert.equal(durationSeconds >= requestedDurationSeconds, true);
  assert.equal(durationSeconds <= requestedDurationSeconds + 0.1, true);
  assert.equal(Math.abs(durationSeconds - expectedDurationSeconds) <= 0.005, true);
});

test("allows a later subject-engine job after a processing failure", async () => {
  const engineCalls = [];
  const filesystem = createFilesystemHarness({
    frameNames: ["frame-00000001.png"],
    tempDirectories: [
      "C:/temp/cache-image-1",
      "C:/temp/cache-video-fail",
      "C:/temp/cache-video-retry",
      "C:/temp/cache-image-2",
    ],
  });
  const {FakeRawImage} = createRawImageHarness();
  let videoAttempts = 0;
  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async (inputPath, options) => {
        engineCalls.push({inputPath, options});
        if (options.mode === "image") {
          return {image: {save: async () => {}}};
        }
        videoAttempts += 1;
        if (videoAttempts === 1) throw new Error("video processing failed");
        return {
          image: {save: async () => {}},
          alpha: new Uint8ClampedArray([255]),
          subject: {route: "portrait"},
        };
      },
    },
    loadImageImpl: async () => makeSourceImage(1),
    RawImageCtor: FakeRawImage,
    runFfmpeg: async () => {},
    ...filesystem.helpers,
  });

  await processor.process({
    inputPath: "C:/media/image-one.png",
    mediaKind: "image",
    outputDirectory: "C:/output",
  });

  await assert.rejects(
    processor.process({
      inputPath: "C:/media/video-one.mp4",
      mediaKind: "video",
      startSeconds: 0,
      durationSeconds: 1 / 30,
      outputDirectory: "C:/output",
    }),
    /video processing failed/,
  );

  await processor.process({
    inputPath: "C:/media/video-two.mp4",
    mediaKind: "video",
    startSeconds: 0,
    durationSeconds: 1 / 30,
    outputDirectory: "C:/output",
  });

  await processor.process({
    inputPath: "C:/media/image-two.png",
    mediaKind: "image",
    outputDirectory: "C:/output",
  });

  assert.deepEqual(engineCalls.map(({inputPath, options}) => ({
    inputPath,
    mode: options.mode,
  })), [
    {inputPath: "C:/media/image-one.png", mode: "image"},
    {
      inputPath: join(
        "C:/temp/cache-video-fail",
        "source-frames",
        "frame-00000001.png",
      ),
      mode: "video-first",
    },
    {
      inputPath: join(
        "C:/temp/cache-video-retry",
        "source-frames",
        "frame-00000001.png",
      ),
      mode: "video-first",
    },
    {inputPath: "C:/media/image-two.png", mode: "image"},
  ]);
  assert.deepEqual(engineCalls.filter(({options}) => options.mode === "image")
    .map(({inputPath}) => inputPath), [
    "C:/media/image-one.png",
    "C:/media/image-two.png",
  ]);
  assert.deepEqual(filesystem.calls.removeDirectory, [
    {
      directory: "C:/temp/cache-image-1",
      options: {recursive: true, force: true},
    },
    {
      directory: "C:/temp/cache-video-fail",
      options: {recursive: true, force: true},
    },
    {
      directory: "C:/temp/cache-video-retry",
      options: {recursive: true, force: true},
    },
    {
      directory: "C:/temp/cache-image-2",
      options: {recursive: true, force: true},
    },
  ]);
});

test("aborts during encode and still cleans up the temporary directory", async () => {
  const abortController = new AbortControllerCtor();
  const filesystem = createFilesystemHarness({
    frameNames: ["frame-00000001.png"],
    tempDirectories: ["C:/temp/encode-abort-job"],
  });
  let runCount = 0;
  const {FakeRawImage} = createRawImageHarness();
  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async () => ({
        image: {save: async () => {}},
        alpha: new Uint8ClampedArray([255]),
        subject: {route: "portrait"},
      }),
    },
    loadImageImpl: async () => makeSourceImage(1),
    RawImageCtor: FakeRawImage,
    runFfmpeg: async (_args, options) => {
      runCount += 1;
      if (runCount === 2) {
        globalThis.queueMicrotask(() => abortController.abort());
        await new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMExceptionCtor("The operation was aborted.", "AbortError"));
          }, {once: true});
        });
      }
    },
    ...filesystem.helpers,
  });

  await assert.rejects(
    processor.process({
      inputPath: "C:/media/video.mp4",
      mediaKind: "video",
      startSeconds: 0,
      durationSeconds: 1 / 30,
      outputDirectory: "C:/output",
      signal: abortController.signal,
    }),
    (error) => error?.name === "AbortError",
  );

  assert.equal(runCount, 2);
  assert.deepEqual(filesystem.calls.renameFile, []);
  assert.deepEqual(filesystem.calls.removeDirectory, [{
    directory: "C:/temp/encode-abort-job",
    options: {recursive: true, force: true},
  }]);
});

test("aborts between video frames and removes temporary files", async () => {
  const abortController = new AbortControllerCtor();
  const ffmpegCalls = [];
  const filesystem = createFilesystemHarness({
    frameNames: ["frame-00000001.png", "frame-00000002.png"],
    tempDirectories: ["C:/temp/abort-job"],
  });
  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async () => {
        abortController.abort();
        return {
          alpha: new Uint8ClampedArray([255]),
          subject: {route: "portrait"},
        };
      },
    },
    loadImageImpl: async () => assert.fail("aborted frames must not be loaded"),
    runFfmpeg: async (args) => ffmpegCalls.push(args),
    ...filesystem.helpers,
  });

  await assert.rejects(
    processor.process({
      inputPath: "C:/media/source.mp4",
      mediaKind: "video",
      startSeconds: 0,
      durationSeconds: 2 / 30,
      outputDirectory: "C:/output",
      signal: abortController.signal,
    }),
    (error) => error?.name === "AbortError",
  );

  assert.equal(ffmpegCalls.length, 1);
  assert.deepEqual(filesystem.calls.renameFile, []);
  assert.deepEqual(filesystem.calls.removeDirectory, [{
    directory: "C:/temp/abort-job",
    options: {recursive: true, force: true},
  }]);
});

test("preserves processing failures while cleaning the temporary directory", async () => {
  const filesystem = createFilesystemHarness({
    removeDirectoryImpl: async () => {
      throw new Error("cleanup failed");
    },
    tempDirectories: ["C:/temp/failure-job"],
  });
  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async () => {
        throw new Error("model inference failed");
      },
    },
    ...filesystem.helpers,
  });

  await assert.rejects(
    processor.process({
      inputPath: "C:/media/person.png",
      mediaKind: "image",
      outputDirectory: "C:/output",
    }),
    /model inference failed/,
  );

  assert.deepEqual(filesystem.calls.renameFile, []);
  assert.deepEqual(filesystem.calls.removeDirectory, [{
    directory: "C:/temp/failure-job",
    options: {recursive: true, force: true},
  }]);
});

test("preserves a falsy processing rejection when cleanup also fails", async () => {
  const noRejection = Symbol("no rejection");
  let rejection = noRejection;
  const filesystem = createFilesystemHarness({
    removeDirectoryImpl: async () => {
      throw new Error("cleanup failed");
    },
    tempDirectories: ["C:/temp/falsy-failure-job"],
  });
  const processor = createBackgroundRemovalProcessor({
    subjectEngine: {
      process: async () => {
        throw null;
      },
    },
    ...filesystem.helpers,
  });

  try {
    await processor.process({
      inputPath: "C:/media/person.png",
      mediaKind: "image",
      outputDirectory: "C:/output",
    });
  } catch (error) {
    rejection = error;
  }

  assert.notEqual(rejection, noRejection);
  assert.equal(rejection, null);
  assert.deepEqual(filesystem.calls.removeDirectory, [{
    directory: "C:/temp/falsy-failure-job",
    options: {recursive: true, force: true},
  }]);
});
