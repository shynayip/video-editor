import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createTranscriptionApp } from "../server/transcriptionServer.mjs";
import {
  normalizeTranscriptSegments,
  transcribeMediaFile,
} from "../server/transcriptionLogic.mjs";

const BlobCtor = globalThis.Blob;
const AbortControllerCtor = globalThis.AbortController;
const AbortSignalCtor = globalThis.AbortSignal;
const DOMExceptionCtor = globalThis.DOMException;
const FormDataCtor = globalThis.FormData;
const fetchImpl = globalThis.fetch;

test("normalizes segment timestamps and trims transcript text", () => {
  assert.deepEqual(
    normalizeTranscriptSegments({
      segments: [
        { start: 0.2, end: 1.4, text: " Hi " },
        { start: 1.5, end: 3.1, text: "there" },
      ],
    }),
    [
      { startSeconds: 0.2, endSeconds: 1.4, text: "Hi" },
      { startSeconds: 1.5, endSeconds: 3.1, text: "there" },
    ],
  );
});

test("drops malformed segments when at least one usable timestamp range exists", () => {
  assert.deepEqual(
    normalizeTranscriptSegments({
      segments: [
        { start: -1, end: 1, text: "negative" },
        { start: 1, end: 1, text: "empty" },
        { start: 1.5, end: 2.5, text: " keep me " },
        { start: 2.6, end: 3.5, text: "   " },
      ],
    }),
    [{ startSeconds: 1.5, endSeconds: 2.5, text: "keep me" }],
  );
});

test("rejects transcript payloads without usable timestamps", () => {
  assert.throws(
    () => normalizeTranscriptSegments({ text: "Hi" }),
    /timestamps/i,
  );
});

test("transcribes extracted audio through injected dependencies and cleans up on success", async () => {
  const ffmpegCalls = [];
  const cleanupCalls = [];

  const segments = await transcribeMediaFile({
    inputPath: "C:/temp/input.mp4",
    outputPath: "C:/temp/output.mp3",
    tempDirectory: "C:/temp/job-123",
    apiKey: "secret-key",
    ffmpegPath: "C:/ffmpeg/bin/ffmpeg.exe",
    sourceStartSeconds: 0,
    durationSeconds: 1.2,
    execFileImpl: async (file, args) => {
      ffmpegCalls.push({ file, args });
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer secret-key");
      assert.equal(options.body.get("model"), "whisper-1");
      assert.equal(options.body.get("response_format"), "verbose_json");
      assert.equal(options.body.get("timestamp_granularities[]"), "segment");
      assert.ok(options.body.get("file"));

      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 0, end: 1.2, text: " Hello world " }],
        }),
      };
    },
    readFileImpl: async (filePath) => {
      assert.equal(filePath, "C:/temp/output.mp3");
      return Buffer.from("fake mp3");
    },
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
  });

  assert.deepEqual(ffmpegCalls, [
    {
      file: "C:/ffmpeg/bin/ffmpeg.exe",
      args: [
        "-y",
        "-ss",
        "0",
        "-t",
        "1.2",
        "-i",
        "C:/temp/input.mp4",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "C:/temp/output.mp3",
      ],
    },
  ]);
  assert.deepEqual(segments, [
    { startSeconds: 0, endSeconds: 1.2, text: "Hello world" },
  ]);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/job-123",
      options: { recursive: true, force: true },
    },
  ]);
});

test("extracts only the requested visible source range before transcription", async () => {
  const ffmpegCalls = [];

  await transcribeMediaFile({
    inputPath: "C:/temp/input.mp4",
    outputPath: "C:/temp/output.mp3",
    tempDirectory: "C:/temp/job-trimmed",
    apiKey: "secret-key",
    ffmpegPath: "ffmpeg",
    sourceStartSeconds: 2.5,
    durationSeconds: 7.25,
    execFileImpl: async (file, args) => {
      ffmpegCalls.push({ file, args });
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        segments: [{ start: 0.1, end: 0.9, text: " Trimmed only " }],
      }),
    }),
    readFileImpl: async () => Buffer.from("fake mp3"),
    removeDirectoryImpl: async () => {},
  });

  assert.deepEqual(ffmpegCalls, [
    {
      file: "ffmpeg",
      args: [
        "-y",
        "-ss",
        "2.5",
        "-t",
        "7.25",
        "-i",
        "C:/temp/input.mp4",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "C:/temp/output.mp3",
      ],
    },
  ]);
});

test("passes abort signal through ffmpeg and OpenAI fetch and cleans up", async () => {
  const abortController = new AbortControllerCtor();
  const cleanupCalls = [];
  let ffmpegSignal = null;
  let fetchSignal = null;

  await assert.rejects(
    transcribeMediaFile({
      inputPath: "input.mp4",
      outputPath: "output.mp3",
      tempDirectory: "job-aborted",
      apiKey: "secret-key",
      ffmpegPath: "ffmpeg",
      sourceStartSeconds: 0,
      durationSeconds: 3,
      signal: abortController.signal,
      execFileImpl: async (_file, _args, options) => {
        ffmpegSignal = options?.signal ?? null;
      },
      fetchImpl: async (_url, options) => {
        fetchSignal = options?.signal ?? null;
        abortController.abort();
        throw new DOMExceptionCtor("The operation was aborted.", "AbortError");
      },
      readFileImpl: async () => Buffer.from("fake mp3"),
      removeDirectoryImpl: async (directory, options) => {
        cleanupCalls.push({ directory, options });
      },
    }),
    /aborted/i,
  );

  assert.equal(ffmpegSignal, abortController.signal);
  assert.equal(fetchSignal, abortController.signal);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "job-aborted",
      options: { recursive: true, force: true },
    },
  ]);
});

