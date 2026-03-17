import { Router, type Request, type Response } from "express";
import archiver from "archiver";
import fs from "fs";
import path from "path";

const router = Router();

function findSyncAgentDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "../sync-agent"),
    path.resolve(cwd, "artifacts/sync-agent"),
    path.resolve(cwd, "sync-agent"),
    path.resolve(cwd, "../../sync-agent"),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) {
    console.log(`[downloads] Sync agent dir: ${found}`);
    return found;
  }
  console.warn(`[downloads] Sync agent dir not found. Tried: ${candidates.join(", ")}`);
  return candidates[0];
}

const SYNC_AGENT_DIR = findSyncAgentDir();
const ZIP_CACHE = "/tmp/bimlog-sync-agent.zip";

let zipStatus: "pending" | "ready" | "error" = "pending";

function buildZip() {
  if (!fs.existsSync(SYNC_AGENT_DIR)) {
    console.warn("[downloads] Sync agent dir does not exist — skipping zip build");
    zipStatus = "error";
    return;
  }

  const output = fs.createWriteStream(ZIP_CACHE);
  const archive = archiver("zip", { zlib: { level: 6 } });

  output.on("close", () => {
    zipStatus = "ready";
    console.log(`[downloads] Sync agent zip ready — ${archive.pointer()} bytes`);
  });

  archive.on("error", (err) => {
    zipStatus = "error";
    console.error("[downloads] Failed to build sync agent zip:", err);
  });

  archive.pipe(output);
  archive.glob("**/*", {
    cwd: SYNC_AGENT_DIR,
    ignore: ["node_modules/**", ".git/**", "dist/**"],
    dot: false,
  });
  archive.finalize();
}

buildZip();

function serveZip(_req: Request, res: Response) {
  if (zipStatus === "error") {
    return res.status(500).json({ error: "Failed to package sync agent" });
  }
  if (zipStatus === "pending") {
    return res.status(503).json({ error: "Sync agent package is being prepared — please try again in a moment" });
  }
  res.download(ZIP_CACHE, "bimlog-sync-agent.zip");
}

router.get("/downloads/sync-agent-windows", serveZip);
router.get("/downloads/sync-agent-mac", serveZip);

export default router;
