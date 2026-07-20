# Optional Scene Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask once after gallery file selection whether all selected videos should remain whole or be separated into persistently numbered scene cards.

**Architecture:** Extend saved media metadata with a stable `sourceGroupIndex`, preserve the original source name separately from the visible scene label, and persist the next unused group number at project level. Split the current import handler into a pending-selection stage and a confirmed processing stage, then reuse the existing concurrent upload and scene-analysis pipeline for the selected mode.

**Tech Stack:** React 19, TypeScript, Remotion, native HTML dialog semantics, Node test runner.

## Global Constraints

- One import choice applies to every video selected in the same file selection.
- Full videos keep their original filenames and do not run scene detection.
- Scene labels use `Scene <source group>.<scene position>`.
- Source group numbers continue across imports and survive refreshes.
- Whole-video imports reserve a source group number.
- Deleting media never renumbers existing or future groups.
- Images import normally and do not consume video source group numbers.
- Scene-detection failure creates one full-duration scene with the assigned grouped label.
- Cancel performs no upload and makes no gallery change.

---

### Task 1: Stable Source Group Metadata and Scene Labels

**Files:**
- Modify: `src/editorLogic.ts:138-280`
- Modify: `src/Composition.tsx:155-173`
- Test: `tests/editorLogic.test.mts:137-260`

**Interfaces:**
- Produces: `sourceGroupIndex?: number` and `sourceLabel?: string` on `SavedMediaItem` and `MediaItem`.
- Produces: `getInitialNextSourceGroupIndex(mediaItems: SavedMediaItem[], savedNextSourceGroupIndex?: number): number`.
- Updates: `SavedEditorProject` with `nextSourceGroupIndex?: number` for backward-compatible persistence.
- Updates: `createSceneMediaItems(options)` to consume `sourceGroupIndex: number` and emit grouped labels.
- Updates: `splitSceneMediaItemAtFrame(options)` to retain the source group while renumbering positions within that source only.

- [ ] **Step 1: Write failing metadata and naming tests**

Add tests proving that grouped scene labels are stable, whole videos reserve numbers, and deletion does not lower the next number:

```ts
test("creates grouped scene labels and preserves the original source name", () => {
  const items = createSceneMediaItems({
    sourceFileId: "source-a",
    sourceGroupIndex: 2,
    label: "Interview.mp4",
    src: "/uploads/interview.mp4",
    ranges: [
      {startSeconds: 0, endSeconds: 2},
      {startSeconds: 2, endSeconds: 5},
    ],
    fps: 30,
    sourceDurationInFrames: 150,
  });

  assert.deepEqual(items.map(({label, sourceGroupIndex, sourceLabel, sceneIndex}) => ({
    label,
    sourceGroupIndex,
    sourceLabel,
    sceneIndex,
  })), [
    {label: "Scene 2.1", sourceGroupIndex: 2, sourceLabel: "Interview.mp4", sceneIndex: 1},
    {label: "Scene 2.2", sourceGroupIndex: 2, sourceLabel: "Interview.mp4", sceneIndex: 2},
  ]);
});

test("continues source groups from the persisted counter after deletion", () => {
  const remainingItems: SavedMediaItem[] = [{
    id: "whole-1",
    label: "Whole.mp4",
    src: "/uploads/whole.mp4",
    duration: "00:05",
    durationInFrames: 150,
    kind: "public",
    mediaType: "video",
    sourceGroupIndex: 1,
  }];
  assert.equal(getInitialNextSourceGroupIndex(remainingItems, 4), 4);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because `sourceGroupIndex`, `sourceLabel`, and `getInitialNextSourceGroupIndex` are not implemented and scene labels still use the old source-name format.

- [ ] **Step 3: Implement saved metadata and grouped naming**

Extend the saved item and project types and create the backward-compatible next-group helper:

```ts
export type SavedMediaItem = {
  id: string;
  label: string;
  src: string;
  duration: string;
  durationInFrames: number;
  kind: "local" | "public";
  mediaType?: "video" | "image";
  sourceStart?: number;
  sourceDurationInFrames?: number;
  sourceFileId?: string;
  sceneIndex?: number;
  sourceGroupIndex?: number;
  sourceLabel?: string;
};

export type SavedEditorProject = {
  version: 1;
  savedAt: string;
  clips: TimelineClip[];
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  nextSourceGroupIndex?: number;
};

