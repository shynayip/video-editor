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
    /const previewCaptionClips = activeCaptionClips\.filter\([\s\S]*!clip\.caption\?\.generationId\?\.startsWith\("transcript-"\)/,
  );
  assert.match(
    compositionSource,
    /previewCaptionClips\.map\(\(captionClip, captionIndex\) =>/,
  );
});

test("shows transcript sentences only for the selected video row", () => {
  assert.match(
    compositionSource,
    /const selectedTranscriptSourceClipIds = useMemo\([\s\S]*new Set\(transcriptSourceClips\.map\(\(clip\) => clip\.id\)\)/,
  );
  assert.match(
    compositionSource,
    /clip\.caption\.sourceClipId[\s\S]*selectedTranscriptSourceClipIds\.has\([\s\S]*clip\.caption\.sourceClipId/,
  );
  assert.match(
    compositionSource,
    /Selected row: \{selectedTranscriptRowLabel\}/,
  );
});

test("keeps word and sentence deletion linked to video and audio edits", () => {
  assert.doesNotMatch(
    compositionSource,
    /className="transcript-sentence-editor"[\s\S]{0,900}onBlur=/,
  );
  assert.match(
    compositionSource,
    /const TranscriptSentenceEditor[\s\S]*onChange=\{\(event\) => setDraft\(event\.currentTarget\.value\)\}/,
  );
  assert.match(compositionSource, /event\.key === "Enter"/);
  assert.match(compositionSource, /className="transcript-sentence-done"/);
  assert.match(compositionSource, /onClick=\{saveDraft\}/);
  assert.match(compositionSource, /removeTranscriptWordsFromLinkedVideo\(/);
  assert.match(compositionSource, /setIsPreviewPlaying\(false\)/);
});

test("edits transcript text without deleting its caption box or cutting media", () => {
  const handlerStart = compositionSource.indexOf(
    "const commitTranscriptSentenceEdit",
  );
  const handlerEnd = compositionSource.indexOf(
    "const removeAllTranscriptFillers",
    handlerStart,
  );
  const handler = compositionSource.slice(handlerStart, handlerEnd);

  assert.match(handler, /label: cleanedText \|\| "Empty caption"/);
  assert.match(handler, /caption: \{ \.\.\.clip\.caption, content: cleanedText \}/);
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
