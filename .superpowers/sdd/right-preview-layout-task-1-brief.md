# Right Preview Layout Task 1

## Objective

Implement Tasks 1 and 2 from `docs/superpowers/plans/2026-07-17-right-preview-editor-layout.md`: add a focused failing UI source test, then implement the approved root CSS Grid layout.

## Binding Requirements

- Read `docs/superpowers/specs/2026-07-17-right-preview-editor-layout-design.md` and `docs/superpowers/plans/2026-07-17-right-preview-editor-layout.md` first.
- Keep the existing top bar visually and behaviorally unchanged.
- Below the top bar, controls and Import/Record share the upper-left region.
- The timeline occupies only the lower-left region.
- The preview occupies the full right side beside both left regions.
- Preserve all editing, playback, persistence, media, and timeline behavior.
- Prefer a CSS-only solution using the existing panel markup. Do not edit `src/Composition.tsx` unless CSS Grid cannot meet the requirements.
- Modify only `src/index.css` and `tests/playhead-ui.test.mts` unless an unavoidable blocker is reported first.
- These files already contain unrelated user changes. Preserve every unrelated change and do not restore or rewrite either file wholesale.
- Follow TDD: add the focused test, run it and record the RED result, then implement and record GREEN.
- Update obsolete existing layout assertions so they validate the new approved arrangement rather than the old three-column workspace.
- Keep cutout mode usable: when its details panel is hidden, its media panel must fill the upper-left region.
- Keep internal scrolling and prevent panel overlap.
- Do not commit because this is a shared dirty worktree.

## Required Verification

1. `node --test tests/playhead-ui.test.mts`
2. `node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts`
3. `npx.cmd tsc --noEmit`
4. `git diff --check -- src/index.css tests/playhead-ui.test.mts`

## Report

Write the RED/GREEN results, changed-file summary, self-review, and concerns to `.superpowers/sdd/right-preview-layout-task-1-report.md`. Return only status (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`), changed files, one-line test summary, and concerns.
