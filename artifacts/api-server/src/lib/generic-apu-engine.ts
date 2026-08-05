import type {
  CapResult,
  CurrencyCode,
  GenericApuErrorCode,
  GenericApuEvaluationInput,
  GenericApuEvaluationResult,
  GenericApuLineResult,
  GenericApuNode,
  MoneyInput,
  RemainingBudgetResult,
  ThreeMonthWindowEntry,
  ThreeMonthWindowResult,
} from "./generic-apu-contract";

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const METHOD_ORDER: Record<string, number> = {
  fixed_amount: 0,
  quantity_unit_cost: 1,
  hours_hourly_rate: 2,
  percentage_of_parent: 3,
  allocation_group: 4,
  formula: 5,
};

const MAX_NODES = 500;
const MAX_DEPENDENCIES_PER_NODE = 500;
const MAX_WINDOW_ENTRIES = 1_000;
const MAX_IDENTITY_LENGTH = 128;
const MAX_WHOLE_DIGITS = 24;
// Cap overrides are authority outcomes, not caller assertions. Only the Finance
// service's maker/checker-bound receipt identity may reach this pure evaluator.
const SERVICE_APPROVER_ID = /^user:[1-9][0-9]*:receipt:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const NODE_KEYS: Record<GenericApuNode["method"], readonly string[]> = {
  fixed_amount: ["id", "label", "currency", "method", "amount"],
  quantity_unit_cost: ["id", "label", "currency", "method", "quantity", "unitCost"],
  hours_hourly_rate: ["id", "label", "currency", "method", "hours", "hourlyRate"],
  percentage_of_parent: ["id", "label", "currency", "method", "parentId", "percent"],
  allocation_group: ["id", "label", "currency", "method", "childIds"],
  formula: ["id", "label", "currency", "method", "expression", "formulaVersion"],
};

const POWERS_OF_TEN: bigint[] = [1n];

function powerOfTen(exponent: number): bigint {
  while (POWERS_OF_TEN.length <= exponent)
    POWERS_OF_TEN.push(POWERS_OF_TEN[POWERS_OF_TEN.length - 1] * 10n);
  return POWERS_OF_TEN[exponent];
}

export class GenericApuEvaluationError extends Error {
  readonly code: GenericApuErrorCode;
  readonly status: number;

  constructor(code: GenericApuErrorCode, message: string, status = 422) {
    super(message);
    this.name = "GenericApuEvaluationError";
    this.code = code;
    this.status = status;
  }
}

function fail(code: GenericApuErrorCode, message: string): never {
  throw new GenericApuEvaluationError(code, message);
}

function normalizeDecimal(value: ExactDecimal): ExactDecimal {
  let coefficient = value.coefficient;
  let scale = value.scale;
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function boundedDecimal(value: ExactDecimal, field: string): ExactDecimal {
  const normalized = normalizeDecimal(value);
  const absolute = normalized.coefficient < 0n
    ? -normalized.coefficient
    : normalized.coefficient;
  const wholeDigits = Math.max(1, absolute.toString().length - normalized.scale);
  if (wholeDigits > MAX_WHOLE_DIGITS)
    fail("APU_INVALID_INPUT", `${field} exceeds the supported exact-decimal range.`);
  return normalized;
}

function parseDecimal(
  value: unknown,
  field: string,
  options: { nonNegative?: boolean } = {},
): ExactDecimal {
  if (
    typeof value !== "string" ||
    !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value)
  )
    fail(
      "APU_INVALID_INPUT",
      `${field} must be a canonical exact decimal string with at most six fractional digits.`,
    );
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  if (whole.length > MAX_WHOLE_DIGITS)
    fail("APU_INVALID_INPUT", `${field} exceeds the supported exact-decimal range.`);
  let coefficient = BigInt(`${whole}${fraction}`);
  if (negative && coefficient !== 0n) coefficient = -coefficient;
  if (options.nonNegative && coefficient < 0n)
    fail("APU_INVALID_INPUT", `${field} must not be negative.`);
  return normalizeDecimal({ coefficient, scale: fraction.length });
}

