import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("scrolling over the timeline zoom control changes its scale", () => {
  assert.match(
    compositionSource,
    /className="timeline-zoom-controls"[\s\S]*onWheel=\{\(event\) => \{[\s\S]*zoomTimelineBy\(/,
  );
});

test("touchpad pinch or Ctrl+wheel zooms the timeline around the pointer", () => {
  assert.match(
    compositionSource,
    /className="timeline-scroll"[\s\S]*if \(!event\.ctrlKey && !event\.metaKey\) return;[\s\S]*event\.clientX/,
  );
  assert.match(
    compositionSource,
    /const frameAtAnchor[\s\S]*timelineOrigin \+ frameAtAnchor \* nextScale - anchorOffset/,
  );
});
