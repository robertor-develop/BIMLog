import { createHash } from "node:crypto";

export const BIMLOG_ASSISTANT_AGENT_KEY = "bimlog" as const;
export const BIMLOG_ASSISTANT_CONTRACT_VERSION = "1.0.0" as const;
export const BIMLOG_ASSISTANT_MAX_QUESTION = 2_000;
export const BIMLOG_ASSISTANT_MAX_ANSWER = 5_000;

export type PageAssistantLanguage = "en" | "es";
export type PageAssistantRole = "user" | "assistant";
export type PageAssistantHistoryItem = { role: PageAssistantRole; text: string };
export type PageAssistantContextEnvelope = {
  route: string;
  page: string;
  section: string;
  language: PageAssistantLanguage;
  focusedControl: string | null;
  controls: string[];
  pageText: string[];
};
export type PageAssistantAgentAnswer = {
  answer: string;
  highlightLabels: string[];
};

export function cleanAssistantText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maximum) : "";
}

export function cleanAssistantList(value: unknown, count: number, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => cleanAssistantText(item, maximum)).filter(Boolean))].slice(0, count);
}

export function parseAssistantAnswer(raw: string, allowedControls: string[]): PageAssistantAgentAnswer {
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")); }
  catch { throw new Error("ASSISTANT_RESPONSE_MALFORMED"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ASSISTANT_RESPONSE_MALFORMED");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !["answer", "highlightLabels"].includes(key))) throw new Error("ASSISTANT_RESPONSE_UNAUTHORIZED_FIELD");
  const answer = cleanAssistantText(record.answer, BIMLOG_ASSISTANT_MAX_ANSWER);
  if (!answer) throw new Error("ASSISTANT_RESPONSE_EMPTY");
  const allowed = new Set(allowedControls);
  const highlightLabels = cleanAssistantList(record.highlightLabels, 8, 120).filter(label => allowed.has(label));
  return { answer, highlightLabels };
}

export function assistantInstructionDigest(instructions: string): string {
  return createHash("sha256").update(instructions).digest("hex");
}
