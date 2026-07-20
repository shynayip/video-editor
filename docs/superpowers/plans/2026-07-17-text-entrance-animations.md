# Text Entrance Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-text-clip None, Pop In, Jump In, and Fade In entrance animations that play once when a text clip begins.

**Architecture:** Store a `TextEntranceAnimation` preset on each `TextOverlay` and update it through the existing immutable text-style/history path. A pure frame-based helper in `editorLogic.ts` returns opacity, scale, and vertical translation; `Composition.tsx` applies that presentation to active text in the preview and exposes a compact segmented control in the selected text details panel.

**Tech Stack:** React 19, TypeScript, Remotion frame-based rendering, Node test runner, CSS.

## Global Constraints

- Entrance animations play once and do not repeat.
- Presets are exactly `none`, `pop`, `jump`, and `fade`.
- Entrance duration is 15 frames, which is 0.5 seconds at the project's 30 fps.
- Existing text clips without an animation property behave as `none`.
- Animation changes use the existing timeline undo/redo history.
- Do not use CSS animations, CSS transitions, or add a dependency.
- Do not change caption animation behavior.

---

### Task 1: Text Animation Model And Frame Presentation

**Files:**
- Modify: `src/editorLogic.ts:45-85`
- Modify: `src/editorLogic.ts:1308-1359`
- Test: `tests/editorLogic.test.mts:1-103`
- Test: `tests/editorLogic.test.mts:2575-2602`
- Test: `tests/editorLogic.test.mts:3026-3053`

**Interfaces:**
- Produces: `TextEntranceAnimation = "none" | "pop" | "jump" | "fade"`.
- Produces: `TextAnimationPresentation = {opacity: number; scale: number; translateY: number}`.
- Produces: `getTextAnimationPresentation(clip: TimelineClip, playheadFrame: number, durationInFrames?: number): TextAnimationPresentation`.
- Extends: `TextOverlay.animation` and `TextStyleUpdate`.

- [ ] **Step 1: Write failing model and presentation tests**

Add `getTextAnimationPresentation` to the imports in `tests/editorLogic.test.mts`, update the existing new-text expectation to include `animation: "none"`, and add:

```ts
test("updates animation on only the selected text clip", () => {
  const first = createTextClip({id: "text-1", content: "First", playheadFrame: 30});
  const second = createTextClip({id: "text-2", content: "Second", playheadFrame: 60});

  const updated = setTextStyleById([first, second], "text-1", {animation: "pop"});

  assert.equal(updated[0].text?.animation, "pop");
  assert.strictEqual(updated[1], second);
});

test("returns deterministic one-time text entrance presentations", () => {
  const base = createTextClip({id: "text-1", content: "Title", playheadFrame: 30});
  const withAnimation = (animation: "pop" | "jump" | "fade") => ({
    ...base,
    text: {...base.text!, animation},
  });

  assert.deepEqual(getTextAnimationPresentation(base, 30), {
    opacity: 1,
    scale: 1,
    translateY: 0,
  });
  assert.deepEqual(getTextAnimationPresentation(withAnimation("fade"), 30), {
    opacity: 0,
    scale: 1,
    translateY: 0,
  });
  assert.ok(getTextAnimationPresentation(withAnimation("pop"), 42).scale > 1);
  assert.ok(getTextAnimationPresentation(withAnimation("jump"), 30).translateY > 0);
  assert.deepEqual(getTextAnimationPresentation(withAnimation("jump"), 45), {
    opacity: 1,
    scale: 1,
    translateY: 0,
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="creates a three-second text clip|updates animation on only the selected text clip|returns deterministic one-time text entrance presentations" tests\editorLogic.test.mts
```

Expected: FAIL because `animation` and `getTextAnimationPresentation` do not exist yet.

- [ ] **Step 3: Implement the model and pure helper**

In `src/editorLogic.ts`, add:

```ts
export type TextEntranceAnimation = "none" | "pop" | "jump" | "fade";

export type TextAnimationPresentation = {
  opacity: number;
  scale: number;
  translateY: number;
};
```

Add `animation: TextEntranceAnimation` to `TextOverlay`, include `"animation"` in `TextStyleUpdate`, and initialize new text with `animation: "none"`.

Add the frame helper:

