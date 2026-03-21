import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft } from "lucide-react";

export function About() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", flex: 1 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Back to home
        </Link>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>About</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 16, fontFamily: "var(--font-display)" }}>
          BIMLog by IgniteSmart
        </h1>
        <p style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", lineHeight: 1.75, marginBottom: 40 }}>
          BIMLog is a product of BIMCapital Partners INC, operated through its IgniteSmart technology division.
          Founded by Roberto Rodriguez, BIMLog was built by practitioners who lived the pain of BIM coordination firsthand.
          Every feature exists because someone on a real project felt that pain and had no tool to solve it.
        </p>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 40, marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 20, fontFamily: "var(--font-display)" }}>
            The problem we solve
          </h2>
          <p style={{ fontSize: 15, color: "hsl(var(--muted-foreground))", lineHeight: 1.75, marginBottom: 16 }}>
            Construction projects generate thousands of documents, submittals, and RFIs. The industry runs on accountability —
            who uploaded what, when, with what authority, and whether it was reviewed properly. Yet most project teams manage this
            in spreadsheets, email threads, and shared drives with no audit trail and no enforcement.
          </p>
          <p style={{ fontSize: 15, color: "hsl(var(--muted-foreground))", lineHeight: 1.75, marginBottom: 16 }}>
            When a dispute arises — and on any project of significant size, it will — there is rarely a clear, verifiable record
            of what happened. BIMLog changes that. Every action is logged, timestamped, and immutable. Every document upload is
            validated against naming conventions and flagged if something is wrong. Every approval is recorded with the identity
            of the approver, the time taken, and any flags raised.
          </p>
          <p style={{ fontSize: 15, color: "hsl(var(--muted-foreground))", lineHeight: 1.75 }}>
            This is not project management software. This is a coordination accountability system — the governance layer that sits
            on top of your existing tools and makes every participant accountable to the record.
          </p>
        </div>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 40, marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 20, fontFamily: "var(--font-display)" }}>
            Our commitment
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Built by practitioners", body: "Every feature was designed by people who have managed BIM coordination on real projects. We do not build what sounds good in a demo. We build what saves time on a Thursday afternoon when a submittal comes back rejected for the third time." },
              { label: "No lock-in", body: "Your data belongs to you. Every RFI, every submittal, every audit certificate is exportable at any time in open formats. We are a recording system, not a cage." },
              { label: "Legally defensible records", body: "BIMLog's audit trail is designed to hold up in dispute resolution, arbitration, and litigation. SHA-256 fingerprinting, UUID-certified audit certificates, and immutable activity logs create a record you can present to an arbitrator with confidence." },
              { label: "Privacy first", body: "We do not store physical project files. We do not use your project data for advertising. We do not sell data to any third party under any circumstances." },
            ].map(item => (
              <div key={item.label} style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 40, marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 20, fontFamily: "var(--font-display)" }}>
            Company information
          </h2>
          <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "24px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
              {[
                { label: "Legal entity", value: "BIMCapital Partners INC" },
                { label: "Technology division", value: "IgniteSmart" },
                { label: "Address", value: "7901 4th Street North STE 300\nSt. Petersburg, FL 33702\nUnited States" },
                { label: "Contact", value: "info@ignitesmart.ai" },
                { label: "Website", value: "ignitesmart.ai" },
                { label: "Founder", value: "Roberto Rodriguez" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, color: "hsl(var(--foreground))", whiteSpace: "pre-line", lineHeight: 1.6 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 12, fontFamily: "var(--font-display)" }}>
            Founding Partner program
          </h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7, marginBottom: 20 }}>
            We are currently accepting a limited number of founding partners — GCs and BIM coordination firms who will help shape the platform
            and receive locked pricing for 3 years. Founding partners receive direct input into the product roadmap and the Founding Partner
            designation on their company profile upon public launch.
          </p>
          <a
            href="/contact"
            style={{ display: "inline-block", background: "hsl(var(--primary))", color: "white", padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
          >
            Contact us to discuss
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
