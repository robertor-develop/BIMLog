import { createApplicationBootstrap } from "./startup-bootstrap";

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

bootstrap.server.listen(port, () => {
  console.log(`[startup] phase=bootstrap_bound port=${port} elapsed_ms=0`);
  void bootstrap.initialize();
});
