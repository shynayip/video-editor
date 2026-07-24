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

test("shows transcript sentences for every source in the selected video row", () => {
  assert.match(
    compositionSource,
    /const selectedTranscriptSourceClipIds = useMemo/,
  );
  assert.match(
    compositionSource,
    /selectedTranscriptSourceClipIds\.includes\(\s*clip\.caption\.sourceClipId/,
  );
  assert.match(
    compositionSource,
    /\[clips, selectedTranscriptSourceClipIds\]/,
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
    "const updateSelectedCaptionContent",
  );
  const handlerEnd = compositionSource.indexOf(
    "const removeTranscriptSentence",
    handlerStart,
  );
  const handler = compositionSource.slice(handlerStart, handlerEnd);

  assert.match(handler, /caption: \{ \.\.\.clip\.caption, content \}/);
  assert.match(handler, /setPreviewMode\("timeline"\)/);
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
    /className="transcript-sentence-editor"[\s\S]*onPointerDown=\{focusTextareaOnPointerDown\}/,
  );
});

test("transcript text edits apply from one typewriter-style textbox", () => {
  assert.match(
    compositionSource,
    /className="transcript-sentence-editor"/,
  );
  assert.match(
    compositionSource,
    /className="transcript-edit-apply"/,
  );
  assert.match(
    compositionSource,
    /const timer = window\.setTimeout\(commitEdit, 650\)/,
  );
  assert.match(
    compositionSource,
    /onCommitEdit\(clipId, draft\)/,
  );
  assert.match(
    compositionSource,
    /onBlur=\{commitEdit\}/,
  );
  assert.match(
    compositionSource,
    /if \(!normalizedEditedContent\) \{[\s\S]*removeTranscriptSentence\(transcriptClipId\)/,
  );
  assert.doesNotMatch(compositionSource, /className="transcript-word-button"/);
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