test("surfaces OpenAI API errors and still removes the temp directory", async () => {
  const cleanupCalls = [];

  await assert.rejects(
    transcribeMediaFile({
      inputPath: "input.mp4",
      outputPath: "output.mp3",
      tempDirectory: "job-failure",
      apiKey: "secret-key",
      ffmpegPath: "ffmpeg",
      sourceStartSeconds: 0,
      durationSeconds: 1,
      execFileImpl: async () => {},
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({
          error: { message: "bad request from OpenAI" },
        }),
      }),
      readFileImpl: async () => Buffer.from("fake mp3"),
      removeDirectoryImpl: async (directory, options) => {
        cleanupCalls.push({ directory, options });
      },
    }),
    /bad request from OpenAI/,
  );

  assert.deepEqual(cleanupCalls, [
    {
      directory: "job-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("rejects malformed successful responses and still removes the temp directory", async () => {
  const cleanupCalls = [];

  await assert.rejects(
    transcribeMediaFile({
      inputPath: "input.mp4",
      outputPath: "output.mp3",
      tempDirectory: "job-malformed",
      apiKey: "secret-key",
      ffmpegPath: "ffmpeg",
      sourceStartSeconds: 0,
      durationSeconds: 1,
      execFileImpl: async () => {},
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ text: "missing segments" }),
      }),
      readFileImpl: async () => Buffer.from("fake mp3"),
      removeDirectoryImpl: async (directory, options) => {
        cleanupCalls.push({ directory, options });
      },
    }),
    /timestamps/i,
  );

  assert.deepEqual(cleanupCalls, [
    {
      directory: "job-malformed",
      options: { recursive: true, force: true },
    },
  ]);
});

test("preserves the transcription failure when service cleanup also fails", async () => {
  await assert.rejects(
    transcribeMediaFile({
      inputPath: "input.mp4",
      outputPath: "output.mp3",
      tempDirectory: "job-cleanup-mask",
      apiKey: "secret-key",
      ffmpegPath: "ffmpeg",
      sourceStartSeconds: 0,
      durationSeconds: 1,
      execFileImpl: async () => {},
      fetchImpl: async () => {
        throw new Error("openai down");
      },
      readFileImpl: async () => Buffer.from("fake mp3"),
      removeDirectoryImpl: async () => {
        throw new Error("cleanup failed");
      },
    }),
    /openai down/,
  );
});

const startTestServer = async (t, { configureApp, ...options } = {}) => {
  const app = createTranscriptionApp({
    allowOriginlessRequests: true,
    ...options,
  });
  configureApp?.(app);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
};

const postTranscriptionRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/transcribe`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postSilenceDetectionRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/detect-silence`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postDominantVoiceDetectionRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/detect-dominant-voice`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postSceneDetectionRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/detect-scenes`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postBackgroundRemovalRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/remove-background`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postMediaRequest = async (url, formData, options = {}) =>
  fetchImpl(`${url}/api/media`, {
    method: "POST",
    body: formData,
    ...options,
  });

const postExportRequest = async (url, project, options = {}) =>
  fetchImpl(`${url}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, ...options }),
  });

const makeBackgroundRemovalFormData = ({
  mediaKind,
  mimetype,
  name,
  sourceStart,
  startSeconds,
  duration,
  durationSeconds,
} = {}) => {
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("media data")], { type: mimetype }),
    name,
  );
  formData.append("mediaKind", mediaKind);
  if (sourceStart !== undefined) formData.append("sourceStart", sourceStart);
  if (startSeconds !== undefined) formData.append("startSeconds", startSeconds);
  if (duration !== undefined) formData.append("duration", duration);
  if (durationSeconds !== undefined) {
    formData.append("durationSeconds", durationSeconds);
  }
  return formData;
};

test("uses repaired Windows render binaries and fast preview encoding", async (t) => {
  const renderCalls = [];
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/export-route",
    makeDirectoryImpl: async () => {},
    getRenderBinariesDirectoryImpl: async () => "C:/temp/remotion-binaries",
    openBrowserImpl: async () => "reused-render-browser",
    bundleImpl: async () => "http://localhost:3000",
    renderMediaImpl: async (options) => {
      renderCalls.push(options);
      throw new Error("render probe stopped");
    },
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
  });

  const response = await postExportRequest(url, {
    version: 1,
    clips: [],
    mediaItems: [],
    selectedMediaId: null,
  });

  assert.equal(response.status, 500);
  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].binariesDirectory, "C:/temp/remotion-binaries");
  assert.equal(renderCalls[0].puppeteerInstance, "reused-render-browser");
  assert.equal(renderCalls[0].concurrency, 1);
  assert.equal(renderCalls[0].disallowParallelEncoding, false);
  assert.equal(renderCalls[0].audioCodec, "mp3");
  assert.equal(renderCalls[0].scale, 0.5);
  assert.equal(renderCalls[0].videoBitrate, "3M");
  assert.equal(renderCalls[0].imageFormat, "jpeg");
  assert.equal(renderCalls[0].jpegQuality, 70);
  assert.equal(renderCalls[0].everyNthFrame, 2);
  assert.equal(renderCalls[0].hardwareAcceleration, "disable");
  assert.deepEqual(
    renderCalls[0].ffmpegOverride({
      type: "stitcher",
      args: ["-c:v", "libx264"],
    }),
    ["-c:v", "h264_amf", "-quality", "speed"],
  );
  assert.equal(renderCalls[0].x264Preset, undefined);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/export-route",
      options: { recursive: true, force: true },
    },
  ]);
});

test("keeps full HD export available when explicitly requested", async (t) => {
  const renderCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/export-hd-route",
    makeDirectoryImpl: async () => {},
    getRenderBinariesDirectoryImpl: async () => "C:/temp/remotion-binaries",
    openBrowserImpl: async () => "reused-render-browser",
    bundleImpl: async () => "http://localhost:3000",
    renderMediaImpl: async (options) => {
      renderCalls.push(options);
      throw new Error("render probe stopped");
    },
    removeDirectoryImpl: async () => {},
  });

  const response = await postExportRequest(
    url,
    { version: 1, clips: [], mediaItems: [], selectedMediaId: null },
    { renderScale: 1 },
  );

  assert.equal(response.status, 500);
  assert.equal(renderCalls[0].scale, 1);
  assert.equal(renderCalls[0].videoBitrate, "8M");
  assert.equal(renderCalls[0].jpegQuality, 85);
  assert.equal(renderCalls[0].everyNthFrame, 1);
});

