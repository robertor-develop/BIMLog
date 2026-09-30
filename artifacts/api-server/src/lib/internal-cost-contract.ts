import crypto from "node:crypto";
import { FinancialControlError } from "./financial-control-contract";

export const INTERNAL_COST_ROLES = ["drafter", "coordinator"] as const;
export type InternalCostRole = typeof INTERNAL_COST_ROLES[number];
export type InternalCostPolicyInput = { drafter: string; coordinator: string };

export function canonicalInternalCostRate(value: unknown, field = "rate") {
  const text = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(text)) throw new FinancialControlError(400, "INTERNAL_COST_RATE_INVALID", `${field} must be a nonnegative decimal with up to six decimal places.`);
  return Number(text).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function canonicalInternalCostRole(value: unknown): InternalCostRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (!INTERNAL_COST_ROLES.includes(role as InternalCostRole)) throw new FinancialControlError(400, "INTERNAL_COST_ROLE_INVALID", "Internal cost role must be drafter or coordinator.");
  return role as InternalCostRole;
}

export function internalCostFingerprint(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
