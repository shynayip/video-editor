import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const composition = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("preview text has a larger invisible pointer target", () => {
  assert.match(css, /\.preview-text-overlay::before\s*\{/);
  assert.match(css, /\.preview-text-overlay::before\s*\{[\s\S]*inset:\s*-14px/);
  assert.match(css, /\.preview-text-overlay::before\s*\{[\s\S]*cursor:\s*grab/);
  assert.match(css, /\.preview-text-content\s*\{[\s\S]*pointer-events:\s*none/);
});

test("text handles remain above the expanded hit area", () => {
  assert.match(css, /\.text-resize-handle\s*\{[\s\S]*z-index:\s*3/);
  assert.match(css, /\.text-rotate-handle\s*\{[\s\S]*z-index:\s*4/);
  assert.match(css, /\.text-resize-handle\s*\{[\s\S]*background:\s*#fff/);
  assert.match(css, /\.text-rotate-handle\s*\{[\s\S]*background:\s*#fff/);
  assert.match(
    css,
    /\.text-rotate-handle::before\s*\{[\s\S]*background:\s*#fff/,
  );
});

test("pointer down on preview text selects before dragging", () => {
  const handlerStart = composition.indexOf("const startTextPreviewDrag");
  const handlerEnd = composition.indexOf(
    "const startCaptionPreviewDrag",
    handlerStart,
  );
  const handler = composition.slice(handlerStart, handlerEnd);

  assert.match(handler, /selectTimelineClip\(clip\)/);
  assert.match(handler, /setTextPreviewDrag\(\{/);
});
