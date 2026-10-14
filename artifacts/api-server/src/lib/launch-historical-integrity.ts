export type LaunchHistoricalIntegrityStatus = "protected" | "configuration_only";

export type LaunchHistoricalIntegrityItem = {
  artifact: "invoices" | "receipts_and_payments" | "contracts" | "customer_communications" | "audit_records" | "exports_and_final_reports";
  status: LaunchHistoricalIntegrityStatus;
  rule: "issued_snapshot_immutable" | "provider_evidence_immutable" | "source_record_immutable" | "delivery_evidence_immutable" | "revision_history_immutable" | "prospective_configuration";
  evidence: string;
};

const registry: readonly LaunchHistoricalIntegrityItem[] = [
  { artifact: "invoices", status: "protected", rule: "issued_snapshot_immutable", evidence: "commercial-invoice-party-snapshot" },
  { artifact: "receipts_and_payments", status: "protected", rule: "provider_evidence_immutable", evidence: "commercial-provider-event-and-payment-record" },
  { artifact: "contracts", status: "configuration_only", rule: "source_record_immutable", evidence: "launch-settings-do-not-mutate-contract-records" },
  { artifact: "customer_communications", status: "protected", rule: "delivery_evidence_immutable", evidence: "commercial-fulfillment-delivery-evidence" },
  { artifact: "audit_records", status: "protected", rule: "revision_history_immutable", evidence: "launch-configuration-version-history" },
  { artifact: "exports_and_final_reports", status: "configuration_only", rule: "prospective_configuration", evidence: "launch-settings-apply-to-newly-generated-output" },
] as const;

export function inspectLaunchHistoricalIntegrity() {
  const items = registry.map(item => ({ ...item }));
  return {
    classification: "HISTORICAL_INTEGRITY_DECLARED" as const,
    prospectiveSettingsOnly: true,
    protectedCount: items.filter(item => item.status === "protected").length,
    items,
  };
}