export const getInitialNextSourceGroupIndex = (
  mediaItems: SavedMediaItem[],
  savedNextSourceGroupIndex?: number,
): number => Math.max(
  Number.isInteger(savedNextSourceGroupIndex) ? savedNextSourceGroupIndex ?? 1 : 1,
  mediaItems.reduce(
    (maximum, item) => Math.max(maximum, item.sourceGroupIndex ?? 0),
    0,
  ) + 1,
);
```

Add `sourceGroupIndex` to `createSceneMediaItems` options and emit each scene with these fields:

```ts
{
  label: `Scene ${sourceGroupIndex}.${sceneIndex}`,
  sourceGroupIndex,
  sourceLabel: label,
  sceneIndex,
}
```

When manually splitting, build renumbered items with:

```ts
label: `Scene ${item.sourceGroupIndex}.${index + 1}`,
sceneIndex: index + 1,
```

Keep legacy label handling only as a fallback when `sourceGroupIndex` is absent. Add `nextSourceGroupIndex: number` to the `createSavedEditorProject` argument object and returned project. In `parseSavedEditorProject`, preserve a valid positive integer and leave the field undefined for legacy saves so `getInitialNextSourceGroupIndex` can derive its initial value.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/editorLogic.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the metadata unit**

```bash
git add src/editorLogic.ts src/Composition.tsx tests/editorLogic.test.mts
git commit -m "feat: add stable scene source groups"
```

---

### Task 2: Whole-Video and Scene Import Processing

**Files:**
- Modify: `src/Composition.tsx:1129-1185,4266-4395`
- Test: `tests/playhead-ui.test.mts:1829-2065`

**Interfaces:**
- Consumes: `getInitialNextSourceGroupIndex(mediaItems, initialProject?.nextSourceGroupIndex)` and grouped `createSceneMediaItems` from Task 1.
- Produces: `ImportVideoMode = "whole" | "scenes"`.
- Produces: `processSelectedMediaFiles(selectedFiles: File[], mode: ImportVideoMode): Promise<void>` inside `MyComponent`.
- Produces: `createWholeVideoMediaItem(options): Promise<MediaItem>` as an exported testable helper.

- [ ] **Step 1: Write failing processing tests**

Add tests proving whole mode skips detection and scene mode passes sequential source groups:

```ts
test("creates a whole video with a reserved source group", async () => {
  const item = await createWholeVideoMediaItem({
    file: new File(["video"], "Full clip.mp4", {type: "video/mp4"}),
    sourceFileId: "source-full",
    sourceGroupIndex: 4,
    previewSrc: "blob:full",
    readDurationInFrames: async () => 180,
    uploadMedia: async () => ({
      src: "/uploads/full.mp4",
      label: "Full clip.mp4",
      mimeType: "video/mp4",
    }),
  });
  assert.equal(item.label, "Full clip.mp4");
  assert.equal(item.sourceGroupIndex, 4);
  assert.equal(item.sourceFileId, "source-full");
});
```

Update the existing concurrent scene-import test so two selected videos receive group 5 and group 6 and produce `Scene 5.1` and `Scene 6.1` labels.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because there is no whole-video helper or import mode and scene analysis does not receive source group numbers.

- [ ] **Step 3: Implement mode-aware processing**

Add:

```ts
type ImportVideoMode = "whole" | "scenes";

type CreateWholeVideoMediaItemOptions = {
  file: File;
  sourceFileId: string;
  sourceGroupIndex: number;
  previewSrc: string;
  readDurationInFrames?: typeof readVideoDurationInFrames;
  uploadMedia?: typeof uploadMediaFile;
};

export const createWholeVideoMediaItem = async ({
  file,
  sourceFileId,
  sourceGroupIndex,
  previewSrc,
  readDurationInFrames = readVideoDurationInFrames,
  uploadMedia = uploadMediaFile,
}: CreateWholeVideoMediaItemOptions): Promise<MediaItem> => {
  const [durationInFrames, uploadedMedia] = await Promise.all([
    readDurationInFrames(previewSrc),
    uploadMedia(file),
  ]);
  return {
    id: `media-${sourceFileId}`,
    label: uploadedMedia.label || file.name,
    src: uploadedMedia.src,
    duration: formatMediaDuration(durationInFrames),
    durationInFrames,
    kind: "public",
    mediaType: "video",
    sourceFileId,
    sourceGroupIndex,
    sourceLabel: uploadedMedia.label || file.name,
  };
};
```

Add component state initialized from the saved counter:

```ts
const [nextSourceGroupIndex, setNextSourceGroupIndex] = useState(() =>
  getInitialNextSourceGroupIndex(
    initialProject?.mediaItems ?? initialMediaItems,
    initialProject?.nextSourceGroupIndex,
  ),
);
```

At processing start, use the current `nextSourceGroupIndex` as the first assigned group. Assign increasing group numbers to videos only, preserving selected-file order, then immediately advance state by the number of selected videos. In `"scenes"` mode call `analyzeImportedVideo` with that number. In `"whole"` mode call `createWholeVideoMediaItem` and do not call scene detection. Keep images on the existing image branch without a group number. Include the updated counter in autosave and explicit Save output.

Only create `Detecting scenes...` cards in `"scenes"` mode. Keep the current concurrency limit of two and existing per-file error collection.

- [ ] **Step 4: Verify processing tests pass**

Run: `node --test tests/playhead-ui.test.mts tests/editorLogic.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit import processing**

```bash
git add src/Composition.tsx tests/playhead-ui.test.mts
git commit -m "feat: support whole or scene video imports"
```

---

### Task 3: Import Choice Dialog

**Files:**
- Modify: `src/Composition.tsx:1420-1435,4266-4395,5590-5620`
- Modify: `src/index.css:120-220`
- Test: `tests/playhead-ui.test.mts:2042-2070`

