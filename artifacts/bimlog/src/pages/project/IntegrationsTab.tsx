import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, RefreshCw, ExternalLink, Zap, Monitor, Mail } from "lucide-react";
import { ConnectModal, type IntegrationInfo } from "@/components/IntegrationModal";

interface IntegrationsTabProps { projectId: number; }

type SyncStatus = "live" | "syncing" | "idle" | "error" | "available";

interface Integration extends IntegrationInfo {
  id: string;
  description: string;
  category: "construction" | "storage" | "bim" | "analytics" | "ai";
  status: SyncStatus;
  lastSync?: string;
  stats?: string;
  docsUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "procore",
    name: "Procore",
    description: "RFIs, submittals, and documents sync bidirectionally. Files validated by BIMLog before reaching Procore storage.",
    category: "construction",
    status: "live",
    lastSync: "2 min ago",
    stats: "142 files · 31 RFIs · 18 submittals",
    logoBg: "#E0F2FE",
    logoColor: "#0369A1",
    logoText: "PC",
  },
  {
    id: "onedrive",
    name: "OneDrive / SharePoint",
    description: "Files are validated by BIMLog naming gateway before being stored in OneDrive. Non-compliant files are blocked.",
    category: "storage",
    status: "live",
    lastSync: "Live",
    stats: "133 files passed · 9 blocked",
    logoBg: "#E0F2FE",
    logoColor: "#0067B8",
    logoText: "OD",
  },
  {
    id: "speckle",
    name: "Speckle",
    description: "3D model data streams connected. BIM objects and clash detection reports ingested for coordination analysis.",
    category: "bim",
    status: "syncing",
    lastSync: "12 min ago",
    stats: "4 streams · 2 clash reports pending",
    logoBg: "#DCFCE7",
    logoColor: "#166534",
    logoText: "SP",
  },
  {
    id: "msproject",
    name: "MS Project",
    description: "Schedule baseline imported. Delay detection runs against live file submission data to attribute schedule overruns.",
    category: "construction",
    status: "idle",
    lastSync: "Mar 15",
    stats: "Baseline imported · 5d delay detected",
    logoBg: "#FFF7ED",
    logoColor: "#C2410C",
    logoText: "MP",
  },
  {
    id: "powerbi",
    name: "Power BI",
    description: "BIMLog project data exposed as a live Power BI dataset. Build custom compliance and performance dashboards.",
    category: "analytics",
    status: "live",
    lastSync: "API",
    stats: "3 dashboards connected · live feed",
    logoBg: "#F5F3FF",
    logoColor: "#6D28D9",
    logoText: "PB",
  },
  {
    id: "googledrive",
    name: "Google Drive / Docs",
    description: "Specifications, contracts, and RFI response documents linked from Drive and versioned within BIMLog.",
    category: "storage",
    status: "live",
    lastSync: "Live",
    stats: "24 documents indexed",
    logoBg: "#DCFCE7",
    logoColor: "#166534",
    logoText: "GD",
  },
  {
    id: "claude",
    name: "Claude · Anthropic",
    description: "Natural language report generation, delay attribution analysis, compliance summaries, and RFI drafting on demand.",
    category: "ai",
    status: "live",
    lastSync: "Active",
    stats: "31 reports generated this month",
    logoBg: "#EDE9FE",
    logoColor: "#5B21B6",
    logoText: "AI",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "gemini",
    name: "Gemini · Google AI",
    description: "Alternative AI engine for report generation, data analysis, and project insights. Activate as primary or fallback.",
    category: "ai",
    status: "available",
    stats: "Connect to activate",
    logoBg: "#F0FDF4",
    logoColor: "#065F46",
    logoText: "GM",
  },
  {
    id: "revit",
    name: "Revit (Autodesk)",
    description: "Direct upload from Revit via BIMLog add-in. Files validated at source before leaving the authoring environment.",
    category: "bim",
    status: "available",
    stats: "Add-in available · Phase 2",
    logoBg: "#FEF9C3",
    logoColor: "#A16207",
    logoText: "RV",
  },
  {
    id: "navisworks",
    name: "Navisworks",
    description: "NWD and NWF composite models tracked with naming validation. Clash reports ingested and attributed by trade.",
    category: "bim",
    status: "idle",
    lastSync: "Manual",
    stats: "Upload via file gateway",
    logoBg: "#FEF9C3",
    logoColor: "#A16207",
    logoText: "NW",
  },
  {
    id: "ifc",
    name: "IFC / openBIM",
    description: "ISO 19650-compliant IFC file uploads validated against naming convention. buildingSMART certified workflow.",
    category: "bim",
    status: "live",
    lastSync: "Live",
    stats: "openBIM · buildingSMART certified",
    logoBg: "#E0F2FE",
    logoColor: "#0369A1",
    logoText: "IFC",
  },
  {
    id: "excel",
    name: "Excel / Google Sheets",
    description: "Schedule trackers, submittal logs, and RFI registers imported and kept in sync. No manual re-entry.",
    category: "analytics",
    status: "available",
    stats: "Connect to activate",
    logoBg: "#DCFCE7",
    logoColor: "#166534",
    logoText: "XL",
  },
];

