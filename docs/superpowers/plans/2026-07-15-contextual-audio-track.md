# Contextual Audio Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Audio timeline row only after the user selects the Main track, while keeping it visible during audio editing.

**Architecture:** Add one pure selection-to-visibility rule in `editorLogic.ts` and store the resulting visibility in `Composition.tsx`. Timeline row construction will require both an audio clip and an active contextual visibility flag; hiding the row will not modify timeline clip data.

**Tech Stack:** React, TypeScript, Remotion, Node test runner

## Global Constraints

- The Audio track is hidden when the editor first opens.
- Main or Audio selection shows or retains the Audio track.
- Overlay, Sticker, Text, or Caption selection hides the Audio track.
- Visibility changes never edit audio clip data.
- Main video and audio clips remain independently editable.

---

### Task 1: Contextual Audio Track Visibility

**Files:**
- Modify: `src/editorLogic.ts`
- Modify: `src/Composition.tsx`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TrackName`
- Produces: `shouldShowAudioTrackForSelection(track: TrackName): boolean`

- [ ] **Step 1: Write the failing selection-rule test**

Add the import and test to `tests/editorLogic.test.mts`:

```ts
import {
  shouldShowAudioTrackForSelection,
} from "../src/editorLogic.ts";

test("shows contextual audio only for main and audio selections", () => {
  assert.equal(shouldShowAudioTrackForSelection("main"), true);
  assert.equal(shouldShowAudioTrackForSelection("audio"), true);
  assert.equal(shouldShowAudioTrackForSelection("upper"), false);
  assert.equal(shouldShowAudioTrackForSelection("sticker"), false);
  assert.equal(shouldShowAudioTrackForSelection("caption"), false);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```powershell
node --test tests\editorLogic.test.mts
```

Expected: FAIL because `shouldShowAudioTrackForSelection` is not exported.

- [ ] **Step 3: Implement the pure visibility rule**

Add to `src/editorLogic.ts`:

```ts
export const shouldShowAudioTrackForSelection = (track: TrackName) =>
  track === "main" || track === "audio";
```

- [ ] **Step 4: Connect visibility state to track and clip selection**

In `src/Composition.tsx`, import `shouldShowAudioTrackForSelection`, add state initialized to `false`, and centralize selection visibility updates:

```ts
const [isAudioTrackVisible, setIsAudioTrackVisible] = useState(false);

const updateAudioTrackVisibility = (track: TrackName) => {
  setIsAudioTrackVisible(shouldShowAudioTrackForSelection(track));
};

const selectTimelineClip = (clip: TimelineClip) => {
  setSelectedClipId(clip.id);
  setSelectedTrack(clip.track);
  updateAudioTrackVisibility(clip.track);
};

const selectTrackClipAtFrame = (track: TrackName, frame: number) => {
  const clip = getActiveClipAtFrame(clips, track, frame) ??
    clips.find((candidate) => candidate.track === track);

  setSelectedTrack(track);
  setSelectedClipId(clip?.id ?? null);
  updateAudioTrackVisibility(track);
};
```

Change Audio timeline row construction to:

```ts
...(isAudioTrackVisible && clips.some((clip) => clip.track === "audio")
  ? [{key: "audio", id: "audio" as TrackName, label: "Audio track"}]
  : []),
```

Add `isAudioTrackVisible` to the `timelineRows` memo dependency list. Update `openAudioControls` to reveal and select the active Audio clip:

```ts
const openAudioControls = () => {
  setActiveTool("audio");
  selectTrackClipAtFrame("audio", playheadFrame);
};
```

- [ ] **Step 5: Run all focused tests and project checks**

Run:

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
npm.cmd run lint
```

Expected: all tests pass; ESLint and TypeScript exit successfully.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- src\editorLogic.ts src\Composition.tsx tests\editorLogic.test.mts
git commit -m "feat: show audio track contextually"
```
