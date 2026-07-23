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

test("audio searches and category filters hide browsing cards", () => {
  assert.match(
    source,
    /const hasAudioLibrarySearch = audioLibraryQuery\.trim\(\)\.length > 0/,
  );
  assert.match(
    source,
    /\{!hasAudioLibrarySearch && !audioLibraryCategory \? \([\s\S]*className="audio-search-chips"[\s\S]*className="audio-library-categories"[\s\S]*\) : null\}/,
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

test("opens the audio category filter and applies the selected category", () => {
  assert.match(
    source,
    /aria-label="Filter audio by category"[\s\S]*aria-expanded=\{showAudioLibraryFilterMenu\}/,
  );
  assert.match(
    source,
    /className="audio-filter-menu"[\s\S]*All categories[\s\S]*audioLibraryCategories\.map/,
  );
  assert.match(
    source,
    /setAudioLibraryCategory\(category\);[\s\S]*setShowAudioLibraryFilterMenu\(false\)/,
  );
  assert.match(
    css,
    /\.audio-filter-menu\s*\{[\s\S]*position: absolute;[\s\S]*max-height: 260px;/,
  );
});
