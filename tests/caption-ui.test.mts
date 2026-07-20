import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("wires the captions tool into manual caption controls and preview rendering", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /activeTool[\s\S]*"captions"/);
  assert.match(source, /onClick=\{\(\) => setActiveTool\("captions"\)\}/);
  assert.match(source, /onClick=\{addCaptionAtPlayhead\}/);
  assert.match(source, /createManualCaptionClip\(/);
  assert.match(source, /getActiveClipsAtFrame\(\s*clips,\s*"caption",\s*playheadFrame,\s*\)/);
});

test("shows text and caption rows only when their tracks contain clips", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /hasClipsOnTrack\(clips, "text"\)[\s\S]*?label: "Text track"/,
  );
  assert.match(
    source,
    /hasClipsOnTrack\(clips, "caption"\)[\s\S]*?label: "Caption track"/,
  );
});

test("projects generated caption metadata into manual style fields only", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const selectionSync = source.slice(
    source.indexOf('if (activeTool !== "captions"'),
    source.indexOf("const commitClipChange"),
  );

  assert.match(
    selectionSync,
    /setCaptionStyle\(\{\s*fontSize: selectedCaptionClip\.caption\.fontSize,\s*textColor: selectedCaptionClip\.caption\.textColor,\s*backgroundEnabled: selectedCaptionClip\.caption\.backgroundEnabled,\s*backgroundColor: selectedCaptionClip\.caption\.backgroundColor,\s*\}\)/,
  );
  assert.doesNotMatch(selectionSync, /\.\.\.style|sourceClipId|generationId/);
});

test("keeps a newly added caption populated for immediate editing", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const addCaption = source.slice(
    source.indexOf("const addCaptionAtPlayhead"),
    source.indexOf("const applySelectedCaption"),
  );

  assert.match(addCaption, /setCaptionDraft\(captionClip\.caption\.content\)/);
  assert.match(
    addCaption,
    /setCaptionStyle\(\{\s*fontSize: captionClip\.caption\.fontSize,\s*textColor: captionClip\.caption\.textColor,\s*backgroundEnabled: captionClip\.caption\.backgroundEnabled,\s*backgroundColor: captionClip\.caption\.backgroundColor,\s*\}\)/,
  );
  assert.doesNotMatch(source, /skipCaptionSyncRef/);
});

test("renders preview captions as labeled keyboard-accessible buttons", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const previewCaptions = source.slice(
    source.indexOf('className="preview-caption-stack"'),
    source.indexOf("activeStickerClips.map"),
  );

  assert.match(previewCaptions, /<button/);
  assert.match(
    previewCaptions,
    /aria-label=\{`Select caption: \$\{caption\.content\}`\}/,
  );
  assert.match(previewCaptions, /type="button"/);
  assert.match(previewCaptions, /onClick=\{\(\) => selectTimelineClip\(captionClip\)\}/);
});

