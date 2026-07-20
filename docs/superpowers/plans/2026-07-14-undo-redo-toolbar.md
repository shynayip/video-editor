# Undo, Redo, and Toolbar Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable timeline Undo and Redo controls and remove the unused Replace toolbar button.

**Architecture:** Represent timeline history as one immutable object containing `past`, `present`, and `future` clip snapshots. Pure helpers apply edits, undo, and redo so behavior can be tested independently; the React component renders `present` as its clips and uses the helpers for every completed timeline edit.

**Tech Stack:** React, TypeScript, Remotion, Node test runner

## Global Constraints

- Redo is a curved-right-arrow icon directly beside Undo.
- New edits after Undo clear Redo history.
- Undo and Redo cover importing, splitting, trimming, deleting, moving, speed, volume, and overlays.
- History contains timeline clip state only.
- Remove only the Replace toolbar button; keep drag-to-replace behavior.

---

### Task 1: Pure timeline history model

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `TimelineHistoryState`
- Produces: `createTimelineHistory(present: TimelineClip[]): TimelineHistoryState`
- Produces: `applyTimelineHistoryEdit(state: TimelineHistoryState, next: TimelineClip[]): TimelineHistoryState`
- Produces: `undoTimelineHistory(state: TimelineHistoryState): TimelineHistoryState`
- Produces: `redoTimelineHistory(state: TimelineHistoryState): TimelineHistoryState`

- [ ] **Step 1: Write failing history tests**

Add tests that create history, apply an edit, undo it, redo it, ignore empty-stack actions, and clear the future stack after a new edit.

- [ ] **Step 2: Run tests to verify RED**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: FAIL because the history exports do not exist.

- [ ] **Step 3: Implement immutable history helpers**

`applyTimelineHistoryEdit` pushes `present` into `past`, installs `next` as `present`, and clears `future`. Undo moves the current `present` to the front of `future`; Redo moves the first `future` snapshot back to `present` and pushes the old `present` into `past`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: all tests PASS.

### Task 2: Wire React editor history and toolbar

**Files:**
- Modify: `src/Composition.tsx`

**Interfaces:**
- Consumes: all Task 1 history helpers.
- Produces: working Undo and Redo buttons with correct disabled states.

- [ ] **Step 1: Replace separate clip history state**

Store `TimelineHistoryState` in one `useState`, derive `clips` from `history.present`, and make `commitClipChange` call `applyTimelineHistoryEdit`.

- [ ] **Step 2: Wire Undo and Redo**

Make Undo call `undoTimelineHistory`; add a `↷` button immediately after it that calls `redoTimelineHistory`. Disable each button from `history.past.length` and `history.future.length`.

- [ ] **Step 3: Record completed trim edits**

Allow pointer movement to preview trimming without adding history entries. On pointer release, commit the final trimmed snapshot once so one drag equals one Undo action.

- [ ] **Step 4: Remove Replace toolbar button**

Delete the icon button with `aria-label="Replace clip"` while retaining the existing media drag replacement handlers.

### Task 3: Verification

**Files:**
- Verify: `src/Composition.tsx`
- Verify: `src/editorLogic.ts`
- Verify: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: completed implementation.

- [ ] **Step 1: Run all editor tests**

Run: `& "C:\Program Files\nodejs\node.exe" --test tests\editorLogic.test.mts`

Expected: zero failures.

- [ ] **Step 2: Run lint and TypeScript**

Run: `& "C:\Program Files\nodejs\npm.cmd" run lint`

Expected: exit code `0`.

- [ ] **Step 3: Verify the running editor**

At `http://localhost:5173/`, confirm Replace is absent, Redo is directly beside Undo, Undo reverses a timeline edit, Redo restores it, and a new edit after Undo disables Redo.
