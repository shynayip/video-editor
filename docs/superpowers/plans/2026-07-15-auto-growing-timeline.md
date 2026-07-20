# Auto-Growing Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 16-second editor timeline with an automatically growing timeline that supports projects longer than one hour.

**Architecture:** Add pure timeline duration, clock-formatting, and ruler-tick utilities to `editorLogic.ts`, then make `Composition.tsx` derive all playback and editing boundaries from those utilities. Keep the toolbar fixed while a dedicated timeline canvas scrolls horizontally at the existing readable frame scale.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, CSS, Node test runner.

## Global Constraints

- Project duration is the greatest `clip.start + clip.duration` across every track.
- Empty projects retain a one-frame minimum.
- Clock labels use `MM:SS` below one hour and `HH:MM:SS` at one hour or longer.
- Long projects scroll horizontally; timeline clips are not compressed to fit.
- The editor imposes no fixed maximum project duration.

---

### Task 1: Timeline Duration And Clock Utilities

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Produces: `getTimelineDuration(clips: TimelineClip[]): number`
- Produces: `formatTimelineClock(frame: number, fps: number): string`
- Produces: `createTimelineTicks(durationInFrames: number, fps: number, targetTickCount?: number): Array<{frame: number; label: string}>`

- [ ] **Step 1: Write failing duration tests**

```ts
test("calculates project duration from the furthest clip on any track", () => {
  const clips: TimelineClip[] = [
    {id: "main", label: "Main", track: "main", start: 0, duration: 480, color: "#0891b2"},
    {id: "overlay", label: "Overlay", track: "upper", start: 108000, duration: 9000, color: "#7c3aed"},
    {id: "text", label: "Text", track: "caption", start: 120000, duration: 300, color: "#f97316"},
  ];

  assert.equal(getTimelineDuration(clips), 120300);
  assert.equal(getTimelineDuration([]), 1);
});
```

- [ ] **Step 2: Run the duration test and verify RED**

Run: `node --test --test-name-pattern="calculates project duration" tests/editorLogic.test.mts`

Expected: FAIL because `getTimelineDuration` is not exported.

- [ ] **Step 3: Implement duration calculation**

```ts
export const getTimelineDuration = (clips: TimelineClip[]): number =>
  Math.max(
    1,
    clips.reduce(
      (furthestEnd, clip) =>
        Math.max(furthestEnd, Math.max(0, clip.start) + Math.max(1, clip.duration)),
      0,
    ),
  );
```

- [ ] **Step 4: Write failing clock and tick tests**

```ts
test("formats timeline clocks beyond one hour", () => {
  assert.equal(formatTimelineClock(16 * 30, 30), "00:16");
  assert.equal(formatTimelineClock((60 * 60 + 5) * 30, 30), "01:00:05");
});

test("creates ruler ticks through the dynamic project end", () => {
  const ticks = createTimelineTicks(2 * 60 * 60 * 30, 30);
  assert.equal(ticks[0].label, "00:00");
  assert.equal(ticks.at(-1)?.label, "02:00:00");
  assert.ok(ticks.length >= 5 && ticks.length <= 12);
});
```

- [ ] **Step 5: Run the clock tests and verify RED**

Run: `node --test --test-name-pattern="timeline clocks|ruler ticks" tests/editorLogic.test.mts`

Expected: FAIL because the formatting and tick functions are not exported.

- [ ] **Step 6: Implement clock formatting and readable tick generation**

```ts
export const formatTimelineClock = (frame: number, fps: number): string => {
  const totalSeconds = Math.max(0, Math.floor(frame / Math.max(1, fps)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteAndSecond = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${minuteAndSecond}`
    : minuteAndSecond;
};

export const createTimelineTicks = (
  durationInFrames: number,
  fps: number,
  targetTickCount = 8,
) => {
  const safeFps = Math.max(1, fps);
  const durationSeconds = Math.max(1, Math.ceil(durationInFrames / safeFps));
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  const desiredInterval = durationSeconds / Math.max(2, targetTickCount);
  const intervalSeconds = intervals.find((interval) => interval >= desiredInterval)
    ?? Math.ceil(desiredInterval / 3600) * 3600;
  const frames = [0];
  for (let seconds = intervalSeconds; seconds < durationSeconds; seconds += intervalSeconds) {
    frames.push(seconds * safeFps);
  }
  frames.push(durationInFrames);
  return frames.map((tickFrame) => ({
    frame: tickFrame,
    label: formatTimelineClock(tickFrame, safeFps),
  }));
};
```

- [ ] **Step 7: Run focused utility tests**

Run: `node --test --test-name-pattern="project duration|timeline clocks|ruler ticks" tests/editorLogic.test.mts`

Expected: PASS.

- [ ] **Step 8: Commit utilities**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add dynamic timeline duration utilities"
```

### Task 2: Dynamic Editor Duration And Ruler

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `getTimelineDuration`, `formatTimelineClock`, and `createTimelineTicks` from Task 1.
- Produces: `projectDuration`, `timelineTicks`, and a dynamic timeline summary/ruler.

