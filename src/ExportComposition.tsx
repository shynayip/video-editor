import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";
import {
  createCutoutMaskDataUrl,
  defaultClipAdjustment,
  getCaptionPosition,
  getClipAnimationPresentation,
  getClipAudioFadeMultiplier,
  getClipTransitionPresentation,
  getClipVisualPresentation,
  getIndependentPlaybackAudioClips,
  getPlaybackAudioClips,
  getTextAnimationPresentation,
  getTextAnimationVisibleCharacterCount,
  getTextualClipDisplayColors,
  getVideoLayerStackOrder,
  shouldMuteVideoNativeAudio,
  type CaptionOverlay,
  type SavedEditorProject,
  type TextEffect,
  type TimelineClip,
} from "./editorLogic";

const EXPORT_WIDTH = 1280;
const EXPORT_HEIGHT = 720;

const resolveMediaSource = (src: string) =>
  /^(blob:|data:|https?:)/.test(src) ? src : staticFile(src);

const isImageSource = (clip: TimelineClip) =>
  clip.mediaType === "image" ||
  /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(clip.src ?? "");

const isClipActiveAtFrame = (clip: TimelineClip, frame: number) =>
  frame >= clip.start && frame < clip.start + Math.max(1, clip.duration);

const getTextEffectStyle = (effect: TextEffect): CSSProperties => {
  switch (effect) {
    case "outline":
      return {
        WebkitTextStroke: "2px rgba(0, 0, 0, 0.92)",
        paintOrder: "stroke fill",
      };
    case "glow":
      return { textShadow: "0 0 8px currentColor, 0 0 20px currentColor" };
    case "shadow":
      return { textShadow: "0 3px 10px rgba(0, 0, 0, 0.9)" };
    default:
      return {};
  }
};

const getCaptionAnimationStyle = (
  caption: CaptionOverlay,
  clip: TimelineClip,
  frame: number,
): CSSProperties => {
  const speed = Math.max(0.25, caption.animationSpeed ?? 1);
  const localFrame = Math.max(0, frame - clip.start);
  const progress = Math.min(1, localFrame / Math.max(1, 12 / speed));

  switch (caption.animation ?? "none") {
    case "pop":
      return { scale: 0.55 + progress * 0.45 };
    case "bounce":
      return {
        scale: 1 + Math.abs(Math.sin(localFrame * 0.28 * speed)) * 0.14,
      };
    case "jump":
      return {
        translate: `-50% calc(-50% - ${Math.abs(Math.sin(localFrame * 0.22 * speed)) * 18}px)`,
      };
    case "fade":
      return { opacity: progress };
    case "slide":
      return {
        translate: `calc(-50% + ${(1 - progress) * -42}px) -50%`,
        opacity: progress,
      };
    default:
      return {};
  }
};

const getVisualPresentationStyle = (
  project: SavedEditorProject,
  clip: TimelineClip,
  frame: number,
): CSSProperties => {
  const visual = getClipVisualPresentation(clip, frame);
  const animation = getClipAnimationPresentation(clip, frame);
  const transition = getClipTransitionPresentation(
    project.clips,
    clip.id,
    frame,
  );

  return {
    opacity: visual.opacity * animation.opacity * transition.opacity,
    filter: visual.filter === "none" ? undefined : visual.filter,
    translate: `${visual.translateX + animation.translateX + transition.translateX}% ${visual.translateY + animation.translateY}%`,
    scale: visual.scale * animation.scale * transition.scale,
    rotate: `${visual.rotate + animation.rotation}deg`,
  };
};

const ClipSequence = ({
  clip,
  children,
}: {
  clip: TimelineClip;
  children: ReactNode;
}) => (
  <Sequence
    from={Math.max(0, clip.start)}
    durationInFrames={Math.max(1, clip.duration)}
  >
    {children}
  </Sequence>
);

const ExportVideoClip = ({
  clip,
  project,
  frame,
  zIndex,
}: {
  clip: TimelineClip;
  project: SavedEditorProject;
  frame: number;
  zIndex: number;
}) => {
  if (!clip.src || clip.hidden) return null;

  const adjustment = { ...defaultClipAdjustment, ...clip.adjustment };
  const mediaStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: isImageSource(clip) ? "cover" : "contain",
    objectPosition: "center",
    transform: `translate(${adjustment.positionX}%, ${adjustment.positionY}%) scale(${adjustment.scale}) rotate(${adjustment.rotation}deg)`,
    transformOrigin: "center",
    clipPath: `inset(${adjustment.cropTop}% ${adjustment.cropRight}% ${adjustment.cropBottom}% ${adjustment.cropLeft}%)`,
  };
  const sourceStart = Math.max(0, clip.sourceStart ?? 0);

  return (
    <ClipSequence clip={clip}>
      <AbsoluteFill
        style={{
          zIndex,
          overflow: "hidden",
          ...getVisualPresentationStyle(project, clip, frame),
        }}
      >
        {isImageSource(clip) ? (
          <Img src={resolveMediaSource(clip.src)} style={mediaStyle} />
        ) : (
          <Video
            src={resolveMediaSource(clip.src)}
            trimBefore={sourceStart}
            playbackRate={Math.max(0.1, clip.speed ?? 1)}
            muted={shouldMuteVideoNativeAudio(project.clips, frame, clip.id)}
            volume={(localFrame) =>
              (clip.volume ?? 1) *
              getClipAudioFadeMultiplier(clip, clip.start + localFrame)
            }
            style={mediaStyle}
          />
        )}
      </AbsoluteFill>
    </ClipSequence>
  );
};

