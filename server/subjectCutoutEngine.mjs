import {composeRgbaWithAlpha, selectPrimaryAlpha} from "./subjectMask.mjs";

const models = {
  human: {
    task: "image-segmentation",
    id: "Xenova/segformer_b2_clothes",
    options: {dtype: "q8"},
  },
  semantic: {
    task: "image-segmentation",
    id: "Xenova/segformer-b0-finetuned-ade-512-512",
    options: {dtype: "q8"},
  },
  portrait: {
    task: "background-removal",
    id: "Xenova/modnet",
    options: {dtype: "q4"},
  },
  general: {
    task: "background-removal",
    id: "onnx-community/BiRefNet-ONNX",
    options: {dtype: "fp16"},
  },
  video: {
    task: "background-removal",
    id: "onnx-community/BiRefNet_lite-ONNX",
    options: {dtype: "fp16"},
  },
};

const humanBackgroundLabels = new Set(["background"]);
const humanAnatomyLabels = new Set([
  "hair",
  "face",
  "skin",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
]);

const semanticBackgroundLabels = new Set([
  "wall",
  "floor",
  "ceiling",
  "sky",
  "road",
  "earth",
  "grass",
  "building",
]);

const semanticFurnitureLabels = new Set([
  "chair",
  "armchair",
  "seat",
  "sofa",
  "table",
  "desk",
]);

const dilateMask = (mask, width, height, iterations) => {
  let current = mask;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(current);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (!current[index]) continue;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
              next[nextY * width + nextX] = 1;
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
};

const fillSmallEnclosedHoles = (alpha, width, height) => {
  const filled = new Uint8ClampedArray(alpha);
  const visited = new Uint8Array(alpha.length);
  const maximumHoleArea = Math.max(64, Math.round(alpha.length * 0.01));

  for (let seed = 0; seed < alpha.length; seed += 1) {
    if (alpha[seed] > 0 || visited[seed]) continue;
    const pending = [seed];
    const component = [];
    let touchesEdge = false;
    visited[seed] = 1;

    while (pending.length > 0) {
      const index = pending.pop();
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesEdge = true;
      }
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          alpha[neighbor] === 0 &&
          !visited[neighbor]
        ) {
          visited[neighbor] = 1;
          pending.push(neighbor);
        }
      }
    }

    if (!touchesEdge && component.length <= maximumHoleArea) {
      for (const index of component) filled[index] = 255;
    }
  }

  return filled;
};

const defaultPipelineFactory = async (task, id, options) => {
  const {pipeline} = await import("@huggingface/transformers");
  return pipeline(task, id, options);
};

const defaultLoadImage = async (inputPath) => {
  const {RawImage} = await import("@huggingface/transformers");
  return RawImage.read(inputPath);
};

const getDefaultRawImageCtor = async () => {
  const {RawImage} = await import("@huggingface/transformers");
  return RawImage;
};

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
};

const isCancellationError = (error) =>
  error?.name === "AbortError" || error?.code === "ABORT_ERR";

const isUnsupportedFp16Provider = (error) => {
  const message = String(error?.message ?? error);
  return /(?:unsupported|not supported|unavailable).*fp16|fp16.*(?:unsupported|not supported|unavailable)/i
    .test(message);
};

const extractAlpha = (image) => {
  const pixelCount = image.width * image.height;
  const channels = image.channels ?? image.data.length / pixelCount;
  if (!Number.isInteger(channels) || channels < 1) {
    throw new TypeError("Model output must have at least one channel.");
  }
  if (image.data.length < pixelCount * channels) {
    throw new RangeError("Model output data is shorter than its dimensions.");
  }

  const alpha = new Uint8ClampedArray(pixelCount);
  const alphaOffset = channels >= 4 ? 3 : channels - 1;
  for (let index = 0; index < pixelCount; index += 1) {
    alpha[index] = image.data[index * channels + alphaOffset];
  }
  return alpha;
};

const hasForegroundAlpha = (image) => {
  const alpha = extractAlpha(image);
  for (const value of alpha) {
    if (value > 0) return true;
  }
  return false;
};

