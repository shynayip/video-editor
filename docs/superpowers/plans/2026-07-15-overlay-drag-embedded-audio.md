# Overlay Drag and Embedded Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag overlay clips horizontally and vertically while keeping original video sound inside each video clip and showing the Audio track only for standalone audio.

**Architecture:** Add pure timeline helpers for overlay placement and test them independently. Extend the existing pointer-drag state to preview and commit one clip movement, and derive overlay rows and standalone audio visibility from timeline state. Remove the duplicate initial audio object and use each video clip's `volume` for preview playback and right-panel controls.

**Tech Stack:** React 19, TypeScript, Remotion 4, native pointer events, Node test runner, ESLint.

## Global Constraints

- Overlay movement must not modify main, caption, or audio clips.
- A completed drag creates exactly one Undo/Redo history entry.
- Overlay clips cannot begin before frame 0 or end after the main timeline duration.
- Original video sound is controlled by the video clip's `volume` property.
- The Audio track is reserved for separately imported music and recorded narration.
- No new dependency is required.

---

### Task 1: Pure Overlay Placement Logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `moveOverlayClip(clips: TimelineClip[], clipId: string, targetStart: number, targetLane: number, timelineDuration: number): TimelineClip[]`
- Preserves: every non-target clip and every target property except `start` and `overlayLane`.

- [ ] **Step 1: Write failing placement tests**

Add tests that move one overlay from frame 30/lane 0 to frame 90/lane 1, clamp a negative start to 0, clamp the right edge to `timelineDuration - duration`, and verify main/audio clips are unchanged.

```ts
const result = moveOverlayClip(clips, "overlay-1", 90, 1, 480);
assert.equal(result.find((clip) => clip.id === "overlay-1")?.start, 90);
assert.equal(result.find((clip) => clip.id === "overlay-1")?.overlayLane, 1);
assert.deepEqual(result.filter((clip) => clip.track !== "upper"), originalNonOverlay);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because `moveOverlayClip` is not exported.

- [ ] **Step 3: Implement minimal placement logic**

```ts
export const moveOverlayClip = (
  clips: TimelineClip[],
  clipId: string,
  targetStart: number,
  targetLane: number,
  timelineDuration: number,
): TimelineClip[] => {
  const target = clips.find((clip) => clip.id === clipId && clip.track === "upper");
  if (!target) return clips;

  const start = Math.max(0, Math.min(targetStart, timelineDuration - target.duration));
  return clips.map((clip) => clip.id === clipId
    ? {...clip, start, overlayLane: Math.max(0, targetLane)}
    : clip);
};
```

- [ ] **Step 4: Add collision allocation**

When another overlay in the requested lane overlaps the moved clip, choose the first lane at or above the requested lane whose range is empty. Reuse the existing range-overlap rule and exclude the moving clip from occupancy checks.

- [ ] **Step 5: Run the complete logic suite**

Run: `node --test tests/editorLogic.test.mts`

Expected: all tests pass.

---

### Task 2: Horizontal and Vertical Overlay Dragging

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `moveOverlayClip(...)` from Task 1.
- Extends: `PointerDrag` with `originalClips`, `grabOffsetFrames`, and the starting overlay lane.
- Produces: data attributes `data-overlay-lane` and a single committed timeline edit on pointer-up.

- [ ] **Step 1: Record the clip grab offset**

Calculate the pointer frame from the timeline panel and preserve where inside the clip the user grabbed it.

```ts
const pointerFrame = Math.round((event.clientX - bounds.left - 148) / timelineScale);
const grabOffsetFrames = pointerFrame - clip.start;
```

- [ ] **Step 2: Mark each overlay row as a drop destination**

```tsx
data-track-id={track.id}
data-overlay-lane={track.overlayLane}
```

Keep trim-handle pointer events stopped so a trim does not begin a clip move.

- [ ] **Step 3: Preview movement during pointer motion**

Resolve the row under the pointer with `closest("[data-overlay-lane]")`, calculate `targetStart = pointerFrame - grabOffsetFrames`, and update only `timelineHistory.present` using the original clip snapshot.

- [ ] **Step 4: Commit exactly one history entry on pointer-up**

Push the drag's original snapshot into `past`, keep the previewed `present`, clear `future`, and reset pointer-drag state. If the final position equals the original position, do not add a history entry.

- [ ] **Step 5: Add movement affordances**

```css
.timeline-clip.draggable-clip { cursor: grab; touch-action: none; }
.timeline-clip.draggable-clip:active { cursor: grabbing; }
```

- [ ] **Step 6: Verify TypeScript and logic tests**

Run: `npm.cmd run lint`

Expected: ESLint and TypeScript exit 0.

Run: `node --test tests/editorLogic.test.mts`

Expected: all tests pass.

---

### Task 3: Embed Original Audio in Video Clips

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/editorLogic.ts` only if obsolete link helpers become unused
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Video clips use existing `volume?: number` and `speed?: number` fields.
- Standalone audio continues using `track: "audio"`.
- `initialClips` contains the main video only, with `volume: 1`, and no `linkedClipId`.

