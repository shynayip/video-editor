import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("keeps a mouse multi-selection together while dragging with a modifier", () => {
  assert.match(source, /toggleSelectionOnClick\?: boolean/);
  assert.match(source, /timelineClipIds: \[\.\.\.timelineClipIds\]/);
  assert.match(
    source,
    /startPointerDrag\([\s\S]*?selectedGroup,[\s\S]*?isAdditiveSelection/,
  );
  assert.match(
    source,
    /pointerDrag\.toggleSelectionOnClick[\s\S]*?toggleTimelineClipSelection\(clickedClip\)/,
  );
});

test("synchronizes the selection ref when a single clip is selected", () => {
  assert.match(source, /selectedClipIdsRef\.current = \[clip\.id\]/);
});
