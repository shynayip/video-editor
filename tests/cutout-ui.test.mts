import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("renders eight compact resize handles for a selected cutout", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  for (const handle of [
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ]) {
    assert.match(source, new RegExp(`cutout-resize-handle-\\$\\{handle\\}`));
    assert.match(
      styles,
      new RegExp(`\\.cutout-resize-handle-${handle}(?:\\s|\\{)`),
    );
  }

  assert.match(source, /fixedControlScale/);
  assert.doesNotMatch(source, /className="cutout-scale-handle"/);
});

test("uses white cutout controls and disables browser video pop-out", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\.selected-preview-cutout\s*\{[^}]*outline:\s*2px solid #ffffff/s,
  );
  assert.match(
    styles,
    /\.cutout-resize-handle\s*\{[^}]*background:\s*#ffffff/s,
  );
  assert.match(source, /disablePictureInPicture/);
  assert.match(
    source,
    /controlsList="nodownload noplaybackrate nopictureinpicture"/,
  );
});
