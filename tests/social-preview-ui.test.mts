import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("renders a dedicated preview transport below the video", () => {
  assert.match(source, /className="preview-control-dock"/);
  assert.match(source, /onClick=\{\s*previewMode === "media"/);
  assert.match(source, /aria-label="Seek preview"/);
  assert.match(source, /togglePreviewDockMute/);
  assert.match(
    css,
    /\.preview-shell\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*54px/s,
  );
});

test("offers social preview platforms and safe-area guides", () => {
  assert.match(source, /TikTok/);
  assert.match(source, /YouTube Shorts/);
  assert.match(source, /Instagram Reels/);
  assert.match(source, /className="social-preview-safe-area"/);
  assert.match(css, /\.social-preview-guides-tiktok/);
  assert.match(css, /\.social-preview-guides-youtube-shorts/);
  assert.match(css, /\.social-preview-guides-instagram-reels/);
});
