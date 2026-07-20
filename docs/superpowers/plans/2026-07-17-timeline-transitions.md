# Timeline Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clickable transition nodes between adjacent video clips, Animations-panel controls with duration adjustment, transition preview rendering, and selected-only trim handles.

**Implementation update:** A later interface decision moved the transition picker into the existing Animations details panel instead of an anchored popover. The duration control accepts one frame through the maximum valid adjacent-clip duration.

**Architecture:** Store a transition on the incoming `TimelineClip`, derive valid boundaries with pure helpers, and update transitions through the existing undoable timeline history. `Composition.tsx` renders boundary buttons and one anchored popover, while pure presentation helpers provide deterministic preview styles for both clips around the boundary.

**Tech Stack:** React, TypeScript, Remotion, native pointer events, Node test runner, CSS.

## Global Constraints

- Nodes appear only between adjacent source-backed video clips on the same video layer.
- Choices are None, Fade, Dissolve, Slide, and Zoom.
- Transition duration cannot exceed either neighboring clip's available duration.
- Clicking outside or pressing Escape closes the popover.
- Trim handles appear only on the selected clip.
- All timeline edits must remain undoable and redoable.

---

### Task 1: Transition Model and Boundary Helpers

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `ClipTransitionPreset`, `ClipTransitionStyle`, `TimelineTransitionBoundary`, `getTimelineTransitionBoundaries(clips, videoLayer)`, and `setClipTransitionById(clips, incomingClipId, preset, duration)`.
- Consumes: existing `TimelineClip`, `getVideoLayer()`, and immutable clip-array update conventions.

- [ ] **Step 1: Write failing model tests**

Add tests proving that adjacent clips produce one boundary, a gap produces none, different layers do not pair, duration is clamped to both clips, and `none` removes the saved transition:

```ts
test("derives transitions only between adjacent clips on one video layer", () => {
  const first = {...videoClip, id: "first", start: 0, duration: 30, videoLayer: 0};
  const second = {...videoClip, id: "second", start: 30, duration: 20, videoLayer: 0};
  const gap = {...videoClip, id: "gap", start: 60, duration: 10, videoLayer: 0};
  assert.deepEqual(getTimelineTransitionBoundaries([gap, second, first], 0), [{
    outgoingClipId: "first",
    incomingClipId: "second",
    frame: 30,
  }]);
});

test("clamps and removes an incoming clip transition", () => {
  const first = {...videoClip, id: "first", start: 0, duration: 30, videoLayer: 0};
  const second = {...videoClip, id: "second", start: 30, duration: 12, videoLayer: 0};
  const applied = setClipTransitionById([first, second], "second", "fade", 40);
  assert.deepEqual(applied[1].transition, {preset: "fade", duration: 12});
  const removed = setClipTransitionById(applied, "second", "none", 12);
  assert.equal(removed[1].transition, undefined);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="transition" tests/editorLogic.test.mts
```

Expected: FAIL because the transition exports do not exist.

- [ ] **Step 3: Add the transition types and pure helpers**

Add this model to `TimelineClip` and implement deterministic boundary lookup:

```ts
export type ClipTransitionPreset = "none" | "fade" | "dissolve" | "slide" | "zoom";
export type ClipTransitionStyle = {
  preset: Exclude<ClipTransitionPreset, "none">;
  duration: number;
};
export type TimelineTransitionBoundary = {
  outgoingClipId: string;
  incomingClipId: string;
  frame: number;
};

// In TimelineClip:
transition?: ClipTransitionStyle;
```

`getTimelineTransitionBoundaries()` filters source-backed `main`/`upper` clips to `getVideoLayer(clip) === videoLayer`, sorts by `start`, and pairs clips only when `previous.start + previous.duration === current.start`. `setClipTransitionById()` finds that adjacent predecessor and clamps duration to `Math.max(1, Math.min(requested, previous.duration, incoming.duration))`; `none` returns the incoming clip without `transition`.

- [ ] **Step 4: Run focused and complete logic tests**

```powershell
node --test --test-name-pattern="transition" tests/editorLogic.test.mts
node --test tests/editorLogic.test.mts
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the model**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add timeline transition model"
```

---

### Task 2: Timeline Boundary Node and Picker

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `getTimelineTransitionBoundaries()` and `setClipTransitionById()` from Task 1.
- Produces: accessible `.transition-node` buttons and one `.transition-popover` associated with the selected incoming clip.

- [ ] **Step 1: Write failing UI structure tests**

Assert the source renders boundary nodes, an anchored dialog, preset buttons, a duration slider, and closes on Escape/outside click. Preserve the existing selected-only trim conditional:

```ts
test("renders transition nodes and an anchored transition picker", () => {
  assert.match(source, /className="transition-node"/);
  assert.match(source, /aria-label=\{`Add transition between/);
  assert.match(source, /className="transition-popover"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-label="Transition duration"/);
  assert.match(source, /setClipTransitionById/);
});

