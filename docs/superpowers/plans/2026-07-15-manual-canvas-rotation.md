# Manual Canvas Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a draggable rotation handle to Adjustment -> On canvas so users can rotate selected video clips directly on the preview.

**Architecture:** Add a pure angle helper in `editorLogic.ts` for predictable pointer-to-rotation math. Reuse the existing manual adjustment state flow in `Composition.tsx` so rotation updates use the same `setClipAdjustmentById` history path as crop handles.

**Tech Stack:** React, TypeScript, Remotion/Vite, Node test runner.

## Global Constraints

- Keep rotation scoped to selected main/overlay video clips.
- Keep the existing crop handles, rotation slider, and -90/+90 buttons working.
- Use TDD and verify with focused tests plus lint.

---

### Task 1: Rotation Math

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `getManualRotationAngle(centerX, centerY, pointerX, pointerY, rotationOffset)`

- [ ] Write a failing test for pointer-based rotation angle calculation.
- [ ] Implement the pure helper.
- [ ] Run `node --test tests\editorLogic.test.mts`.

### Task 2: On-Canvas Handle

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `getManualRotationAngle`

- [ ] Add a UI wiring test for a manual rotate handle.
- [ ] Add `rotateDrag` state and pointer handlers.
- [ ] Render one rotation handle above `.manual-crop-frame`.
- [ ] Style the handle so it is visually separate from crop handles.

### Task 3: Verification

- [ ] Run `node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts`.
- [ ] Run `npm.cmd run lint`.
- [ ] Check `http://localhost:5173/` responds.

## Self-Review

- Spec coverage: manual on-canvas rotation, selected clip only, crop preserved.
- Placeholder scan: no placeholders.
- Type consistency: helper and state names match implementation plan.
