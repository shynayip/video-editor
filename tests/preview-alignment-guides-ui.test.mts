import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("keeps the center cross visible while any preview object is moving", () => {
  assert.match(source, /const keepCenterGuidesVisible =/);
  assert.match(
    source,
    /adjustmentPanDrag !== null[\s\S]*?textPreviewDrag !== null[\s\S]*?captionPreviewDrag !== null[\s\S]*?stickerInteraction\?\.mode === "move"[\s\S]*?cutoutInteraction\?\.mode === "move"/,
  );
  assert.match(
    source,
    /renderPreviewAlignmentGuides\([\s\S]*?visiblePreviewAlignmentGuides/,
  );
});
