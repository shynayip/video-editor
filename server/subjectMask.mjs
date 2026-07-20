const foregroundThreshold = 8;
const confidenceMinimumCoverage = 0.015;
const confidenceMaximumCoverage = 0.90;
const confidenceMinimumOwnership = 0.65;
const confidenceMaximumCenterDistance = 0.42;
const companionMinimumCoverage = 0.0005;
const companionMaximumPrimaryRatio = 0.85;
const companionMaximumDistance = 0.55;
const edgeCompanionMinimumPrimaryRatio = 0.4;

const neighborOffsets = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

const clamp = (value, minimum, maximum) => Math.min(
  maximum,
  Math.max(minimum, value),
);

const getIndex = (x, y, width) => y * width + x;

const getCenterScore = (centroidX, centroidY) => {
  const distance = Math.hypot(centroidX - 0.5, centroidY - 0.5);
  return clamp(1 - distance / Math.SQRT1_2, 0, 1);
};

const getContinuityScore = (component, previousSubject) => {
  if (!previousSubject) return 0;

  const previousBounds = previousSubject.bounds;
  if (!previousBounds) return 0;

  const overlapLeft = Math.max(component.bounds.left, previousBounds.left);
  const overlapTop = Math.max(component.bounds.top, previousBounds.top);
  const overlapRight = Math.min(component.bounds.right, previousBounds.right);
  const overlapBottom = Math.min(component.bounds.bottom, previousBounds.bottom);
  const overlapArea = overlapRight >= overlapLeft && overlapBottom >= overlapTop
    ? (overlapRight - overlapLeft + 1) * (overlapBottom - overlapTop + 1)
    : 0;
  const smallerArea = Math.min(
    component.boundsArea,
    Number.isFinite(previousSubject.area) && previousSubject.area > 0
      ? previousSubject.area
      : component.boundsArea,
  );
  const overlapScore = smallerArea > 0 ? overlapArea / smallerArea : 0;

  const previousCentroidX = Number.isFinite(previousSubject.centroidX)
    ? previousSubject.centroidX
    : component.centroidX;
  const previousCentroidY = Number.isFinite(previousSubject.centroidY)
    ? previousSubject.centroidY
    : component.centroidY;
  const centroidDistance = Math.hypot(
    component.centroidX - previousCentroidX,
    component.centroidY - previousCentroidY,
  );
  const centroidScore = clamp(1 - centroidDistance / Math.SQRT1_2, 0, 1);

  return clamp(overlapScore * 0.7 + centroidScore * 0.3, 0, 1);
};

const labelComponents = (alpha, width, height) => {
  const visited = new Uint8Array(alpha.length);
  const components = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = getIndex(x, y, width);
      if (visited[startIndex] || alpha[startIndex] < foregroundThreshold) {
        continue;
      }

      const stack = [startIndex];
      const pixels = [];
      let sumX = 0;
      let sumY = 0;
      let left = x;
      let top = y;
      let right = x;
      let bottom = y;
      visited[startIndex] = 1;

      while (stack.length > 0) {
        const index = stack.pop();
        const pixelX = index % width;
        const pixelY = Math.floor(index / width);
        pixels.push(index);
        sumX += pixelX;
        sumY += pixelY;
        left = Math.min(left, pixelX);
        top = Math.min(top, pixelY);
        right = Math.max(right, pixelX);
        bottom = Math.max(bottom, pixelY);

        for (const [offsetX, offsetY] of neighborOffsets) {
          const nextX = pixelX + offsetX;
          const nextY = pixelY + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            continue;
          }

          const nextIndex = getIndex(nextX, nextY, width);
          if (!visited[nextIndex] && alpha[nextIndex] >= foregroundThreshold) {
            visited[nextIndex] = 1;
            stack.push(nextIndex);
          }
        }
      }

      const area = pixels.length;
      const centroidX = (sumX / area + 0.5) / width;
      const centroidY = (sumY / area + 0.5) / height;
      const bounds = {left, top, right, bottom};
      components.push({
        area,
        bounds,
        boundsArea: (right - left + 1) * (bottom - top + 1),
        centroidX,
        centroidY,
        pixels,
      });
    }
  }

  return components;
};

const includeConnectedSoftEdges = (alpha, width, height, selectedMask) => {
  const stack = [];
  for (let index = 0; index < selectedMask.length; index += 1) {
    if (selectedMask[index]) stack.push(index);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [offsetX, offsetY] of neighborOffsets) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
        continue;
      }

      const nextIndex = getIndex(nextX, nextY, width);
      if (!selectedMask[nextIndex]
        && alpha[nextIndex] > 0
        && alpha[nextIndex] < foregroundThreshold) {
        selectedMask[nextIndex] = 1;
        stack.push(nextIndex);
      }
    }
  }
};

const getBoundaryDistance = (selectedMask, width, height) => {
  const distance = new Int8Array(selectedMask.length);
  distance.fill(-1);
  const queue = [];

  for (let index = 0; index < selectedMask.length; index += 1) {
    if (!selectedMask[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const isBoundary = neighborOffsets.some(([offsetX, offsetY]) => {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      return nextX < 0 || nextX >= width || nextY < 0 || nextY >= height
        || !selectedMask[getIndex(nextX, nextY, width)];
    });
    if (isBoundary) {
      distance[index] = 0;
      queue.push(index);
    }
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const index = queue[queueIndex];
    if (distance[index] >= 2) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [offsetX, offsetY] of neighborOffsets) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
        continue;
      }
      const nextIndex = getIndex(nextX, nextY, width);
      if (selectedMask[nextIndex] && distance[nextIndex] === -1) {
        distance[nextIndex] = distance[index] + 1;
        queue.push(nextIndex);
      }
    }
  }

  return distance;
};

