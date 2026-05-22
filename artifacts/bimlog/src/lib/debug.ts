export const isDebug = () => {
  try { return localStorage.getItem("bimlog_debug") === "true"; } catch { return false; }
};

export const toggleDebug = () => {
  try {
    const current = localStorage.getItem("bimlog_debug") === "true";
    if (current) {
      localStorage.removeItem("bimlog_debug");
      return false;
    } else {
      localStorage.setItem("bimlog_debug", "true");
      return true;
    }
  } catch { return false; }
};

export const debugError = (context: string, err: unknown) => {
  if (isDebug()) {
    console.error(`[BIMLog Debug] ${context}`, err);
    return err instanceof Error ? `[${context}] ${err.message}` : `[${context}] ${String(err)}`;
  }
  return null;
};
