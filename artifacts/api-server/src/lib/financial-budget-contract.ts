import crypto from "crypto";
import {
  FinancialControlError,
  parseCurrency,
  parseDecimal,
  scaledDecimal,
} from "./financial-control-contract";

export const BUDGET_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "returned",
  "rejected",
  "withdrawn",
  "superseded",
  "voided",
] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type BudgetLineInput = {
  stableLineId: string;
  projectCostNodeId: string;
  description: string;
  amount: string;
  quantity?: string | null;
  unit?: string | null;
  unitRate?: string | null;
  notes?: string | null;
  provenance?: string | null;
  sortOrder: number;
};

export function boundedText(
  value: unknown,
  field: string,
  min = 1,
  max = 1000,
): string {
  const text = String(value ?? "").trim();
  if (
    text.length < min ||
    text.length > max ||
    /[\u0000-\u001f\u007f]/.test(text)
  )
    throw new FinancialControlError(
      400,
      "BUDGET_TEXT_INVALID",
      `${field} must contain ${min} to ${max} characters of plain text.`,
    );
  return text;
}
export function positiveId(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new FinancialControlError(
      400,
      "BUDGET_SCOPE_INVALID",
      `${field} must be a positive integer.`,
    );
  return number;
}
export function exactSignedDecimal(value: unknown, field = "amount"): string {
  if (typeof value !== "string")
    throw new FinancialControlError(
      400,
      "FIN_DECIMAL_INVALID",
      `${field} must be an exact decimal string.`,
    );
  const negative = value.startsWith("-");
  const canonical = parseDecimal(negative ? value.slice(1) : value, field);
  return negative && canonical !== "0" ? `-${canonical}` : canonical;
}
export function scaledSignedDecimal(value: string): bigint {
  return value.startsWith("-")
    ? -scaledDecimal(value.slice(1))
    : scaledDecimal(value);
}
export function decimalFromScaled(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const n = value < 0n ? -value : value;
  const whole = n / 1_000_000n,
    fraction = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}
export function exactTotal(
  lines: ReadonlyArray<Pick<BudgetLineInput, "amount">>,
): string {
  return decimalFromScaled(
    lines.reduce(
      (sum, line) => sum + scaledSignedDecimal(exactSignedDecimal(line.amount)),
      0n,
    ),
  );
}
export function exactApprovalExposure(
  lines: ReadonlyArray<Pick<BudgetLineInput, "amount">>,
): string {
  return decimalFromScaled(
    lines.reduce((sum, line) => {
      const amount = scaledSignedDecimal(exactSignedDecimal(line.amount));
      return sum + (amount < 0n ? -amount : amount);
    }, 0n),
  );
}
export function budgetCurrency(value: unknown): string {
  return parseCurrency(value);
}
export function canonicalFingerprint(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
export function validateHierarchy<
  T extends {
    stableNodeId: string;
    parentStableNodeId?: string | null;
    code: string;
    sortOrder: number;
    active?: boolean;
  },
>(nodes: T[]): void {
  const ids = new Set(nodes.map((n) => n.stableNodeId));
  if (ids.size !== nodes.length)
    throw new FinancialControlError(
      400,
      "COST_NODE_ID_DUPLICATE",
      "Stable node identities must be unique.",
    );
  const activeCodes = new Set<string>(),
    siblingOrders = new Set<string>();
  for (const node of nodes) {
    if (node.parentStableNodeId && !ids.has(node.parentStableNodeId))
      throw new FinancialControlError(
        400,
        "COST_NODE_ORPHAN",
        "Every parent must exist in the same version.",
      );
    if (node.active !== false) {
      if (activeCodes.has(node.code))
        throw new FinancialControlError(
          400,
          "COST_CODE_DUPLICATE",
          "Active codes must be unique in a version.",
        );
      activeCodes.add(node.code);
    }
    const order = `${node.parentStableNodeId ?? "<root>"}:${node.sortOrder}`;
    if (siblingOrders.has(order))
      throw new FinancialControlError(
        400,
        "COST_SIBLING_ORDER_DUPLICATE",
        "Sibling sort order must be unambiguous.",
      );
    siblingOrders.add(order);
  }
  const parent = new Map(
    nodes.map((n) => [n.stableNodeId, n.parentStableNodeId ?? null]),
  );
  for (const node of nodes) {
    const seen = new Set<string>();
    let id: string | null = node.stableNodeId;
    while (id) {
      if (seen.has(id))
        throw new FinancialControlError(
          400,
          "COST_HIERARCHY_CYCLE",
          "Cost hierarchy cycles are not allowed.",
        );
      seen.add(id);
      id = parent.get(id) ?? null;
    }
  }
}
export function normalizeBudgetLines(input: unknown): BudgetLineInput[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10000)
    throw new FinancialControlError(
      400,
      "BUDGET_LINES_INVALID",
      "One to 10,000 budget lines are required.",
    );
  const ids = new Set<string>();
  return input.map((raw, index) => {
    const r = raw as Record<string, unknown>;
    const stableLineId = boundedText(r.stableLineId, "stableLineId", 3, 100);
    if (ids.has(stableLineId))
      throw new FinancialControlError(
        400,
        "BUDGET_LINE_DUPLICATE",
        "Budget line identities must be unique.",
      );
    ids.add(stableLineId);
    return {
      stableLineId,
      projectCostNodeId: boundedText(
        r.projectCostNodeId,
        "projectCostNodeId",
        3,
        100,
      ),
      description: boundedText(r.description, "description", 1, 500),
      amount: exactSignedDecimal(r.amount),
      quantity:
        r.quantity == null ? null : exactSignedDecimal(r.quantity, "quantity"),
      unit: r.unit == null ? null : boundedText(r.unit, "unit", 1, 40),
      unitRate:
        r.unitRate == null ? null : exactSignedDecimal(r.unitRate, "unitRate"),
      notes: r.notes == null ? null : boundedText(r.notes, "notes", 1, 1000),
      provenance:
        r.provenance == null
          ? null
          : boundedText(r.provenance, "provenance", 1, 200),
      sortOrder: Number.isSafeInteger(Number(r.sortOrder))
        ? Number(r.sortOrder)
        : index,
    };
  });
}
