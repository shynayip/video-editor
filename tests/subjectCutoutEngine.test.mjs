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

test("routes the first video frame through human parsing", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(opaqueCentralSubject());
    },
  });

  const result = await engine.process("person.png", {mode: "video-first"});

  assert.equal(result.route, "human");
  assert.equal(result.subject.route, "human");
  assert.deepEqual(calls, ["Xenova/segformer_b2_clothes"]);
});

test("human parsing removes furniture and preserves a small held-object hole", async () => {
  const face = new Uint8ClampedArray(100);
  const clothing = new Uint8ClampedArray(100);
  const chair = new Uint8ClampedArray(100);
  for (let y = 2; y < 8; y += 1) {
    for (let x = 3; x < 7; x += 1) clothing[y * 10 + x] = 255;
  }
  face[34] = 255;
  clothing[44] = 0;
  chair[28] = 255;
  chair[29] = 255;

  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => async () =>
      modelId === "Xenova/segformer_b2_clothes"
        ? [
            {label: "Face", mask: createImage(face)},
            {label: "Upper-clothes", mask: createImage(clothing)},
            {label: "Background", mask: createImage(chair)},
          ]
        : createImage(emptyMatte()),
  });
  const result = await engine.process("seated-person.png", {
    mode: "video-first",
  });

  assert.equal(result.route, "human");
  assert.equal(result.alpha[44], 255);
  assert.equal(result.alpha[28], 0);
  assert.equal(result.alpha[29], 0);
});

test("human parsing keeps a held object connected through a narrow hand gap", async () => {
  const person = new Uint8ClampedArray(100);
  const background = new Uint8ClampedArray(100);
  for (let y = 1; y < 9; y += 1) {
    for (let x = 2; x < 8; x += 1) person[y * 10 + x] = 255;
  }
  // A narrow opening from the silhouette edge reaches the held object area.
  person[25] = 0;
  person[35] = 0;
  person[45] = 0;
  person[46] = 0;

  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => async () =>
      modelId === "Xenova/segformer_b2_clothes"
        ? [
            {label: "Face", mask: createImage(person)},
            {label: "Background", mask: createImage(background)},
          ]
        : createImage(emptyMatte()),
  });

  const result = await engine.process("person-holding-microphone.png", {
    mode: "video-first",
  });

  assert.equal(result.route, "human");
  assert.equal(result.alpha[45] > 0, true);
  assert.equal(result.alpha[46] > 0, true);
  assert.equal(result.alpha[20], 0);
  assert.equal(result.alpha[29], 0);
});

test("video cutout keeps only the primary subject component", async () => {
  const matte = new Uint8ClampedArray(100);
  for (let y = 3; y < 7; y += 1) {
    for (let x = 3; x < 7; x += 1) matte[y * 10 + x] = 255;
  }
  matte[28] = 255;
  matte[29] = 255;

  const {engine} = createEngineHarness({
    pipelineFactory: async () => async () => createImage(matte),
  });
  const result = await engine.process("person-with-background.png", {
    mode: "video-first",
  });

  assert.equal(result.alpha[44] > 0, true);
  assert.equal(result.alpha[28], 0);
  assert.equal(result.alpha[29], 0);
});

test("semantic person cutout subtracts neighboring furniture", async () => {
  const person = new Uint8ClampedArray(100);
  const chair = new Uint8ClampedArray(100);
  for (let y = 2; y < 8; y += 1) {
    for (let x = 3; x < 7; x += 1) person[y * 10 + x] = 255;
  }
  chair[56] = 255;
  chair[57] = 255;

  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => async () =>
      modelId === "Xenova/segformer_b2_clothes"
        ? []
        : modelId === "Xenova/segformer-b0-finetuned-ade-512-512"
        ? [
            {label: "person", mask: createImage(person)},
            {label: "chair", mask: createImage(chair)},
          ]
        : createImage(person),
  });
  const result = await engine.process("seated-person.png", {
    mode: "video-first",
  });

  assert.equal(result.route, "semantic");
  assert.equal(result.alpha[23] > 0, true);
  assert.equal(result.alpha[56], 0);
  assert.equal(result.alpha[57], 0);
});

test("does not use portrait-only segmentation for product videos", async () => {
  const calls = [];
  const {engine} = createEngineHarness({
    pipelineFactory: async (_task, modelId) => {
      calls.push(modelId);
      return async () => createImage(
        modelId === "onnx-community/BiRefNet_lite-ONNX"
          ? opaqueCentralSubject()
          : emptyMatte(),
      );
    },
  });

  const result = await engine.process("product.png", {mode: "video-first"});

  assert.equal(result.route, "video");
  assert.equal(result.subject.route, "video");
  assert.deepEqual(calls, [
    "Xenova/segformer_b2_clothes",
    "Xenova/segformer-b0-finetuned-ade-512-512",
    "Xenova/modnet",
    "onnx-community/BiRefNet_lite-ONNX",
  ]);
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
  assert.deepEqual(calls, ["onnx-community/BiRefNet-ONNX"]);
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
      if (modelId === "onnx-community/BiRefNet-ONNX") await generalReady;
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

  assert.deepEqual(calls, [
    "onnx-community/BiRefNet-ONNX",
    "Xenova/segformer_b2_clothes",
  ]);
});

test("retains separate loaded pipelines for images and videos", async () => {
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

  assert.deepEqual(calls, [
    "onnx-community/BiRefNet-ONNX",
    "Xenova/segformer_b2_clothes",
  ]);
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
    ["background-removal", "onnx-community/BiRefNet-ONNX", {dtype: "fp16"}],
    ["background-removal", "onnx-community/BiRefNet-ONNX", {}],
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

test("reuses human parsing for subsequent video keyframes", async () => {
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

  assert.equal(first.route, "human");
  assert.equal(next.route, "human");
  assert.equal(next.subject.route, "human");
  assert.deepEqual(calls, ["Xenova/segformer_b2_clothes"]);
});
