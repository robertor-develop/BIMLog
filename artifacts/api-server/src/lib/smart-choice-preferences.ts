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
