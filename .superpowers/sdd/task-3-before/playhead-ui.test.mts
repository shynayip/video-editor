import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  applyTimelineHistoryEdit,
  createSceneMediaItems,
  createTimelineHistory,
  finishVideoLayerControlHistoryGesture,
  getVideoLayerControlState,
  previewVideoLayerControlHistoryGesture,
  removeSilenceFromLinkedVideo,
  startVideoLayerControlHistoryGesture,
  undoTimelineHistory,
} from "../src/editorLogic.ts";
import type {SavedMediaItem, TimelineClip} from "../src/editorLogic.ts";

type SilenceRemovalCommitSnapshot = {
  sourceClipId: string;
  sourceClipSrc: string;
  sourceClipSourceStart: number;
  sourceClipDuration: number;
  sourceClipSpeed: number;
  selectionVersion: number;
};

type SilenceRemovalActionDecision = {
  outcome: "stale" | "no-removable-silence" | "committed";
  clips: TimelineClip[];
  selection: {clipId: string; track: "main" | "upper"} | null;
  status: {
    kind: "idle" | "success";
    message: string;
  };
};

type DecideSilenceRemovalAction = (options: {
  currentClips: TimelineClip[];
  selectedClipId: string | null;
  selectionVersion: number;
  requestIsActive: boolean;
  snapshot: SilenceRemovalCommitSnapshot;
  ranges: Array<{startSeconds: number; endSeconds: number}>;
  fps: number;
}) => SilenceRemovalActionDecision;

type SilenceRemovalPreflightDecision =
  | {
      outcome: "ready";
      clips: TimelineClip[];
      status: null;
    }
  | {
      outcome: "missing-linked-audio";
      clips: TimelineClip[];
      status: {
        kind: "error";
        message: "The selected video has no linked audio to clean up.";
      };
    };

type DecideSilenceRemovalPreflight = (
  clips: TimelineClip[],
  sourceClipId: string,
) => SilenceRemovalPreflightDecision;

type SilenceRemovalHelpers = {
  decideSilenceRemovalAction: DecideSilenceRemovalAction;
  decideSilenceRemovalPreflight: DecideSilenceRemovalPreflight;
};

type AnalyzeImportedVideoResult = {
  sceneItems: ReturnType<typeof createSceneMediaItems>;
  usedFallback: boolean;
};

type MergeImportedMediaItemsInSelectionOrder = (options: {
  currentItems: SavedMediaItem[];
  newItems: SavedMediaItem[];
  sourceFileId: string;
  orderedSourceFileIds: string[];
}) => SavedMediaItem[];

type MapWithConcurrency = <Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapper: (item: Input, index: number) => Promise<Output>,
) => Promise<Output[]>;

type IsDetectedSceneMediaItem = (
  mediaItem: Pick<SavedMediaItem, "sourceFileId"> | undefined,
) => boolean;

const loadIsDetectedSceneMediaItem = (): IsDetectedSceneMediaItem => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const helperStart = source.indexOf("export const isDetectedSceneMediaItem");
  const helperEnd = source.indexOf("type AnalyzingMediaItem", helperStart);

  assert.ok(helperStart >= 0, "expected executable detected-scene classifier");
  assert.ok(helperEnd > helperStart, "expected detected-scene classifier boundary");

  const extractedSource = source
    .slice(helperStart, helperEnd)
    .replace("export const", "const");
  const javascript = ts.transpileModule(extractedSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadHelper = Function(
    `"use strict";\n${javascript}\nreturn isDetectedSceneMediaItem;`,
  );

  return loadHelper() as IsDetectedSceneMediaItem;
};

const loadMergeImportedMediaItemsInSelectionOrder = ():
MergeImportedMediaItemsInSelectionOrder => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const helperStart = source.indexOf("type MergeImportedMediaItemsOptions = {");
  const helperEnd = source.indexOf("type AnalyzeImportedVideoResult", helperStart);

  assert.ok(helperStart >= 0, "expected executable ordered import merge helper");
  assert.ok(helperEnd > helperStart, "expected ordered import merge helper boundary");

  const extractedSource = source
    .slice(helperStart, helperEnd)
    .replaceAll("export const", "const");
  const javascript = ts.transpileModule(extractedSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadHelper = Function(
    `"use strict";\n${javascript}\nreturn mergeImportedMediaItemsInSelectionOrder;`,
  );

  return loadHelper() as MergeImportedMediaItemsInSelectionOrder;
};

const loadMapWithConcurrency = (): MapWithConcurrency => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const helperStart = source.indexOf("export async function mapWithConcurrency");
  const helperEnd = source.indexOf("type MergeImportedMediaItemsOptions", helperStart);

  assert.ok(helperStart >= 0, "expected executable bounded-concurrency helper");
  assert.ok(helperEnd > helperStart, "expected bounded-concurrency helper boundary");

  const extractedSource = source
    .slice(helperStart, helperEnd)
    .replace("export async function", "async function");
  const javascript = ts.transpileModule(extractedSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadHelper = Function(
    `"use strict";\n${javascript}\nreturn mapWithConcurrency;`,
  );

  return loadHelper() as MapWithConcurrency;
};

type AnalyzeImportedVideo = (options: {
  file: File;
  sourceFileId: string;
  previewSrc: string;
  detectVideoScenes: (file: File) => Promise<Array<{
    startSeconds: number;
    endSeconds: number;
  }>>;
  createSceneMediaItems: typeof createSceneMediaItems;
  readDurationInFrames: (src: string) => Promise<number>;
  uploadMedia: (file: File) => Promise<{
    src: string;
    label: string;
    mimeType: string;
  }>;
}) => Promise<AnalyzeImportedVideoResult>;

const loadAnalyzeImportedVideo = (): AnalyzeImportedVideo => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const helperStart = source.indexOf("type AnalyzeImportedVideoResult = {");
  const helperEnd = source.indexOf("const isBrowserOnlySource", helperStart);

  assert.ok(helperStart >= 0, "expected executable video-import analysis helper");
  assert.ok(helperEnd > helperStart, "expected video-import analysis helper boundary");

  const extractedSource = source
    .slice(helperStart, helperEnd)
    .replaceAll("export const", "const");
  const javascript = ts.transpileModule(extractedSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadHelper = Function(
    "fps",
    `"use strict";\n${javascript}\nreturn analyzeImportedVideo;`,
  );

  return loadHelper(30) as AnalyzeImportedVideo;
};

const loadSilenceRemovalHelpers = (): SilenceRemovalHelpers => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const helperStart = source.indexOf("type SilenceRemovalCommitSnapshot = {");
  const helperEnd = source.indexOf("const calculateMetadata", helperStart);

  assert.ok(helperStart >= 0, "expected silence-removal action decision types");
  assert.ok(helperEnd > helperStart, "expected silence-removal decision helper boundary");

  const extractedSource = source.slice(helperStart, helperEnd);
  assert.match(
    extractedSource,
    /export const decideSilenceRemovalAction/,
    "expected executable silence-removal action decision helper",
  );
  assert.match(
    extractedSource,
    /export const decideSilenceRemovalPreflight/,
    "expected executable silence-removal preflight helper",
  );
  const helperSource = extractedSource.replaceAll("export const", "const");
  const javascript = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadHelper = Function(
    "removeSilenceFromLinkedVideo",
    `"use strict";\n${javascript}\nreturn {decideSilenceRemovalAction, decideSilenceRemovalPreflight};`,
  );

  return loadHelper(removeSilenceFromLinkedVideo) as SilenceRemovalHelpers;
};

const loadDecideSilenceRemovalAction = (): DecideSilenceRemovalAction =>
  loadSilenceRemovalHelpers().decideSilenceRemovalAction;

const createSilenceRemovalPair = (): TimelineClip[] => [
  {
    id: "video",
    label: "Lesson",
    track: "main",
    start: 0,
    duration: 300,
    sourceStart: 30,
    speed: 1,
    src: "lesson.mp4",
    color: "#0891b2",
    linkedClipId: "audio",
  },
  {
    id: "audio",
    label: "Lesson audio",
    track: "audio",
    start: 0,
    duration: 300,
    sourceStart: 30,
    speed: 1,
    src: "lesson.mp4",
    color: "#2563eb",
    linkedClipId: "video",
  },
];

const silenceRemovalSnapshot: SilenceRemovalCommitSnapshot = {
  sourceClipId: "video",
  sourceClipSrc: "lesson.mp4",
  sourceClipSourceStart: 30,
  sourceClipDuration: 300,
  sourceClipSpeed: 1,
  selectionVersion: 4,
};