const postRawTranscriptionRequest = async (url, { headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const request = httpRequest(
      `${url}/api/transcribe`,
      {
        method: "POST",
        headers,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            json: () => JSON.parse(body),
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });

const postRawBackgroundRemovalRequest = async (
  url,
  { body = "", headers = {} } = {},
) =>
  new Promise((resolve, reject) => {
    const request = httpRequest(
      `${url}/api/remove-background`,
      {
        method: "POST",
        headers,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            json: () => JSON.parse(responseBody),
          });
        });
      },
    );
    request.on("error", reject);
    request.end(body);
  });

const postRawDominantVoiceDetectionRequest = async (
  url,
  { body = "", headers = {} } = {},
) =>
  new Promise((resolve, reject) => {
    const request = httpRequest(
      `${url}/api/detect-dominant-voice`,
      {
        method: "POST",
        headers,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            json: () => JSON.parse(responseBody),
          });
        });
      },
    );
    request.on("error", reject);
    request.end(body);
  });

const makeClipFormData = () => {
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("video data")]),
    "clip.mp4",
  );
  return formData;
};

const makeVideoClipFormData = () => {
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("video data")], { type: "video/mp4" }),
    "clip.mp4",
  );
  return formData;
};

test("streams editor media that exceeds the smaller caption upload limit", async (t) => {
  const mediaUploadDirectory = await mkdtemp(
    join(tmpdir(), "video-editor-media-test-"),
  );
  t.after(() => rm(mediaUploadDirectory, { recursive: true, force: true }));
  const url = await startTestServer(t, {
    maxFileSizeBytes: 4,
    maxMediaFileSizeBytes: 8,
    mediaUploadDirectory,
  });
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("12345")], { type: "video/mp4" }),
    "large clip.mp4",
  );

  const response = await postMediaRequest(url, formData);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.match(payload.src, /^uploads\/large-clip-[a-f0-9-]+\.mp4$/);
  assert.equal(payload.label, "large clip.mp4");
  assert.deepEqual(
    await readFile(
      join(mediaUploadDirectory, payload.src.replace("uploads/", "")),
    ),
    Buffer.from("12345"),
  );
});

test("returns normalized local silence ranges", async (t) => {
  const serviceCalls = [];
  const url = await startTestServer(t, {
    detectSilenceInMediaImpl: async (options) => {
      serviceCalls.push(options);
      return [{ startSeconds: 1.15, endSeconds: 1.85 }];
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "2");
  formData.append("duration", "8");

  const response = await postSilenceDetectionRequest(url, formData, {
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ranges: [{ startSeconds: 1.15, endSeconds: 1.85 }],
  });
  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].sourceStartSeconds, 2);
  assert.equal(serviceCalls[0].durationSeconds, 8);
});

test("returns normalized local scene ranges", async (t) => {
  const cleanupCalls = [];
  const serviceCalls = [];
  const url = await startTestServer(t, {
    ffmpegBinaryPath: "ffmpeg-test",
    ffprobeBinaryPath: "ffprobe-test",
    makeTempDirectory: async () => "C:/temp/scene-success",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    detectScenesInMediaImpl: async (options) => {
      serviceCalls.push(options);
      return [
        { startSeconds: 0, endSeconds: 2.5 },
        { startSeconds: 2.5, endSeconds: 6 },
      ];
    },
  });

  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("video data")], { type: "video/mp4" }),
    "clip.mp4",
  );
  const response = await postSceneDetectionRequest(url, formData, {
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    scenes: [
      { startSeconds: 0, endSeconds: 2.5 },
      { startSeconds: 2.5, endSeconds: 6 },
    ],
  });
  assert.equal(serviceCalls.length, 1);
  assert.match(serviceCalls[0].inputPath, /scene-success[\\/]input\.mp4$/);
  assert.equal(serviceCalls[0].ffmpegPath, "ffmpeg-test");
  assert.equal(serviceCalls[0].ffprobePath, "ffprobe-test");
  assert.ok(serviceCalls[0].signal instanceof AbortSignalCtor);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/scene-success",
      options: { recursive: true, force: true },
    },
  ]);
});

test("rejects missing scene detection uploads", async (t) => {
  const url = await startTestServer(t, {
    detectScenesInMediaImpl: async () => {
      assert.fail("missing uploads must not reach scene detection");
    },
  });

  const response = await postSceneDetectionRequest(url, new FormDataCtor());

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "missing_file",
      message: "No video file was uploaded.",
    },
  });
});

test("rejects non-video scene detection uploads", async (t) => {
  const url = await startTestServer(t, {
    detectScenesInMediaImpl: async () => {
      assert.fail("non-video uploads must not reach scene detection");
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor(["audio"], { type: "audio/mpeg" }),
    "clip.mp3",
  );

  const response = await postSceneDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "unsupported_media",
      message: "Scene detection requires a video file.",
    },
  });
});

