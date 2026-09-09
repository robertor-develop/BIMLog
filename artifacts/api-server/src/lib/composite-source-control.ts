import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const compositeSourceManifestSchema = z.object({
  id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  revisionNumber: z.number().int().positive(),
  components: z.array(z.object({
    discipline: z.string().trim().min(1).max(128),
    coordinationFileId: id,
    revisionId: id,
    contentSha256: digest,
    observedCurrentRevisionId: id,
  }).strict()).min(1).max(500),
}).strict().superRefine((value, context) => {
  const disciplines = value.components.map((component) => component.discipline.toLowerCase());
  if (new Set(disciplines).size !== disciplines.length) context.addIssue({ code: "custom", path: ["components"], message: "Composite disciplines must be unique" });
});

export type CompositeSourceManifest = z.infer<typeof compositeSourceManifestSchema>;

export function verifyCompositeSourceManifest(input: unknown): { status: "ready"; manifest: CompositeSourceManifest } | { status: "blocked"; staleDisciplines: string[] } {
  const manifest = compositeSourceManifestSchema.parse(input);
  const staleDisciplines = manifest.components.filter((component) => component.revisionId !== component.observedCurrentRevisionId).map((component) => component.discipline);
  if (staleDisciplines.length > 0) return { status: "blocked", staleDisciplines };
  return { status: "ready", manifest };
}
