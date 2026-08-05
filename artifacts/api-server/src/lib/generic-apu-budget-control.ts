export type BudgetControlErrorCode =
  | "APU_BUDGET_CONTROL_INVALID_INPUT"
  | "APU_BUDGET_CONTROL_MISSING_BASELINE"
  | "APU_BUDGET_CONTROL_STALE_REVISION"
  | "APU_BUDGET_CONTROL_MIXED_CURRENCY"
  | "APU_BUDGET_CONTROL_DUPLICATE_ROLE"
  | "APU_BUDGET_CONTROL_APPROVAL_ROLE_MISMATCH"
  | "APU_BUDGET_CONTROL_IDEMPOTENCY_REQUIRED"
  | "APU_BUDGET_CONTROL_OVERFLOW";

export interface BudgetControlMoney {
  readonly amount: string;
  readonly currency: string;
}

export interface BudgetControlOverrunApproval {
  readonly roleId: string;
  readonly amount: BudgetControlMoney;
  readonly reason: string;
  readonly approver: string;
  readonly timestamp: string;
  readonly authorized: boolean;
}

export interface RoleBudgetControlInput {
  readonly roleId: string;
  readonly approved?: BudgetControlMoney;
  readonly committed?: BudgetControlMoney;
  readonly actual?: BudgetControlMoney;
  readonly projected?: BudgetControlMoney;
  readonly warningRemaining?: BudgetControlMoney;
  readonly overrunApproval?: BudgetControlOverrunApproval;
}

export interface GenericApuBudgetControlInput {
  readonly currency: string;
  readonly frozenTemplateVersionId: string;
  readonly currentRevision: number;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly roles: readonly RoleBudgetControlInput[];
}

export type BudgetControlGateState =
  | "WITHIN_CAP"
  | "WARNING"
  | "NEEDS_APPROVAL"
  | "APPROVED_OVERRIDE";

export interface RoleBudgetBalances {
  readonly approved: string;
  readonly committed: string;
  readonly actual: string;
  readonly projected: string;
  readonly exposure: string;
  readonly remaining: string;
  readonly overrun: string;
}

export interface RoleBudgetControlResult {
  readonly roleId: string;
  readonly currency: string;
  readonly balances: RoleBudgetBalances;
  readonly remainingAvailable: boolean;
  readonly warning: boolean;
  readonly state: BudgetControlGateState;
  readonly overrunApproval?: BudgetControlOverrunApproval;
}

export interface GenericApuBudgetControlResult {
  readonly currency: string;
  readonly frozenTemplateVersionId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
  readonly roles: readonly RoleBudgetControlResult[];
}

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const MAX_WHOLE_DIGITS = 24;
const MAX_SCALE = 6;
const MAX_ROLES = 100;
// The authority service binds project, company, role cap, grant, maker/checker,
// idempotency, and audit receipt before it constructs this internal identity.
const SERVICE_APPROVER_ID = /^user:[1-9][0-9]*:receipt:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const POWERS_OF_TEN: bigint[] = [1n];

function powerOfTen(exponent: number): bigint {
  while (POWERS_OF_TEN.length <= exponent)
    POWERS_OF_TEN.push(POWERS_OF_TEN[POWERS_OF_TEN.length - 1] * 10n);
  return POWERS_OF_TEN[exponent];
}

export class GenericApuBudgetControlError extends Error {
  readonly code: BudgetControlErrorCode;
  readonly status: number;

  constructor(code: BudgetControlErrorCode, message: string, status = 422) {
    super(message);
    this.name = "GenericApuBudgetControlError";
    this.code = code;
    this.status = status;
  }
}

function fail(code: BudgetControlErrorCode, message: string, status = 422): never {
  throw new GenericApuBudgetControlError(code, message, status);
}

