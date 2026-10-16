export const deliveryWorkflowDefaults: Record<string, { submittalStrategy: string; milestoneSummary: string }> = {
  "bim-submittal": {
    submittalStrategy: "Prepare shop drawing, internal QA, submit for review, resolve comments, and issue the approved revision.",
    milestoneSummary: "Draft complete → internal QA → submitted → reviewed → approved → distributed",
  },
  "coordination-delivery": {
    submittalStrategy: "Coordinate models by discipline, resolve clashes, record decisions, and issue the coordinated package.",
    milestoneSummary: "Model received → coordination review → clashes resolved → coordinated issue → distributed",
  },
  "document-control": {
    submittalStrategy: "Register the document, verify metadata, route the controlled review, and distribute the accepted revision.",
    milestoneSummary: "Registered → checked → routed → accepted → controlled distribution",
  },
};

export function selectDeliveryWorkflow(current: any, workflowTemplate: string) {
  const next = deliveryWorkflowDefaults[workflowTemplate];
  if (!next) return { ...current, workflowTemplate };
  const previous = deliveryWorkflowDefaults[current?.workflowTemplate];
  const replaceStrategy = !String(current?.submittalStrategy ?? "").trim() || current.submittalStrategy === previous?.submittalStrategy;
  const replaceMilestones = !String(current?.milestoneSummary ?? "").trim() || current.milestoneSummary === previous?.milestoneSummary;
  return {
    ...current,
    workflowTemplate,
    submittalStrategy: replaceStrategy ? next.submittalStrategy : current.submittalStrategy,
    milestoneSummary: replaceMilestones ? next.milestoneSummary : current.milestoneSummary,
  };
}
