import { createHash } from "crypto";

export const MAX_LENS_IMPORT_REQUEST_BYTES = 5 * 1024 * 1024;
export const MAX_LENS_IMPORT_VIEWPOINTS = 5000;

export class LensImportValidationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "LensImportValidationError";
  }
}

export type NormalizedLensImportViewpoint = {
  sourceProjectId: number;
  sourceIdentityKey: string;
  sourceServerId: number | null;
  sourcePhysicalId: string | null;
  sourceNavisworksGuid: string | null;
  sourceDisplayLabel: string | null;
  sourceSupersedesIdentityKey: string | null;
  note: string | null;
  trade: string | null;
  responsibleCompany: string | null;
  reportType: string | null;
  priority: number;
  floor: string | null;
  openItems: string | null;
  lifecycle: "active" | "superseded" | "voided";
  status: "open" | "follow_up" | "waiting_design" | "approved" | "resolved";
  revisionNumber: number;
  issueGroupId: string | null;
};

export type ValidatedLensImportPlan = {
  importKey: string;
  modelKey: string;
  requestHash: string;
  sourceProjectIds: number[];
  records: NormalizedLensImportViewpoint[];
};

const HEX_64 = /^[a-f0-9]{64}$/i;
const GUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PHYSICAL_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

function boundedText(value: unknown, field: string, max: number, nullable = true): string | null {
  if (value == null || String(value).length === 0) {
    if (nullable) return null;
    throw new LensImportValidationError("INVALID_IMPORT_FIELD", 400, `${field} is required`);
  }
  const text = String(value).trim();
  if ((!nullable && text.length === 0) || text.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    throw new LensImportValidationError("INVALID_IMPORT_FIELD", 400, `${field} is invalid`);
  }
  return text || null;
}

function positiveInt(value: unknown, field: string, max = 2147483647): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) throw new LensImportValidationError("INVALID_IMPORT_FIELD", 400, `${field} is invalid`);
  return n;
}

