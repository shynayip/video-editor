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
