/** Optional status reads fail independently; none can turn old readiness into current authority. */
export async function readFolderWizardSection<T>(read: () => Promise<Response>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const response = await read();
    if (!response.ok) return { ok: false };
    return { ok: true, data: await response.json() as T };
  } catch { return { ok: false }; }
}
