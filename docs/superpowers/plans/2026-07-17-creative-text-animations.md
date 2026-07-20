# Creative Text Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Star Jump, Bounce, Typewriter, Wave, Flicker, and Spin In presets to each editable text clip, with deterministic word-aware preview and Remotion rendering.

**Architecture:** Extend the existing `TextEntranceAnimation` union and keep frame calculations in pure helpers in `src/editorLogic.ts`. `src/Composition.tsx` will render ordinary text, character prefixes, or stable word spans based on those helpers; decorative stars remain children of the active word and use no timers or randomness. Existing clip history continues to store a single animation identifier, so selection, undo, redo, trimming, and saved-project compatibility remain unchanged.

**Tech Stack:** React 19, TypeScript 5.9, Remotion 4, CSS, Node test runner.

## Global Constraints

- Keep existing choices **None**, **Pop**, **Jump**, and **Fade**.
- Add **Star Jump**, **Bounce**, **Typewriter**, **Wave**, **Flicker**, and **Spin In**.
- Store one animation preset per text clip.
- Derive every animation value from the playhead frame and stable indexes; do not use CSS keyframes, timers, or runtime randomness.
- Do not add custom keyframes, particle uploads, simultaneous presets, separate exit animations, or caption animation changes.
- Preserve text movement, trimming, rotation, resizing, effects, line wrapping, undo, and redo.

---

### Task 1: Deterministic Creative Animation Logic

**Files:**
- Modify: `src/editorLogic.ts:94,1374-1410`
- Test: `tests/editorLogic.test.mts:3200-3240`

**Interfaces:**
- Consumes: `TimelineClip`, `TextEntranceAnimation`, clip `start`, and `playheadFrame`.
- Produces: extended `TextEntranceAnimation`; `TextAnimationPresentation` with `rotation`; `getTextAnimationWordPresentation(clip, playheadFrame, wordIndex, wordCount)`; `getTextAnimationVisibleCharacterCount(clip, playheadFrame)`; `getTextAnimationStars(clip, playheadFrame, wordIndex, wordCount)`.

- [ ] **Step 1: Write failing tests for the six preset identifiers and deterministic helper results**

Add imports for the three new helpers and tests equivalent to:

```ts
test("creative text animations are deterministic and settle correctly", () => {
  const starClip = withAnimation("star-jump");
  assert.deepEqual(
    getTextAnimationStars(starClip, 42, 1, 3),
    getTextAnimationStars(starClip, 42, 1, 3),
  );
  assert.ok(getTextAnimationStars(starClip, 42, 1, 3).length > 0);
  assert.deepEqual(getTextAnimationStars(starClip, 42, 0, 3), []);

  const bounce = getTextAnimationWordPresentation(
    withAnimation("bounce"),
    36,
    0,
    3,
  );
  assert.notEqual(bounce.translateY, 0);

  const wave = getTextAnimationWordPresentation(
    withAnimation("wave"),
    48,
    1,
    3,
  );
  assert.notEqual(wave.translateY, 0);

  const typewriter = withAnimation("typewriter");
  assert.equal(getTextAnimationVisibleCharacterCount(typewriter, 30), 0);
  assert.ok(getTextAnimationVisibleCharacterCount(typewriter, 45) > 0);
  assert.equal(
    getTextAnimationVisibleCharacterCount(typewriter, 120),
    typewriter.text?.content.length,
  );

  assert.ok(getTextAnimationPresentation(withAnimation("flicker"), 34).opacity < 1);
  assert.notEqual(getTextAnimationPresentation(withAnimation("spin-in"), 34).rotation, 0);
  assert.deepEqual(getTextAnimationPresentation(withAnimation("spin-in"), 60), {
    opacity: 1,
    scale: 1,
    translateY: 0,
    rotation: 0,
  });
});
```

- [ ] **Step 2: Run the focused logic test and confirm it fails for missing presets/helpers**

Run: `node --test tests/editorLogic.test.mts`

Expected: FAIL because the creative animation identifiers and helper exports do not exist yet.

- [ ] **Step 3: Extend the animation types and implement pure frame helpers**