function normalize(value: ExactDecimal): ExactDecimal {
  let coefficient = value.coefficient;
  let scale = value.scale;
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function assertRange(value: ExactDecimal, field: string): ExactDecimal {
  const normalized = normalize(value);
  const absolute = normalized.coefficient < 0n
    ? -normalized.coefficient
    : normalized.coefficient;
  const wholeDigits = Math.max(1, absolute.toString().length - normalized.scale);
  if (wholeDigits > MAX_WHOLE_DIGITS)
    fail(
      "APU_BUDGET_CONTROL_OVERFLOW",
      `${field} exceeds the supported exact-decimal range.`,
    );
  return normalized;
}

function parseDecimal(value: unknown, field: string): ExactDecimal {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value)
  )
    fail(
      "APU_BUDGET_CONTROL_INVALID_INPUT",
      `${field} must be a canonical non-negative exact decimal with at most ${MAX_SCALE} fractional digits.`,
    );
  const [whole, fraction = ""] = value.split(".");
  if (whole.length > MAX_WHOLE_DIGITS)
    fail(
      "APU_BUDGET_CONTROL_OVERFLOW",
      `${field} exceeds the supported exact-decimal range.`,
    );
  return normalize({
    coefficient: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  });
}

function decimalString(value: ExactDecimal): string {
  const normalized = normalize(value);
  const negative = normalized.coefficient < 0n;
  const absolute = negative ? -normalized.coefficient : normalized.coefficient;
  if (normalized.scale === 0)
    return `${negative ? "-" : ""}${absolute.toString()}`;
  const digits = absolute.toString().padStart(normalized.scale + 1, "0");
  const split = digits.length - normalized.scale;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

function align(value: ExactDecimal, scale: number): bigint {
  return value.coefficient * powerOfTen(scale - value.scale);
}

function add(left: ExactDecimal, right: ExactDecimal, field: string): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  return assertRange(
    { coefficient: align(left, scale) + align(right, scale), scale },
    field,
  );
}

function subtract(
  left: ExactDecimal,
  right: ExactDecimal,
  field: string,
): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  return assertRange(
    { coefficient: align(left, scale) - align(right, scale), scale },
    field,
  );
}

function compare(left: ExactDecimal, right: ExactDecimal): number {
  const scale = Math.max(left.scale, right.scale);
  const difference = align(left, scale) - align(right, scale);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function canonicalCurrency(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))
    fail(
      "APU_BUDGET_CONTROL_INVALID_INPUT",
      `${field} must be an ISO 4217 alphabetic currency code.`,
    );
  return value;
}

function parseMoney(
  money: BudgetControlMoney | undefined,
  currency: string,
  field: string,
): ExactDecimal {
  if (!money || typeof money !== "object")
    fail(
      "APU_BUDGET_CONTROL_MISSING_BASELINE",
      `${field} is required for an exact role budget decision.`,
    );
  if (canonicalCurrency(money.currency, `${field}.currency`) !== currency)
    fail(
      "APU_BUDGET_CONTROL_MIXED_CURRENCY",
      `${field}.currency does not match the control currency.`,
    );
  return parseDecimal(money.amount, `${field}.amount`);
}

function stableIdentity(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  )
    fail(
      "APU_BUDGET_CONTROL_INVALID_INPUT",
      `${field} must be a stable bounded identity.`,
    );
  return value;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function completeApproval(
  approval: BudgetControlOverrunApproval | undefined,
  roleId: string,
  overrun: ExactDecimal,
  currency: string,
): approval is BudgetControlOverrunApproval {
  if (!approval) return false;
  if (stableIdentity(approval.roleId, "overrunApproval.roleId") !== roleId)
    fail(
      "APU_BUDGET_CONTROL_APPROVAL_ROLE_MISMATCH",
      "Overrun approval belongs to another role.",
      409,
    );
  const approvedAmount = parseMoney(
    approval.amount,
    currency,
    "overrunApproval.amount",
  );
  return (
    approval.authorized === true &&
    nonBlank(approval.reason) &&
    approval.reason.trim().length <= 2000 &&
    SERVICE_APPROVER_ID.test(approval.approver) &&
    validTimestamp(approval.timestamp) &&
    compare(approvedAmount, overrun) >= 0
  );
}

