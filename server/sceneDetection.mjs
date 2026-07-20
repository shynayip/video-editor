import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);
const sceneDetectionMaxBufferBytes = 64 * 1024 * 1024;

export const buildSceneDetectionArgs = (inputPath, threshold = 0.32) => [
  "-hide_banner", "-i", inputPath,
  "-vf", `select='gt(scene,${threshold})',showinfo`,
  "-an", "-f", "null", "-",
];

export const parseSceneTimestamps = (stderr = "") =>
  [...stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

export const normalizeSceneRanges = ({
  timestamps,
  durationSeconds,
  minimumDurationSeconds = 0.75,
}) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];

  const boundaries = [...new Set([0, ...timestamps, durationSeconds]
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= durationSeconds))]
    .sort((a, b) => a - b);
  const ranges = boundaries.slice(0, -1).map((startSeconds, index) => ({
    startSeconds,
    endSeconds: boundaries[index + 1],
  })).filter((range) => range.endSeconds > range.startSeconds);

  let leadingShortStart = null;
  return ranges.reduce((result, range) => {
    const duration = range.endSeconds - range.startSeconds;
    if (duration < minimumDurationSeconds) {
      if (result.length > 0) {
        result[result.length - 1].endSeconds = range.endSeconds;
      } else if (leadingShortStart === null) {
        leadingShortStart = range.startSeconds;
      }
      return result;
    }

    result.push({
      startSeconds: leadingShortStart ?? range.startSeconds,
      endSeconds: range.endSeconds,
    });
    leadingShortStart = null;
    return result;
  }, []).concat(
    leadingShortStart === null || ranges.length === 0
      ? []
      : [{startSeconds: leadingShortStart, endSeconds: ranges.at(-1).endSeconds}],
  );
};

export const detectScenesInMedia = async ({
  inputPath,
  ffmpegPath,
  ffprobePath,
  signal,
  execFileImpl = execFileAsync,
  threshold = 0.32,
  minimumDurationSeconds = 0.75,
}) => {
  const {stdout: probeOutput} = await execFileImpl(
    ffprobePath,
    [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", inputPath,
    ],
    {signal},
  );
  const sceneDetectionResult = await execFileImpl(
    ffmpegPath,
    buildSceneDetectionArgs(inputPath, threshold),
    {signal, maxBuffer: sceneDetectionMaxBufferBytes},
  );

  return normalizeSceneRanges({
    timestamps: parseSceneTimestamps(sceneDetectionResult?.stderr),
    durationSeconds: Number(String(probeOutput).trim()),
    minimumDurationSeconds,
  });
};
