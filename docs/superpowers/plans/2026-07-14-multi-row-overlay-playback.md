# Multi-Row Overlay Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render overlapping overlay videos in separate, independently editable timeline rows and play the highest active overlay above the main video.

**Architecture:** Store an `overlayLane` number on every upper-track clip and assign the first non-overlapping lane when media is added. Build the timeline rows from those lane numbers instead of placing all overlays inside one variable-height container. Keep clip selection and split behavior clip-specific, and order active preview overlays by lane.

**Tech Stack:** React, TypeScript, Remotion, Node test runner, CSS

## Global Constraints

- Imported overlays begin at the current red-playhead frame.
- Overlapping overlays must occupy separate rows; non-overlapping overlays may reuse a row.
- Each overlay clip remains independently selectable, trimmable, splittable, and adjustable.
- Splitting one clip must not modify main, audio, caption, or other overlay clips.
- The red playhead remains one continuous line spanning every timeline row.
- Overlay audio defaults to muted while remaining adjustable.
- Preserve the original media label after splitting; do not add visible `A` or `B` suffixes.

---

### Task 1: Overlay lane assignment logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TimelineClip.overlayLane?: number`
- Produces: `findAvailableOverlayLane(clips: TimelineClip[], start: number, duration: number): number`
- Updates: `addOverlayMediaClip()` assigns the returned lane.

- [ ] **Step 1: Write failing lane-assignment tests**

Add tests proving overlapping overlays receive lanes `0` and `1`, while a later non-overlapping overlay reuses lane `0`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because `overlayLane` and `findAvailableOverlayLane` do not exist.

- [ ] **Step 3: Implement minimal lane assignment**

Treat two clips as overlapping when `start < other.start + other.duration` and `other.start < start + duration`. Check lanes from `0` upward and return the first lane with no overlap.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: all editor logic tests PASS.

### Task 2: Topmost overlay and selected-clip split logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `getActiveOverlayClipsAtFrame(clips: TimelineClip[], frame: number): TimelineClip[]`
- Produces: `splitClipByIdAtFrame(clips: TimelineClip[], clipId: string, frame: number): TimelineClip[]`

- [ ] **Step 1: Write failing overlay-order and selected-split tests**

Test that active overlays are returned from lower lane to higher lane, and that splitting one selected overlay at the playhead leaves every other track and overlay unchanged while preserving the visible label and lane.

- [ ] **Step 2: Run tests and verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because the new helpers do not exist.

- [ ] **Step 3: Implement the helpers**

Filter source-backed visible upper clips active at the frame and sort by `overlayLane ?? 0`. Split only the matching id when the frame is strictly inside its boundaries; preserve label and lane and advance `sourceStart` on the right segment.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: all tests PASS.

### Task 3: Render one timeline row per overlay lane

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `TimelineClip.overlayLane`, `getActiveOverlayClipsAtFrame`, `splitClipByIdAtFrame`
- Produces: normal-height overlay rows with clips filtered by lane.

- [ ] **Step 1: Replace the variable-height overlay container**

Remove `getOverlayRow`, `overlayTrackHeight`, and `overlayLaneHeight`. Derive the existing lane indexes from upper clips, keeping lane `0` available when no overlay exists.

- [ ] **Step 2: Render overlay rows separately**

Render higher lane numbers above lower lane numbers, label each row `Overlay track`, filter each row to its exact `overlayLane`, and keep main/audio rows below them.

- [ ] **Step 3: Keep one continuous playhead**

Position the existing playhead relative to the shared timeline rows container so it spans every overlay row plus main and audio rows.

- [ ] **Step 4: Wire selected split and preview ordering**

Use `splitClipByIdAtFrame` when a clip is selected and `getActiveOverlayClipsAtFrame` for preview layering.

- [ ] **Step 5: Normalize timeline CSS**

Remove dynamic overlay heights and top offsets. Give every overlay row the same stable height as the other tracks and keep trim handles contained inside each clip.

### Task 4: Verify behavior and regressions

**Files:**
- Verify: `src/Composition.tsx`
- Verify: `src/editorLogic.ts`
- Verify: `src/index.css`
- Verify: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: completed multi-row overlay implementation.

- [ ] **Step 1: Run all editor logic tests**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run TypeScript and lint checks**

Run: `& "C:\Program Files\nodejs\npm.cmd" run lint`

Expected: exit code `0` with no TypeScript or ESLint errors.

- [ ] **Step 3: Verify in the running editor**

At `http://localhost:5173/`, add two overlays at the same playhead position and confirm they appear as two separate rows. Select, trim, and split either row and confirm the other rows remain unchanged; scrub through gaps and confirm the lower overlay or main video becomes visible.
