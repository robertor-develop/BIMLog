export const JOB_PARTICIPANT_ROLES = [
  "owner",
  "general_contractor",
  "customer",
  "service_provider",
  "trade_contractor",
  "consultant",
  "vendor",
  "other",
] as const;

export const COMMERCIAL_DOCUMENT_TYPES = [
  "quote",
  "base_contract",
  "change_order",
  "additional_work",
  "amendment",
  "time_and_material",
  "internal_budget",
] as const;

export const COMMERCIAL_DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "under_review",
  "approved",
  "in_progress",
  "on_hold",
  "completed",
  "closed",
  "rejected",
  "cancelled",
] as const;

export const APU_ESTIMATE_METHODS = [
  "hours_rate",
  "fixed_amount",
  "floor_area",
  "task_deliverable",
  "detailed_apu",
  "decide_later",
] as const;

export const RECOMMENDED_RATE_DEFAULTS = Object.freeze({
  drafting: Object.freeze({ amount: "35.47", currency: "USD", source: "portfolio_default" }),
  bim_coordinator: Object.freeze({ amount: "37.99", currency: "USD", source: "portfolio_default" }),
});

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown, name: string, max = 240) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${name.toUpperCase()}_REQUIRED`);
  if (normalized.length > max) throw new Error(`${name.toUpperCase()}_TOO_LONG`);
  return normalized;
};
const optionalText = (value: unknown, max = 240) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > max) throw new Error("INTAKE_APU_TEXT_TOO_LONG");
  return normalized || null;
};
const unique = <T>(values: T[]) => [...new Set(values)];

export function normalizeIntakeApuFoundation(value: unknown) {
  const source = record(value);
  const participantIds = new Set<string>();
  const participants = list(source.participants).map((entry, index) => {
    const item = record(entry);
    const id = text(item.id, `participant_${index}_id`, 100);
    if (participantIds.has(id)) throw new Error("PARTICIPANT_ID_DUPLICATE");
    participantIds.add(id);
    const roles = unique(list(item.roles).map((role) => String(role)));
    if (!roles.length || roles.some((role) => !JOB_PARTICIPANT_ROLES.includes(role as never)))
      throw new Error("PARTICIPANT_ROLE_INVALID");
    return {
      id,
      companyId: item.companyId == null ? null : Number(item.companyId),
      companyName: text(item.companyName, `participant_${index}_company_name`),
      roles,
      contactId: item.contactId == null ? null : Number(item.contactId),
    };
  });

  const engagementIds = new Set<string>();
  const engagements = list(source.engagements).map((entry, index) => {
    const item = record(entry);
    const id = text(item.id, `engagement_${index}_id`, 100);
    if (engagementIds.has(id)) throw new Error("ENGAGEMENT_ID_DUPLICATE");
    engagementIds.add(id);
    const providerParticipantId = text(item.providerParticipantId, "provider_participant_id", 100);
    const customerParticipantId = text(item.customerParticipantId, "customer_participant_id", 100);
    if (!participantIds.has(providerParticipantId) || !participantIds.has(customerParticipantId))
      throw new Error("ENGAGEMENT_PARTICIPANT_UNKNOWN");
    if (providerParticipantId === customerParticipantId) throw new Error("ENGAGEMENT_PARTIES_MUST_DIFFER");
    return { id, providerParticipantId, customerParticipantId, contactId: item.contactId == null ? null : Number(item.contactId) };
  });

  const contractIds = new Set<string>();
  const contracts = list(source.contracts).map((entry, index) => {
    const item = record(entry);
    const id = text(item.id, `contract_${index}_id`, 100);
    if (contractIds.has(id)) throw new Error("CONTRACT_ID_DUPLICATE");
    contractIds.add(id);
    const engagementId = text(item.engagementId, "contract_engagement_id", 100);
    if (!engagementIds.has(engagementId)) throw new Error("CONTRACT_ENGAGEMENT_UNKNOWN");
    const type = String(item.type || "base_contract");
    const status = String(item.status || "draft");
    if (!COMMERCIAL_DOCUMENT_TYPES.includes(type as never)) throw new Error("CONTRACT_TYPE_INVALID");
    if (!COMMERCIAL_DOCUMENT_STATUSES.includes(status as never)) throw new Error("CONTRACT_STATUS_INVALID");
    return {
      id,
      engagementId,
      title: text(item.title, `contract_${index}_title`),
      type,
      status,
      parentContractId: optionalText(item.parentContractId, 100),
      currency: optionalText(item.currency, 3) || "USD",
    };
  });
  for (const contract of contracts) {
    if (contract.parentContractId && !contractIds.has(contract.parentContractId))
      throw new Error("PARENT_CONTRACT_UNKNOWN");
    if (["change_order", "additional_work", "amendment"].includes(contract.type) && !contract.parentContractId)
      throw new Error("PARENT_CONTRACT_REQUIRED");
  }

  const apuIds = new Set<string>();
  const apus = list(source.apus).map((entry, index) => {
    const item = record(entry);
    const id = text(item.id, `apu_${index}_id`, 100);
    if (apuIds.has(id)) throw new Error("APU_ID_DUPLICATE");
    apuIds.add(id);
    const contractId = text(item.contractId, "apu_contract_id", 100);
    if (!contractIds.has(contractId)) throw new Error("APU_CONTRACT_UNKNOWN");
    const estimateMethod = String(item.estimateMethod || "decide_later");
    if (!APU_ESTIMATE_METHODS.includes(estimateMethod as never)) throw new Error("APU_ESTIMATE_METHOD_INVALID");
    return {
      id,
      contractId,
      title: text(item.title, `apu_${index}_title`),
      serviceKey: text(item.serviceKey, `apu_${index}_service_key`, 100),
      estimateMethod,
      version: Number.isSafeInteger(Number(item.version)) && Number(item.version) > 0 ? Number(item.version) : 1,
      rate: optionalText(item.rate, 40),
      rateSource: optionalText(item.rateSource, 100),
    };
  });

  const workPackages = list(source.workPackages).map((entry, index) => {
    const item = record(entry);
    const apuId = text(item.apuId, "work_package_apu_id", 100);
    if (!apuIds.has(apuId)) throw new Error("WORK_PACKAGE_APU_UNKNOWN");
    return {
      id: text(item.id, `work_package_${index}_id`, 100),
      apuId,
      title: text(item.title, `work_package_${index}_title`),
      floor: optionalText(item.floor, 100),
      zone: optionalText(item.zone, 100),
      task: optionalText(item.task, 200),
      deliverable: optionalText(item.deliverable, 200),
    };
  });

  return { participants, engagements, contracts, apus, workPackages } as const;
}

export function summarizeIntakeApuFoundation(value: ReturnType<typeof normalizeIntakeApuFoundation>) {
  return {
    participatingCompanies: value.participants.length,
    customerRelationships: value.engagements.length,
    contracts: value.contracts.length,
    apus: value.apus.length,
    workPackages: value.workPackages.length,
    apusByContract: Object.fromEntries(
      value.contracts.map((contract) => [contract.id, value.apus.filter((apu) => apu.contractId === contract.id).length]),
    ),
  };
}