test("lets users grab the red playhead directly", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(
    compositionSource,
    /className="timeline-playhead"[\s\S]*?onPointerDown=\{startTimelineScrub\}/,
  );
  assert.match(
    stylesheetSource,
    /\.timeline-playhead\s*\{[^}]*pointer-events:\s*auto/,
  );
});

test("renders transition nodes and an anchored transition picker", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /className="transition-node"/);
  assert.match(source, /aria-label=\{`Add transition between/);
  assert.match(source, /className="transition-popover"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-label="Transition duration"/);
  assert.match(source, /setClipTransitionById/);
});

test("keeps transition nodes constrained by the real adjacent clip duration", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const minimumTransitionDuration = 1/);
  assert.match(
    source,
    /const maxDuration = Math\.min\(outgoingClip\.duration, incomingClip\.duration\)/,
  );
  assert.match(source, /min=\{minimumTransitionDuration\}/);
  assert.doesNotMatch(
    source,
    /const maxDuration = Math\.max\([\s\S]*?Math\.min\(outgoingClip\.duration, incomingClip\.duration\)/,
  );
});

test("resynchronizes transition node duration from current timeline history", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const clips = timelineHistory\.present/);
  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*?selectedTransitionClip\?\.transition\?\.duration[\s\S]*?setSelectedTransitionDuration[\s\S]*?selectedTransitionBoundary\.maxDuration[\s\S]*?\}, \[[^\]]*selectedTransitionClip\?\.transition\?\.duration[^\]]*\]\)/,
  );
});

test("shows trim handles only for the selected clip", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /selectedClipId === clip\.id \? \([\s\S]*trim-handle-left[\s\S]*trim-handle-right/,
  );
});

test("keeps the audio row hidden until a video or linked audio is selected", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    compositionSource,
    /const \[isAudioTrackVisible, setIsAudioTrackVisible\] = useState\(false\)/,
  );
  assert.match(
    compositionSource,
    /isAudioTrackVisible && contextualAudioClips\.length > 0/,
  );
  assert.match(
    compositionSource,
    /getContextualAudioClips\(clips, contextualSelectionId\)\.length > 0/,
  );
});

test("routes the text track through text-specific timeline and selection logic", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    compositionSource,
    /hasClipsOnTrack\(clips, "text"\)[\s\S]*?label: "Text track"/,
  );
  assert.match(
    compositionSource,
    /setSelectedTrack\("text"\)/,
  );
  assert.match(
    compositionSource,
    /clip\.track === "text"[\s\S]*?startTextTimelineDrag\(event, clip\)/,
  );
  assert.match(
    compositionSource,
    /getActiveClipsAtFrame\(\s*clips,\s*"text",\s*playheadFrame,\s*\)/,
  );
});

test("shows text styling controls in the right details panel", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(compositionSource, /selectedTextClip/);
  assert.match(compositionSource, /Text controls/);
  assert.match(compositionSource, /aria-label="Text font"/);
  assert.match(compositionSource, /aria-label="Text rotation"/);
  assert.match(compositionSource, /aria-label="Text color"/);
  assert.match(compositionSource, /updateSelectedTextStyle/);
  assert.match(compositionSource, /updateSelectedTextRotation/);
  assert.match(compositionSource, /text\.fontFamily/);
  assert.match(compositionSource, /getTextEffectStyle\(text\.effect/);
  assert.match(stylesheetSource, /\.text-style-controls/);
});

test("shows post-generation controls for the selected caption", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /selectedCaptionClip \? \(/);
  assert.match(source, /aria-label="Caption font"/);
  assert.match(source, /aria-label="Caption text color"/);
  assert.match(source, /aria-label="Caption background enabled"/);
  assert.match(source, /aria-label="Caption effects"/);
  assert.match(source, /aria-label="Caption animation"/);
  assert.match(source, /aria-label="Caption animation speed"/);
});

test("provides an editable cutout workflow for images and videos", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, />Cutout<\/button>/);
  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /importCutoutFromGallery/);
  assert.match(source, /activeCutoutClips\.map/);
  assert.match(source, /className={`preview-cutout/);
  assert.match(source, /startCutoutInteraction\(event, cutoutClip, "move"\)/);
  assert.match(source, /label: "Cutout track"/);
  assert.match(source, /clip\.track === "cutout"/);
  assert.match(css, /\.preview-cutout\s*\{/);
  assert.match(css, /\.timeline-cutout-media\s*\{/);
});

test("Auto cutout keeps manual cutout editing while replacing visible chroma choices", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const cutoutPanel = source.slice(
    source.indexOf('</> : activeTool === "cutout" ? ('),
    source.indexOf(') : activeTool === "stickers" ? <>'),
  );

  assert.match(source, /startCutoutTimelineDrag\(event, clip\)/);
  assert.match(source, /cutoutBrushMode/);
  assert.match(source, /aria-label="Erase cutout background"/);
  assert.match(source, /aria-label="Restore cutout background"/);
  assert.match(source, /aria-label="Cutout brush size"/);
  assert.match(
    cutoutPanel,
    /aria-label="Move cutout"[\s\S]*?disabled=\{isAutoCutoutLoading\}/,
  );
  assert.match(
    cutoutPanel,
    /aria-label="Erase cutout background"[\s\S]*?disabled=\{!selectedCutoutClip \|\| isAutoCutoutLoading\}/,
  );
  assert.match(
    cutoutPanel,
    /aria-label="Restore cutout background"[\s\S]*?disabled=\{!selectedCutoutClip \|\| isAutoCutoutLoading\}/,
  );
  assert.match(
    cutoutPanel,
    /aria-label="Cutout brush size"[\s\S]*?disabled=\{!selectedCutoutClip \|\| cutoutBrushMode === "move" \|\| isAutoCutoutLoading\}/,
  );
  assert.match(
    cutoutPanel,
    /aria-label="Split cutout at playhead"[\s\S]*?disabled=\{!splitCutoutTarget \|\| isAutoCutoutLoading\}/,
  );
  assert.match(
    cutoutPanel,
    /aria-label="Reset cutout mask"[\s\S]*?disabled=\{!canResetSelectedCutout \|\| isAutoCutoutLoading\}/,
  );
  assert.match(cutoutPanel, /processSelectedCutoutAutomatically/);
  assert.match(cutoutPanel, /className="secondary-action-button auto-cutout-button"/);
  assert.match(cutoutPanel, /isAutoCutoutLoading \? "Working\.\.\." : "Auto cutout"/);
  assert.match(cutoutPanel, /disabled=\{!selectedCutoutClip \|\| isAutoCutoutLoading\}/);
  assert.doesNotMatch(cutoutPanel, />Auto image<\/button>/);
  assert.doesNotMatch(cutoutPanel, />Off<\/button>/);
  assert.doesNotMatch(cutoutPanel, />Green<\/button>/);
  assert.doesNotMatch(cutoutPanel, />White<\/button>/);
  assert.doesNotMatch(cutoutPanel, />Black<\/button>/);
  assert.doesNotMatch(source, /setSelectedCutoutChromaKey/);
  assert.match(source, /className={`workspace \$\{activeTool === "cutout" \? "cutout-workspace" : ""\}`}/);
  assert.match(source, /getCutoutChromaKeyStyle\(videoClip\)/);
  assert.match(source, /getCutoutChromaKeyStyle/);
  assert.match(source, /createCutoutMaskDataUrl/);
  assert.match(source, /continueCutoutMaskStroke/);
  assert.match(source, /finishCutoutMaskStroke/);
  assert.match(source, /resetSelectedCutoutMask/);
  assert.match(source, /erase-cutout-cursor/);
  assert.match(source, /restore-cutout-cursor/);
  assert.match(source, /preview-cutout-original/);
  assert.match(source, /createCutoutRestoreMaskDataUrl/);
  assert.match(css, /\.cutout-mask-controls/);
  assert.match(css, /\.preview-cutout\.is-masking/);
  assert.match(css, /\.preview-cutout\.erase-cutout-cursor/);
  assert.match(css, /\.preview-cutout\.restore-cutout-cursor/);
  assert.match(css, /\.preview-cutout-original/);
  assert.match(css, /\.chroma-key-defs/);
  assert.match(css, /\.workspace\.cutout-workspace/);
  assert.match(css, /\.auto-cutout-button\s*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(css, /\.preview-cutout\s*\{[^}]*max-height:/s);
  assert.doesNotMatch(css, /\.preview-cutout\.is-masking\s*\{[^}]*cursor:\s*crosshair/s);
});

test("keeps cutout brush strokes active outside the image element", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const brushHandlers = source.slice(
    source.indexOf("const startCutoutMaskStroke"),
    source.indexOf("const resetSelectedCutoutMask"),
  );

  assert.match(brushHandlers, /window\.addEventListener\("pointermove"/);
  assert.match(brushHandlers, /window\.addEventListener\("pointerup"/);
  assert.match(brushHandlers, /window\.addEventListener\("pointercancel"/);
  assert.doesNotMatch(brushHandlers, /hasPointerCapture/);
});

test("splits the cutout under the red playhead and selects its right segment", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const splitCutoutTarget =/);
  assert.match(source, /activeCutoutAtPlayhead/);
  assert.match(source, /splitSelectedCutoutAtPlayhead/);
  assert.match(source, /setSelectedClipId\(`\$\{splitCutoutTarget\.id\}-b`\)/);
  assert.match(source, /onClick=\{splitSelectedCutoutAtPlayhead\}/);
});

test("keeps the newly created right segment selected after a toolbar split", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const handlerStart = source.indexOf("const splitSelectedTrackClip");
  const handlerEnd = source.indexOf("const splitSelectedCutoutAtPlayhead", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /const targetClip =/);
  assert.match(handler, /const nextClips = splitClipByIdAtFrame/);
  assert.match(handler, /if \(nextClips === clips\)/);
  assert.match(handler, /setSelectedClipId\(`\$\{targetClip\.id\}-b`\)/);
  assert.match(handler, /setProjectStatus\("Clip split at the red playhead"\)/);
});

