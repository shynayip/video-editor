# Quiet New Track Drop Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide persistent new-track wording while retaining usable above/below video drop targets that reveal normal track rows after placement.

**Architecture:** Keep the existing dynamic signed-layer data and drag/drop behavior unchanged. Modify only the empty drop-target presentation: use accessible labels instead of visible text, quiet idle styling, and the existing highlighted drag-over state.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Node test runner

## Global Constraints

- Empty new-track targets render no visible wording.
- Both above and below drop targets remain usable.
- Drop targets retain an `aria-label`.
- Existing populated track rows and clips remain unchanged.
- Drag-over state remains visibly highlighted.

---

### Task 1: Make Empty New-Track Targets Visually Quiet

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: existing `data-new-video-layer`, `videoDropTarget`, and `.new-video-layer-drop` behavior.
- Produces: text-free accessible drop targets with unchanged placement behavior.

- [ ] **Step 1: Add a failing UI source test**

Add a test that verifies both direction attributes and accessible labels remain, while visible label strings are absent from rendered JSX.

```ts
test("keeps new video layer drop targets accessible without visible wording", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-new-video-layer="above"/);
  assert.match(source, /data-new-video-layer="below"/);
  assert.match(source, /aria-label="Add video track above"/);
  assert.match(source, /aria-label="Add video track below"/);
  assert.doesNotMatch(source, />New track above</);
  assert.doesNotMatch(source, />New track below</);
});
```

- [ ] **Step 2: Run the test and observe the expected failure**

Run: `node --test tests\playhead-ui.test.mts`

Expected: FAIL because the current JSX still renders `New track above` and `New track below`.

- [ ] **Step 3: Replace visible labels with accessibility labels**

For every above/below new-layer target, add the direction-specific `aria-label` to the outer target and make the track-label element decorative and empty.

```tsx
<div
  className="timeline-track new-video-layer-drop"
  data-new-video-layer="above"
  aria-label="Add video track above"
>
  <div className="track-label" aria-hidden="true" />
  <div className="track-lane" />
</div>
```

Use `aria-label="Add video track below"` for both conditional below-target render paths.

- [ ] **Step 4: Keep idle styling quiet and drag-over styling visible**

Preserve the shared timeline grid. Make the idle lane border transparent while retaining the existing highlighted dashed state.

```css
.new-video-layer-drop .track-lane {
  border-color: transparent;
  border-style: dashed;
  background: transparent;
}

.new-video-layer-drop.drop-target .track-lane {
  border-color: #38d6c8;
  background: #12302f;
}
```

- [ ] **Step 5: Run verification**

Run:

```powershell
node --test tests\playhead-ui.test.mts
npm.cmd run lint
(Invoke-WebRequest -UseBasicParsing http://localhost:5173/ -TimeoutSec 5).StatusCode
```

Expected: UI tests pass, lint and TypeScript exit 0, and the page returns HTTP 200.

- [ ] **Step 6: Preserve unrelated workspace changes**

Inspect `git status --short` and leave unrelated modified/untracked files untouched. Do not stage or commit implementation files together with unrelated changes.
