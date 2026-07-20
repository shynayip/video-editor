# Vertical 9:16 Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the editor preview canvas from horizontal 16:9 to centered vertical 9:16 without changing workspace panel order or timeline behavior.

**Architecture:** Keep the existing three-column workspace and preview component structure. Update only the CSS geometry that limits the preview shell and defines the preview window ratio, with a focused source-level regression test and a browser measurement check.

**Tech Stack:** React, TypeScript, CSS, Node test runner, Vite, Remotion Studio UI.

## Global Constraints

- The workspace order remains `Settings | Import | Preview`.
- The timeline remains full-width underneath the workspace.
- The visible preview window must use an exact `9 / 16` aspect ratio.
- Existing media fitting, transforms, playback, and timeline behavior must remain unchanged.
- The preview must remain centered and must not overlap adjacent panels or the timeline.

---

### Task 1: Convert the preview canvas to 9:16

**Files:**
- Modify: `tests/workspace-layout.test.mjs`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Existing `.preview-panel`, `.preview-shell`, and `.preview-window` CSS selectors.
- Produces: A centered preview shell whose maximum width is derived from available container height at a `9 / 16` ratio, and a preview window with `aspect-ratio: 9 / 16`.

- [ ] **Step 1: Write the failing layout test**

Replace the horizontal preview assertions in `tests/workspace-layout.test.mjs` with:

```js
assert.match(previewShell, /width:\s*min\(100%, calc\(\(100cqh - 38px\) \* 9 \/ 16\)\);/);
assert.match(previewWindow, /aspect-ratio:\s*9\s*\/\s*16;/);
assert.doesNotMatch(previewShell, /\* 16 \/ 9/);
assert.doesNotMatch(previewWindow, /aspect-ratio:\s*16\s*\/\s*9;/);
```

- [ ] **Step 2: Run the focused test and verify it fails for the old ratio**

Run:

```powershell
node --test tests/workspace-layout.test.mjs
```

Expected: `FAIL` because `.preview-shell` and `.preview-window` still use `16 / 9`.

- [ ] **Step 3: Implement the vertical preview geometry**

Change the preview rules in `src/index.css` to:

```css
.preview-shell {
  position: relative;
  width: min(100%, calc((100cqh - 38px) * 9 / 16));
  padding-top: 38px;
}

.preview-window {
  position: relative;
  width: 100%;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  background: #020617;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 20px 52px rgba(0, 0, 0, 0.38);
}
```

- [ ] **Step 4: Run automated verification**

Run:

```powershell
node --test tests/workspace-layout.test.mjs
npx.cmd tsc --noEmit
```

Expected: Both commands exit with code `0` and the focused test reports one passing test.

- [ ] **Step 5: Verify the layout in the browser**

Open `http://localhost:5173/` at a desktop viewport and measure the rendered preview window. Confirm:

```text
preview width / preview height = 9 / 16
preview left >= import panel right
preview right <= workspace right
preview bottom <= timeline top
```

Also confirm the preview is visibly centered in the preview panel and the rotation control remains above it.

- [ ] **Step 6: Commit the implementation**

```powershell
git add tests/workspace-layout.test.mjs src/index.css
git commit -m "feat: use vertical 9:16 preview canvas"
```
