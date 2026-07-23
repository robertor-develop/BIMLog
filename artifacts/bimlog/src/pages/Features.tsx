import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft, Check } from "lucide-react";

const SECTIONS = [
  {
    heading: "Document Intelligence",
    description: "Every file that enters your project is validated, fingerprinted, and recorded before it goes anywhere.",
    features: [
      "Server-side naming convention validation — ISO 19650 defaults or custom 4-step builder",
      "SHA-256 cryptographic fingerprinting — tamper-evident proof of file content at upload",
      "Mandatory declaration on every upload — uploader declares relationship to superseded version",
      "Duplicate content detection — catches re-uploaded files regardless of filename changes",
      "Superseded version tracking — full lineage from first issue to current revision",
      "Convention violation flagging with email notification to project admin",
      "AI Name Suggestion — generates a compliant filename from plain English description",
      "BIMLog Sync Agent — Windows desktop app that watches folders and validates automatically",
    ],
  },
  {
    heading: "RFI Management",
    description: "Full RFI lifecycle from creation to close — tracked, audited, and ready to export.",
    features: [
      "Create RFIs with subject, discipline, question, and due date",
      "Ball-in-court tracking — always know who is responsible and for how long",
      "Multiple response rounds with full history",
      "Conflict detection — flags RFIs that reference disputed information",
      "Rapid Approval Detection — flags reviews completed in under 60 seconds",
      "AI-assisted RFI question drafting — write better questions faster",
      "AI-assisted response drafting — structured answers in seconds",
      "Export individual RFIs to Word and PDF with checkboxes",
      "Export full RFI log to Excel",
      "Email notification when an RFI is assigned to you",
      "Email notification when an RFI goes overdue",
    ],
  },
  {
    heading: "Submittal Register",
    description: "Track every submittal from first submission through approval — with lead times, compliance checks, and audit certificates.",
    features: [
      "Submittal register with status tracking — In Review, Approved, Rejected, Revise and Resubmit",
      "Lead time management — enter required lead time and track against schedule",
      "AI Pre-Submission Compliance Check — catches the 7 most common rejection causes before submission",
      "Procurement Before Approval warning — catches the most expensive mistake in construction",
      "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident",
      "AI-assisted submittal description rewriting — professional language in seconds",
      "Export individual submittals to Word and PDF",
      "Export full submittal log to Excel",
      "Email notification when a submittal is assigned to you",
    ],
  },
  {
    heading: "Immutable Activity Log",
    description: "Every action on the platform is recorded, timestamped, and permanently retained.",
    features: [
      "Every file upload, status change, RFI response, and team change is logged",
      "Immutable — records cannot be edited or deleted by any user",
      "Timestamped with UTC precision",
      "User identity recorded on every entry",
      "Company identity recorded on every entry",
      "Exportable at any time for legal or contractual purposes",
      "Audit Certificate generation — UUID-certified PDF ready for dispute resolution",
      "7-year retention after project completion",
    ],
  },
  {
    heading: "Team and Access Control",
    description: "Role-based access that mirrors how construction teams actually work.",
    features: [
      "Four roles — Drafter, Coordinator, BIM Manager, Project Admin",
      "Invite team members by email",
      "Per-project membership — users only see projects they are on",
      "Project Admin controls who can upload, respond, and approve",
      "Email notification when a team member is added to a project",
      "Up to 5 members on Free tier, 25 on Professional, unlimited on Business and Enterprise",
    ],
  },
  {
    heading: "Naming Convention Builder",
    description: "Build and enforce your project's naming convention — from scratch or from ISO 19650 defaults.",
    features: [
      "4-step wizard to define your convention",
      "ISO 19650 field defaults pre-loaded",
      "Custom fields for project code, originator, volume, level, type, role, and sequence",
      "Convention acceptance — team members must accept before uploading",
      "Real-time validation feedback on upload",
      "AI Name Generator — enter a plain English description, get a compliant filename",
      "Convention violation log with trigger and email notification",
    ],
  },
  {
    heading: "Analytics and Reporting",
    description: "Understand how your project is performing — compliance rates, RFI aging, violation trends.",
    features: [
      "Compliance rate dashboard — percentage of files passing convention on first upload",
      "Violations by company — identify which firms are causing the most issues",
      "RFI aging report — how long RFIs have been open and with whom",
      "Submittal lead time performance",
      "Rapid Approval Detection analytics",
      "Procurement risk alerts",
      "AI Report Assistant — natural language queries across all project data (Business and above)",
      "Discipline Performance Report (Business and above)",
      "BIMLog Performance Score — company-level verified rating (Business and above)",
    ],
  },
  {
    heading: "Integrations and Exports",
    description: "BIMLog supports governed file exchange and approved connectors without making every provider a public dependency.",
    features: [
      "Approved read-only file sources when configured",
      "Open-format exchange — IFC/openBIM, Excel, CSV, Word, and PDF",
      "Export to Excel — RFI log, Submittal log",
      "Export to Word and PDF — individual RFIs and Submittals",
      "Audit Certificate PDF export",
      "Authenticated API access for supported BIMLog workflows",
      "BIMLog Sync Agent — Windows desktop app for automatic folder watching and validation",
    ],
  },
];

function FeatureSection({ section, index }: { section: typeof SECTIONS[0]; index: number }) {
  const accent = index % 2 === 0 ? "hsl(var(--primary))" : "#7c3aed";
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ width: 4, height: 32, background: accent, borderRadius: 2, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>{section.heading}</h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7, marginBottom: 20 }}>{section.description}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${accent}18`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Check style={{ width: 10, height: 10, color: accent }} />
                </div>
                <span style={{ fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px", flex: 1, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Back to home
        </Link>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>Platform</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 14, fontFamily: "var(--font-display)" }}>
          BIMLog Features
        </h1>
        <p style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", marginBottom: 64, lineHeight: 1.7 }}>
          Everything you need to govern your project from first file to final certificate.
        </p>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 48 }}>
          {SECTIONS.map((section, i) => (
            <FeatureSection key={section.heading} section={section} index={i} />
          ))}
        </div>

        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "32px 36px", textAlign: "center", marginTop: 16 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>Ready to get started?</h3>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
            Your first project is free. No credit card required. Start building your project record today.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/register" style={{ background: "hsl(var(--primary))", color: "white", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Start Free</a>
            <a href="/pricing" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>View Pricing</a>
            <a href="/contact" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Contact Us</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
