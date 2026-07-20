const finite = (value) => Number.isFinite(value);
const roundSeconds = (value) => Math.round(value * 1e6) / 1e6;

export const createSpeechRanges = (
  segments,
  {
    durationSeconds,
    speechPaddingSeconds = 0.12,
    mergeGapSeconds = 0.3,
  },
) => {
  if (!finite(durationSeconds) || durationSeconds <= 0) return [];

  const padded = (Array.isArray(segments) ? segments : [])
    .flatMap((segment) => {
      const startSeconds = Number(segment?.startSeconds);
      const endSeconds = Number(segment?.endSeconds);
      if (
        !finite(startSeconds) ||
        !finite(endSeconds) ||
        endSeconds <= startSeconds
      ) {
        return [];
      }

      const start = Math.max(0, startSeconds - speechPaddingSeconds);
      const end = Math.min(durationSeconds, endSeconds + speechPaddingSeconds);
      return end > start
        ? [{startSeconds: roundSeconds(start), endSeconds: roundSeconds(end)}]
        : [];
    })
    .sort((left, right) => left.startSeconds - right.startSeconds);

  return padded.reduce((ranges, range) => {
    const previous = ranges.at(-1);
    if (!previous || range.startSeconds - previous.endSeconds > mergeGapSeconds) {
      ranges.push({...range});
      return ranges;
    }

    previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    return ranges;
  }, []);
};
