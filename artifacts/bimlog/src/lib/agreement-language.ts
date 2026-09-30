export type AgreementSummary = {
  provider: string;
  customer: string;
  agreement: string;
  plainLabel: string;
};

const text = (value: unknown) => String(value ?? "").trim();

export function agreementSummaries(data: any): AgreementSummary[] {
  const participants = new Map(
    (Array.isArray(data?.relationships?.participants) ? data.relationships.participants : [])
      .map((entry: any) => [text(entry.id), text(entry.companyName)]),
  );
  const engagements = new Map<string, any>(
    (Array.isArray(data?.relationships?.engagements) ? data.relationships.engagements : [])
      .map((entry: any) => [text(entry.id), entry]),
  );
  return (Array.isArray(data?.commercial?.contracts) ? data.commercial.contracts : []).map((contract: any, index: number) => {
    const relationship = engagements.get(text(contract.engagementId));
    const provider = participants.get(text(relationship?.providerParticipantId)) || text(contract.contractorName) || "Service provider";
    const customer = participants.get(text(relationship?.customerParticipantId)) || text(contract.clientName) || "Customer";
    const agreement = text(contract.title) || text(contract.contractNumber) || `Agreement ${index + 1}`;
    return { provider, customer, agreement, plainLabel: `${provider} delivers to ${customer} under ${agreement}` };
  });
}
