# Task 1: Convert the preview canvas to 9:16

## Context

The editor currently has a horizontal three-column workspace ordered Settings, Import, Preview, with a full-width timeline underneath. Only the preview canvas ratio must change.

## Requirements

- Modify `tests/workspace-layout.test.mjs` first.
- Require `.preview-shell` to use `width: min(100%, calc((100cqh - 38px) * 9 / 16));`.
- Require `.preview-window` to use `aspect-ratio: 9 / 16;`.
- Reject the previous `16 / 9` values in the focused test.
- Run the focused test before implementation and confirm it fails because the old ratio remains.
- Modify only the relevant rules in `src/index.css`.
- Preserve the existing workspace order, timeline position, media fitting, transforms, playback behavior, and rotation control.
- Run `node --test tests/workspace-layout.test.mjs` and `npx.cmd tsc --noEmit` after implementation.
- Commit only `tests/workspace-layout.test.mjs` and `src/index.css` with message `feat: use vertical 9:16 preview canvas`.
- Do not revert or overwrite unrelated changes. You are not alone in the codebase.

## Report

Write a report to `.superpowers/sdd/vertical-9-16-task-1-report.md` containing:

- Status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`.
- Files changed.
- The failing-test command and expected failure observed.
- Passing verification commands and result counts.
- Commit hash.
- Self-review notes and concerns.