test("removes the scene detection temp directory when the detector fails", async (t) => {
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/scene-failure",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    detectScenesInMediaImpl: async () => {
      throw new Error("analysis failed");
    },
  });

  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("video data")], { type: "video/mp4" }),
    "clip.mp4",
  );
  const response = await postSceneDetectionRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "scene_detection_failed",
      message: "analysis failed",
    },
  });
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/scene-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("aborts scene detection and removes its temp directory when the client closes", async (t) => {
  let serviceStarted;
  const serviceStartedPromise = new Promise((resolve) => {
    serviceStarted = resolve;
  });
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let cleanupFinished;
  const cleanupFinishedPromise = new Promise((resolve) => {
    cleanupFinished = resolve;
  });
  const cleanupCalls = [];
  let serviceSignal = null;
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/scene-abort",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
      cleanupFinished();
    },
    detectScenesInMediaImpl: async ({ signal }) => {
      serviceSignal = signal;
      signal.addEventListener("abort", signalAborted, { once: true });
      serviceStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new DOMExceptionCtor("The operation was aborted.", "AbortError"),
            ),
          { once: true },
        );
      });
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("video data")], { type: "video/mp4" }),
    "clip.mp4",
  );
  const abortController = new AbortControllerCtor();
  const requestPromise = postSceneDetectionRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);

  const serviceState = await Promise.race([
    serviceStartedPromise.then(() => "started"),
    requestPromise.then(() => "responded"),
  ]);
  assert.equal(serviceState, "started");
  abortController.abort();
  await Promise.all([
    signalAbortedPromise,
    cleanupFinishedPromise,
    requestPromise,
  ]);

  assert.equal(serviceSignal?.aborted, true);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/scene-abort",
      options: { recursive: true, force: true },
    },
  ]);
});

test("background removal stores a completed image output before returning its source", async (t) => {
  const copyCalls = [];
  const processorCalls = [];
  const statCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-image",
    mediaUploadDirectory: "C:/uploads",
    writeFileImpl: async () => {},
    copyFileImpl: async (from, to) => copyCalls.push({ from, to }),
    statFileImpl: async (filePath) => {
      statCalls.push(filePath);
      return { isFile: () => true };
    },
    backgroundRemovalProcessor: {
      process: async (options) => {
        processorCalls.push(options);
        return {
          outputPath: "C:/temp/background-image/output/processed.png",
          extension: ".png",
          mimeType: "image/png",
        };
      },
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "Person portrait.png",
    sourceStart: "0",
    duration: "0",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.src, /^uploads\/Person-portrait-[\da-f-]+\.png$/);
  assert.equal(result.mimeType, "image/png");
  assert.equal(processorCalls.length, 1);
  assert.match(processorCalls[0].inputPath, /background-image[\\/]input\.png$/);
  assert.equal(processorCalls[0].mediaKind, "image");
  assert.equal(processorCalls[0].startSeconds, 0);
  assert.equal(processorCalls[0].durationSeconds, 0);
  assert.match(
    processorCalls[0].outputDirectory,
    /background-image[\\/]output$/,
  );
  assert.equal(processorCalls[0].signal instanceof AbortSignalCtor, true);
  assert.equal(copyCalls.length, 1);
  assert.equal(
    copyCalls[0].from,
    "C:/temp/background-image/output/processed.png",
  );
  assert.equal(
    copyCalls[0].to.replaceAll("\\", "/"),
    `C:/uploads/${result.src.slice("uploads/".length)}`,
  );
  assert.deepEqual(
    statCalls.map((filePath) => filePath.replaceAll("\\", "/")),
    [
      "C:/temp/background-image/output/processed.png",
      `C:/uploads/${result.src.slice("uploads/".length)}`,
    ],
  );
});

test("background removal accepts startSeconds and durationSeconds for videos", async (t) => {
  const processorCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-video",
    mediaUploadDirectory: "C:/uploads",
    writeFileImpl: async () => {},
    copyFileImpl: async () => {},
    statFileImpl: async () => ({ isFile: () => true }),
    backgroundRemovalProcessor: {
      process: async (options) => {
        processorCalls.push(options);
        return {
          outputPath: "C:/temp/background-video/output/processed.webm",
          extension: ".webm",
          mimeType: "video/webm",
        };
      },
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "video",
    mimetype: "video/mp4",
    name: "person.mp4",
    startSeconds: "1.5",
    durationSeconds: "3.25",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).mimeType, "video/webm");
  assert.equal(processorCalls.length, 1);
  assert.equal(processorCalls[0].mediaKind, "video");
  assert.equal(processorCalls[0].startSeconds, 1.5);
  assert.equal(processorCalls[0].durationSeconds, 3.25);
});

test("background removal rejects missing uploads", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () => assert.fail("missing uploads must not be processed"),
    },
  });

  const response = await postBackgroundRemovalRequest(url, new FormDataCtor());

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects an unexpected multipart file field", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("unexpected file fields must not be processed"),
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "upload",
    new BlobCtor([Buffer.from("media data")], { type: "image/png" }),
    "person.png",
  );
  formData.append("mediaKind", "image");

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects duplicate multipart file fields", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("duplicate file fields must not be processed"),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });
  formData.append(
    "file",
    new BlobCtor([Buffer.from("second file")], { type: "image/png" }),
    "second.png",
  );

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects oversized multipart field values", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("oversized fields must not be processed"),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });
  formData.append("metadata", "x".repeat(1024 * 1024 + 1));

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects media kinds that do not match the uploaded mime type", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("mismatched media must not be processed"),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "video/mp4",
    name: "person.mp4",
    sourceStart: "0",
    duration: "0",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects non-finite video ranges before writing uploads", async (t) => {
  const url = await startTestServer(t, {
    writeFileImpl: async () =>
      assert.fail("invalid ranges must not write uploads"),
    backgroundRemovalProcessor: {
      process: async () => assert.fail("invalid ranges must not be processed"),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "video",
    mimetype: "video/mp4",
    name: "person.mp4",
    sourceStart: "-1",
    duration: "3",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal preserves processor failure messages and removes request temp files", async (t) => {
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-failure",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    backgroundRemovalProcessor: {
      process: async () => {
        throw new Error("General cutout model failed to initialize.");
      },
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "background_removal_failed",
      message: "General cutout model failed to initialize.",
    },
  });
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/background-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("background removal does not expose a source when the processor output is absent", async (t) => {
  let copied = false;
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-missing-output",
    writeFileImpl: async () => {},
    copyFileImpl: async () => {
      copied = true;
    },
    statFileImpl: async () => {
      throw new Error("ENOENT");
    },
    backgroundRemovalProcessor: {
      process: async () => ({
        outputPath: "C:/temp/background-missing-output/output/processed.png",
        extension: ".png",
        mimeType: "image/png",
      }),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 500);
  const result = await response.json();
  assert.equal(result.error.code, "background_removal_failed");
  assert.equal("src" in result, false);
  assert.equal(copied, false);
});

