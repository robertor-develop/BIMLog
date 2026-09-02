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

const bootstrap = createApplicationBootstrap(() => import("./app"));

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
