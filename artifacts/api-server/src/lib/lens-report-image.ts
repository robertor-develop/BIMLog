export type LensReportImageKind = "annotated" | "capture" | "unavailable";

export type LensReportImageEvidence = {
  kind: LensReportImageKind;
  dataUrl: string | null;
  hasRedlines: boolean;
  message: string;
};

const imageDataUrl = /^data:image\/(png|jpe?g);base64,[a-z0-9+/=\r\n]+$/i;

function readField(record: Record<string, unknown>, pascal: string, camel: string): unknown {
  return record[pascal] ?? record[camel];
}

function nonEmptyPayload(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0 && value.trim() !== "null" && value.trim() !== "[]" && value.trim() !== "{}";
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0);
}

/**
 * Selects report imagery only from a previously verified Lens visual package.
 * A raw issue thumbnail is intentionally not accepted here: when redlines exist,
 * silently falling back to an unrelated/unmarked thumbnail would make the report
 * materially misleading.
 */
export function selectLensReportImage(verifiedVisualState: unknown): LensReportImageEvidence {
  if (!verifiedVisualState || typeof verifiedVisualState !== "object" || Array.isArray(verifiedVisualState)) {
    return {
      kind: "unavailable",
      dataUrl: null,
      hasRedlines: false,
      message: "Verified Lens capture unavailable.",
    };
  }

  const state = verifiedVisualState as Record<string, unknown>;
  const hasRedlines = nonEmptyPayload(readField(state, "RedlinesJson", "redlinesJson"));
  const screenshot = String(readField(state, "ScreenshotDataUrl", "screenshotDataUrl") ?? "").trim();

  if (!imageDataUrl.test(screenshot)) {
    return {
      kind: "unavailable",
      dataUrl: null,
      hasRedlines,
      message: hasRedlines
        ? "Annotated Lens capture unavailable; the unmarked image was not substituted."
        : "Verified Lens capture unavailable.",
    };
  }

  return {
    kind: hasRedlines ? "annotated" : "capture",
    dataUrl: screenshot,
    hasRedlines,
    message: hasRedlines ? "Verified Lens capture with markups." : "Verified Lens capture; no markups were recorded.",
  };
}

