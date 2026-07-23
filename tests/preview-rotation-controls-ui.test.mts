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
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("stickers expose a visible drag-to-rotate control", () => {
  assert.match(composition, /aria-label="Rotate sticker"/);
  assert.match(composition, /startStickerInteraction\([\s\S]*?"rotate"/);
  assert.match(
    css,
    /\.sticker-resize-handle,\s*\.sticker-rotate-handle\s*\{[^}]*background:\s*#fff/s,
  );
  assert.match(css, /\.sticker-rotate-handle\s*\{[^}]*cursor:\s*grab/s);
});

test("captions store rotation and expose a drag-to-rotate control", () => {
  const captionStyle = editorLogic.slice(
    editorLogic.indexOf("export type CaptionStyle"),
    editorLogic.indexOf("export type CaptionAnimationPreset"),
  );

  assert.match(captionStyle, /rotation\?: number/);
  assert.match(editorLogic, /defaultCaptionStyle[\s\S]*rotation:\s*0/);
  assert.match(composition, /const startCaptionRotateDrag =/);
  assert.match(composition, /aria-label="Rotate caption"/);
  assert.match(composition, /rotate:\s*`\$\{caption\.rotation \?\? 0\}deg`/);
  assert.match(
    css,
    /\.caption-rotate-handle\s*\{[^}]*background:\s*#fff[^}]*cursor:\s*grab/s,
  );
});
