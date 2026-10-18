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

export function deliveryGuidanceStatus(item: any) {
  const strategyGenerated = !!item?.deliveryWorkflowGeneratedStrategy && item.submittalStrategy === item.deliveryWorkflowGeneratedStrategy;
  const milestonesGenerated = !!item?.deliveryWorkflowGeneratedMilestones && item.milestoneSummary === item.deliveryWorkflowGeneratedMilestones;
  return { strategyGenerated, milestonesGenerated, generated: strategyGenerated && milestonesGenerated };
}

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

type WorkflowDefinition = {
  phases: Array<{ name: string; tasks: Array<{ name?: string }> }>;
};

export function selectPublishedDeliveryWorkflow(current: any, option: { versionId: string; definition: WorkflowDefinition } | null) {
  const priorStrategy = String(current?.deliveryWorkflowGeneratedStrategy ?? "");
  const priorMilestones = String(current?.deliveryWorkflowGeneratedMilestones ?? "");
  const strategyIsGenerated = !!priorStrategy && current?.submittalStrategy === priorStrategy;
  const milestonesAreGenerated = !!priorMilestones && current?.milestoneSummary === priorMilestones;
  if (!option) return {
    ...current,
    deliveryWorkflowVersionId: "",
    submittalStrategy: strategyIsGenerated ? "" : current?.submittalStrategy,
    milestoneSummary: milestonesAreGenerated ? "" : current?.milestoneSummary,
    deliveryWorkflowDerivedFromVersionId: null,
    deliveryWorkflowGeneratedStrategy: null,
    deliveryWorkflowGeneratedMilestones: null,
  };
  const taskNames = option.definition.phases.flatMap(phase => phase.tasks.map(task => String(task.name ?? "").trim()).filter(Boolean));
  const strategy = taskNames.join(" → ");
  const milestones = option.definition.phases.map(phase => phase.name.trim()).filter(Boolean).join(" → ");
  return {
    ...current,
    deliveryWorkflowVersionId: option.versionId,
    submittalStrategy: !String(current?.submittalStrategy ?? "").trim() || strategyIsGenerated ? strategy : current.submittalStrategy,
    milestoneSummary: !String(current?.milestoneSummary ?? "").trim() || milestonesAreGenerated ? milestones : current.milestoneSummary,
    deliveryWorkflowDerivedFromVersionId: option.versionId,
    deliveryWorkflowGeneratedStrategy: strategy,
    deliveryWorkflowGeneratedMilestones: milestones,
  };
}
