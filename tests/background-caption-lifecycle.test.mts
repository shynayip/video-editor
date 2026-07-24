import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("single-clip caption jobs survive ordinary timeline selection changes", () => {
  const action = source.slice(
    source.indexOf("const generateCaptionBatch = useCallback"),
    source.indexOf("const generateAutoCaptions = useCallback"),
  );

  assert.match(
    action,
    /const isActiveAutoCaptionRequest = \(\) =>\s*autoCaptionRequestRef\.current === requestToken;/,
  );
  assert.doesNotMatch(action, /autoCaptionSelectionVersionRef/);
  assert.doesNotMatch(action, /selectedClipIdRef\.current !== sourceClipId/);
  assert.match(
    action,
    /commitSourceClip\.src !== sourceClipSrc[\s\S]*commitSourceClip\.duration !== sourceClipDuration/,
  );
});

test("row transcript jobs preserve unrelated timeline edits", () => {
  const action = source.slice(
    source.indexOf("const generateTranscript = useCallback"),
    source.indexOf("const removeAllTranscriptFillers"),
  );

  assert.match(
    action,
    /const isActiveRowTranscriptRequest = \(\) =>\s*autoCaptionRequestRef\.current === requestToken;/,
  );
  assert.doesNotMatch(action, /autoCaptionSelectionVersionRef/);
  assert.match(
    action,
    /return generatedGroups\.reduce\([\s\S]*JSON\.stringify\(currentClip\) !== snapshot\.serializedClip[\s\S]*replaceGeneratedCaptionBatch/,
  );
});
