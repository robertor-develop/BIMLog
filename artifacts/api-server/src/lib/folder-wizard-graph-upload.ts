import { z } from "zod/v4";
import { timingSafeEqual } from "node:crypto";
import { createRuntimeActiveConnectorCredentialLeaseResolver } from "./connector-credential-lease-resolver";

const itemSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), size: z.number().int().nonnegative(),
  webUrl: z.string().url(), parentReference: z.object({ driveId: z.string().min(1) }).passthrough(),
}).passthrough();
type Lease = Pick<ReturnType<typeof createRuntimeActiveConnectorCredentialLeaseResolver>, "withBearerToken">;

async function boundedBytes(response: Response, maximum: number): Promise<Buffer> {
  if (!response.body) throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel(); }
}

function approvedDownloadUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      !(/\.sharepoint\.(com|us)$/i.test(url.hostname) || /\.files\.1drv\.com$/i.test(url.hostname)))
    throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
  return url.toString();
}

function approvedUploadUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      !(/\.up\.1drv\.com$/i.test(url.hostname) || /\.sharepoint\.(com|us)$/i.test(url.hostname)))
    throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_SESSION_INVALID");
  return url.toString();
}

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
      if (!(token instanceof Uint8Array) || token.byteLength < 16 || token.byteLength > 8_192) {
        if (token instanceof Uint8Array) token.fill(0);
        throw new Error("FOLDER_WIZARD_GRAPH_CREDENTIAL_INVALID");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const session = await this.transport(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${path}:/createUploadSession`, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { authorization: `Bearer ${Buffer.from(token).toString("utf8")}`, "content-type": "application/json" },
          body: JSON.stringify({ item: { name: filename, "@microsoft.graph.conflictBehavior": "fail" } }),
        });
        if (session.status !== 200 && session.status !== 409 && session.status !== 412)
          throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_FAILED");
        let response = session;
        if (session.status === 200) {
          const sessionJson = JSON.parse((await boundedBytes(session, 32_768)).toString("utf8")) as { uploadUrl?: unknown };
          if (typeof sessionJson.uploadUrl !== "string") throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_SESSION_INVALID");
          response = await this.transport(approvedUploadUrl(sessionJson.uploadUrl), {
            method: "PUT", redirect: "error", signal: controller.signal,
            headers: { "content-length": String(bytes.length), "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` },
            body: new Uint8Array(bytes),
          });
        }
        if (response.status === 409 || response.status === 412) {
          // A prior attempt may have uploaded before its acknowledgement was lost.
          // Never overwrite; accept only the exact same drive, name and bytes.
          const metadata = await this.transport(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${path}?$select=id,name,size,webUrl,parentReference`, {
            method: "GET", redirect: "error", signal: controller.signal,
            headers: { authorization: `Bearer ${Buffer.from(token).toString("utf8")}`, accept: "application/json" },
          });
          if (metadata.status !== 200) throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
          const existing = itemSchema.parse(JSON.parse((await boundedBytes(metadata, 32_768)).toString("utf8")));
          const webUrl = new URL(existing.webUrl);
          if (existing.parentReference.driveId !== driveId || existing.name !== filename ||
              existing.size !== bytes.length || webUrl.protocol !== "https:" ||
              !/\.sharepoint\.(com|us)$/i.test(webUrl.hostname))
            throw new Error("FOLDER_WIZARD_GRAPH_FILE_CONFLICT");
          const content = await this.transport(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(existing.id)}/content`, {
            method: "GET", redirect: "manual", signal: controller.signal,
            headers: { authorization: `Bearer ${Buffer.from(token).toString("utf8")}` },
          });
          let download = content;
          if (content.status === 302) {
            const location = content.headers.get("location");
            if (!location) throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
            download = await this.transport(approvedDownloadUrl(location), {
              method: "GET", redirect: "error", signal: controller.signal,
            });
          }
          if (download.status !== 200) throw new Error("FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED");
          const existingBytes = await boundedBytes(download, bytes.length);
          try {
            if (existingBytes.length !== bytes.length || !timingSafeEqual(existingBytes, bytes))
              throw new Error("FOLDER_WIZARD_GRAPH_FILE_CONFLICT");
          } finally { existingBytes.fill(0); }
          return { itemId: existing.id, webUrl: existing.webUrl };
        }
        if (response.status !== 201 && response.status !== 200) throw new Error("FOLDER_WIZARD_GRAPH_UPLOAD_FAILED");
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
  return new FolderWizardGraphUpload(createRuntimeActiveConnectorCredentialLeaseResolver());
}