```ts
const neutralTextAnimation: TextAnimationPresentation = {
  opacity: 1,
  scale: 1,
  translateY: 0,
};

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export const getTextAnimationPresentation = (
  clip: TimelineClip,
  playheadFrame: number,
  durationInFrames = 15,
): TextAnimationPresentation => {
  const preset = clip.text?.animation ?? "none";
  if (preset === "none") return neutralTextAnimation;

  const progress = clampUnit((playheadFrame - clip.start) / Math.max(1, durationInFrames));
  if (progress >= 1) return neutralTextAnimation;

  if (preset === "fade") {
    return {...neutralTextAnimation, opacity: progress};
  }

  if (preset === "jump") {
    return {
      ...neutralTextAnimation,
      translateY: (1 - progress) * 34 * Math.cos(progress * Math.PI * 2),
    };
  }

  const overshoot = Math.sin(progress * Math.PI) * 0.16;
  return {
    ...neutralTextAnimation,
    scale: 0.55 + progress * 0.45 + overshoot,
  };
};
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command again.

Expected: all matching tests PASS.

- [ ] **Step 5: Commit the model**

```powershell
git add src/editorLogic.ts tests/editorLogic.test.mts
git commit -m "feat: add text entrance animation model"
```

---

### Task 2: Frame-Based Text Preview Animation

**Files:**
- Modify: `src/Composition.tsx:1-116`
- Modify: `src/Composition.tsx:6322-6382`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `getTextAnimationPresentation(clip, playheadFrame)` from Task 1.
- Produces: frame-derived inline `opacity`, `scale`, and `translate` styles for active preview text.

- [ ] **Step 1: Write the failing preview integration test**

Add to `tests/playhead-ui.test.mts`:

```ts
test("renders text entrance animation from the current timeline frame", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getTextAnimationPresentation\(textClip, playheadFrame\)/);
  assert.match(source, /opacity: textAnimation\.opacity/);
  assert.match(source, /scale: textAnimation\.scale/);
  assert.match(source, /translate: `-50% calc\(-50% \+ \$\{textAnimation\.translateY\}px\)`/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test --test-name-pattern="renders text entrance animation" tests\playhead-ui.test.mts
```

Expected: FAIL because the helper is not called by the preview.

- [ ] **Step 3: Apply the presentation in the preview**

Import `getTextAnimationPresentation`. Inside the `activeTextClips.map` callback, immediately after the text null check, add:

```ts
const textAnimation = getTextAnimationPresentation(textClip, playheadFrame);
```

In the preview text inline style, preserve the existing left, top, rotation, font, and effect styles and add:

```ts
opacity: textAnimation.opacity,
scale: textAnimation.scale,
translate: `-50% calc(-50% + ${textAnimation.translateY}px)`,
```

Update `.preview-text-overlay` only if it currently owns the centering transform; remove duplicate CSS translation so the inline `translate` property is the single centering and entrance-motion source.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command again.

Expected: PASS.

- [ ] **Step 5: Commit preview integration**

```powershell
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: animate text in timeline preview"
```

---

### Task 3: Text Animation Controls And History

**Files:**
- Modify: `src/Composition.tsx:794-820`
- Modify: `src/Composition.tsx:1889-1894`
- Modify: `src/Composition.tsx:6445-6568`
- Modify: `src/index.css:1747-1780`
- Test: `tests/playhead-ui.test.mts`

**Interfaces:**
- Consumes: `TextEntranceAnimation` and `TextStyleUpdate.animation` from Task 1.
- Consumes: existing `updateSelectedTextStyle`, which commits through timeline history.
- Produces: an accessible segmented control labelled `Text animation`.

- [ ] **Step 1: Write the failing control test**

Add to `tests/playhead-ui.test.mts`:

```ts
test("offers per-clip entrance animations in selected text controls", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const textAnimationOptions/);
  assert.match(source, /aria-label="Text animation"/);
  assert.match(source, /updateSelectedTextStyle\(\{animation: option\.id\}\)/);
  assert.match(source, /selectedTextStyle\.animation === option\.id/);
  for (const label of ["None", "Pop", "Jump", "Fade"]) {
    assert.match(source, new RegExp(`label: "${label}"`));
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test --test-name-pattern="offers per-clip entrance animations" tests\playhead-ui.test.mts
```

Expected: FAIL because the options and control are absent.

- [ ] **Step 3: Add the compact animation selector**

Import `TextEntranceAnimation` and define:

```ts
const textAnimationOptions: Array<{
  id: TextEntranceAnimation;
  label: string;
}> = [
  {id: "none", label: "None"},
  {id: "pop", label: "Pop"},
  {id: "jump", label: "Jump"},
  {id: "fade", label: "Fade"},
];
```

Below the existing text effects control, render:

```tsx
<div className="text-animation-control">
  <strong>Animation</strong>
  <div className="text-animation-options" aria-label="Text animation">
    {textAnimationOptions.map((option) => (
      <button
        className={
          selectedTextStyle.animation === option.id
            ? "active-text-animation"
            : ""
        }
        key={option.id}
        type="button"
        onClick={() => updateSelectedTextStyle({animation: option.id})}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>
```

Style `.text-animation-options` as a stable four-column segmented control matching the existing text-effect buttons. Use the existing teal selected state, a maximum 8px radius, and no CSS animation.

- [ ] **Step 4: Run focused logic and UI tests**

Run:

```powershell
node --test --test-name-pattern="text entrance|text clip|selected text|renders text entrance animation|offers per-clip entrance animations" tests\editorLogic.test.mts tests\playhead-ui.test.mts
```

Expected: all matching tests PASS.

- [ ] **Step 5: Run project verification**

Run:

```powershell
node --test tests\editorLogic.test.mts tests\playhead-ui.test.mts
npm.cmd run lint
```

Expected: tests and lint PASS. If unrelated dirty-worktree changes fail project-wide verification, record the exact pre-existing failures and rerun the focused tests to prove this feature remains green.

- [ ] **Step 6: Verify the live editor manually**

Start the frontend if necessary:

```powershell
npm.cmd run web:frontend -- --host 127.0.0.1 --port 5173
```

At `http://localhost:5173/`, add text at the playhead, select it, choose each animation, move the playhead across the first 15 frames of the text clip, and verify the animation plays once. Verify undo and redo change the selected text clip's preset without altering other text clips.

- [ ] **Step 7: Commit the controls**

```powershell
git add src/Composition.tsx src/index.css tests/playhead-ui.test.mts
git commit -m "feat: add text entrance animation controls"
```
