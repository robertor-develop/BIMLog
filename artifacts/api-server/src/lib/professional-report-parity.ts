import crypto from "node:crypto";
import type { ReportLayoutSettings } from "./professional-report-layout";
import type { ReportSourceRow } from "./professional-report-sections";

export type ProfessionalReportOutput = { format: "pdf" | "xlsx"; sourceFingerprint: string; settingsFingerprint: string; recordKeys: readonly string[]; officialRecord: boolean };

function hash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function generateProfessionalReportOutputs(input: { rows: readonly ReportSourceRow[]; settings: ReportLayoutSettings; approvedPackage: boolean }) {
  const canonicalRows = [...input.rows].sort((a, b) => `${a.domain}:${a.id}`.localeCompare(`${b.domain}:${b.id}`));
  const recordKeys = canonicalRows.map(row => `${row.domain}:${row.id}:v${row.version}`);
  const sourceFingerprint = hash(canonicalRows);
  const settingsFingerprint = hash(input.settings);
  const output = (format: "pdf" | "xlsx"): ProfessionalReportOutput => Object.freeze({ format, sourceFingerprint, settingsFingerprint, recordKeys: Object.freeze([...recordKeys]), officialRecord: input.approvedPackage });
  return { pdf: output("pdf"), xlsx: output("xlsx"), reproductionKey: hash({ sourceFingerprint, settingsFingerprint, recordKeys }) };
}

export function verifyProfessionalReportParity(outputs: ReturnType<typeof generateProfessionalReportOutputs>) {
  const pass = outputs.pdf.sourceFingerprint === outputs.xlsx.sourceFingerprint
    && outputs.pdf.settingsFingerprint === outputs.xlsx.settingsFingerprint
    && JSON.stringify(outputs.pdf.recordKeys) === JSON.stringify(outputs.xlsx.recordKeys)
    && outputs.pdf.officialRecord === outputs.xlsx.officialRecord;
  if (!pass) throw new Error("PROFESSIONAL_REPORT_OUTPUT_PARITY_FAILED");
  return { pass, recordCount: outputs.pdf.recordKeys.length, reproductionKey: outputs.reproductionKey };
}