test("background removal removes a copied output when its final stat fails", async (t) => {
  const cleanupCalls = [];
  const copyCalls = [];
  let statCallCount = 0;
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-stored-stat-failure",
    mediaUploadDirectory: "C:/uploads",
    writeFileImpl: async () => {},
    copyFileImpl: async (_from, to) => copyCalls.push(to),
    statFileImpl: async () => {
      statCallCount += 1;
      if (statCallCount === 2) throw new Error("stored output is missing");
      return { isFile: () => true };
    },
    removeDirectoryImpl: async (filePath, options) => {
      cleanupCalls.push({ filePath, options });
    },
    backgroundRemovalProcessor: {
      process: async () => ({
        outputPath:
          "C:/temp/background-stored-stat-failure/output/processed.png",
        extension: ".png",
        mimeType: "image/png",
      }),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, "background_removal_failed");
  assert.equal(copyCalls.length, 1);
  assert.deepEqual(
    cleanupCalls.map(({ filePath, options }) => ({
      filePath: filePath.replaceAll("\\", "/"),
      options,
    })),
    [
      {
        filePath: copyCalls[0].replaceAll("\\", "/"),
        options: { force: true },
      },
      {
        filePath: "C:/temp/background-stored-stat-failure",
        options: { recursive: true, force: true },
      },
    ],
  );
});

test("background removal removes a copied output when the request aborts", async (t) => {
  const abortController = new AbortControllerCtor();
  const cleanupCalls = [];
  const copyCalls = [];
  let cleanupFinished;
  const cleanupFinishedPromise = new Promise((resolve) => {
    cleanupFinished = resolve;
  });
  let processorSignal = null;
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let statCallCount = 0;
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-stored-abort",
    mediaUploadDirectory: "C:/uploads",
    writeFileImpl: async () => {},
    copyFileImpl: async (_from, to) => copyCalls.push(to),
    statFileImpl: async () => {
      statCallCount += 1;
      if (statCallCount === 2) {
        abortController.abort();
        await signalAbortedPromise;
      }
      return { isFile: () => true };
    },
    removeDirectoryImpl: async (filePath, options) => {
      cleanupCalls.push({ filePath, options });
      if (
        filePath.replaceAll("\\", "/") === "C:/temp/background-stored-abort"
      ) {
        cleanupFinished();
      }
    },
    backgroundRemovalProcessor: {
      process: async ({ signal }) => {
        processorSignal = signal;
        signal.addEventListener("abort", signalAborted, { once: true });
        return {
          outputPath: "C:/temp/background-stored-abort/output/processed.png",
          extension: ".png",
          mimeType: "image/png",
        };
      },
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const request = postBackgroundRemovalRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);
  await Promise.all([request, cleanupFinishedPromise]);

  assert.equal(processorSignal?.aborted, true);
  assert.equal(copyCalls.length, 1);
  assert.equal(
    cleanupCalls.some(
      ({ filePath }) =>
        filePath.replaceAll("\\", "/") === copyCalls[0].replaceAll("\\", "/"),
    ),
    true,
  );
});

test("background removal removes a copied output when writing its response fails", async (t) => {
  const cleanupCalls = [];
  const copyCalls = [];
  const url = await startTestServer(t, {
    configureApp: (app) => {
      const sendJson = app.response.json;
      app.response.json = function responseJson(payload) {
        if (payload?.src) throw new Error("response write failed");
        return sendJson.call(this, payload);
      };
    },
    makeTempDirectory: async () => "C:/temp/background-response-failure",
    mediaUploadDirectory: "C:/uploads",
    writeFileImpl: async () => {},
    copyFileImpl: async (_from, to) => copyCalls.push(to),
    statFileImpl: async () => ({ isFile: () => true }),
    removeDirectoryImpl: async (filePath, options) => {
      cleanupCalls.push({ filePath, options });
    },
    backgroundRemovalProcessor: {
      process: async () => ({
        outputPath: "C:/temp/background-response-failure/output/processed.png",
        extension: ".png",
        mimeType: "image/png",
      }),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 500);
  assert.equal(copyCalls.length, 1);
  assert.equal(
    cleanupCalls.some(
      ({ filePath }) =>
        filePath.replaceAll("\\", "/") === copyCalls[0].replaceAll("\\", "/"),
    ),
    true,
  );
});

test("background removal aborts processing and cleans up when the request closes", async (t) => {
  let processingStarted;
  const processingStartedPromise = new Promise((resolve) => {
    processingStarted = resolve;
  });
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let cleanupFinished;
  const cleanupFinishedPromise = new Promise((resolve) => {
    cleanupFinished = resolve;
  });
  const cleanupCalls = [];
  let processorSignal = null;
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/background-abort",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
      cleanupFinished();
    },
    backgroundRemovalProcessor: {
      process: async ({ signal }) => {
        processorSignal = signal;
        signal.addEventListener("abort", signalAborted, { once: true });
        processingStarted();
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(
                new DOMExceptionCtor(
                  "The operation was aborted.",
                  "AbortError",
                ),
              ),
            { once: true },
          );
        });
      },
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });
  const abortController = new AbortControllerCtor();
  const requestPromise = postBackgroundRemovalRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);

  const requestState = await Promise.race([
    processingStartedPromise.then(() => "started"),
    requestPromise.then(() => "responded"),
  ]);
  assert.equal(requestState, "started");
  abortController.abort();
  await Promise.all([
    signalAbortedPromise,
    cleanupFinishedPromise,
    requestPromise,
  ]);

  assert.equal(processorSignal?.aborted, true);
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/background-abort",
      options: { recursive: true, force: true },
    },
  ]);
});

test("background removal reports its own multipart size limit message", async (t) => {
  const url = await startTestServer(t, {
    maxBackgroundRemovalFileSizeBytes: 4,
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "file_too_large",
      message: "Background-removal media must be 250 MB or smaller.",
    },
  });
});

