import { z } from "zod/v4";
import { createRuntimeConnectorCredentialLeaseResolver } from "./connector-credential-lease-resolver";

const graph = "https://graph.microsoft.com/v1.0";
const siteSchema = z.object({ id: z.string().min(1), webUrl: z.string().url() }).passthrough();
const driveSchema = z.object({ id: z.string().min(1), webUrl: z.string().url(), driveType: z.literal("documentLibrary") }).passthrough();

type LeaseResolver = Pick<ReturnType<typeof createRuntimeConnectorCredentialLeaseResolver>, "withBearerToken">;
type Transport = typeof fetch;

async function boundedJson(response: Response): Promise<unknown> {
  if (response.status !== 200 || !response.body) throw new Error("FOLDER_WIZARD_GRAPH_IDENTITY_UNAVAILABLE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 32_768) throw new Error("FOLDER_WIZARD_GRAPH_IDENTITY_TOO_LARGE");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Verify the mapped site and document library through fixed Microsoft Graph reads. */
export class FolderWizardGraphIdentity {
  constructor(private readonly lease: LeaseResolver, private readonly transport: Transport = fetch) {}

  async verify(input: { companyId: number; credentialId: string; siteId: string; libraryId: string }): Promise<{ siteUrl: string; libraryId: string }> {
    if (!Number.isSafeInteger(input.companyId) || input.companyId <= 0 ||
        !input.credentialId || !input.siteId || !input.libraryId ||
        [input.siteId, input.libraryId].some((value) => value.length > 1_024 || /[\x00-\x1f]/.test(value))) {
      throw new Error("FOLDER_WIZARD_GRAPH_IDENTITY_INVALID");
    }
    return this.lease.withBearerToken({ credentialId: input.credentialId, companyId: input.companyId, provider: "sharepoint" }, async (token) => {
      if (!(token instanceof Uint8Array) || token.byteLength < 16 || token.byteLength > 8_192) {
        if (token instanceof Uint8Array) token.fill(0);
        throw new Error("FOLDER_WIZARD_GRAPH_CREDENTIAL_INVALID");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const authorization = `Bearer ${Buffer.from(token).toString("utf8")}`;
        const read = async (path: string) => boundedJson(await this.transport(`${graph}${path}`, {
          method: "GET", redirect: "error", signal: controller.signal,
          headers: { authorization, accept: "application/json" },
        }));
        const site = siteSchema.parse(await read(`/sites/${encodeURIComponent(input.siteId)}?$select=id,webUrl`));
        const drive = driveSchema.parse(await read(`/drives/${encodeURIComponent(input.libraryId)}?$select=id,webUrl,driveType`));
        if (site.id !== input.siteId || drive.id !== input.libraryId) throw new Error("FOLDER_WIZARD_GRAPH_IDENTITY_MISMATCH");
        const siteUrl = new URL(site.webUrl);
        const driveUrl = new URL(drive.webUrl);
        if (siteUrl.protocol !== "https:" || !/\.sharepoint\.(com|us)$/i.test(siteUrl.hostname) ||
            driveUrl.origin !== siteUrl.origin || !driveUrl.pathname.toLowerCase().startsWith(`${siteUrl.pathname.replace(/\/$/, "").toLowerCase()}/`)) {
          throw new Error("FOLDER_WIZARD_GRAPH_LIBRARY_MISMATCH");
        }
        return { siteUrl: site.webUrl, libraryId: drive.id };
      } finally { clearTimeout(timeout); token.fill(0); }
    });
  }
}

export function createRuntimeFolderWizardGraphIdentity(): FolderWizardGraphIdentity {
  return new FolderWizardGraphIdentity(createRuntimeConnectorCredentialLeaseResolver());
}
