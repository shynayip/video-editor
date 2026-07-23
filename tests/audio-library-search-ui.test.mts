import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("audio searches hide category browsing and show only matching results", () => {
  assert.match(
    source,
    /const hasAudioLibrarySearch = audioLibraryQuery\.trim\(\)\.length > 0/,
  );
  assert.match(
    source,
    /\{!hasAudioLibrarySearch \? \([\s\S]*className="audio-search-chips"[\s\S]*className="audio-library-categories"[\s\S]*\) : null\}/,
  );
  assert.match(
    source,
    /const normalizedQuery = audioLibraryQuery\.trim\(\)\.toLowerCase\(\)/,
  );
});

test("centers the add-song symbol inside its fixed square control", () => {
  assert.match(
    css,
    /\.audio-add-button\s*\{[\s\S]*display: grid;[\s\S]*place-items: center;[\s\S]*box-sizing: border-box;/,
  );
});
