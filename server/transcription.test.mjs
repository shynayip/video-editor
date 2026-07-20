import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as transcription from "./transcription.mjs";

const { createTranscriptionApp } = transcription;

const createTestServer = async (options) => {
  const app = createTranscriptionApp(options);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
};

const mediaRequest = (name = "sample.wav", type = "audio/wav") => {
  const form = new FormData();
  form.set("media", new Blob(["audio bytes"], { type }), name);
  return {
    method: "POST",
    body: form,
  };
};

const reservePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
};

const waitForServer = async (url) => {
  const deadline = Date.now() + 3_000;

  while (Date.now() < deadline) {
    try {
      return await fetch(`${url}/api/transcribe`, { method: "POST" });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  throw new Error("Transcription server did not start.");
};

test("POST /api/transcribe returns transcription text and word timestamps", async (t) => {
  const server = await createTestServer({
    transcribe: async ({ buffer, filename, mimeType }) => {
      assert.deepEqual(buffer, Buffer.from("audio bytes"));
      assert.equal(filename, "sample.wav");
      assert.equal(mimeType, "audio/wav");
      return {
        text: "Hello world",
        words: [
          { word: "Hello", start: 0, end: 0.4 },
          { word: "world", start: 0.4, end: 0.9 },
        ],
      };
    },
  });
  t.after(() => server.close());

  const response = await fetch(`${server.url}/api/transcribe`, mediaRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: "Hello world",
    words: [
      { word: "Hello", start: 0, end: 0.4 },
      { word: "world", start: 0.4, end: 0.9 },
    ],
  });
});

test("POST /api/transcribe rejects requests without media", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const response = await fetch(`${server.url}/api/transcribe`, { method: "POST" });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "A media file is required." });
});

test("POST /api/transcribe rejects unsupported media MIME types", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const response = await fetch(
    `${server.url}/api/transcribe`,
    mediaRequest("notes.txt", "text/plain"),
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "Unsupported media type." });
});

test("POST /api/transcribe accepts media files of exactly 25,000,000 bytes", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const form = new FormData();
  form.set(
    "media",
    new Blob([Buffer.alloc(25_000_000)], { type: "audio/wav" }),
    "limit.wav",
  );
  const response = await fetch(`${server.url}/api/transcribe`, { method: "POST", body: form });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: "", words: [] });
});

test("POST /api/transcribe rejects media files larger than 25,000,000 bytes", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const form = new FormData();
  form.set(
    "media",
    new Blob([Buffer.alloc(25_000_001)], { type: "audio/wav" }),
    "large.wav",
  );
  const response = await fetch(`${server.url}/api/transcribe`, { method: "POST", body: form });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Media files must be 25,000,000 bytes or smaller." });
});

test("POST /api/transcribe rejects containers unsupported by OpenAI transcription", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const response = await fetch(
    `${server.url}/api/transcribe`,
    mediaRequest("recording.mov", "video/quicktime"),
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { error: "Unsupported media type." });
});

test("POST /api/transcribe rejects unexpected multipart fields", async (t) => {
  const server = await createTestServer({ transcribe: async () => ({ text: "", words: [] }) });
  t.after(() => server.close());

  const form = new FormData();
  form.set("media", new Blob(["audio bytes"], { type: "audio/wav" }), "sample.wav");
  form.set("notes", "unexpected metadata");
  const response = await fetch(`${server.url}/api/transcribe`, { method: "POST", body: form });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid media upload." });
});

test("POST /api/transcribe returns 503 when no transcription provider is configured", async (t) => {
  const server = await createTestServer({});
  t.after(() => server.close());

  const response = await fetch(`${server.url}/api/transcribe`, mediaRequest());

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Transcription is not configured." });
});

test("POST /api/transcribe sanitizes transcription provider failures", async (t) => {
  const server = await createTestServer({
    transcribe: async () => {
      throw new Error("OpenAI request failed: sk-secret-value");
    },
  });
  t.after(() => server.close());

  const response = await fetch(`${server.url}/api/transcribe`, mediaRequest());

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Unable to transcribe media." });
});

test("OpenAI transcriber builds the required client, file, and Whisper request without network access", async () => {
  let clientOptions;
  let fileArguments;
  let transcriptionRequest;
  const transcribe = transcription.createOpenAiTranscriber("test-api-key", {
    createClient: (options) => {
      clientOptions = options;
      return {
        audio: {
          transcriptions: {
            create: async (request) => {
              transcriptionRequest = request;
              return { text: "Hello", words: [{ word: "Hello", start: 0, end: 0.4 }] };
            },
          },
        },
      };
    },
    toFile: async (...arguments_) => {
      fileArguments = arguments_;
      return "prepared-file";
    },
  });

  const result = await transcribe({
    buffer: Buffer.from("audio bytes"),
    filename: "sample.webm",
    mimeType: "audio/webm",
  });

  assert.deepEqual(clientOptions, { apiKey: "test-api-key" });
  assert.deepEqual(fileArguments, [Buffer.from("audio bytes"), "sample.webm", { type: "audio/webm" }]);
  assert.deepEqual(transcriptionRequest, {
    file: "prepared-file",
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });
  assert.deepEqual(result, { text: "Hello", words: [{ word: "Hello", start: 0, end: 0.4 }] });
});

