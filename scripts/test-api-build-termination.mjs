import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "pnpm --filter @workspace/api-server run build"]
  : ["--filter", "@workspace/api-server", "run", "build"];
const timeoutMs = 360_000;

for (let cycle = 1; cycle <= 2; cycle += 1) {
  const startedAt = Date.now();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        execFileSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, timedOut });
    });
  });
  if (result.timedOut || result.status !== 0 || result.signal) {
    throw new Error(`API production build cycle ${cycle} exited unsuccessfully (code=${result.status}, signal=${result.signal ?? "none"}, timedOut=${result.timedOut}).`);
  }
  console.log(`API_BUILD_TERMINATION_CYCLE_${cycle}=PASS elapsedMs=${Date.now() - startedAt}`);
}

console.log("API_BUILD_TERMINATION=PASS cycles=2 naturalExit=true manualProcessKill=false");
