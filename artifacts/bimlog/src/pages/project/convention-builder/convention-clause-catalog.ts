export interface ConventionClauseDefinition {
  code: string;
  name: string;
  desc: string;
}

export interface ConventionClauseCategory {
  cat: "Cost & Quantity" | "Contracts & Legal";
  types: ConventionClauseDefinition[];
}

export const FINANCIAL_AND_PARTY_CLAUSE_CATEGORIES: ConventionClauseCategory[] = [
  { cat: "Cost & Quantity", types: [
    { code: "ES", name: "Estimate", desc: "Cost estimate" },
    { code: "BQ", name: "Bill of Quantities", desc: "Detailed BOQ" },
    { code: "VO", name: "Variation Order", desc: "Change order document" },
    { code: "CO", name: "Change Order", desc: "Contract change order" },
    { code: "CL", name: "Cost Log", desc: "Running cost log" },
    { code: "CB", name: "Cost Breakdown", desc: "Cost breakdown structure" },
    { code: "CV", name: "Cost Variation", desc: "Cost variation report" },
    { code: "TK", name: "Takeoff", desc: "Quantity takeoff" },
    { code: "BU", name: "Budget", desc: "Project budget document" },
    { code: "CFW", name: "Cash Flow", desc: "Cash flow forecast" },
  ]},
  { cat: "Contracts & Legal", types: [
    { code: "CT", name: "Contract", desc: "Contract document" },
    { code: "AG", name: "Agreement", desc: "Project agreement" },
    { code: "NDA", name: "Non Disclosure", desc: "Confidentiality agreement" },
    { code: "NL", name: "Notice Letter", desc: "Formal notice" },
    { code: "EXT", name: "Extension of Time", desc: "EOT claim document" },
    { code: "NC", name: "Non Conformance", desc: "Non conformance report" },
    { code: "RFI", name: "Request for Info", desc: "Formal RFI document" },
    { code: "RFC", name: "Request for Change", desc: "Change request document" },
    { code: "RFP", name: "Request for Proposal", desc: "Procurement document" },
    { code: "RFQ", name: "Request for Quotation", desc: "Tender document" },
    { code: "TN", name: "Tender", desc: "Tender submission" },
    { code: "BI", name: "Bid", desc: "Bid document" },
    { code: "PO", name: "Purchase Order", desc: "Procurement order" },
    { code: "WO", name: "Work Order", desc: "Work instruction order" },
    { code: "LI", name: "Letter of Intent", desc: "LOI document" },
    { code: "PC", name: "Practical Completion", desc: "Completion certificate" },
    { code: "DL", name: "Defects List", desc: "Snagging and defects list" },
  ]},
];
