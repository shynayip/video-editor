import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("manual timeline panel scrolling does not move the red playhead", () => {
  const timelineScrollStart = source.indexOf('className="timeline-scroll"');
  const timelineContentStart = source.indexOf(
    'className="timeline-content"',
    timelineScrollStart,
  );
  const timelineScrollMarkup = source.slice(
    timelineScrollStart,
    timelineContentStart,
  );

  assert.ok(timelineScrollStart >= 0);
  assert.ok(timelineContentStart > timelineScrollStart);
  assert.doesNotMatch(timelineScrollMarkup, /onScroll=/);
  assert.doesNotMatch(source, /updatePlayheadFromTimelineScroll/);
});

test("timeline playback still scrolls the panel to follow the red playhead", () => {
  assert.match(
    source,
    /const nextScrollLeft = Math\.max\(0, playheadFrame \* timelineScale\)/,
  );
  assert.match(source, /scrollArea\.scrollLeft = nextScrollLeft/);
  assert.match(source, /setTimelineHoverFrame\(nextVisible \? playheadFrame : null\)/);
});
