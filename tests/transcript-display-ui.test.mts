import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compositionSource = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("shows transcript segments as timestamp-first sentences", () => {
  assert.match(compositionSource, /className="transcript-sentence-line"/);
  assert.match(compositionSource, /className="transcript-sentence-time"/);
  assert.match(
    compositionSource,
    /className="transcript-sentence-time"[\s\S]*formatTimelineClock\(clip\.start, fps\)[\s\S]*<TranscriptSentenceEditor[\s\S]*timestamp=\{formatTimelineClock\(clip\.start, fps\)\}/,
  );
});

test("keeps transcript-generated captions out of the video preview", () => {
  assert.match(
    compositionSource,
    /const activeCaptionClips =[\s\S]*!clip\.caption\.generationId\?\.startsWith\("transcript-"\)/,
  );
});

test("shows transcript sentences only for the selected video row", () => {
  assert.match(
    compositionSource,
    /const selectedTranscriptSourceClipId =[\s\S]*selectedCaptionSourceClip\?\.id/,
  );
  assert.match(
    compositionSource,
    /clip\.caption\.sourceClipId === selectedTranscriptSourceClipId/,
  );
  assert.match(
    compositionSource,
    /\[clips, selectedTranscriptSourceClipId\]/,
  );
});

test("keeps sentence deletion linked to video and audio edits", () => {
  assert.match(
    compositionSource,
    /const removeTranscriptSentence =[\s\S]*removeTranscriptSentenceFromLinkedVideo\(/,
  );
  assert.match(compositionSource, /className="transcript-remove-sentence"/);
  assert.match(
    compositionSource,
    /onClick=\{\(\) => removeTranscriptSentence\(clip\.id\)\}/,
  );
  assert.match(compositionSource, /setIsPreviewPlaying\(false\)/);
});

test("edits selected caption text without deleting its box or cutting media", () => {
  const handlerStart = compositionSource.indexOf(
    "const commitSelectedCaptionContent",
  );
  const handlerEnd = compositionSource.indexOf(
    "const updateSelectedTextRotation",
    handlerStart,
  );
  const handler = compositionSource.slice(handlerStart, handlerEnd);

  assert.match(handler, /updateSelectedCaptionContent\(content\)/);
  assert.match(handler, /setCaptionDraft\(content\)/);
  assert.doesNotMatch(handler, /deleteClipById/);
  assert.doesNotMatch(handler, /removeTranscriptWordsFromLinkedVideo/);
  assert.doesNotMatch(handler, /setSelectedClipId\(null\)/);
});

test("allows the transcript textarea to receive pointer focus", () => {
  assert.match(
    compositionSource,
    /button, input, textarea, select, \[contenteditable='true'\]/,
  );
  assert.match(
    compositionSource,
    /className="transcript-sentence-editor"[\s\S]*onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
  );
});

test("allows a selected video or cutout row to generate one combined transcript", () => {
  assert.match(compositionSource, /getTranscriptableRowClips\(/);
  assert.match(
    compositionSource,
    /Selected row: \{selectedTranscriptRowLabel\}/,
  );
  assert.match(
    compositionSource,
    /disabled=\{isAutoCaptionLoading \|\| !canGenerateTranscript\}/,
  );
  assert.match(
    compositionSource,
    /for \(const \[index, snapshot\] of sourceSnapshots\.entries\(\)\)/,
  );
  assert.match(
    compositionSource,
    /generatedGroups\.reduce\([\s\S]*replaceGeneratedCaptionBatch/,
  );
});
