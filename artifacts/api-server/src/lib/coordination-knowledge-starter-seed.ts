import { createHash } from "node:crypto";

export const STARTER_SEED_SCHEMA_VERSION = 1 as const;
export const starterTaxonomyKinds = ["discipline", "category", "element_type", "stage", "tag"] as const;
export type StarterTaxonomyKind = typeof starterTaxonomyKinds[number];

export type StarterConflictType = Readonly<{
  code: string;
  name: string;
  description: string;
  disciplineA: string;
  disciplineB: string;
  elementTypeA: string;
  elementTypeB: string;
  conflictCategory: string;
  coordinationStage: string;
  tags: readonly string[];
}>;

export type StarterRule = Readonly<{
  code: string;
  title: string;
  guidance: string;
  rationale: string;
  conflictTypeCodes: readonly string[];
  exceptions: readonly string[];
}>;

export type StarterResolutionMethod = Readonly<{
  code: string;
  name: string;
  description: string;
  conflictTypeCodes: readonly string[];
  ruleCodes: readonly string[];
  responsibleTrade: string | null;
  constraints: readonly string[];
  advantages: readonly string[];
  disadvantages: readonly string[];
  requiredApprovals: readonly string[];
  rfiRequirement: "never" | "conditional" | "required";
}>;

export type CoordinationStarterSeed = Readonly<{
  schemaVersion: typeof STARTER_SEED_SCHEMA_VERSION;
  seedKey: string;
  displayName: string;
  provenance: Readonly<{
    source: string;
    preparedFor: string;
    preparedAt: string;
    synthetic: true;
    professionalApproval: "not_reviewed";
  }>;
  conflictTypes: readonly StarterConflictType[];
  rules: readonly StarterRule[];
  resolutionMethods: readonly StarterResolutionMethod[];
}>;

export class CoordinationStarterSeedError extends Error {
  constructor(public readonly code: string, public readonly field: string) {
    super(`${code}: ${field}`);
  }
}

const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const forbiddenKeys = new Set(["companyId", "projectId", "customerId", "projectName", "customerName", "clientName"]);

function fail(field: string, code = "STARTER_SEED_INVALID"): never {
  throw new CoordinationStarterSeedError(code, field);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(field);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 4000): string {
  if (typeof value !== "string") fail(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) fail(field);
  return normalized;
}

function optionalText(value: unknown, field: string, max = 4000): string | null {
  if (value === null) return null;
  return text(value, field, max);
}

function code(value: unknown, field: string): string {
  const normalized = text(value, field, 64).toUpperCase();
  if (!codePattern.test(normalized)) fail(field);
  return normalized;
}

function stringList(value: unknown, field: string, maxItems = 50): string[] {
  if (!Array.isArray(value) || value.length > maxItems) fail(field);
  const normalized = value.map((item, index) => text(item, `${field}[${index}]`, 240));
  if (new Set(normalized.map(item => item.toLocaleLowerCase("en-US"))).size !== normalized.length) fail(field, "STARTER_SEED_DUPLICATE_VALUE");
  return normalized;
}

function codeList(value: unknown, field: string): string[] {
  const normalized = stringList(value, field).map((item, index) => code(item, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) fail(field, "STARTER_SEED_DUPLICATE_VALUE");
  return normalized;
}

function rejectScopedData(value: unknown, path = "seed"): void {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectScopedData(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) fail(`${path}.${key}`, "STARTER_SEED_PROJECT_DATA_FORBIDDEN");
    rejectScopedData(child, `${path}.${key}`);
  }
}

function uniqueCodes(items: readonly { code: string }[], field: string): void {
  const codes = items.map(item => item.code);
  if (new Set(codes).size !== codes.length) fail(field, "STARTER_SEED_DUPLICATE_CODE");
}