test("lets selected text rotate directly on the preview canvas", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(compositionSource, /className="text-rotate-handle"/);
  assert.match(compositionSource, /startTextRotateDrag\(event, textClip\)/);
  assert.match(
    compositionSource,
    /rotate: `\$\{\(text\.rotation \?\? 0\) \+ textAnimation\.rotation\}deg`/,
  );
  assert.match(compositionSource, /setTextRotationById/);
  assert.match(stylesheetSource, /\.text-rotate-handle\s*\{/);
  assert.match(stylesheetSource, /\.text-rotate-handle::before\s*\{/);
});

test("renders text entrance animation from the current timeline frame", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /getTextAnimationPresentation\(textClip, playheadFrame\)/);
  assert.match(source, /opacity: textAnimation\.opacity/);
  assert.match(source, /scale: textAnimation\.scale/);
  assert.match(
    source,
    /translate: `-50% calc\(-50% \+ \$\{textAnimation\.translateY\}px\)`/,
  );
  assert.doesNotMatch(
    stylesheetSource,
    /\.preview-text-overlay\s*\{[^}]*translate:\s*-50%\s*-50%/s,
  );
});

test("offers per-clip entrance animations in selected text controls", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const textAnimationOptions/);
  assert.match(source, /aria-label="Text animation"/);
  assert.match(source, /updateSelectedTextStyle\(\{animation: option\.id\}\)/);
  assert.match(source, /selectedTextStyle\.animation === option\.id/);
  assert.match(source, /aria-pressed=\{selectedTextStyle\.animation === option\.id\}/);
  for (const label of [
    "None",
    "Pop",
    "Jump",
    "Fade",
    "Star Jump",
    "Bounce",
    "Typewriter",
    "Wave",
    "Flicker",
    "Spin In",
  ]) {
    assert.match(source, new RegExp(`label: "${label}"`));
  }
  assert.match(source, /getTextAnimationVisibleCharacterCount/);
  assert.match(source, /getTextAnimationWordPresentation/);
  assert.match(source, /getTextAnimationStars/);
  assert.match(source, /className="animated-text-word"/);
  assert.match(source, /className="text-animation-star"/);
  assert.doesNotMatch(source, /Math\.random\(\)/);
});

test("keeps text animation labels inside responsive preset buttons", () => {
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(
    stylesheetSource,
    /\.text-animation-options\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(104px,\s*1fr\)\)/s,
  );
  assert.match(
    stylesheetSource,
    /\.text-animation-options button\s*\{[^}]*min-height:\s*44px[^}]*height:\s*auto[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s,
  );
});

test("wires contextual linked audio into overlay import, selection, and timeline rendering", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(compositionSource, /createVideoMediaPair/);
  assert.match(compositionSource, /placeVideoPairOnLayer/);
  assert.match(
    compositionSource,
    /const contextualAudioClips = useMemo\(\s*\(\) => getContextualAudioClips\(clips, contextualAudioSelectionId\),\s*\[clips, contextualAudioSelectionId\],\s*\)/,
  );
  assert.match(
    compositionSource,
    /track: videoLayer === 0 \? "main" : "upper"/,
  );
  assert.match(
    compositionSource,
    /selectedClip\?\.track === "audio"\s*\? selectedClip\.linkedClipId \?\? null/,
  );
  assert.match(
    compositionSource,
    /contextualAudioClipIds\.has\(clip\.id\)/,
  );
});

test("routes scene ranges through shared main and signed-layer placement", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const factoryStart = compositionSource.indexOf(
    "const createMediaTimelineClips = useCallback",
  );
  const factoryEnd = compositionSource.indexOf(
    "const placeMediaOnVideoLayer",
    factoryStart,
  );
  const directPlacementEnd = compositionSource.indexOf(
    "const togglePreviewPlayback",
    factoryEnd,
  );
  const pointerPlacementStart = compositionSource.indexOf(
    'if (pointerDrag.type === "media")',
    directPlacementEnd,
  );
  const pointerPlacementEnd = compositionSource.indexOf(
    "window.addEventListener",
    pointerPlacementStart,
  );

  assert.ok(factoryStart >= 0, "expected shared media timeline factory");
  assert.ok(factoryEnd > factoryStart, "expected media timeline factory boundary");
  assert.match(
    compositionSource.slice(factoryStart, factoryEnd),
    /createVideoMediaPair\(\{[\s\S]*sourceStart: mediaItem\.sourceStart \?\? 0/,
  );
  assert.match(
    compositionSource.slice(factoryEnd, directPlacementEnd),
    /createMediaTimelineClips\([\s\S]*placeVideoPairOnLayer/,
  );
  assert.match(
    compositionSource.slice(pointerPlacementStart, pointerPlacementEnd),
    /kind === "insert-layer"[\s\S]*createMediaTimelineClips\([\s\S]*placeVideoPairInInsertedLayer/,
  );
});

test("allows selected audio clips to use the selected clip speed control", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    compositionSource,
    /const canEditSelectedSpeed = hasSelectedVideoLayer \|\|\s*clipControlTarget\?\.track === "main" \|\|\s*clipControlTarget\?\.track === "upper" \|\|\s*clipControlTarget\?\.track === "cutout" \|\|\s*clipControlTarget\?\.track === "audio"/,
  );
  assert.match(
    compositionSource,
    /const canEditSelectedVisual =\s*clipControlTarget\?\.track === "main" \|\|\s*clipControlTarget\?\.track === "upper"/,
  );
  assert.match(
    compositionSource,
    /clipControlTarget\s*\? setClipSpeedById\(currentClips, clipControlTarget\.id, speed\)/,
  );
  assert.match(compositionSource, /disabled=\{!canEditSelectedSpeed\}/);
});

test("routes speed and volume to a selected video layer or one selected clip", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[selectedVideoLayer, setSelectedVideoLayer\] = useState<number \| null>\(null\)/);
  assert.match(
    source,
    /const selectWholeVideoLayer = \(videoLayer: number\) => \{[\s\S]*?setSelectedVideoLayer\(videoLayer\);[\s\S]*?setSelectedClipId\(null\);/,
  );
  assert.match(
    source,
    /event\.target === event\.currentTarget[\s\S]*?selectWholeVideoLayer\(track\.videoLayer\)/,
  );
  assert.match(source, /setVideoLayerSpeed\(currentClips, selectedVideoLayer, speed\)/);
  assert.match(source, /setVideoLayerVolume\(currentClips, selectedVideoLayer, volume\)/);
  assert.match(source, /getVideoLayerControlState\(\s*clips,\s*selectedVideoLayer,\s*\)/);
  assert.match(source, /clipControlTarget \|\| selectedVideoLayer !== null/);
  assert.match(source, /const canEditSelectedSpeed = hasSelectedVideoLayer \|\|/);
  assert.match(source, /const canEditSelectedVolume = hasSelectedVideoLayer \|\|/);
  assert.match(source, /selectedVideoLayer === track\.videoLayer/);
  assert.match(source, /Track controls/);
});

