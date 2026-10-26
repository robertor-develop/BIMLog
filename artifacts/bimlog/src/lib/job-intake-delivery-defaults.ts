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

export function deliveryGuidanceStatusLabel(item: any, field: "strategy" | "milestones", spanish = false) {
  const status = deliveryGuidanceStatus(item);
  const generated = field === "strategy" ? status.strategyGenerated : status.milestonesGenerated;
  if (!generated) return spanish
    ? "Texto revisado del proyecto. Cambiar el flujo no lo reemplazará silenciosamente."
    : "Reviewed project text. Changing the workflow will not replace it silently.";
  const version = String(item?.deliveryWorkflowDerivedFromVersionId ?? item?.deliveryWorkflowVersionId ?? "").trim();
  const source = version ? (spanish ? `versión ${version}` : `version ${version}`) : (spanish ? "versión seleccionada" : "selected version");
  return field === "strategy"
    ? (spanish ? `Generada desde la ${source} inmutable del flujo. Al editar se conserva su texto revisado.` : `Generated from immutable workflow ${source}. Editing preserves your reviewed text.`)
    : (spanish ? `Generados desde las fases de la ${source} inmutable.` : `Generated from the immutable workflow phases in ${source}.`);
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
  deliverableTypes?: string[];
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

export function hydrateSelectedDeliveryWorkflowGuidance(
  items: any[],
  options: Array<{ versionId: string; source?: string; definition: WorkflowDefinition }>,
) {
  const byVersion = new Map(options.map(option => [option.versionId, option]));
  return items.map(item => {
    const versionId = String(item?.deliveryWorkflowVersionId ?? "").trim();
    const type = String(item?.deliverableType ?? "GENERAL");
    const matches = options.filter(option => (option.definition.deliverableTypes ?? []).includes(type));
    const company = matches.filter(option => option.source === "company");
    const defaults = matches.filter(option => option.source === "bimlog");
    const automatic = company.length === 1 ? company[0] : company.length === 0 && defaults.length === 1 ? defaults[0] : undefined;
    const option = versionId ? byVersion.get(versionId) : automatic;
    if (!option) return item;
    const hydrated = selectPublishedDeliveryWorkflow(item, option);
    return JSON.stringify(hydrated) === JSON.stringify(item) ? item : hydrated;
  });
}
