import { safeProjectReturnTarget } from "./return-context";

export type ChangeOriginContext = { type: string; id: number; label: string; returnTo: string };

export function parseChangeOriginContext(search: string, projectId: number): ChangeOriginContext | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const type = params.get("originType")?.trim() ?? "";
  const idText = params.get("originId") ?? "";
  const label = params.get("originLabel")?.trim() ?? "";
  const returnTo = safeProjectReturnTarget(params.get("returnTo"), projectId);
  if (!type || !/^[1-9]\d*$/.test(idText) || !label || !returnTo) return null;
  const id = Number(idText);
  if (!Number.isSafeInteger(id)) return null;
  return { type, id, label, returnTo };
}

export type TransmittalEvidenceContext = { sourceType: string; sourceId: number; sourceLabel: string; sourceVersion: string; returnTo: string };

export function parseTransmittalEvidenceContext(search: string, projectId: number): TransmittalEvidenceContext | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sourceType = params.get("sourceType")?.trim() ?? "";
  const sourceIdText = params.get("sourceId") ?? "";
  const sourceLabel = params.get("sourceLabel")?.trim() ?? "";
  const sourceVersion = params.get("sourceVersion")?.trim() ?? "";
  const returnTo = safeProjectReturnTarget(params.get("returnTo"), projectId);
  if (!sourceType || !/^[1-9]\d*$/.test(sourceIdText) || !sourceLabel || !sourceVersion || !returnTo) return null;
  const sourceId = Number(sourceIdText);
  if (!Number.isSafeInteger(sourceId)) return null;
  return { sourceType, sourceId, sourceLabel, sourceVersion, returnTo };
}