test("uses executable layer-control state and history helpers and clears layer selection on direct drops", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

  assert.match(source, /getVideoLayerControlState\(\s*clips,\s*selectedVideoLayer,\s*\)/);
  assert.match(source, /startVideoLayerControlHistoryGesture\(\s*clipsRef\.current,\s*selectedVideoLayer,\s*property,\s*\)/);
  assert.match(source, /previewVideoLayerControlHistoryGesture\(drag, value\)/);
  assert.match(source, /finishVideoLayerControlHistoryGesture\(currentHistory, drag\)/);
  assert.match(source, /onPointerDown=\{\(\) => startVideoLayerControlDrag\("speed"\)\}/);
  assert.match(source, /onPointerUp=\{finishVideoLayerControlDrag\}/);
  assert.match(source, /onPointerDown=\{\(\) => startVideoLayerControlDrag\("volume"\)\}/);

  const appendStart = source.indexOf('if (target?.kind === "append-main")');
  const insertStart = source.indexOf('} else if (target?.kind === "insert-layer")');
  const directDropEnd = source.indexOf('} else {', insertStart);
  assert.ok(appendStart >= 0 && insertStart > appendStart && directDropEnd > insertStart);
  assert.match(source.slice(appendStart, insertStart), /setSelectedClipId\(videoId\);\s*setSelectedVideoLayer\(null\);/);
  assert.match(source.slice(insertStart, directDropEnd), /setSelectedClipId\(videoId\);\s*setSelectedVideoLayer\(null\);/);
});

test("keeps overlay preview playback synchronized with the editor", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const overlayStart = compositionSource.indexOf("timelinePreviewVideoClips.map");
  const overlayEnd = compositionSource.indexOf(
    "playbackAudioClips.map",
    overlayStart,
  );
  assert.notEqual(overlayStart, -1, "layer preview block should exist");
  assert.notEqual(overlayEnd, -1, "layer preview block should have an end");
  const overlayPreview = compositionSource.slice(overlayStart, overlayEnd);

  assert.doesNotMatch(overlayPreview, /autoPlay/);
  assert.match(overlayPreview, /preload="auto"/);
  assert.match(
    overlayPreview,
    /getClipSourceTime\(\s*videoClip,\s*isActiveVideoClip \? playheadFrame : videoClip\.start,\s*fps,?\s*\)/,
  );
  assert.match(
    overlayPreview,
    /if \(isPreviewPlaying && isActiveVideoClip\)[\s\S]*?video\.play\(\)[\s\S]*?else[\s\S]*?video\.pause\(\)/,
  );
});

test("uses each media item's real duration when adding an overlay", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const overlayStart = compositionSource.indexOf(
    "const placeMediaOnVideoLayer",
  );
  const overlayEnd = compositionSource.indexOf(
    "const togglePreviewPlayback",
    overlayStart,
  );

  assert.notEqual(overlayStart, -1, "video layer placement function should exist");
  assert.notEqual(overlayEnd, -1, "video layer placement function should have an end");
  const overlayAppend = compositionSource.slice(overlayStart, overlayEnd);

  assert.match(overlayAppend, /duration:\s*mediaItem\.durationInFrames/);
  assert.doesNotMatch(overlayAppend, /duration:\s*120/);
  assert.match(compositionSource, /loadedmetadata/);
});

test("wires effects and filters tabs to selected clip visual controls", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(compositionSource, /activeTool === "effects"/);
  assert.match(compositionSource, /activeTool === "filters"/);
  assert.match(compositionSource, /updateSelectedClipEffect\(option\.id\)/);
  assert.match(compositionSource, /updateSelectedClipFilter\(option\.id\)/);
  assert.match(compositionSource, /getClipFrameStyle\(videoClip, playheadFrame\)/);
  assert.match(compositionSource, /getClipAdjustmentStyle\(videoClip\)/);
  assert.match(stylesheetSource, /\.visual-option-grid/);
});

test("offers an on-canvas rotation handle in manual adjustment mode", () => {
  const compositionSource = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const stylesheetSource = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(compositionSource, /getManualRotationAngle/);
  assert.match(compositionSource, /getVisibleRotateHandleTop/);
  assert.match(compositionSource, /rotateDrag/);
  assert.match(compositionSource, /startManualRotate/);
  assert.match(compositionSource, /className="preview-shell"/);
  assert.match(compositionSource, /className="rotate-handle canvas-rotate-handle"/);
  assert.match(compositionSource, /aria-label="Rotate selected clip"/);
  assert.match(
    stylesheetSource,
    /\.preview-shell:has\(\.canvas-rotate-handle\)\s*\{[^}]*padding-top:\s*30px/s,
  );
  assert.match(stylesheetSource, /\.rotate-handle/);
  assert.match(stylesheetSource, /\.canvas-rotate-handle/);
});

test("drives the editor timeline from all clips without a fixed 16 second ruler", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const projectDuration = useMemo\(\(\) => getTimelineDuration\(clips\)/,
  );
  assert.match(source, /createTimelineTicks\(projectDuration, fps\)/);
  assert.match(source, /formatTimelineClock\(projectDuration, fps\)/);
  assert.doesNotMatch(source, /<span>00:16<\/span>/);
});

test("uses a 24 hour Remotion registration fallback instead of the media fallback", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const remotionRegistrationFallbackInFrames = 24 \* 60 \* 60 \* fps/,
  );
  assert.match(
    source,
    /durationInFrames=\{remotionRegistrationFallbackInFrames\}/,
  );
  assert.doesNotMatch(
    source,
    /durationInFrames=\{defaultMediaDurationInFrames\}/,
  );
});

test("expands clip move boundaries and shares scroll-aware pointer coordinates", () => {
  const component = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(component, /const timelineOrigin = 148/);
  assert.match(
    component,
    /getTimelineFrameFromPointer\(\s*clientX,\s*bounds\.left,\s*timelineOrigin,\s*timelineScale,?\s*\)/,
  );
  assert.match(
    component,
    /getExpandedTimelineBoundary\(\s*projectDuration,\s*targetStart,\s*target\.duration,?\s*\)/,
  );
  assert.match(
    component,
    /getExpandedTimelineBoundary\(\s*projectDuration,\s*targetStart,\s*originalClip\.duration,?\s*\)/,
  );
  assert.doesNotMatch(component, /clientX - bounds\.left/);
  assert.match(css, /--timeline-origin/);
  assert.match(css, /var\(--timeline-origin\)/);
});

