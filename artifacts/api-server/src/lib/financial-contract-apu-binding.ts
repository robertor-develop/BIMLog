import { FinancialControlError } from "./financial-control-contract";
import { contractCurrency, exactPositiveAmount, type ContractLineInput } from "./financial-contract-contract";

type SavedPlan = {
  content: { currency?: unknown; sellingPrice?: unknown } & Record<string, unknown>;
  evaluation: Record<string, unknown>;
  content_fingerprint: string;
};

export function pinContractItemApuSnapshot(
  line: ContractLineInput,
  source: SavedPlan,
  currency: string,
): ContractLineInput {
  if (contractCurrency(source.content?.currency) !== currency)
    throw new FinancialControlError(400, "CONTRACT_ITEM_APU_CURRENCY_MISMATCH", "Contract Item APU currency must match the Contract currency.");
  // A Generic APU selling price describes the whole saved plan. The separately
  // validated Contract Item quantity, unit rate and value must not be rewritten.
  exactPositiveAmount(String(source.content?.sellingPrice ?? ""), "apu.sellingPrice");
  return {
    ...line,
    contractItem: {
      ...line.contractItem,
      apuFingerprint: String(source.content_fingerprint),
      apuContent: source.content,
      apuEvaluation: source.evaluation,
    },
  };
}
