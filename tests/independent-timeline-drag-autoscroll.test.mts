import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

test("independent timeline objects continuously auto-scroll in both directions", () => {
  const textDragEffect = source.slice(
    source.indexOf("if (!textTimelineDrag) return"),
    source.indexOf("if (!cutoutTimelineDrag) return"),
  );
  const cutoutDragEffect = source.slice(
    source.indexOf("if (!cutoutTimelineDrag) return"),
    source.indexOf("if (!textPreviewDrag) return"),
  );

  for (const dragEffect of [textDragEffect, cutoutDragEffect]) {
    assert.match(dragEffect, /pointerPosition\.x[\s\S]*?laneViewportLeft[\s\S]*?bounds\.right/);
    assert.match(dragEffect, /pointerPosition\.y[\s\S]*?bounds\.top[\s\S]*?bounds\.bottom/);
    assert.match(dragEffect, /scrollArea\.scrollLeft \+= horizontalDelta/);
    assert.match(dragEffect, /scrollArea\.scrollTop \+= verticalDelta/);
    assert.match(dragEffect, /requestAnimationFrame\(scrollWhileDragging\)/);
  }
});
