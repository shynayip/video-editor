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

