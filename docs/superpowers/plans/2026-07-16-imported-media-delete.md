# Imported Media Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an unobtrusive hover/focus trash control that removes unused imported media while protecting media referenced by timeline clips.

**Architecture:** A pure helper in `editorLogic.ts` owns reference validation, removal, and selection fallback. `Composition.tsx` invokes it from a nested thumbnail control and reports the result through the existing project status. CSS reveals the icon only during hover or keyboard focus.

**Tech Stack:** React, TypeScript, CSS, Node test runner, ESLint

## Global Constraints

- Do not remove media referenced by any timeline clip.
- The delete icon appears only on thumbnail hover or keyboard focus.
- Clicking delete must not select or begin dragging the media thumbnail.
- Keep edits scoped to the existing editor patterns and dependencies.

---

### Task 1: Protected imported-media deletion

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/editorLogic.test.mts`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `TimelineClip[]`, `SavedMediaItem[]`, and the selected media ID.
- Produces: `removeUnusedMediaItem(...)`, returning the updated items, next selection, outcome, and status message.

- [ ] **Step 1: Write failing helper tests**

Add tests proving that an unused item is removed with first-item selection fallback, while a source referenced by any timeline clip is retained with a blocked outcome.

- [ ] **Step 2: Run the helper tests and verify red**

Run: `node --experimental-strip-types --test --test-name-pattern="removes unused imported media|protects imported media" tests/editorLogic.test.mts`

Expected: FAIL because `removeUnusedMediaItem` is not exported.

- [ ] **Step 3: Implement the pure helper**

Add this public contract in `src/editorLogic.ts`:

```ts
export const removeUnusedMediaItem = ({
  clips,
  mediaItems,
  selectedMediaId,
  mediaId,
}: {
  clips: TimelineClip[];
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  mediaId: string;
}): {
  outcome: "removed" | "blocked" | "unchanged";
  mediaItems: SavedMediaItem[];
  selectedMediaId: string | null;
  message: string;
} => {
  // Resolve the item, protect referenced sources, remove unused media,
  // and choose the first remaining item when the selection was deleted.
};
```

- [ ] **Step 4: Run helper tests and verify green**

Run: `node --experimental-strip-types --test --test-name-pattern="removes unused imported media|protects imported media" tests/editorLogic.test.mts`

Expected: both focused tests PASS.

- [ ] **Step 5: Write a failing UI-source test**

Add a test to `tests/playhead-ui.test.mts` that requires `aria-label={`Delete ${mediaItem.label}`}`, pointer/click propagation prevention, the `media-delete-button` class, and hover/focus reveal selectors.

- [ ] **Step 6: Run the UI test and verify red**

Run: `node --experimental-strip-types --test --test-name-pattern="reveals a protected delete control" tests/playhead-ui.test.mts`

Expected: FAIL because the delete control and styles do not exist.

- [ ] **Step 7: Wire the thumbnail delete control**

In `Composition.tsx`, add a small trash button inside each media thumbnail. Stop pointer and click propagation, call `removeUnusedMediaItem`, update `mediaItems` and `selectedMediaId` only from its result, and display its message through `setProjectStatus`.

- [ ] **Step 8: Add hover and keyboard-focus styling**

In `index.css`, position `.media-delete-button` at the thumbnail lower-right, hide it with opacity and pointer-events by default, and reveal it through `.media-thumb:hover` and `.media-thumb:focus-within`. Include a visible focus outline.

- [ ] **Step 9: Run focused and regression verification**

Run:

```powershell
node --experimental-strip-types --test tests/editorLogic.test.mts
node --experimental-strip-types --test tests/playhead-ui.test.mts
npx.cmd eslint src\editorLogic.ts src\Composition.tsx tests\editorLogic.test.mts tests\playhead-ui.test.mts
npx.cmd tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit the feature**

```powershell
git add src/editorLogic.ts src/Composition.tsx src/index.css tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "add protected imported media deletion"
```
