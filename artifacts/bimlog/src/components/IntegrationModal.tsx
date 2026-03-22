import { useState } from "react";
import { X, Download, Users, Monitor, Lock, Mail, Phone, MessageCircle, ChevronLeft, Copy, Check } from "lucide-react";

export interface IntegrationInfo {
  name: string;
  logoBg: string;
  logoColor: string;
  logoText: string;
}

type SubScreen = null | "managed-form" | "sync-agent" | "oauth-contact";

function ManagedForm({ integration, onBack }: { integration: IntegrationInfo; onBack: () => void }) {
  const [mode, setMode] = useState<"token" | "credentials">("token");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit() {
    const subject = encodeURIComponent(`BIMLog Managed Connection Request — ${integration.name}`);
    const body = mode === "token"
      ? encodeURIComponent(`Platform: ${integration.name}\nAPI Token: ${token}`)
      : encodeURIComponent(`Platform: ${integration.name}\nUsername: ${username}\nPassword: ${password}`);
    window.location.href = `mailto:info@ignitesmart.ai?subject=${subject}&body=${body}`;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px",
    border: "1px solid hsl(var(--border))", borderRadius: 6,
    fontSize: 12, color: "hsl(var(--foreground))",
    background: "hsl(var(--background))", outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ChevronLeft style={{ width: 13, height: 13 }} />
        Back
      </button>
      <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4, fontFamily: "var(--font-display)" }}>
        Managed Connection — {integration.name}
      </div>
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 16, lineHeight: 1.5 }}>
        Our team will configure everything on your behalf. Enter your credentials below.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["token", "credentials"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: mode === m ? "#EFF6FF" : "hsl(var(--secondary))", border: mode === m ? "1px solid #BFDBFE" : "1px solid hsl(var(--border))", color: mode === m ? "#1D4ED8" : "hsl(var(--muted-foreground))" }}>
            {m === "token" ? "API Token" : "Username & Password"}
          </button>
        ))}
      </div>
      {mode === "token" ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>API Token</label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your API token" style={inputStyle} autoComplete="off" />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username or email" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" style={inputStyle} autoComplete="new-password" />
          </div>
        </>
      )}
      <div style={{ padding: "10px 12px", borderRadius: 7, background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: 11, color: "#15803D", lineHeight: 1.5, marginBottom: 14 }}>
        Your credentials are encrypted and used only to configure your connection. You can revoke access at any time.
      </div>
      <button onClick={handleSubmit} style={{ width: "100%", padding: "9px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#16A34A", color: "#fff", border: "none" }}>
        Submit
      </button>
    </div>
  );
}

function SyncAgentScreen({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ChevronLeft style={{ width: 13, height: 13 }} />
        Back
      </button>
      <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4, fontFamily: "var(--font-display)" }}>
        BIMLog Sync Agent — Setup
      </div>
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 16, lineHeight: 1.5 }}>
        A lightweight desktop app that watches a folder and validates files automatically.
      </div>
      {[
        {
          num: 1,
          title: "Click Download for Windows and run the installer.",
          extra: (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <a
                href="/api/v1/downloads/sync-agent-windows"
                download="BIMLog Sync Agent Setup 1.0.0.exe"
                style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#2563EB", color: "#fff", border: "none", textDecoration: "none", display: "inline-block" }}
              >
                ⬇ Download for Windows
              </a>
              <a
                href="mailto:info@ignitesmart.ai?subject=BIMLog%20Sync%20Agent%20Mac%20Installer&body=Hello%2C%0A%0AI%20would%20like%20to%20receive%20the%20BIMLog%20Sync%20Agent%20installer%20for%20Mac."
                style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", textDecoration: "none", display: "inline-block" }}
              >
                Mac — Coming Soon
              </a>
            </div>
          ),
        },
        { num: 2, title: "Open BIMLog Sync Agent from your Start menu.", extra: null },
        { num: 3, title: "Enter your BIMLog API token from your Profile page.", extra: null },
        { num: 4, title: "Select the folder you want to watch.", extra: null },
        { num: 5, title: "Drop any file in that folder and BIMLog validates and routes it automatically.", extra: null },
      ].map(step => (
        <div key={step.num} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F5F3FF", color: "#7C3AED", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
            {step.num}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.5 }}>
              Step {step.num} — {step.title}
            </div>
            {step.extra}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 7, background: "#F5F3FF", border: "1px solid #DDD6FE", fontSize: 11, color: "#6D28D9", lineHeight: 1.5 }}>
        Need help setting up? Contact us at{" "}
        <a href="mailto:info@ignitesmart.ai" style={{ color: "#7C3AED", fontWeight: 600 }}>info@ignitesmart.ai</a>
      </div>
    </div>
  );
}

