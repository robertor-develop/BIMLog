import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ExternalLink, Zap, Monitor, Mail, X, Plus } from "lucide-react";
import { ConnectModal, type IntegrationInfo } from "@/components/IntegrationModal";

interface IntegrationsTabProps { projectId: number; }

interface Integration extends IntegrationInfo {
  id: string;
  description: string;
  category: "construction" | "storage" | "bim" | "analytics" | "ai";
  stats?: string;
  docsUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "procore",
    name: "Procore",
    description: "RFIs, submittals, and documents sync bidirectionally. Files validated by BIMLog before reaching Procore storage.",
    category: "construction",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "PC",
  },
  {
    id: "onedrive",
    name: "OneDrive / SharePoint",
    description: "Files are validated by BIMLog naming gateway before being stored in OneDrive. Non-compliant files are blocked.",
    category: "storage",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0067B8", logoText: "OD",
  },
  {
    id: "speckle",
    name: "Speckle",
    description: "3D model data streams connected. BIM objects and clash detection reports ingested for coordination analysis.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#DCFCE7", logoColor: "#166534", logoText: "SP",
  },
  {
    id: "msproject",
    name: "MS Project",
    description: "Schedule baseline imported. Delay detection runs against live file submission data to attribute schedule overruns.",
    category: "construction",
    stats: "Not connected",
    logoBg: "#FFF7ED", logoColor: "#C2410C", logoText: "MP",
  },
  {
    id: "powerbi",
    name: "Power BI",
    description: "BIMLog project data exposed as a live Power BI dataset. Build custom compliance and performance dashboards.",
    category: "analytics",
    stats: "Not connected",
    logoBg: "#F5F3FF", logoColor: "#6D28D9", logoText: "PB",
  },
  {
    id: "googledrive",
    name: "Google Drive / Docs",
    description: "Specifications, contracts, and RFI response documents linked from Drive and versioned within BIMLog.",
    category: "storage",
    stats: "Not connected",
    logoBg: "#DCFCE7", logoColor: "#166534", logoText: "GD",
  },
  {
    id: "claude",
    name: "Claude · Anthropic",
    description: "Natural language report generation, delay attribution analysis, compliance summaries, and RFI drafting on demand.",
    category: "ai",
    stats: "Not connected",
    logoBg: "#EDE9FE", logoColor: "#5B21B6", logoText: "AI",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "gemini",
    name: "Gemini · Google AI",
    description: "Alternative AI engine for report generation, data analysis, and project insights. Activate as primary or fallback.",
    category: "ai",
    stats: "Not connected",
    logoBg: "#F0FDF4", logoColor: "#065F46", logoText: "GM",
  },
  {
    id: "revit",
    name: "Revit (Autodesk)",
    description: "Direct upload from Revit via BIMLog add-in. Files validated at source before leaving the authoring environment.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "RV",
  },
  {
    id: "navisworks",
    name: "Navisworks",
    description: "NWD and NWF composite models tracked with naming validation. Clash reports ingested and attributed by trade.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "NW",
  },
  {
    id: "ifc",
    name: "IFC / openBIM",
    description: "ISO 19650-compliant IFC file uploads validated against naming convention. buildingSMART certified workflow.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "IFC",
  },
  {
    id: "excel",
    name: "Excel / Google Sheets",
    description: "Schedule trackers, submittal logs, and RFI registers imported and kept in sync. No manual re-entry.",
    category: "analytics",
    stats: "Not connected",
    logoBg: "#DCFCE7", logoColor: "#166534", logoText: "XL",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  construction: "Construction Management",
  storage:      "File Storage",
  bim:          "BIM & Coordination",
  analytics:    "Analytics & Reporting",
  ai:           "AI & Intelligence",
};

const CATEGORY_ORDER = ["construction", "bim", "storage", "analytics", "ai"];

const ADD_PLATFORMS: IntegrationInfo[] = [
  { name: "Procore",       logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "PC"  },
  { name: "Autodesk ACC",  logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "AU"  },
  { name: "OneDrive",      logoBg: "#E0F2FE", logoColor: "#0067B8", logoText: "OD"  },
  { name: "SharePoint",    logoBg: "#E0F2FE", logoColor: "#0067B8", logoText: "SP2" },
  { name: "Revit",         logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "RV"  },
  { name: "Navisworks",    logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "NW"  },
  { name: "Speckle",       logoBg: "#DCFCE7", logoColor: "#166534", logoText: "SP"  },
  { name: "MS Project",    logoBg: "#FFF7ED", logoColor: "#C2410C", logoText: "MP"  },
  { name: "Google Drive",  logoBg: "#DCFCE7", logoColor: "#166534", logoText: "GD"  },
  { name: "Power BI",      logoBg: "#F5F3FF", logoColor: "#6D28D9", logoText: "PB"  },
  { name: "Excel",         logoBg: "#DCFCE7", logoColor: "#166534", logoText: "XL"  },
  { name: "IFC",           logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "IFC" },
];

