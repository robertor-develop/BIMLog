import { useState } from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft, Mail, Phone, Globe, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const INTEREST_OPTIONS = [
  "Free tier — getting started",
  "Professional plan",
  "Business plan",
  "Enterprise / custom proposal",
  "Founding Partner program",
  "Governed integration review (do not include credentials)",
  "Demo request",
  "Press or media inquiry",
  "General question",
];

const CONTACT_INFO = [
  { icon: Mail, label: "Email", value: "info@ignitesmart.ai", href: "mailto:info@ignitesmart.ai" },
  { icon: Phone, label: "US", value: "+1 332 900 9180", href: "tel:+13329009180" },
  { icon: Phone, label: "Bolivia", value: "+591 71054305", href: "tel:+59171054305" },
  { icon: Globe, label: "Website", value: "ignitesmart.ai", href: "https://ignitesmart.ai" },
  { icon: MapPin, label: "Address", value: "BIMCapital Partners INC\n7901 4th Street North STE 300\nSt. Petersburg, FL 33702", href: undefined },
];

export function Contact() {
  const [form, setForm] = useState({ fullName: "", email: "", companyName: "", country: "", interest: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.companyName || !form.country || !form.interest || !form.message) {
      setErrorMsg("All fields are required."); return;
    }
    setStatus("sending"); setErrorMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) { setStatus("sent"); }
      else { setStatus("error"); setErrorMsg(d.error || "Something went wrong. Please email us directly."); }
    } catch {
      setStatus("error"); setErrorMsg("Could not connect. Please email us at info@ignitesmart.ai.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px", flex: 1, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Back to home
        </Link>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>Contact</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>Get in touch</h1>
        <p style={{ fontSize: 15, color: "hsl(var(--muted-foreground))", marginBottom: 48, lineHeight: 1.7 }}>
          Questions about pricing, a custom proposal, or the Founding Partner program — we respond to every inquiry within one business day.
        </p>

        <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Contact info — left */}
          <div style={{ minWidth: 260, flex: "0 0 260px" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 24 }}>Contact information</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {CONTACT_INFO.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <item.icon style={{ width: 14, height: 14, color: "hsl(var(--primary))" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))", marginBottom: 2 }}>{item.label}</div>
                    {item.href ? (
                      <a href={item.href} style={{ fontSize: 14, color: "hsl(var(--foreground))", textDecoration: "none", fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--primary))")}
                        onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                      >{item.value}</a>
                    ) : (
                      <div style={{ fontSize: 14, color: "hsl(var(--foreground))", whiteSpace: "pre-line", lineHeight: 1.6 }}>{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form — right */}
          <div style={{ flex: 1, minWidth: 300 }}>
            {status === "sent" ? (
              <div style={{ background: "#22c55e11", border: "1px solid #22c55e44", borderRadius: 12, padding: "36px 32px", textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Sent</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 8 }}>Message received</div>
                <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}>
                  Thank you for reaching out. We will reply to <strong>{form.email}</strong> within one business day.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {errorMsg && (
                  <div style={{ background: "#ef444411", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>{errorMsg}</div>
                )}

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Roberto Rodriguez" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>Email <span style={{ color: "#ef4444" }}>*</span></label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="roberto@company.com" />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>Company Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Acme Construction" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>Country <span style={{ color: "#ef4444" }}>*</span></label>
                    <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="United States" />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>I am interested in <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    value={form.interest}
                    onChange={e => setForm(f => ({ ...f, interest: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: form.interest ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", fontSize: 14, cursor: "pointer" }}
                  >
                    <option value="">Select an option...</option>
                    {INTEREST_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>Message <span style={{ color: "#ef4444" }}>*</span></label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us about your project portfolio, team size, and what you are trying to solve..."
                    rows={5}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: "#92400E" }}>
                    Do not include passwords, API keys, or access tokens. / No incluyas contraseñas, claves API ni tokens de acceso.
                  </div>
                </div>

                <Button type="submit" disabled={status === "sending"} style={{ fontWeight: 700, fontSize: 14, padding: "12px 24px" }}>
                  {status === "sending" ? "Sending..." : "Send Message"}
                </Button>

                <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", margin: 0, lineHeight: 1.6 }}>
                  We respond to every inquiry within one business day. By submitting this form you agree to our{" "}
                  <a href="/privacy" style={{ color: "hsl(var(--primary))", textDecoration: "none" }}>Privacy Policy</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
