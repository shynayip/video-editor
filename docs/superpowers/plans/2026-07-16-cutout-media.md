# Cutout Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently editable image and video cutouts with linked video audio.

**Architecture:** Extend `TimelineClip` with a dedicated cutout transform and track. Keep media timing and linked audio in `editorLogic.ts`, while `Composition.tsx` owns import, preview interaction, and timeline rendering. Uploaded assets remain public-file-backed for saving and export.

**Tech Stack:** React, TypeScript, Remotion, Express, Node test runner, CSS

## Global Constraints

- Cutout images do not create audio.
- Cutout videos create reciprocal linked audio.
- Existing project data and editing behavior must remain compatible.
- Automatic AI background removal is not included.

---

### Task 1: Cutout Logic

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

- [ ] Write failing tests for cutout image creation, video/audio pairing, playback, contextual audio, trim, split, and delete.
- [ ] Run the focused logic tests and confirm the missing cutout API fails.
- [ ] Add the cutout track, transform type, creation helpers, and linked-audio support.
- [ ] Run the focused logic tests and confirm they pass.

### Task 2: Cutout Interface

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

- [ ] Write failing UI wiring tests for the Cutout tab, importer, preview object, transform handles, and timeline row.
- [ ] Run the UI tests and confirm the missing interface fails.
- [ ] Add public-backed import, preview controls, playback synchronization, and timeline rendering.
- [ ] Run the UI tests and confirm they pass.

### Task 3: Upload And Verification

**Files:**
- Modify: `server/transcriptionServer.mjs`

- [ ] Allow supported image uploads through `/api/media`.
- [ ] Run logic and UI tests, TypeScript, and targeted ESLint.
- [ ] Confirm the Vite editor responds on `http://localhost:5173/`.