function decimalToString(value: ExactDecimal): string {
  const normalized = normalizeDecimal(value);
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

function add(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  return boundedDecimal({
    coefficient: align(left, scale) + align(right, scale),
    scale,
  }, "calculation result");
}

function subtract(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  return add(left, { coefficient: -right.coefficient, scale: right.scale });
}

function multiply(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  return boundedDecimal({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  }, "calculation result");
}

function percentOf(parent: ExactDecimal, percent: ExactDecimal): ExactDecimal {
  const product = multiply(parent, percent);
  return normalizeDecimal({
    coefficient: product.coefficient,
    scale: product.scale + 2,
  });
}

function compare(left: ExactDecimal, right: ExactDecimal): number {
  const scale = Math.max(left.scale, right.scale);
  const difference = align(left, scale) - align(right, scale);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function roundHalfUpMinorUnits(value: ExactDecimal): bigint {
  if (value.scale <= 2)
    return value.coefficient * powerOfTen(2 - value.scale);
  const divisor = powerOfTen(value.scale - 2);
  const negative = value.coefficient < 0n;
  const absolute = negative ? -value.coefficient : value.coefficient;
  let rounded = absolute / divisor;
  const remainder = absolute % divisor;
  if (remainder * 2n >= divisor) rounded += 1n;
  return negative ? -rounded : rounded;
}

function minorUnitsToString(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

function exactInputString(value: unknown, field: string, nonNegative = false): string {
  return decimalToString(parseDecimal(value, field, { nonNegative }));
}

function canonicalCurrency(value: unknown, field: string): CurrencyCode {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))
    fail("APU_INVALID_INPUT", `${field} must be an ISO 4217 alphabetic currency code.`);
  return value;
}

function requireCurrency(
  value: unknown,
  expected: CurrencyCode,
  field: string,
): CurrencyCode {
  const currency = canonicalCurrency(value, field);
  if (currency !== expected)
    fail(
      "APU_MIXED_CURRENCY_UNSUPPORTED",
      `${field} does not match the evaluation currency; conversion is unsupported.`,
    );
  return currency;
}

function parseMoney(
  value: MoneyInput,
  expectedCurrency: CurrencyCode,
  field: string,
  options: { nonNegative?: boolean } = {},
): ExactDecimal {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("APU_INVALID_INPUT", `${field} must be an exact currency amount.`);
  rejectUnknownProperties(value, ["amount", "currency"], field);
  requireCurrency(value.currency, expectedCurrency, `${field}.currency`);
  return parseDecimal(value.amount, `${field}.amount`, options);
}

function validIdentity(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > MAX_IDENTITY_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail("APU_INVALID_INPUT", `${field} must be a stable bounded identity.`);
  return value;
}

function rejectUnknownProperties(
  value: object,
  allowed: readonly string[],
  field: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0)
    fail(
      "APU_INVALID_INPUT",
      `${field} contains unsupported properties: ${unexpected.sort().join(", ")}.`,
    );
}

function rejectUnknownNodeProperties(node: GenericApuNode): void {
  const allowed = NODE_KEYS[node.method];
  if (!allowed) return;
  rejectUnknownProperties(node, allowed, `Node ${String(node.id)}`);
}

function sortDependencies(nodes: readonly GenericApuNode[]): GenericApuNode[] {
  return [...nodes].sort((left, right) => {
    const methodDifference =
      (METHOD_ORDER[left.method] ?? Number.MAX_SAFE_INTEGER) -
      (METHOD_ORDER[right.method] ?? Number.MAX_SAFE_INTEGER);
    return methodDifference || left.id.localeCompare(right.id);
  });
}

