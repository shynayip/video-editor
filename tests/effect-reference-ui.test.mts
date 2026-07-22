import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("effect cards render visual references instead of abbreviation placeholders", () => {
  const source = readFileSync(
    new URL("../src/Composition.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /const EffectReferencePreview/);
  assert.match(source, /className="effect-preview-subject"/);
  assert.doesNotMatch(source, /\{option\.preview\}/);
  assert.match(css, /\.effect-card\[data-effect="blur"\]/);
  assert.match(css, /\.effect-card\[data-effect="glitch"\]/);
  assert.match(css, /\.effect-card\[data-effect="glass-flare"\]/);
});
