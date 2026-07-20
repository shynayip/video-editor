import assert from "node:assert/strict";
import test from "node:test";

import {detectVideoScenes} from "../src/sceneDetectionClient.ts";

const videoFile = new File(["video"], "clip.mp4", {type: "video/mp4"});

test("posts a video and accepts contiguous scene ranges", async () => {
  const ranges = await detectVideoScenes(videoFile, async (url, options) => {
    assert.equal(url, "/api/detect-scenes");
    assert.equal(options?.method, "POST");
    assert.ok(options?.body instanceof FormData);
    return new Response(JSON.stringify({
      scenes: [
        {startSeconds: 0, endSeconds: 2},
        {startSeconds: 2, endSeconds: 5},
      ],
    }), {
      status: 200,
      headers: {"content-type": "application/json"},
    });
  });

  assert.deepEqual(ranges, [
    {startSeconds: 0, endSeconds: 2},
    {startSeconds: 2, endSeconds: 5},
  ]);
});

test("rejects malformed and noncontiguous detector responses", async () => {
  await assert.rejects(() => detectVideoScenes(videoFile, async () =>
    new Response(JSON.stringify({scenes: [{startSeconds: 3, endSeconds: 1}]})),
  ), /invalid scene/i);
  await assert.rejects(() => detectVideoScenes(videoFile, async () =>
    new Response(JSON.stringify({
      scenes: [
        {startSeconds: 0, endSeconds: 2},
        {startSeconds: 3, endSeconds: 5},
      ],
    })),
  ), /invalid scene/i);
});

test("rejects a failed scene detection response", async () => {
  await assert.rejects(() => detectVideoScenes(videoFile, async () =>
    new Response("failed", {status: 500}),
  ), /scene detection failed/i);
});
