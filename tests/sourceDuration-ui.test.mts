import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("passes the native source duration from import to timeline clips", () => {
  assert.match(
    source,
    /createSceneMediaItems\(\{[\s\S]*?sourceDurationInFrames:\s*durationInFrames/,
  );
  assert.match(
    source,
    /createVideoMediaPair\(\{[\s\S]*?sourceDuration:\s*mediaItem\.sourceDurationInFrames/,
  );
});

test("repairs saved timeline clips when video metadata becomes available", () => {
  assert.match(
    source,
    /onLoadedMetadata=\{\(event\)\s*=>\s*reconcileTimelineClipSourceDuration\(videoClip,\s*event\)\}/,
  );
});

test("checks every persisted upload before later clips reach the playhead", () => {
  assert.match(
    source,
    /fetch\(resolveMediaSource\(clip\.src\),\s*\{method:\s*"HEAD"\}\)/,
  );
  assert.match(
    source,
    /if\s*\(!isPlayableMediaResponse\(response\)\s*&&\s*!cancelled\)\s*\{\s*void recoverUnavailableVideo\(clip\.id\)/,
  );
});

test("repairs a later clip when its mounted timeline thumbnail cannot load", () => {
  assert.match(
    source,
    /className="timeline-clip-video"[\s\S]*?onError=\{\(\)\s*=>\s*recoverUnavailableVideo\(clip\.id\)\}/,
  );
});

test("keeps timeline videos mounted and preloaded across clip transitions", () => {
  assert.match(
    source,
    /timelinePreviewVideoClips\.map\(\(videoClip\)\s*=>/,
  );
  assert.match(source, /preload="auto"/);
  assert.match(
    source,
    /visibility:\s*isActiveVideoClip\s*\?\s*"visible"\s*:\s*"hidden"/,
  );
  assert.match(
    source,
    /isPreviewPlaying\s*&&\s*isActiveVideoClip/,
  );
});
