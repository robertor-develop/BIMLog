import { createHash } from "node:crypto";
import { z } from "zod/v4";

const segment = z.string().min(1).max(160).refine((value) =>
  value === value.trim() && value !== "." && value !== ".." &&
  !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value),
  "Unsafe or altered folder name",
);

const tierSchema = z.object({
  label: segment,
  items: z.array(segment).min(1).max(256),
  mode: z.enum(["none", "numeric", "alpha"]),
  start: z.number().int().min(0).max(999_999),
  width: z.number().int().min(0).max(8),
  sep: z.string().max(8).refine((value) => !/[<>:"/\\|?*\x00-\x1f]/.test(value)),
  case: z.enum(["upper", "lower"]),
}).strict().superRefine((tier, context) => {
  if (new Set(tier.items.map((item) => item.toLocaleLowerCase("en"))).size !== tier.items.length) {
    context.addIssue({ code: "custom", message: "Duplicate tier items" });
  }
});

const blueprintSchema = z.object({
  name: segment,
  include: z.boolean(),
  tiers: z.array(tierSchema).min(1).max(8),
}).strict().superRefine((blueprint, context) => {
  if (new Set(blueprint.tiers.map((tier) => tier.label.toLocaleLowerCase("en"))).size !== blueprint.tiers.length) {
    context.addIssue({ code: "custom", message: "Duplicate tier labels" });
  }
});

export const folderWizardExportSchema = z.object({
  generated_by: z.literal("BT Folder Wizard"),
  version: z.literal("3.1 (BIMLOG export)"),
  destination: z.object({
    sharepoint_url: z.string().max(2_048),
    base_path: z.string().max(2_048),
  }).strict(),
  blueprints: z.array(blueprintSchema).min(1).max(16),
}).strict().superRefine((document, context) => {
  const { sharepoint_url: url, base_path: path } = document.destination;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !/\.sharepoint\.(com|us)$/i.test(parsed.hostname) ||
          parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname === "/") {
        context.addIssue({ code: "custom", path: ["destination", "sharepoint_url"], message: "Invalid project SharePoint site URL" });
      }
    } catch {
      context.addIssue({ code: "custom", path: ["destination", "sharepoint_url"], message: "Invalid project SharePoint site URL" });
    }
  }
  if (path && (path.startsWith("/") || path.endsWith("/") || path.includes("\\") ||
      path.split("/").some((part) => !segment.safeParse(part).success))) {
    context.addIssue({ code: "custom", path: ["destination", "base_path"], message: "Invalid library-relative base path" });
  }
  if (!document.blueprints.some((blueprint) => blueprint.include)) {
    context.addIssue({ code: "custom", path: ["blueprints"], message: "No included blueprint" });
  }
  if (new Set(document.blueprints.map((blueprint) => blueprint.name.toLocaleLowerCase("en"))).size !== document.blueprints.length) {
    context.addIssue({ code: "custom", path: ["blueprints"], message: "Duplicate blueprint names" });
  }
});

export type FolderWizardExport = z.infer<typeof folderWizardExportSchema>;

export function parseFolderWizardExport(sourceText: string): { document: FolderWizardExport; sha256: string } {
  if (Buffer.byteLength(sourceText, "utf8") > 1_048_576) throw new Error("FOLDER_WIZARD_EXPORT_TOO_LARGE");
  let parsed: unknown;
  try { parsed = JSON.parse(sourceText); }
  catch { throw new Error("FOLDER_WIZARD_EXPORT_INVALID_JSON"); }
  const document = folderWizardExportSchema.parse(parsed);
  return { document, sha256: createHash("sha256").update(sourceText, "utf8").digest("hex") };
}