const extractSemanticAlpha = (output, width, height) => {
  if (!Array.isArray(output)) {
    return extractAlpha(output);
  }

  const candidates = output.flatMap((segment) => {
    const label = String(segment?.label ?? "").toLowerCase();
    const mask = segment?.mask;
    if (
      !mask ||
      mask.width !== width ||
      mask.height !== height ||
      semanticBackgroundLabels.has(label)
    ) {
      return [];
    }

    const alpha = extractAlpha(mask);
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    for (let index = 0; index < alpha.length; index += 1) {
      if (alpha[index] === 0) continue;
      area += 1;
      sumX += index % width;
      sumY += Math.floor(index / width);
    }
    if (area === 0) return [];

    const centroidX = (sumX / area + 0.5) / width;
    const centroidY = (sumY / area + 0.5) / height;
    const centerScore = Math.max(
      0,
      1 - Math.hypot(centroidX - 0.5, centroidY - 0.5) / Math.SQRT1_2,
    );
    const areaRatio = area / (width * height);
    return [{
      alpha,
      label,
      score: (label === "person" ? 10 : 0) + areaRatio * 0.7 + centerScore * 0.3,
    }];
  });

  if (candidates.length === 0) {
    return new Uint8ClampedArray(width * height);
  }

  const selected = candidates.reduce((best, candidate) =>
    candidate.score > best.score ? candidate : best
  );
  if (selected.label !== "person") {
    return selected.alpha;
  }

  const furnitureMask = new Uint8Array(width * height);
  for (const segment of output) {
    const label = String(segment?.label ?? "").toLowerCase();
    const mask = segment?.mask;
    if (
      !semanticFurnitureLabels.has(label) ||
      !mask ||
      mask.width !== width ||
      mask.height !== height
    ) {
      continue;
    }
    const alpha = extractAlpha(mask);
    for (let index = 0; index < alpha.length; index += 1) {
      if (alpha[index] > 0) furnitureMask[index] = 1;
    }
  }

  const furnitureExpansion = Math.max(
    1,
    Math.min(5, Math.round(Math.min(width, height) * 0.006)),
  );
  const expandedFurniture = dilateMask(
    furnitureMask,
    width,
    height,
    furnitureExpansion,
  );
  const alpha = new Uint8ClampedArray(selected.alpha);
  for (let index = 0; index < alpha.length; index += 1) {
    if (expandedFurniture[index]) alpha[index] = 0;
  }
  return alpha;
};

const extractHumanAlpha = (output, width, height) => {
  if (!Array.isArray(output)) {
    return extractAlpha(output);
  }

  const alpha = new Uint8ClampedArray(width * height);
  let hasAnatomy = false;
  for (const segment of output) {
    const label = String(segment?.label ?? "").toLowerCase();
    const mask = segment?.mask;
    if (
      humanBackgroundLabels.has(label) ||
      !mask ||
      mask.width !== width ||
      mask.height !== height
    ) {
      continue;
    }
    if (humanAnatomyLabels.has(label)) hasAnatomy = true;
    const segmentAlpha = extractAlpha(mask);
    for (let index = 0; index < alpha.length; index += 1) {
      alpha[index] = Math.max(alpha[index], segmentAlpha[index]);
    }
  }

  return hasAnatomy
    ? fillSmallEnclosedHoles(alpha, width, height)
    : new Uint8ClampedArray(width * height);
};

const addRouteToSubject = (subject, route) => subject && {...subject, route};

