import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composition = fs.readFileSync("src/Composition.tsx", "utf8");
const css = fs.readFileSync("src/index.css", "utf8");

test("cutout media and selection box share the animated transform", () => {
  assert.match(
    composition,
    /className="preview-cutout-visual"[\s\S]*?className="preview-cutout-media"[\s\S]*?className="cutout-control-box"/,
  );
  assert.match(
    composition,
    /className="preview-cutout-visual"[\s\S]*?style=\{cutoutVisualTransformStyle\}/,
  );
  assert.match(
    css,
    /\.preview-cutout-visual\s*\{[\s\S]*?position:\s*relative;/,
  );
});

test("effect transforms are not applied to the media alone", () => {
  const mediaStyle = composition.match(
    /const cutoutMediaStyle: CSSProperties = \{([\s\S]*?)\n\s*\};/,
  )?.[1];

  assert.ok(mediaStyle);
  assert.doesNotMatch(mediaStyle, /\btranslate:/);
  assert.doesNotMatch(mediaStyle, /\bscale:/);
  assert.doesNotMatch(mediaStyle, /\brotate:/);
});

test("selection box always covers the complete cutout canvas", () => {
  assert.match(
    composition,
    /const controlBoxStyle: CSSProperties = \{\s*inset: 0,\s*\};/,
  );
  assert.doesNotMatch(composition, /rememberCutoutVisualBounds/);
  assert.doesNotMatch(composition, /getFallbackCutoutVisualBounds/);
});
