import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft, Check } from "lucide-react";

const FREE_FEATURES = [
  "1 active project",
  "3 months full access",
  "Naming convention builder",
  "Name generator",
  "File upload with server-side validation",
  "RFI tracking and management",
  "Submittal register",
  "Activity log — immutable audit trail",
  "Team management — up to 5 members",
  "Bilingual EN/ES",
  "BIMLog Sync Agent — desktop app",
  "Email support",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Unlimited active projects",
  "Document Integrity System — SHA-256 cryptographic fingerprinting",
  "Mandatory declaration logging on every upload",
  "Duplicate content detection",
  "Superseded version tracking",
  "AI Pre-Submission Compliance Check",
  "Procurement Before Approval warning",
  "Rapid Approval Detection",
  "Full RFI lifecycle — ball-in-court tracking, multiple responses, conflict detection",
  "Submittal Register with lead time management",
  "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident",
  "AI-assisted RFI question and response drafting",
  "AI-assisted submittal description rewriting",
  "Convention Builder — 4-step wizard, ISO 19650 defaults",
  "Automated email notifications",
  "Analytics dashboard",
  "Export to Excel — RFI log, Submittal log",
  "Export to Word and PDF",
  "Team invite by email",
  "Up to 25 team members per project",
  "Priority email support",
];

const BUSINESS_FEATURES = [
  "Everything in Professional, plus:",
  "Unlimited team members",
  "Transmittal Manager",
  "Meeting Minutes and Action Items tracker",
  "AI Report Assistant — natural language queries across all project data",
  "Coordination Accountability Report",
  "Discipline Performance Report",
  "BIMLog Performance Score — company-level verified rating",
  "Compliance Badge — verifiable digital award on project completion",
  "Direct platform integrations — Procore, Autodesk ACC, OneDrive, SharePoint",
  "MS Project schedule import",
  "Delay Attribution reporting",
  "Drawing Register",
  "Change Order Log",
  "Punch List and Snagging",
  "Daily Reports",
  "PowerBI connector",
  "Dedicated onboarding support",
  "Phone and email support",
  "SLA guaranteed uptime",
];

const ENTERPRISE_FEATURES = [
  "Everything in Business, plus:",
  "White-label option — your logo and branding",
  "Custom report templates tailored to your requirements",
  "BIMLog Sync Agent — enterprise folder watching and automatic validation",
  "OAuth connections — secure token-based direct integrations",
  "Full API access with webhooks",
  "Custom data retention policy",
  "Dedicated account manager",
  "Custom SLA and uptime guarantees",
  "Bulk seat pricing",
  "Priority feature development — your requests go to the top of the roadmap",
  "Founding Partner designation — if signing before public launch",
  "Locked pricing for 36 months",
];

const FAQS = [
  {
    q: "Do I need to ask my GC's permission to use BIMLog?",
    a: "No. Subcontractors and coordinators can sign up and use BIMLog on any project independently. You do not need permission from anyone above you in the project hierarchy. Start building your project record today for free.",
  },
  {
    q: "Does BIMLog replace Procore or Autodesk?",
    a: "No. BIMLog works with the tools your team already uses. It connects to Procore, Autodesk, OneDrive, and others — adding the governance and accountability layer those platforms do not provide. You keep using the tools you know. BIMLog makes them accountable.",
  },
  {
    q: "What happens to my data after 3 months on the free tier?",
    a: "Your project moves to read-only mode. All data and audit trails are permanently retained. You can still view and export everything. You just cannot upload new files or create new RFIs without upgrading.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256. Infrastructure is hosted on AWS with US-East and São Paulo regions. We do not store physical files — only metadata and audit records. Full details in our Privacy Policy.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Every log, every RFI, every submittal, every audit certificate is exportable at any time. Your data belongs to you. We are a recording system, not a lock-in.",
  },
  {
    q: "What is the Founding Partner program?",
    a: "We are currently accepting a limited number of founding partners — GCs and BIM coordination firms who will help shape the platform and receive locked pricing for 3 years. Contact us at info@ignitesmart.ai to discuss.",
  },
];

interface TierCardProps {
  name: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
}