test("shows trim handles only for the selected clip", () => {
  assert.match(source, /selectedClipId === clip\.id \? \([\s\S]*trim-handle-left[\s\S]*trim-handle-right/);
});
```

- [ ] **Step 2: Run the focused UI tests and verify RED**

```powershell
node --test --test-name-pattern="transition nodes|trim handles" tests/playhead-ui.test.mts
```

Expected: transition-node test FAILS; the trim regression remains PASSING.

- [ ] **Step 3: Add boundary selection and undoable updates**

In `Composition.tsx`, add `selectedTransitionClipId: string | null`, derive boundaries per rendered video layer, and update via the existing `commitClipChange` path:

```ts
const updateSelectedTransition = (preset: ClipTransitionPreset, duration: number) => {
  if (!selectedTransitionClipId) return;
  commitClipChange((currentClips) =>
    setClipTransitionById(currentClips, selectedTransitionClipId, preset, duration),
  );
};
```

Selecting a node clears `selectedClipId`; selecting a clip clears `selectedTransitionClipId`. Add one document-level pointer listener for outside dismissal and one keydown listener for Escape, both cleaned up by `useEffect`.

- [ ] **Step 4: Render the node and picker**

For each boundary, render an absolute icon button at `boundary.frame * timelineScale`. Use an icon-only node with tooltip text. The open popover contains five preset buttons and a range input from 6 frames to the maximum valid boundary duration. Applying `None` removes the transition and keeps the picker open for immediate comparison.

- [ ] **Step 5: Style the controls without shifting clips**

Add stable dimensions and layering:

```css
.transition-node {
  position: absolute;
  top: 50%;
  width: 24px;
  height: 24px;
  translate: -50% -50%;
  z-index: 8;
}

.transition-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  width: 248px;
  z-index: 20;
}

.timeline-clip:not(.selected-timeline-clip) .trim-handle {
  display: none;
}
```

- [ ] **Step 6: Run UI tests and TypeScript**

```powershell
node --test --test-name-pattern="transition nodes|trim handles" tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Commit the timeline interaction**

```powershell
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: add timeline transition picker"
```

---

### Task 3: Deterministic Transition Preview

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Produces: `getClipTransitionPresentation(clips, clipId, frame)` returning `{opacity, translateX, scale}` for the outgoing/incoming edge.
- Consumes: transition data and adjacency helpers from Task 1.

- [ ] **Step 1: Write failing presentation tests**

For a transition at frame 30 with duration 10, assert neutral presentation outside frames 25-35 and deterministic midpoint values at frame 30. Cover Fade, Dissolve, Slide, and Zoom, including outgoing and incoming clip IDs.

```ts
test("presents both sides of a fade around an adjacent boundary", () => {
  const clips = setClipTransitionById([first, second], "second", "fade", 10);
  assert.deepEqual(getClipTransitionPresentation(clips, "first", 30), {
    opacity: 0.5, translateX: 0, scale: 1,
  });
  assert.deepEqual(getClipTransitionPresentation(clips, "second", 30), {
    opacity: 0.5, translateX: 0, scale: 1,
  });
});
```

- [ ] **Step 2: Run the presentation test and verify RED**

```powershell
node --test --test-name-pattern="presents both sides" tests/editorLogic.test.mts
```

Expected: FAIL because the presentation helper does not exist.

- [ ] **Step 3: Implement presentation math**

Use a centered transition window: `start = boundary - floor(duration / 2)` and `end = boundary + ceil(duration / 2)`. Clamp progress to 0..1. Fade/Dissolve crossfade opacity; Slide moves outgoing from `0` to `-12` percent and incoming from `12` to `0`; Zoom scales outgoing from `1` to `1.06` while fading and incoming from `0.94` to `1` while fading. Return neutral values outside the window.

- [ ] **Step 4: Wire preview layers**

During the transition window, keep the outgoing clip available through its last source frame and the incoming clip available from its first source frame. Compose transition presentation with `getClipFrameStyle()` so existing filter, effect, adjustment, and entrance-animation styles are preserved. Timeline thumbnails remain unchanged.

- [ ] **Step 5: Run preview and full editor tests**

```powershell
node --test --test-name-pattern="transition" tests/editorLogic.test.mts tests/playhead-ui.test.mts
node --test tests/editorLogic.test.mts tests/media-preview-ui.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: all tests PASS.

- [ ] **Step 6: Commit preview rendering**

```powershell
git add src/editorLogic.ts src/Composition.tsx tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "feat: preview timeline transitions"
```

---

### Task 4: Browser Verification and Edge Cases

**Files:**
- Verify: `src/Composition.tsx`, `src/index.css`, `src/editorLogic.ts`
- Verify: `tests/editorLogic.test.mts`, `tests/media-preview-ui.test.mts`, `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: completed transition model, UI, and preview.
- Produces: verified desktop interaction with no timeline layout shift.

- [ ] **Step 1: Verify the interaction in the running editor**

At `http://localhost:5173/`, place two clips directly adjacent on Main track. Confirm one transition node appears at their boundary, opens by click, and does not appear at a gap or track end.

- [ ] **Step 2: Verify contextual controls**

Select the first clip, second clip, and empty lane. Confirm trim handles appear only on the selected clip. Open the transition picker, click outside, reopen it, and press Escape; both dismissal paths must work.

- [ ] **Step 3: Verify presets, duration, history, and preview**

Apply each preset, adjust duration, play across the boundary, then use Undo and Redo. Confirm the transition and duration restore correctly and clip timing remains unchanged.

- [ ] **Step 4: Run final verification**

```powershell
node --test tests/editorLogic.test.mts tests/media-preview-ui.test.mts tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
git diff --check -- src/Composition.tsx src/editorLogic.ts src/index.css tests/editorLogic.test.mts tests/playhead-ui.test.mts
```

Expected: all tests pass, TypeScript exits 0, and diff check exits 0.