test("background removal uses its dedicated limit instead of the transcript limit", async (t) => {
  const url = await startTestServer(t, {
    maxFileSizeBytes: 4,
    maxBackgroundRemovalFileSizeBytes: 1024,
    makeTempDirectory: async () => "C:/temp/background-dedicated-limit",
    writeFileImpl: async () => {},
    copyFileImpl: async () => {},
    statFileImpl: async () => ({ isFile: () => true }),
    backgroundRemovalProcessor: {
      process: async () => ({
        outputPath: "C:/temp/background-dedicated-limit/output/processed.png",
        extension: ".png",
        mimeType: "image/png",
      }),
    },
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await postBackgroundRemovalRequest(url, formData);

  assert.equal(response.status, 200);
});

test("background removal reports its multipart size limit message with query strings", async (t) => {
  const url = await startTestServer(t, {
    maxBackgroundRemovalFileSizeBytes: 4,
  });
  const formData = makeBackgroundRemovalFormData({
    mediaKind: "image",
    mimetype: "image/png",
    name: "person.png",
  });

  const response = await fetchImpl(`${url}/api/remove-background?retry=1`, {
    method: "POST",
    body: formData,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "file_too_large",
      message: "Background-removal media must be 250 MB or smaller.",
    },
  });
});

test("background removal rejects multipart requests without a boundary", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("malformed multipart must not be processed"),
    },
  });

  const response = await postRawBackgroundRemovalRequest(url, {
    body: "not a multipart body",
    headers: { "Content-Type": "multipart/form-data" },
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("background removal rejects truncated multipart requests", async (t) => {
  const url = await startTestServer(t, {
    backgroundRemovalProcessor: {
      process: async () =>
        assert.fail("truncated multipart must not be processed"),
    },
  });
  const boundary = "background-removal-test-boundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="person.png"',
    "Content-Type: image/png",
    "",
    "partial image bytes",
  ].join("\r\n");

  const response = await postRawBackgroundRemovalRequest(url, {
    body,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_background_removal_request",
  );
});

test("rejects missing silence detection uploads", async (t) => {
  const url = await startTestServer(t);

  const response = await postSilenceDetectionRequest(url, new FormDataCtor());

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "missing_file",
      message: "No media file was uploaded.",
    },
  });
});

test("rejects invalid silence detection trim ranges before writing uploads", async (t) => {
  const url = await startTestServer(t, {
    writeFileImpl: async () => {
      assert.fail("invalid trim ranges must not write uploaded media");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "3");
  formData.append("duration", "0");

  const response = await postSilenceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_trim_range",
      message:
        "Transcription trim range must include a finite nonnegative sourceStart and a positive bounded duration.",
    },
  });
});

test("aborts in-flight silence detection when the client closes the request", async (t) => {
  let serviceStarted;
  const serviceStartedPromise = new Promise((resolve) => {
    serviceStarted = resolve;
  });
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let serviceSignal = null;
  const url = await startTestServer(t, {
    detectSilenceInMediaImpl: async ({ signal }) => {
      serviceSignal = signal;
      signal.addEventListener("abort", signalAborted, { once: true });
      serviceStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new DOMExceptionCtor("The operation was aborted.", "AbortError"),
            ),
          { once: true },
        );
      });
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");
  const abortController = new AbortControllerCtor();
  const requestPromise = postSilenceDetectionRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);

  const serviceState = await Promise.race([
    serviceStartedPromise.then(() => "started"),
    requestPromise.then(() => "responded"),
  ]);
  assert.equal(serviceState, "started");
  abortController.abort();
  await signalAbortedPromise;
  await requestPromise;

  assert.equal(serviceSignal?.aborted, true);
});

test("removes the silence detection temp directory when the service fails", async (t) => {
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/silence-failure",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    detectSilenceInMediaImpl: async () => {
      throw new Error("analysis failed");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postSilenceDetectionRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "silence_detection_failed",
      message: "analysis failed",
    },
  });
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/silence-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("returns dominant voice ranges for the selected source range", async (t) => {
  const calls = [];
  const url = await startTestServer(t, {
    writeFileImpl: async () => {
      assert.fail(
        "dominant voice uploads must not be copied from a full memory buffer",
      );
    },
    detectDominantVoiceImpl: async (options) => {
      calls.push(options);
      return {
        ranges: [{ startSeconds: 0.5, endSeconds: 3 }],
        dominantSpeechSeconds: 2.5,
        analyzedSpeechSeconds: 4,
      };
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "2");
  formData.append("duration", "8");

  const response = await postDominantVoiceDetectionRequest(url, formData, {
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ranges: [{ startSeconds: 0.5, endSeconds: 3 }],
    dominantSpeechSeconds: 2.5,
    analyzedSpeechSeconds: 4,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceStartSeconds, 2);
  assert.equal(calls[0].durationSeconds, 8);
  assert.ok(calls[0].signal instanceof AbortSignalCtor);
});

test("rejects missing dominant voice uploads", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail("missing uploads must not reach dominant voice detection");
    },
  });

  const response = await postDominantVoiceDetectionRequest(
    url,
    new FormDataCtor(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_dominant_voice_request",
      message: "Select a valid video range.",
    },
  });
});

test("rejects non-video dominant voice uploads", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail("non-video uploads must not reach dominant voice detection");
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("audio data")], { type: "audio/mpeg" }),
    "clip.mp3",
  );
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_dominant_voice_request",
  );
});

test("rejects invalid dominant voice ranges before writing uploads", async (t) => {
  const url = await startTestServer(t, {
    writeFileImpl: async () => {
      assert.fail(
        "invalid dominant voice ranges must not write uploaded media",
      );
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "3");
  formData.append("duration", "0");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_dominant_voice_request",
      message: "Select a valid video range.",
    },
  });
});

test("rejects foreign origins before dominant voice detection", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail("foreign origins must not reach dominant voice detection");
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData, {
    headers: { Origin: "https://example.com" },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "forbidden_origin");
});

