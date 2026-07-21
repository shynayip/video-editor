import assert from "node:assert/strict";
import test from "node:test";

import {
  composeRgbaWithAlpha,
  interpolateAlpha,
  selectPrimaryAlpha,
} from "../server/subjectMask.mjs";

const indexOf = (x, y, width) => y * width + x;

const createAlpha = (width, height, pixels) => {
  const alpha = new Uint8ClampedArray(width * height);
  for (const [x, y, value] of pixels) {
    alpha[indexOf(x, y, width)] = value;
  }
  return alpha;
};

test("selects the large central component and removes edge decoration", () => {
  const width = 8;
  const height = 6;
  const alpha = createAlpha(width, height, [
    [3, 1, 255], [4, 1, 255],
    [2, 2, 255], [3, 2, 255], [4, 2, 255], [5, 2, 255],
    [2, 3, 255], [3, 3, 255], [4, 3, 255], [5, 3, 255],
    [3, 4, 255], [4, 4, 255],
    [0, 0, 255], [7, 5, 180],
  ]);

  const result = selectPrimaryAlpha({alpha, width, height});

  assert.equal(result.alpha[indexOf(3, 2, width)] > 0, true);
  assert.equal(result.alpha[indexOf(0, 0, width)], 0);
  assert.equal(result.alpha[indexOf(7, 5, width)], 0);
  assert.equal(result.subject.centroidX > 0.35 && result.subject.centroidX < 0.65, true);
  assert.equal(result.subject.centroidY > 0.35 && result.subject.centroidY < 0.65, true);
  assert.equal(result.confidence, true);
});

test("uses overlap with the previous subject to keep a similarly sized subject", () => {
  const width = 10;
  const height = 6;
  const alpha = createAlpha(width, height, [
    [1, 2, 255], [2, 2, 255], [1, 3, 255], [2, 3, 255],
    [7, 2, 255], [8, 2, 255], [7, 3, 255], [8, 3, 255],
  ]);
  const previousSubject = {
    centroidX: 0.2,
    centroidY: 0.5,
    area: 4,
    bounds: {left: 1, top: 2, right: 2, bottom: 3},
  };

  const result = selectPrimaryAlpha({alpha, width, height, previousSubject});

  assert.equal(result.alpha[indexOf(1, 2, width)] > 0, true);
  assert.equal(result.alpha[indexOf(7, 2, width)], 0);
  assert.equal(result.subject.bounds.left, 1);
  assert.equal(result.subject.bounds.right, 2);
});

test("keeps a nearby product component with the main person", () => {
  const width = 12;
  const height = 8;
  const alpha = createAlpha(width, height, [
    [4, 2, 255], [5, 2, 255], [6, 2, 255],
    [4, 3, 255], [5, 3, 255], [6, 3, 255],
    [4, 4, 255], [5, 4, 255], [6, 4, 255],
    [4, 5, 255], [5, 5, 255], [6, 5, 255],
    [8, 3, 255], [9, 3, 255], [8, 4, 255], [9, 4, 255],
    [11, 0, 255], [11, 1, 255],
  ]);

  const result = selectPrimaryAlpha({alpha, width, height});

  assert.equal(result.alpha[indexOf(5, 3, width)] > 0, true);
  assert.equal(result.alpha[indexOf(8, 3, width)] > 0, true);
  assert.equal(result.alpha[indexOf(11, 0, width)], 0);
});

test("strict subject selection removes nearby disconnected foreground", () => {
  const width = 12;
  const height = 8;
  const alpha = createAlpha(width, height, [
    [4, 2, 255], [5, 2, 255], [6, 2, 255],
    [4, 3, 255], [5, 3, 255], [6, 3, 255],
    [4, 4, 255], [5, 4, 255], [6, 4, 255],
    [4, 5, 255], [5, 5, 255], [6, 5, 255],
    [8, 3, 255], [9, 3, 255], [8, 4, 255], [9, 4, 255],
  ]);

  const result = selectPrimaryAlpha({
    alpha,
    width,
    height,
    includeCompanions: false,
    selectionThreshold: 32,
  });

  assert.equal(result.alpha[indexOf(5, 3, width)] > 0, true);
  assert.equal(result.alpha[indexOf(8, 3, width)], 0);
});

test("strict subject selection breaks weak alpha bridges to background objects", () => {
  const width = 9;
  const height = 5;
  const alpha = createAlpha(width, height, [
    [1, 1, 255], [2, 1, 255], [3, 1, 255],
    [1, 2, 255], [2, 2, 255], [3, 2, 255],
    [1, 3, 255], [2, 3, 255], [3, 3, 255],
    [4, 2, 18],
    [5, 1, 220], [6, 1, 220], [5, 2, 220], [6, 2, 220],
  ]);

  const result = selectPrimaryAlpha({
    alpha,
    width,
    height,
    includeCompanions: false,
    selectionThreshold: 32,
  });

  assert.equal(result.alpha[indexOf(2, 1, width)] > 0, true);
  assert.equal(result.alpha[indexOf(5, 1, width)], 0);
});

test("retains connected soft edges while zeroing unrelated foreground", () => {
  const width = 7;
  const height = 5;
  const alpha = createAlpha(width, height, [
    [2, 2, 220], [3, 2, 255], [4, 2, 220],
    [2, 1, 12], [3, 1, 18], [4, 1, 8],
    [0, 0, 200],
  ]);

  const result = selectPrimaryAlpha({alpha, width, height});

  assert.equal(result.alpha[indexOf(2, 1, width)] > 0, true);
  assert.equal(result.alpha[indexOf(3, 1, width)] > 0, true);
  assert.equal(result.alpha[indexOf(0, 0, width)], 0);
  assert.equal(result.alpha[indexOf(6, 4, width)], 0);
});

test("attenuates an opaque selected boundary using transparent neighbors", () => {
  const width = 5;
  const height = 5;
  const alpha = createAlpha(width, height, [[2, 2, 255]]);

  const result = selectPrimaryAlpha({alpha, width, height});

  assert.equal(result.alpha[indexOf(2, 2, width)] < 255, true);
});

test("rejects confidence for a subject that is too far from center", () => {
  const width = 10;
  const height = 6;
  const alpha = createAlpha(width, height, [[0, 2, 255]]);

  const result = selectPrimaryAlpha({alpha, width, height});

  assert.equal(result.confidence, false);
});

test("interpolates alpha planes linearly", () => {
  const result = interpolateAlpha(
    new Uint8ClampedArray([0, 100, 200]),
    new Uint8ClampedArray([200, 200, 0]),
    0.25,
  );

  assert.deepEqual([...result], [50, 125, 150]);
});

test("composes original RGB with the replacement alpha plane", () => {
  class FakeRawImage {
    constructor(data, width, height, channels) {
      this.data = data;
      this.width = width;
      this.height = height;
      this.channels = channels;
    }
  }
  const image = {
    data: new Uint8ClampedArray([
      10, 20, 30, 40,
      50, 60, 70, 80,
    ]),
    width: 2,
    height: 1,
    channels: 4,
  };

  const result = composeRgbaWithAlpha(
    image,
    new Uint8ClampedArray([90, 180]),
    FakeRawImage,
  );

  assert.equal(result instanceof FakeRawImage, true);
  assert.deepEqual([...result.data], [10, 20, 30, 90, 50, 60, 70, 180]);
  assert.deepEqual(
    [result.width, result.height, result.channels],
    [2, 1, 4],
  );
});
