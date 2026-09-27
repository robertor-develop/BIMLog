import { createHash } from "node:crypto";
import { allocateMinorUnits, economicPoolKeys, type EconomicPoolNodes } from "@workspace/api-zod";
import { evaluateGenericApu } from "./generic-apu-engine";
import type { GenericApuEvaluationInput, GenericApuNode } from "./generic-apu-contract";

export type PricingTemplateNode =
  | { id: string; label: string; method: "fixed_amount"; amount: string }
  | { id: string; label: string; method: "quantity_unit_cost"; quantity: string; unitCost: string }
  | { id: string; label: string; method: "hours_hourly_rate"; hours: string; hourlyRate: string };

export type PricingTemplateDefinition = {
  schemaVersion: 1;
  currency: string;
  industry: string;
  name: string;
  nodes: PricingTemplateNode[];
  economicPools?: EconomicPoolNodes;
  economicAllocation?: {
    directProductionNodeIds: string[];
    phases: Array<{ phaseId: string; code: string; name: string; percent: string }>;
  };
};

export class PricingTemplateError extends Error {
  constructor(public readonly code: string, public readonly field: string) {
    super(`${code}: ${field}`);
  }
}

function fail(code: string, field: string): never { throw new PricingTemplateError(code, field); }
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("PRICING_TEMPLATE_OBJECT_REQUIRED", field);
  return value as Record<string, unknown>;
}
function closed(value: Record<string, unknown>, keys: string[], field: string) {
  if (Object.keys(value).some(key => !keys.includes(key))) fail("PRICING_TEMPLATE_UNKNOWN_FIELD", field);
}
function text(value: unknown, field: string, max = 160): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value))
    fail("PRICING_TEMPLATE_TEXT_INVALID", field);
  return value.trim();
}

