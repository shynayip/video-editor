export type ParsedCaption = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

type ParsedCaptionSource = ParsedCaption & {
  order: number;
};

type ParseOptions = {
  name: string;
  content: string;
  fps: number;
  timelineDuration: number;
};

export const parseCaptionFile = ({
  name,
  content,
  fps,
  timelineDuration,
}: ParseOptions): ParsedCaption[] => {
  validateCompositionTiming(fps, timelineDuration);

  const extension = getCaptionFileExtension(name);
  const normalizedContent = normalizeContent(content);
  const parsed = parseByExtension(extension, normalizedContent, fps);
  const compositionDurationSeconds = timelineDuration / fps;
  const normalized = clampCaptionsToComposition(parsed, compositionDurationSeconds);

  if (normalized.length === 0) {
    throw new Error("No caption cues were found in the file.");
  }

  return normalized.map(({startSeconds, endSeconds, text}) => ({
    startSeconds,
    endSeconds,
    text,
  }));
};

const validateCompositionTiming = (fps: number, timelineDuration: number): void => {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error("FPS must be a finite positive number.");
  }

  if (!Number.isFinite(timelineDuration) || timelineDuration <= 0) {
    throw new Error("Timeline duration must be a finite positive number.");
  }
};

const clampCaptionsToComposition = (
  captions: ParsedCaptionSource[],
  compositionDurationSeconds: number,
): ParsedCaptionSource[] =>
  captions
    .filter(
      (caption) =>
        caption.endSeconds > 0 && caption.startSeconds < compositionDurationSeconds,
    )
    .map((caption) => ({
      ...caption,
      startSeconds: Math.max(0, caption.startSeconds),
      endSeconds: Math.min(compositionDurationSeconds, caption.endSeconds),
    }));

const parseByExtension = (
  extension: string,
  content: string,
  fps: number,
): ParsedCaptionSource[] => {
  switch (extension) {
    case ".srt":
      return parseSrtCaptions(content);
    case ".ass":
      return parseAssCaptions(content);
    case ".lrc":
      return parseLrcCaptions(content, fps);
    default:
      throw new Error(`Unsupported caption file extension: ${extension || "(none)"}`);
  }
};

const getCaptionFileExtension = (name: string): string => {
  const trimmedName = name.trim();
  const dotIndex = trimmedName.lastIndexOf(".");

  if (dotIndex < 0 || dotIndex === trimmedName.length - 1) {
    return "";
  }

  return trimmedName.slice(dotIndex).toLowerCase();
};

const normalizeContent = (content: string): string =>
  content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

const parseSrtCaptions = (content: string): ParsedCaptionSource[] => {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return [];
  }

  const captions: ParsedCaptionSource[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingLineIndex = findSrtTimingLineIndex(lines);

    if (timingLineIndex < 0) {
      throw new Error(`Malformed SRT cue near block ${blockIndex + 1}: missing time range.`);
    }

    const timingLine = lines[timingLineIndex];
    const match = timingLine.match(
      /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/,
    );

    if (!match) {
      throw new Error(`Malformed SRT cue near block ${blockIndex + 1}: invalid time range.`);
    }

    const startSeconds = parseSrtTimestamp(match[1]);
    const endSeconds = parseSrtTimestamp(match[2]);
    const text = normalizeCaptionText(lines.slice(timingLineIndex + 1).join(" "));

    if (!text) {
      throw new Error(`Malformed SRT cue near block ${blockIndex + 1}: missing text.`);
    }

    if (endSeconds <= startSeconds) {
      throw new Error(`Malformed SRT cue near block ${blockIndex + 1}: end time must be after start time.`);
    }

    captions.push({
      startSeconds,
      endSeconds,
      text,
      order: captions.length,
    });
  });

  return captions.sort(compareParsedCaptions);
};

const findSrtTimingLineIndex = (lines: string[]): number => {
  if (lines.length === 0) {
    return -1;
  }

  if (lines[0]?.includes("-->")) {
    return 0;
  }

  if (lines.length >= 2 && /^\d+$/.test(lines[0] ?? "") && lines[1]?.includes("-->")) {
    return 1;
  }

  return -1;
};

