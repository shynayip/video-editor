import {createServer as createViteServer} from "vite";

const [configFile, portText, proxyPortText] = process.argv.slice(2);
process.env.TRANSCRIPTION_PORT = proxyPortText;

let vite;
let closing = false;

const close = async (exitCode = 0) => {
  if (closing) return;
  closing = true;
  await vite?.close();
  process.exit(exitCode);
};

try {
  vite = await createViteServer({
    configFile,
    server: {port: Number(portText), strictPort: true},
  });
  await vite.listen();

  const address = vite.httpServer?.address();
  process.stdout.write(
    `VITE_READY ${JSON.stringify({
      host: vite.config.server.host,
      proxy: vite.config.server.proxy?.["/api"],
      address: typeof address === "object" && address ? address.address : null,
      family: typeof address === "object" && address ? address.family : null,
    })}\n`,
  );
  process.stdin.resume();
  process.stdin.once("data", () => void close());
  process.on("SIGTERM", () => void close());
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  await close(1);
}