function evaluateLines(
  input: GenericApuEvaluationInput,
  currency: CurrencyCode,
): {
  lines: GenericApuLineResult[];
  amounts: Map<string, ExactDecimal>;
  nodes: Map<string, GenericApuNode>;
} {
  if (!Array.isArray(input.nodes))
    fail("APU_INVALID_INPUT", "nodes must be an array.");
  if (input.nodes.length > MAX_NODES)
    fail("APU_INVALID_INPUT", `nodes must contain at most ${MAX_NODES} entries.`);
  const nodes = new Map<string, GenericApuNode>();
  for (const node of input.nodes) {
    if (!node || typeof node !== "object")
      fail("APU_INVALID_INPUT", "Every node must be an object.");
    const id = validIdentity(node.id, "node.id");
    if (nodes.has(id)) fail("APU_DUPLICATE_NODE", `Duplicate node identity ${id}.`);
    if (!(node.method in METHOD_ORDER))
      fail("APU_INVALID_INPUT", `Node ${id} uses an unsupported calculation method.`);
    rejectUnknownNodeProperties(node);
    if (node.currency !== undefined)
      requireCurrency(node.currency, currency, `nodes[${id}].currency`);
    nodes.set(id, node);
  }

  if (!Array.isArray(input.rootNodeIds))
    fail("APU_INVALID_INPUT", "rootNodeIds must be an array.");
  const rootSet = new Set<string>();
  for (const rootIdValue of input.rootNodeIds) {
    const rootId = validIdentity(rootIdValue, "rootNodeIds[]");
    if (rootSet.has(rootId))
      fail("APU_INVALID_INPUT", `Duplicate root node identity ${rootId}.`);
    rootSet.add(rootId);
    if (!nodes.has(rootId))
      fail("APU_UNKNOWN_NODE_REFERENCE", `Root node ${rootId} does not exist.`);
  }

  for (const node of nodes.values()) {
    if (node.method === "percentage_of_parent" && !nodes.has(node.parentId))
      fail(
        "APU_UNKNOWN_NODE_REFERENCE",
        `Percentage node ${node.id} references unknown parent ${node.parentId}.`,
      );
    if (node.method === "allocation_group") {
      if (!Array.isArray(node.childIds))
        fail("APU_INVALID_INPUT", `Allocation group ${node.id} childIds must be an array.`);
      if (node.childIds.length === 0)
        fail("APU_INVALID_INPUT", `Allocation group ${node.id} must not be empty.`);
      if (node.childIds.length > MAX_DEPENDENCIES_PER_NODE)
        fail(
          "APU_INVALID_INPUT",
          `Allocation group ${node.id} exceeds ${MAX_DEPENDENCIES_PER_NODE} dependencies.`,
        );
      const seen = new Set<string>();
      for (const childId of node.childIds) {
        validIdentity(childId, `nodes[${node.id}].childIds[]`);
        if (seen.has(childId))
          fail("APU_INVALID_INPUT", `Allocation group ${node.id} repeats child ${childId}.`);
        seen.add(childId);
        if (!nodes.has(childId))
          fail(
            "APU_UNKNOWN_NODE_REFERENCE",
            `Allocation group ${node.id} references unknown child ${childId}.`,
          );
      }
    }
  }

  const state = new Map<string, "visiting" | "done">();
  const amounts = new Map<string, ExactDecimal>();
  const lines: GenericApuLineResult[] = [];

  const visit = (id: string): ExactDecimal => {
    const current = state.get(id);
    if (current === "visiting")
      fail("APU_DEPENDENCY_CYCLE", `Node dependency cycle reaches ${id}.`);
    if (current === "done") return amounts.get(id)!;
    const node = nodes.get(id)!;
    state.set(id, "visiting");

    let amount: ExactDecimal;
    if (node.method === "fixed_amount") {
      amount = parseDecimal(node.amount, `nodes[${id}].amount`);
    } else if (node.method === "quantity_unit_cost") {
      amount = multiply(
        parseDecimal(node.quantity, `nodes[${id}].quantity`, { nonNegative: true }),
        parseDecimal(node.unitCost, `nodes[${id}].unitCost`, { nonNegative: true }),
      );
    } else if (node.method === "hours_hourly_rate") {
      amount = multiply(
        parseDecimal(node.hours, `nodes[${id}].hours`, { nonNegative: true }),
        parseDecimal(node.hourlyRate, `nodes[${id}].hourlyRate`, {
          nonNegative: true,
        }),
      );
    } else if (node.method === "percentage_of_parent") {
      amount = percentOf(
        visit(node.parentId),
        parseDecimal(node.percent, `nodes[${id}].percent`, { nonNegative: true }),
      );
    } else if (node.method === "allocation_group") {
      const childNodes = sortDependencies(
        node.childIds.map((childId) => nodes.get(childId)!),
      );
      amount = childNodes.reduce(
        (sum, child) => add(sum, visit(child.id)),
        { coefficient: 0n, scale: 0 },
      );
    } else if (node.method === "formula") {
      fail(
        "APU_EVALUATION_UNSUPPORTED",
        `Formula node ${id} cannot be evaluated until an approved grammar/version exists.`,
      );
    } else {
      fail("APU_INVALID_INPUT", `Node ${id} uses an unsupported calculation method.`);
    }

    const normalized = normalizeDecimal(amount);
    amounts.set(id, normalized);
    state.set(id, "done");
    lines.push({
      id,
      method: node.method,
      rawAmount: decimalToString(normalized),
      roundedAmount: minorUnitsToString(roundHalfUpMinorUnits(normalized)),
      currency,
    });
    return normalized;
  };

  for (const root of sortDependencies(
    input.rootNodeIds.map((rootId) => nodes.get(rootId)!),
  ))
    visit(root.id);
  for (const node of sortDependencies([...nodes.values()])) visit(node.id);

  return { lines, amounts, nodes };
}

