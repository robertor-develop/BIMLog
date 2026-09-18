import { createHash } from "node:crypto";
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
  closed(raw, ["schemaVersion", "currency", "industry", "name", "nodes"], "definition");
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
  const definition = { schemaVersion: 1 as const, currency, industry, name, nodes };
  const preview = evaluateGenericApu({ currency, nodes: nodes as GenericApuNode[], rootNodeIds: nodes.map(node => node.id) } satisfies GenericApuEvaluationInput);
  const fingerprint = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
  return { definition, preview, fingerprint };
}
