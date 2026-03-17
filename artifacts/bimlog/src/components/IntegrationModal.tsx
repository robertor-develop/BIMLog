import { X, Download, Users, Monitor, Lock } from "lucide-react";

export interface IntegrationInfo {
  name: string;
  logoBg: string;
  logoColor: string;
  logoText: string;
}

export function ConnectModal({ integration, onClose }: { integration: IntegrationInfo; onClose: () => void }) {
  const options = [
    {
      icon: <Download style={{ width: 18, height: 18, color: "#2563EB" }} />,
      iconBg: "#EFF6FF",
      title: "Validate and Download",
      badge: null,
      desc: "Upload through BIMLog. We validate your files instantly and give you back the approved file with a full audit record. You upload it yourself to your platform. Works today. Zero setup required.",
      buttonLabel: "Get Started",
      buttonStyle: { background: "#2563EB", color: "#fff", border: "none" } as React.CSSProperties,
      onClick: () => {},
    },
    {
      icon: <Users style={{ width: 18, height: 18, color: "#16A34A" }} />,
      iconBg: "#F0FDF4",
      title: "Managed Connection",
      badge: null,
      desc: "Our team logs in on your behalf using your API token or credentials and configures everything for you. White-glove setup included with founding partner onboarding.",
      buttonLabel: "Contact us",
      buttonStyle: { background: "transparent", color: "#16A34A", border: "1px solid #BBF7D0" } as React.CSSProperties,
      onClick: () => { window.location.href = "mailto:info@ignitesmart.ai"; },
    },
    {
      icon: <Monitor style={{ width: 18, height: 18, color: "#7C3AED" }} />,
      iconBg: "#F5F3FF",
      title: "BIMLog Sync Agent",
      badge: "Enterprise",
      desc: "A lightweight desktop app watches a folder on your computer or server. Drop any file in the folder and BIMLog validates and routes it to the right platform automatically. No manual upload. No API setup. Just a folder you already know how to use.",
      buttonLabel: "Contact us",
      buttonStyle: { background: "transparent", color: "#7C3AED", border: "1px solid #DDD6FE" } as React.CSSProperties,
      onClick: () => { window.location.href = "mailto:info@ignitesmart.ai"; },
    },
    {
      icon: <Lock style={{ width: 18, height: 18, color: "#0369A1" }} />,
      iconBg: "#E0F2FE",
      title: "OAuth Connection",
      badge: "Enterprise",
      desc: "You log in with your own credentials through a secure window. We never see your password. BIMLog receives a secure token and delivers your files automatically to the right project.",
      buttonLabel: "Contact us",
      buttonStyle: { background: "transparent", color: "#0369A1", border: "1px solid #BAE6FD" } as React.CSSProperties,
      onClick: () => { window.location.href = "mailto:info@ignitesmart.ai"; },
    },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 14,
        width: "100%",
        maxWidth: 540,
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid hsl(var(--border))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: integration.logoBg, color: integration.logoColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, fontFamily: "var(--font-mono)",
            }}>
              {integration.logoText}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>
                Connect {integration.name}
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                Choose how you want to connect
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "hsl(var(--secondary))", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {options.map((opt, i) => (
            <div
              key={i}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: opt.iconBg, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {opt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>
                      {opt.title}
                    </span>
                    {opt.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 4,
                        background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0",
                      }}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.55, margin: 0 }}>
                    {opt.desc}
                  </p>
                </div>
              </div>
              <button
                onClick={opt.onClick}
                style={{
                  alignSelf: "flex-end",
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  ...opt.buttonStyle,
                }}
              >
                {opt.buttonLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
