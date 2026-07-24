import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composition = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const editorLogic = readFileSync(
  new URL("../src/editorLogic.ts", import.meta.url),
  "utf8",
);

test("Delete and Backspace remove any selected timeline or preview clip", () => {
  const handlerStart = composition.indexOf("const handleDeleteShortcut");
  const handlerEnd = composition.indexOf(
    'window.addEventListener("keydown", handleDeleteShortcut)',
    handlerStart,
  );
  const handler = composition.slice(handlerStart, handlerEnd);

  assert.match(handler, /event\.key !== "Delete"/);
  assert.match(handler, /event\.key !== "Backspace"/);
  assert.match(handler, /selectedClipIdsRef\.current\.length === 0/);
  assert.match(handler, /selectedTimelineRowClipIdsRef\.current/);
  assert.match(handler, /deleteTimelineClips/);
  assert.doesNotMatch(handler, /activeToolRef\.current === "media"/);
  assert.match(handler, /setStickerInteraction\(null\)/);
  assert.match(handler, /setCutoutInteraction\(null\)/);
  assert.match(handler, /setTextPreviewDrag\(null\)/);
  assert.match(handler, /setCaptionPreviewDrag\(null\)/);
});

test("every populated timeline row exposes its own delete icon", () => {
  assert.match(composition, /className="track-delete-button"/);
  assert.match(
    composition,
    /aria-label=\{`Delete \$\{track\.label \|\| "track"\}`\}/,
  );
  assert.match(composition, /deleteTimelineRow\(track\)/);
});

test("deleting an audio-only row does not delete its linked video", () => {
  const helperStart = composition.indexOf("const deleteTimelineClips");
  const helperEnd = composition.indexOf(
    "useEffect(() =>",
    helperStart,
  );
  const helper = composition.slice(helperStart, helperEnd);

  assert.match(helper, /clip\.track !== "audio"/);
});

test("keyboard deletion protects fields while supporting every editor track", () => {
  assert.match(
    composition,
    /target\.closest\("input, textarea, select, \[contenteditable='true'\]"\)/,
  );

  for (const track of [
    "upper",
    "cutout",
    "sticker",
    "text",
    "main",
    "caption",
    "audio",
  ]) {
    assert.match(editorLogic, new RegExp(`\\| "${track}"`));
  }
});
