import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composition = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

<<<<<<< Updated upstream
test("places the video rotation control above the frame with a downward connector", () => {
  assert.match(composition, /className="preview-video-rotate-handle"/);
  assert.match(
    styles,
    /\.preview-video-transform-frame\s*\{[^}]*border:\s*2px solid #fff/s,
  );
  assert.match(styles, /\.preview-video-rotate-handle\s*\{[^}]*top:\s*-52px/s);
=======
test("places the video rotation control above the frame when space is available", () => {
  assert.match(
    composition,
    /className="preview-video-rotate-handle preview-video-rotate-handle-above"/,
  );
  assert.match(styles, /\.preview-video-rotate-handle\s*\{[^}]*top:\s*10px/s);
  assert.match(
    styles,
    /\.preview-video-rotate-handle-above\s*\{[^}]*top:\s*-52px/s,
  );
>>>>>>> Stashed changes
  assert.match(
    styles,
    /\.preview-video-rotate-handle::before\s*\{[^}]*top:\s*100%[^}]*height:\s*16px[^}]*background:\s*#fff/s,
  );
  assert.match(
    styles,
    /\.preview-video-transform-frame\s*\{[^}]*border:\s*2px solid #fff/s,
  );
  assert.match(
    styles,
    /\.preview-video-rotate-handle::before\s*\{[^}]*background:\s*#fff/s,
  );
});
