import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  movePreviewTransform,
  snapPreviewOffsetToCenter,
  snapPreviewPositionToCenter,
} from "../src/editorLogic.ts";

test("snaps preview objects to the horizontal and vertical center guides", () => {
  assert.deepEqual(snapPreviewPositionToCenter({ x: 49, y: 51 }), {
    x: 50,
    y: 50,
    guides: {
      horizontal: true,
      vertical: true,
      horizontalPositions: [50],
      verticalPositions: [50],
    },
  });
  assert.deepEqual(snapPreviewPositionToCenter({ x: 42, y: 51 }), {
    x: 42,
    y: 50,
    guides: {
      horizontal: true,
      vertical: false,
      horizontalPositions: [50],
      verticalPositions: [],
    },
  });
});

test("snaps moved video and image offsets to the canvas center", () => {
  assert.deepEqual(snapPreviewOffsetToCenter({ x: 1, y: -1 }), {
    x: 0,
    y: 0,
    guides: {
      horizontal: true,
      vertical: true,
      horizontalPositions: [50],
      verticalPositions: [50],
    },
  });
});

test("moving an object preserves all size and rotation properties", () => {
  const original = {
    x: 20,
    y: 30,
    scale: 1.6,
    scaleX: 1.2,
    scaleY: 0.8,
    rotation: 24,
  };

  assert.deepEqual(movePreviewTransform(original, { x: 60, y: 45 }), {
    ...original,
    x: 60,
    y: 45,
  });
});

test("renders non-interactive center alignment guides during preview moves", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /renderPreviewAlignmentGuides\(previewAlignmentGuides\)/);
  assert.match(source, /preview-alignment-guide-horizontal/);
  assert.match(source, /preview-alignment-guide-vertical/);
  assert.match(
    css,
    /\.preview-alignment-guides\s*\{[^}]*pointer-events:\s*none/s,
  );
  assert.match(
    css,
    /\.preview-alignment-guide-vertical\s*\{[^}]*background:\s*var\(--theme-yellow\)/s,
  );
  assert.match(
    css,
    /\.preview-alignment-guide-horizontal\s*\{[^}]*background:\s*var\(--theme-yellow\)/s,
  );
});