Use these public shapes:

```ts
export type TextEntranceAnimation =
  | "none"
  | "pop"
  | "jump"
  | "fade"
  | "star-jump"
  | "bounce"
  | "typewriter"
  | "wave"
  | "flicker"
  | "spin-in";

export type TextAnimationPresentation = {
  opacity: number;
  scale: number;
  translateY: number;
  rotation: number;
};

export type TextAnimationStar = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
};
```

Implement the helpers with stable indexed values:

```ts
const STAR_X = [-18, 4, 20];
const STAR_Y = [-16, -24, -10];

export const getTextAnimationVisibleCharacterCount = (
  clip: TimelineClip,
  playheadFrame: number,
): number => {
  const content = clip.text?.content ?? "";
  if (clip.text?.animation !== "typewriter") return content.length;
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const revealFrames = Math.max(15, Math.min(60, content.length * 2));
  return Math.min(content.length, Math.floor((localFrame / revealFrames) * content.length));
};

export const getTextAnimationWordPresentation = (
  clip: TimelineClip,
  playheadFrame: number,
  wordIndex: number,
  wordCount: number,
): TextAnimationPresentation => {
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const animation = clip.text?.animation ?? "none";
  if (animation === "bounce") {
    const progress = clampUnit((localFrame - wordIndex * 3) / 15);
    return {
      ...neutralTextAnimation,
      translateY: -Math.sin(progress * Math.PI) * 22,
      scale: 1 + Math.sin(progress * Math.PI) * 0.08,
    };
  }
  if (animation === "wave") {
    return {
      ...neutralTextAnimation,
      translateY: Math.sin(localFrame / 5 - wordIndex * 0.8) * 8,
    };
  }
  if (animation === "star-jump") {
    const activeWord = Math.floor(localFrame / 12) % Math.max(1, wordCount);
    return activeWord === wordIndex
      ? {...neutralTextAnimation, translateY: -5, scale: 1.06}
      : neutralTextAnimation;
  }
  return neutralTextAnimation;
};

export const getTextAnimationStars = (
  clip: TimelineClip,
  playheadFrame: number,
  wordIndex: number,
  wordCount: number,
): TextAnimationStar[] => {
  if (clip.text?.animation !== "star-jump") return [];
  const localFrame = Math.max(0, playheadFrame - clip.start);
  const activeWord = Math.floor(localFrame / 12) % Math.max(1, wordCount);
  if (activeWord !== wordIndex) return [];
  const phase = (localFrame % 12) / 12;
  return STAR_X.map((x, index) => ({
    x,
    y: STAR_Y[index] - Math.sin(phase * Math.PI) * 8,
    opacity: Math.sin(phase * Math.PI),
    scale: 0.65 + index * 0.15,
    rotation: phase * 180 + index * 35,
  }));
};
```

Add `rotation: 0` to the neutral presentation. Extend `getTextAnimationPresentation` so `flicker` uses a stable early-frame opacity sequence and `spin-in` reaches neutral rotation/scale after 15 frames; word-aware presets and typewriter return the neutral whole-text presentation.

- [ ] **Step 4: Run the focused logic tests**

Run: `node --test tests/editorLogic.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the logic task**

```bash
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add creative text animation logic"
```

---

### Task 2: Word-Aware Preview and Decorative Stars

**Files:**
- Modify: `src/Composition.tsx:50-110,815-825,6650-6720,7100-7130`
- Modify: `src/index.css` near `.preview-text-overlay` and `.text-animation-options`
- Test: `tests/playhead-ui.test.mts:580-620`

**Interfaces:**
- Consumes: Task 1 helpers and `TextAnimationStar` values.
- Produces: visible Star Jump, Bounce, Typewriter, Wave, Flicker, and Spin In options and preview rendering.

- [ ] **Step 1: Write failing UI-source tests for all options and frame-driven rendering**

Extend the existing text animation test:

```ts
for (const label of [
  "None",
  "Pop",
  "Jump",
  "Fade",
  "Star Jump",
  "Bounce",
  "Typewriter",
  "Wave",
  "Flicker",
  "Spin In",
]) {
  assert.match(source, new RegExp(`label: "${label}"`));
}