const blurSelectedBoundary = (alpha, width, height, selectedMask) => {
  const blurred = new Uint8ClampedArray(alpha);
  const boundaryDistance = getBoundaryDistance(selectedMask, width, height);

  for (let index = 0; index < selectedMask.length; index += 1) {
    if (!selectedMask[index] || boundaryDistance[index] < 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    let sum = 0;
    let count = 0;
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
          continue;
        }
        const nextIndex = getIndex(nextX, nextY, width);
        sum += alpha[nextIndex];
        count += 1;
      }
    }
    if (count > 0) blurred[index] = Math.round(sum / count);
  }

  return blurred;
};

export const selectPrimaryAlpha = ({alpha, width, height, previousSubject}) => {
  const totalPixels = width * height;
  const sourceAlpha = alpha instanceof Uint8ClampedArray
    ? alpha
    : new Uint8ClampedArray(alpha);
  const nonzeroForeground = sourceAlpha.reduce(
    (count, value) => count + (value > 0 ? 1 : 0),
    0,
  );
  const components = labelComponents(sourceAlpha, width, height);

  if (components.length === 0) {
    return {
      alpha: new Uint8ClampedArray(totalPixels),
      subject: null,
      confidence: false,
    };
  }

  const scoredComponents = components.map((component) => {
    const areaRatio = component.area / totalPixels;
    const centerScore = getCenterScore(component.centroidX, component.centroidY);
    const continuityScore = getContinuityScore(component, previousSubject);
    const score = previousSubject
      ? areaRatio * 0.45 + centerScore * 0.20 + continuityScore * 0.35
      : areaRatio * 0.72 + centerScore * 0.28;
    return {...component, score};
  });
  const selected = scoredComponents.reduce((best, component) => (
    component.score > best.score ? component : best
  ));
  const companionComponents = scoredComponents.filter((component) => {
    if (component === selected) return false;
    const areaRatio = component.area / totalPixels;
    const distanceFromPrimary = Math.hypot(
      component.centroidX - selected.centroidX,
      component.centroidY - selected.centroidY,
    );
    const touchesFrameEdge = component.bounds.left === 0
      || component.bounds.top === 0
      || component.bounds.right === width - 1
      || component.bounds.bottom === height - 1;

    return areaRatio >= companionMinimumCoverage
      && component.area <= selected.area * companionMaximumPrimaryRatio
      && distanceFromPrimary <= companionMaximumDistance
      && (!touchesFrameEdge
        || component.area >= selected.area * edgeCompanionMinimumPrimaryRatio);
  });
  const selectedMask = new Uint8Array(totalPixels);
  for (const index of selected.pixels) selectedMask[index] = 1;
  for (const companion of companionComponents) {
    for (const index of companion.pixels) selectedMask[index] = 1;
  }
  includeConnectedSoftEdges(sourceAlpha, width, height, selectedMask);

  const selectedAlpha = new Uint8ClampedArray(totalPixels);
  for (let index = 0; index < totalPixels; index += 1) {
    if (selectedMask[index]) selectedAlpha[index] = sourceAlpha[index];
  }
  const resultAlpha = blurSelectedBoundary(
    selectedAlpha,
    width,
    height,
    selectedMask,
  );
  const selectedForeground = selectedMask.reduce((count, value) => count + value, 0);
  const foregroundCoverage = nonzeroForeground / totalPixels;
  const selectedOwnership = nonzeroForeground > 0
    ? selectedForeground / nonzeroForeground
    : 0;
  const centerDistance = Math.hypot(
    selected.centroidX - 0.5,
    selected.centroidY - 0.5,
  );

  return {
    alpha: resultAlpha,
    subject: {
      centroidX: selected.centroidX,
      centroidY: selected.centroidY,
      area: selected.area,
      bounds: selected.bounds,
    },
    confidence: foregroundCoverage >= confidenceMinimumCoverage
      && foregroundCoverage <= confidenceMaximumCoverage
      && selectedOwnership >= confidenceMinimumOwnership
      && centerDistance <= confidenceMaximumCenterDistance,
  };
};

export const interpolateAlpha = (left, right, progress) => {
  if (left.length !== right.length) {
    throw new RangeError("Alpha planes must have equal lengths.");
  }
  const clampedProgress = clamp(progress, 0, 1);
  const result = new Uint8ClampedArray(left.length);
  for (let index = 0; index < left.length; index += 1) {
    result[index] = Math.round(
      left[index] + (right[index] - left[index]) * clampedProgress,
    );
  }
  return result;
};

export const composeRgbaWithAlpha = (image, alpha, RawImageCtor) => {
  const width = image.width;
  const height = image.height;
  const sourceChannels = image.channels ?? 4;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceOffset = pixel * sourceChannels;
    const targetOffset = pixel * 4;
    rgba[targetOffset] = image.data[sourceOffset];
    rgba[targetOffset + 1] = image.data[sourceOffset + 1];
    rgba[targetOffset + 2] = image.data[sourceOffset + 2];
    rgba[targetOffset + 3] = alpha[pixel];
  }

  return new RawImageCtor(rgba, width, height, 4);
};
