import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composition = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

test("the exact selected video layer marks its whole timeline row", () => {
  assert.match(
    composition,
    /selectedTimelineRowKey === track\.key \|\| rowHasSelectedClip/,
  );
});

test("a selected timeline row uses a yellow lane and label highlight", () => {
  assert.match(
    styles,
    /\.track-lane\.selected-track-lane\s*\{[^}]*border-color: rgba\(250, 204, 21,/s,
  );
  assert.match(
    styles,
    /\.timeline-track\.selected-timeline-row \.track-label\s*\{[^}]*color: #f5b800;/s,
  );
});

test("auto captions and lyrics receive rows while transcript metadata stays hidden", () => {
  assert.match(composition, /key: "caption-auto"/);
  assert.match(composition, /label: "Auto captions"/);
  assert.match(composition, /key: "caption-lyrics"/);
  assert.match(composition, /label: "Lyrics"/);
  assert.doesNotMatch(composition, /key: "caption-transcript"/);
});

test("caption row selection includes only captions of the matching kind", () => {
  assert.match(
    composition,
    /getCaptionTimelineRowKind\(clip\) === \(row\.captionKind \?\? "manual"\)/,
  );
  assert.doesNotMatch(
    composition,
    /row\.id === "caption" && isTranscriptSettingClip\(clip\)[\s\S]{0,80}return false/,
  );
});

test("video layer labels stay hidden while their rows remain selectable", () => {
  assert.match(
    composition,
    /const isVideoLayerRow = track\.videoLayer !== undefined;/,
  );
  assert.match(
    composition,
    /const isSecondaryLinkedAudioRow =\s*track\.key\.startsWith\("linked-audio-"\) &&\s*track\.key !== "linked-audio-0";/,
  );
  assert.match(
    composition,
    /const shouldHideTrackHeader =\s*isVideoLayerRow \|\| isSecondaryLinkedAudioRow;/,
  );
  assert.match(
    composition,
    /role="button"\s+tabIndex=\{0\}\s+aria-label=\{`Select \$\{/,
  );
  assert.match(
    composition,
    /getTranscriptableRowClips\(\s*clips,\s*selectedVideoLayer,\s*selectedTrack,?\s*\)/,
  );
  assert.match(
    composition,
    /disabled=\{isAutoCaptionLoading \|\| !canGenerateTranscript\}/,
  );
});

test("audio clips and full audio rows can drive caption and transcript tools", () => {
  assert.match(composition, /selectedClip\.track === "audio"/);
  assert.match(composition, /const selectedTranscriptAudioRowClips = useMemo/);
  assert.match(
    composition,
    /selectedTimelineRowKey\.startsWith\("linked-audio-"\)/,
  );
  assert.match(
    composition,
    /selectedTimelineRowKey\.startsWith\("detached-audio-lane-"\)/,
  );
  assert.match(composition, /selectedTimelineRowKey === "imported-audio"/);
  assert.match(composition, /selectedTimelineRowKey === "voiceover"/);
  assert.match(
    composition,
    /selectedTrack === "audio"\s*\?\s*selectedTranscriptAudioRowClips/,
  );
});