test("renders eight directional resize handles on the selected caption", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );
  const previewCaptions = source.slice(
    source.indexOf('className="preview-caption-stack"'),
    source.indexOf("activeStickerClips.map"),
  );

  assert.match(previewCaptions, /left: `\$\{captionPosition\.x\}%`/);
  assert.match(previewCaptions, /top: `\$\{captionPosition\.y\}%`/);
  assert.match(previewCaptions, /startCaptionPreviewDrag\(event, captionClip\)/);
  const directions = [
    "top-left", "top", "top-right", "right",
    "bottom-right", "bottom", "bottom-left", "left",
  ];
  const handleElements = [
    ...previewCaptions.matchAll(
      /<span\s+className="caption-resize-handle caption-resize-handle-([^"]+)"\s+onPointerDown=\{\(event\) =>\s+startCaptionResizeDrag\(event, captionClip, "([^"]+)"\)\}\s*\/>/g,
    ),
  ];
  const handleClassNames =
    previewCaptions.match(
      /className="caption-resize-handle caption-resize-handle-[^"]+"/g,
    ) ?? [];

  assert.equal(handleClassNames.length, 8);
  assert.equal(handleElements.length, 8);
  assert.deepEqual(
    handleElements.map((match) => match[1]).sort(),
    [...directions].sort(),
  );
  assert.deepEqual(
    handleElements.map((match) => match[2]).sort(),
    [...directions].sort(),
  );
  for (const direction of directions) {
    assert.match(
      previewCaptions,
      new RegExp(
        `<span\\s+className="caption-resize-handle caption-resize-handle-${direction}"\\s+onPointerDown=\\{\\(event\\) =>\\s+startCaptionResizeDrag\\(event, captionClip, "${direction}"\\)\\}\\s*\\/>`,
      ),
    );
  }
  assert.doesNotMatch(previewCaptions, /caption-resize-handle-canvas/);
  assert.match(
    source,
    /querySelector<HTMLElement>\(\s*"\.selected-preview-caption",?\s*\)/,
  );
  const cloneMeasurement = source.slice(
    source.indexOf("const clone = captionElement.cloneNode(true)"),
    source.indexOf('clone.style.visibility = "hidden"'),
  );

  assert.match(
    cloneMeasurement,
    /clone\.querySelectorAll\("\.caption-resize-handle"\)\.forEach\(\(resizeHandle\) => \{\s*resizeHandle\.remove\(\);\s*\}\);/,
  );
  assert.match(css, /\.caption-resize-handle-top\s*,\s*\.caption-resize-handle-bottom\s*\{\s*cursor:\s*ns-resize;\s*\}/);
  assert.match(css, /\.caption-resize-handle-left\s*,\s*\.caption-resize-handle-right\s*\{\s*cursor:\s*ew-resize;\s*\}/);
  assert.match(css, /\.caption-resize-handle-top-right\s*,\s*\.caption-resize-handle-bottom-left\s*\{\s*cursor:\s*nesw-resize;\s*\}/);
  assert.match(css, /\.caption-resize-handle-top-left\s*,\s*\.caption-resize-handle-bottom-right\s*\{\s*cursor:\s*nwse-resize;\s*\}/);
});

