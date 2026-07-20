export const FINANCIAL_AUTHORITIES = [
  "financial_viewer",
  "cost_preparer",
  "cost_reviewer",
  "cost_approver",
  "financial_administrator",
  "auditor",
] as const;
export type FinancialAuthority = (typeof FINANCIAL_AUTHORITIES)[number];
export type FinancialOperation =
  | "read"
  | "prepare"
  | "review"
  | "approve"
  | "manage"
  | "audit_read"
  | "export"
  | "integrate"
  | "ai";
export type Money = Readonly<{ amount: string; currency: string }>;

const DECIMAL = /^(?:0|[1-9]\d{0,23})(?:\.\d{1,6})?$/;
const CURRENCY = /^[A-Z]{3}$/;
const FALLBACK_ISO_4217 = new Set([
  "AED",
  "ARS",
  "AUD",
  "BOB",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CZK",
  "DKK",
  "DOP",
  "EGP",
  "EUR",
  "GBP",
  "GTQ",
  "HKD",
  "HNL",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MAD",
  "MXN",
  "MYR",
  "NIO",
  "NOK",
  "NZD",
  "PAB",
  "PEN",
  "PHP",
  "PLN",
  "PYG",
  "RON",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "UAH",
  "USD",
  "UYU",
  "VES",
  "VND",
  "XAF",
  "XCD",
  "XOF",
  "XPF",
  "ZAR",
]);
const runtimeCurrencies = (() => {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    return fn ? new Set(fn("currency")) : FALLBACK_ISO_4217;
  } catch {
    return FALLBACK_ISO_4217;
  }
})();

