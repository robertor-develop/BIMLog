import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);

export const sharePointDiscoveryRequestSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  actorUserId: z.number().int().positive(),
  credentialId: id,
  siteId: id,
  libraryId: id,
  folderId: id.nullable(),
  cursor: id.nullable(),
  pageSize: z.number().int().min(1).max(200),
}).strict();

export const sharePointDiscoveryItemSchema = z.object({
  providerItemId: id,
  providerVersionId: id,
  parentItemId: id.nullable(),
  name: z.string().trim().min(1).max(512),
  kind: z.enum(["folder", "file"]),
  byteSize: z.number().int().nonnegative().nullable(),
  modifiedAt: z.string().datetime({ offset: true }),
  etag: id,
}).strict();

export type SharePointDiscoveryRequest = z.infer<typeof sharePointDiscoveryRequestSchema>;
export type SharePointDiscoveryItem = z.infer<typeof sharePointDiscoveryItemSchema>;

export interface SharePointReadPort {
  discover(input: Pick<SharePointDiscoveryRequest, "credentialId" | "siteId" | "libraryId" | "folderId" | "cursor" | "pageSize">): Promise<{ items: unknown[]; nextCursor: string | null }>;
}

export interface SharePointDiscoveryAuthority {
  assertReadScope(input: Pick<SharePointDiscoveryRequest, "projectId" | "companyId" | "actorUserId" | "credentialId" | "siteId" | "libraryId">): Promise<void>;
}

export class SharePointDiscoveryAdapter {
  constructor(private readonly authority: SharePointDiscoveryAuthority, private readonly provider: SharePointReadPort) {}

  async discover(input: unknown): Promise<{ items: SharePointDiscoveryItem[]; nextCursor: string | null }> {
    const request = sharePointDiscoveryRequestSchema.parse(input);
    await this.authority.assertReadScope(request);
    const page = await this.provider.discover(request);
    return {
      items: z.array(sharePointDiscoveryItemSchema).max(request.pageSize).parse(page.items),
      nextCursor: id.nullable().parse(page.nextCursor),
    };
  }
}
