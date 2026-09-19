import { z } from "zod/v4";

export const coordinationRecordTypes = [
  "issue",
  "rfi",
  "submittal",
  "transmittal",
  "meeting",
  "schedule",
  "change_order",
] as const;

export type CoordinationRecordType = typeof coordinationRecordTypes[number];

export const coordinationRecordIdentitySchema = z.object({
  projectId: z.number().int().positive(),
  type: z.enum(coordinationRecordTypes),
  id: z.number().int().positive(),
  version: z.number().int().nonnegative(),
}).strict();

export type CoordinationRecordIdentity = z.infer<typeof coordinationRecordIdentitySchema>;

const sourceAliases: Readonly<Record<string, CoordinationRecordType>> = {
  clash: "issue",
  lens_viewpoint: "issue",
  issue: "issue",
  rfi: "rfi",
  submittal: "submittal",
  transmittal: "transmittal",
  meeting: "meeting",
  schedule: "schedule",
  schedule_item: "schedule",
  change_order: "change_order",
};

export function canonicalCoordinationType(value: unknown): CoordinationRecordType {
  const normalized = typeof value === "string" ? sourceAliases[value.trim().toLowerCase()] : undefined;
  if (!normalized) throw new Error("Unsupported coordination record type");
  return normalized;
}

export function canonicalCoordinationIdentity(input: unknown): CoordinationRecordIdentity & { key: string } {
  const candidate = input as Record<string, unknown>;
  const identity = coordinationRecordIdentitySchema.parse({
    projectId: candidate?.projectId,
    type: canonicalCoordinationType(candidate?.type),
    id: candidate?.id,
    version: candidate?.version ?? 0,
  });
  return { ...identity, key: `${identity.projectId}:${identity.type}:${identity.id}` };
}

export type CoordinationRecordLink = {
  projectId: number;
  from: CoordinationRecordIdentity;
  to: CoordinationRecordIdentity;
  relation: string;
};

export function reconcileCoordinationLinks(records: readonly CoordinationRecordIdentity[], links: readonly CoordinationRecordLink[]) {
  const canonicalRecords = new Map<string, CoordinationRecordIdentity>();
  for (const record of records) {
    const identity = canonicalCoordinationIdentity(record);
    const existing = canonicalRecords.get(identity.key);
    if (existing && existing.version !== identity.version) {
      throw new Error(`Duplicate coordination state for ${identity.key}`);
    }
    canonicalRecords.set(identity.key, identity);
  }

  const canonicalLinks = new Map<string, CoordinationRecordLink & { fromKey: string; toKey: string }>();
  for (const link of links) {
    const from = canonicalCoordinationIdentity(link.from);
    const to = canonicalCoordinationIdentity(link.to);
    if (from.projectId !== link.projectId || to.projectId !== link.projectId) {
      throw new Error("Coordination links cannot cross project authority");
    }
    if (!canonicalRecords.has(from.key) || !canonicalRecords.has(to.key)) {
      throw new Error("Coordination link references an unknown authoritative record");
    }
    const relation = link.relation.trim();
    if (!relation) throw new Error("Coordination link relation is required");
    const key = `${from.key}->${to.key}:${relation}`;
    if (!canonicalLinks.has(key)) canonicalLinks.set(key, { ...link, from, to, fromKey: from.key, toKey: to.key, relation });
  }

  return { records: [...canonicalRecords.values()], links: [...canonicalLinks.values()] };
}
