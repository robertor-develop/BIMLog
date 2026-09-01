export function summarizeJobCommandCenter(data: any, documents: any[] = []) {
  const participants = data?.relationships?.participants ?? [], engagements = data?.relationships?.engagements ?? [], contracts = data?.commercial?.contracts ?? [], apus = data?.apuDrafts ?? [], packages = data?.workPackages ?? [], resources = data?.resourcePlans ?? [];
  const activeDocuments = documents.filter((document) => !document.removedAt);
  const attention: string[] = [];
  if (!data?.identity?.jobName || !data?.identity?.jobCode) attention.push("JOB_IDENTITY_INCOMPLETE");
  if (!participants.length || !engagements.length) attention.push("COMPANY_MAP_INCOMPLETE");
  if (contracts.some((contract: any) => engagements.length && !contract.engagementId)) attention.push("AGREEMENT_RELATIONSHIP_MISSING");
  if (contracts.length && contracts.some((contract: any) => !apus.some((apu: any) => apu.contractId === contract.id))) attention.push("AGREEMENT_APU_MISSING");
  if (apus.length && apus.some((apu: any) => !packages.some((pack: any) => pack.apuDraftId === apu.id))) attention.push("APU_PACKAGE_MISSING");
  if (packages.length && packages.some((pack: any) => !resources.some((resource: any) => resource.workPackageId === pack.id))) attention.push("PACKAGE_RESOURCE_MISSING");
  if (resources.some((row: any) => !row.personName && !row.userId && !row.role)) attention.push("RESOURCE_OWNER_MISSING");
  const plannedHours = resources.reduce((sum: number, row: any) => sum + Number(row.plannedHours || 0), 0);
  const plannedInternalCost = resources.reduce((sum: number, row: any) => sum + Number(row.plannedHours || 0) * Number(row.internalHourlyRate || 0), 0);
  return { counts: { companies: participants.length, relationships: engagements.length, agreements: contracts.length, apus: apus.length, packages: packages.length, resources: resources.length, documents: activeDocuments.length }, plannedHours: plannedHours.toFixed(2), plannedInternalCost: plannedInternalCost.toFixed(2), attention, ready: attention.length === 0 };
}
