import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("centers timeline waveform bars around a baseline", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /const centerY = 10/);
  assert.match(source, /y1=\{centerY - height\}/);
  assert.match(source, /y2=\{centerY \+ height\}/);
  assert.match(css, /\.audio-waveform-line\s*\{[^}]*stroke-linecap:\s*round/s);
});