- [ ] **Step 1: Add a failing initial-state behavior test**

Extract or expose a small helper if needed so the test proves a main video with `volume: 1` does not require a duplicate audio timeline clip.

```ts
assert.equal(initialTimeline.filter((clip) => clip.track === "audio").length, 0);
assert.equal(initialTimeline.find((clip) => clip.track === "main")?.volume, 1);
```

- [ ] **Step 2: Remove the duplicate Main audio item**

Change `initialClips` to one main video clip:

```ts
{
  id: "main-1",
  label: "initialClips",
  track: "main",
  start: 0,
  duration: compositionDurationInFrames,
  color: "#0891b2",
  src: "initialClips.mp4",
  speed: 1,
  volume: 1,
}
```

- [ ] **Step 3: Keep sound on timeline video playback**

Use the active main clip's `volume` and `speed` for the preview video. Overlay clips remain muted in the timeline thumbnails; their audio becomes the preview audio only when that overlay is the selected preview source, avoiding duplicate simultaneous playback.

- [ ] **Step 4: Verify independent edits remain independent**

Run: `node --test tests/editorLogic.test.mts`

Expected: split, trim, delete, and move tests confirm no automatic linked-audio edits.

---

### Task 4: Conditional Audio Row and Selection Controls

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `standaloneAudioClips = clips.filter((clip) => clip.track === "audio")` controls Audio-row visibility.
- `clipControlTarget` is the selected clip only; it no longer falls back to the first main clip.

- [ ] **Step 1: Derive rows conditionally**

```ts
const hasStandaloneAudio = clips.some((clip) => clip.track === "audio");
const baseRows = [
  {id: "main", label: "Main track"},
  ...(hasStandaloneAudio ? [{id: "audio", label: "Audio track"}] : []),
];
```

- [ ] **Step 2: Show controls only for a selected clip**

Set `clipControlTarget = selectedClip`. Render the clip controls only when it exists. Keep Speed available for video clips and Volume available for video or standalone audio clips.

- [ ] **Step 3: Clear selection from empty timeline space**

When the lane itself receives the pointer event, set `selectedClipId` to `null`. Clip and trim-handle events must stop propagation so selecting or editing a clip does not immediately clear selection.

- [ ] **Step 4: Preserve standalone audio workflows**

Record narration into `track: "audio"`; when the first recording is created, the Audio row appears. Its selection exposes Volume, split, trim, delete, Undo, and Redo without affecting video clips.

- [ ] **Step 5: Run static verification**

Run: `npm.cmd run lint`

Expected: ESLint and TypeScript exit 0.

Run: `node --test tests/editorLogic.test.mts`

Expected: all tests pass with zero failures.

---

### Task 5: Live Editor Verification

**Files:**
- No source changes expected

- [ ] **Step 1: Start the web editor**

Run: `npm.cmd run web`

Expected: Vite serves `http://localhost:5173/`.

- [ ] **Step 2: Verify overlay dragging**

Drag an overlay horizontally to a later time and vertically to another overlay row. Confirm its preview appears at the new red-playhead time and main/audio data remain unchanged.

- [ ] **Step 3: Verify history**

Click Undo once and confirm the overlay returns to its original row and time. Click Redo and confirm it returns to the dropped position.

- [ ] **Step 4: Verify embedded and standalone audio UI**

Confirm no Audio row appears initially, the video plays with sound, and selecting the main video shows its Volume control. Record narration and confirm the Audio row appears with independently adjustable volume.

- [ ] **Step 5: Final verification**

Run: `node --test tests/editorLogic.test.mts && npm.cmd run lint`

Expected: all tests pass; lint and TypeScript exit 0.
