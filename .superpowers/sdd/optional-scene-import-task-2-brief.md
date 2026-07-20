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

