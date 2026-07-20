import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

export const voiceCleanupFilter = [
  "highpass=f=70",
  "lowpass=f=12000",
  "afftdn=nr=18:nf=-35:tn=1:tr=1",
  "dynaudnorm=f=150:g=7:p=0.95:m=8",
].join(",");

export const cleanVoiceAudio = async ({
  inputPath,
  outputPath,
  ffmpegPath,
  signal,
  execFileImpl = execFileAsync,
}) => {
  await execFileImpl(
    ffmpegPath,
    [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "192k",
      "-af", voiceCleanupFilter,
      "-movflags", "+faststart",
      outputPath,
    ],
    {signal, maxBuffer: 16 * 1024 * 1024},
  );

  return {
    outputPath,
    extension: ".mp4",
    mimeType: "video/mp4",
  };
};
