import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const composition = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("places the video rotation control above the frame with a downward connector", () => {
  assert.match(composition, /className="preview-video-rotate-handle"/);
  assert.match(styles, /\.preview-video-rotate-handle\s*\{[^}]*top:\s*-52px/s);
  assert.match(
    styles,
    /\.preview-video-rotate-handle::before\s*\{[^}]*top:\s*100%[^}]*height:\s*16px/s,
  );
});
