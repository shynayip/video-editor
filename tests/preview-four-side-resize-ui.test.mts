import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const stylesheetSource = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("preview side handles resize one axis while corner handles stay proportional", () => {
  assert.match(compositionSource, /handle: CaptionResizeHandle/);
  assert.match(
    compositionSource,
    /dragState\.handle === "left" \|\| dragState\.handle === "right"/,
  );
  assert.match(compositionSource, /scaleX:[\s\S]*startDistanceX/);
  assert.match(
    compositionSource,
    /dragState\.handle === "top" \|\| dragState\.handle === "bottom"/,
  );
  assert.match(compositionSource, /scaleY:[\s\S]*startDistanceY/);
  assert.match(compositionSource, /scale:[\s\S]*startDistance/);
});

test("preview rendering applies independent horizontal and vertical scale", () => {
  assert.match(
    compositionSource,
    /adjustment\.scale \* \(adjustment\.scaleX \?\? 1\)[\s\S]*flipHorizontal/,
  );
  assert.match(
    compositionSource,
    /adjustment\.scale \* \(adjustment\.scaleY \?\? 1\)[\s\S]*flipVertical/,
  );
});

test("all four side handles are visible in the preview", () => {
  assert.match(stylesheetSource, /\.preview-video-edge-handle::after/);
  assert.match(stylesheetSource, /width: 28px;[\s\S]*height: 8px/);
  assert.match(stylesheetSource, /width: 8px;[\s\S]*height: 28px/);
});
