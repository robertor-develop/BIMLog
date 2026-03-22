import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();

  const colHead = (text: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--foreground))", marginBottom: 12 }}>
      {text}
    </div>
  );

  const linkStyle: React.CSSProperties = {
    fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none",
    display: "block", marginBottom: 8, lineHeight: 1.5,
  };

  const hoverLink = (href: string, label: string, external?: boolean) =>
    external
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{label}</a>
      : <Link href={href} style={linkStyle}>{label}</Link>;

  return (
    <footer style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--secondary)/0.4)", marginTop: "auto" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "48px 32px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }}>

          {/* Column 1 — Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "hsl(var(--foreground))" }}>BIMLog</span>
              <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>by IgniteSmart</span>
            </div>
            <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.6, marginBottom: 16, maxWidth: 240 }}>
              {t("footer.tagline")}
            </p>
            <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
              {t("footer.copyright")}
            </p>
          </div>

          {/* Column 2 — Product */}
          <div>
            {colHead(t("footer.product"))}
            {hoverLink("/setup-guide", t("footer.howItWorks"))}
            {hoverLink("/pricing", t("footer.pricing"))}
            {hoverLink("/features", t("footer.features"))}
          </div>

          {/* Column 3 — Company */}
          <div>
            {colHead(t("footer.company"))}
            {hoverLink("/about", t("footer.about"))}
            {hoverLink("/contact", t("footer.contact"))}
          </div>

          {/* Column 4 — Legal */}
          <div>
            {colHead(t("footer.legal"))}
            {hoverLink("/privacy", t("footer.privacy"))}
            {hoverLink("/terms", t("footer.terms"))}
            {hoverLink("/disclaimer", t("footer.disclaimer"))}
            {hoverLink("/data-retention", t("footer.dataRetention"))}
          </div>

          {/* Column 5 — Connect */}
          <div>
            {colHead(t("footer.connect"))}
            <a href="mailto:info@ignitesmart.ai" style={linkStyle}>info@ignitesmart.ai</a>
            <a href="tel:+13329009180" style={linkStyle}>+1 332 900 9180</a>
            <a href="tel:+59171054305" style={linkStyle}>+591 71054305</a>
            <a href="https://ignitesmart.ai" target="_blank" rel="noopener noreferrer" style={linkStyle}>ignitesmart.ai</a>
          </div>
        </div>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>ISO 19650 · openBIM · buildingSMART</span>
          <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>BIMCapital Partners INC · 7901 4th Street North, STE 300, St. Petersburg, FL 33702</span>
        </div>
      </div>
    </footer>
  );
}