export function validatePricingTemplate(input: unknown): { definition: PricingTemplateDefinition; preview: ReturnType<typeof evaluateGenericApu>; fingerprint: string } {
  const raw = object(input, "definition");
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > 64 * 1024) fail("PRICING_TEMPLATE_TOO_LARGE", "definition");
  closed(raw, ["schemaVersion", "currency", "industry", "name", "nodes", "economicAllocation", "economicPools"], "definition");
  if (raw.schemaVersion !== 1) fail("PRICING_TEMPLATE_SCHEMA_INVALID", "schemaVersion");
  const currency = text(raw.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail("PRICING_TEMPLATE_CURRENCY_INVALID", "currency");
  const name = text(raw.name, "name");
  const industry = text(raw.industry, "industry", 80);
  if (!Array.isArray(raw.nodes) || raw.nodes.length < 1 || raw.nodes.length > 100)
    fail("PRICING_TEMPLATE_NODES_INVALID", "nodes");
  const nodes: PricingTemplateNode[] = raw.nodes.map((entry, index) => {
    const field = `nodes[${index}]`;
    const node = object(entry, field);
    const id = text(node.id, `${field}.id`, 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) fail("PRICING_TEMPLATE_NODE_ID_INVALID", `${field}.id`);
    const label = text(node.label, `${field}.label`);
    if (node.method === "fixed_amount") {
      closed(node, ["id", "label", "method", "amount"], field);
      return { id, label, method: "fixed_amount", amount: String(node.amount ?? "") };
    }
    if (node.method === "quantity_unit_cost") {
      closed(node, ["id", "label", "method", "quantity", "unitCost"], field);
      return { id, label, method: "quantity_unit_cost", quantity: String(node.quantity ?? ""), unitCost: String(node.unitCost ?? "") };
    }
    if (node.method === "hours_hourly_rate") {
      closed(node, ["id", "label", "method", "hours", "hourlyRate"], field);
      return { id, label, method: "hours_hourly_rate", hours: String(node.hours ?? ""), hourlyRate: String(node.hourlyRate ?? "") };
    }
    fail("PRICING_TEMPLATE_METHOD_UNSUPPORTED", `${field}.method`);
  });
  if (new Set(nodes.map(node => node.id)).size !== nodes.length) fail("PRICING_TEMPLATE_DUPLICATE_NODE", "nodes");
  let economicAllocation: PricingTemplateDefinition["economicAllocation"];
  if (raw.economicAllocation !== undefined) {
    const allocation = object(raw.economicAllocation, "economicAllocation");
    closed(allocation, ["directProductionNodeIds", "phases"], "economicAllocation");
    if (!Array.isArray(allocation.directProductionNodeIds) || !allocation.directProductionNodeIds.length ||
      allocation.directProductionNodeIds.length > nodes.length) fail("PRICING_TEMPLATE_PRODUCTION_NODES_INVALID", "economicAllocation.directProductionNodeIds");
    const directProductionNodeIds = allocation.directProductionNodeIds.map((value, index) => {
      const nodeId = text(value, `economicAllocation.directProductionNodeIds[${index}]`, 80);
      if (!nodes.some(node => node.id === nodeId)) fail("PRICING_TEMPLATE_PRODUCTION_NODE_UNKNOWN", `economicAllocation.directProductionNodeIds[${index}]`);
      return nodeId;
    });
    if (new Set(directProductionNodeIds).size !== directProductionNodeIds.length)
      fail("PRICING_TEMPLATE_PRODUCTION_NODE_DUPLICATE", "economicAllocation.directProductionNodeIds");
    if (!Array.isArray(allocation.phases) || !allocation.phases.length || allocation.phases.length > 24)
      fail("PRICING_TEMPLATE_PHASES_INVALID", "economicAllocation.phases");
    const phases = allocation.phases.map((value, index) => {
      const field = `economicAllocation.phases[${index}]`;
      const phase = object(value, field);
      closed(phase, ["phaseId", "code", "name", "percent"], field);
      const phaseId = text(phase.phaseId, `${field}.phaseId`, 100);
      const code = text(phase.code, `${field}.code`, 100);
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(phaseId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(code))
        fail("PRICING_TEMPLATE_PHASE_ID_INVALID", field);
      const percent = text(phase.percent, `${field}.percent`, 6);
      if (!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$|^100(?:\.0{1,2})?$/.test(percent))
        fail("PRICING_TEMPLATE_PHASE_PERCENT_INVALID", `${field}.percent`);
      return { phaseId, code, name: text(phase.name, `${field}.name`, 200), percent };
    });
    if (new Set(phases.map(phase => phase.phaseId)).size !== phases.length ||
      new Set(phases.map(phase => phase.code)).size !== phases.length)
      fail("PRICING_TEMPLATE_PHASE_DUPLICATE", "economicAllocation.phases");
    const points = phases.reduce((sum, phase) => {
      const [whole, fractional = ""] = phase.percent.split(".");
      return sum + Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
    }, 0);
    if (points !== 10000) fail("PRICING_TEMPLATE_PHASE_TOTAL_INVALID", "economicAllocation.phases");
    economicAllocation = { directProductionNodeIds, phases };
  }
  let economicPools: EconomicPoolNodes | undefined;
  if (raw.economicPools !== undefined) {
    const pools = object(raw.economicPools, "economicPools");
    closed(pools, [...economicPoolKeys], "economicPools");
    const assigned = new Set<string>();
    economicPools = Object.fromEntries(economicPoolKeys.map(key => {
      if (!Array.isArray(pools[key]) || pools[key].length > nodes.length)
        fail("PRICING_TEMPLATE_POOLS_INVALID", `economicPools.${key}`);
      const ids = (pools[key] as unknown[]).map(value => {
        const id = text(value, `economicPools.${key}`, 80);
        if (!nodes.some(node => node.id === id) || assigned.has(id))
          fail("PRICING_TEMPLATE_POOL_NODE_INVALID", `economicPools.${key}`);
        assigned.add(id);
        return id;
      });
      return [key, ids];
    })) as EconomicPoolNodes;
    if (assigned.size !== nodes.length) fail("PRICING_TEMPLATE_POOL_NODE_UNASSIGNED", "economicPools");
    if (!economicAllocation || !economicPools.directProduction.length ||
      economicAllocation.directProductionNodeIds.length !== economicPools.directProduction.length ||
      economicAllocation.directProductionNodeIds.some(id => !economicPools!.directProduction.includes(id)))
      fail("PRICING_TEMPLATE_POOL_PRODUCTION_MISMATCH", "economicPools.directProduction");
  }
  // Do not add an absent optional key: legacy published v1 fingerprints must
  // remain byte-for-byte identical after this additive contract extension.
  const definition: PricingTemplateDefinition = {
    schemaVersion: 1, currency, industry, name, nodes,
    ...(economicAllocation ? { economicAllocation } : {}),
    ...(economicPools ? { economicPools } : {}),
  };
  const preview = evaluateGenericApu({ currency, nodes: nodes as GenericApuNode[], rootNodeIds: nodes.map(node => node.id) } satisfies GenericApuEvaluationInput);
  const fingerprint = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
  return { definition, preview, fingerprint };
}

/** Resolve a complete approved classification, never infer pools from labels or scenarios.
 * The caller must verify publication, company, contract binding and frozen fingerprint.
 */
export function resolvePricingPoolAmounts(input: unknown) {
  const validated = validatePricingTemplate(input);
  const pools = validated.definition.economicPools;
  if (!pools) fail("PRICING_TEMPLATE_POOLS_REQUIRED", "economicPools");
  const units = (amount: string) => {
    const [whole, fraction = ""] = amount.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  };
  const money = (amount: bigint) => `${amount / 100n}.${String(amount % 100n).padStart(2,"0")}`;
  // Line rounding can differ from the rounded contract total. Allocate that
  // exact total using unrounded pool weights rather than losing/creating cents.
  const scale = Math.max(0, ...validated.preview.lines.map(line => (line.rawAmount.split(".")[1] ?? "").length));
  const rawUnits = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0") || "0");
  };
  const weights = economicPoolKeys.map(key => validated.preview.lines.filter(line => pools[key].includes(line.id))
    .reduce((sum, line) => sum + rawUnits(line.rawAmount), 0n));
  const rounded = weights.every(weight => weight === 0n) ? weights : allocateMinorUnits(units(validated.preview.roundedTotal), weights);
  const amounts = Object.fromEntries(economicPoolKeys.map((key, index) => [key, money(rounded[index])])) as Record<typeof economicPoolKeys[number], string>;
  if (Object.values(amounts).reduce((sum,amount) => sum + units(amount),0n) !== units(validated.preview.roundedTotal))
    fail("PRICING_TEMPLATE_POOLS_UNBALANCED", "economicPools");
  return {currency:validated.definition.currency, total:validated.preview.roundedTotal, amounts, fingerprint:validated.fingerprint};
}
