import { createApplicationBootstrap } from "./startup-bootstrap";
import "./lib/storage-adapter";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Keep the listener bootstrap in a small bundle so production can bind and
// answer liveness before the full application graph is parsed. The build
// emits app.cjs beside index.cjs; the runtime string intentionally keeps that
// graph out of the bootstrap bundle.
const applicationBundle = "./app.cjs";
const bootstrap = createApplicationBootstrap(async () => {
  const imported = await import(applicationBundle);
  // Node exposes a CommonJS bundle as the namespace default. esbuild's CJS
  // wrapper then holds the actual default handler and named startup exports.
  // Normalize that single wrapper without weakening bootstrap validation.
  const candidate = imported.default;
  return (
    candidate && typeof candidate === "object" && "default" in candidate
      ? candidate
      : imported
  ) as typeof imported;
});

async function main(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      bootstrap.server.once("error", reject);
      bootstrap.server.listen(port, () => resolve());
    });
    console.log(`[startup] phase=bootstrap_bound port=${port}`);
    await bootstrap.initialize();
    bootstrap.startWorkers();
  } catch {
    process.exitCode = 1;
    if (bootstrap.server.listening) {
      bootstrap.server.close();
    }
  }
}

void main();
