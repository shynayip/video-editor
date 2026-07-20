# Right Preview Editor Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current top bar unchanged while placing controls in the upper-left, the timeline in the lower-left, and a full-height preview on the right.

**Architecture:** Reuse the existing JSX panel boundaries and make `.workspace` participate transparently in the root editor grid with `display: contents`. Position the existing media, details, preview, and timeline panels in explicit root-grid cells, avoiding editing-state or playback changes.

**Tech Stack:** React 19, TypeScript, CSS Grid, Remotion, Node test runner

## Global Constraints

- Keep the top navigation, project status, Save button, and Export button unchanged.
- Keep all existing editor behavior and project data unchanged.
- The timeline occupies only the lower-left region.
- The preview spans the complete right side below the top bar.
- Controls and Import/Record share the upper-left region.
- Preserve internal scrolling and prevent overlap at narrower desktop widths.

---

### Task 1: Lock The New Panel Arrangement

**Files:**
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: source text from `src/index.css` and `src/Composition.tsx`
- Produces: a focused regression test for the approved root-grid panel placement

- [ ] **Step 1: Write the failing layout test**

Add a test that verifies the top bar spans both columns, the workspace uses `display: contents`, media/details occupy row 2 column 1, preview occupies column 2 across rows 2 and 3, and timeline occupies row 3 column 1.

```ts
test("keeps controls and timeline left of a full-height right preview", () => {
  assert.match(css, /\.editor-shell\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.topbar\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(css, /\.workspace\s*\{[^}]*display:\s*contents/s);
  assert.match(css, /\.media-panel\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*2/s);
  assert.match(css, /\.details-panel\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*2/s);
  assert.match(css, /\.preview-panel\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*2\s*\/\s*4/s);
  assert.match(css, /\.timeline-panel\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*3/s);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/playhead-ui.test.mts`

Expected: the new panel-arrangement test fails because the current editor uses one full-width workspace row and one full-width timeline row.

---

### Task 2: Implement The Left Stack And Right Preview

**Files:**
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: existing `.editor-shell`, `.workspace`, `.media-panel`, `.details-panel`, `.preview-panel`, and `.timeline-panel` elements
- Produces: explicit CSS Grid placement without changing component state or events

- [ ] **Step 1: Change the root editor grid**

Give the editor two columns and three rows. Keep the top bar across both columns.

```css
.editor-shell {
  grid-template-columns: minmax(620px, 46%) minmax(640px, 1fr);
  grid-template-rows: 48px minmax(360px, 1fr) clamp(220px, 32vh, 320px);
  min-width: 1260px;
}

.topbar {
  grid-column: 1 / -1;
  grid-row: 1;
}
```

- [ ] **Step 2: Place existing panels into the new cells**

Make the workspace wrapper transparent to the parent grid. Place media and settings together in the upper-left, preview across the full right side, and timeline in the lower-left.

```css
.workspace {
  display: contents;
}

.media-panel {
  grid-column: 1;
  grid-row: 2;
  width: 62%;
}

.details-panel {
  grid-column: 1;
  grid-row: 2;
  width: 38%;
  justify-self: end;
}

.preview-panel {
  grid-column: 2;
  grid-row: 2 / 4;
}

.timeline-panel {
  grid-column: 1;
  grid-row: 3;
}
```

Retain the cutout-specific behavior by allowing `.workspace.cutout-workspace .media-panel` to fill the upper-left cell when the details panel is hidden.

- [ ] **Step 3: Preserve internal sizing and scrolling**

Keep `min-width: 0`, `min-height: 0`, and panel-specific overflow rules. Ensure the preview shell and timeline scroll area cannot resize the root tracks or cover neighboring cells.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `node --test tests/playhead-ui.test.mts`

Expected: all focused UI tests pass, including the new arrangement test.

- [ ] **Step 5: Run regression checks**

Run: `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`

Expected: all tests pass.

Run: `npx.cmd tsc --noEmit`

Expected: exit code 0.

Run: `git diff --check -- src/index.css tests/playhead-ui.test.mts`

Expected: no whitespace errors.

---

### Task 3: Verify The Live Layout

**Files:**
- Verify: `src/index.css`
- Verify: `src/Composition.tsx`

**Interfaces:**
- Consumes: the running Vite editor at `http://localhost:5173`
- Produces: visual confirmation that the approved sketch is matched

- [ ] **Step 1: Open the live editor at a desktop viewport**

Verify that the unchanged top bar spans the page, controls occupy the upper-left, the timeline stays lower-left, and the preview fills the right side beside both left panels.

- [ ] **Step 2: Check narrower desktop behavior**

Verify that the minimum editor canvas scrolls horizontally rather than causing controls, preview content, timeline labels, or buttons to overlap.

- [ ] **Step 3: Exercise representative interactions**

Select Media and Adjustment, select a clip, move the playhead, and play/pause the preview. Confirm that panel placement does not change and existing interactions still work.

- [ ] **Step 4: Record completion without committing unrelated work**

Leave the focused changes uncommitted because this is a shared dirty worktree. Report the exact verification commands and any residual visual limitations.
