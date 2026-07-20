# Playhead Drag-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent track and ruler clicks from moving the red playhead while retaining direct playhead dragging.

**Architecture:** Keep the existing scrub state and pointer-capture implementation unchanged. Limit the `startTimelineScrub` entry point to the `.timeline-playhead`; track lanes remain selection surfaces and the ruler becomes display-only.

**Tech Stack:** React 19, TypeScript, Node test runner, ESLint.

## Global Constraints

- Only direct dragging of the red playhead changes the playhead frame.
- Track and clip selection must not reposition the playhead.
- Timeline ruler interaction must not reposition the playhead.
- Clip drag and trim behavior must remain unchanged.
- No new dependencies.

---

### Task 1: Restrict Scrubbing To The Playhead

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: existing `startTimelineScrub(event)` and `selectTrackClipAtFrame(track, frame)`
- Produces: playhead-only scrub initiation

- [ ] **Step 1: Write failing UI regression tests**

Add source-wiring assertions that the timeline playhead retains `onPointerDown={startTimelineScrub}`, the timeline ruler has no scrub handler, and the track-lane pointer handler contains selection logic without calling `startTimelineScrub(event)`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="playhead" tests/playhead-ui.test.mts`

Expected: FAIL because the ruler and track lane currently start timeline scrubbing.

- [ ] **Step 3: Remove non-playhead scrub entry points**

Change the ruler to:

```tsx
<div className="timeline-ruler">
```

Keep track-lane selection calculation, but delete this call from its pointer handler:

```ts
startTimelineScrub(event);
```

Do not change the playhead's handler or the existing pointer-move effect.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts
npm.cmd run lint
```

Expected: all tests PASS; ESLint and TypeScript exit 0.

- [ ] **Step 5: Check the running page**

Verify `http://localhost:5173/` returns HTTP 200. In the editor, clicking the overlay/main track must leave the red line fixed, while dragging the red line must move it.
