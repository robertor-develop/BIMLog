export function mergeMappedContractItems(input: {
  existingItems: any[];
  mappedRows: any[];
  candidatePlans: Array<{ version: number; content: { currency?: string; sellingPrice?: string } }>;
  currency: string;
  workflowTemplate: string;
  defaultContractId: string;
}) {
  const solePlan = input.candidatePlans.length === 1 &&
    input.candidatePlans[0]?.content?.currency === input.currency
      ? input.candidatePlans[0]
      : null;
  const existingById = new Map(input.existingItems.map(item => [item.id, item]));
  for (const mapped of input.mappedRows) {
    const existing = existingById.get(String(mapped.id));
    existingById.set(String(mapped.id), {
      ...(existing ?? {
        id: mapped.id,
        description: "",
        // A saved Generic APU selling price is a plan total, never an item unit rate.
        billingHourlyRate: "0",
        contractValue: "0",
        unit: "Hours",
        apuPlanVersion: solePlan ? Number(solePlan.version) : null,
        budgetSnapshotLineId: "",
        projectCostNodeId: "",
        scheduleItemPlacementId: null,
        assumptions: "",
        exclusions: "",
        workflowTemplate: input.workflowTemplate,
        contractId: input.defaultContractId,
        responsibleParticipantId: "",
        workPackages: [],
      }),
      name: mapped.name,
      plannedHours: mapped.quantity,
      provenance: mapped.provenance,
    });
  }
  return [...existingById.values()];
}
