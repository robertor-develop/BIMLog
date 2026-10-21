export type RouteSample = { route: string; durationMs: number; outcome: "ready" | "timeout" | "error" | "cancelled" };

export function percentile(values: number[], rank: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))];
}

export function summarizeRouteSamples(samples: RouteSample[]) {
  const completed = samples.filter(sample => sample.outcome === "ready").map(sample => sample.durationMs);
  return { count: samples.length, completed: completed.length, p50: percentile(completed, .5), p95: percentile(completed, .95) };
}

export function recordRouteSample(sample: RouteSample) {
  if (typeof window === "undefined") return;
  const key = "bimlog-route-performance-v1";
  let samples: RouteSample[] = [];
  try { samples = JSON.parse(window.sessionStorage.getItem(key) ?? "[]"); } catch { samples = []; }
  window.sessionStorage.setItem(key, JSON.stringify([...samples.slice(-49), sample]));
}
