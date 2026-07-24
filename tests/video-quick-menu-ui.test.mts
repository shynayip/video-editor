import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composition = fs.readFileSync("src/Composition.tsx", "utf8");

test("empty preview space clears video controls instead of selecting the top video", () => {
  const previewStart = composition.indexOf('className="preview-window"');
  const previewEnd = composition.indexOf(
    "onMouseLeave={closeMediaPreviewVolumeIfInactive}",
    previewStart,
  );
  const previewHandler = composition.slice(previewStart, previewEnd);

  assert.notEqual(previewStart, -1);
  assert.notEqual(previewEnd, -1);
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

test("video quick actions stay open while the same video remains selected", () => {
  const functionBody = (startMarker: string, endMarker: string) => {
    const start = composition.indexOf(startMarker);
    const end = composition.indexOf(endMarker, start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    return composition.slice(start, end);
  };

  for (const body of [
    functionBody(
      "const openTimelineClipCropEditor",
      "const closeMediaTrimEditor",
    ),
    functionBody(
      "const fitTimelineClipToScreen",
      "const chooseReplacementVideo",
    ),
    functionBody(
      "const chooseReplacementVideo",
      "const replaceSelectedVideoFromGallery",
    ),
    functionBody(
      "const moveVideoToOverlayFromMenu",
      "const importNewOverlayFromMenu",
    ),
    functionBody(
      "const importNewOverlayFromMenu",
      "const startManualCrop",
    ),
  ]) {
    assert.doesNotMatch(body, /setVideoQuickMenu\(null\)/);
  }

  assert.match(
    composition,
    /aria-label="Video quick actions"[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
});
