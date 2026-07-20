import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);
const finite = (value) => Number.isFinite(value);
const roundSeconds = (value) => Math.round(value * 1e6) / 1e6;

export const parseSilenceRanges = (stderr, {
  durationSeconds,
  minimumSilenceSeconds = 0.6,
  speechPaddingSeconds = 0.15,
}) => {
  const events = [...String(stderr).matchAll(/silence_(start|end):\s*([0-9.]+)/g)]
    .map((match) => ({kind: match[1], seconds: Number(match[2])}))
    .filter((event) => finite(event.seconds));
  const raw = [];
  let start = null;

  for (const event of events) {
    if (event.kind === "start") start = event.seconds;
    if (event.kind === "end" && start !== null) {
      raw.push({startSeconds: start, endSeconds: event.seconds});
      start = null;
    }
  }

  if (start !== null) raw.push({startSeconds: start, endSeconds: durationSeconds});

  return raw.flatMap((range) => {
    const startSeconds = Math.max(0, range.startSeconds);
    const endSeconds = Math.min(durationSeconds, range.endSeconds);
    if (roundSeconds(endSeconds - startSeconds) <= minimumSilenceSeconds) return [];

    const paddedStart = startSeconds === 0
      ? 0
      : startSeconds + speechPaddingSeconds;
    const paddedEnd = endSeconds === durationSeconds
      ? durationSeconds
      : endSeconds - speechPaddingSeconds;

    return paddedEnd > paddedStart
      ? [{
        startSeconds: roundSeconds(paddedStart),
        endSeconds: roundSeconds(paddedEnd),
      }]
      : [];
  });
};

export const detectSilenceInMedia = async ({
  inputPath,
  ffmpegPath,
  sourceStartSeconds = 0,
  durationSeconds,
  signal,
  execFileImpl = execFileAsync,
  minimumSilenceSeconds = 0.6,
  speechPaddingSeconds = 0.15,
}) => {
  const ffmpegArgs = [
    "-hide_banner", "-ss", String(sourceStartSeconds), "-t", String(durationSeconds),
    "-i", inputPath, "-vn", "-af", `silencedetect=noise=-40dB:d=${minimumSilenceSeconds}`,
    "-f", "null", "-",
  ];

  const result = await execFileImpl(ffmpegPath, ffmpegArgs, {signal});
  return parseSilenceRanges(result?.stderr, {
    durationSeconds,
    minimumSilenceSeconds,
    speechPaddingSeconds,
  });
};
