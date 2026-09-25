import { z } from "zod/v4";
import { createRuntimeConnectorCredentialLeaseResolver } from "./connector-credential-lease-resolver";

const itemSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), size: z.number().int().nonnegative(),
  webUrl: z.string().url(), parentReference: z.object({ driveId: z.string().min(1) }).passthrough(),
}).passthrough();
type Lease = Pick<ReturnType<typeof createRuntimeConnectorCredentialLeaseResolver>, "withBearerToken">;

/** A create-only Graph write. Never follows a provider redirect or overwrites an existing item. */
export class FolderWizardGraphUpload {
  constructor(private readonly lease: Lease, private readonly transport: typeof fetch = fetch) {}

  async create(input: { companyId: number; credentialId: string; driveId: string; driveRelativePath: string;
    filename: string; bytes: Buffer }): Promise<{ itemId: string; webUrl: string }> {
    const { companyId, credentialId, driveId, driveRelativePath, filename, bytes } = input;
    if (!Number.isSafeInteger(companyId) || companyId <= 0 || !credentialId || !driveId ||
        !Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 10 * 1024 * 1024 ||
        !driveRelativePath || driveRelativePath.startsWith("/") || driveRelativePath.endsWith("/") ||
        driveRelativePath.split("/").some((part) => !part || part === "." || part === ".." || /[\\\x00-\x1f]/.test(part)) ||
        filename !== driveRelativePath.split("/").at(-1) || [credentialId, driveId].some((value) => value.length > 1_024 || /[\x00-\x1f]/.test(value)))
      throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_INVALID");
    const path = driveRelativePath.split("/").map(encodeURIComponent).join("/");
    return this.lease.withBearerToken({ credentialId, companyId, provider: "sharepoint" }, async (token) => {
      if (!(token instanceof Uint8Array) || token.byteLength < 16 || token.byteLength > 8_192)
        throw new Error("FOLDER_WIZARD_GRAPH_CREDENTIAL_INVALID");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await this.transport(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${path}:/content`, {
          method: "PUT", redirect: "error", signal: controller.signal,
          headers: { authorization: `Bearer ${Buffer.from(token).toString("utf8")}`,
            "content-type": "application/octet-stream", "if-none-match": "*" },
          body: new Uint8Array(bytes),
        });
        if (response.status === 409 || response.status === 412) throw new Error("FOLDER_WIZARD_GRAPH_FILE_EXISTS");
        if (response.status !== 201) throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_FAILED");
        const body = await response.text();
        if (body.length > 32_768) throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_RESPONSE_LARGE");
        const item = itemSchema.parse(JSON.parse(body));
        if (item.parentReference.driveId !== driveId || item.name !== filename || item.size !== bytes.length ||
            new URL(item.webUrl).protocol !== "https:" || !/\.sharepoint\.(com|us)$/i.test(new URL(item.webUrl).hostname))
          throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_IDENTITY_MISMATCH");
        return { itemId: item.id, webUrl: item.webUrl };
      } finally { clearTimeout(timeout); token.fill(0); }
    });
  }
}

export function createRuntimeFolderWizardGraphUpload(): FolderWizardGraphUpload {
  return new FolderWizardGraphUpload(createRuntimeConnectorCredentialLeaseResolver());
}
