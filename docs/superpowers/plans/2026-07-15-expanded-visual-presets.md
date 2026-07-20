# Expanded Visual Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eight Effects, eight Filters, and an independent 0-100 intensity slider for each group on every main or overlay video clip.

**Architecture:** Extend each clip's existing visual state with independent effect and filter intensities. Keep all preset calculations in pure editor-logic helpers, while `Composition.tsx` renders the controls and applies the returned presentation style to preview videos and timeline thumbnails.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, CSS, Node test runner, ESLint

## Global Constraints

- A clip can use one effect and one filter at the same time.
- Effects: None, Blur, Glow, B/W, Invert, Fade, Shadow, Zoom.
- Filters: None, Warm, Cool, Vivid, Vintage, Sepia, Cinema, Soft.
- Effects and Filters each have an independent intensity from 0% to 100%.
- Choosing None resets that group's intensity to 0%.
- Changes apply only to main-track and overlay-track video clips.
- Existing Undo and Redo behavior must remain intact.

---

### Task 1: Expand the Clip Visual Model and Preset Calculations

**Files:**
- Modify: `src/editorLogic.ts`
- Test: `tests/editorLogic.test.mts`

**Interfaces:**
- Consumes: `TimelineClip`, `ClipEffect`, `ClipFilter`, and a numeric intensity.
- Produces: expanded preset unions, `setClipEffectIntensityById`, `setClipFilterIntensityById`, and `getClipVisualPresentation`.

- [ ] **Step 1: Write failing model and calculation tests**

Add imports and tests covering all preset names, group independence, 0-100 clamping, None resetting intensity, default 100% intensity for legacy non-None presets, and presentation output.

```ts
const visualClip: TimelineClip = {
  ...historyClip("visual-main"),
  src: "video.mp4",
};

for (const effect of ["blur", "glow", "grayscale", "invert", "fade", "shadow", "zoom"] as const) {
  const [updated] = setClipEffectById([visualClip], visualClip.id, effect);
  assert.equal(updated.visual?.effect, effect);
  assert.equal(updated.visual?.effectIntensity, 100);
}

for (const filter of ["warm", "cool", "vivid", "vintage", "sepia", "cinema", "soft"] as const) {
  const [updated] = setClipFilterById([visualClip], visualClip.id, filter);
  assert.equal(updated.visual?.filter, filter);
  assert.equal(updated.visual?.filterIntensity, 100);
}

const intensified = setClipEffectIntensityById([visualClip], visualClip.id, 130)[0];
assert.equal(intensified.visual?.effectIntensity, 100);
const softened = setClipFilterIntensityById([visualClip], visualClip.id, -10)[0];
assert.equal(softened.visual?.filterIntensity, 0);

assert.deepEqual(
  getClipVisualPresentation({
    ...visualClip,
    visual: {effect: "fade", filter: "sepia", effectIntensity: 50, filterIntensity: 40},
  }),
  {filter: "sepia(0.4)", opacity: 0.775, scale: 1},
);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test tests\editorLogic.test.mts`

Expected: FAIL because the new unions, intensity setters, and presentation helper do not exist.

- [ ] **Step 3: Expand the visual types and state setters**

Update the types and normalize intensity whenever a preset changes.

```ts
export type ClipEffect =
  | "none" | "blur" | "glow" | "grayscale"
  | "invert" | "fade" | "shadow" | "zoom";
export type ClipFilter =
  | "none" | "warm" | "cool" | "vivid"
  | "vintage" | "sepia" | "cinema" | "soft";

export type ClipVisualStyle = {
  effect: ClipEffect;
  filter: ClipFilter;
  effectIntensity?: number;
  filterIntensity?: number;
};

const clampVisualIntensity = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

const presetIntensity = (preset: string, current?: number) =>
  preset === "none" ? 0 : clampVisualIntensity(current ?? 100);
```

Update `setClipEffectById` and `setClipFilterById` so each changes only its own preset and intensity. Add:

