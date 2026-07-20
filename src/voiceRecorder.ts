export type RecordedVoice = {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
};

export class BrowserVoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  public static isSupported(): boolean {
    return typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined";
  }

  public async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.startedAt = performance.now();
    this.recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });
    this.recorder.start();
  }

  public async stop(): Promise<RecordedVoice> {
    const recorder = this.recorder;

    if (!recorder || recorder.state === "inactive") {
      throw new Error("No voice recording is active.");
    }

    return new Promise((resolve, reject) => {
      recorder.addEventListener("error", () => {
        this.releaseStream();
        reject(new Error("The voice recording could not be completed."));
      }, {once: true});
      recorder.addEventListener("stop", () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const durationSeconds = Math.max(0, (performance.now() - this.startedAt) / 1000);
        const blob = new Blob(this.chunks, {type: mimeType});
        this.releaseStream();
        resolve({blob, durationSeconds, mimeType});
      }, {once: true});
      recorder.stop();
    });
  }

  public dispose(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    this.releaseStream();
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
  }
}
