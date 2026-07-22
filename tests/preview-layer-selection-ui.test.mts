import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const compositionSource = await readFile(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const stylesheetSource = await readFile(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("keeps selected video controls on their video layer", () => {
  assert.match(
    compositionSource,
    /className="preview-video-transform-shell"[\s\S]*?zIndex:\s*getPreviewVideoLayerZIndex\(selectedClip\)/,
  );
  assert.doesNotMatch(
    stylesheetSource,
    /\.preview-video-transform-shell\s*\{[^}]*z-index:\s*145/s,
  );
});

test("keeps cutouts above ordinary video layers and pointer-selectable", () => {
  assert.match(compositionSource, /zIndex:\s*20\s*\+\s*cutoutIndex/);
  assert.match(
    compositionSource,
    /className={`preview-cutout[\s\S]*?onPointerDown=\{\(event\)\s*=>\s*\{[\s\S]*?startCutoutInteraction/s,
  );
});