```ts
export const setClipEffectIntensityById = (
  clips: TimelineClip[], clipId: string | null, intensity: number,
) => updateVisualVideoClip(clips, clipId, (visual) => ({
  ...visual,
  effectIntensity: clampVisualIntensity(intensity),
}));

export const setClipFilterIntensityById = (
  clips: TimelineClip[], clipId: string | null, intensity: number,
) => updateVisualVideoClip(clips, clipId, (visual) => ({
  ...visual,
  filterIntensity: clampVisualIntensity(intensity),
}));
```

- [ ] **Step 4: Implement the pure presentation helper**

Add a helper returning CSS-compatible values. Convert intensity to `0..1`, append only the selected effect and filter calculations, and return neutral opacity and scale for presets that do not use them.

```ts
export type ClipVisualPresentation = {
  filter: string;
  opacity: number;
  scale: number;
};

export const getClipVisualPresentation = (
  clip?: TimelineClip,
): ClipVisualPresentation => {
  const visual = clip?.visual;
  const effect = visual?.effect ?? "none";
  const filter = visual?.filter ?? "none";
  const effectAmount = presetIntensity(effect, visual?.effectIntensity) / 100;
  const filterAmount = presetIntensity(filter, visual?.filterIntensity) / 100;
  const parts: string[] = [];

  if (filter === "warm") parts.push(`sepia(${0.28 * filterAmount})`, `saturate(${1 + 0.25 * filterAmount})`, `hue-rotate(${-10 * filterAmount}deg)`);
  if (filter === "cool") parts.push(`saturate(${1 + 0.12 * filterAmount})`, `hue-rotate(${14 * filterAmount}deg)`, `brightness(${1 + 0.05 * filterAmount})`);
  if (filter === "vivid") parts.push(`contrast(${1 + 0.2 * filterAmount})`, `saturate(${1 + 0.45 * filterAmount})`);
  if (filter === "vintage") parts.push(`sepia(${0.45 * filterAmount})`, `contrast(${1 - 0.08 * filterAmount})`, `saturate(${1 - 0.18 * filterAmount})`);
  if (filter === "sepia") parts.push(`sepia(${filterAmount})`);
  if (filter === "cinema") parts.push(`contrast(${1 + 0.18 * filterAmount})`, `saturate(${1 - 0.12 * filterAmount})`, `brightness(${1 - 0.06 * filterAmount})`);
  if (filter === "soft") parts.push(`contrast(${1 - 0.12 * filterAmount})`, `brightness(${1 + 0.08 * filterAmount})`, `blur(${0.8 * filterAmount}px)`);

  if (effect === "blur") parts.push(`blur(${6 * effectAmount}px)`);
  if (effect === "glow") parts.push(`brightness(${1 + 0.1 * effectAmount})`, `drop-shadow(0 0 ${18 * effectAmount}px rgba(56, 214, 200, ${0.55 * effectAmount}))`);
  if (effect === "grayscale") parts.push(`grayscale(${effectAmount})`);
  if (effect === "invert") parts.push(`invert(${effectAmount})`);
  if (effect === "shadow") parts.push(`drop-shadow(0 ${8 * effectAmount}px ${18 * effectAmount}px rgba(0, 0, 0, ${0.65 * effectAmount}))`);

  return {
    filter: parts.length ? parts.join(" ") : "none",
    opacity: effect === "fade" ? 1 - 0.45 * effectAmount : 1,
    scale: effect === "zoom" ? 1 + 0.08 * effectAmount : 1,
  };
};
```

- [ ] **Step 5: Run the logic tests and verify they pass**

Run: `node --test tests\editorLogic.test.mts`

Expected: all editor logic tests PASS.

---

### Task 2: Add Preset Buttons and Independent Intensity Sliders

**Files:**
- Modify: `src/Composition.tsx`
- Modify: `src/index.css`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: Task 1's expanded types, setters, and `getClipVisualPresentation`.
- Produces: eight choices per visual group, two group-specific intensity sliders, and consistent preview/thumbnail styles.

- [ ] **Step 1: Write the failing UI wiring test**

