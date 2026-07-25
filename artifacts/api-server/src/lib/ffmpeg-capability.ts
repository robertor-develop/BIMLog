import { execFile } from "node:child_process";

interface FfmpegResolverOptions {
  discover?: (timeoutMs: number) => Promise<string | null>;
  timeoutMs?: number;
}

const DEFAULT_DISCOVERY_TIMEOUT_MS = 1_500;

function discoverFfmpegPath(timeoutMs: number): Promise<string | null> {
  const command = process.platform === "win32" ? "where.exe" : "which";
  return new Promise((resolve) => {
    execFile(
      command,
      ["ffmpeg"],
      {
        encoding: "utf8",
        maxBuffer: 4_096,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const firstResult = stdout
          .split(/\r?\n/)
          .map((value) => value.trim())
          .find(Boolean);
        resolve(firstResult ?? null);
      },
    );
  });
}

export function createFfmpegPathResolver(
  options: FfmpegResolverOptions = {},
): () => Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("FFmpeg discovery timeout must be positive.");
  }
  const discover = options.discover ?? discoverFfmpegPath;
  let cached: Promise<string> | undefined;

  return () => {
    cached ??= Promise.race([
      discover(timeoutMs),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]).then((path) => path || "ffmpeg");
    return cached;
  };
}

export const resolveFfmpegPath = createFfmpegPathResolver();
