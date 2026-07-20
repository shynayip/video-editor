# Scene-Detected Media Import Design

## Goal

Analyze each newly imported video for visual scene changes before it enters the Media gallery. Replace the original full-video card with individually previewable and draggable mini-scene cards.

## User Flow

1. The user selects one or more local video files with Import.
2. Each file displays an analyzing state while local FFmpeg detects visual cuts.
3. The original full-video card is not added to the gallery.
4. Analysis creates ordered cards named from the source file and scene number, such as `Interview - Scene 1`.
5. Clicking a scene card previews only that source range in the main preview and loops at its end.
6. The user can drag any scene card independently to Main or any signed video layer.
7. The placed timeline clip preserves the scene's source offset and scene duration.
8. The selected scene can be manually split at the preview playhead to handle action changes within a continuous camera shot.

## Detection

Create a local `POST /api/detect-scenes` endpoint in the existing Express media server. The request uses the existing multipart upload approach. A focused scene-detection module runs the bundled `ffmpeg-static` executable with FFmpeg's scene-change filter and parses cut timestamps from stderr.

Use these initial detector values:

- Scene threshold: `0.32`.
- Minimum resulting scene duration: `0.75` seconds.
- Always include source time `0` and the known video duration as boundaries.
- Ignore invalid, duplicate, descending, and out-of-range timestamps.
- Merge segments shorter than the minimum duration into an adjacent segment.

The endpoint returns normalized scene ranges in seconds:

```json
{
  "scenes": [
    {"startSeconds": 0, "endSeconds": 4.8},
    {"startSeconds": 4.8, "endSeconds": 11.2}
  ]
}
```

Uploaded temporary files are deleted whether detection succeeds, fails, or is cancelled.

## Media Model

Extend `MediaItem` with optional scene metadata:

```ts
type MediaItem = {
  id: string;
  label: string;
  src: string;
  duration: string;
  durationInFrames: number;
  kind: "bundled" | "local";
  sourceStart?: number;
  sourceFileId?: string;
  sceneIndex?: number;
};
```

Scene cards share the source file's object URL. They are virtual ranges, not duplicated video files. This keeps import fast and avoids unnecessary storage.

When a scene is dragged to the timeline, both its `durationInFrames` and `sourceStart` are copied into the created video/audio pair. Existing target-layer replacement, reciprocal audio, Undo/Redo, and signed-layer behavior remain unchanged.

## Preview

Selecting a scene card sets Media preview mode with a segment start and end frame. The preview video seeks to `sourceStart / fps`. During playback, reaching the scene end seeks back to the scene start and continues playing. Pausing preserves the current position inside the scene.

The preview playhead for manual splitting is relative to the selected scene. Splitting inside the scene replaces one card with two adjacent cards that share the same source URL and cover the original range without gaps or overlap. Splits at either boundary are rejected.

## UI States

- While detection is running, show a compact analyzing item in the Media gallery and disable dragging it.
- On success, replace the analyzing item with the resulting scene cards.
- If no cuts are detected, show one scene card covering the full source duration.
- If detection fails, show one fallback scene card covering the full source duration and a non-blocking status message.
- Scene cards display their scene number and formatted segment duration.
- The selected scene card is visually marked using the existing selected-media treatment.

## Components And Boundaries

- `server/sceneDetection.mjs`: FFmpeg argument construction, timestamp parsing, range normalization, and cleanup-independent pure logic.
- `server/transcriptionServer.mjs`: multipart route, cancellation, temporary-file lifecycle, and JSON response.
- `src/sceneDetectionClient.ts`: typed request/response validation and fallback error surface.
- `src/editorLogic.ts`: pure scene-card range creation and manual scene split helper.
- `src/Composition.tsx`: import state, scene cards, looping preview, drag placement, and manual Split scene control.

## Error Handling

- Unsupported or unreadable videos fall back to one full-length scene card.
- Network/server errors do not discard the selected local video.
- Malformed detector responses are rejected by the client and use the same fallback.
- Importing multiple files handles each file independently; one failure does not cancel successful files.
- Object URLs are revoked only when their final scene card is removed or the editor unmounts.

## Testing

- Unit-test FFmpeg arguments and scene timestamp parsing.
- Unit-test minimum-duration merging and full-video fallback.
- Unit-test scene card construction and manual splitting at valid/invalid frames.
- UI source tests cover analyzing state, original-card replacement, scene preview looping, scene drag source offsets, and split control wiring.
- Run scene detection tests, editor logic tests, UI tests, lint/TypeScript, and HTTP checks for the frontend and media API.