test("returns an unidentifiable dominant voice as a structured 422", async (t) => {
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/dominant-voice-not-found",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async () => {},
    detectDominantVoiceImpl: async () => {
      throw new Error("No candidate speech was found.");
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: {
      code: "dominant_voice_not_found",
      message: "A reliable main voice could not be identified.",
    },
  });
});

test("returns dominant voice processing failures and cleans up", async (t) => {
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    makeTempDirectory: async () => "C:/temp/dominant-voice-failure",
    writeFileImpl: async () => {},
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    detectDominantVoiceImpl: async () => {
      throw new Error("FFmpeg failed for C:/private/media/clip.mp4");
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "dominant_voice_detection_failed",
      message: "Dominant voice detection failed.",
    },
  });
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/dominant-voice-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("rejects duplicate dominant voice upload fields", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "invalid multipart uploads must not reach dominant voice detection",
      );
    },
  });
  const formData = makeVideoClipFormData();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("second video")], { type: "video/mp4" }),
    "second.mp4",
  );
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_dominant_voice_request",
      message: "Select a valid video range.",
    },
  });
});

test("rejects unexpected dominant voice upload fields", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "invalid multipart uploads must not reach dominant voice detection",
      );
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "media",
    new BlobCtor([Buffer.from("video data")], { type: "video/mp4" }),
    "clip.mp4",
  );
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_dominant_voice_request",
  );
});

test("rejects dominant voice multipart requests without a boundary", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "malformed multipart uploads must not reach dominant voice detection",
      );
    },
  });

  const response = await postRawDominantVoiceDetectionRequest(url, {
    body: "not a multipart body",
    headers: { "Content-Type": "multipart/form-data" },
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_dominant_voice_request",
  );
});

test("rejects truncated dominant voice multipart requests", async (t) => {
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "malformed multipart uploads must not reach dominant voice detection",
      );
    },
  });
  const boundary = "dominant-voice-test-boundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="clip.mp4"',
    "Content-Type: video/mp4",
    "",
    "partial video bytes",
  ].join("\r\n");

  const response = await postRawDominantVoiceDetectionRequest(url, {
    body,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error.code,
    "invalid_dominant_voice_request",
  );
});

test("aborts in-flight dominant voice detection when the client closes the request", async (t) => {
  let serviceStarted;
  const serviceStartedPromise = new Promise((resolve) => {
    serviceStarted = resolve;
  });
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let serviceSignal = null;
  const url = await startTestServer(t, {
    detectDominantVoiceImpl: async ({ signal }) => {
      serviceSignal = signal;
      signal.addEventListener("abort", signalAborted, { once: true });
      serviceStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new DOMExceptionCtor("The operation was aborted.", "AbortError"),
            ),
          { once: true },
        );
      });
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");
  const abortController = new AbortControllerCtor();
  const requestPromise = postDominantVoiceDetectionRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);

  const serviceState = await Promise.race([
    serviceStartedPromise.then(() => "started"),
    requestPromise.then(() => "responded"),
  ]);
  assert.equal(serviceState, "started");
  abortController.abort();
  await Promise.all([signalAbortedPromise, requestPromise]);

  assert.equal(serviceSignal?.aborted, true);
});

test("applies an independent upload limit to dominant voice detection", async (t) => {
  const url = await startTestServer(t, {
    maxDominantVoiceFileSizeBytes: 4,
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "oversized dominant voice uploads must be rejected before decode",
      );
    },
  });
  const formData = new FormDataCtor();
  formData.append(
    "file",
    new BlobCtor([Buffer.from("12345")], { type: "video/mp4" }),
    "clip.mp4",
  );
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "file_too_large",
      message: "Dominant-voice media must be 250 MB or smaller.",
    },
  });
});

test("does not inherit the smaller transcription upload limit", async (t) => {
  const url = await startTestServer(t, {
    maxFileSizeBytes: 4,
    detectDominantVoiceImpl: async () => ({
      ranges: [{ startSeconds: 0, endSeconds: 1 }],
      dominantSpeechSeconds: 1,
      analyzedSpeechSeconds: 1,
    }),
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 200);
});

test("rejects dominant voice durations above its dedicated limit before decode", async (t) => {
  const url = await startTestServer(t, {
    maxTrimDurationSeconds: 6 * 60 * 60,
    maxDominantVoiceDurationSeconds: 15 * 60,
    detectDominantVoiceImpl: async () => {
      assert.fail(
        "overlong dominant voice requests must be rejected before decode",
      );
    },
  });
  const formData = makeVideoClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", String(15 * 60 + 0.001));

  const response = await postDominantVoiceDetectionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_dominant_voice_request",
      message: "Keep main voice supports clips up to 15 minutes.",
    },
  });
});

test("returns a consistent 400 error when no file is uploaded", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
  });

  const response = await postTranscriptionRequest(url, new FormDataCtor());

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "missing_file",
      message: "No media file was uploaded.",
    },
  });
});

test("accepts allowed local browser origins and forwards validated trim range", async (t) => {
  const serviceCalls = [];
  const url = await startTestServer(t, {
    apiKey: "test-key",
    makeTempDirectory: async () => "C:/temp/route-trimmed",
    writeFileImpl: async () => {},
    transcribeMediaFileImpl: async (options) => {
      serviceCalls.push(options);
      return [{ startSeconds: 0.2, endSeconds: 1.1, text: "Local" }];
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "1.5");
  formData.append("duration", "4");

  const response = await postTranscriptionRequest(url, formData, {
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    segments: [{ startSeconds: 0.2, endSeconds: 1.1, text: "Local" }],
  });
  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].sourceStartSeconds, 1.5);
  assert.equal(serviceCalls[0].durationSeconds, 4);
});

