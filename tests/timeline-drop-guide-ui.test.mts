import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("uses only the red playhead without a second yellow insertion guide", () => {
  assert.doesNotMatch(source, /dropGuideFrame|setDropGuideFrame/);
  assert.doesNotMatch(source, /className="timeline-drop-guide"/);
  assert.doesNotMatch(styles, /\.timeline-drop-guide/);
});

test("adds imported media instead of replacing an existing main clip", () => {
  assert.doesNotMatch(source, /data-replace-clip-id/);
  assert.doesNotMatch(source, /replaceTargetClipId/);
  assert.match(
    source,
    /placeMediaOnVideoLayer\(mediaItem, targetVideoLayer, pointerFrame\)/,
  );
});

test("recognizes compatible named tracks and rejects missing video layers", () => {
  assert.match(source, /if \(videoLayerElement\)/);
  assert.match(source, /return \{ kind: "track", track \}/);
  assert.match(
    source,
    /placeMediaOnTimelineTrack\(mediaItem, target\.track, pointerFrame\)/,
  );
  assert.match(source, /createBackgroundMusicClip\(\{/);
  assert.match(source, /createCutoutVideoPair\(\{/);
  assert.match(source, /createStickerClip\(\{/);
});

test("media drags keep the visible timeline position stable", () => {
  assert.match(source, /if \(!pointerDrag\) return;/);
  assert.match(source, /insertVideoPairOnLayerAtFrame\(/);
});

test("offers a persistent video insertion gap around every timeline row", () => {
  assert.match(source, /data-video-row-order=\{rowGapOrder\}/);
  assert.match(source, /data-video-row-direction=\{rowGapDirection\}/);
  assert.match(source, /timelineRowOrder: target\.rowOrder/);
  assert.match(source, /return rows\.sort\(\(left, right\) => right\.order - left\.order\)/);
});