function TierCard({ name, subtitle, price, priceNote, features, ctaLabel, ctaHref, highlight }: TierCardProps) {
  return (
    <div style={{
      flex: 1, minWidth: 240,
      background: highlight ? "hsl(var(--primary))" : "hsl(var(--card))",
      border: highlight ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
      borderRadius: 14,
      padding: "28px 24px",
      display: "flex", flexDirection: "column",
      position: "relative",
    }}>
      {highlight && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "white", fontSize: 10, fontWeight: 800, padding: "3px 12px", borderRadius: 99, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          MOST POPULAR
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: highlight ? "rgba(255,255,255,0.7)" : "hsl(var(--primary))", marginBottom: 6 }}>{name}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: highlight ? "white" : "hsl(var(--foreground))", marginBottom: 8 }}>{subtitle}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? "white" : "hsl(var(--foreground))" }}>{price}</div>
        {priceNote && <div style={{ fontSize: 12, color: highlight ? "rgba(255,255,255,0.65)" : "hsl(var(--muted-foreground))", marginTop: 2 }}>{priceNote}</div>}
      </div>

      <div style={{ flex: 1, marginBottom: 24 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            {f.endsWith(":") ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: highlight ? "rgba(255,255,255,0.6)" : "hsl(var(--muted-foreground))", marginTop: 4, display: "block" }}>{f}</span>
            ) : (
              <>
                <Check style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: highlight ? "rgba(255,255,255,0.9)" : "#22c55e" }} />
                <span style={{ fontSize: 13, color: highlight ? "rgba(255,255,255,0.85)" : "hsl(var(--foreground))", lineHeight: 1.5 }}>{f}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <a
        href={ctaHref}
        style={{
          display: "block", textAlign: "center", padding: "11px 20px",
          borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none",
          background: highlight ? "white" : "hsl(var(--primary))",
          color: highlight ? "hsl(var(--primary))" : "white",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

export function Pricing() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px", flex: 1, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Back to home
        </Link>

        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>Pricing</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 14, fontFamily: "var(--font-display)" }}>
            Simple, transparent pricing that scales with your projects
          </h1>
          <p style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", maxWidth: 560, margin: "0 auto" }}>
            Start free. Upgrade when you are ready. No credit card required to get started.
          </p>
        </div>

        {/* Tier Cards */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 72, alignItems: "flex-start" }}>
          <TierCard
            name="Free"
            subtitle="Perfect for getting started"
            price="$0"
            priceNote="No credit card required"
            features={FREE_FEATURES}
            ctaLabel="Start Free — no credit card required"
            ctaHref="/register"
          />
          <TierCard
            name="Professional"
            subtitle="For active project teams"
            price="Contact us for pricing"
            features={PRO_FEATURES}
            ctaLabel="Contact Us for Pricing"
            ctaHref="/contact"
            highlight
          />
          <TierCard
            name="Business"
            subtitle="For firms running multiple concurrent projects"
            price="Contact us for pricing"
            features={BUSINESS_FEATURES}
            ctaLabel="Contact Us for Pricing"
            ctaHref="/contact"
          />
          <TierCard
            name="Enterprise"
            subtitle="For large GCs, developers, and institutions"
            price="Custom pricing"
            priceNote="Contact us for a proposal"
            features={ENTERPRISE_FEATURES}
            ctaLabel="Contact Us — we build a proposal around your portfolio"
            ctaHref="/contact"
          />
        </div>

        {/* ROI Section */}
        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, padding: "36px 40px", marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>
            Why BIMLog pays for itself
          </h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
            Industry research across thousands of AEC professionals shows:
          </p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              { stat: "30–40%", label: "of submittals are rejected on first submission" },
              { stat: "$805", label: "average cost per rejection in administrative time and delay" },
              { stat: "$500k+", label: "lost on a project with 2,000 submittals at 35% rejection rate" },
              { stat: "2–4 weeks", label: "added to the project schedule per rejection" },
            ].map(item => (
              <div key={item.stat} style={{ flex: 1, minWidth: 180, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "20px 20px" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "hsl(var(--primary))", marginBottom: 4 }}>{item.stat}</div>
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 14, color: "hsl(var(--foreground))", lineHeight: 1.7, margin: 0 }}>
            BIMLog's AI pre-submission check catches the 7 most common rejection causes before the submittal leaves your hands.{" "}
            <strong>One prevented rejection on a complex submittal pays for BIMLog for an entire year.</strong>{" "}
            And that is before you count the value of having a legally defensible audit trail when a dispute arises.
          </p>
        </div>

        {/* FAQ Section */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 32, fontFamily: "var(--font-display)" }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 8 }}>{faq.q}</div>
                <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