test("rejects foreign browser origins with a structured 403 before transcription", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
    transcribeMediaFileImpl: async () => {
      assert.fail("foreign origins must not reach transcription");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postTranscriptionRequest(url, formData, {
    headers: { Origin: "https://example.com" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: {
      code: "forbidden_origin",
      message:
        "Caption transcription requests must come from the local editor.",
    },
  });
});

test("rejects non-local hosts with a structured 403 before transcription", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
    transcribeMediaFileImpl: async () => {
      assert.fail("foreign hosts must not reach transcription");
    },
  });
  const response = await postRawTranscriptionRequest(url, {
    headers: { Host: "evil.example" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.json(), {
    error: {
      code: "forbidden_host",
      message: "Caption transcription requests must target the local API.",
    },
  });
});

test("rejects invalid trim ranges before writing uploads", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
    writeFileImpl: async () => {
      assert.fail("invalid trim ranges must not write uploaded media");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "3");
  formData.append("duration", "0");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "invalid_trim_range",
      message:
        "Transcription trim range must include a finite nonnegative sourceStart and a positive bounded duration.",
    },
  });
});

test("aborts in-flight transcription when the client closes the request", async (t) => {
  let serviceStarted;
  const serviceStartedPromise = new Promise((resolve) => {
    serviceStarted = resolve;
  });
  let signalAborted;
  const signalAbortedPromise = new Promise((resolve) => {
    signalAborted = resolve;
  });
  let serviceSignal = null;
  const url = await startTestServer(t, {
    apiKey: "test-key",
    transcribeMediaFileImpl: async ({ signal }) => {
      serviceSignal = signal;
      signal.addEventListener("abort", signalAborted, { once: true });
      serviceStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              new DOMExceptionCtor("The operation was aborted.", "AbortError"),
            ),
          { once: true },
        );
      });
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");
  const abortController = new AbortControllerCtor();
  const requestPromise = postTranscriptionRequest(url, formData, {
    signal: abortController.signal,
  }).catch((error) => error);

  await serviceStartedPromise;
  abortController.abort();
  await signalAbortedPromise;
  await requestPromise;

  assert.equal(serviceSignal?.aborted, true);
});

test("transcribes locally when the OpenAI API key is missing", async (t) => {
  let localCalls = 0;
  const url = await startTestServer(t, {
    apiKey: "",
    makeTempDirectory: async () => "C:/temp/local-no-key",
    writeFileImpl: async () => {},
    transcribeMediaFileImpl: async () => {
      localCalls += 1;
      return [{ startSeconds: 0, endSeconds: 1, text: "Runs locally" }];
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    segments: [{ startSeconds: 0, endSeconds: 1, text: "Runs locally" }],
  });
  assert.equal(localCalls, 1);
});

test("returns file_too_large when the uploaded file exceeds the limit", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
    maxFileSizeBytes: 4,
  });
  const formData = new FormDataCtor();
  formData.append("file", new BlobCtor([Buffer.from("12345")]), "clip.mp4");
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "file_too_large",
      message: "Transcript media must be 2 GB or smaller.",
    },
  });
});

test("removes the temp directory when writing the upload fails before transcription begins", async (t) => {
  const cleanupCalls = [];
  const url = await startTestServer(t, {
    apiKey: "test-key",
    makeTempDirectory: async () => "C:/temp/route-write-failure",
    writeFileImpl: async () => {
      throw new Error("disk full");
    },
    removeDirectoryImpl: async (directory, options) => {
      cleanupCalls.push({ directory, options });
    },
    transcribeMediaFileImpl: async () => {
      assert.fail("transcribeMediaFileImpl should not run after write failure");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "transcription_failed",
      message: "disk full",
    },
  });
  assert.deepEqual(cleanupCalls, [
    {
      directory: "C:/temp/route-write-failure",
      options: { recursive: true, force: true },
    },
  ]);
});

test("preserves the route error when route-level cleanup also fails", async (t) => {
  const url = await startTestServer(t, {
    apiKey: "test-key",
    makeTempDirectory: async () => "C:/temp/route-cleanup-failure",
    writeFileImpl: async () => {
      throw new Error("disk full");
    },
    removeDirectoryImpl: async () => {
      throw new Error("cleanup failed");
    },
    transcribeMediaFileImpl: async () => {
      assert.fail("transcribeMediaFileImpl should not run after write failure");
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0");
  formData.append("duration", "1");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: {
      code: "transcription_failed",
      message: "disk full",
    },
  });
});

test("returns the normalized segments shape from an injected transcription service", async (t) => {
  const writes = [];
  const serviceCalls = [];
  const url = await startTestServer(t, {
    apiKey: "test-key",
    ffmpegBinaryPath: "ffmpeg-test",
    makeTempDirectory: async () => "C:/temp/route-success",
    writeFileImpl: async (filePath, contents) => {
      writes.push({ filePath, size: contents.length });
    },
    transcribeMediaFileImpl: async (options) => {
      serviceCalls.push(options);
      return [{ startSeconds: 0.25, endSeconds: 1.5, text: "Hello" }];
    },
  });
  const formData = makeClipFormData();
  formData.append("sourceStart", "0.75");
  formData.append("duration", "2.5");

  const response = await postTranscriptionRequest(url, formData);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    segments: [{ startSeconds: 0.25, endSeconds: 1.5, text: "Hello" }],
  });
  assert.equal(writes.length, 1);
  assert.match(writes[0].filePath, /route-success[\\/]input\.mp4$/);
  assert.equal(writes[0].size, 10);
  assert.equal(serviceCalls.length, 1);
  assert.match(serviceCalls[0].inputPath, /route-success[\\/]input\.mp4$/);
  assert.match(serviceCalls[0].outputPath, /route-success[\\/]output\.f32le$/);
  assert.equal(serviceCalls[0].tempDirectory, "C:/temp/route-success");
  assert.equal(serviceCalls[0].apiKey, "test-key");
  assert.equal(serviceCalls[0].ffmpegPath, "ffmpeg-test");
  assert.equal(serviceCalls[0].sourceStartSeconds, 0.75);
  assert.equal(serviceCalls[0].durationSeconds, 2.5);
});
