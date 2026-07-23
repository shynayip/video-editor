import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("keeps a mouse multi-selection together while holding a modifier", () => {
  assert.match(source, /toggleSelectionOnClick\?: boolean/);
  assert.match(source, /timelineClipIds: \[\.\.\.timelineClipIds\]/);
  assert.match(
    source,
    /startPointerDrag\([\s\S]*?selectedGroup,[\s\S]*?isAdditiveSelection/,
  );
  assert.match(
    source,
    /pointerDrag\.toggleSelectionOnClick[\s\S]*?toggleTimelineClipSelection\(clickedClip\)/,
  );
});

test("shows every selected timeline item moving with the pointer", () => {
  assert.match(
    source,
    /const timelineDragPreviewOffsetY =[\s\S]*pointerDrag\.y - pointerDrag\.pointerStartY/,
  );
  assert.match(
    source,
    /timelineGroupDragPreview\?\.ids\.has\(clip\.id\)[\s\S]*"moving-timeline-clip"/,
  );
  assert.match(
    source,
    /translate:[\s\S]*`0 \$\{timelineDragPreviewOffsetY\}px`/,
  );
});

test("synchronizes the selection ref when a single clip is selected", () => {
  assert.match(source, /selectedClipIdsRef\.current = \[clip\.id\]/);
});

test("plain-clicking a clip inside a multi-selection selects only that clip", () => {
  assert.match(
    source,
    /!pointerDragStartedRef\.current[\s\S]*pointerDrag\.type === "timeline"[\s\S]*pointerDrag\.toggleSelectionOnClick[\s\S]*toggleTimelineClipSelection\(clickedClip\)/,
  );
  assert.match(
    source,
    /const selectedGroup =\s*isAdditiveSelection &&\s*selectedClipIdsRef\.current\.length > 1 &&\s*selectedClipIdsRef\.current\.includes\(clip\.id\)/,
  );
  assert.match(
    source,
    /if \(pointerDrag\.type === "timeline"\) \{[\s\S]*selectedClipIdsRef\.current = \[clickedClip\.id\][\s\S]*setSelectedClipIds\(\[clickedClip\.id\]\)/,
  );
});

test("clicking empty timeline lane does not select every clip in that row", () => {
  const laneHandlerStart = source.indexOf("data-track-id={track.id}");
  const laneHandlerEnd = source.indexOf("onDoubleClick={(event) => {", laneHandlerStart);
  const laneClickHandler = source.slice(laneHandlerStart, laneHandlerEnd);

  assert.doesNotMatch(laneClickHandler, /setSelectedClipIds\(rowClipIds\)/);
  assert.doesNotMatch(laneClickHandler, /selectedClipIdsRef\.current = rowClipIds/);
  assert.match(
    laneClickHandler,
    /if \(event\.target !== event\.currentTarget\) return;\s*clearEditorSelection\(\);/,
  );
});

test("timeline selection starts from wider blank space and appears quickly", () => {
  assert.match(
    source,
    /className="timeline-content"[\s\S]*?onPointerDown=\{\(event\) => \{[\s\S]*?startTimelineSelection\(event\)/,
  );
  assert.match(
    source,
    /className="timeline-scroll"[\s\S]*?onPointerDown=\{\(event\) => \{[\s\S]*?startTimelineSelection\(event\)/,
  );
  assert.match(
    source,
    /const startTimelineSelection = \(event: PointerEvent<HTMLElement>\) => \{\s*if \(event\.button !== 0\) return;/,
  );
  assert.match(
    source,
    /Math\.hypot\(point\.x - selection\.startX, point\.y - selection\.startY\) >= 2/,
  );
});

test("normal imported-media clicks are single selection, not additive", () => {
  assert.match(
    source,
    /chooseMedia\(\s*mediaItem,\s*event\.ctrlKey \|\| event\.metaKey,\s*event\.shiftKey,\s*\)/,
  );
  assert.doesNotMatch(source, /event\.ctrlKey \|\| event\.metaKey \|\| !event\.shiftKey/);
  assert.match(
    source,
    /pointerDrag\.type === "media"[\s\S]*chooseMedia\(clickedMedia, false, false\)/,
  );
});

test("empty areas clear both timeline and imported-media selections", () => {
  assert.match(source, /const clearEditorSelection = \(\) => \{[\s\S]*clearTimelineClipSelection\(\);[\s\S]*clearMediaSelection\(\);/);
  assert.match(source, /if \(!additive\) \{\s*clearEditorSelection\(\);/);
  assert.match(source, /Timeline selection cleared/);
});

test("imported media selection can start from the whole media panel", () => {
  assert.match(
    source,
    /<aside[\s\S]*className=\{`media-panel \$\{mediaSelectionBox\?\.activated \? "is-selecting-media" : ""\}`\}[\s\S]*onPointerDown=\{startMediaSelection\}[\s\S]*onPointerMove=\{moveMediaSelection\}[\s\S]*onPointerUp=\{finishMediaSelection\}/,
  );
  assert.doesNotMatch(
    source,
    /className=\{`media-library \$\{mediaSelectionBox\?\.activated \? "is-selecting-media" : ""\}`\}[\s\S]{0,220}onPointerDown=\{startMediaSelection\}/,
  );
  assert.match(
    styles,
    /\.media-panel\.is-selecting-media,\s*\.media-library\.is-selecting-media\s*\{[^}]*cursor:\s*crosshair;/s,
  );
});
