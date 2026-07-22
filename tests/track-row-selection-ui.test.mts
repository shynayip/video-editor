import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const composition = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("the exact selected video layer marks its whole timeline row", () => {
  assert.match(
    composition,
    /track\.videoLayer !== undefined && selectedVideoLayer === track\.videoLayer\s*\? "selected-timeline-row"/,
  );
});

test("a selected timeline row uses a yellow lane and label highlight", () => {
  assert.match(styles, /\.timeline-track\.selected-timeline-row\s*\{[^}]*rgba\(250, 204, 21,/s);
  assert.match(
    styles,
    /\.timeline-track\.selected-timeline-row \.track-label\s*\{[^}]*color: #facc15;/s,
  );
  assert.match(
    styles,
    /\.track-lane\.selected-track-lane\s*\{[^}]*border-color: #facc15;/s,
  );
});