const parseSrtTimestamp = (timestamp: string): number => {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);

  if (!match) {
    throw new Error(`Invalid SRT timestamp: ${timestamp}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);

  validateMinuteAndSecondComponents(minutes, seconds, "SRT", timestamp);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

const parseAssCaptions = (content: string): ParsedCaptionSource[] => {
  const lines = content.split("\n");
  let fieldNames = defaultAssFieldNames();
  const captions: ParsedCaptionSource[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("Format:")) {
      const parsedFieldNames = line
        .slice("Format:".length)
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);

      if (parsedFieldNames.length > 0) {
        fieldNames = parsedFieldNames;
      }
      continue;
    }

    if (!line.startsWith("Dialogue:")) {
      continue;
    }

    const startIndex = findAssFieldIndex(fieldNames, "Start");
    const endIndex = findAssFieldIndex(fieldNames, "End");
    const textIndex = findAssFieldIndex(fieldNames, "Text");

    if (startIndex < 0 || endIndex < 0 || textIndex < 0) {
      throw new Error("Malformed ASS dialogue line: missing Start, End, or Text field.");
    }

    const dialogueFields = splitAssDialogueFields(
      line.slice("Dialogue:".length).trimStart(),
      fieldNames.length,
      textIndex,
    );

    const startValue = dialogueFields[startIndex];
    const endValue = dialogueFields[endIndex];
    const textValue = dialogueFields[textIndex];

    if (!startValue || !endValue) {
      throw new Error("Malformed ASS dialogue line: missing start or end time.");
    }

    const startSeconds = parseAssTimestamp(startValue);
    const endSeconds = parseAssTimestamp(endValue);
    const text = normalizeAssText(textValue);

    if (!text) {
      throw new Error("Malformed ASS dialogue line: missing text.");
    }

    if (endSeconds <= startSeconds) {
      throw new Error("Malformed ASS dialogue line: end time must be after start time.");
    }

    captions.push({
      startSeconds,
      endSeconds,
      text,
      order: captions.length,
    });
  }

  return captions.sort(compareParsedCaptions);
};

const defaultAssFieldNames = (): string[] => [
  "Layer",
  "Start",
  "End",
  "Style",
  "Name",
  "MarginL",
  "MarginR",
  "MarginV",
  "Effect",
  "Text",
];

const findAssFieldIndex = (fieldNames: string[], fieldName: string): number =>
  fieldNames.findIndex((name) => name.trim().toLowerCase() === fieldName.toLowerCase());

const splitAssDialogueFields = (
  value: string,
  fieldCount: number,
  textIndex: number,
): string[] => {
  const leadingFields: string[] = [];
  let remainder = value;

  for (let index = 0; index < textIndex; index += 1) {
    const commaIndex = remainder.indexOf(",");
    if (commaIndex < 0) {
      throw new Error("Malformed ASS dialogue line: not enough fields.");
    }

    leadingFields.push(remainder.slice(0, commaIndex));
    remainder = remainder.slice(commaIndex + 1);
  }

  const trailingFields: string[] = [];

  for (let index = fieldCount - 1; index > textIndex; index -= 1) {
    const commaIndex = remainder.lastIndexOf(",");
    if (commaIndex < 0) {
      throw new Error("Malformed ASS dialogue line: not enough fields.");
    }

    trailingFields.unshift(remainder.slice(commaIndex + 1));
    remainder = remainder.slice(0, commaIndex);
  }

  return [...leadingFields, remainder, ...trailingFields];
};

const parseAssTimestamp = (timestamp: string): number => {
  const match = timestamp.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);

  if (!match) {
    throw new Error(`Invalid ASS timestamp: ${timestamp}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = Number((match[4] ?? "0").padEnd(3, "0"));

  validateMinuteAndSecondComponents(minutes, seconds, "ASS", timestamp);

  return hours * 3600 + minutes * 60 + seconds + fraction / 1000;
};

const normalizeAssText = (value: string): string =>
  normalizeCaptionText(
    value
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\[NnHh]/g, " "),
  );

