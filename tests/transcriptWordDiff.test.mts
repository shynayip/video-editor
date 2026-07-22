import assert from "node:assert/strict";
import test from "node:test";
import { getRemovedTranscriptWordIndexes } from "../src/editorLogic.ts";

test("finds words removed from an editable transcript sentence", () => {
  assert.deepEqual(
    getRemovedTranscriptWordIndexes(
      "Function so that we can handle the form submission",
      "Function so we can handle form submission",
    ),
    [2, 6],
  );
});

test("ignores whitespace, capitalization, and punctuation-only edits", () => {
  assert.deepEqual(
    getRemovedTranscriptWordIndexes(
      "Okay, this is the sentence.",
      "  okay this is the sentence  ",
    ),
    [],
  );
});

test("supports deleting the whole sentence with Ctrl+A and Backspace", () => {
  assert.deepEqual(
    getRemovedTranscriptWordIndexes("Delete this complete sentence", ""),
    [0, 1, 2, 3],
  );
});
