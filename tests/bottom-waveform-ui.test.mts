import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("anchors timeline waveform bars to the bottom edge", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /const baselineY = 19/);
  assert.match(source, /y1=\{baselineY - height\}/);
  assert.match(source, /y2=\{baselineY\}/);
  assert.doesNotMatch(source, /y1=\{centerY - height \/ 2\}/);
  assert.match(
    css,
    /\.audio-waveform-line\s*\{[^}]*stroke-linecap:\s*butt/s,
  );
});
