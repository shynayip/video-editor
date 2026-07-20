# Horizontal 16:9 Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arrange the upper editor workspace as Settings | Import | 16:9 Preview while keeping the timeline full-width below it.

**Architecture:** Keep the existing React DOM structure and use named CSS grid areas to place the three existing panels in the approved visual order. Give the two control panels bounded widths and let the preview column consume the remaining width, while removing the preview's current `600px` ceiling and retaining its existing `16 / 9` window.

**Tech Stack:** React 19, TypeScript, CSS Grid, Remotion, Node test runner

## Global Constraints

- The upper workspace order is Settings panel | Import panel | 16:9 video preview.
- The timeline remains full-width below the workspace.
- Existing editing behavior and project state must remain unchanged.
- Side panels remain independently scrollable.
- The preview remains fully visible at a true `16 / 9` aspect ratio.

---

### Task 1: Reorder and resize the upper workspace

**Files:**
- Create: `tests/workspace-layout.test.mjs`
- Modify: `src/index.css:131-145`
- Modify: `src/index.css:872-900`
- Modify: `src/index.css:1482-1490`

**Interfaces:**
- Consumes: Existing `.workspace`, `.details-panel`, `.media-panel`, `.preview-panel`, `.preview-shell`, and `.preview-window` classes.
- Produces: A named CSS grid with `settings`, `media`, and `preview` areas and a responsive 16:9 preview shell.

- [ ] **Step 1: Write the failing layout contract test**

Create `tests/workspace-layout.test.mjs`:

```js
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("upper workspace uses settings, media, preview horizontal order", () => {
  assert.match(css, /grid-template-areas:\s*"settings media preview"/);
  assert.match(css, /\.details-panel\s*\{[^}]*grid-area:\s*settings/s);
  assert.match(css, /\.media-panel\s*\{[^}]*grid-area:\s*media/s);
  assert.match(css, /\.preview-panel\s*\{[^}]*grid-area:\s*preview/s);
});

test("preview remains 16 by 9 without the old 600px ceiling", () => {
  assert.match(css, /\.preview-window\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
  const previewShell = css.match(/\.preview-shell\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.doesNotMatch(previewShell, /600px/);
  assert.match(previewShell, /width:\s*min\(100%,\s*calc\(177\.78cqh\s*-\s*50px\)\)/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test tests/workspace-layout.test.mjs
```

Expected: FAIL because the named grid areas do not exist and `.preview-shell` still includes `600px`.

- [ ] **Step 3: Implement the approved horizontal grid**

Update the relevant rules in `src/index.css`:

```css
.workspace {
  display: grid;
  grid-template-columns:
    clamp(240px, 19vw, 300px)
    clamp(250px, 22vw, 360px)
    minmax(480px, 1fr);
  grid-template-areas: "settings media preview";
  min-width: 1040px;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.media-panel {
  grid-area: media;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  background: #111821;
  border-right: 1px solid #26313c;
}

.preview-panel {
  grid-area: preview;
  display: grid;
  place-items: center;
  container-type: size;
  min-width: 0;
  min-height: 0;
  padding: 14px 16px;
  overflow: visible;
}

.preview-shell {
  position: relative;
  width: min(100%, calc(177.78cqh - 50px));
  padding-top: 38px;
}

.details-panel {
  grid-area: settings;
  min-height: 0;
  padding: 12px 12px 42px;
  background: #101720;
  border-right: 1px solid #26313c;
  border-left: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
```

Keep the existing preview background declarations and all unrelated declarations in those rules.

- [ ] **Step 4: Run the focused layout test**

Run:

```powershell
node --test tests/workspace-layout.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Run static verification**

Run:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/index.css tests/workspace-layout.test.mjs
```

Expected: Both commands exit successfully. If ESLint does not lint CSS in this repository, run `npx.cmd eslint tests/workspace-layout.test.mjs` and verify `git diff --check -- src/index.css tests/workspace-layout.test.mjs` separately.

- [ ] **Step 6: Verify the editor visually**

Open `http://localhost:5173/` and confirm:

1. Settings is the left column.
2. Import/media is the middle column.
3. The large preview is the right column.
4. The preview is 16:9 and uses the available space without cropping the editor controls.
5. The timeline remains below all three columns.

- [ ] **Step 7: Commit the implementation**

```powershell
git add src/index.css tests/workspace-layout.test.mjs
git commit -m "feat: arrange horizontal 16:9 editor workspace"
```