**Interfaces:**
- Consumes: `processSelectedMediaFiles(files, mode)` from Task 2.
- Produces: pending import state and an accessible native modal dialog.

- [ ] **Step 1: Write failing UI contract tests**

Add source-contract tests for the pending selection and dialog actions:

```ts
test("asks once how selected videos should be imported", () => {
  const source = readComposition();
  assert.match(source, /const \[pendingImportFiles, setPendingImportFiles\]/);
  assert.match(source, /<dialog/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /onCancel=/);
  assert.match(source, />Keep as full videos</);
  assert.match(source, />Separate into scenes</);
  assert.match(source, /processSelectedMediaFiles\(pendingImportFiles, "whole"\)/);
  assert.match(source, /processSelectedMediaFiles\(pendingImportFiles, "scenes"\)/);
  assert.match(source, /setPendingImportFiles\(\[\]\)/);
});
```

- [ ] **Step 2: Run the UI tests and verify RED**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because selection currently begins importing immediately and no confirmation dialog exists.

- [ ] **Step 3: Queue files before importing**

Change the file-input handler to filter supported files, store them in `pendingImportFiles`, and reset the native input. Do not upload or add analyzing cards at this stage.

Create handlers:

```ts
const confirmPendingImport = (mode: ImportVideoMode) => {
  const files = pendingImportFiles;
  setPendingImportFiles([]);
  void processSelectedMediaFiles(files, mode);
};

const cancelPendingImport = () => {
  setPendingImportFiles([]);
  setProjectStatus("Import cancelled");
};
```

Skip the dialog when the selection contains only images and process those immediately because the scene choice cannot affect them.

- [ ] **Step 4: Render and style the accessible dialog**

Render one native modal when `pendingImportFiles` contains at least one video. Include the affected video count, the two explicit actions, and Cancel. Keep a ref to the dialog and call `showModal()` from an effect when it mounts; native modal behavior traps keyboard focus. Handle the dialog's `cancel` event so Escape uses `cancelPendingImport`. Use these classes:

```tsx
<dialog
  ref={importChoiceDialogRef}
  className="import-choice-dialog"
  onCancel={(event) => {
    event.preventDefault();
    cancelPendingImport();
  }}
>
  <section
    aria-labelledby="import-choice-title"
  >
    <h2 id="import-choice-title">Separate imported videos?</h2>
    <p>{videoCount} selected video{videoCount === 1 ? "" : "s"}</p>
    <div className="import-choice-actions">
      <button type="button" onClick={() => confirmPendingImport("whole")}>
        Keep as full videos
      </button>
      <button type="button" onClick={() => confirmPendingImport("scenes")}>
        Separate into scenes
      </button>
      <button type="button" onClick={cancelPendingImport}>Cancel</button>
    </div>
  </section>
</dialog>
```

Style the dialog's `::backdrop` above the workspace and timeline, constrain the dialog to `min(420px, calc(100vw - 32px))`, and use the editor's existing teal primary action and restrained dark surfaces.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/playhead-ui.test.mts tests/editorLogic.test.mts`

Expected: PASS.

- [ ] **Step 6: Commit the dialog**

```bash
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: ask before separating imported videos"
```

---

### Task 4: Persistence, Compatibility, and End-to-End Verification

**Files:**
- Modify: `tests/editorLogic.test.mts`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes all metadata and import UI from Tasks 1-3.
- Produces no new production interface.

- [ ] **Step 1: Add persistence and fallback tests**

Add a save/parse round-trip test containing both a whole video and scene cards with source group numbers. Assert that `parseSavedEditorProject(JSON.stringify(project))` preserves `sourceGroupIndex`, `sourceLabel`, and `nextSourceGroupIndex` exactly.

Update the existing scene-detection fallback test to expect one full-duration card named `Scene 7.1` with `sourceGroupIndex: 7`.

- [ ] **Step 2: Run persistence tests and verify their result**

Run: `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`

Expected: PASS after Tasks 1-3. If a new test fails, correct the production serialization or fallback path rather than weakening the assertion.

- [ ] **Step 3: Run the complete project verification**

Run:

```bash
node --test tests/*.test.mts tests/*.test.mjs
npx.cmd tsc --noEmit
```

Expected: all tests pass and TypeScript exits with code 0. The existing Node module-type warning may remain; no new errors are acceptable.

- [ ] **Step 4: Verify in the running editor**

At `http://localhost:5173/` verify:

1. Select two videos and choose **Keep as full videos**; two ordinary filename cards appear and no `Detecting scenes...` cards appear.
2. Select two more videos and choose **Separate into scenes**; cards use consecutive groups and positions such as `Scene 3.1`, `Scene 3.2`, `Scene 4.1`.
3. Refresh; grouped labels and source numbers remain unchanged.
4. Delete an earlier whole video, import another separated video, and confirm its group number continues upward.
5. Select a video and Cancel; the gallery and upload list remain unchanged.
6. Import an image-only selection; it imports without showing the scene-choice dialog.

- [ ] **Step 5: Commit verification coverage**

```bash
git add tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "test: cover optional scene import persistence"
```
