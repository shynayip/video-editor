import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanVoiceAudio,
  voiceCleanupFilter,
} from "../server/voiceAudioCleanup.mjs";

test("cleans speech audio while keeping synchronized video output", async () => {
  const calls = [];
  const result = await cleanVoiceAudio({
    inputPath: "C:/media/input.mp4",
    outputPath: "C:/media/cleaned.mp4",
    ffmpegPath: "ffmpeg-custom",
    signal: undefined,
    execFileImpl: async (file, args, options) => {
      calls.push({file, args, options});
    },
  });

  assert.deepEqual(result, {
    outputPath: "C:/media/cleaned.mp4",
    extension: ".mp4",
    mimeType: "video/mp4",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "ffmpeg-custom");
  assert.ok(calls[0].args.includes("0:v:0"));
  assert.ok(calls[0].args.includes("0:a:0"));
  assert.equal(calls[0].args[calls[0].args.indexOf("-af") + 1], voiceCleanupFilter);
});