export const createSubjectCutoutEngine = ({
  pipelineFactory = defaultPipelineFactory,
  loadImageImpl = defaultLoadImage,
  RawImageCtor,
} = {}) => {
  const pipelineCache = new Map();
  const dtypeFallbackRoutes = new Set();

  const canRetryWithoutDtype = (route, error, signal) =>
    (route === "general" || route === "video")
    && !dtypeFallbackRoutes.has(route)
    && !signal?.aborted
    && !isCancellationError(error)
    && isUnsupportedFp16Provider(error);

  const loadPipeline = (route) => {
    const cached = pipelineCache.get(route);
    if (cached) return cached;

    const model = models[route];
    const options = dtypeFallbackRoutes.has(route) ? {} : model.options;
    const entry = {
      usesFp16: (route === "general" || route === "video")
        && !dtypeFallbackRoutes.has(route),
      promise: undefined,
    };
    entry.promise = Promise.resolve().then(() => pipelineFactory(
      model.task,
      model.id,
      options,
    )).catch((error) => {
      if (pipelineCache.get(route) === entry) pipelineCache.delete(route);
      throw error;
    });
    pipelineCache.set(route, entry);
    return entry;
  };

  const enableDtypeFallback = (route, entry) => {
    dtypeFallbackRoutes.add(route);
    if (pipelineCache.get(route) === entry) pipelineCache.delete(route);
  };

  const getPipeline = async (route, signal) => {
    const entry = loadPipeline(route);
    try {
      return {pipeline: await entry.promise, entry};
    } catch (error) {
      if (!entry.usesFp16 || !canRetryWithoutDtype(route, error, signal)) {
        throw error;
      }
      enableDtypeFallback(route, entry);
      const fallbackEntry = loadPipeline(route);
      return {pipeline: await fallbackEntry.promise, entry: fallbackEntry};
    }
  };

  const infer = async (route, inputPath, signal) => {
    const {pipeline, entry} = await getPipeline(route, signal);
    throwIfAborted(signal);
    try {
      const image = await pipeline(inputPath);
      throwIfAborted(signal);
      // ONNX Runtime on some Windows CPU providers can complete fp16
      // inference while silently returning an entirely empty alpha plane.
      // Retry with the compatible model precision before accepting it.
      if (entry.usesFp16 && !Array.isArray(image) && !hasForegroundAlpha(image)) {
        enableDtypeFallback(route, entry);
        const {pipeline: fallbackPipeline} = await getPipeline(route, signal);
        const fallbackImage = await fallbackPipeline(inputPath);
        throwIfAborted(signal);
        return fallbackImage;
      }
      return image;
    } catch (error) {
      if (!entry.usesFp16 || !canRetryWithoutDtype(route, error, signal)) {
        throw error;
      }
      enableDtypeFallback(route, entry);
      const {pipeline: fallbackPipeline} = await getPipeline(route, signal);
      const image = await fallbackPipeline(inputPath);
      throwIfAborted(signal);
      return image;
    }
  };

  const processRoute = async ({inputPath, route, originalImage, previousSubject, signal}) => {
    const matte = await infer(route, inputPath, signal);
    if (
      !Array.isArray(matte) &&
      (matte.width !== originalImage.width || matte.height !== originalImage.height)
    ) {
      throw new RangeError("Model output dimensions must match the source image.");
    }
    const selection = selectPrimaryAlpha({
      alpha: route === "human"
        ? extractHumanAlpha(matte, originalImage.width, originalImage.height)
        : route === "semantic"
          ? extractSemanticAlpha(matte, originalImage.width, originalImage.height)
          : extractAlpha(matte),
      width: originalImage.width,
      height: originalImage.height,
      previousSubject,
      includeCompanions: route === "general",
      selectionThreshold: route === "general" ? 8 : 32,
    });
    const ImageCtor = RawImageCtor ?? await getDefaultRawImageCtor();

    return {
      image: composeRgbaWithAlpha(originalImage, selection.alpha, ImageCtor),
      alpha: selection.alpha,
      subject: addRouteToSubject(selection.subject, route),
      route,
      confidence: selection.confidence,
    };
  };

  return {
    async process(inputPath, {mode, previousSubject, signal} = {}) {
      if (!["image", "video-first", "video-next"].includes(mode)) {
        throw new TypeError(`Unsupported cutout mode: ${mode}`);
      }

      throwIfAborted(signal);
      const originalImage = await loadImageImpl(inputPath);
      throwIfAborted(signal);

      if (mode === "image") {
        const generalResult = await processRoute({
          inputPath,
          route: "general",
          originalImage,
          previousSubject,
          signal,
        });
        if (generalResult.confidence) return generalResult;

        const portraitResult = await processRoute({
          inputPath,
          route: "portrait",
          originalImage,
          previousSubject,
          signal,
        });
        return portraitResult.confidence ? portraitResult : generalResult;
      }

      const initialRoute = previousSubject?.route ?? "human";
      const routes = initialRoute === "human"
        ? ["human", "semantic", "portrait", "video"]
        : initialRoute === "semantic"
          ? ["semantic", "portrait", "video"]
        : initialRoute === "portrait"
          ? ["portrait", "video"]
          : [initialRoute, "portrait"];
      let selectedResult;
      for (const route of routes) {
        const result = await processRoute({
          inputPath,
          route,
          originalImage,
          previousSubject,
          signal,
        });
        selectedResult ??= result;
        if (result.confidence) {
          selectedResult = result;
          break;
        }
      }
      const {confidence: _confidence, ...output} = selectedResult;
      return output;
    },
  };
};
