export function logClientError(context: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] ${detail}`, error);
}
