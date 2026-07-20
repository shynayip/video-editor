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