function remainingBudget(
  input: GenericApuEvaluationInput,
  currency: CurrencyCode,
): RemainingBudgetResult {
  const supplied = [
    input.approvedBudget,
    input.committed,
    input.actualPaid,
    input.approvedAdjustments,
  ];
  const parsed = supplied.map((money, index) =>
    money
      ? parseMoney(
          money,
          currency,
          ["approvedBudget", "committed", "actualPaid", "approvedAdjustments"][index],
        )
      : null,
  );
  const resultBase = {
    currency,
    approvedBudget: input.approvedBudget
      ? exactInputString(input.approvedBudget.amount, "approvedBudget.amount")
      : null,
    committed: input.committed
      ? exactInputString(input.committed.amount, "committed.amount")
      : null,
    actualPaid: input.actualPaid
      ? exactInputString(input.actualPaid.amount, "actualPaid.amount")
      : null,
    approvedAdjustments: input.approvedAdjustments
      ? exactInputString(input.approvedAdjustments.amount, "approvedAdjustments.amount")
      : null,
  };
  if (parsed.some((amount) => amount === null))
    return {
      available: false,
      ...resultBase,
      value: null,
      unavailableReason: "MISSING_BASELINE",
    };
  const value = subtract(
    subtract(subtract(parsed[0]!, parsed[1]!), parsed[2]!),
    parsed[3]!,
  );
  return {
    available: true,
    ...resultBase,
    value: decimalToString(value),
  };
}

function completeApproval(
  approval: NonNullable<GenericApuEvaluationInput["capCheck"]>["approval"],
  overrun: ExactDecimal,
  currency: CurrencyCode,
): boolean {
  if (!approval || typeof approval !== "object") return false;
  const amount = parseMoney(approval.amount, currency, "capCheck.approval.amount", {
    nonNegative: true,
  });
  return (
    compare(amount, overrun) >= 0 &&
    typeof approval.reason === "string" &&
    approval.reason.trim().length > 0 &&
    typeof approval.approvedBy === "string" &&
    SERVICE_APPROVER_ID.test(approval.approvedBy) &&
    typeof approval.approvedAt === "string" &&
    Number.isFinite(Date.parse(approval.approvedAt))
  );
}

function capResult(
  input: GenericApuEvaluationInput,
  currency: CurrencyCode,
): CapResult {
  if (!input.capCheck)
    return {
      state: "UNAVAILABLE",
      currency,
      capAmount: null,
      exposure: null,
      overrun: null,
      unavailableReason: "MISSING_CAP_CHECK",
    };
  if (typeof input.capCheck !== "object" || Array.isArray(input.capCheck))
    fail("APU_INVALID_INPUT", "capCheck must be an object.");
  rejectUnknownProperties(
    input.capCheck,
    ["capAmount", "projected", "committed", "actualPaid", "approval"],
    "capCheck",
  );
  if (input.capCheck.approval) {
    if (
      typeof input.capCheck.approval !== "object" ||
      Array.isArray(input.capCheck.approval)
    )
      fail("APU_INVALID_INPUT", "capCheck.approval must be an object.");
    rejectUnknownProperties(
      input.capCheck.approval,
      ["amount", "reason", "approvedBy", "approvedAt"],
      "capCheck.approval",
    );
  }
  const cap = parseMoney(input.capCheck.capAmount, currency, "capCheck.capAmount", {
    nonNegative: true,
  });
  const projected = parseMoney(
    input.capCheck.projected,
    currency,
    "capCheck.projected",
    { nonNegative: true },
  );
  const committed = parseMoney(
    input.capCheck.committed,
    currency,
    "capCheck.committed",
    { nonNegative: true },
  );
  const actualPaid = parseMoney(
    input.capCheck.actualPaid,
    currency,
    "capCheck.actualPaid",
    { nonNegative: true },
  );
  if (input.capCheck.approval)
    parseMoney(
      input.capCheck.approval.amount,
      currency,
      "capCheck.approval.amount",
      { nonNegative: true },
    );
  const exposure = add(add(projected, committed), actualPaid);
  const overrun = compare(exposure, cap) > 0
    ? subtract(exposure, cap)
    : { coefficient: 0n, scale: 0 };
  const common = {
    currency,
    capAmount: decimalToString(cap),
    exposure: decimalToString(exposure),
    overrun: decimalToString(overrun),
  };
  if (overrun.coefficient === 0n) return { state: "WITHIN_CAP", ...common };
  if (
    input.capCheck.approval &&
    completeApproval(input.capCheck.approval, overrun, currency)
  )
    return {
      state: "APPROVED_OVERRIDE",
      ...common,
      approval: input.capCheck.approval,
    };
  return { state: "NEEDS_APPROVAL", ...common };
}

function parseDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date
      : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function shiftUtcMonths(value: Date, months: number): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const shiftedFirst = new Date(
    Date.UTC(
      year,
      month + months,
      1,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(
      shiftedFirst.getUTCFullYear(),
      shiftedFirst.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  shiftedFirst.setUTCDate(Math.min(day, lastDay));
  return shiftedFirst;
}

function validateWindowEntryAmount(
  entry: ThreeMonthWindowEntry,
  currency: CurrencyCode,
): void {
  if (!entry || typeof entry !== "object" || Array.isArray(entry))
    fail("APU_INVALID_INPUT", "Every three-month window entry must be an object.");
  rejectUnknownProperties(
    entry,
    ["id", "date", "kind", "amount"],
    "threeMonthWindow.entries[]",
  );
  validIdentity(entry.id, "threeMonthWindow.entries[].id");
  if (entry.kind !== "recent" && entry.kind !== "forecast")
    fail("APU_INVALID_INPUT", `Window entry ${entry.id} has an invalid kind.`);
  if (entry.amount)
    parseMoney(entry.amount, currency, `threeMonthWindow.entries[${entry.id}].amount`);
}

function unavailableWindow(
  months: number,
  asOfDate: string | null,
  reason: "MISSING_DATES" | "INVALID_DATES",
): ThreeMonthWindowResult {
  return {
    status: "UNAVAILABLE",
    months,
    affectsEligibility: false,
    asOfDate,
    windowStart: null,
    recentEntryIds: [],
    forecastEntryIds: [],
    unavailableReason: reason,
  };
}

function threeMonthWindow(
  input: GenericApuEvaluationInput,
  currency: CurrencyCode,
): ThreeMonthWindowResult {
  const request = input.threeMonthWindow;
  if (request !== undefined) {
    if (!request || typeof request !== "object" || Array.isArray(request))
      fail("APU_INVALID_INPUT", "threeMonthWindow must be an object.");
    rejectUnknownProperties(
      request,
      ["months", "asOfDate", "entries", "affectsEligibility"],
      "threeMonthWindow",
    );
  }
  const months = request?.months ?? 3;
  if (!Number.isSafeInteger(months) || months <= 0)
    fail("APU_INVALID_INPUT", "threeMonthWindow.months must be a positive integer.");
  if (request?.affectsEligibility === true)
    fail(
      "APU_WINDOW_ELIGIBILITY_POLICY_UNSUPPORTED",
      "Three-month metadata cannot affect eligibility until an approved policy exists.",
    );
  const entries = request?.entries ?? [];
  if (!Array.isArray(entries))
    fail("APU_INVALID_INPUT", "threeMonthWindow.entries must be an array.");
  if (entries.length > MAX_WINDOW_ENTRIES)
    fail(
      "APU_INVALID_INPUT",
      `threeMonthWindow.entries must contain at most ${MAX_WINDOW_ENTRIES} entries.`,
    );
  const entryIds = new Set<string>();
  for (const entry of entries) {
    validateWindowEntryAmount(entry, currency);
    if (entryIds.has(entry.id))
      fail("APU_INVALID_INPUT", `Duplicate three-month window entry ${entry.id}.`);
    entryIds.add(entry.id);
  }
  const asOfText = request?.asOfDate ?? null;
  if (!asOfText || entries.some((entry) => !entry.date))
    return unavailableWindow(months, asOfText, "MISSING_DATES");
  const asOf = parseDate(asOfText);
  const datedEntries = entries.map((entry) => ({
    entry,
    date: parseDate(entry.date!),
  }));
  if (!asOf || datedEntries.some((item) => !item.date))
    return unavailableWindow(months, asOfText, "INVALID_DATES");
  const windowStart = shiftUtcMonths(asOf, -months);
  const windowEnd = shiftUtcMonths(asOf, months);
  const byDateThenId = (
    left: { entry: ThreeMonthWindowEntry; date: Date | null },
    right: { entry: ThreeMonthWindowEntry; date: Date | null },
  ) => left.date!.getTime() - right.date!.getTime() || left.entry.id.localeCompare(right.entry.id);
  const recentEntryIds = datedEntries
    .filter(
      ({ entry, date }) =>
        entry.kind === "recent" && date! >= windowStart && date! <= asOf,
    )
    .sort(byDateThenId)
    .map(({ entry }) => entry.id);
  const forecastEntryIds = datedEntries
    .filter(
      ({ entry, date }) =>
        entry.kind === "forecast" && date! >= asOf && date! <= windowEnd,
    )
    .sort(byDateThenId)
    .map(({ entry }) => entry.id);
  return {
    status: "AVAILABLE",
    months,
    affectsEligibility: false,
    asOfDate: asOfText,
    windowStart: windowStart.toISOString(),
    recentEntryIds,
    forecastEntryIds,
  };
}

export function evaluateGenericApu(
  input: GenericApuEvaluationInput,
): GenericApuEvaluationResult {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("APU_INVALID_INPUT", "Evaluation input must be an object.");
  rejectUnknownProperties(
    input,
    [
      "currency",
      "nodes",
      "rootNodeIds",
      "approvedBudget",
      "committed",
      "actualPaid",
      "approvedAdjustments",
      "capCheck",
      "threeMonthWindow",
      "roundingResidualToleranceMinorUnits",
    ],
    "Evaluation input",
  );
  const currency = canonicalCurrency(input.currency, "currency");
  const tolerance = input.roundingResidualToleranceMinorUnits ?? 1;
  if (!Number.isSafeInteger(tolerance) || tolerance < 0)
    fail(
      "APU_INVALID_INPUT",
      "roundingResidualToleranceMinorUnits must be a non-negative safe integer.",
    );

  const evaluated = evaluateLines(input, currency);
  const rootAmounts = input.rootNodeIds.map((rootId) => evaluated.amounts.get(rootId)!);
  const rawTotal = rootAmounts.reduce(
    (sum, amount) => add(sum, amount),
    { coefficient: 0n, scale: 0 },
  );
  const roundedTotalMinorUnits = roundHalfUpMinorUnits(rawTotal);
  const roundedRootLineMinorUnits = rootAmounts.reduce(
    (sum, amount) => sum + roundHalfUpMinorUnits(amount),
    0n,
  );
  const residualMinorUnits = roundedTotalMinorUnits - roundedRootLineMinorUnits;
  const absoluteResidual = residualMinorUnits < 0n
    ? -residualMinorUnits
    : residualMinorUnits;
  if (absoluteResidual > BigInt(tolerance))
    fail(
      "APU_ROUNDING_RESIDUAL_EXCEEDED",
      `Rounding residual ${minorUnitsToString(residualMinorUnits)} exceeds the configured tolerance.`,
    );

  return {
    currency,
    lines: evaluated.lines,
    rootNodeIds: [...input.rootNodeIds],
    rawTotal: decimalToString(rawTotal),
    roundedTotal: minorUnitsToString(roundedTotalMinorUnits),
    roundingAdjustment: {
      amount: minorUnitsToString(residualMinorUnits),
      currency,
      reason: "ROUNDING_RESIDUAL",
      toleranceMinorUnits: tolerance,
    },
    remainingBudget: remainingBudget(input, currency),
    cap: capResult(input, currency),
    threeMonthWindow: threeMonthWindow(input, currency),
  };
}