test("the server factory binds only to the IPv4 loopback address", async (t) => {
  const port = await reservePort();
  const server = transcription.startTranscriptionServer({
    port,
    transcribe: async () => ({ text: "", words: [] }),
  });
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  assert.equal(address.address, "127.0.0.1");
  assert.equal(address.family, "IPv4");
});

test("the server falls back to port 8787 for invalid configured ports", () => {
  assert.equal(transcription.resolveTranscriptionPort("0"), 8787);
  assert.equal(transcription.resolveTranscriptionPort("not-a-port"), 8787);
});

test("web:client uses Vite's loopback config without a CLI host override", async (t) => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.doesNotMatch(packageJson.scripts["web:client"], /(?:^|\s)--host(?:=|\s+)/);

  const proxyPort = 9123;
  const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
  const fixtureFile = fileURLToPath(
    new URL("./vite-listener-fixture.mjs", import.meta.url),
  );
  const port = await reservePort();
  const child = spawn(
    process.execPath,
    [fixtureFile, configFile, String(port), String(proxyPort)],
    {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  let closed = false;
  const closeFixture = async () => {
    if (closed || child.exitCode !== null) return;
    closed = true;
    const exited = once(child, "exit");
    child.stdin.end("close\n");
    const timeout = setTimeout(() => child.kill(), 3_000);
    await exited;
    clearTimeout(timeout);
  };
  t.after(closeFixture);

  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Vite fixture did not start. ${stderr}`)),
      5_000,
    );
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const readyLine = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith("VITE_READY "));
      if (!readyLine) return;

      clearTimeout(timeout);
      resolve(JSON.parse(readyLine.slice("VITE_READY ".length)));
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Vite fixture exited with ${code}. ${stderr}`));
      }
    });
  });

  assert.equal(ready.host, "127.0.0.1");
  assert.equal(ready.proxy, `http://127.0.0.1:${proxyPort}`);
  assert.equal(ready.address, "127.0.0.1");
  assert.equal(ready.family, "IPv4");
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  await closeFixture();
});

test("the direct server entrypoint listens without exposing a configured key", async (t) => {
  const port = await reservePort();
  const child = spawn(process.execPath, ["server/transcription.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, OPENAI_API_KEY: "", TRANSCRIPTION_PORT: String(port) },
    stdio: "ignore",
  });
  t.after(() => child.kill());

  const response = await waitForServer(`http://127.0.0.1:${port}`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Transcription is not configured." });
});

test("POST /api/transcribe accepts absent and strict loopback browser origins", async (t) => {
  let providerCalls = 0;
  const server = await createTestServer({
    transcribe: async () => {
      providerCalls += 1;
      return {text: "ok", words: []};
    },
  });
  t.after(() => server.close());

  for (const origin of [undefined, "http://127.0.0.1:5173", "http://localhost:4173"]) {
    const request = mediaRequest();
    const response = await fetch(`${server.url}/api/transcribe`, {
      ...request,
      ...(origin ? {headers: {Origin: origin}} : {}),
    });
    assert.equal(response.status, 200);
  }

  assert.equal(providerCalls, 3);
});

test("POST /api/transcribe rejects forged origins before upload or provider work", async (t) => {
  let providerCalls = 0;
  const server = await createTestServer({
    transcribe: async () => {
      providerCalls += 1;
      return {text: "should not run", words: []};
    },
  });
  t.after(() => server.close());
  const rejectedOrigins = [
    "null",
    "https://localhost:5173",
    "ftp://localhost:5173",
    "http://localhost.evil.example:5173",
    "http://127.0.0.1.attacker.example:5173",
    "http://user@localhost:5173",
    "http://localhost:0",
    "http://localhost:65536",
    "http://attacker.example:5173",
  ];

  for (const origin of rejectedOrigins) {
    const response = await fetch(`${server.url}/api/transcribe`, {
      ...mediaRequest(),
      headers: {Origin: origin},
    });
    assert.equal(response.status, 403, origin);
    assert.deepEqual(await response.json(), {error: "Forbidden."}, origin);
  }

  const malformedUpload = await fetch(`${server.url}/api/transcribe`, {
    method: "POST",
    headers: {
      Origin: "http://attacker.example:5173",
      "Content-Type": "multipart/form-data; boundary=broken",
    },
    body: "this is not a multipart upload",
  });
  assert.equal(malformedUpload.status, 403);
  assert.deepEqual(await malformedUpload.json(), {error: "Forbidden."});
  assert.equal(providerCalls, 0);
});
