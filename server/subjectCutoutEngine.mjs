import {composeRgbaWithAlpha, selectPrimaryAlpha} from "./subjectMask.mjs";

const models = {
  portrait: {
    task: "background-removal",
    id: "Xenova/modnet",
    options: {dtype: "q4"},
  },
  general: {
    task: "background-removal",
    id: "onnx-community/BiRefNet_lite-ONNX",
    options: {dtype: "fp16"},
  },
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

const addRouteToSubject = (subject, route) => subject && {...subject, route};

export const createSubjectCutoutEngine = ({
  pipelineFactory = defaultPipelineFactory,
  loadImageImpl = defaultLoadImage,
  RawImageCtor,
} = {}) => {
  const pipelineCache = new Map();
  const dtypeFallbackRoutes = new Set();

  const canRetryWithoutDtype = (route, error, signal) => route === "general"
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
      usesFp16: route === "general" && !dtypeFallbackRoutes.has(route),
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
    if (matte.width !== originalImage.width || matte.height !== originalImage.height) {
      throw new RangeError("Model output dimensions must match the source image.");
    }
    const selection = selectPrimaryAlpha({
      alpha: extractAlpha(matte),
      width: originalImage.width,
      height: originalImage.height,
      previousSubject,
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
        const result = await processRoute({
          inputPath,
          route: "general",
          originalImage,
          previousSubject,
          signal,
        });
        return result;
      }

      const initialRoute = mode === "video-first"
        ? "portrait"
        : previousSubject?.route ?? "general";
      const result = await processRoute({
        inputPath,
        route: initialRoute,
        originalImage,
        previousSubject,
        signal,
      });
      if (initialRoute !== "portrait" || result.confidence) {
        const {confidence: _confidence, ...output} = result;
        return output;
      }

      const fallback = await processRoute({
        inputPath,
        route: "general",
        originalImage,
        previousSubject,
        signal,
      });
      const {confidence: _confidence, ...output} = fallback;
      return output;
    },
  };
};
