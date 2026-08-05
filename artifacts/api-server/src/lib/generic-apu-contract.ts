export const GENERIC_APU_METHODS = [
  "fixed_amount",
  "quantity_unit_cost",
  "hours_hourly_rate",
  "percentage_of_parent",
  "allocation_group",
  "formula",
] as const;

export type GenericApuMethod = (typeof GENERIC_APU_METHODS)[number];
export type DecimalString = string;
export type CurrencyCode = string;

export type GenericApuErrorCode =
  | "APU_INVALID_INPUT"
  | "APU_DUPLICATE_NODE"
  | "APU_UNKNOWN_NODE_REFERENCE"
  | "APU_DEPENDENCY_CYCLE"
  | "APU_MIXED_CURRENCY_UNSUPPORTED"
  | "APU_EVALUATION_UNSUPPORTED"
  | "APU_ROUNDING_RESIDUAL_EXCEEDED"
  | "APU_WINDOW_ELIGIBILITY_POLICY_UNSUPPORTED";

export interface MoneyInput {
  readonly amount: DecimalString;
  readonly currency: CurrencyCode;
}

export interface GenericApuNodeBase {
  readonly id: string;
  readonly label?: string;
  readonly currency?: CurrencyCode;
}

export interface FixedAmountNode extends GenericApuNodeBase {
  readonly method: "fixed_amount";
  readonly amount: DecimalString;
}

export interface QuantityUnitCostNode extends GenericApuNodeBase {
  readonly method: "quantity_unit_cost";
  readonly quantity: DecimalString;
  readonly unitCost: DecimalString;
}

export interface HoursHourlyRateNode extends GenericApuNodeBase {
  readonly method: "hours_hourly_rate";
  readonly hours: DecimalString;
  readonly hourlyRate: DecimalString;
}

export interface PercentageOfParentNode extends GenericApuNodeBase {
  readonly method: "percentage_of_parent";
  readonly parentId: string;
  readonly percent: DecimalString;
}

export interface AllocationGroupNode extends GenericApuNodeBase {
  readonly method: "allocation_group";
  readonly childIds: readonly string[];
}

export interface FormulaNode extends GenericApuNodeBase {
  readonly method: "formula";
  readonly expression: string;
  readonly formulaVersion?: string;
}

export type GenericApuNode =
  | FixedAmountNode
  | QuantityUnitCostNode
  | HoursHourlyRateNode
  | PercentageOfParentNode
  | AllocationGroupNode
  | FormulaNode;

export interface OverrunApprovalInput {
  readonly amount: MoneyInput;
  readonly reason: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export interface CapCheckInput {
  readonly capAmount: MoneyInput;
  readonly projected: MoneyInput;
  readonly committed: MoneyInput;
  readonly actualPaid: MoneyInput;
  readonly approval?: OverrunApprovalInput;
}

export interface ThreeMonthWindowEntry {
  readonly id: string;
  readonly date?: string;
  readonly kind: "recent" | "forecast";
  readonly amount?: MoneyInput;
}

export interface ThreeMonthWindowInput {
  readonly months?: number;
  readonly asOfDate?: string;
  readonly entries?: readonly ThreeMonthWindowEntry[];
  readonly affectsEligibility?: boolean;
}

export interface GenericApuEvaluationInput {
  readonly currency: CurrencyCode;
  readonly nodes: readonly GenericApuNode[];
  readonly rootNodeIds: readonly string[];
  readonly approvedBudget?: MoneyInput;
  readonly committed?: MoneyInput;
  readonly actualPaid?: MoneyInput;
  readonly approvedAdjustments?: MoneyInput;
  readonly capCheck?: CapCheckInput;
  readonly threeMonthWindow?: ThreeMonthWindowInput;
  readonly roundingResidualToleranceMinorUnits?: number;
}

export interface GenericApuLineResult {
  readonly id: string;
  readonly method: GenericApuMethod;
  readonly rawAmount: DecimalString;
  readonly roundedAmount: DecimalString;
  readonly currency: CurrencyCode;
}

export interface RoundingAdjustmentResult {
  readonly amount: DecimalString;
  readonly currency: CurrencyCode;
  readonly reason: "ROUNDING_RESIDUAL";
  readonly toleranceMinorUnits: number;
}

export interface RemainingBudgetResult {
  readonly available: boolean;
  readonly currency: CurrencyCode;
  readonly approvedBudget: DecimalString | null;
  readonly committed: DecimalString | null;
  readonly actualPaid: DecimalString | null;
  readonly approvedAdjustments: DecimalString | null;
  readonly value: DecimalString | null;
  readonly unavailableReason?: "MISSING_BASELINE";
}

export type CapState =
  | "WITHIN_CAP"
  | "NEEDS_APPROVAL"
  | "APPROVED_OVERRIDE"
  | "UNAVAILABLE";

interface AvailableCapResultBase {
  readonly currency: CurrencyCode;
  readonly capAmount: DecimalString;
  readonly exposure: DecimalString;
  readonly overrun: DecimalString;
  readonly unavailableReason?: never;
}

export type CapResult =
  | (AvailableCapResultBase & {
      readonly state: "WITHIN_CAP" | "NEEDS_APPROVAL";
      readonly approval?: never;
    })
  | (AvailableCapResultBase & {
      readonly state: "APPROVED_OVERRIDE";
      readonly approval: OverrunApprovalInput;
    })
  | {
      readonly state: "UNAVAILABLE";
      readonly currency: CurrencyCode;
      readonly capAmount: null;
      readonly exposure: null;
      readonly overrun: null;
      readonly approval?: never;
      readonly unavailableReason: "MISSING_CAP_CHECK";
    };

export interface ThreeMonthWindowResult {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly months: number;
  readonly affectsEligibility: false;
  readonly asOfDate: string | null;
  readonly windowStart: string | null;
  readonly recentEntryIds: readonly string[];
  readonly forecastEntryIds: readonly string[];
  readonly unavailableReason?: "MISSING_DATES" | "INVALID_DATES";
}

export interface GenericApuEvaluationResult {
  readonly currency: CurrencyCode;
  readonly lines: readonly GenericApuLineResult[];
  readonly rootNodeIds: readonly string[];
  readonly rawTotal: DecimalString;
  readonly roundedTotal: DecimalString;
  readonly roundingAdjustment: RoundingAdjustmentResult;
  readonly remainingBudget: RemainingBudgetResult;
  readonly cap: CapResult;
  readonly threeMonthWindow: ThreeMonthWindowResult;
}

export interface GenericApuEvaluatorContract {
  evaluateGenericApu(
    input: GenericApuEvaluationInput,
  ): GenericApuEvaluationResult;
}

export type GenericApuEvaluator =
  GenericApuEvaluatorContract["evaluateGenericApu"];
