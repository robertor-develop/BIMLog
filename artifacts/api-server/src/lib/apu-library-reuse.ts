import type { PricingTemplateDefinition } from "./company-pricing-template-contract";

type SavedPlan = { currency: string; name: string; fixedCompanyCost: string; allocations: { labor: string; bonus: string; taskEarnings: string }; productionPhases: Array<{ id: string; name: string; amount: string }>; administrativeLines: Array<{ id: string; name: string; amount: string }> };

const stable = (prefix: string, value: string, index: number) => `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48) || index + 1}`;
export const projectApuIdentity = (projectId:number,templateId:string) => `${projectId}:${templateId}`;

export function projectPlanToLibraryDefinition(plan: SavedPlan, name: string): PricingTemplateDefinition {
  const nodes = [
    { id: "fixed-company-cost", label: "Fixed company cost", method: "fixed_amount" as const, amount: plan.fixedCompanyCost },
    ...plan.productionPhases.map((line,index) => ({ id: stable("production",line.id,index), label: line.name, method: "fixed_amount" as const, amount: line.amount })),
    ...plan.administrativeLines.map((line,index) => ({ id: stable("administration",line.id,index), label: line.name, method: "fixed_amount" as const, amount: line.amount })),
    { id: "incentive-reserve", label: "Project incentive reserve", method: "fixed_amount" as const, amount: plan.allocations.bonus },
    { id: "project-earnings", label: "Project earnings", method: "fixed_amount" as const, amount: plan.allocations.taskEarnings },
  ];
  return { schemaVersion: 1, currency: plan.currency, industry: "BIM Services", name, nodes };
}
