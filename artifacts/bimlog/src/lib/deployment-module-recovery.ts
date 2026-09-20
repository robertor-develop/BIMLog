const RECOVERY_MARKER = "bimlog:deployment-module-reload";
const RECOVERY_WINDOW_MS = 60_000;

const staleModulePatterns = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk .* failed/i,
];

export function isStaleDeploymentModuleError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return staleModulePatterns.some((pattern) => pattern.test(message));
}

export function shouldReloadStaleDeploymentModule(previousMarker: string | null, now: number): boolean {
  if (!previousMarker) return true;
  const previous = Number(previousMarker);
  return !Number.isFinite(previous) || now - previous > RECOVERY_WINDOW_MS;
}

export async function loadDeploymentModule<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const loaded = await loader();
    window.sessionStorage.removeItem(RECOVERY_MARKER);
    return loaded;
  } catch (error) {
    if (!isStaleDeploymentModuleError(error)) throw error;

    const now = Date.now();
    const previous = window.sessionStorage.getItem(RECOVERY_MARKER);
    if (!shouldReloadStaleDeploymentModule(previous, now)) throw error;

    window.sessionStorage.setItem(RECOVERY_MARKER, String(now));
    window.location.reload();
    return new Promise<T>(() => undefined);
  }
}