function AddIntegrationModal({ onClose, onSelect }: { onClose: () => void; onSelect: (p: IntegrationInfo) => void }) {
  const [other, setOther] = useState("");

  function handleOtherSubmit() {
    if (!other.trim()) return;
    window.location.href = `mailto:info@ignitesmart.ai?subject=${encodeURIComponent("BIMLog Integration Request — " + other.trim())}&body=${encodeURIComponent("Platform: " + other.trim())}`;
  }

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
        borderRadius: 14, width: "100%", maxWidth: 520,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid hsl(var(--border))",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>
              Add Integration
            </div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
              Select a platform to connect
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

        {/* Platform grid */}
        <div style={{ padding: "14px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
            {ADD_PLATFORMS.map(p => (
              <button
                key={p.name}
                onClick={() => { onClose(); onSelect(p); }}
                style={{
                  padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                  display: "flex", alignItems: "center", gap: 8,
                  textAlign: "left", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#BFDBFE")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: p.logoBg, color: p.logoColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, fontFamily: "var(--font-mono)",
                }}>
                  {p.logoText}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          {/* Other */}
          <div style={{
            padding: "12px 14px", borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 6 }}>
              Other — type the name of your platform and we will add support for it.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={other}
                onChange={e => setOther(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleOtherSubmit(); }}
                placeholder="e.g. Aconex, Prostream, BIM 360..."
                style={{
                  flex: 1, padding: "6px 10px",
                  border: "1px solid hsl(var(--border))", borderRadius: 6,
                  fontSize: 12, color: "hsl(var(--foreground))",
                  background: "hsl(var(--card))", outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleOtherSubmit}
                disabled={!other.trim()}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: other.trim() ? "#2563EB" : "hsl(var(--secondary))",
                  color: other.trim() ? "#fff" : "hsl(var(--muted-foreground))",
                  border: "none", cursor: other.trim() ? "pointer" : "default",
                }}
              >
                Contact us
              </button>
            </div>
            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>
              Contact us at{" "}
              <a href="mailto:info@ignitesmart.ai" style={{ color: "#0369A1" }}>info@ignitesmart.ai</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsTab({ projectId }: IntegrationsTabProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationInfo | null>(null);
  const [showSyncMsg, setShowSyncMsg] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
      {showAddModal && (
        <AddIntegrationModal
          onClose={() => setShowAddModal(false)}
          onSelect={p => setSelectedIntegration(p)}
        />
      )}

      {/* Header KPIs */}
      <div className="kpi-grid-4" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Available platforms</div>
          <div className="kpi-value" style={{ color: "#2563EB" }}>{INTEGRATIONS.length}</div>
          <div className="kpi-sub">Ready to connect</div>
          <div className="pill pill-blue">Click Connect to start</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Connection methods</div>
          <div className="kpi-value" style={{ color: "#16A34A" }}>4</div>
          <div className="kpi-sub">From manual to automated</div>
          <div className="pill pill-green">Validate · Managed · Agent · OAuth</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">AI engines</div>
          <div className="kpi-value" style={{ color: "#5B21B6" }}>2</div>
          <div className="kpi-sub">Claude and Gemini</div>
          <div className="pill pill-purple">Connect to activate</div>
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
              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
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
            marginBottom: 10, paddingLeft: 2,
          }}>
            {CATEGORY_LABELS[category]}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {items.map(integration => (
              <div key={integration.id} className="integration-card">
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    className="integration-logo"
                    style={{ background: integration.logoBg, color: integration.logoColor }}
                  >
                    {integration.logoText}
                  </div>
                  {/* Fix 7: all badges show "Not connected" with gray dot */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                    background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0",
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD5E1" }} />
                    Not connected
                  </div>
                </div>

                {/* Name + description */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                    {integration.name}
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
                    {integration.description}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>
                    {integration.stats}
                  </span>
                </div>

                {/* Action */}
                <button
                  onClick={() => setSelectedIntegration(integration)}
                  style={{
                    marginTop: 6, width: "100%", padding: "6px 0",
                    borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: "hsl(var(--secondary))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--muted-foreground))",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  <Zap style={{ width: 11, height: 11 }} />
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add Integration button */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          width: "100%", padding: "12px",
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: "hsl(var(--secondary))",
          border: "2px dashed hsl(var(--border))",
          color: "hsl(var(--muted-foreground))",
          cursor: "pointer", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#BFDBFE";
          e.currentTarget.style.color = "#1D4ED8";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "hsl(var(--border))";
          e.currentTarget.style.color = "hsl(var(--muted-foreground))";
        }}
      >
        <Plus style={{ width: 15, height: 15 }} />
        Add Integration
      </button>

      {/* Bottom note */}
      <div style={{
        padding: "14px 16px",
        background: "#F0F7FF", border: "1px solid #BFDBFE",
        borderRadius: 10, display: "flex", alignItems: "center", gap: 12,
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
          color: "#fff", border: "none", cursor: "pointer",
        }}>
          API docs
        </button>
      </div>
    </div>
  );
}
