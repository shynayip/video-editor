# Wide Tool Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen every editing tool's library panel and use responsive asset grids so more imported items remain visible without unnecessary vertical scrolling.

**Architecture:** Keep the existing three-column workspace and change only its CSS sizing contract. The settings column remains unchanged, the tool library receives a larger responsive range, and the preview retains a minimum usable width. Media and sticker grids use `auto-fill` so available library width becomes additional columns.

**Tech Stack:** React 19, TypeScript, CSS Grid, Node test runner, ESLint.

## Global Constraints

- Apply the wider library to every tool tab.
- Keep the preview at least 480px wide.
- Preserve horizontal workspace overflow on narrow windows.
- Preserve vertical library scrolling as a fallback for very large libraries.
- Do not change timeline, preview playback, imports, drag and drop, or editing behavior.

---

### Task 1: Responsive Tool Library Layout

**Files:**
- Modify: `src/index.css:131-239`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: Existing `.workspace`, `.media-library`, `.media-grid`, and `.sticker-grid` class names.
- Produces: A 420-620px responsive library column and auto-fitting asset grids with 112px minimum tiles.

- [ ] **Step 1: Write the failing layout regression test**

Add this test to `tests/playhead-ui.test.mts`:

```ts
test("widens every tool library and auto-fits asset grids", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.workspace\s*\{[^}]*clamp\(420px,\s*36vw,\s*620px\)[^}]*minmax\(480px,\s*1fr\)/s,
  );
  assert.match(
    css,
    /\.media-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(112px,\s*1fr\)\)/s,
  );
  assert.match(
    css,
    /\.sticker-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(112px,\s*1fr\)\)/s,
  );
  assert.match(css, /\.media-library\s*\{[^}]*overflow-y:\s*auto/s);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test --test-name-pattern="widens every tool library" tests/playhead-ui.test.mts
```

Expected: FAIL because the workspace still uses `clamp(220px, 18vw, 280px)` and both grids still use a fixed three-column layout.

- [ ] **Step 3: Implement the responsive sizing**

Update `src/index.css`:

```css
.workspace {
  grid-template-columns:
    clamp(300px, 24vw, 400px)
    clamp(420px, 36vw, 620px)
    minmax(480px, 1fr);
}

.media-grid,
.sticker-grid {
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
}
```

Keep the existing grid areas, minimum workspace width, overflow declarations, gaps, and all other styles unchanged.

- [ ] **Step 4: Run focused and static verification**

Run:

```powershell
node --test --test-name-pattern="widens every tool library" tests/playhead-ui.test.mts
npx.cmd eslint tests/playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: The focused test passes. ESLint and TypeScript report no new errors.

- [ ] **Step 5: Verify the development server**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/ | Select-Object StatusCode
```

Expected: `StatusCode` is `200`.

- [ ] **Step 6: Commit the implementation**

```powershell
git add src/index.css tests/playhead-ui.test.mts
git commit -m "feat: widen tool asset library"
```