function roleResult(
  role: RoleBudgetControlInput,
  currency: string,
): RoleBudgetControlResult {
  if (!role || typeof role !== "object")
    fail("APU_BUDGET_CONTROL_INVALID_INPUT", "Every role must be an object.");
  const roleId = stableIdentity(role.roleId, "roles[].roleId");
  const approved = parseMoney(role.approved, currency, `roles[${roleId}].approved`);
  const committed = parseMoney(
    role.committed,
    currency,
    `roles[${roleId}].committed`,
  );
  const actual = parseMoney(role.actual, currency, `roles[${roleId}].actual`);
  const projected = parseMoney(
    role.projected,
    currency,
    `roles[${roleId}].projected`,
  );
  const warningRemaining = role.warningRemaining
    ? parseMoney(
        role.warningRemaining,
        currency,
        `roles[${roleId}].warningRemaining`,
      )
    : { coefficient: 0n, scale: 0 };
  const committedAndActual = add(
    committed,
    actual,
    `roles[${roleId}].exposure`,
  );
  const exposure = add(
    committedAndActual,
    projected,
    `roles[${roleId}].exposure`,
  );
  const signedRemaining = subtract(
    approved,
    exposure,
    `roles[${roleId}].remaining`,
  );
  const zero: ExactDecimal = { coefficient: 0n, scale: 0 };
  const overrun = compare(signedRemaining, zero) < 0
    ? { coefficient: -signedRemaining.coefficient, scale: signedRemaining.scale }
    : zero;
  const remaining = compare(signedRemaining, zero) < 0 ? zero : signedRemaining;
  const warning = compare(remaining, warningRemaining) <= 0;
  let state: BudgetControlGateState;
  let acceptedApproval: BudgetControlOverrunApproval | undefined;
  if (compare(overrun, zero) > 0) {
    if (
      completeApproval(
        role.overrunApproval,
        roleId,
        overrun,
        currency,
      )
    ) {
      state = "APPROVED_OVERRIDE";
      acceptedApproval = role.overrunApproval;
    } else state = "NEEDS_APPROVAL";
  } else state = warning ? "WARNING" : "WITHIN_CAP";

  const result: RoleBudgetControlResult = {
    roleId,
    currency,
    balances: {
      approved: decimalString(approved),
      committed: decimalString(committed),
      actual: decimalString(actual),
      projected: decimalString(projected),
      exposure: decimalString(exposure),
      remaining: decimalString(remaining),
      overrun: decimalString(overrun),
    },
    remainingAvailable: true,
    warning,
    state,
  };
  return acceptedApproval
    ? { ...result, overrunApproval: acceptedApproval }
    : result;
}

export function evaluateGenericApuBudgetControl(
  input: GenericApuBudgetControlInput,
): GenericApuBudgetControlResult {
  if (!input || typeof input !== "object")
    fail("APU_BUDGET_CONTROL_INVALID_INPUT", "Control input must be an object.");
  const currency = canonicalCurrency(input.currency, "currency");
  const frozenTemplateVersionId = stableIdentity(
    input.frozenTemplateVersionId,
    "frozenTemplateVersionId",
  );
  if (
    !Number.isSafeInteger(input.currentRevision) ||
    input.currentRevision < 1 ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  )
    fail(
      "APU_BUDGET_CONTROL_INVALID_INPUT",
      "currentRevision and expectedRevision must be positive safe integers.",
    );
  if (input.currentRevision !== input.expectedRevision)
    fail(
      "APU_BUDGET_CONTROL_STALE_REVISION",
      "Expected revision does not match the frozen control revision.",
      409,
    );
  if (
    typeof input.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.idempotencyKey)
  )
    fail(
      "APU_BUDGET_CONTROL_IDEMPOTENCY_REQUIRED",
      "A stable bounded idempotency key is required.",
      409,
    );
  if (!Array.isArray(input.roles))
    fail("APU_BUDGET_CONTROL_INVALID_INPUT", "roles must be an array.");
  if (input.roles.length < 1 || input.roles.length > MAX_ROLES)
    fail(
      "APU_BUDGET_CONTROL_INVALID_INPUT",
      `roles must contain between 1 and ${MAX_ROLES} entries.`,
    );

  const seen = new Set<string>();
  for (const role of input.roles) {
    const roleId = stableIdentity(role?.roleId, "roles[].roleId");
    if (seen.has(roleId))
      fail(
        "APU_BUDGET_CONTROL_DUPLICATE_ROLE",
        `Duplicate role identity ${roleId}.`,
        409,
      );
    seen.add(roleId);
  }
  const roles = [...input.roles]
    .sort((left, right) => left.roleId.localeCompare(right.roleId))
    .map((role) => roleResult(role, currency));

  return {
    currency,
    frozenTemplateVersionId,
    revision: input.currentRevision,
    idempotencyKey: input.idempotencyKey,
    roles,
  };
}
