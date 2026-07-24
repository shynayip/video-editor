import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("imported media keeps the exact grabbed point under the mouse", () => {
  assert.match(source, /grabOffsetX\?: number/);
  assert.match(source, /grabOffsetY\?: number/);
  assert.match(
    source,
    /grabOffsetX: event\.clientX - cardBounds\.left,[\s\S]*grabOffsetY: event\.clientY - cardBounds\.top/,
  );
  assert.match(
    source,
    /left: pointerDrag\.x - \(pointerDrag\.grabOffsetX \?\? 0\),[\s\S]*top: pointerDrag\.y - \(pointerDrag\.grabOffsetY \?\? 0\)/,
  );
  assert.doesNotMatch(styles, /\.drag-preview\s*\{[^}]*translate:\s*-50% -50%/s);
});

test("drag preview uses the real imported scene image", () => {
  assert.match(source, /previewSrc: mediaItem\.src/);
  assert.match(source, /className="drag-preview-media"/);
  assert.match(styles, /\.drag-preview-media\s*\{[^}]*object-fit:\s*cover;/s);
});

test("timeline clips follow the live pointer frame using their grab offset", () => {
  assert.match(
    source,
    /const timelinePointerDragTargetStart =[\s\S]*getDraggedClipStart\(\{[\s\S]*originalStart: pointerDrag\.originalStart[\s\S]*pointerStartX: pointerDrag\.pointerStartX[\s\S]*pointerDrag\.x[\s\S]*timelineScrollRef\.current\?\.scrollLeft[\s\S]*pixelsPerFrame: timelineScale/,
  );
  assert.match(
    source,
    /\(timelinePointerDragTargetStart \?\?[\s\S]*clip\.start\) \* timelineScale/,
  );
  assert.doesNotMatch(source, /getVideoClipDragPreviewStart\(/);
});

test("a single timeline clip uses a fixed preview attached to the mouse", () => {
  assert.match(
    source,
    /isSingleTimelinePointerDrag[\s\S]*pointerDrag\.timelineClipIds\?\.length \?\? 1/,
  );
  assert.match(
    source,
    /pointerDrag\.type === "media" \|\| isSingleTimelinePointerDrag/,
  );
  assert.match(source, /timeline-pointer-drag-preview/);
  assert.match(source, /floating-preview-source-clip/);
  assert.match(
    styles,
    /\.timeline-clip\.moving-timeline-clip\.floating-preview-source-clip\s*\{[^}]*opacity:\s*0;/s,
  );
  assert.match(
    styles,
    /\.drag-preview\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*5000;/s,
  );
});
