import { parseIntakeReturn, type IntakeReturnContext } from "./return-context";

export type ContractDeepLink = {
  contractId: string | null;
  intakeReturn: IntakeReturnContext | null;
  invalid: boolean;
};

const contractIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function parseContractDeepLink(search: string, projectId: number): ContractDeepLink {
  const params = new URLSearchParams(search);
  const ids = params.getAll("contractId");
  const rawId = ids.length === 1 ? ids[0] : "";
  const contractId = contractIdPattern.test(rawId) ? rawId : null;
  const parsedReturn = parseIntakeReturn(search);
  const intakeReturn = parsedReturn?.projectId === projectId ? parsedReturn : null;
  const invalidReturn = params.has("returnTo") && !intakeReturn;
  return {
    contractId,
    intakeReturn,
    invalid: ids.length > 1 || (ids.length === 1 && !contractId) || invalidReturn,
  };
}

export function contractRegisterHref(projectId: number, intakeReturn: IntakeReturnContext | null): string {
  const base = `/projects/${projectId}/financial/contracts`;
  return intakeReturn ? `${base}?returnTo=${encodeURIComponent(intakeReturn.href)}` : base;
}
