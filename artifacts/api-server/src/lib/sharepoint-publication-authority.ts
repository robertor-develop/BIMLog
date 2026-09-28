export type PublicationAuthority = { companyId: number; projectId: number; actorCompanyId: number; actorProjectIds: readonly number[]; canPublish: boolean };
export function requireSharePointPublicationAuthority(input: PublicationAuthority): void {
  if (!Number.isSafeInteger(input.companyId) || !Number.isSafeInteger(input.projectId) || input.companyId !== input.actorCompanyId || !input.actorProjectIds.includes(input.projectId) || !input.canPublish)
    throw new Error("FOLDER_WIZARD_PUBLISH_FORBIDDEN");
}
