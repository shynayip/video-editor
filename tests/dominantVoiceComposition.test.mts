import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const compositionSource = await readFile(
  new URL("../src/Composition.tsx", import.meta.url),
  "utf8",
);

test("Composition aborts Keep main voice and clears its status on unmount", () => {
  assert.match(
    compositionSource,
    /useEffect\(\(\) => \{\s*return \(\) => abortKeepMainVoiceRequest\(\);\s*}, \[abortKeepMainVoiceRequest\]\);/,
  );
  assert.match(
    compositionSource,
    /const abortKeepMainVoiceRequest = useCallback\(\(\) => \{[\s\S]*?\.abort\(\);[\s\S]*?setCaptionStatus\(\{kind: "idle", message: ""}\);[\s\S]*?}, \[\]\);/,
  );
});