export function validateCoordinationStarterSeed(value: unknown): CoordinationStarterSeed {
  rejectScopedData(value);
  const input = record(value, "seed");
  if (input.schemaVersion !== STARTER_SEED_SCHEMA_VERSION) fail("schemaVersion");
  const provenance = record(input.provenance, "provenance");
  if (provenance.synthetic !== true || provenance.professionalApproval !== "not_reviewed") fail("provenance");

  if (!Array.isArray(input.conflictTypes) || !Array.isArray(input.rules) || !Array.isArray(input.resolutionMethods)) fail("collections");
  const conflictTypes = input.conflictTypes.map((raw, index) => {
    const item = record(raw, `conflictTypes[${index}]`);
    return Object.freeze({
      code: code(item.code, `conflictTypes[${index}].code`),
      name: text(item.name, `conflictTypes[${index}].name`, 240),
      description: text(item.description, `conflictTypes[${index}].description`),
      disciplineA: text(item.disciplineA, `conflictTypes[${index}].disciplineA`, 120),
      disciplineB: text(item.disciplineB, `conflictTypes[${index}].disciplineB`, 120),
      elementTypeA: text(item.elementTypeA, `conflictTypes[${index}].elementTypeA`, 120),
      elementTypeB: text(item.elementTypeB, `conflictTypes[${index}].elementTypeB`, 120),
      conflictCategory: text(item.conflictCategory, `conflictTypes[${index}].conflictCategory`, 120),
      coordinationStage: text(item.coordinationStage, `conflictTypes[${index}].coordinationStage`, 120),
      tags: Object.freeze(stringList(item.tags, `conflictTypes[${index}].tags`, 25)),
    });
  });
  const rules = input.rules.map((raw, index) => {
    const item = record(raw, `rules[${index}]`);
    return Object.freeze({
      code: code(item.code, `rules[${index}].code`),
      title: text(item.title, `rules[${index}].title`, 240),
      guidance: text(item.guidance, `rules[${index}].guidance`),
      rationale: text(item.rationale, `rules[${index}].rationale`),
      conflictTypeCodes: Object.freeze(codeList(item.conflictTypeCodes, `rules[${index}].conflictTypeCodes`)),
      exceptions: Object.freeze(stringList(item.exceptions, `rules[${index}].exceptions`, 25)),
    });
  });
  const resolutionMethods = input.resolutionMethods.map((raw, index) => {
    const item = record(raw, `resolutionMethods[${index}]`);
    const rfiRequirement = item.rfiRequirement;
    if (rfiRequirement !== "never" && rfiRequirement !== "conditional" && rfiRequirement !== "required") fail(`resolutionMethods[${index}].rfiRequirement`);
    return Object.freeze({
      code: code(item.code, `resolutionMethods[${index}].code`),
      name: text(item.name, `resolutionMethods[${index}].name`, 240),
      description: text(item.description, `resolutionMethods[${index}].description`),
      conflictTypeCodes: Object.freeze(codeList(item.conflictTypeCodes, `resolutionMethods[${index}].conflictTypeCodes`)),
      ruleCodes: Object.freeze(codeList(item.ruleCodes, `resolutionMethods[${index}].ruleCodes`)),
      responsibleTrade: optionalText(item.responsibleTrade, `resolutionMethods[${index}].responsibleTrade`, 120),
      constraints: Object.freeze(stringList(item.constraints, `resolutionMethods[${index}].constraints`, 25)),
      advantages: Object.freeze(stringList(item.advantages, `resolutionMethods[${index}].advantages`, 25)),
      disadvantages: Object.freeze(stringList(item.disadvantages, `resolutionMethods[${index}].disadvantages`, 25)),
      requiredApprovals: Object.freeze(stringList(item.requiredApprovals, `resolutionMethods[${index}].requiredApprovals`, 25)),
      rfiRequirement,
    });
  });

  uniqueCodes(conflictTypes, "conflictTypes");
  uniqueCodes(rules, "rules");
  uniqueCodes(resolutionMethods, "resolutionMethods");
  const conflictCodes = new Set(conflictTypes.map(item => item.code));
  const ruleCodes = new Set(rules.map(item => item.code));
  for (const [index, item] of rules.entries()) for (const linked of item.conflictTypeCodes) if (!conflictCodes.has(linked)) fail(`rules[${index}].conflictTypeCodes`, "STARTER_SEED_REFERENCE_UNKNOWN");
  for (const [index, item] of resolutionMethods.entries()) {
    for (const linked of item.conflictTypeCodes) if (!conflictCodes.has(linked)) fail(`resolutionMethods[${index}].conflictTypeCodes`, "STARTER_SEED_REFERENCE_UNKNOWN");
    for (const linked of item.ruleCodes) if (!ruleCodes.has(linked)) fail(`resolutionMethods[${index}].ruleCodes`, "STARTER_SEED_REFERENCE_UNKNOWN");
  }

  return Object.freeze({
    schemaVersion: STARTER_SEED_SCHEMA_VERSION,
    seedKey: code(input.seedKey, "seedKey"),
    displayName: text(input.displayName, "displayName", 240),
    provenance: Object.freeze({
      source: text(provenance.source, "provenance.source", 500),
      preparedFor: text(provenance.preparedFor, "provenance.preparedFor", 240),
      preparedAt: text(provenance.preparedAt, "provenance.preparedAt", 40),
      synthetic: true,
      professionalApproval: "not_reviewed",
    }),
    conflictTypes: Object.freeze(conflictTypes),
    rules: Object.freeze(rules),
    resolutionMethods: Object.freeze(resolutionMethods),
  });
}

export function starterSeedFingerprint(seed: CoordinationStarterSeed): string {
  return createHash("sha256").update(JSON.stringify(seed)).digest("hex");
}

export function deterministicStarterId(seedKey: string, entityType: string, codeValue: string): string {
  const hex = createHash("sha256").update(`${seedKey}:${entityType}:${codeValue}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = (["8", "9", "a", "b"] as const)[Number.parseInt(hex[16] ?? "0", 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
