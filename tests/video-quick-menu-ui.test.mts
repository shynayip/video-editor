import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composition = fs.readFileSync("src/Composition.tsx", "utf8");

test("empty preview space clears video controls instead of selecting the top video", () => {
  const previewHandler = composition.match(
    /className="preview-window"[\s\S]*?onPointerDown=\{\(event\) => \{([\s\S]*?)\n\s*\}\}\n\s*onMouseLeave/,
  )?.[1];

  assert.ok(previewHandler);
  assert.match(previewHandler, /setVideoQuickMenu\(null\)/);
  assert.match(previewHandler, /clearEditorSelection\(\)/);
  assert.match(previewHandler, /setSelectedPreviewFrameBase\(null\)/);
  assert.doesNotMatch(previewHandler, /topVideoClip/);
  assert.doesNotMatch(previewHandler, /showPreviewVideoControls/);
});

test("video controls open from the visible media element", () => {
  assert.match(
    composition,
    /onClick=\{\(event\) =>\s*showPreviewVideoControls\(/,
  );
  assert.match(
    composition,
    /onPointerDown=\{\(event\) => \{\s*event\.stopPropagation\(\)/,
  );
  assert.match(
    composition,
    /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/,
  );
});
