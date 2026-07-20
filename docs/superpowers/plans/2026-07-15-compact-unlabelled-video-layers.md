# Compact Unlabelled Video Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide secondary video-layer wording and reduce the empty add-layer spacing so contextual audio sits close to the video stack.

**Architecture:** Preserve all signed-layer and drop behavior. Change only secondary row label presentation and the dimensions of `.new-video-layer-drop`, while retaining accessible names and drag-over highlighting.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Node test runner

## Global Constraints

- Main track and Audio track labels remain visible.
- Secondary video-layer labels are not visible.
- Secondary rows retain accessible labels.
- Empty new-layer drop strips are `10px` high.
- Existing clip boxes and timeline interactions are unchanged.

---

### Task 1: Hide Secondary Labels and Compact Add-Layer Strips

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `TimelineRow.videoLayer`, current timeline row renderer, and `.new-video-layer-drop` styles.
- Produces: accessible unlabelled secondary rows and compact add-layer drop strips.

- [ ] **Step 1: Add failing source and CSS assertions**

```ts
test("hides secondary video layer labels and compacts add-layer spacing", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /label: `Video layer \+\$\{videoLayer\}`/);
  assert.doesNotMatch(source, /label: `Video layer \$\{videoLayer\}`/);
  assert.match(source, /track\.videoLayer !== undefined \? "" : track\.label/);
  assert.match(source, /aria-label=\{track\.videoLayer !== undefined/);
  assert.match(css, /\.new-video-layer-drop\s*\{[^}]*height:\s*10px/s);
  assert.match(css, /\.new-video-layer-drop \.track-lane\s*\{[^}]*height:\s*10px/s);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests\playhead-ui.test.mts`

Expected: FAIL because secondary labels are currently rendered and the drop targets use the normal row height.

- [ ] **Step 3: Remove visible secondary row wording**

Set generated secondary row labels to an empty string, and give the row label an accessible signed-layer name while keeping Main and Audio unchanged.

```tsx
<div
  className={`track-label ${selectedTrack === track.id ? "selected-track-label" : ""}`}
  aria-label={
    track.videoLayer !== undefined
      ? `Video layer ${track.videoLayer > 0 ? `+${track.videoLayer}` : track.videoLayer}`
      : undefined
  }
>
  {track.videoLayer !== undefined ? "" : track.label}
</div>
```

- [ ] **Step 4: Collapse idle new-layer rows**

```css
.new-video-layer-drop {
  height: 10px;
  min-height: 10px;
  color: #738398;
}

.new-video-layer-drop .track-label,
.new-video-layer-drop .track-lane {
  height: 10px;
  min-height: 10px;
}
```

Keep the transparent idle and highlighted drag-over colors already present.

- [ ] **Step 5: Verify**

Run:

```powershell
node --test tests\playhead-ui.test.mts
npm.cmd run lint
(Invoke-WebRequest -UseBasicParsing http://localhost:5173/ -TimeoutSec 5).StatusCode
```

Expected: UI suite passes, lint/TypeScript exits 0, and HTTP status is 200.

- [ ] **Step 6: Preserve unrelated changes**

Inspect `git status --short`. Do not stage, commit, or revert unrelated workspace edits.
