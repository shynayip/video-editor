import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composition = fs.readFileSync("src/Composition.tsx", "utf8");

test("separate adjustment navigation is removed", () => {
  assert.doesNotMatch(composition, />\s*Adjustment\s*</);
  assert.doesNotMatch(composition, /openVisualTool\("adjustment"\)/);
});

test("video crop remains available from the quick toolbar", () => {
  assert.match(composition, /aria-label="Crop video"/);
  assert.match(composition, /openTimelineClipCropEditor\(clip\)/);
});
