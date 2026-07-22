import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

test("a timeline video resyncs to the yellow preview frame after loading", () => {
  assert.match(
    source,
    /onLoadedMetadata=\{\(event\) => \{[\s\S]*?loadedPreviewFrame[\s\S]*?timelinePreviewFrame[\s\S]*?getClipSourceTime\([\s\S]*?loadedPreviewFrame[\s\S]*?event\.currentTarget\.currentTime =\s*loadedPreviewTime/,
  );
});

test("starting a timeline selection does not clear the pinned preview frame", () => {
  const selectionStart = source.slice(
    source.indexOf("const startTimelineSelection"),
    source.indexOf("const updateTimelineSelection"),
  );
  assert.doesNotMatch(selectionStart, /setTimelineHoverFrame\(null\)/);
});
