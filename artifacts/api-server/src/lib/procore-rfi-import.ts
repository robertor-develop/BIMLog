import { createHash } from "node:crypto";

export const PROCORE_RFI_HEADERS = [
  "Number", "Revision", "Subject", "Status", "Responsible Contractor Id",
  "Received From Id", "Initiated At", "RFI Manager", "Assigned Id", "Ball In Court",
  "Due Date", "Closed Date", "Location Id", "Schedule Impact", "Cost Impact",
  "Cost Code", "Sub Job", "RFI Stage", "Distribution List", "Private", "Created By",
] as const;

export const PROCORE_RFI_LIMITS = {
  csvBytes: 5_242_880,
  rows: 10_000,
  fieldBytes: 8_192,
  rowBytes: 65_536,
  retainedPayloadBytes: 4_194_304,
  projectCodeBytes: 128,
  projectNameBytes: 512,
  projectAddressBytes: 1_024,
} as const;

export type ProcoreRfiRow = Record<(typeof PROCORE_RFI_HEADERS)[number], string>;
export type ProcoreProjectIdentity = {
  code: string;
  name: string;
  address?: string;
};
export type ProcoreRfiSourceExpectation = {
  sha256: string;
  rowCount: number;
  project: ProcoreProjectIdentity;
};
export type ProcoreRfiPreviewRow = {
  row: number;
  identity: string;
  sourceNumber: string;
  revision: number;
  subject: string;
  status: "Open" | "Closed";
  initiatedAt: string;
  dueDate: string;
  closedDate: string | null;
  raw: ProcoreRfiRow;
};
export type ProcoreRfiPreview = {
  provider: "procore";
  project: ProcoreProjectIdentity;
  projectIdentityDigest: string;
  digest: string;
  expectedRowCount: number;
  rowCount: number;
  valid: boolean;
  errors: string[];
  rows: ProcoreRfiPreviewRow[];
};
export type ProcoreRfiPreviewResponse = Omit<ProcoreRfiPreview, "rows"> & {
  rows: Array<Omit<ProcoreRfiPreviewRow, "raw">>;
};

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeProjectIdentity(project: ProcoreProjectIdentity): ProcoreProjectIdentity {
  return {
    code: project.code.trim(),
    name: project.name.trim(),
    ...(project.address?.trim() ? { address: project.address.trim() } : {}),
  };
}

function projectIdentityIsBounded(project: ProcoreProjectIdentity): boolean {
  return Buffer.byteLength(project.code, "utf8") <= PROCORE_RFI_LIMITS.projectCodeBytes
    && Buffer.byteLength(project.name, "utf8") <= PROCORE_RFI_LIMITS.projectNameBytes
    && Buffer.byteLength(project.address ?? "", "utf8") <= PROCORE_RFI_LIMITS.projectAddressBytes;
}

function projectIdentityIsControlSafe(project: ProcoreProjectIdentity): boolean {
  return !CONTROL_CHARACTER_PATTERN.test(project.code)
    && !CONTROL_CHARACTER_PATTERN.test(project.name)
    && !CONTROL_CHARACTER_PATTERN.test(project.address ?? "");
}

export function procoreProjectIdentityDigest(project: ProcoreProjectIdentity): string {
  const normalized = normalizeProjectIdentity(project);
  return sha256(JSON.stringify([normalized.code, normalized.name, normalized.address ?? ""]));
}

function parseCsv(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { quoted = false; quoteClosed = true; }
      else field += char;
    } else if (char === '"') {
      if (field.length > 0 || quoteClosed) throw new Error("CSV_INVALID_QUOTE");
      quoted = true;
    } else if (char === ",") { record.push(field); field = ""; quoteClosed = false; }
    else if (char === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
      quoteClosed = false;
    } else {
      if (quoteClosed && (char !== "\r" || csv[i + 1] !== "\n")) {
        throw new Error("CSV_CHARACTERS_AFTER_QUOTE");
      }
      field += char;
    }
  }
  if (quoted) throw new Error("CSV_UNTERMINATED_QUOTED_FIELD");
  if (field.length || record.length) { record.push(field.replace(/\r$/, "")); records.push(record); }
  return records;
}

function isoDate(value: string, label: string, row: number, required: boolean): string | null {
  if (!value.trim()) {
    if (required) throw new Error(`ROW_${row}_${label.toUpperCase().replaceAll(" ", "_")}_REQUIRED`);
    return null;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`ROW_${row}_${label.toUpperCase().replaceAll(" ", "_")}_INVALID_DATE`);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`ROW_${row}_${label.toUpperCase().replaceAll(" ", "_")}_INVALID_DATE`);
  }
  return date.toISOString();
}

function assertBoundedRaw(raw: ProcoreRfiRow, row: number): void {
  for (const header of PROCORE_RFI_HEADERS) {
    if (Buffer.byteLength(raw[header], "utf8") > PROCORE_RFI_LIMITS.fieldBytes) {
      throw new Error(`ROW_${row}_${header.toUpperCase().replaceAll(" ", "_")}_TOO_LARGE`);
    }
    if (CONTROL_CHARACTER_PATTERN.test(raw[header])) {
      throw new Error(`ROW_${row}_${header.toUpperCase().replaceAll(" ", "_")}_CONTROL_CHARACTER`);
    }
  }
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > PROCORE_RFI_LIMITS.rowBytes) {
    throw new Error(`ROW_${row}_PAYLOAD_TOO_LARGE`);
  }
}

