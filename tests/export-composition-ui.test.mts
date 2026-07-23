import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const exportSource = readFileSync(
  new URL("../src/ExportComposition.tsx", import.meta.url),
  "utf8",
);
const serverSource = readFileSync(
  new URL("../server/transcriptionServer.mjs", import.meta.url),
  "utf8",
);

test("exports the clean preview composition instead of the editor interface", () => {
  assert.match(compositionSource, /component=\{ExportComposition\}/);
  assert.doesNotMatch(
    exportSource,
    /editor-shell|timeline-panel|media-library/,
  );
  assert.match(exportSource, /ExportVideoClip/);
  assert.match(exportSource, /ExportCutoutClip/);
  assert.match(exportSource, /ExportCaptionClip/);
  assert.match(exportSource, /ExportStickerClip/);
  assert.match(exportSource, /ExportTextClip/);
  assert.match(exportSource, /ExportAudioClip/);
});

test("uses faster MP4 settings and identifies the downloaded file", () => {
  assert.match(serverSource, /scale:\s*renderScale/);
  assert.match(
    serverSource,
    /videoBitrate:\s*renderScale\s*===\s*1\s*\?\s*"8M"\s*:\s*"3M"/,
  );
  assert.match(serverSource, /imageFormat:\s*"jpeg"/);
  assert.match(
    serverSource,
    /jpegQuality:\s*renderScale\s*===\s*1\s*\?\s*85\s*:\s*70/,
  );
  assert.match(
    serverSource,
    /everyNthFrame:\s*renderScale\s*===\s*1\s*\?\s*1\s*:\s*2/,
  );
  assert.match(serverSource, /hardwareAcceleration:\s*"disable"/);
  assert.match(serverSource, /argument === "libx264" \? "h264_amf"/);
  assert.match(serverSource, /"-quality",\s*"speed"/);
  assert.match(serverSource, /const getRenderBrowser/);
  assert.match(serverSource, /puppeteerInstance/);
  assert.doesNotMatch(serverSource, /x264Preset:/);
  assert.match(serverSource, /Math\.min\(12, availableParallelism\(\) - 2\)/);
  assert.match(serverSource, /const getAdaptiveRenderConcurrency/);
  assert.match(serverSource, /const createExportComposition/);
  assert.doesNotMatch(serverSource, /selectCompositionImpl/);
  assert.match(serverSource, /warmRenderResources/);
  assert.match(compositionSource, /Rendering preview video/);
  assert.match(compositionSource, /Check your Downloads folder/);
  assert.match(compositionSource, /exportFileName/);
});

test("only mounts visual clips that are active on the rendered frame", () => {
  assert.match(exportSource, /const isClipActiveAtFrame/);
  assert.match(
    exportSource,
    /clip\.src\s*&&\s*!clip\.hidden\s*&&\s*isClipActiveAtFrame\(clip, frame\)/,
  );
  assert.match(
    exportSource,
    /clip\.track === "cutout" && isClipActiveAtFrame\(clip, frame\)/,
  );
});

test("reports real Remotion export progress instead of a simulated 95 percent", () => {
  assert.match(serverSource, /onProgress:\s*\(\{ progress \}\)/);
  assert.match(serverSource, /\/api\/export\/status\/:jobId/);
  assert.match(compositionSource, /export\/status\/\$\{exportJobId\}/);
  assert.match(compositionSource, /jobId: exportJobId/);
  assert.doesNotMatch(compositionSource, /exportProgressTimer/);
  assert.doesNotMatch(compositionSource, /exportProgress\s*=\s*1/);
});
