import assert from "node:assert/strict";
import test from "node:test";

import {createSubjectCutoutEngine} from "../server/subjectCutoutEngine.mjs";

class FakeRawImage {
  constructor(data, width, height, channels) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.channels = channels;
  }
}

const createImage = (alpha) => {
  const data = new Uint8ClampedArray(alpha.length * 4);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    data[offset] = 10;
    data[offset + 1] = 20;
    data[offset + 2] = 30;
    data[offset + 3] = alpha[index];
  }
  return new FakeRawImage(data, 10, 10, 4);
};

const opaqueCentralSubject = () => {
  const alpha = new Uint8ClampedArray(100);
  for (let y = 3; y < 7; y += 1) {
    for (let x = 3; x < 7; x += 1) alpha[y * 10 + x] = 255;
  }
  return alpha;
};

const emptyMatte = () => new Uint8ClampedArray(100);

const createEngineHarness = ({pipelineFactory}) => {
  const loadedInputs = [];
  const engine = createSubjectCutoutEngine({
    pipelineFactory,
    loadImageImpl: async (inputPath) => {
      loadedInputs.push(inputPath);
      return createImage(new Uint8ClampedArray(100).fill(255));
    },
    RawImageCtor: FakeRawImage,
  });
  return {engine, loadedInputs};
};

test("routes the first video frame through the general foreground model", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const result = await engine.process("person.png", {mode: "video-first"});

  assert.equal(result.route, "general");
  assert.equal(result.subject.route, "general");
  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});

test("does not use portrait-only segmentation for product videos", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const result = await engine.process("product.png", {mode: "video-first"});

  assert.equal(result.route, "general");
  assert.equal(result.subject.route, "general");
  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});

test("always routes still images through the general model", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const result = await engine.process("photo.png", {mode: "image"});

  assert.equal(result.route, "general");
  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});

test("shares one initialization promise for each route", async () => {
  const calls = [];
  let releaseGeneral;
  const generalReady = new Promise((resolve) => {
    releaseGeneral = resolve;
  });
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      if (modelId === "onnx-community/BiRefNet_lite-ONNX") await generalReady;
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const firstImage = engine.process("photo-one.png", {mode: "image"});
  const secondImage = engine.process("photo-two.png", {mode: "image"});
  await Promise.resolve();
  releaseGeneral();
  await Promise.all([firstImage, secondImage]);
  await engine.process("person.png", {mode: "video-first"});
  await engine.process("person-two.png", {mode: "video-first"});

  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});

test("retains the loaded general pipeline across images and videos", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  await engine.process("photo-one.png", {mode: "image"});
  await engine.process("person-one.png", {mode: "video-first"});
  await engine.process("person-two.png", {mode: "video-first"});
  await engine.process("photo-two.png", {mode: "image"});

  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});

test("retries unsupported general fp16 initialization once without dtype", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (task, modelId, options) => {
      calls.push([task, modelId, options]);
      if (options.dtype === "fp16") {
        throw new Error("fp16 provider is unsupported");
      }
      return async () => createImage(opaqueCentralSubject());
    },
  });

  await engine.process("photo.png", {mode: "image"});

  assert.deepEqual(calls, [
    ["background-removal", "onnx-community/BiRefNet_lite-ONNX", {dtype: "fp16"}],
    ["background-removal", "onnx-community/BiRefNet_lite-ONNX", {}],
  ]);
});

test("retries unsupported general fp16 inference once without dtype", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, _modelId, options) => {
      calls.push(options);
      if (options.dtype === "fp16") {
        return async () => {
          throw new Error("unsupported fp16 provider");
        };
      }
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const result = await engine.process("photo.png", {mode: "image"});

  assert.equal(result.route, "general");
  assert.deepEqual(calls, [{dtype: "fp16"}, {}]);
});

test("retries a silently empty general fp16 matte without dtype", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, _modelId, options) => {
      calls.push(options);
      return async () => createImage(
        options.dtype === "fp16" ? emptyMatte() : opaqueCentralSubject(),
      );
    },
  });

  const result = await engine.process("photo.png", {mode: "image"});

  assert.equal(result.route, "general");
  assert.ok(result.alpha.some((value) => value > 0));
  assert.deepEqual(calls, [{dtype: "fp16"}, {}]);
});

test("does not retry a cancellation reported by general initialization", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, _modelId, options) => {
      calls.push(options);
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      throw error;
    },
  });

  await assert.rejects(
    engine.process("photo.png", {mode: "image"}),
    (error) => error?.name === "AbortError",
  );

  assert.deepEqual(calls, [{dtype: "fp16"}]);
});

test("reuses the general route for subsequent video frames", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const first = await engine.process("person-first.png", {mode: "video-first"});
  const next = await engine.process("person-next.png", {
    mode: "video-next",
    previousSubject: first.subject,
  });

  assert.equal(first.route, "general");
  assert.equal(next.route, "general");
  assert.equal(next.subject.route, "general");
  assert.deepEqual(calls, ["onnx-community/BiRefNet_lite-ONNX"]);
});
