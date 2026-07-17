export type FeaturePolicySupportReview = {
  company: boolean;
  project: boolean;
  user: boolean;
  configurationKeys: readonly string[];
  reason: string;
};

// Reviewed canonical support declarations. A scope is true only when the
// corresponding policy is consumed by the entitlement resolver today.
export const FEATURE_POLICY_SUPPORT_MATRIX = {
  "rfi.core": { company: true, project: true, user: false, configurationKeys: [], reason: "Organizations and projects may restrict RFI access; the security-critical core is not an ordinary user preference." },
  "rfi.export.pdf": { company: true, project: true, user: true, configurationKeys: ["include_audit_metadata"], reason: "PDF export availability and its audit-metadata option have canonical resolver effects." },
  "rfi.export.excel": { company: true, project: true, user: true, configurationKeys: ["include_closed_items"], reason: "Excel export availability and closed-item inclusion have canonical resolver effects." },
  "rfi.ai.email_draft": { company: true, project: true, user: true, configurationKeys: [], reason: "Each scope may restrict the optional click-driven drafting capability; enabling never sends email." },
  "rfi.ai.presubmission_check": { company: false, project: false, user: false, configurationKeys: [], reason: "Coming Later capabilities cannot be configured or enabled." },
  "rfi.ai.name_suggestion": { company: false, project: false, user: false, configurationKeys: [], reason: "Coming Later capabilities cannot be configured or enabled." },
  "telegram.linking": { company: false, project: false, user: false, configurationKeys: [], reason: "Linking consent is governed only by the verified link and revocation workflow." },
  "telegram.assistant": { company: true, project: true, user: true, configurationKeys: [], reason: "The optional assistant may be restricted at each scope; no preference authorizes execution." },
  "telegram.support": { company: false, project: false, user: false, configurationKeys: [], reason: "Support-case access is an account workflow, not an ordinary feature preference." },
  "telegram.delivery_concierge": { company: true, project: true, user: true, configurationKeys: [], reason: "The optional delivery helper may be restricted, while exact artifact and recipient confirmation remains mandatory." },
  "navisworks.lens": { company: true, project: true, user: false, configurationKeys: [], reason: "Company and project authorities may restrict the integration; individual preference does not replace project governance." },
  "ai.file_reading_control": { company: false, project: false, user: false, configurationKeys: [], reason: "This is a control classification and exact file-and-scope confirmation can never be disabled." },
  "notifications.deterministic": { company: false, project: false, user: false, configurationKeys: [], reason: "Coming Later capability; no customer notification control exists yet." },
  "concierge.click_driven": { company: false, project: false, user: false, configurationKeys: [], reason: "Concierge Assist remains Coming Later and is not configurable." },
  "concierge.intelligence": { company: false, project: false, user: false, configurationKeys: [], reason: "Coming Later add-on cannot be configured or enabled." },
  "concierge.proactive": { company: false, project: false, user: false, configurationKeys: [], reason: "Preview-only proactive AI cannot be enabled and never defaults on." },
  "concierge.executive": { company: false, project: false, user: false, configurationKeys: [], reason: "Preview-only executive automation cannot be configured or enabled." },
  "cost_financial_control": { company: false, project: false, user: false, configurationKeys: [], reason: "Separate Coming Later product family; Finance Build 1 has not started." },
  "geotwin_bim_10d": { company: false, project: false, user: false, configurationKeys: [], reason: "Future concept without an operational policy effect." },
} as const satisfies Record<string, FeaturePolicySupportReview>;
