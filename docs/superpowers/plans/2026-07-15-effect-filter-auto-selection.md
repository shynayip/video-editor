# Effect and Filter Auto-Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically select an editable video clip when the user opens Effects or Filters so the visual option buttons can be clicked immediately.

**Architecture:** Add a pure selection helper to the existing timeline logic, then call it from a shared visual-tool opener in the React editor. The helper keeps a valid current video selection, otherwise prefers an overlay at the playhead, then a main clip at the playhead, then the first main clip.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, Node test runner, ESLint

## Global Constraints

- Effects and filters apply only to main-track and overlay-track video clips.
- Audio, captions, text, and stickers remain unchanged.
- Existing undo and redo behavior remains unchanged.
- Empty timelines keep the visual choices disabled.

---

### Task 1: Select a Visual Clip When Opening Effects or Filters

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `TimelineClip[]`, the current selected clip ID, and the current playhead frame.
- Produces: `getVisualToolTargetClipId(clips, selectedClipId, playheadFrame): string | null` and `openVisualTool(tool: "effects" | "filters"): void`.

- [ ] **Step 1: Write the failing timeline-selection tests**

Add tests proving that `getVisualToolTargetClipId` keeps a selected video, prefers an overlay at the playhead, falls back to the main clip at the playhead, then the first main clip, and returns `null` with no video clips.

```ts
assert.equal(getVisualToolTargetClipId(clips, "selected-main", 90), "selected-main");
assert.equal(getVisualToolTargetClipId(clips, "selected-audio", 90), "overlay-at-90");
assert.equal(getVisualToolTargetClipId(mainOnlyClips, null, 90), "main-at-90");
assert.equal(getVisualToolTargetClipId(mainOnlyClips, null, 999), "first-main");
assert.equal(getVisualToolTargetClipId(audioOnlyClips, null, 20), null);
```

- [ ] **Step 2: Run the focused logic test and verify it fails**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because `getVisualToolTargetClipId` is not exported yet.

- [ ] **Step 3: Implement the pure selection helper**

Add `getVisualToolTargetClipId` to `src/editorLogic.ts`. A valid current selection is a clip on `main` or `upper`; active clips satisfy `start <= playheadFrame < start + duration`. Overlay clips have priority over main clips at the playhead, and the final fallback is the earliest main video clip.

```ts
export const getVisualToolTargetClipId = (
  clips: TimelineClip[],
  selectedClipId: string | null,
  playheadFrame: number,
): string | null => {
  const isVideoClip = (clip: TimelineClip) =>
    (clip.track === "main" || clip.track === "upper") && Boolean(clip.src);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  if (selectedClip && isVideoClip(selectedClip)) return selectedClip.id;

  const activeAtPlayhead = (clip: TimelineClip) =>
    isVideoClip(clip) &&
    clip.start <= playheadFrame &&
    playheadFrame < clip.start + clip.duration;

  return clips.find((clip) => clip.track === "upper" && activeAtPlayhead(clip))?.id ??
    clips.find((clip) => clip.track === "main" && activeAtPlayhead(clip))?.id ??
    clips
      .filter((clip) => clip.track === "main" && isVideoClip(clip))
      .sort((a, b) => a.start - b.start)[0]?.id ??
    null;
};
```

- [ ] **Step 4: Run the logic tests and verify they pass**

Run: `node --test tests/editorLogic.test.mts`

Expected: all editor logic tests PASS.

- [ ] **Step 5: Write the failing UI wiring test**

Add source assertions showing that both visual tabs call one shared handler and that the handler assigns the helper result before changing the active tool.

```ts
assert.match(compositionSource, /const openVisualTool = \(tool: "effects" \| "filters"\)/);
assert.match(compositionSource, /getVisualToolTargetClipId\(clips, selectedClipId, playheadFrame\)/);
assert.match(compositionSource, /onClick=\{\(\) => openVisualTool\("effects"\)\}/);
assert.match(compositionSource, /onClick=\{\(\) => openVisualTool\("filters"\)\}/);
```

- [ ] **Step 6: Run the focused UI test and verify it fails**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because the tabs still call `setActiveTool` directly.

- [ ] **Step 7: Wire both tabs to the shared visual-tool opener**

Import the helper in `src/Composition.tsx`, add the shared handler, and replace the two direct tab callbacks.

```tsx
const openVisualTool = (tool: "effects" | "filters") => {
  const targetClipId = getVisualToolTargetClipId(
    clips,
    selectedClipId,
    playheadFrame,
  );
  setSelectedClipId(targetClipId);
  if (targetClipId) {
    const targetClip = clips.find((clip) => clip.id === targetClipId);
    if (targetClip) setSelectedTrack(targetClip.track);
    setPreviewMode("timeline");
  }
  setActiveTool(tool);
};
```

Use `onClick={() => openVisualTool("effects")}` and `onClick={() => openVisualTool("filters")}` on the corresponding tabs.

- [ ] **Step 8: Run all verification commands**

Run:

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
npm.cmd run lint
```

Expected: all tests PASS; ESLint and TypeScript exit with code 0.

- [ ] **Step 9: Commit the implementation**

```powershell
git add src/editorLogic.ts src/Composition.tsx tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "fix: enable effect and filter clip selection"
```