export function previewProcoreRfiCsv(
  csvText: string,
  expectation: ProcoreRfiSourceExpectation,
): ProcoreRfiPreview {
  const digest = sha256(csvText);
  const project = normalizeProjectIdentity(expectation.project);
  const projectIdentityDigest = procoreProjectIdentityDigest(project);
  const errors: string[] = [];
  const rows: ProcoreRfiPreviewRow[] = [];
  const normalized = csvText.replace(/^\uFEFF/, "");
  if (!/^[a-f0-9]{64}$/i.test(expectation.sha256) || digest !== expectation.sha256.toLowerCase()) errors.push("SOURCE_SHA256_MISMATCH");
  if (!Number.isInteger(expectation.rowCount) || expectation.rowCount < 1 || expectation.rowCount > PROCORE_RFI_LIMITS.rows) errors.push("EXPECTED_ROW_COUNT_INVALID");
  if (!project.code || !project.name) errors.push("PROCORE_PROJECT_IDENTITY_REQUIRED");
  if (!projectIdentityIsBounded(project)) errors.push("PROCORE_PROJECT_IDENTITY_TOO_LARGE");
  if (!projectIdentityIsControlSafe(project)) errors.push("PROCORE_PROJECT_IDENTITY_CONTROL_CHARACTER");
  if (Buffer.byteLength(csvText, "utf8") > PROCORE_RFI_LIMITS.csvBytes) {
    return { provider: "procore", project, projectIdentityDigest, digest, expectedRowCount: expectation.rowCount, rowCount: 0, valid: false, errors: [...errors, "CSV_TOO_LARGE"], rows };
  }
  let records: string[][];
  try { records = parseCsv(normalized); }
  catch (error) {
    return { provider: "procore", project, projectIdentityDigest, digest, expectedRowCount: expectation.rowCount, rowCount: 0, valid: false, errors: [...errors, (error as Error).message], rows };
  }
  const headers = records.shift() ?? [];
  if (headers.length !== PROCORE_RFI_HEADERS.length || headers.some((h, i) => h !== PROCORE_RFI_HEADERS[i])) errors.push("HEADER_MISMATCH");
  if (records.length > PROCORE_RFI_LIMITS.rows) errors.push("ROW_LIMIT_EXCEEDED");
  if (records.length !== expectation.rowCount) errors.push("SOURCE_ROW_COUNT_MISMATCH");
  const seen = new Set<string>();
  let retainedPayloadBytes = 0;
  records.forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== PROCORE_RFI_HEADERS.length) { errors.push(`ROW_${rowNumber}_FIELD_COUNT_MISMATCH`); return; }
    const raw = Object.fromEntries(PROCORE_RFI_HEADERS.map((header, i) => [header, values[i]])) as ProcoreRfiRow;
    try {
      assertBoundedRaw(raw, rowNumber);
      retainedPayloadBytes += Buffer.byteLength(JSON.stringify(raw), "utf8");
      if (retainedPayloadBytes > PROCORE_RFI_LIMITS.retainedPayloadBytes) throw new Error("AGGREGATE_PAYLOAD_TOO_LARGE");
      const sourceNumber = raw.Number.trim();
      const revision = Number(raw.Revision);
      if (!sourceNumber) throw new Error(`ROW_${rowNumber}_NUMBER_REQUIRED`);
      if (!Number.isInteger(revision) || revision < 0) throw new Error(`ROW_${rowNumber}_REVISION_INVALID`);
      if (!raw.Subject.trim()) throw new Error(`ROW_${rowNumber}_SUBJECT_REQUIRED`);
      if (raw.Status !== "Open" && raw.Status !== "Closed") throw new Error(`ROW_${rowNumber}_STATUS_UNSUPPORTED`);
      if (raw.Private !== "true" && raw.Private !== "false") throw new Error(`ROW_${rowNumber}_PRIVATE_INVALID`);
      const identity = `${sourceNumber}\u0000${revision}`;
      if (seen.has(identity)) throw new Error(`ROW_${rowNumber}_DUPLICATE_NUMBER_REVISION`);
      seen.add(identity);
      rows.push({
        row: rowNumber,
        identity: `${project.code}/${sourceNumber}/${revision}`,
        sourceNumber,
        revision,
        subject: raw.Subject.trim(),
        status: raw.Status,
        initiatedAt: isoDate(raw["Initiated At"], "Initiated At", rowNumber, true)!,
        dueDate: isoDate(raw["Due Date"], "Due Date", rowNumber, true)!,
        closedDate: isoDate(raw["Closed Date"], "Closed Date", rowNumber, false),
        raw,
      });
    } catch (error) { errors.push((error as Error).message); }
  });
  if (records.length === 0) errors.push("CSV_HAS_NO_RFI_ROWS");
  return { provider: "procore", project, projectIdentityDigest, digest, expectedRowCount: expectation.rowCount, rowCount: records.length, valid: errors.length === 0, errors, rows };
}

export function toProcoreRfiPreviewResponse(preview: ProcoreRfiPreview): ProcoreRfiPreviewResponse {
  return {
    ...preview,
    rows: preview.rows.map(({ raw: _raw, ...row }) => row),
  };
}
