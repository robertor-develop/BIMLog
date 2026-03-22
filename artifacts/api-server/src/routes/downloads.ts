import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

function findReleasesDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "artifacts/sync-agent/releases"),
    path.resolve(cwd, "../sync-agent/releases"),
    path.resolve(cwd, "sync-agent/releases"),
    path.resolve(cwd, "../../sync-agent/releases"),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) {
    console.log(`[downloads] Releases dir: ${found}`);
  } else {
    console.warn(`[downloads] Releases dir not found. Tried: ${candidates.join(", ")}`);
  }
  return found ?? candidates[0];
}

const RELEASES_DIR = findReleasesDir();
const WINDOWS_EXE = path.join(RELEASES_DIR, "BIMLog Sync Agent Setup 1.0.0.exe");

router.get("/downloads/sync-agent-windows", (_req: Request, res: Response) => {
  if (!fs.existsSync(WINDOWS_EXE)) {
    console.warn(`[downloads] Windows installer not found at: ${WINDOWS_EXE}`);
    return res.status(503).json({
      error: "Windows installer not yet available on this server",
      message: "Contact info@ignitesmart.ai to receive the Windows installer for your project.",
      contact: "info@ignitesmart.ai",
    });
  }

  const stat = fs.statSync(WINDOWS_EXE);
  console.log(`[downloads] Serving Windows installer — ${stat.size} bytes from ${WINDOWS_EXE}`);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="BIMLog Sync Agent Setup 1.0.0.exe"');
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-File-Size", String(stat.size));

  const stream = fs.createReadStream(WINDOWS_EXE);
  stream.on("error", (err) => {
    console.error(`[downloads] Stream error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream file" });
    }
  });
  stream.pipe(res);
  return;
});

router.get("/downloads/sync-agent-mac", (_req: Request, res: Response) => {
  return res.status(200).json({
    available: false,
    message: "Mac installer coming soon — contact info@ignitesmart.ai",
    contact: "info@ignitesmart.ai",
    whatsapp: "https://wa.me/59171054305",
  });
});

export default router;