function OAuthContactScreen({ onBack }: { onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard.writeText("info@ignitesmart.ai").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 16px", borderRadius: 8,
    background: "#2563EB", border: "none",
    textDecoration: "none", cursor: "pointer",
    width: "100%", textAlign: "left",
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ChevronLeft style={{ width: 13, height: 13 }} />
        Back
      </button>
      <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4, fontFamily: "var(--font-display)" }}>
        OAuth Connection — Contact Us
      </div>
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 16, lineHeight: 1.5 }}>
        Our team will set up your secure OAuth connection. Choose how you'd like to reach us.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Email */}
        <a href="mailto:info@ignitesmart.ai" style={btnStyle}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Mail style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Email us</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>info@ignitesmart.ai</div>
          </div>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); copyEmail(); }}
            title="Copy email"
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 5, padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 10 }}
          >
            {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </a>

        {/* Bolivia */}
        <a href="tel:+59171054305" style={btnStyle}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Phone style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Call or text us — Bolivia</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>+591 71054305</div>
          </div>
        </a>

        {/* USA */}
        <a href="tel:+13329009180" style={btnStyle}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Phone style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Call or text us — USA</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>+1 332 900 9180</div>
          </div>
        </a>

        {/* WhatsApp */}
        <a href="https://wa.me/59171054305" target="_blank" rel="noopener noreferrer" style={btnStyle}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageCircle style={{ width: 15, height: 15, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>WhatsApp us</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>wa.me/59171054305</div>
          </div>
        </a>
      </div>
    </div>
  );
}

export function ConnectModal({
  integration,
  onClose,
  projectId,
  onNavigate,
}: {
  integration: IntegrationInfo;
  onClose: () => void;
  projectId?: number;
  onNavigate?: (path: string) => void;
}) {
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  function handleValidateGetStarted() {
    onClose();
    if (projectId && onNavigate) {
      onNavigate(`/projects/${projectId}/files`);
    }
  }

  const mainContent = (
    <>
      {[
        {
          key: "validate",
          icon: <Download style={{ width: 18, height: 18, color: "#2563EB" }} />,
          iconBg: "#EFF6FF",
          title: "Validate and Download",
          badge: null,
          desc: "Upload through BIMLog. We validate your files instantly and give you back the approved file with a full audit record. You upload it yourself to your platform. Works today. Zero setup required.",
          buttonLabel: "Get Started",
          buttonStyle: { background: "#2563EB", color: "#fff", border: "none" } as React.CSSProperties,
          onClick: handleValidateGetStarted,
        },
        {
          key: "managed",
          icon: <Users style={{ width: 18, height: 18, color: "#16A34A" }} />,
          iconBg: "#F0FDF4",
          title: "Managed Connection",
          badge: null,
          desc: "Our team logs in on your behalf using your API token or credentials and configures everything for you. White-glove setup included with founding partner onboarding.",
          buttonLabel: "Get Started",
          buttonStyle: { background: "transparent", color: "#16A34A", border: "1px solid #BBF7D0" } as React.CSSProperties,
          onClick: () => setSubScreen("managed-form"),
        },
        {
          key: "sync",
          icon: <Monitor style={{ width: 18, height: 18, color: "#7C3AED" }} />,
          iconBg: "#F5F3FF",
          title: "BIMLog Sync Agent",
          badge: null,
          desc: "A lightweight desktop app watches a folder on your computer or server. Drop any file in the folder and BIMLog validates and routes it to the right platform automatically. No manual upload. No API setup. Just a folder you already know how to use.",
          buttonLabel: "Get Started",
          buttonStyle: { background: "transparent", color: "#7C3AED", border: "1px solid #DDD6FE" } as React.CSSProperties,
          onClick: () => setSubScreen("sync-agent"),
        },
        {
          key: "oauth",
          icon: <Lock style={{ width: 18, height: 18, color: "#0369A1" }} />,
          iconBg: "#E0F2FE",
          title: "OAuth Connection",
          badge: "Enterprise",
          desc: "Secure token-based direct integration. Log in through your existing platform credentials. No manual setup. No API tokens to manage. Available on Enterprise plans.",
          buttonLabel: "Get Started",
          buttonStyle: { background: "transparent", color: "#0369A1", border: "1px solid #BAE6FD" } as React.CSSProperties,
          onClick: () => setSubScreen("oauth-contact"),
        },
      ].map((opt) => (
        <div
          key={opt.key}
          style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: opt.iconBg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {opt.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>
                  {opt.title}
                </span>
                {opt.badge && (
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 4, background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }}>
                    {opt.badge}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.55, margin: 0 }}>
                {opt.desc}
              </p>
            </div>
          </div>
          <button onClick={opt.onClick} style={{ alignSelf: "flex-end", padding: "5px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", ...opt.buttonStyle }}>
            {opt.buttonLabel}
          </button>
        </div>
      ))}
    </>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: integration.logoBg, color: integration.logoColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {integration.logoText}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>
                Connect {integration.name}
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {subScreen ? "Complete the steps below" : "Choose how you want to connect"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "hsl(var(--secondary))", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: subScreen ? 0 : 10 }}>
          {subScreen === null          && mainContent}
          {subScreen === "managed-form" && <ManagedForm integration={integration} onBack={() => setSubScreen(null)} />}
          {subScreen === "sync-agent"   && <SyncAgentScreen onBack={() => setSubScreen(null)} />}
          {subScreen === "oauth-contact" && <OAuthContactScreen onBack={() => setSubScreen(null)} />}
        </div>
      </div>
    </div>
  );
}