test("advances timeline playback at a constant rate without clip speed", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const toggleStart = source.indexOf("const togglePreviewPlayback");
  const toggleEnd = source.indexOf("const toggleVoiceRecording", toggleStart);
  const togglePlayback = source.slice(toggleStart, toggleEnd);
  const timerStart = source.indexOf("const playbackTimer");
  const timerEnd = source.indexOf("return (", timerStart);
  const playbackTimer = source.slice(timerStart, timerEnd);

  assert.doesNotMatch(togglePlayback, /if \(!video\)/);
  assert.match(togglePlayback, /previewVideoRef\.current\?\.pause\(\)/);
  assert.doesNotMatch(playbackTimer, /currentClip\?\.speed/);
  assert.doesNotMatch(playbackTimer, /previewSource/);
  assert.match(source, /const isTimelinePreview = previewMode === "timeline"/);
  assert.match(
    source,
    /\{previewSource\?\.src \|\| isTimelinePreview \? \(/,
  );
  assert.match(source, /isTimelinePreview\s*\? playbackAudioClips\.map/);
  assert.match(source, /timelinePreviewVideoClips\.map\(\(videoClip\)\s*=>/);
  assert.match(source, /isTimelinePreview\s*\? activeStickerClips\.map/);
  assert.match(source, /isTimelinePreview\s*\? activeTextClips\.map/);
  assert.ok(
    source.indexOf('className="preview-play-button"') >
      source.indexOf("activeTextClips.map"),
  );
});

test("toggles timeline playback state even when the gallery preview ref is absent", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const toggleStart = source.indexOf("const togglePreviewPlayback");
  const toggleEnd = source.indexOf("const toggleVoiceRecording", toggleStart);
  const togglePlayback = source.slice(toggleStart, toggleEnd);

  assert.doesNotMatch(togglePlayback, /const video = previewVideoRef\.current/);
  assert.doesNotMatch(togglePlayback, /if \(!video\)/);
  assert.match(togglePlayback, /setIsPreviewPlaying\(true\)/);
  assert.match(togglePlayback, /previewVideoRef\.current\?\.pause\(\)/);
  assert.doesNotMatch(togglePlayback, /previewVideoRef\.current\?\.play\(\)/);
});

test("keeps ordinary media preview unrestricted while scenes use range preview", () => {
  const isDetectedSceneMediaItem = loadIsDetectedSceneMediaItem();
  const ordinaryVideo: SavedMediaItem = {
    id: "ordinary-video",
    label: "Ordinary.mp4",
    src: "ordinary.mp4",
    duration: "00:05",
    durationInFrames: 150,
    kind: "public",
    mediaType: "video",
  };
  const detectedScene: SavedMediaItem = {
    ...ordinaryVideo,
    id: "scene-source-1-30",
    label: "Ordinary - Scene 2",
    sourceFileId: "source-1",
    sourceStart: 30,
    sceneIndex: 2,
  };

  assert.equal(isDetectedSceneMediaItem(ordinaryVideo), false);
  assert.equal(isDetectedSceneMediaItem(detectedScene), true);

  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const toggleStart = source.indexOf("const togglePreviewPlayback");
  const toggleEnd = source.indexOf("const toggleTimelinePlayback", toggleStart);
  const togglePlayback = source.slice(toggleStart, toggleEnd);
  const mediaToggleStart = source.indexOf("const toggleMediaPreviewPlayback");
  const mediaToggleEnd = source.indexOf("const toggleVoiceRecording", mediaToggleStart);
  const mediaTogglePlayback = source.slice(mediaToggleStart, mediaToggleEnd);
  const timeUpdateStart = source.indexOf("const handleMediaPreviewTimeUpdate");
  const timeUpdateEnd = source.indexOf("const splitSelectedMediaScene", timeUpdateStart);
  const timeUpdateHandler = source.slice(timeUpdateStart, timeUpdateEnd);

  assert.match(
    source,
    /const isSelectedMediaScene =\s*selectedMediaType === "video" &&\s*isDetectedSceneMediaItem\(selectedMedia\)/,
  );
  assert.match(timeUpdateHandler, /if \(!isSelectedMediaScene\) \{\s*return;/);
  assert.match(
    source,
    /if \(previewMode !== "media" \|\| !isSelectedMediaScene\) \{\s*return;/,
  );
  assert.match(
    mediaTogglePlayback,
    /isSelectedMediaScene &&[\s\S]*?currentTime >= mediaPreviewEndSeconds/,
  );
  assert.match(togglePlayback, /setPreviewMode\("timeline"\)/);
  assert.doesNotMatch(togglePlayback, /isSelectedMediaScene/);
});

test("seeks the media preview to the selected scene and loops at its end", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const toggleStart = source.indexOf("const toggleMediaPreviewPlayback");
  const toggleEnd = source.indexOf("const toggleVoiceRecording", toggleStart);
  const togglePlayback = source.slice(toggleStart, toggleEnd);

  assert.match(
    source,
    /const mediaPreviewStartSeconds = \(selectedMedia\?\.sourceStart \?\? 0\) \/ fps/,
  );
  assert.match(
    source,
    /const mediaPreviewEndSeconds =\s*mediaPreviewStartSeconds \+\s*\(selectedMedia\?\.durationInFrames \?\? 0\) \/ fps/,
  );
  assert.match(
    source,
    /const seekToMediaPreviewStart = \(\) => \{[\s\S]*?currentTime = mediaPreviewStartSeconds/,
  );
  assert.match(
    source,
    /addEventListener\("loadedmetadata", seekToMediaPreviewStart\)/,
  );
  assert.match(
    source,
    /}, \[isSelectedMediaScene, mediaPreviewStartSeconds, previewMode, selectedMediaId\]\)/,
  );
  assert.match(
    source,
    /currentTime >= mediaPreviewEndSeconds[\s\S]*?currentTime = mediaPreviewStartSeconds/,
  );
  assert.match(
    source,
    /if \(isMediaPreviewPlaying\) \{\s*void video\.play\(\)\.catch\(\(\) => undefined\);\s*\} else \{\s*video\.pause\(\)/,
  );
  assert.match(source, /onTimeUpdate=\{handleMediaPreviewTimeUpdate\}/);
  assert.match(
    togglePlayback,
    /currentTime >= mediaPreviewEndSeconds[\s\S]*?currentTime = mediaPreviewStartSeconds/,
  );
  assert.match(
    source,
    /if \(previewMode !== "media" \|\| !selectedMedia \|\| getMediaItemType\(selectedMedia\) === "image"\)/,
  );
});

test("splits only the selected video scene at the relative preview frame", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const splitStart = source.indexOf("const splitSelectedMediaScene");
  const splitEnd = source.indexOf("const deleteMediaItem", splitStart);
  const splitAction = source.slice(splitStart, splitEnd);

  assert.match(source, /splitSceneMediaItemAtFrame,/);
  assert.match(
    source,
    /setMediaPreviewFrame\(getMediaPreviewFrame\(video\.currentTime\)\)/,
  );
  assert.match(source, /const mediaPreviewSeekMinSeconds = isSelectedMediaScene/);
  assert.match(source, /const mediaPreviewSeekMaxSeconds = isSelectedMediaScene/);
  assert.match(source, /Math\.min\(\s*selectedMedia\?\.durationInFrames \?\? 0/);
  assert.match(splitAction, /splitSceneMediaItemAtFrame\(\{/);
  assert.match(splitAction, /mediaItems,/);
  assert.match(splitAction, /mediaId: mediaItem\.id/);
  assert.match(splitAction, /relativeFrame: mediaPreviewFrame/);
  assert.match(splitAction, /if \(nextMediaItems === mediaItems\)/);
  assert.match(splitAction, /setMediaItems\(nextMediaItems\)/);
  assert.match(splitAction, /setSelectedMediaId\(mediaItem\.id\)/);
  assert.match(splitAction, /setProjectStatus\("Scene split"\)/);
  assert.match(
    source,
    /selectedMediaId === mediaItem\.id &&\s*mediaItem\.sourceFileId &&\s*getMediaItemType\(mediaItem\) === "video"/,
  );
  assert.match(source, /aria-label="Split scene"/);
  assert.match(source, /className="media-split-button"/);
  assert.match(
    source,
    /disabled=\{mediaPreviewFrame <= 0 \|\|\s*mediaPreviewFrame >= mediaItem\.durationInFrames\}/,
  );
  assert.match(css, /\.media-split-button\s*\{[^}]*width:\s*22px[^}]*height:\s*22px/s);
});

test("keeps new video layer drop rows aligned to the same timeline lane origin", () => {
  const component = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const newLayerRule = css.slice(
    css.indexOf(".new-video-layer-drop"),
    css.indexOf(".new-video-layer-drop .track-lane"),
  );

  assert.match(
    component,
    /className=\{`timeline-track new-video-layer-drop/,
  );
  assert.match(
    css,
    /\.timeline-track\s*\{[^}]*grid-template-columns:\s*calc\(var\(--timeline-origin\) - 10px\) 1fr[^}]*gap:\s*10px/s,
  );
  assert.doesNotMatch(newLayerRule, /grid-template-columns/);
});
test("clamps a stale playhead after project duration shrinks", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setPlayheadFrame\(\(currentFrame\) =>\s*clampPlayheadFrame\(currentFrame, projectDuration\)/,
  );
});

test("keeps trim and text drag deltas anchored while the canvas resizes", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /type TrimDrag = \{[\s\S]*?contentLeft: number/);
  assert.match(source, /type TextTimelineDrag = \{[\s\S]*?contentLeft: number/);
  assert.match(
    source,
    /getStableTimelineFrameDelta\(\s*event\.clientX,\s*trimDrag\.startFrame,\s*trimDrag\.contentLeft,\s*timelineOrigin,\s*timelineScale,?\s*\)/,
  );
  assert.match(
    source,
    /getStableTimelineFrameDelta\(\s*event\.clientX,\s*textTimelineDrag\.startFrame,\s*textTimelineDrag\.contentLeft,\s*timelineOrigin,\s*timelineScale,?\s*\)/,
  );
});

test("constrains timeline rows to a two-axis scrolling area", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.timeline-panel\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*34px minmax\(0, 1fr\)[^}]*min-height:\s*0/s,
  );
  assert.match(
    css,
    /\.timeline-scroll\s*\{[^}]*min-height:\s*0[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*auto/s,
  );
});

test("keeps long timelines readable in a horizontal scrolling canvas", () => {
  const component = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(component, /const timelineContentRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(component, /className="timeline-scroll"/);
  assert.match(component, /className="timeline-content"/);
  assert.match(
    component,
    /minWidth:\s*`\$\{timelineOrigin \+ timelineCanvasWidth \+ 24\}px`/,
  );
  assert.match(
    component,
    /timelineContentRef\.current\?\.getBoundingClientRect\(\)/,
  );
  assert.doesNotMatch(component, /timelinePanelRef/);
  assert.match(css, /\.timeline-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.track-label\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/s);
  assert.match(
    css,
    /\.timeline-ruler span\s*\{[^}]*position:\s*absolute/s,
  );
});

test("Task 2 playback uses the executable step in the timeline interval", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const sourceFile = ts.createSourceFile(
    "Composition.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const calls: ts.CallExpression[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "stepTimelinePlayback"
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0].arguments.map((argument) => argument.getText(sourceFile)),
    ["currentFrame", "projectDuration"],
  );
});

test("keeps sticky track labels above clips while the timeline scrolls", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.track-label\s*\{[^}]*position:\s*sticky[^}]*left:\s*0[^}]*align-self:\s*stretch[^}]*overflow:\s*hidden[^}]*box-shadow:\s*10px 0 0 #0d1117/s,
  );
});

test("keeps new video layer drop targets accessible without visible wording", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /data-new-video-layer="above"\s+role="group"\s+aria-label="Add video track above"/,
  );
  assert.equal(
    (
      source.match(
        /data-new-video-layer="below"\s+role="group"\s+aria-label="Add video track below"/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(source, />New track above</);
  assert.doesNotMatch(source, />New track below</);
});

test("handles rejected native media playback promises", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const handledPlaybackCalls = source.match(
    /\.play\(\)\.catch\(\(\) => undefined\)/g,
  );

  assert.equal(handledPlaybackCalls?.length, 5);
});

test("supports inserting a video layer between existing video rows", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-insert-video-layer=\{insertVideoLayer\}/);
  assert.match(source, /kind: "insert-layer"; videoLayer: number/);
  assert.match(source, /placeVideoPairInInsertedLayer/);
  assert.match(source, /aria-label="Insert video track here"/);
});

test("provides a direct append target after the last main-track clip", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /kind: "append-main"/);
  assert.match(source, /data-append-main-track/);
  assert.match(source, /getVideoLayerEnd\(currentClips, 0\)/);
  assert.match(source, /aria-label="Append media to main track"/);
  assert.match(source, /const mainAppendVisibleOverlap = 48/);
  assert.match(source, /mainVideoLayerEnd \* timelineScale - mainAppendVisibleOverlap/);
  assert.match(css, /\.main-track-append-target/);
});

test("hides secondary video layer labels and compacts add-layer spacing", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /label: `Video layer \+\$\{videoLayer\}`/);
  assert.doesNotMatch(source, /label: `Video layer \$\{videoLayer\}`/);
  assert.equal(
    (
      source.match(
        /track\.videoLayer !== undefined && track\.videoLayer !== 0/g,
      ) ?? []
    ).length,
    3,
  );
  assert.match(
    source,
    /role=\{track\.videoLayer !== undefined && track\.videoLayer !== 0 \? "group" : undefined\}/,
  );
  assert.match(
    source,
    /aria-label=\{track\.videoLayer !== undefined && track\.videoLayer !== 0/,
  );
  assert.match(
    source,
    /\{track\.videoLayer !== undefined && track\.videoLayer !== 0 \? "" : track\.label\}/,
  );
  assert.match(
    source,
    /key: "main", id: "main" as TrackName, label: "Main track", videoLayer: 0/,
  );
  assert.match(source, /key: "audio", id: "audio" as TrackName, label: "Audio track"/);
  assert.match(
    source,
    /`Video layer \$\{\s*track\.videoLayer > 0 \? `\+\$\{track\.videoLayer\}` : track\.videoLayer\s*\}`/,
  );
  assert.match(css, /\.new-video-layer-drop\s*\{[^}]*height:\s*10px/s);
  assert.match(css, /\.new-video-layer-drop \.track-lane\s*\{[^}]*height:\s*10px/s);
});

test("keeps the timeline lower so the preview workspace stays centered", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.editor-shell\s*\{[^}]*grid-template-rows:\s*48px minmax\(420px, 1fr\) 260px/s,
  );
});

test("rejects stale silence-removal results without adding history", () => {
  const decideAction = loadDecideSilenceRemovalAction();
  const original = createSilenceRemovalPair();
  const initialHistory = createTimelineHistory(original);
  const staleSelection = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 5,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [{startSeconds: 2, endSeconds: 3}],
    fps: 30,
  });
  const staleTiming = decideAction({
    currentClips: [
      {...original[0], sourceStart: 60},
      original[1],
    ],
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [{startSeconds: 2, endSeconds: 3}],
    fps: 30,
  });
  const inactiveRequest = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: false,
    snapshot: silenceRemovalSnapshot,
    ranges: [{startSeconds: 2, endSeconds: 3}],
    fps: 30,
  });
  const historyAfterStaleResult = applyTimelineHistoryEdit(
    initialHistory,
    staleSelection.clips,
  );

  assert.equal(staleSelection.outcome, "stale");
  assert.equal(staleTiming.outcome, "stale");
  assert.equal(inactiveRequest.outcome, "stale");
  assert.equal(staleSelection.selection, null);
  assert.deepEqual(staleSelection.status, {kind: "idle", message: ""});
  assert.deepEqual(inactiveRequest.status, {kind: "idle", message: ""});
  assert.strictEqual(historyAfterStaleResult, initialHistory);
  assert.equal(historyAfterStaleResult.past.length, 0);
});

test("rejects silence removal before analysis when reciprocal audio is missing", () => {
  const {decideSilenceRemovalPreflight} = loadSilenceRemovalHelpers();
  const original = createSilenceRemovalPair();
  const clipsWithoutReciprocalAudio = [
    original[0],
    {...original[1], linkedClipId: "different-video"},
  ];
  const initialHistory = createTimelineHistory(clipsWithoutReciprocalAudio);
  const decision = decideSilenceRemovalPreflight(
    initialHistory.present,
    "video",
  );
  const historyAfterPreflight = applyTimelineHistoryEdit(
    initialHistory,
    decision.clips,
  );

  assert.equal(decision.outcome, "missing-linked-audio");
  assert.deepEqual(decision.status, {
    kind: "error",
    message: "The selected video has no linked audio to clean up.",
  });
  assert.strictEqual(decision.clips, initialHistory.present);
  assert.strictEqual(historyAfterPreflight, initialHistory);
  assert.equal(historyAfterPreflight.past.length, 0);
  assert.equal(
    decideSilenceRemovalPreflight(original, "video").outcome,
    "ready",
  );
});

test("does not add history when silence removal is unchanged or leaves no segment", () => {
  const decideAction = loadDecideSilenceRemovalAction();
  const original = createSilenceRemovalPair();
  const initialHistory = createTimelineHistory(original);
  const unchanged = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [{startSeconds: 12, endSeconds: 13}],
    fps: 30,
  });
  const fullSilence = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [{startSeconds: 0, endSeconds: 10}],
    fps: 30,
  });
  const emptyRanges = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [],
    fps: 30,
  });
  const historyAfterNoop = applyTimelineHistoryEdit(
    initialHistory,
    fullSilence.clips,
  );

  assert.equal(unchanged.outcome, "no-removable-silence");
  assert.equal(fullSilence.outcome, "no-removable-silence");
  assert.equal(emptyRanges.outcome, "no-removable-silence");
  assert.equal(fullSilence.selection, null);
  assert.deepEqual(fullSilence.status, {
    kind: "success",
    message: "No removable silence was found.",
  });
  assert.strictEqual(historyAfterNoop, initialHistory);
  assert.equal(historyAfterNoop.past.length, 0);
});

test("adds one history entry, selects the first actual segment, and undoes once", () => {
  const decideAction = loadDecideSilenceRemovalAction();
  const original = createSilenceRemovalPair();
  const initialHistory = createTimelineHistory(original);
  const decision = decideAction({
    currentClips: initialHistory.present,
    selectedClipId: "video",
    selectionVersion: 4,
    requestIsActive: true,
    snapshot: silenceRemovalSnapshot,
    ranges: [
      {startSeconds: 2, endSeconds: 3},
      {startSeconds: 6, endSeconds: 7},
    ],
    fps: 30,
  });

  assert.equal(decision.outcome, "committed");
  const committedHistory = applyTimelineHistoryEdit(initialHistory, decision.clips);
  const actualVideoSegments = committedHistory.present
    .filter((clip) => clip.id.startsWith("video-speech-"))
    .sort((left, right) => left.start - right.start);

  assert.equal(committedHistory.past.length, 1);
  assert.equal(decision.selection?.clipId, actualVideoSegments[0]?.id);
  assert.ok(
    committedHistory.present.some(
      (clip) => clip.id === decision.selection?.clipId,
    ),
  );
  assert.deepEqual(decision.status, {
    kind: "success",
    message: "Removed 2 silent pauses.",
  });
  const undoneHistory = undoTimelineHistory(committedHistory);
  assert.deepEqual(undoneHistory.present, original);
  assert.equal(undoneHistory.past.length, 0);
});

test("mutates silence-removal UI only after a real commit", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const silenceAction = source.slice(
    source.indexOf("const removeSilenceAutomatically = useCallback(async () => {"),
    source.indexOf("const duplicateSelectedSticker"),
  );

  assert.equal(
    silenceAction.match(/commitClipChange\(\(currentClips\) =>/g)?.length,
    1,
  );
  assert.match(silenceAction, /flushSync\(\(\) => \{\s*commitClipChange/);
  assert.match(silenceAction, /decideSilenceRemovalAction\(/);
  assert.match(
    silenceAction,
    /const actionDecision = actionDecisionRef\.current;[\s\S]*setCaptionStatus\(actionDecision\.status\);\s*if \(actionDecision\.outcome !== "committed"\) \{\s*return;\s*\}\s*setSelectedClipId\(actionDecision\.selection\.clipId\)/,
  );
  assert.doesNotMatch(silenceAction, /setSelectedClipId\(`\$\{sourceClipId\}-speech-0`\)/);
  assert.match(silenceAction, /setSelectedTrack\(actionDecision\.selection\.track\)/);
  assert.match(
    silenceAction,
    /const finishInactiveSilenceRequest = \(\) => \{[\s\S]*setCaptionStatus\(\{kind: "idle", message: ""\}\)/,
  );
  assert.doesNotMatch(
    silenceAction,
    /if \(!isActiveSilenceRequest\(\)\) \{\s*return;/,
  );
  assert.match(silenceAction, /setPreviewMode\("timeline"\)/);
  assert.match(
    css,
    /\.transcript-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[^}]*gap:\s*8px/s,
  );
  assert.match(
    css,
    /@media[^}]*\{[\s\S]*?\.transcript-actions\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
});

test("keeps tall tool panels scrollable above the timeline", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /\.media-panel\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.media-library\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.media-library\s*\{[^}]*padding:\s*12px 12px 42px/s);
});

test("keeps tall details controls scrollable", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /\.details-panel\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.details-panel\s*\{[^}]*padding:\s*12px 12px 42px/s);
  assert.match(css, /\.details-panel\s*\{[^}]*overflow-y:\s*auto/s);
});

test("gives the settings panel more room without shrinking the preview", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.workspace\s*\{[^}]*clamp\(300px,\s*24vw,\s*400px\)[^}]*clamp\(420px,\s*36vw,\s*620px\)[^}]*minmax\(480px,\s*1fr\)/s,
  );
});

test("wires save export text resizing and audio waveform UI", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /onClick=\{saveProjectToStorage\}/);
  assert.match(source, /onClick=\{\(\) => void exportProjectVideo\(\)\}/);
  assert.match(source, /fetch\("\/api\/export"/);
  assert.match(source, /downloadBrowserFile\(/);
  assert.match(source, /video-editor-project-/);
  assert.match(source, /disabled=\{isExporting\}/);
  assert.match(source, /className="text-resize-handle text-resize-handle-bottom-right"/);
  assert.match(source, /startTextResizeDrag\(event, textClip, "bottom-right"\)/);
  assert.match(source, /className="audio-waveform"/);
  assert.match(css, /\.project-actions\s*\{/);
  assert.match(css, /\.text-resize-handle\s*\{/);
  assert.match(css, /\.timeline-clip \.audio-waveform\s*\{/);
});

test("analyzes imported videos concurrently and creates only scene cards", async () => {
  const analyzeImportedVideo = loadAnalyzeImportedVideo();
  const starts: string[] = [];
  let resolveDuration!: (durationInFrames: number) => void;
  let resolveUpload!: (upload: {
    src: string;
    label: string;
    mimeType: string;
  }) => void;
  let resolveDetection!: (ranges: Array<{
    startSeconds: number;
    endSeconds: number;
  }>) => void;
  const file = new File(["video"], "interview.mp4", {type: "video/mp4"});

  const pendingAnalysis = analyzeImportedVideo({
    file,
    sourceFileId: "source-1",
    previewSrc: "blob:preview",
    detectVideoScenes: async () => {
      starts.push("detection");
      return new Promise((resolve) => {
        resolveDetection = resolve;
      });
    },
    createSceneMediaItems,
    readDurationInFrames: async () => {
      starts.push("duration");
      return new Promise((resolve) => {
        resolveDuration = resolve;
      });
    },
    uploadMedia: async () => {
      starts.push("upload");
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    },
  });

  assert.deepEqual(starts, ["duration", "upload", "detection"]);
  resolveDuration(150);
  resolveUpload({
    src: "uploads/interview.mp4",
    label: "Interview.mp4",
    mimeType: "video/mp4",
  });
  resolveDetection([
    {startSeconds: 0, endSeconds: 2},
    {startSeconds: 2, endSeconds: 5},
  ]);

  const result = await pendingAnalysis;

  assert.equal(result.usedFallback, false);
  assert.deepEqual(
    result.sceneItems.map((item) => ({
      label: item.label,
      durationInFrames: item.durationInFrames,
      sourceStart: item.sourceStart,
    })),
    [
      {label: "Interview - Scene 1", durationInFrames: 60, sourceStart: 0},
      {label: "Interview - Scene 2", durationInFrames: 90, sourceStart: 60},
    ],
  );
});

test("creates one full-duration fallback scene when detection fails", async () => {
  const analyzeImportedVideo = loadAnalyzeImportedVideo();
  const file = new File(["video"], "single-take.mp4", {type: "video/mp4"});

  const result = await analyzeImportedVideo({
    file,
    sourceFileId: "source-fallback",
    previewSrc: "blob:fallback",
    detectVideoScenes: async () => {
      throw new Error("detector unavailable");
    },
    createSceneMediaItems,
    readDurationInFrames: async () => 150,
    uploadMedia: async () => ({
      src: "uploads/single-take.mp4",
      label: "Single take.mp4",
      mimeType: "video/mp4",
    }),
  });

  assert.equal(result.usedFallback, true);
  assert.equal(result.sceneItems.length, 1);
  assert.deepEqual(result.sceneItems[0], {
    id: "scene-source-fallback-0",
    label: "Single take - Scene 1",
    src: "uploads/single-take.mp4",
    duration: "00:05",
    durationInFrames: 150,
    kind: "local",
    mediaType: "video",
    sourceStart: 0,
    sourceDurationInFrames: 150,
    sourceFileId: "source-fallback",
    sceneIndex: 1,
  });
});

test("treats a successful one-scene detection as a valid no-cut result", async () => {
  const analyzeImportedVideo = loadAnalyzeImportedVideo();
  const file = new File(["video"], "continuous-shot.mp4", {type: "video/mp4"});

  const result = await analyzeImportedVideo({
    file,
    sourceFileId: "source-no-cuts",
    previewSrc: "blob:no-cuts",
    detectVideoScenes: async () => [{startSeconds: 0, endSeconds: 5}],
    createSceneMediaItems,
    readDurationInFrames: async () => 150,
    uploadMedia: async () => ({
      src: "uploads/continuous-shot.mp4",
      label: "Continuous shot.mp4",
      mimeType: "video/mp4",
    }),
  });

  assert.equal(result.usedFallback, false);
  assert.equal(result.sceneItems.length, 1);
  assert.equal(result.sceneItems[0].durationInFrames, 150);
});

test("limits concurrent imports to two while preserving result order", async () => {
  const mapWithConcurrency = loadMapWithConcurrency();
  const releases: Array<() => void> = [];
  const gates = [0, 1, 2, 3].map((index) =>
    new Promise<void>((resolve) => {
      releases[index] = resolve;
    }),
  );
  const starts: number[] = [];
  let active = 0;
  let peakActive = 0;
  const pending = mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
    starts.push(item);
    active += 1;
    peakActive = Math.max(peakActive, active);
    await gates[item];
    active -= 1;
    return `result-${item}`;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, [0, 1]);
  releases[1]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, [0, 1, 2]);
  releases[0]();
  releases[2]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts, [0, 1, 2, 3]);
  releases[3]();

  assert.deepEqual(await pending, ["result-0", "result-1", "result-2", "result-3"]);
  assert.equal(peakActive, 2);
});

test("keeps scene cards in file selection order when analyses finish out of order", () => {
  const mergeImportedMediaItems = loadMergeImportedMediaItemsInSelectionOrder();
  const orderedSourceFileIds = ["source-first", "source-second"];
  const firstScenes = createSceneMediaItems({
    sourceFileId: "source-first",
    label: "First.mp4",
    src: "uploads/first.mp4",
    ranges: [
      {startSeconds: 0, endSeconds: 1},
      {startSeconds: 1, endSeconds: 2},
    ],
    fps: 30,
  });
  const secondScenes = createSceneMediaItems({
    sourceFileId: "source-second",
    label: "Second.mp4",
    src: "uploads/second.mp4",
    ranges: [{startSeconds: 0, endSeconds: 2}],
    fps: 30,
  });
  const existingItem: SavedMediaItem = {
    id: "existing",
    label: "Existing",
    src: "existing.mp4",
    duration: "00:03",
    durationInFrames: 90,
    kind: "public",
    mediaType: "video",
  };

  const afterSecondFinishes = mergeImportedMediaItems({
    currentItems: [existingItem],
    newItems: secondScenes,
    sourceFileId: "source-second",
    orderedSourceFileIds,
  });
  const afterFirstFinishes = mergeImportedMediaItems({
    currentItems: afterSecondFinishes,
    newItems: firstScenes,
    sourceFileId: "source-first",
    orderedSourceFileIds,
  });

  assert.deepEqual(
    afterFirstFinishes.map((item) => item.label),
    ["First - Scene 1", "First - Scene 2", "Second - Scene 1", "Existing"],
  );
  assert.strictEqual(afterFirstFinishes.at(-1), existingItem);
});

test("renders non-draggable analyzing cards before replacing videos with scene cards", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /detectVideoScenes\(file\)/);
  assert.match(source, /createSceneMediaItems\(/);
  assert.match(source, /mergeImportedMediaItemsInSelectionOrder\(\{/);
  assert.match(source, /mapWithConcurrency\(\s*imports,\s*2,\s*async/);
  assert.match(source, /analyzingMediaItems\.map/);
  assert.match(source, /className="media-thumb is-analyzing"/);
  assert.match(source, /Detecting scenes\.\.\./);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /Scene \{mediaItem\.sceneIndex\}/);
  assert.match(
    source,
    /const firstSuccessfulImport = results\.find[\s\S]*?setSelectedMediaId\(firstSuccessfulImport\.mediaId\)/,
  );
  assert.match(css, /\.media-thumb\.is-analyzing/);
  assert.match(css, /\.media-analysis-spinner/);
});

test("keeps detected scene duration when its gallery thumbnail loads", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const metadataHandler = source.slice(
    source.indexOf("onLoadedMetadata={(event) => {", source.indexOf("mediaItems.map")),
    source.indexOf("const durationInFrames = durationToFrames", source.indexOf("mediaItems.map")),
  );

  assert.match(metadataHandler, /if \(mediaItem\.sourceFileId\)/);
  assert.match(
    metadataHandler,
    /currentTime =\s*\(mediaItem\.sourceStart \?\? 0\) \/ fps;\s*return;/,
  );
});

test("wires the trailing autosave scheduler while preserving explicit Save", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const persistProjectToStorage = /);
  assert.match(
    source,
    /createTrailingAutosaveScheduler\(/,
  );
  assert.match(source, /autosave\.schedule\(\)/);
  assert.match(source, /return autosave\.cancel/);
  assert.match(source, /onClick=\{saveProjectToStorage\}/);
  assert.match(source, /setProjectStatus\("Media imported and saved"\)/);
});

test("renders eight directional text box resize handles and contains animated words", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const directions = [
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
  ];

  for (const direction of directions) {
    assert.match(
      source,
      new RegExp(`text-resize-handle text-resize-handle-${direction}`),
    );
    assert.match(
      source,
      new RegExp(`startTextResizeDrag\\(event, textClip, "${direction}"\\)`),
    );
  }
  assert.match(source, /width: text\.boxWidth \? `\$\{text\.boxWidth\}%` : undefined/);
  assert.match(source, /height: text\.boxHeight \? `\$\{text\.boxHeight\}%` : undefined/);
  assert.match(
    source,
    /const startTextResizeDrag = \([\s\S]*?setIsPreviewPlaying\(false\)[\s\S]*?setTextResizeDrag\(/,
  );
  assert.match(
    source,
    /className=\{`preview-text-overlay[\s\S]*?text-animation-\$\{text\.animation \?\? "none"\}/,
  );
  assert.match(css, /\.preview-text-content\s*\{[^}]*overflow:\s*visible/s);
  assert.match(
    css,
    /\.preview-text-overlay\.text-animation-star-jump\s*\{[^}]*padding:\s*42px 28px 22px/s,
  );
  assert.match(css, /\.text-resize-handle-top\s*,\s*\.text-resize-handle-bottom\s*\{[^}]*cursor:\s*ns-resize/s);
  assert.match(css, /\.text-resize-handle-left\s*,\s*\.text-resize-handle-right\s*\{[^}]*cursor:\s*ew-resize/s);
});

test("shows readable media import errors instead of raw API JSON", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const payload = await response\.json\(\)/);
  assert.match(source, /payload\.error\?\.message/);
  assert.doesNotMatch(source, /const message = await response\.text\(\)/);
});

test("keeps save and export actions fully visible in the top bar", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.topbar\s*\{[^}]*grid-template-columns:\s*170px minmax\(0, 1fr\) max-content/s,
  );
  assert.match(css, /\.project-actions\s*\{[^}]*justify-self:\s*end/s);
  assert.match(css, /\.tool-tabs\s*\{[^}]*overflow-x:\s*auto/s);
});