- [ ] **Step 1: Write a failing UI source regression test**

```ts
test("drives the editor timeline from all clips without a fixed 16 second ruler", () => {
  const source = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
  assert.match(source, /const projectDuration = useMemo\(\(\) => getTimelineDuration\(clips\)/);
  assert.match(source, /createTimelineTicks\(projectDuration, fps\)/);
  assert.match(source, /formatTimelineClock\(projectDuration, fps\)/);
  assert.doesNotMatch(source, /<span>00:16<\/span>/);
});
```

- [ ] **Step 2: Run the UI regression test and verify RED**

Run: `node --test --test-name-pattern="without a fixed 16 second ruler" tests/playhead-ui.test.mts`

Expected: FAIL because the component still derives duration from main clips and renders fixed ruler labels.

- [ ] **Step 3: Replace main-only project boundaries**

Import the three Task 1 utilities and replace the `mainTrackDuration` memo with:

```ts
const projectDuration = useMemo(() => getTimelineDuration(clips), [clips]);
const timelineTicks = useMemo(
  () => createTimelineTicks(projectDuration, fps),
  [projectDuration],
);
```

Use `projectDuration` for playhead clamping, `aria-valuemax`, playback stopping, text movement bounds, and scrub bounds. Keep main-clip sequencing calculations main-only where clips are appended back-to-back.

- [ ] **Step 4: Render the dynamic summary and ruler**

```tsx
<strong>
  {projectDuration} frames / {formatTimelineClock(projectDuration, fps)}
</strong>

<div className="timeline-ruler" onPointerDown={startTimelineScrub}>
  {timelineTicks.map((tick) => (
    <span
      key={tick.frame}
      style={{left: `${148 + tick.frame * timelineScale}px`}}
    >
      {tick.label}
    </span>
  ))}
</div>
```

- [ ] **Step 5: Run the focused UI test**

Run: `node --test --test-name-pattern="without a fixed 16 second ruler" tests/playhead-ui.test.mts`

Expected: PASS.

- [ ] **Step 6: Commit dynamic boundaries and ruler**

```powershell
git add src/Composition.tsx tests/playhead-ui.test.mts
git commit -m "feat: make editor duration follow all timeline clips"
```

### Task 3: Scrollable Long Timeline Canvas

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Modify: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `projectDuration` from Task 2.
- Produces: `timelineContentRef: RefObject<HTMLDivElement>` and a horizontally scrollable `.timeline-scroll` / `.timeline-content` layout.

- [ ] **Step 1: Write failing scroll layout tests**

```ts
test("keeps long timelines readable in a horizontal scrolling canvas", () => {
  const component = readFileSync(new URL("../src/Composition.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(component, /className="timeline-scroll"/);
  assert.match(component, /className="timeline-content"/);
  assert.match(component, /minWidth:\s*`\$\{148 \+ projectDuration \* timelineScale/);
  assert.match(css, /\.timeline-scroll\s*\{[^}]*overflow-x:\s*auto/s);
});
```

- [ ] **Step 2: Run the scroll test and verify RED**

Run: `node --test --test-name-pattern="horizontal scrolling canvas" tests/playhead-ui.test.mts`

Expected: FAIL because the timeline panel currently hides horizontal overflow.

- [ ] **Step 3: Add the timeline canvas wrapper and coordinate ref**

Add `timelineContentRef`, wrap playhead/ruler/track rows as follows, and use the content ref bounds in scrub, drop, trim, and text-drag coordinate calculations:

```tsx
<div className="timeline-scroll">
  <div
    className="timeline-content"
    ref={timelineContentRef}
    style={{minWidth: `${148 + projectDuration * timelineScale + 24}px`}}
  >
    {/* playhead, ruler, and track rows */}
  </div>
</div>
```

- [ ] **Step 4: Add scrolling and sticky-label CSS**

```css
.timeline-panel {
  overflow: hidden;
}

.timeline-scroll {
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-color: #384858 #0d1117;
}

.timeline-content {
  position: relative;
  width: 100%;
}

.track-label {
  position: sticky;
  left: 0;
  z-index: 5;
  background: #0d1117;
}

.timeline-ruler span {
  position: absolute;
  translate: -50% 0;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run focused tests, lint, and build**

Run:

```powershell
node --test --test-name-pattern="project duration|timeline clocks|ruler ticks" tests/editorLogic.test.mts
node --test --test-name-pattern="fixed 16 second ruler|horizontal scrolling canvas" tests/playhead-ui.test.mts
npm.cmd run lint
npm.cmd run build
```

Expected: all focused tests PASS; lint exits 0; Remotion bundle completes.

- [ ] **Step 6: Verify the running editor**

Open `http://localhost:5173/`, add or move a clip beyond 16 seconds, and confirm:

- The summary increases beyond 16 seconds.
- The last ruler label matches the project end.
- The timeline scrolls horizontally.
- The red playhead scrubs accurately after scrolling.
- A duration of at least `108001` frames displays an hour-formatted clock.

- [ ] **Step 7: Commit long-timeline UI**

```powershell
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: add scrollable long timeline canvas"
```

