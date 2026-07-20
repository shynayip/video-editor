# Clip Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Animations top-bar tool that lets the user apply frame-based entrance/exit animations to the selected timeline video clip and adjust timing/speed.

**Architecture:** Store animation settings on each `TimelineClip` so main and overlay clips keep their own settings. Compute presentation styles from the current playhead frame using pure functions in `editorLogic.ts`, then apply those styles to preview videos and timeline thumbnails in `Composition.tsx`.

**Tech Stack:** React, TypeScript, Remotion/Vite, Node test runner.

## Global Constraints

- Use frame-based calculations instead of CSS transitions or CSS animations.
- Keep the first version scoped to selected video clips on main/overlay tracks.
- Preserve existing effects, filters, adjustment, speed, volume, and timeline behavior.
- Verify with focused Node tests and lint before claiming completion.

---

### Task 1: Animation Data And Math

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `ClipAnimationStyle`, `ClipAnimationPreset`, `ClipAnimationTiming`, `setClipAnimationById`, `setClipAnimationDurationById`, `setClipAnimationTimingById`, `getClipAnimationPresentation`
- Consumes: existing `TimelineClip`

- [ ] **Step 1: Write failing tests**

Add tests proving animation settings are stored only on editable video clips and presentation values change at the start/end of a clip.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests\editorLogic.test.mts`

- [ ] **Step 3: Implement minimal logic**

Add animation types and pure helpers in `editorLogic.ts`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests\editorLogic.test.mts`

### Task 2: Animations UI

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 1 animation helpers
- Produces: top-bar `Animations` tab with preset buttons, timing buttons, and duration/speed sliders

- [ ] **Step 1: Add the tab and panel**

Add `animations` to `ActiveTool`, render an Animations button in the top bar, and show controls for the selected video clip.

- [ ] **Step 2: Wire controls to history edits**

Use `updateClipsWithHistory` so undo/redo works for animation changes.

- [ ] **Step 3: Apply animation presentation**

Merge `getClipAnimationPresentation()` styles into preview and timeline clip thumbnails.

### Task 3: Verification

**Files:**
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

- [ ] **Step 1: Run focused tests**

Run: `node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts`

- [ ] **Step 2: Run lint**

Run: `npm.cmd run lint`

## Self-Review

- Spec coverage: Animations top bar, clip selection, adjustable timing and speed/duration are covered.
- Placeholder scan: No TODO/TBD placeholders.
- Type consistency: Helper and type names match the planned UI usage.