export class FinancialControlError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function parseCurrency(value: unknown): string {
  const code = String(value ?? "").toUpperCase();
  if (!CURRENCY.test(code) || !runtimeCurrencies.has(code))
    throw new FinancialControlError(
      400,
      "FIN_CURRENCY_INVALID",
      "A valid ISO 4217 currency code is required.",
    );
  return code;
}
export function parseDecimal(value: unknown, field = "amount"): string {
  if (typeof value !== "string" || !DECIMAL.test(value))
    throw new FinancialControlError(
      400,
      "FIN_DECIMAL_INVALID",
      `${field} must be a non-negative exact decimal string with at most 24 integer and 6 fractional digits.`,
    );
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
export function scaledDecimal(value: string): bigint {
  const canonical = parseDecimal(value);
  const [whole, fraction = ""] = canonical.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}
export function parseMoney(value: unknown): Money {
  if (!value || typeof value !== "object")
    throw new FinancialControlError(
      400,
      "FIN_MONEY_INVALID",
      "Money requires an amount and currency.",
    );
  const input = value as Record<string, unknown>;
  return Object.freeze({
    amount: parseDecimal(input.amount),
    currency: parseCurrency(input.currency),
  });
}
export function compareMoney(left: Money, right: Money): number {
  if (left.currency !== right.currency)
    throw new FinancialControlError(
      400,
      "FIN_MIXED_CURRENCY",
      "Currency conversion and mixed-currency comparison are not permitted.",
    );
  const a = scaledDecimal(left.amount),
    b = scaledDecimal(right.amount);
  return a === b ? 0 : a < b ? -1 : 1;
}

export type EffectiveGrant = {
  id: string;
  authority: FinancialAuthority;
  scopeType: "company" | "project";
  companyId: number;
  projectId: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  revoked: boolean;
};
export type ApprovalPolicy = {
  id: string;
  scopeType: "company" | "project";
  companyId: number;
  projectId: number | null;
  category: string;
  money: Money;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  state: "active" | "revoked";
  version: number;
};
export type FinancialDecision = {
  decision: "allow" | "deny";
  code: string;
  explanation: { en: string; es: string };
  matchedGrantIds: string[];
  policyId?: string;
  requiresHigherReview?: boolean;
};
export type FinancialSuspensionEvent = {
  projectId: number | null;
  action: "activate" | "release";
  occurredAt: Date;
};
export type FinancialEvaluation = {
  operation: FinancialOperation;
  userId: number;
  companyId: number;
  projectId?: number;
  makerUserId?: number;
  category?: string;
  amount?: Money;
  entitlementDecision: "allow" | "deny";
  membershipActive: boolean;
  companyCurrent: boolean;
  suspended: boolean;
  grants: EffectiveGrant[];
  policies: ApprovalPolicy[];
  at?: Date;
  relatedRequests?: Array<{
    makerUserId: number;
    category: string;
    amount: Money;
    createdAt: Date;
  }>;
};
const need: Record<FinancialOperation, FinancialAuthority[]> = {
  read: [
    "financial_viewer",
    "cost_preparer",
    "cost_reviewer",
    "cost_approver",
    "financial_administrator",
    "auditor",
  ],
  prepare: ["cost_preparer"],
  review: ["cost_reviewer"],
  approve: ["cost_approver"],
  manage: ["financial_administrator"],
  audit_read: ["auditor", "financial_administrator"],
  export: ["financial_viewer", "financial_administrator", "auditor"],
  integrate: ["financial_administrator"],
  ai: ["financial_administrator"],
};
const deny = (code: string, en: string, es: string): FinancialDecision => ({
  decision: "deny",
  code,
  explanation: { en, es },
  matchedGrantIds: [],
});
export function isFinancialScopeSuspended(
  events: FinancialSuspensionEvent[],
  projectId?: number,
): boolean {
  const latest = (target: number | null) =>
    events
      .filter((event) => event.projectId === target)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]
      ?.action;
  return (
    latest(null) === "activate" ||
    (projectId !== undefined && latest(projectId) === "activate")
  );
}
export function evaluateFinancialAuthorization(
  input: FinancialEvaluation,
): FinancialDecision {
  const at = input.at ?? new Date();
  if (input.entitlementDecision !== "allow")
    return deny(
      "FIN_ENTITLEMENT_DENIED",
      "Commercial or feature availability does not permit this operation.",
      "La disponibilidad comercial o de la función no permite esta operación.",
    );
  if (!input.companyCurrent || !input.membershipActive)
    return deny(
      "FIN_SCOPE_MEMBERSHIP_DENIED",
      "Current company and project membership could not be verified.",
      "No se pudo verificar la membresía vigente de empresa y proyecto.",
    );
  if (input.suspended && input.operation !== "audit_read")
    return deny(
      "FIN_SCOPE_SUSPENDED",
      "Financial control is suspended for this scope.",
      "El control financiero está suspendido para este alcance.",
    );
  const grants = input.grants.filter(
    (g) =>
      !g.revoked &&
      g.companyId === input.companyId &&
      (g.projectId === null || g.projectId === input.projectId) &&
      g.effectiveFrom <= at &&
      (!g.effectiveTo || g.effectiveTo > at),
  );
  const matched = grants.filter((g) =>
    need[input.operation].includes(g.authority),
  );
  if (!matched.length)
    return deny(
      "FIN_AUTHORITY_MISSING",
      "No current explicit financial authority permits this operation.",
      "Ninguna autoridad financiera explícita vigente permite esta operación.",
    );
  if (
    (input.operation === "review" || input.operation === "approve") &&
    input.makerUserId === input.userId
  )
    return deny(
      "FIN_MAKER_CHECKER_REQUIRED",
      "The maker cannot review or approve the same request.",
      "El creador no puede revisar ni aprobar la misma solicitud.",
    );
  if (input.operation === "approve") {
    if (!input.amount || !input.category)
      return deny(
        "FIN_APPROVAL_CONTEXT_MISSING",
        "Approval requires an exact amount, currency, and transaction category.",
        "La aprobación requiere monto exacto, moneda y categoría de transacción.",
      );
    const candidates = input.policies.filter(
      (p) =>
        p.companyId === input.companyId &&
        (p.projectId === null || p.projectId === input.projectId) &&
        p.category === input.category &&
        p.money.currency === input.amount!.currency &&
        p.effectiveFrom <= at &&
        (!p.effectiveTo || p.effectiveTo > at),
    );
    const latest = [...candidates]
      .sort((a, b) => b.version - a.version)
      .filter(
        (p, index, rows) =>
          rows.findIndex(
            (other) =>
              other.companyId === p.companyId &&
              other.projectId === p.projectId &&
              other.category === p.category &&
              other.money.currency === p.money.currency,
          ) === index,
      );
    const policies = latest
      .filter((p) => p.state === "active")
      .sort(
        (a, b) =>
          (b.projectId === input.projectId ? 1 : 0) -
            (a.projectId === input.projectId ? 1 : 0) || b.version - a.version,
      );
    const policy = policies[0];
    if (!policy)
      return deny(
        "FIN_APPROVAL_POLICY_MISSING",
        "No effective approval policy matches this scope, category, and currency.",
        "Ninguna política de aprobación vigente coincide con este alcance, categoría y moneda.",
      );
    if (compareMoney(input.amount, policy.money) > 0)
      return deny(
        "FIN_APPROVAL_LIMIT_EXCEEDED",
        "The exact amount exceeds the approver limit.",
        "El monto exacto supera el límite del aprobador.",
      );
    const related = (input.relatedRequests ?? []).filter(
      (r) =>
        r.makerUserId === input.makerUserId &&
        r.category === input.category &&
        r.amount.currency === input.amount!.currency &&
        at.getTime() - r.createdAt.getTime() <= 86_400_000,
    );
    const aggregate = related.reduce(
      (sum, r) => sum + scaledDecimal(r.amount.amount),
      scaledDecimal(input.amount.amount),
    );
    return {
      decision: "allow",
      code:
        aggregate > scaledDecimal(policy.money.amount)
          ? "FIN_HIGHER_REVIEW_SIGNAL"
          : "FIN_ALLOWED",
      explanation:
        aggregate > scaledDecimal(policy.money.amount)
          ? {
              en: "Allowed by this limit, with a related-request signal for manual higher review.",
              es: "Permitido por este límite, con señal de solicitudes relacionadas para revisión manual superior.",
            }
          : {
              en: "Explicit financial authority and policy permit this operation.",
              es: "La autoridad y política financieras explícitas permiten esta operación.",
            },
      matchedGrantIds: matched.map((g) => g.id),
      policyId: policy.id,
      requiresHigherReview: aggregate > scaledDecimal(policy.money.amount),
    };
  }
  return {
    decision: "allow",
    code: "FIN_ALLOWED",
    explanation: {
      en: "Explicit current financial authority permits this operation.",
      es: "La autoridad financiera explícita vigente permite esta operación.",
    },
    matchedGrantIds: matched.map((g) => g.id),
  };
}
