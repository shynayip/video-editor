import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const readComposition = () =>
  readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");

test("keeps imported media preview playback independent from the timeline", () => {
  const source = readComposition();

  assert.match(source, /const \[mediaPreviewTime, setMediaPreviewTime\] = useState\(0\)/);
  assert.match(source, /const \[mediaPreviewDuration, setMediaPreviewDuration\] = useState\(0\)/);
  assert.match(
    source,
    /const \[isMediaPreviewPlaying, setIsMediaPreviewPlaying\] = useState\(false\)/,
  );
  assert.match(
    source,
    /const chooseMedia = \(mediaItem: MediaItem\) => \{[\s\S]*?setMediaPreviewTime\(0\)[\s\S]*?setIsPreviewPlaying\(false\)[\s\S]*?setIsMediaPreviewPlaying\(false\)[\s\S]*?setPreviewMode\("media"\)/,
  );
  assert.match(
    source,
    /if \(isDetectedSceneMediaItem\(mediaItem\)\) \{\s*setMediaPreviewTime\(\(mediaItem\.sourceStart \?\? 0\) \/ fps\);\s*\} else \{\s*setMediaPreviewTime\(0\);/,
  );
  assert.match(
    source,
    /const toggleMediaPreviewPlayback = \(\) => \{[\s\S]*?previewMode !== "media"[\s\S]*?if \(isMediaPreviewPlaying\)[\s\S]*?setIsMediaPreviewPlaying\(false\)[\s\S]*?setIsMediaPreviewPlaying\(true\)/,
  );
  assert.match(
    source,
    /const togglePreviewPlayback = \(\) => \{[\s\S]*?setIsMediaPreviewPlaying\(false\)[\s\S]*?setPreviewMode\("timeline"\)/,
  );
  assert.match(source, /const toggleTimelinePlayback = togglePreviewPlayback/);
  assert.match(
    source,
    /const isCanvasPreviewPlaying = previewMode === "media"\s*\? isMediaPreviewPlaying\s*:\s*isPreviewPlaying/,
  );
  assert.match(
    source,
    /\{isTimelinePreview \? \([\s\S]*?className="preview-play-button"[\s\S]*?onClick=\{toggleTimelinePlayback\}/,
  );
  assert.match(
    source,
    /className="icon-tool-button primary-icon-tool"[\s\S]*?onClick=\{toggleTimelinePlayback\}/,
  );
  assert.match(
    source,
    /if \(!isPreviewPlaying \|\| previewMode !== "timeline"\) \{\s*return;/,
  );
  const timelineToolbar = source.slice(
    source.indexOf('className="timeline-toolbar"'),
    source.indexOf('className="timeline-scroll"'),
  );
  assert.match(timelineToolbar, /aria-label=\{isPreviewPlaying \? "Pause preview" : "Play preview"\}/);
  assert.doesNotMatch(timelineToolbar, /isMediaPreviewPlaying|isCanvasPreviewPlaying/);
});

test("synchronizes video-only media preview controls with the native element", () => {
  const source = readComposition();
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(source, /const \[mediaPreviewVolume, setMediaPreviewVolume\] = useState\(1\)/);
  assert.match(source, /const \[isMediaPreviewVolumeOpen, setIsMediaPreviewVolumeOpen\] = useState\(false\)/);
  assert.match(source, /const handleMediaPreviewMetadata = \(/);
  assert.match(source, /const handleMediaPreviewTimeUpdate = \(/);
  assert.match(source, /const handleMediaPreviewEnded = \(/);
  assert.match(source, /const handleMediaPreviewSeek = \(/);
  assert.match(source, /onLoadedMetadata=\{handleMediaPreviewMetadata\}/);
  assert.match(source, /onTimeUpdate=\{handleMediaPreviewTimeUpdate\}/);
  assert.match(source, /onEnded=\{handleMediaPreviewEnded\}/);
  assert.match(
    source,
    /ref=\{previewVideoRef\}[\s\S]*?className="preview-video"[\s\S]*?muted=\{previewMode === "media" \? false : previewVideoMuted\}/,
  );
  assert.match(
    source,
    /previewMode === "media" && selectedMedia && getMediaItemType\(selectedMedia\) === "video" \? \([\s\S]*?className="media-preview-seek"[\s\S]*?type="range"[\s\S]*?aria-label="Seek imported video"[\s\S]*?onChange=\{handleMediaPreviewSeek\}/,
  );
  assert.match(source, /min=\{mediaPreviewSeekMinSeconds\}/);
  assert.match(source, /max=\{mediaPreviewSeekMaxSeconds\}/);
  assert.match(source, /video\.currentTime = boundedNextTime/);
  assert.match(
    source,
    /const mediaPreviewDisplayTime = isSelectedMediaScene[\s\S]*?mediaPreviewTime - mediaPreviewStartSeconds/,
  );
  assert.match(source, /video\.playbackRate = previewMode === "media" \? 1 : previewSpeed/);
  assert.match(
    source,
    /video\.volume = previewMode === "media"\s*\? mediaPreviewVolume/,
  );
  assert.match(
    source,
    /const shouldPlay = previewMode === "media"\s*\? isMediaPreviewPlaying\s*:\s*isPreviewPlaying/,
  );
  assert.match(
    source,
    /if \(previewMode === "timeline"\) \{[\s\S]*?setIsMediaPreviewPlaying\(false\)[\s\S]*?else \{[\s\S]*?setIsPreviewPlaying\(false\)/,
  );
  assert.match(
    css,
    /\.media-preview-overlay\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s,
  );
  assert.match(css, /\.preview-window:hover \.media-preview-overlay[\s\S]*opacity:\s*1/);
  assert.match(
    css,
    /\.preview-window:focus-within \.media-preview-overlay[\s\S]*opacity:\s*1/,
  );
  assert.match(css, /\.media-preview-overlay\.volume-open[\s\S]*opacity:\s*1/);
  assert.match(
    css,
    /\.media-preview-transport\s*\{[^}]*position:\s*absolute[^}]*bottom:\s*0/s,
  );
  assert.match(
    css,
    /\.media-preview-filename\s*\{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s,
  );
  assert.match(
    css,
    /\.preview-window:hover \.media-preview-filename,\s*\.preview-window:hover \.media-preview-transport,\s*\.preview-window:focus-within \.media-preview-filename,\s*\.preview-window:focus-within \.media-preview-transport,\s*\.media-preview-overlay\.volume-open \.media-preview-filename,\s*\.media-preview-overlay\.volume-open \.media-preview-transport\s*\{[^}]*pointer-events:\s*auto/s,
  );
  assert.doesNotMatch(
    css,
    /\.media-preview-filename,\s*\.media-preview-transport\s*\{[^}]*pointer-events:\s*auto/s,
  );
  assert.match(css, /\.preview-window\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*16/s);
  assert.match(css, /\.preview-panel\s*\{[^}]*place-items:\s*stretch center/s);
  assert.match(css, /\.preview-shell\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.preview-shell:has\(\.canvas-rotate-handle\)\s*\{[^}]*padding-top:\s*30px/s);
  assert.doesNotMatch(css, /\.media-preview-controls\s*\{/);
});

test("renders imported-video transport and volume controls in the preview overlay", () => {
  const source = readComposition();

  assert.match(
    source,
    /className=\{`media-preview-overlay\$\{isMediaPreviewVolumeOpen \? " volume-open" : ""\}`\}/,
  );
  assert.match(source, /className="media-preview-filename"/);
  assert.match(
    source,
    /aria-label=\{isMediaPreviewPlaying \? "Pause imported video" : "Play imported video"\}/,
  );
  assert.match(source, /aria-label="Seek imported video"/);
  assert.match(source, /aria-label="Adjust imported video volume"/);
  assert.match(source, /aria-label="Imported video volume"/);
  assert.match(source, /onChange=\{handleMediaPreviewVolumeChange\}/);
});

test("renders an imported-video volume popover with vertical slider geometry", () => {
  const source = readComposition();
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    source,
    /className="media-preview-volume-popover"[\s\S]*?className="media-preview-volume-slider"[\s\S]*?type="range"/,
  );
  assert.match(
    css,
    /\.media-preview-volume-popover\s*\{[^}]*position:\s*absolute[^}]*right:\s*0[^}]*bottom:\s*calc\(100%\s*\+\s*6px\)[^}]*width:\s*44px[^}]*height:\s*132px/s,
  );
  assert.match(
    css,
    /\.media-preview-volume-slider\s*\{[^}]*width:\s*20px[^}]*height:\s*98px[^}]*writing-mode:\s*vertical-lr[^}]*direction:\s*rtl/s,
  );
});

test("shows imported-video volume percentage only while the slider is being dragged", () => {
  const source = readComposition();

  assert.match(
    source,
    /const \[isMediaPreviewVolumeAdjusting, setIsMediaPreviewVolumeAdjusting\] = useState\(false\)/,
  );
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*mediaPreviewVolumeDragRef\.current = false;\s*setIsMediaPreviewVolumeAdjusting\(false\);\s*setIsMediaPreviewVolumeOpen\(false\);\s*\}, \[previewMode, selectedMediaId\]\)/,
  );
  assert.match(
    source,
    /const handleMediaPreviewVolumePointerDown = \([\s\S]*?\) => \{[\s\S]*?setIsMediaPreviewVolumeAdjusting\(true\)/,
  );
  assert.match(
    source,
    /const handleMediaPreviewVolumePointerEnd = \(\) => \{[\s\S]*?setIsMediaPreviewVolumeAdjusting\(false\)/,
  );
  assert.match(
    source,
    /isMediaPreviewVolumeAdjusting[\s\S]*?className="media-preview-volume-value"[\s\S]*?Math\.round\(mediaPreviewVolume \* 100\)\}%/,
  );
});

test("captures imported-video volume pointer release outside the slider", () => {
  const source = readComposition();

  assert.match(
    source,
    /const handleMediaPreviewVolumePointerDown = \(\s*event: PointerEvent<HTMLInputElement>,?\s*\) => \{[\s\S]*?event\.currentTarget\.setPointerCapture\(event\.pointerId\)/,
  );
  assert.match(
    source,
    /aria-label="Imported video volume"[\s\S]*?onLostPointerCapture=\{handleMediaPreviewVolumePointerEnd\}/,
  );
});

test("exposes vertical imported-video volume accessibility metadata", () => {
  const source = readComposition();

  assert.match(
    source,
    /aria-label="Imported video volume"[\s\S]*?aria-orientation="vertical"[\s\S]*?aria-valuetext=\{`\$\{Math\.round\(mediaPreviewVolume \* 100\)\}%`\}/,
  );
});

test("closes imported-video volume controls after preview interaction ends", () => {
  const source = readComposition();

  assert.match(
    source,
    /useEffect\(\(\) => \{\s*mediaPreviewVolumeDragRef\.current = false;\s*setIsMediaPreviewVolumeAdjusting\(false\);\s*setIsMediaPreviewVolumeOpen\(false\);\s*\}, \[previewMode, selectedMediaId\]\)/,
  );
  assert.match(source, /const mediaPreviewVolumeDragRef = useRef\(false\)/);
  assert.match(source, /const closeMediaPreviewVolumeIfInactive = \(\) => \{/);
  assert.match(
    source,
    /className="preview-window"[\s\S]*?onMouseLeave=\{closeMediaPreviewVolumeIfInactive\}[\s\S]*?onBlurCapture=\{handleMediaPreviewBlur\}/,
  );
  assert.match(
    source,
    /aria-label="Imported video volume"[\s\S]*?onPointerDown=\{handleMediaPreviewVolumePointerDown\}[\s\S]*?onPointerUp=\{handleMediaPreviewVolumePointerEnd\}[\s\S]*?onPointerCancel=\{handleMediaPreviewVolumePointerEnd\}/,
  );
});

test("disables imported-video seeking until a valid duration or scene range exists", () => {
  const source = readComposition();

  assert.doesNotMatch(source, /Math\.max\(mediaPreviewDuration, 0\.01\)/);
  assert.match(
    source,
    /const isMediaPreviewSeekEnabled = isSelectedMediaScene\s*\? hasValidMediaPreviewSceneRange\s*:\s*hasValidMediaPreviewDuration/,
  );
  assert.match(
    source,
    /const handleMediaPreviewSeek = \([\s\S]*?if \(!isMediaPreviewSeekEnabled\) return;/,
  );
  assert.match(
    source,
    /aria-label="Seek imported video"[\s\S]*?disabled=\{!isMediaPreviewSeekEnabled\}[\s\S]*?onChange=\{handleMediaPreviewSeek\}/,
  );
});
