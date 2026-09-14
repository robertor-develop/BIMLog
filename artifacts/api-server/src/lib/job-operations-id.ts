import { FinancialControlError } from "./financial-control-contract";

export function canonicalJobOperationId(value: unknown, field: string) {
  const parsed = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(parsed)) {
    throw new FinancialControlError(400, "JOB_OPERATIONS_ID_INVALID", `${field} is invalid.`);
  }
  return parsed;
}
