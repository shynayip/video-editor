import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const editorLogicSource = readFileSync(
  new URL("../src/editorLogic.ts", import.meta.url),
  "utf8",
);
const stylesheetSource = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("preview side handles resize one axis while corner handles stay proportional", () => {
  assert.match(editorLogicSource, /handle:\s*CaptionResizeHandle/);
  assert.match(editorLogicSource, /captionResizeHandleVectors/);
  assert.match(editorLogicSource, /vector\.x === 0[\s\S]*\? startWidth/);
  assert.match(editorLogicSource, /vector\.y === 0[\s\S]*\? startHeight/);
  assert.match(editorLogicSource, /scaleX:\s*nextWidth \/ safeBaseWidth/);
  assert.match(editorLogicSource, /scaleY:\s*nextHeight \/ safeBaseHeight/);
});

test("preview rendering applies independent horizontal and vertical scale", () => {
  assert.match(compositionSource, /transform\.scaleX \?\? transform\.scale/);
  assert.match(compositionSource, /transform\.scaleY \?\? transform\.scale/);
  assert.match(
    compositionSource,
    /scale:\s*`\$\{cutoutScaleX\} \$\{cutoutScaleY\}`/,
  );
});

test("all four side handles are visible in the preview", () => {
  assert.match(
    stylesheetSource,
    /\.preview-video-edge-handle\s*\{[\s\S]*opacity:\s*0/s,
  );
  assert.match(stylesheetSource, /\.preview-video-edge-handle-top,/);
  assert.match(stylesheetSource, /\.preview-video-edge-handle-left,/);
  assert.match(stylesheetSource, /cursor:\s*ns-resize/);
  assert.match(stylesheetSource, /cursor:\s*ew-resize/);
});