const ExportCutoutClip = ({
  clip,
  project,
  frame,
  zIndex,
}: {
  clip: TimelineClip;
  project: SavedEditorProject;
  frame: number;
  zIndex: number;
}) => {
  const transform = clip.cutout;
  if (!clip.src || clip.hidden || !transform) return null;

  const scaleX = transform.scaleX ?? transform.scale;
  const scaleY = transform.scaleY ?? transform.scale;
  const maskUrl = transform.maskStrokes?.length
    ? createCutoutMaskDataUrl(transform)
    : undefined;
  const mediaStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "auto",
    objectFit: "contain",
    ...(maskUrl
      ? {
          WebkitMaskImage: `url("${maskUrl}")`,
          maskImage: `url("${maskUrl}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }
      : {}),
  };

  return (
    <ClipSequence clip={clip}>
      <div
        style={{
          position: "absolute",
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          width: Math.min(EXPORT_WIDTH * 0.34, 360),
          translate: "-50% -50%",
          scale: `${scaleX} ${scaleY}`,
          rotate: `${transform.rotation}deg`,
          transformOrigin: "center",
          zIndex,
          ...getVisualPresentationStyle(project, clip, frame),
        }}
      >
        {transform.mediaKind === "video" ? (
          <Video
            src={resolveMediaSource(clip.src)}
            trimBefore={Math.max(0, clip.sourceStart ?? 0)}
            playbackRate={Math.max(0.1, clip.speed ?? 1)}
            muted
            style={mediaStyle}
          />
        ) : (
          <Img src={resolveMediaSource(clip.src)} style={mediaStyle} />
        )}
      </div>
    </ClipSequence>
  );
};

const ExportStickerClip = ({
  clip,
  zIndex,
}: {
  clip: TimelineClip;
  zIndex: number;
}) => {
  if (!clip.src || clip.hidden) return null;
  const transform = clip.sticker ?? { x: 50, y: 50, scale: 1, rotation: 0 };

  return (
    <ClipSequence clip={clip}>
      <div
        style={{
          position: "absolute",
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          width: 92,
          height: 92,
          translate: "-50% -50%",
          scale: `${transform.scaleX ?? transform.scale} ${transform.scaleY ?? transform.scale}`,
          rotate: `${transform.rotation}deg`,
          zIndex,
        }}
      >
        <Img
          src={resolveMediaSource(clip.src)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    </ClipSequence>
  );
};

const ExportCaptionClip = ({
  clip,
  frame,
  zIndex,
}: {
  clip: TimelineClip;
  frame: number;
  zIndex: number;
}) => {
  const caption = clip.caption;
  if (!caption || clip.hidden) return null;
  const position = getCaptionPosition(caption);
  const colors = getTextualClipDisplayColors(clip);

  return (
    <ClipSequence clip={clip}>
      <div
        style={{
          position: "absolute",
          left: `${position.x}%`,
          top: `${position.y}%`,
          maxWidth: "88%",
          padding: "8px 12px",
          translate: "-50% -50%",
          rotate: `${caption.rotation ?? 0}deg`,
          borderRadius: 6,
          color: colors.textColor,
          background: caption.backgroundEnabled
            ? colors.backgroundColor
            : "transparent",
          fontFamily: caption.fontFamily ?? "Inter",
          fontSize: caption.fontSize,
          fontWeight: caption.fontWeight ?? "900",
          lineHeight: 1.15,
          overflowWrap: "anywhere",
          textAlign: "center",
          zIndex,
          ...getTextEffectStyle(caption.effect ?? "shadow"),
          ...getCaptionAnimationStyle(caption, clip, frame),
        }}
      >
        {caption.content}
      </div>
    </ClipSequence>
  );
};

const ExportTextClip = ({
  clip,
  frame,
  zIndex,
}: {
  clip: TimelineClip;
  frame: number;
  zIndex: number;
}) => {
  const text = clip.text;
  if (!text || clip.hidden) return null;
  const colors = getTextualClipDisplayColors(clip);
  const animation = getTextAnimationPresentation(clip, frame);
  const content =
    text.animation === "typewriter"
      ? text.content.slice(
          0,
          getTextAnimationVisibleCharacterCount(clip, frame),
        )
      : text.content;

  return (
    <ClipSequence clip={clip}>
      <div
        style={{
          position: "absolute",
          left: `${text.x}%`,
          top: `${text.y}%`,
          width: text.boxWidth ? `${text.boxWidth}%` : "max-content",
          height: text.boxHeight ? `${text.boxHeight}%` : undefined,
          maxWidth: "100%",
          padding: "12px 16px",
          translate: `-50% calc(-50% + ${animation.translateY}px)`,
          scale: animation.scale,
          rotate: `${(text.rotation ?? 0) + animation.rotation}deg`,
          opacity: animation.opacity,
          color: colors.textColor,
          background: colors.backgroundColor,
          fontFamily: text.fontFamily ?? "Inter",
          fontSize: text.fontSize,
          fontStyle: text.fontStyle ?? "normal",
          fontWeight: text.fontWeight ?? "900",
          lineHeight: 1.15,
          overflowWrap: "anywhere",
          textAlign: "center",
          whiteSpace: "normal",
          zIndex,
          ...getTextEffectStyle(text.effect ?? "none"),
        }}
      >
        {content}
      </div>
    </ClipSequence>
  );
};

const ExportAudioClip = ({
  clip,
  project,
}: {
  clip: TimelineClip;
  project: SavedEditorProject;
}) => {
  if (!clip.src || clip.hidden || (clip.volume ?? 1) === 0) return null;

  return (
    <ClipSequence clip={clip}>
      <Audio
        src={resolveMediaSource(clip.src)}
        trimBefore={Math.max(0, clip.sourceStart ?? 0)}
        playbackRate={Math.max(0.1, clip.speed ?? 1)}
        volume={(localFrame) => {
          const globalFrame = clip.start + localFrame;
          const isAudible = [
            ...getPlaybackAudioClips(project.clips, globalFrame),
            ...getIndependentPlaybackAudioClips(project.clips, globalFrame),
          ].some((candidate) => candidate.id === clip.id);

          return isAudible
            ? (clip.volume ?? 1) * getClipAudioFadeMultiplier(clip, globalFrame)
            : 0;
        }}
      />
    </ClipSequence>
  );
};

export const ExportComposition = ({
  project,
}: {
  project?: SavedEditorProject;
}) => {
  const frame = useCurrentFrame();
  const clips = project?.clips ?? [];
  const visualClips = clips
    .filter(
      (clip) =>
        (clip.track === "main" || clip.track === "upper") &&
        clip.src &&
        !clip.hidden &&
        isClipActiveAtFrame(clip, frame),
    )
    .sort(
      (first, second) =>
        getVideoLayerStackOrder(first) - getVideoLayerStackOrder(second) ||
        first.start - second.start,
    );

  return (
    <AbsoluteFill
      style={{
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        overflow: "hidden",
        background: "#020617",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      {visualClips.map((clip, index) => (
        <ExportVideoClip
          clip={clip}
          frame={frame}
          key={clip.id}
          project={project!}
          zIndex={10 + index}
        />
      ))}
      {clips
        .filter(
          (clip) =>
            clip.track === "cutout" && isClipActiveAtFrame(clip, frame),
        )
        .map((clip, index) => (
          <ExportCutoutClip
            clip={clip}
            frame={frame}
            key={clip.id}
            project={project!}
            zIndex={100 + index}
          />
        ))}
      {clips
        .filter(
          (clip) =>
            clip.track === "caption" && isClipActiveAtFrame(clip, frame),
        )
        .map((clip, index) => (
          <ExportCaptionClip
            clip={clip}
            frame={frame}
            key={clip.id}
            zIndex={200 + index}
          />
        ))}
      {clips
        .filter(
          (clip) =>
            clip.track === "sticker" && isClipActiveAtFrame(clip, frame),
        )
        .map((clip, index) => (
          <ExportStickerClip clip={clip} key={clip.id} zIndex={300 + index} />
        ))}
      {clips
        .filter(
          (clip) =>
            clip.track === "text" && isClipActiveAtFrame(clip, frame),
        )
        .map((clip, index) => (
          <ExportTextClip
            clip={clip}
            frame={frame}
            key={clip.id}
            zIndex={400 + index}
          />
        ))}
      {clips
        .filter((clip) => clip.track === "audio")
        .map((clip) => (
          <ExportAudioClip clip={clip} key={clip.id} project={project!} />
        ))}
    </AbsoluteFill>
  );
};
