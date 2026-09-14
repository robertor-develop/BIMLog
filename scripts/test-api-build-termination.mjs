import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "pnpm --filter @workspace/api-server run build"]
  : ["--filter", "@workspace/api-server", "run", "build"];
const timeoutMs = 240_000;

const child = spawn(command, args, {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

const timeout = setTimeout(() => {
  child.kill();
  console.error(`API production build did not terminate within ${timeoutMs}ms.`);
  process.exitCode = 1;
}, timeoutMs);

child.on("error", error => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);
  if (code !== 0) {
    console.error(`API production build exited unsuccessfully (code=${code}, signal=${signal ?? "none"}).`);
    process.exitCode = 1;
    return;
  }
  console.log("API production build terminated cleanly after successful runtime assembly.");
});
