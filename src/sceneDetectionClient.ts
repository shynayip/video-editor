export type SceneRange = {
  startSeconds: number;
  endSeconds: number;
};

const isSceneRange = (value: unknown): value is SceneRange => {
  if (!value || typeof value !== "object") return false;

  const range = value as Partial<SceneRange>;
  return (
    Number.isFinite(range.startSeconds) &&
    Number.isFinite(range.endSeconds) &&
    (range.startSeconds ?? -1) >= 0 &&
    (range.endSeconds ?? 0) > (range.startSeconds ?? 0)
  );
};

export const detectVideoScenes = async (
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<SceneRange[]> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchImpl("/api/detect-scenes", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("Scene detection failed.");
  }

  const payload = await response.json() as {scenes?: unknown};
  if (!Array.isArray(payload.scenes) || payload.scenes.length === 0) {
    throw new Error("The scene detector returned invalid scene ranges.");
  }

  const ranges = payload.scenes;
  if (
    ranges.some((range, index) =>
      !isSceneRange(range) ||
      (index > 0 && range.startSeconds !== ranges[index - 1].endSeconds),
    )
  ) {
    throw new Error("The scene detector returned invalid scene ranges.");
  }

  return ranges;
};
