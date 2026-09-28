export type FieldChecklistState = "draft" | "approved" | "retired";

export interface FieldChecklistItemDefinition {
  itemId: string;
  prompt: string;
  evidenceRequired: boolean;
}

export interface FieldChecklistDefinition {
  templateId: string;
  projectId: number;
  version: number;
  state: FieldChecklistState;
  title: string;
  purpose: "limited_inspection" | "punch";
  items: readonly FieldChecklistItemDefinition[];
  statutoryCertification: false;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface FrozenChecklistSnapshot {
  templateId: string;
  projectId: number;
  version: number;
  title: string;
  purpose: FieldChecklistDefinition["purpose"];
  items: readonly FieldChecklistItemDefinition[];
  statutoryCertification: false;
}

function text(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function defineFieldChecklist(input: Omit<FieldChecklistDefinition, "state" | "statutoryCertification" | "approvedBy" | "approvedAt">): FieldChecklistDefinition {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  if (!Number.isSafeInteger(input.version) || input.version <= 0) throw new Error("A positive checklist version is required.");
  if (!input.items.length) throw new Error("At least one checklist item is required.");
  const itemIds = new Set<string>();
  const items = input.items.map(item => {
    const itemId = text(item.itemId, "Checklist item identity");
    if (itemIds.has(itemId)) throw new Error("Checklist item identities must be unique within a version.");
    itemIds.add(itemId);
    return Object.freeze({ itemId, prompt: text(item.prompt, "Checklist prompt"), evidenceRequired: item.evidenceRequired });
  });
  return { ...input, templateId: text(input.templateId, "Checklist identity"), title: text(input.title, "Checklist title"), items: Object.freeze(items), state: "draft", statutoryCertification: false, approvedBy: null, approvedAt: null };
}

export function approveFieldChecklist(definition: FieldChecklistDefinition, input: { approvedBy: string; approvedAt: string }): FieldChecklistDefinition {
  if (definition.state !== "draft") throw new Error("Only a draft checklist can be approved.");
  if (Number.isNaN(Date.parse(input.approvedAt))) throw new Error("A valid approval time is required.");
  return Object.freeze({ ...definition, items: Object.freeze(definition.items.map(item => Object.freeze({ ...item }))), state: "approved", approvedBy: text(input.approvedBy, "Checklist approver"), approvedAt: input.approvedAt });
}

export function freezeChecklistForInspection(definition: FieldChecklistDefinition): FrozenChecklistSnapshot {
  if (definition.state !== "approved") throw new Error("Only an approved checklist version can be used.");
  return Object.freeze({ templateId: definition.templateId, projectId: definition.projectId, version: definition.version, title: definition.title, purpose: definition.purpose, items: Object.freeze(definition.items.map(item => Object.freeze({ ...item }))), statutoryCertification: false });
}
