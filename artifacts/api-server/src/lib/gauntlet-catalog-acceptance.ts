import { createHash } from "node:crypto";

export const GAUNTLET_CATALOG_KINDS = Object.freeze([
  "client", "company", "document_type", "discipline", "location", "level", "zone", "system",
  "status", "role", "workflow", "delivery", "apu_library",
] as const);
export type GauntletCatalogKind = typeof GAUNTLET_CATALOG_KINDS[number];
export type GauntletCatalogValue = { kind: GauntletCatalogKind; companyId: number; code: string; label: string; active: boolean };

const REQUIRED_CONSUMERS: Readonly<Record<GauntletCatalogKind, readonly string[]>> = Object.freeze({
  client: ["job_intake", "directory"], company: ["directory", "rfi", "submittal"],
  document_type: ["files", "reports"], discipline: ["job_intake", "files", "schedule"],
  location: ["job_intake", "files", "schedule"], level: ["job_intake", "files", "schedule"],
  zone: ["files", "schedule"], system: ["files", "schedule"], status: ["workflow", "reports"],
  role: ["team", "workflow"], workflow: ["job_intake", "operations"],
  delivery: ["job_intake", "operations"], apu_library: ["job_intake", "commercial"],
});

export function inspectGauntletCatalogs(input: {
  companyId: number;
  values: readonly GauntletCatalogValue[];
  consumers: Readonly<Partial<Record<GauntletCatalogKind, readonly string[]>>>;
}) {
  if (!Number.isSafeInteger(input.companyId) || input.companyId <= 0) throw new Error("GAUNTLET_CATALOG_COMPANY_INVALID");
  const values = input.values.map(value => ({ ...value, code: value.code.trim(), label: value.label.trim() }));
  if (values.some(value => value.companyId !== input.companyId)) throw new Error("GAUNTLET_CATALOG_COMPANY_LEAK");
  if (values.some(value => !value.code || !value.label)) throw new Error("GAUNTLET_CATALOG_VALUE_INVALID");
  const identities = values.map(value => `${value.kind}:${value.code.toLocaleLowerCase("en-US")}`);
  if (new Set(identities).size !== identities.length) throw new Error("GAUNTLET_CATALOG_DUPLICATE");
  const missingKinds = GAUNTLET_CATALOG_KINDS.filter(kind => !values.some(value => value.kind === kind && value.active));
  const missingConsumers = GAUNTLET_CATALOG_KINDS.flatMap(kind => REQUIRED_CONSUMERS[kind]
    .filter(consumer => !(input.consumers[kind] ?? []).includes(consumer)).map(consumer => `${kind}:${consumer}`));
  const canonical = { companyId: input.companyId, values: [...values].sort((a, b) => `${a.kind}:${a.code}`.localeCompare(`${b.kind}:${b.code}`)) };
  return Object.freeze({
    ready: missingKinds.length === 0 && missingConsumers.length === 0,
    missingKinds,
    missingConsumers,
    fingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  });
}
