# Standalone Preview Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the standalone video preview while compressing the timeline into a shorter, left-aligned editing band.

**Architecture:** Preserve the existing React component and all editor state. Implement the approved layout through the existing CSS grid, preview container sizing, and timeline spacing so playback and editing behavior remain unchanged.

**Tech Stack:** React, TypeScript, Remotion, CSS Grid, Node test runner

## Global Constraints

- Preserve portrait and landscape aspect ratios without stretching or cropping.
- Do not change clip timing, drag, trim, split, overlay, audio, caption, text, playhead, or history behavior.
- Preserve horizontal timeline scrolling and vertical scrolling for additional tracks.
- Keep the preview and timeline as separate non-overlapping bands.

---

### Task 1: Preview-Dominant Editor Grid

**Files:**
- Modify: `src/index.css:24-31`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: existing `.editor-shell`, `.workspace`, `.preview-panel`, and `.preview-shell` layout classes.
- Produces: a preview-dominant three-row editor grid with a compact timeline row.

- [ ] **Step 1: Write the failing layout regression test**

Add a test that reads `src/index.css` and asserts the editor uses a flexible workspace row, a compact bounded timeline row, and an uncropped preview container:

```ts
test("gives the standalone preview most of the editor height", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.editor-shell\s*\{[^}]*grid-template-rows:\s*48px\s+minmax\(0,\s*1fr\)\s+clamp\(170px,\s*20vh,\s*200px\)/s,
  );
  assert.match(css, /\.preview-panel\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.preview-shell\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.preview-window\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*16/s);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test --test-name-pattern="gives the standalone preview most" tests/playhead-ui.test.mts
```

Expected: FAIL because `.editor-shell` still reserves `260px` for the timeline.

- [ ] **Step 3: Implement the preview-dominant grid**

Update the existing rules in `src/index.css`:

```css
.editor-shell {
  grid-template-rows: 48px minmax(0, 1fr) clamp(170px, 20vh, 200px);
}

.preview-shell {
  height: 100%;
}
```

Keep the existing `width: min(100%, calc(100cqh * 9 / 16))` and `.preview-window { aspect-ratio: 9 / 16; }` declarations so portrait video remains contained and centered.

- [ ] **Step 4: Run the focused test**

Run:

```powershell
node --test --test-name-pattern="gives the standalone preview most" tests/playhead-ui.test.mts
```

Expected: PASS.

---

### Task 2: Compact Left-Aligned Timeline

**Files:**
- Modify: `src/index.css:2030-2075`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: existing timeline toolbar, track labels, timeline scroll area, and clip rows.
- Produces: a shorter timeline with its tools and duration grouped at the left while preserving scrolling.

- [ ] **Step 1: Write the failing compact timeline test**

Add:

```ts
test("keeps compact timeline controls aligned to the left", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.timeline-toolbar\s*\{[^}]*justify-content:\s*flex-start[^}]*gap:\s*16px/s,
  );
  assert.match(css, /\.timeline-panel\s*\{[^}]*padding:\s*6px\s+0\s+8px/s);
  assert.match(css, /\.timeline-scroll\s*\{[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*auto/s);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test --test-name-pattern="keeps compact timeline controls" tests/playhead-ui.test.mts
```

Expected: FAIL because the toolbar currently uses `space-between` and the timeline has larger padding.

- [ ] **Step 3: Implement compact timeline spacing**

Update the existing rules:

```css
.timeline-panel {
  padding: 6px 0 8px;
}

.timeline-toolbar {
  justify-content: flex-start;
  gap: 16px;
  height: 32px;
  padding: 0 14px;
}
```

Do not modify `.timeline-scroll` overflow behavior or clip geometry.

- [ ] **Step 4: Run the focused layout tests and TypeScript**

Run:

```powershell
node --test --test-name-pattern="standalone preview|compact timeline" tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: both layout tests PASS and TypeScript exits with code `0`.

---

### Task 3: Visual Verification

**Files:**
- Verify: `src/index.css`
- Verify: `src/Composition.tsx`

**Interfaces:**
- Consumes: the running editor at `http://localhost:5173/MyComp`.
- Produces: confirmed desktop and narrow-viewport layout behavior.

- [ ] **Step 1: Start or reuse the editor server**

Run:

```powershell
npm.cmd run dev -- --port 5173
```

Expected: Remotion Studio reports `http://localhost:5173`.

- [ ] **Step 2: Verify desktop layout**

At a desktop viewport, confirm the preview is larger than before, remains centered, and does not overlap the timeline. Confirm the toolbar and duration begin from the left and all visible tracks remain interactive.

- [ ] **Step 3: Verify a narrow viewport**

Confirm the preview remains contained, the workspace can scroll where required, text and captions remain inside the canvas, and the timeline retains horizontal and vertical scrolling.

- [ ] **Step 4: Run final regression checks**

Run:

```powershell
node --test tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
git diff --check -- src/index.css tests/playhead-ui.test.mts
```

Expected: all tests PASS, TypeScript exits with code `0`, and `git diff --check` reports no whitespace errors.
