/** A failed read after an acknowledged write must never be reported as a failed write. */
export async function refreshAfterConfirmedFolderWizardMutation(refresh: () => Promise<void>): Promise<boolean> {
  try { await refresh(); return true; }
  catch { return false; }
}