const parseLrcCaptions = (
  content: string,
  fps: number,
): ParsedCaptionSource[] => {
  const capturedCaptions: ParsedCaptionSource[] = [];
  const lines = content.split("\n");
  let sequence = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const timestamps = extractLeadingLrcTimestamps(line);

    if (timestamps.length === 0) {
      if (/^\[[A-Za-z][^:\]]*:[^\]]*\]$/.test(line)) {
        continue;
      }

      throw new Error(`Malformed LRC line: ${line}`);
    }

    const text = normalizeCaptionText(line.slice(timestamps[timestamps.length - 1].endIndex));

    if (!text) {
      throw new Error(`Malformed LRC line: missing text after timestamp.`);
    }

    for (const timestampMatch of timestamps) {
      const startSeconds = parseLrcTimestamp(timestampMatch.timestamp);
      capturedCaptions.push({
        startSeconds,
        endSeconds: startSeconds,
        text,
        order: sequence++,
      });
    }
  }

  if (capturedCaptions.length === 0) {
    return [];
  }

  capturedCaptions.sort(compareParsedCaptions);

  const defaultLastSeconds = getDefaultLrcDurationSeconds(fps);

  for (let index = 0; index < capturedCaptions.length; index += 1) {
    const current = capturedCaptions[index];
    const next = capturedCaptions[index + 1];
    const endSeconds = next ? next.startSeconds : current.startSeconds + defaultLastSeconds;

    if (endSeconds <= current.startSeconds) {
      throw new Error(`Malformed LRC line: timestamp ${current.startSeconds} does not have a later end.`);
    }

    current.endSeconds = endSeconds;
  }

  return capturedCaptions;
};

const extractLeadingLrcTimestamps = (
  line: string,
): Array<{timestamp: string; endIndex: number}> => {
  const timestamps: Array<{timestamp: string; endIndex: number}> = [];
  let cursor = 0;

  while (cursor < line.length) {
    const match = line.slice(cursor).match(/^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?|\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)\]/);

    if (!match) {
      break;
    }

    timestamps.push({
      timestamp: match[1],
      endIndex: cursor + match[0].length,
    });
    cursor += match[0].length;
  }

  return timestamps;
};

const parseLrcTimestamp = (timestamp: string): number => {
  const parts = timestamp.split(".");
  const whole = parts[0] ?? "";
  const fraction = Number((parts[1] ?? "0").padEnd(3, "0"));
  const segments = whole.split(":").map((part) => Number(part));

  if (segments.some((segment) => Number.isNaN(segment))) {
    throw new Error(`Invalid LRC timestamp: ${timestamp}`);
  }

  if (segments.length === 2) {
    const [minutes, seconds] = segments;
    validateMinuteAndSecondComponents(minutes, seconds, "LRC", timestamp);
    return minutes * 60 + seconds + fraction / 1000;
  }

  if (segments.length === 3) {
    const [hours, minutes, seconds] = segments;
    validateMinuteAndSecondComponents(minutes, seconds, "LRC", timestamp);
    return hours * 3600 + minutes * 60 + seconds + fraction / 1000;
  }

  throw new Error(`Invalid LRC timestamp: ${timestamp}`);
};

const validateMinuteAndSecondComponents = (
  minutes: number,
  seconds: number,
  format: string,
  timestamp: string,
): void => {
  if (minutes >= 60 || seconds >= 60) {
    throw new Error(`Invalid ${format} timestamp: ${timestamp}`);
  }
};

const getDefaultLrcDurationSeconds = (fps: number): number => 90 / fps;

const normalizeCaptionText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .trim();

const compareParsedCaptions = (left: ParsedCaptionSource, right: ParsedCaptionSource): number => {
  if (left.startSeconds !== right.startSeconds) {
    return left.startSeconds - right.startSeconds;
  }

  return left.order - right.order;
};