assert.match(source, /getTextAnimationVisibleCharacterCount/);
assert.match(source, /getTextAnimationWordPresentation/);
assert.match(source, /getTextAnimationStars/);
assert.match(source, /className="animated-text-word"/);
assert.match(source, /className="text-animation-star"/);
assert.doesNotMatch(source, /Math\.random\(\)/);
```

- [ ] **Step 2: Run the focused UI test and confirm it fails**

Run: `node --test tests/playhead-ui.test.mts`

Expected: FAIL because the new option labels and render helpers are absent.

- [ ] **Step 3: Add the preset options and render text by animation mode**

Import the Task 1 helpers, add the six option records, and apply whole-text rotation as part of the existing `rotate` style:

```tsx
rotate: `${(text.rotation ?? 0) + textAnimation.rotation}deg`,
```

For `typewriter`, render:

```tsx
text.content.slice(
  0,
  getTextAnimationVisibleCharacterCount(textClip, playheadFrame),
)
```

For `star-jump`, `bounce`, and `wave`, split with `text.content.split(/(\s+)/)` so whitespace tokens remain unchanged. Render non-whitespace tokens in `.animated-text-word` spans, use the non-whitespace word index/count for `getTextAnimationWordPresentation`, and render each returned star as an `aria-hidden="true"` `.text-animation-star` child containing `★`. All other presets render `text.content` directly.

- [ ] **Step 4: Add non-interactive word and star styles**

Add CSS equivalent to:

```css
.animated-text-word {
  display: inline-block;
  position: relative;
  transform-origin: 50% 80%;
}

.text-animation-star {
  color: #fde047;
  filter: drop-shadow(0 0 4px rgb(250 204 21 / 70%));
  left: 50%;
  line-height: 1;
  pointer-events: none;
  position: absolute;
  top: 15%;
  z-index: 1;
}
```

Apply each star's deterministic translate, scale, rotate, and opacity inline. Ensure the stars do not alter word width or the selected text clip's interaction box.

- [ ] **Step 5: Run focused logic and UI tests**

Run:

```bash
node --test tests/editorLogic.test.mts tests/playhead-ui.test.mts
```

Expected: PASS.

- [ ] **Step 6: Commit the preview task**

```bash
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: render creative text animations"
```

---

### Task 3: Regression and Browser Verification

**Files:**
- Modify only if verification reveals a scoped issue: `src/Composition.tsx`, `src/editorLogic.ts`, `src/index.css`, `tests/editorLogic.test.mts`, `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: completed creative preset logic and rendering.
- Produces: verified editor behavior without regressions to text manipulation or rendering.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
node --test tests/*.test.mts
node --test tests/*.test.mjs
```

Expected: all tests PASS. If an unrelated existing test fails, record it separately and do not weaken its assertion.

- [ ] **Step 2: Run static verification**

Run:

```bash
npm.cmd run lint
```

Expected: ESLint and TypeScript PASS.

- [ ] **Step 3: Verify the live editor at desktop and narrow widths**

Open `http://localhost:5173/`. Select a text clip and verify every preset button is visible without overlap. Confirm Star Jump travels word-to-word, Typewriter reveals characters, Bounce and Wave retain spaces, Flicker and Spin In settle, and text can still be moved, resized, rotated, trimmed, undone, and redone.

- [ ] **Step 4: Verify deterministic replay**

Seek to the same frame twice for Star Jump, Wave, and Flicker. Confirm the same word, stars, and presentation appear both times. Pause playback and confirm no animation continues independently of the playhead.

- [ ] **Step 5: Review the final diff and commit any verification fixes**

Run:

```bash
git diff --check
git status --short
```

If Task 3 required scoped fixes:

```bash
git add src/Composition.tsx src/editorLogic.ts src/index.css tests/editorLogic.test.mts tests/playhead-ui.test.mts
git commit -m "fix: polish creative text animations"
```

Expected: no whitespace errors; unrelated dirty files remain untouched.