export function validateAndHashLensImportRequest(body: unknown, authenticatedUserId: number, targetProjectId: number): ValidatedLensImportPlan {
  let serialized: string;
  try { serialized = JSON.stringify(body); } catch { throw new LensImportValidationError("INVALID_IMPORT_REQUEST", 400, "Import request is not valid JSON data"); }
  if (Buffer.byteLength(serialized ?? "", "utf8") > MAX_LENS_IMPORT_REQUEST_BYTES) {
    throw new LensImportValidationError("IMPORT_REQUEST_TOO_LARGE", 413, "Import request exceeds the 5 MB limit");
  }
  if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0 || !Number.isInteger(targetProjectId) || targetProjectId <= 0) {
    throw new LensImportValidationError("INVALID_IMPORT_CONTEXT", 400, "Authenticated user and target project are required");
  }
  const source = body as { importKey?: unknown; modelKey?: unknown; viewpoints?: unknown };
  const importKey = String(source?.importKey ?? "").trim().toLowerCase();
  const modelKey = String(source?.modelKey ?? "").trim().toLowerCase();
  if (!HEX_64.test(importKey) || !HEX_64.test(modelKey)) throw new LensImportValidationError("INVALID_IMPORT_KEY", 400, "Import and model keys must be 64-character SHA-256 values");
  if (!Array.isArray(source?.viewpoints) || source.viewpoints.length < 1 || source.viewpoints.length > MAX_LENS_IMPORT_VIEWPOINTS) {
    throw new LensImportValidationError("INVALID_IMPORT_COUNT", 400, `Import requires 1-${MAX_LENS_IMPORT_VIEWPOINTS} viewpoints`);
  }
  const keys = new Set<string>();
  const records: NormalizedLensImportViewpoint[] = source.viewpoints.map((raw, index) => {
    const v = raw as Record<string, unknown>;
    const sourceProjectId = positiveInt(v.sourceProjectId, `viewpoints[${index}].sourceProjectId`);
    if (sourceProjectId === targetProjectId) throw new LensImportValidationError("INVALID_IMPORT_SOURCE", 400, "Source project must differ from destination project");
    const sourceIdentityKey = String(v.sourceIdentityKey ?? "").trim().toLowerCase();
    if (!HEX_64.test(sourceIdentityKey) || keys.has(sourceIdentityKey)) throw new LensImportValidationError("INVALID_IMPORT_IDENTITY", 400, "Every viewpoint requires one unique SHA-256 source identity key");
    keys.add(sourceIdentityKey);
    const predecessor = String(v.sourceSupersedesIdentityKey ?? "").trim().toLowerCase() || null;
    if (predecessor && !HEX_64.test(predecessor)) throw new LensImportValidationError("INVALID_IMPORT_LINEAGE", 400, "Source predecessor identity is malformed");
    const guid = String(v.sourceNavisworksGuid ?? "").trim().toLowerCase() || null;
    if (guid && !GUID.test(guid)) throw new LensImportValidationError("INVALID_IMPORT_GUID", 400, "Source Navisworks GUID is malformed");
    const physical = String(v.sourcePhysicalId ?? "").trim() || null;
    if (physical && !PHYSICAL_ID.test(physical)) throw new LensImportValidationError("INVALID_IMPORT_PHYSICAL_ID", 400, "Source physical identity is malformed");
    const sourceServerId = v.sourceServerId == null || String(v.sourceServerId).trim() === "" ? null : positiveInt(v.sourceServerId, `viewpoints[${index}].sourceServerId`);
    const priority = positiveInt(v.priority ?? 3, `viewpoints[${index}].priority`, 5);
    const revisionNumber = positiveInt(v.revisionNumber ?? 1, `viewpoints[${index}].revisionNumber`, 1000000);
    const lifecycleRaw = String(v.lifecycleStatus ?? "active");
    const lifecycle = (["active", "superseded", "voided"] as const).find(x => x === lifecycleRaw);
    if (!lifecycle) throw new LensImportValidationError("INVALID_IMPORT_LIFECYCLE", 400, "Lifecycle status is invalid");
    const statusRaw = String(v.status ?? "open");
    const status = (["open", "follow_up", "waiting_design", "approved", "resolved"] as const).find(x => x === statusRaw);
    if (!status) throw new LensImportValidationError("INVALID_IMPORT_STATUS", 400, "Workflow status is invalid");
    return {
      sourceProjectId, sourceIdentityKey, sourceServerId, sourcePhysicalId: physical, sourceNavisworksGuid: guid,
      sourceDisplayLabel: boundedText(v.sourceDisplayLabel, `viewpoints[${index}].sourceDisplayLabel`, 500),
      sourceSupersedesIdentityKey: predecessor,
      note: boundedText(v.note, `viewpoints[${index}].note`, 8000),
      trade: boundedText(v.trade, `viewpoints[${index}].trade`, 200),
      responsibleCompany: boundedText(v.responsibleCompany, `viewpoints[${index}].responsibleCompany`, 300),
      reportType: boundedText(v.reportType, `viewpoints[${index}].reportType`, 100), priority,
      floor: boundedText(v.floor, `viewpoints[${index}].floor`, 200),
      openItems: boundedText(v.openItems, `viewpoints[${index}].openItems`, 8000),
      lifecycle, status, revisionNumber,
      issueGroupId: boundedText(v.issueGroupId, `viewpoints[${index}].issueGroupId`, 128),
    };
  });
  const sourceProjectIds = Array.from(new Set(records.map(v => v.sourceProjectId))).sort((a, b) => a - b);
  const canonical = {
    version: 1,
    authenticatedUserId,
    targetProjectId,
    modelKey,
    sourceProjectIds,
    viewpoints: [...records].sort((a, b) => a.sourceIdentityKey.localeCompare(b.sourceIdentityKey)),
  };
  const requestHash = createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  return { importKey, modelKey, requestHash, sourceProjectIds, records };
}