test("keeps text and caption move and resize gestures mutually exclusive", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const moveGesture = source.slice(
    source.indexOf("const startCaptionPreviewDrag"),
    source.indexOf("const startCutoutInteraction"),
  );
  const resizeGesture = source.slice(
    source.indexOf("const startCaptionResizeDrag"),
    source.indexOf("const startTextRotateDrag"),
  );
  const textMoveGesture = source.slice(
    source.indexOf("const startTextPreviewDrag"),
    source.indexOf("const startCaptionPreviewDrag"),
  );
  const textResizeGesture = source.slice(
    source.indexOf("const startTextResizeDrag"),
    source.indexOf("const startCaptionResizeDrag"),
  );

  assert.match(moveGesture, /setCaptionResizeDrag\(null\);[\s\S]*setCaptionPreviewDrag\(\{/);
  assert.match(resizeGesture, /setCaptionPreviewDrag\(null\);[\s\S]*setCaptionResizeDrag\(\{/);
  assert.match(textMoveGesture, /setTextResizeDrag\(null\);[\s\S]*setTextPreviewDrag\(\{/);
  assert.match(textResizeGesture, /setTextPreviewDrag\(null\);[\s\S]*setTextResizeDrag\(\{/);
});

test("allows caption creation and selected captions to use a one pixel minimum font size", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const selectedCaptionControls = source.slice(
    source.indexOf("<em>{selectedCaptionStyle.fontSize}px</em>"),
    source.indexOf('aria-label="Caption text color"'),
  );
  const captionCreationControls = source.slice(
    source.indexOf("<strong>Font size</strong>"),
    source.indexOf("<strong>Text color</strong>"),
  );
  const selectedTextControls = source.slice(
    source.indexOf("<em>{selectedTextStyle.fontSize}px</em>"),
    source.indexOf('aria-label="Text rotation"'),
  );

  assert.match(selectedCaptionControls, /min="1"/);
  assert.match(selectedCaptionControls, /step="1"/);
  assert.match(captionCreationControls, /min=\{1\}/);
  assert.match(captionCreationControls, /step=\{1\}/);
  assert.match(selectedTextControls, /min="1"/);
  assert.match(selectedTextControls, /step="1"/);
});

test("starts the captions tool on a four-action launcher and supports returning with Back", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const \[captionMode, setCaptionMode\] = useState<"actions" \| "manual" \| "auto" \| "upload" \| "lyrics">\("actions"\);/,
  );

  const captionTiles = source.slice(
    source.indexOf("const captionActionTiles = ["),
    source.indexOf("const createImportedCaptionClips = ("),
  );

  assert.equal(captionTiles.match(/label:/g)?.length, 4);
  assert.match(captionTiles, /label: "Auto captions"/);
  assert.match(captionTiles, /label: "Manual captions"/);
  assert.match(captionTiles, /label: "Upload caption file"/);
  assert.match(captionTiles, /label: "Auto lyrics"/);
  assert.match(source, /setCaptionMode\(mode\)/);
  assert.match(source, /setCaptionMode\("actions"\)/);
  assert.match(source, />Back</);
});

test("accepts supported caption file uploads and parses them locally", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const captionPanel = source.slice(
    source.indexOf('activeTool === "captions" ? ('),
    source.indexOf(') : activeTool === "animations" ? ('),
  );
  const uploadAction = source.slice(
    source.indexOf("const uploadCaptionFile = async ("),
    source.indexOf("const generateCaptionBatch = useCallback(async ("),
  );

  assert.match(source, /import \{parseCaptionFile\} from "\.\/captionFileParser";/);
  assert.match(captionPanel, /accept="\.srt,\.ass,\.lrc"/);
  assert.match(uploadAction, /const file = event\.currentTarget\.files\?\.\[0\]/);
  assert.match(uploadAction, /const content = await file\.text\(\)/);
  assert.match(
    uploadAction,
    /parseCaptionFile\(\{\s*name: file\.name,\s*content,\s*fps,\s*timelineDuration: projectDuration,\s*\}\)/,
  );
  assert.doesNotMatch(uploadAction, /\/api\/transcribe/);
  assert.match(uploadAction, /event\.currentTarget\.value = ""/);
});

test("imports parsed caption files as regular caption clips in exactly one commit", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const importHelper = source.slice(
    source.indexOf("const createImportedCaptionClips = ("),
    source.indexOf("export const MyComposition"),
  );
  const uploadAction = source.slice(
    source.indexOf("const uploadCaptionFile = async ("),
    source.indexOf("const generateCaptionBatch = useCallback(async ("),
  );

  assert.match(importHelper, /track: "caption"/);
  assert.match(importHelper, /caption: \{\s*\.\.\.style,\s*content: text,\s*\}/);
  assert.doesNotMatch(importHelper, /generationId|sourceClipId/);
  assert.equal(uploadAction.match(/commitClipChange\(\(currentClips\) =>/g)?.length, 1);
  assert.match(
    uploadAction,
    /setCaptionStatus\(\{\s*kind: "error",\s*message: error instanceof Error[\s\S]*\}\)/,
  );
});

test("gates caption transcription to selected source-backed videos in both auto modes", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const captionPanel = source.slice(
    source.indexOf('activeTool === "captions" ? ('),
    source.indexOf(') : activeTool === "animations" ? ('),
  );

  assert.match(
    source,
    /const selectedCaptionSourceClip = selectedClip &&\s*\(\s*selectedClip\.track === "main" \|\| selectedClip\.track === "upper"\s*\) &&\s*selectedClip\.src\s*\?\s*selectedClip\s*:\s*null;/,
  );
  assert.match(captionPanel, /disabled=\{isAutoCaptionLoading \|\| !selectedCaptionSourceClip\}/);
  assert.match(
    captionPanel,
    /Select a main or upper video clip before generating auto captions\./,
  );
  assert.match(
    captionPanel,
    /Select a main or upper video clip before generating auto lyrics\./,
  );
});

test("routes auto lyrics through the secured transcription flow with separate labels and shared safety", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const transcriptionAction = source.slice(
    source.indexOf("const generateCaptionBatch = useCallback(async ("),
    source.indexOf("const generateAutoCaptions = useCallback(async () => {"),
  );

  assert.match(source, /const generateAutoCaptions = useCallback\(async \(\) => \{\s*await generateCaptionBatch\("auto"\);\s*\}, \[generateCaptionBatch\]\);/);
  assert.match(source, /const generateAutoLyrics = useCallback\(async \(\) => \{\s*await generateCaptionBatch\("lyrics"\);\s*\}, \[generateCaptionBatch\]\);/);
  assert.match(source, /const autoCaptionRequestRef = useRef<symbol \| null>\(null\)/);
  assert.match(transcriptionAction, /if \(autoCaptionRequestRef\.current\) \{\s*abortAutoCaptionRequest\(\);\s*\}/);
  assert.match(transcriptionAction, /const requestToken = Symbol\("auto-caption-request"\)/);
  assert.match(
    transcriptionAction,
    /fetch\(resolveMediaSource\(selectedCaptionSourceClip\.src!?\), \{\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(transcriptionAction, /formData\.append\("file", clipFile\)/);
  assert.match(
    transcriptionAction,
    /fetch\("\/api\/transcribe", \{\s*method: "POST",\s*body: formData,\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(
    transcriptionAction,
    /kind === "lyrics"[\s\S]*Generating auto lyrics\.\.\.[\s\S]*Added \$\{generatedCaptions\.length\} lyric captions\./,
  );
  assert.match(
    transcriptionAction,
    /Generating auto captions\.\.\.[\s\S]*Added \$\{generatedCaptions\.length\} auto captions\./,
  );

  assert.match(source, /const clipsRef = useRef\(clips\)/);
  assert.match(source, /const selectedClipIdRef = useRef\(selectedClipId\)/);
  assert.match(source, /const autoCaptionSelectionVersionRef = useRef\(0\)/);
  assert.match(source, /autoCaptionSelectionVersionRef\.current \+= 1/);
  assert.match(
    transcriptionAction,
    /const isActiveAutoCaptionRequest = \(\) =>\s*autoCaptionRequestRef\.current === requestToken &&\s*autoCaptionSelectionVersionRef\.current === selectionVersion;/,
  );
  assert.match(
    transcriptionAction,
    /const currentSourceClip = clipsRef\.current\.find\(\s*\(clip\) => clip\.id === sourceClipId,\s*\);/,
  );
  assert.match(
    transcriptionAction,
    /selectedClipIdRef\.current !== sourceClipId[\s\S]*currentSourceClip\.track !== "main" &&\s*currentSourceClip\.track !== "upper"[\s\S]*currentSourceClip\.src !== sourceClipSrc[\s\S]*return;/,
  );
  assert.match(
    transcriptionAction,
    /finally \{\s*if \(autoCaptionRequestRef\.current === requestToken\) \{\s*autoCaptionRequestRef\.current = null;\s*setIsAutoCaptionLoading\(false\);\s*\}\s*if \(autoCaptionAbortControllerRef\.current === abortController\) \{\s*autoCaptionAbortControllerRef\.current = null;\s*\}\s*\}/,
  );
  assert.match(
    transcriptionAction,
    /let payload: unknown;\s*try \{\s*payload = await transcriptionResponse\.json\(\);[\s\S]*catch \{[\s\S]*kind === "lyrics"[\s\S]*"Auto lyric generation failed\. Please try again\."[\s\S]*"Auto caption generation failed\. Please try again\."/,
  );
  assert.match(
    transcriptionAction,
    /typeof payload !== "object" \|\|\s*payload === null \|\|\s*Array\.isArray\(payload\) \|\|\s*!\("segments" in payload\) \|\|\s*!Array\.isArray\(payload\.segments\)/,
  );
  assert.match(
    transcriptionAction,
    /typeof payload\.error === "object"[\s\S]*typeof payload\.error\.message === "string"[\s\S]*payload\.error\.message\.trim\(\)/,
  );
});

test("sends only selected trim metadata and maps relative transcript timestamps once", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const transcriptionAction = source.slice(
    source.indexOf("const generateCaptionBatch = useCallback(async ("),
    source.indexOf("const generateAutoCaptions = useCallback(async () => {"),
  );

  assert.match(
    transcriptionAction,
    /const sourceStartSeconds = \(\(selectedCaptionSourceClip\.sourceStart \?\? 0\) \/ fps\);/,
  );
  assert.match(
    transcriptionAction,
    /const sourceDurationSeconds = \(selectedCaptionSourceClip\.duration \* \(selectedCaptionSourceClip\.speed \?\? 1\)\) \/ fps;/,
  );
  assert.match(transcriptionAction, /formData\.append\("sourceStart", String\(sourceStartSeconds\)\)/);
  assert.match(transcriptionAction, /formData\.append\("duration", String\(sourceDurationSeconds\)\)/);
  assert.match(
    transcriptionAction,
    /sourceClip: \{\s*\.\.\.currentSourceClip,\s*sourceStart: 0,\s*\}/,
  );
  assert.doesNotMatch(transcriptionAction, /sourceStart: currentSourceClip\.sourceStart/);
});

test("aborts media and transcription requests without surfacing abort errors", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const transcriptionAction = source.slice(
    source.indexOf("const generateCaptionBatch = useCallback(async ("),
    source.indexOf("const generateAutoCaptions = useCallback(async () => {"),
  );

  assert.match(source, /const autoCaptionAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(source, /const abortAutoCaptionRequest = useCallback\(\(\) => \{/);
  assert.match(source, /autoCaptionAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*abortAutoCaptionRequest\(\);\s*\}, \[\s*selectedCaptionSourceClip\?\.id,\s*selectedCaptionSourceClip\?\.src,\s*selectedCaptionSourceClip\?\.sourceStart,\s*selectedCaptionSourceClip\?\.duration,\s*selectedCaptionSourceClip\?\.speed,\s*abortAutoCaptionRequest,\s*\]\);/,
  );
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*return \(\) => abortAutoCaptionRequest\(\);\s*\}, \[abortAutoCaptionRequest\]\);/,
  );
  assert.match(source, /setCaptionMode\("actions"\);\s*abortAutoCaptionRequest\(\);/);
  assert.match(source, /setActiveTool\("media"\);\s*abortAutoCaptionRequest\(\);/);
  assert.match(transcriptionAction, /const abortController = new AbortController\(\)/);
  assert.match(transcriptionAction, /autoCaptionAbortControllerRef\.current = abortController/);
  assert.match(
    transcriptionAction,
    /fetch\(resolveMediaSource\(selectedCaptionSourceClip\.src!?\), \{\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(
    transcriptionAction,
    /fetch\("\/api\/transcribe", \{\s*method: "POST",\s*body: formData,\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(
    transcriptionAction,
    /error instanceof DOMException && error\.name === "AbortError"[\s\S]*return;/,
  );
  assert.match(
    transcriptionAction,
    /autoCaptionAbortControllerRef\.current === abortController[\s\S]*autoCaptionAbortControllerRef\.current = null/,
  );
});

test("aborts and invalidates auto captions when selected source timing changes", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const abortHelper = source.slice(
    source.indexOf("const abortAutoCaptionRequest = useCallback"),
    source.indexOf("const openCaptionMode"),
  );

  assert.match(
    source,
    /autoCaptionSelectionVersionRef\.current \+= 1;\s*\}, \[\s*selectedCaptionSourceClip\?\.id,\s*selectedCaptionSourceClip\?\.src,\s*selectedCaptionSourceClip\?\.sourceStart,\s*selectedCaptionSourceClip\?\.duration,\s*selectedCaptionSourceClip\?\.speed,\s*\]\);/,
  );
  assert.match(
    source,
    /abortAutoCaptionRequest\(\);\s*\}, \[\s*selectedCaptionSourceClip\?\.id,\s*selectedCaptionSourceClip\?\.src,\s*selectedCaptionSourceClip\?\.sourceStart,\s*selectedCaptionSourceClip\?\.duration,\s*selectedCaptionSourceClip\?\.speed,\s*abortAutoCaptionRequest,\s*\]\);/,
  );
  assert.match(abortHelper, /setIsAutoCaptionLoading\(false\)/);
  assert.doesNotMatch(abortHelper, /setCaptionStatus\(\{\s*kind: "error"/);
});

test("offers a dedicated transcript workflow for the selected video clip", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\| "transcript"/);
  assert.match(source, />Transcript<\/button>/);
  assert.match(source, /await generateCaptionBatch\("transcript"\)/);
  assert.match(source, /Select the video clip you want to transcribe first\./);
  assert.match(source, /Transcript ready with \$\{generatedCaptions\.length\} timed segments\./);
  assert.match(source, /caption\?\.generationId\?\.startsWith\("transcript-"\)/);
  assert.match(source, /aria-label="Transcript segments"/);
  assert.match(source, /setCaptionMode\("manual"\)[\s\S]*setActiveTool\("captions"\)/);
});

test("offers automatic silence removal through the shared transcript request lifecycle", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const silenceAction = source.slice(
    source.indexOf("const removeSilenceAutomatically = useCallback(async () => {"),
    source.indexOf("const duplicateSelectedSticker"),
  );
  const transcriptPanel = source.slice(
    source.indexOf('activeTool === "transcript" ? ('),
    source.indexOf(') : activeTool === "captions" ? ('),
  );

  assert.match(source, /removeSilenceFromLinkedVideo,/);
  assert.match(transcriptPanel, /className="transcript-actions"/);
  assert.match(transcriptPanel, /onClick=\{removeSilenceAutomatically\}/);
  assert.equal(
    transcriptPanel.match(
      /disabled=\{isAutoCaptionLoading \|\| !selectedCaptionSourceClip\}/g,
    )?.length,
    2,
  );
  assert.match(silenceAction, /if \(autoCaptionRequestRef\.current\) \{\s*abortAutoCaptionRequest\(\);\s*\}/);
  assert.match(
    silenceAction,
    /const preflightDecision = decideSilenceRemovalPreflight\(\s*clipsRef\.current,\s*selectedCaptionSourceClip\.id,\s*\);\s*if \(preflightDecision\.outcome !== "ready"\) \{\s*setCaptionStatus\(preflightDecision\.status\);\s*return;\s*\}/,
  );
  assert.match(
    source,
    /message: "The selected video has no linked audio to clean up\."/,
  );
  assert.match(silenceAction, /const requestToken = Symbol\("silence-removal-request"\)/);
  assert.match(silenceAction, /const selectionVersion = autoCaptionSelectionVersionRef\.current/);
  assert.match(silenceAction, /const sourceClipId = selectedCaptionSourceClip\.id/);
  assert.match(silenceAction, /const sourceClipSrc = selectedCaptionSourceClip\.src/);
  assert.match(silenceAction, /const sourceClipSourceStart = selectedCaptionSourceClip\.sourceStart \?\? 0/);
  assert.match(silenceAction, /const sourceClipDuration = selectedCaptionSourceClip\.duration/);
  assert.match(silenceAction, /const sourceClipSpeed = selectedCaptionSourceClip\.speed \?\? 1/);
  assert.match(
    silenceAction,
    /fetch\(resolveMediaSource\(selectedCaptionSourceClip\.src!\), \{\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(silenceAction, /formData\.append\("file", clipFile\)/);
  assert.match(silenceAction, /formData\.append\("sourceStart", String\(sourceStartSeconds\)\)/);
  assert.match(silenceAction, /formData\.append\("duration", String\(sourceDurationSeconds\)\)/);
  assert.match(
    silenceAction,
    /fetch\("\/api\/detect-silence", \{\s*method: "POST",\s*body: formData,\s*signal: abortController\.signal,\s*\}\)/,
  );
  assert.match(
    silenceAction,
    /const isActiveSilenceRequest = \(\) =>\s*autoCaptionRequestRef\.current === requestToken &&\s*autoCaptionSelectionVersionRef\.current === selectionVersion/,
  );
  assert.match(
    source,
    /selectedClipId !== snapshot\.sourceClipId[\s\S]*sourceClip\.src !== snapshot\.sourceClipSrc[\s\S]*sourceClip\.sourceStart \?\? 0\) !== snapshot\.sourceClipSourceStart[\s\S]*sourceClip\.duration !== snapshot\.sourceClipDuration[\s\S]*sourceClip\.speed \?\? 1\) !== snapshot\.sourceClipSpeed/,
  );
  assert.match(
    source,
    /outcome: "no-removable-silence"[\s\S]*kind: "success"[\s\S]*message: "No removable silence was found\."/,
  );
  assert.match(silenceAction, /setCaptionStatus\(actionDecision\.status\)/);
  assert.match(source, /Removed \$\{ranges\.length\} silent pause/);

  const preflightIndex = silenceAction.indexOf(
    "const preflightDecision = decideSilenceRemovalPreflight(",
  );
  const requestIndex = silenceAction.indexOf(
    'const requestToken = Symbol("silence-removal-request")',
  );
  const uploadIndex = silenceAction.indexOf(
    "fetch(resolveMediaSource(selectedCaptionSourceClip.src!),",
  );
  const endpointIndex = silenceAction.indexOf('fetch("/api/detect-silence"');
  const historyIndex = silenceAction.indexOf(
    "commitClipChange((currentClips) =>",
  );

  assert.ok(preflightIndex >= 0);
  assert.ok(preflightIndex < requestIndex);
  assert.ok(preflightIndex < uploadIndex);
  assert.ok(preflightIndex < endpointIndex);
  assert.ok(preflightIndex < historyIndex);
});

test("does not re-check the cleared request token inside the delayed transcript commit", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const commitStart = source.indexOf("commitClipChange((currentClips) => {", source.indexOf("const generateCaptionBatch"));
  const commitEnd = source.indexOf("});", commitStart);
  const transcriptCommit = source.slice(commitStart, commitEnd);

  assert.ok(commitStart >= 0, "expected generated transcript commit");
  assert.doesNotMatch(transcriptCommit, /isActiveAutoCaptionRequest\(\)/);
  assert.match(transcriptCommit, /selectedClipIdRef\.current !== sourceClipId/);
  assert.match(transcriptCommit, /replaceGeneratedCaptionBatch/);
});
