import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const configSource = await readFile(
  new URL("../vite.config.ts", import.meta.url),
  "utf8",
);

test("Vite watches public media added after the dev server starts", () => {
  assert.doesNotMatch(configSource, /\*\*\/public\/\*\*/);
});
