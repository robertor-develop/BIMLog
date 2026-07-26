import type { CSSProperties } from "react";

export interface PresentedActivityDetails {
  summary: string;
  meta: string[];
  isStructured: boolean;
}

const MAX_TEXT_LENGTH = 220;
const MAX_META_ITEMS = 3;

const INTERNAL_ACTIVITY_KEYS = [
  "schemaVersion",
  "snapshotHash",
  "settingsVersion",
  "imagePresentationJson",
  "sections",
  "reportSettings",
  "settingsHash",
];

export const activityDetailsClampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  wordBreak: "normal",
  overflowWrap: "anywhere",
  lineHeight: 1.45,
};

function compactText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function looksLikeStructuredPayload(value: string): boolean {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }
  return INTERNAL_ACTIVITY_KEYS.some(key => trimmed.includes(key));
}

function parseJsonLike(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!looksLikeStructuredPayload(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { __malformedStructuredActivity: true };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readableValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return compactText(value, 60);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "enabled" : "disabled";
  return null;
}

function collectMeta(payload: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const nestedSettings = asRecord(payload.reportSettings);
  const reportType = readableValue(payload.reportType ?? payload.outputType ?? payload.format ?? payload.reportFormat ?? nestedSettings?.reportType);
  const preset = readableValue(payload.presetName ?? payload.preset ?? payload.templateName ?? nestedSettings?.presetName ?? nestedSettings?.preset);
  const sectionCount = Array.isArray(payload.sections) ? payload.sections.length : Array.isArray(nestedSettings?.sections) ? nestedSettings.sections.length : null;
  const imageCount = Array.isArray(payload.images) ? payload.images.length : Array.isArray(payload.additionalScreenshots) ? payload.additionalScreenshots.length : null;

  if (reportType) candidates.push(`Output: ${reportType}`);
  if (preset) candidates.push(`Preset: ${preset}`);
  if (typeof sectionCount === "number") candidates.push(`${sectionCount} report sections configured`);
  if (typeof imageCount === "number") candidates.push(`${imageCount} visual references configured`);

  return candidates.slice(0, MAX_META_ITEMS);
}

function firstReadable(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readableValue(payload[key]);
    if (value) return value;
  }
  const nestedRfi = asRecord(payload.rfi);
  if (nestedRfi) {
    for (const key of keys) {
      const value = readableValue(nestedRfi[key]);
      if (value) return value;
    }
  }
  return null;
}

function isRfiReportPayload(payload: Record<string, unknown>): boolean {
  const text = JSON.stringify(payload).toLowerCase();
  return (
    text.includes("rfi") &&
    (
      "sections" in payload ||
      "schemaVersion" in payload ||
      "snapshotHash" in payload ||
      "settingsVersion" in payload ||
      "reportSettings" in payload ||
      "imagePresentationJson" in payload
    )
  );
}

function presentRfiActivity(payload: Record<string, unknown>, actionType?: string): PresentedActivityDetails | null {
  const action = String(payload.event || payload.eventType || payload.actionType || payload.type || actionType || "").toLowerCase();
  const rfiNumber = firstReadable(payload, ["rfiNumber", "number", "rfiNo", "rfiId", "entityNumber"]) ?? "RFI";
  const reportName = firstReadable(payload, ["reportTitle", "fileName", "filename"]);
  const withReport = reportName ? ` (${reportName})` : "";

  const knownSummaries: Array<[RegExp, string]> = [
    [/rfi\.standard_pdf_exported|standard_pdf_exported|rfi_pdf_exported/, `RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.complete_pdf_exported|complete_pdf_exported/, `Complete RFI PDF exported: ${rfiNumber}${withReport}`],
    [/rfi\.docx_exported|docx_exported|word_exported/, `RFI DOCX exported: ${rfiNumber}${withReport}`],
    [/report_settings_saved|settings_saved/, `RFI report settings saved: ${rfiNumber}`],
    [/report_settings_reset|settings_reset/, `RFI report settings reset: ${rfiNumber}`],
    [/rfi\.updated|rfi_updated|\bupdate\b|updated/, `RFI updated: ${rfiNumber}`],
    [/rfi\.closed|rfi_closed|\bclosed\b/, `RFI closed: ${rfiNumber}`],
    [/rfi\.reopened|rfi_reopened|\breopened\b/, `RFI reopened: ${rfiNumber}`],
  ];

  const match = knownSummaries.find(([pattern]) => pattern.test(action));
  if (match) {
    return {
      summary: match[1],
      meta: collectMeta(payload),
      isStructured: true,
    };
  }

  if (isRfiReportPayload(payload)) {
    return {
      summary: `RFI report details recorded: ${rfiNumber}`,
      meta: collectMeta(payload),
      isStructured: true,
    };
  }

  return null;
}

function presentStructuredActivity(payload: Record<string, unknown>, actionType?: string, entityType?: string): PresentedActivityDetails {
  if (payload.__malformedStructuredActivity) {
    return {
      summary: "Structured activity details were recorded, but the payload could not be displayed safely.",
      meta: [],
      isStructured: true,
    };
  }

  const rfiActivity = presentRfiActivity(payload, actionType);
  if (rfiActivity || `${actionType ?? ""} ${entityType ?? ""}`.toLowerCase().includes("rfi")) return rfiActivity ?? {
    summary: `RFI activity recorded: ${firstReadable(payload, ["rfiNumber", "number", "rfiNo", "entityNumber"]) ?? "RFI"}`,
    meta: collectMeta(payload),
    isStructured: true,
  };

  const title = readableValue(payload.title ?? payload.name ?? payload.subject ?? payload.fileName ?? payload.message);
  if (title) {
    return {
      summary: title,
      meta: collectMeta(payload),
      isStructured: true,
    };
  }

  return {
    summary: "Structured activity details recorded.",
    meta: collectMeta(payload),
    isStructured: true,
  };
}

export function presentActivityDetails(details: unknown, context: { actionType?: string; entityType?: string } = {}): PresentedActivityDetails {
  if (details == null || details === "") {
    return { summary: "", meta: [], isStructured: false };
  }

  if (typeof details === "string" && !looksLikeStructuredPayload(details)) {
    return { summary: compactText(details), meta: [], isStructured: false };
  }

  const parsed = parseJsonLike(details);
  const record = asRecord(parsed);
  if (record) return presentStructuredActivity(record, context.actionType, context.entityType);

  if (Array.isArray(parsed)) {
    return {
      summary: `Structured activity details recorded (${parsed.length} items).`,
      meta: [],
      isStructured: true,
    };
  }

  if (typeof details === "string") {
    return {
      summary: "Structured activity details were recorded, but the payload could not be displayed safely.",
      meta: [],
      isStructured: true,
    };
  }

  return {
    summary: "Structured activity details recorded.",
    meta: [],
    isStructured: true,
  };
}
