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

test("shows one vertical yellow insertion guide across the timeline", () => {
  assert.match(source, /const \[dropGuideFrame, setDropGuideFrame\]/);
  assert.match(source, /element\?\.closest\("\.timeline-content"\)/);
  assert.match(source, /className="timeline-drop-guide"/);
  assert.match(
    styles,
    /\.timeline-drop-guide\s*\{[^}]*top:\s*24px;[^}]*bottom:\s*0;[^}]*width:\s*2px;[^}]*background:\s*#facc15/s,
  );
});

test("clears the insertion guide after dropping", () => {
  const pointerUpStart = source.indexOf("const handlePointerUp");
  const pointerUpEnd = source.indexOf(
    'window.addEventListener("pointermove"',
    pointerUpStart,
  );
  const pointerUpHandler = source.slice(pointerUpStart, pointerUpEnd);

  assert.match(pointerUpHandler, /setDropGuideFrame\(null\)/);
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
  assert.match(
    source,
    /if \(!pointerDrag \|\| pointerDrag\.type === "media"\) return;/,
  );
  assert.match(source, /insertVideoPairOnLayerAtFrame\(/);
});