const STATUS_CONFIG: Record<SyncStatus, { label: string; dotClass: string; badgeStyle: React.CSSProperties }> = {
  live:      { label: "Live",      dotClass: "sync-live",    badgeStyle: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" } },
  syncing:   { label: "Syncing",   dotClass: "sync-syncing", badgeStyle: { background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" } },
  idle:      { label: "Idle",      dotClass: "sync-idle",    badgeStyle: { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" } },
  error:     { label: "Error",     dotClass: "sync-idle",    badgeStyle: { background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" } },
  available: { label: "Available", dotClass: "sync-idle",    badgeStyle: { background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" } },
};

const CATEGORY_LABELS: Record<string, string> = {
  construction: "Construction Management",
  storage:      "File Storage",
  bim:          "BIM & Coordination",
  analytics:    "Analytics & Reporting",
  ai:           "AI & Intelligence",
};

const CATEGORY_ORDER = ["construction", "bim", "storage", "analytics", "ai"];

export function IntegrationsTab({ projectId }: IntegrationsTabProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationInfo | null>(null);
  const [showSyncMsg, setShowSyncMsg] = useState(false);

  const connectedCount = INTEGRATIONS.filter(i => i.status === "live" || i.status === "syncing" || i.status === "idle").length;
  const liveCount      = INTEGRATIONS.filter(i => i.status === "live").length;

  const filtered = filter === "all"
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === filter);

  const grouped = CATEGORY_ORDER.reduce<Record<string, Integration[]>>((acc, cat) => {
    const items = filtered.filter(i => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div>
      {selectedIntegration && (
        <ConnectModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
        />
      )}

      {/* Header KPIs */}
      <div className="kpi-grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Connected platforms</div>
          <div className="kpi-value" style={{ color: "#2563EB" }}>{connectedCount}</div>
          <div className="kpi-sub">of {INTEGRATIONS.length} available</div>
          <div className="pill pill-blue">Active integrations</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Live sync</div>
          <div className="kpi-value" style={{ color: "#16A34A" }}>{liveCount}</div>
          <div className="kpi-sub">Real-time bidirectional</div>
          <div className="pill pill-green">All systems go</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">AI reports</div>
          <div className="kpi-value" style={{ color: "#5B21B6" }}>31</div>
          <div className="kpi-sub">Generated this month</div>
          <div className="pill pill-purple">Claude API active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Data standard</div>
          <div className="kpi-value" style={{ fontSize: 18, color: "#0369A1" }}>ISO</div>
          <div className="kpi-sub">19650 · openBIM · IFC</div>
          <div className="pill pill-blue">buildingSMART</div>
        </div>
      </div>

      {/* Download Sync Agent banner */}
      <div style={{
        marginBottom: 16, padding: "12px 16px",
        background: "#F5F3FF", border: "1px solid #DDD6FE",
        borderRadius: 10, display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ width: 32, height: 32, background: "#EDE9FE", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Monitor style={{ width: 15, height: 15, color: "#7C3AED" }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6", marginBottom: 1 }}>
            BIMLog Sync Agent — Desktop App
          </div>
          <div style={{ fontSize: 11, color: "#6D28D9" }}>
            Windows and Mac · Watch a folder, validate automatically, no upload needed
          </div>
        </div>
        {showSyncMsg ? (
          <div style={{
            padding: "8px 14px", borderRadius: 8,
            background: "#EDE9FE", border: "1px solid #DDD6FE",
            fontSize: 11, color: "#5B21B6", lineHeight: 1.5, maxWidth: 300,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <Mail style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
            <span>
              Your download will be prepared by our team. Contact us at{" "}
              <a href="mailto:info@ignitesmart.ai" style={{ color: "#5B21B6", fontWeight: 600 }}>
                info@ignitesmart.ai
              </a>{" "}
              to receive the installer for your operating system.
            </span>
          </div>
        ) : (
          <button
            onClick={() => setShowSyncMsg(true)}
            style={{
              padding: "7px 14px", borderRadius: 6,
              fontSize: 11, fontWeight: 600,
              background: "#7C3AED", color: "#fff",
              border: "none", cursor: "pointer", flexShrink: 0,
            }}
          >
            Download BIMLog Sync Agent
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", ...CATEGORY_ORDER].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: filter === cat ? "1px solid #BFDBFE" : "1px solid hsl(var(--border))",
              background: filter === cat ? "#EFF6FF" : "hsl(var(--card))",
              color: filter === cat ? "#1D4ED8" : "hsl(var(--muted-foreground))",
            }}
          >
            {cat === "all" ? "All platforms" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Integration cards by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))",
            marginBottom: 10, paddingLeft: 2
          }}>
            {CATEGORY_LABELS[category]}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {items.map(integration => {
              const sc = STATUS_CONFIG[integration.status];
              const isAvailable = integration.status === "available";

              return (
                <div
                  key={integration.id}
                  className="integration-card"
                  style={{ opacity: isAvailable ? 0.75 : 1 }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div
                      className="integration-logo"
                      style={{ background: integration.logoBg, color: integration.logoColor }}
                    >
                      {integration.logoText}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, ...sc.badgeStyle, padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
                      <span className={`sync-dot ${sc.dotClass}`} />
                      {sc.label}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                      {integration.name}
                    </div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
                      {integration.description}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isAvailable ? "hsl(var(--muted-foreground))" : "#1D4ED8" }}>
                      {integration.stats}
                    </span>
                    {integration.lastSync && !isAvailable && (
                      <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: 3 }}>
                        <RefreshCw style={{ width: 10, height: 10 }} />
                        {integration.lastSync}
                      </span>
                    )}
                  </div>

                  {isAvailable ? (
                    <button
                      onClick={() => setSelectedIntegration(integration)}
                      style={{
                        marginTop: 6, width: "100%", padding: "6px 0",
                        borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "hsl(var(--secondary))",
                        border: "1px solid hsl(var(--border))",
                        color: "hsl(var(--muted-foreground))",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5
                      }}>
                      <Zap style={{ width: 11, height: 11 }} />
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedIntegration(integration)}
                      style={{
                        marginTop: 6, width: "100%", padding: "6px 0",
                        borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "transparent",
                        border: "1px solid hsl(var(--border))",
                        color: "hsl(var(--muted-foreground))",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5
                      }}>
                      <CheckCircle2 style={{ width: 11, height: 11, color: "#16A34A" }} />
                      Manage
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Bottom note */}
      <div style={{
        marginTop: 8, padding: "14px 16px",
        background: "#F0F7FF", border: "1px solid #BFDBFE",
        borderRadius: 10, display: "flex", alignItems: "center", gap: 12
      }}>
        <div style={{ width: 32, height: 32, background: "#DBEAFE", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ExternalLink style={{ width: 15, height: 15, color: "#1D4ED8" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", marginBottom: 2 }}>
            Need a custom integration?
          </div>
          <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
            BIMLog exposes a full REST API and webhooks. Connect any platform that supports standard API authentication.
            Enterprise plans include dedicated integration support from the IgniteSmart team.
          </div>
        </div>
        <button style={{
          flexShrink: 0, padding: "7px 14px", borderRadius: 6,
          fontSize: 11, fontWeight: 600, background: "#2563EB",
          color: "#fff", border: "none", cursor: "pointer"
        }}>
          API docs
        </button>
      </div>
    </div>
  );
}
