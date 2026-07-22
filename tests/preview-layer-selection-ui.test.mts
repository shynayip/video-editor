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

test("keeps selected video controls below clickable overlays", () => {
  assert.match(
    stylesheetSource,
    /\.preview-video-transform-shell\s*\{[^}]*z-index:\s*10/s,
  );
  assert.match(compositionSource, /zIndex:\s*24\s*\+\s*captionIndex/);
  assert.match(compositionSource, /zIndex:\s*30\s*\+\s*stickerIndex/);
  assert.match(compositionSource, /zIndex:\s*50\s*\+\s*textIndex/);
});

test("keeps cutouts above ordinary video layers and pointer-selectable", () => {
  assert.match(compositionSource, /zIndex:\s*20\s*\+\s*cutoutIndex/);
  assert.match(
    compositionSource,
    /className={`preview-cutout[\s\S]*?onPointerDown=\{\(event\)\s*=>\s*\{[\s\S]*?startCutoutInteraction/s,
  );
});