test("makes timeline clips fill their track lane height", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /\.timeline-clip\s*\{[^}]*top:\s*0/s);
  assert.match(css, /\.timeline-clip\s*\{[^}]*bottom:\s*0/s);
  assert.match(css, /\.timeline-clip\s*\{[^}]*height:\s*auto/s);
});

test("keeps long timeline clip labels inside the clip body", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /\.timeline-clip\s*\{[^}]*justify-content:\s*flex-start/s);
  assert.match(css, /\.timeline-clip\s*\{[^}]*padding:\s*0 44px 0 8px/s);
  assert.match(css, /\.timeline-clip span\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.timeline-clip span\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.timeline-clip span\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.timeline-clip span\s*\{[^}]*white-space:\s*nowrap/s);
});

test("shows a floating drag preview only for gallery media", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /pointerDrag\?\.type === "media" \? \([\s\S]*className="drag-preview"/,
  );
});

test("fills the middle preview frame with imported videos", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /\.preview-video\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(css, /\.preview-overlay-video\s*\{[^}]*object-fit:\s*cover/s);
});

test("reveals a protected delete control for each imported media item", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  const deleteButton = source.slice(
    source.indexOf('className="media-delete-button"') - 300,
    source.indexOf('className="media-delete-button"') + 500,
  );

  assert.match(source, /aria-label=\{`Delete \$\{mediaItem\.label\}`\}/);
  assert.match(source, /title=\{`Delete \$\{mediaItem\.label\}`\}/);
  assert.match(source, /className="media-delete-button"/);
  assert.match(
    deleteButton,
    /onPointerDown=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/s,
  );
  assert.match(
    deleteButton,
    /onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/s,
  );
  assert.match(
    css,
    /\.media-thumb:hover \.media-delete-button,\s*\.media-thumb:focus-within \.media-delete-button\s*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto/s,
  );
});

test("lets the main Import button accept images and videos", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /getMediaFileType\(file\)/);
  assert.match(source, /createImageMediaClip/);
  assert.match(source, /className="media-thumb-image"/);
  assert.match(source, /className="preview-image preview-layer-image"/);
  assert.match(source, /className="timeline-clip-image"/);
  assert.match(css, /\.media-thumb-video,\s*\.media-thumb-image\s*\{/);
  assert.match(css, /\.preview-video,\s*\.preview-image\s*\{/);
  assert.match(css, /\.timeline-clip-video,\s*\.timeline-clip-image\s*\{/);
});

test("widens every tool library and auto-fits asset grids", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.workspace\s*\{[^}]*clamp\(420px,\s*36vw,\s*620px\)[^}]*minmax\(480px,\s*1fr\)/s,
  );
  assert.match(
    css,
    /\.media-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(112px,\s*1fr\)\)/s,
  );
  assert.match(
    css,
    /\.sticker-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(112px,\s*1fr\)\)/s,
  );
  assert.match(css, /\.media-library\s*\{[^}]*overflow-y:\s*auto/s);
});
