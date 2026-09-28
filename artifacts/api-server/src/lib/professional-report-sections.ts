import crypto from "node:crypto";

export type ReportSourceRow = { domain: "rfi" | "submittal" | "meeting" | "baseline"; id: string; version: number; title: string; sourceUrl: string };

export function combineProfessionalReportSections(rows: readonly ReportSourceRow[]) {
  const seen = new Set<string>();
  const canonical = rows
    .map(row => ({ ...row, sourceKey: `${row.domain}:${row.id}` }))
    .filter(row => {
      if (seen.has(row.sourceKey)) return false;
      seen.add(row.sourceKey);
      return true;
    })
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  const sections = (["rfi", "submittal", "meeting", "baseline"] as const).map(domain => ({
    domain,
    rows: canonical.filter(row => row.domain === domain),
    count: canonical.filter(row => row.domain === domain).length,
  }));
  return { sections, totalDistinctRecords: canonical.length, sourceFingerprint: crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}
