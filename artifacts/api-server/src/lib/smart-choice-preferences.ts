import { FinancialControlError } from "./financial-control-contract";

export type SmartChoiceOption = { id: string; code: string; name: string; aliases?: string[] };
export type SmartChoiceUsage = { count: number; lastUsedAt: string | null };
export type SmartChoiceProfile = {
  userId: number;
  companyId: number;
  pinnedDisciplineIds: string[];
  pinnedDocumentTypeIds: string[];
  disciplineUsage: Record<string, SmartChoiceUsage>;
  documentTypeUsage: Record<string, SmartChoiceUsage>;
};

const uniqueIds = (value: unknown, limit: number) => {
  const values = Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];
  const unique = [...new Set(values)];
  if (unique.length > limit) throw new FinancialControlError(400, "SMART_CHOICE_PIN_LIMIT", `At most ${limit} choices may be pinned.`);
  return unique;
};

const normalizeUsage = (value: unknown) => Object.fromEntries(Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {}).map(([id, raw]: [string, any]) => {
  const count = Number(raw?.count);
  const lastUsedAt = raw?.lastUsedAt == null ? null : new Date(raw.lastUsedAt).toISOString();
  return [id, { count: Number.isSafeInteger(count) && count > 0 ? count : 0, lastUsedAt }];
}).filter(([, usage]) => (usage as SmartChoiceUsage).count > 0));

export function normalizeSmartChoiceProfile(input: any): SmartChoiceProfile {
  const userId = Number(input?.userId);
  const companyId = Number(input?.companyId);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(companyId) || companyId <= 0)
    throw new FinancialControlError(400, "SMART_CHOICE_OWNER_INVALID", "Smart-choice preferences require a valid user and company.");
  return {
    userId,
    companyId,
    pinnedDisciplineIds: uniqueIds(input?.pinnedDisciplineIds, 8),
    pinnedDocumentTypeIds: uniqueIds(input?.pinnedDocumentTypeIds, 8),
    disciplineUsage: normalizeUsage(input?.disciplineUsage),
    documentTypeUsage: normalizeUsage(input?.documentTypeUsage),
  };
}

export function preferredEligibleChoices(input: { eligible: SmartChoiceOption[]; companyPinnedIds?: unknown; userPinnedIds?: unknown }) {
  const companyPins = uniqueIds(input.companyPinnedIds, 8);
  const userPins = uniqueIds(input.userPinnedIds, 8);
  const priority = [...new Set([...userPins, ...companyPins])];
  const eligible = new Map(input.eligible.map(option => [String(option.id), option]));
  return priority.map(id => eligible.get(id)).filter((option): option is SmartChoiceOption => Boolean(option));
}

export function recordSmartChoiceUse(usage: Record<string, SmartChoiceUsage>, optionId: unknown, usedAt: unknown) {
  const id = String(optionId ?? "").trim();
  if (!id) throw new FinancialControlError(400, "SMART_CHOICE_ID_INVALID", "A selected choice identity is required.");
  const timestamp = new Date(String(usedAt));
  if (Number.isNaN(timestamp.valueOf())) throw new FinancialControlError(400, "SMART_CHOICE_TIME_INVALID", "Choice usage requires a valid timestamp.");
  const current = usage[id] ?? { count: 0, lastUsedAt: null };
  return { ...usage, [id]: { count: Math.min(1_000_000, current.count + 1), lastUsedAt: timestamp.toISOString() } };
}

export function rankSmartChoices(input: {
  eligible: SmartChoiceOption[];
  selected?: SmartChoiceOption[];
  pinnedIds?: unknown;
  usage?: Record<string, SmartChoiceUsage>;
  preferredLimit?: number;
}) {
  const selected = input.selected ?? [];
  const selectedIds = new Set(selected.map(row => String(row.id)));
  const pinned = new Set(uniqueIds(input.pinnedIds, 16));
  const usage = input.usage ?? {};
  const merged = new Map<string, SmartChoiceOption>();
  for (const option of [...selected, ...input.eligible]) if (!merged.has(String(option.id))) merged.set(String(option.id), option);
  const ranked = [...merged.values()].sort((a, b) => {
    const aSelected = selectedIds.has(String(a.id)) ? 1 : 0;
    const bSelected = selectedIds.has(String(b.id)) ? 1 : 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    const aPinned = pinned.has(String(a.id)) ? 1 : 0;
    const bPinned = pinned.has(String(b.id)) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aUse = usage[String(a.id)] ?? { count: 0, lastUsedAt: null };
    const bUse = usage[String(b.id)] ?? { count: 0, lastUsedAt: null };
    if (aUse.count !== bUse.count) return bUse.count - aUse.count;
    const recency = String(bUse.lastUsedAt ?? "").localeCompare(String(aUse.lastUsedAt ?? ""));
    return recency || a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id));
  });
  const preferredLimit = Math.max(1, Math.min(12, Number(input.preferredLimit) || 8));
  const preferredIds = new Set(ranked.slice(0, preferredLimit).map(row => String(row.id)));
  for (const id of selectedIds) preferredIds.add(id);
  return { preferred: ranked.filter(row => preferredIds.has(String(row.id))), all: ranked };
}