Assert that all preset IDs appear, both intensity setters are called, sliders have accessible labels, and presentation styles are applied to main preview, overlay preview, and timeline thumbnail videos.

```ts
for (const preset of ["invert", "fade", "shadow", "zoom", "vintage", "sepia", "cinema", "soft"]) {
  assert.match(compositionSource, new RegExp(`id: "${preset}"`));
}
assert.match(compositionSource, /setClipEffectIntensityById/);
assert.match(compositionSource, /setClipFilterIntensityById/);
assert.match(compositionSource, /aria-label="Effect intensity"/);
assert.match(compositionSource, /aria-label="Filter intensity"/);
assert.match(compositionSource, /getClipVisualPresentation\(activeTimelineClip\)/);
assert.match(compositionSource, /getClipVisualPresentation\(overlayClip\)/);
assert.match(stylesheetSource, /\.visual-intensity-control/);
```

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run: `node --test tests\playhead-ui.test.mts`

Expected: FAIL because the additional choices and intensity controls are absent.

- [ ] **Step 3: Expand options and connect intensity updates**

Add the four new options to each array. Derive group intensities with a legacy-safe default and add update handlers using `commitClipChange`.

```tsx
const selectedEffectIntensity = selectedClipEffect === "none"
  ? 0
  : clipControlTarget?.visual?.effectIntensity ?? 100;
const selectedFilterIntensity = selectedClipFilter === "none"
  ? 0
  : clipControlTarget?.visual?.filterIntensity ?? 100;

const updateSelectedEffectIntensity = (intensity: number) => {
  commitClipChange((currentClips) =>
    setClipEffectIntensityById(currentClips, clipControlTarget?.id ?? null, intensity),
  );
};

const updateSelectedFilterIntensity = (intensity: number) => {
  commitClipChange((currentClips) =>
    setClipFilterIntensityById(currentClips, clipControlTarget?.id ?? null, intensity),
  );
};
```

- [ ] **Step 4: Render one slider beneath each preset grid**

```tsx
<label className="visual-intensity-control">
  <span>Intensity <em>{selectedEffectIntensity}%</em></span>
  <input
    aria-label="Effect intensity"
    type="range"
    min={0}
    max={100}
    step={1}
    value={selectedEffectIntensity}
    disabled={!canEditSelectedVisual || selectedClipEffect === "none"}
    onChange={(event) => updateSelectedEffectIntensity(Number(event.currentTarget.value))}
  />
</label>
```

Render the matching Filter control with `selectedFilterIntensity`, `Filter intensity`, and `updateSelectedFilterIntensity`.

- [ ] **Step 5: Apply the presentation style everywhere a clip video is shown**

Remove the component-local filter-only helper. Use `getClipVisualPresentation` for main preview, overlay preview, and timeline thumbnail video style props.

```tsx
style={getClipVisualPresentation(activeTimelineClip)}
style={getClipVisualPresentation(overlayClip)}
style={getClipVisualPresentation(clip)}
```

- [ ] **Step 6: Style the intensity controls**

```css
.visual-intensity-control {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #263442;
}

.visual-intensity-control > span {
  display: flex;
  justify-content: space-between;
  color: #dce6ef;
  font-weight: 800;
}

.visual-intensity-control em {
  color: #38d6c8;
  font-style: normal;
}

.visual-intensity-control input {
  width: 100%;
  accent-color: #38d6c8;
}
```

- [ ] **Step 7: Run all verification commands**

Run:

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
npm.cmd run lint
(Invoke-WebRequest -UseBasicParsing http://localhost:5173/ -TimeoutSec 5).StatusCode
```

Expected: all tests PASS, ESLint and TypeScript exit 0, and the local page returns HTTP 200.

- [ ] **Step 8: Preserve the implementation without disturbing unrelated staged changes**

Inspect `git status --short` and `git diff --cached --name-status`. If unrelated changes remain staged in any touched file, leave the implementation uncommitted and report that clearly. Otherwise commit only the four touched source/test files.
