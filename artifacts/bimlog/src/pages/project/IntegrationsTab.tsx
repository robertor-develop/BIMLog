import { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { ExternalLink, Zap, X, Plus, Code2 } from "lucide-react";
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
    description: "Sync RFIs, submittals, and documents bidirectionally. Every action recorded in BIMLog audit trail.",
    category: "construction",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "PC",
  },
  {
    id: "onedrive",
    name: "OneDrive / SharePoint",
    description: "File storage sync with naming validation gateway. Every upload validated before it reaches your folders.",
    category: "storage",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0067B8", logoText: "OD",
  },
  {
    id: "speckle",
    name: "Speckle",
    description: "Model data streams connected and tracked. Every version attributed and timestamped.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#DCFCE7", logoColor: "#166534", logoText: "SP",
  },
  {
    id: "msproject",
    name: "MS Project",
    description: "Schedule data imported and monitored. Milestones and baselines tracked for delay attribution.",
    category: "construction",
    stats: "Not connected",
    logoBg: "#FFF7ED", logoColor: "#C2410C", logoText: "MP",
  },
  {
    id: "powerbi",
    name: "Power BI",
    description: "BIMLog data exposed as a Power BI data source for custom compliance and performance dashboards.",
    category: "analytics",
    stats: "Not connected",
    logoBg: "#F5F3FF", logoColor: "#6D28D9", logoText: "PB",
  },
  {
    id: "googledrive",
    name: "Google Drive / Docs",
    description: "File storage sync with naming validation. Every file routed through BIMLog before delivery.",
    category: "storage",
    stats: "Not connected",
    logoBg: "#DCFCE7", logoColor: "#166534", logoText: "GD",
  },
  {
    id: "claude",
    name: "Claude · Anthropic",
    description: "AI-powered RFI drafting, submittal compliance checking, and report generation on demand.",
    category: "ai",
    stats: "Not connected",
    logoBg: "#EDE9FE", logoColor: "#5B21B6", logoText: "AI",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "gemini",
    name: "Gemini · Google AI",
    description: "Alternative AI provider for project insights and report generation. Activate as primary or fallback.",
    category: "ai",
    stats: "Not connected",
    logoBg: "#F0FDF4", logoColor: "#065F46", logoText: "GM",
  },
  {
    id: "revit",
    name: "Revit (Autodesk)",
    description: "Model file upload gateway. Every RVT file validated against active convention on upload.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "RV",
  },
  {
    id: "navisworks",
    name: "Navisworks",
    description: "Composite model uploads validated. NWD and NWF files tracked with version history.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "NW",
  },
  {
    id: "ifc",
    name: "IFC / openBIM",
    description: "Open BIM file uploads validated against active convention. IFC model versions tracked.",
    category: "bim",
    stats: "Not connected",
    logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "IFC",
  },
  {
    id: "excel",
    name: "Excel / Google Sheets",
    description: "Schedule trackers and submittal logs parsed and synced. No manual data entry.",
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
  { name: "Autodesk BIM 360", logoBg: "#FEF9C3", logoColor: "#A16207", logoText: "B360" },
  { name: "Aconex",           logoBg: "#E0F2FE", logoColor: "#0369A1", logoText: "ACX"  },
  { name: "Primavera P6",     logoBg: "#FFF7ED", logoColor: "#C2410C", logoText: "P6"   },
  { name: "Bluebeam Revu",    logoBg: "#EFF6FF", logoColor: "#1D4ED8", logoText: "BB"   },
  { name: "Fieldwire",        logoBg: "#DCFCE7", logoColor: "#166534", logoText: "FW"   },
  { name: "PlanGrid",         logoBg: "#F0FDF4", logoColor: "#065F46", logoText: "PG"   },
  { name: "Smartsheet",       logoBg: "#F0FDF4", logoColor: "#166534", logoText: "SS"   },
  { name: "Trimble Connect",  logoBg: "#FEF9C3", logoColor: "#854D0E", logoText: "TC"   },
  { name: "Dropbox",          logoBg: "#EFF6FF", logoColor: "#0369A1", logoText: "DB"   },
  { name: "Box",              logoBg: "#EFF6FF", logoColor: "#1D4ED8", logoText: "BOX"  },
  { name: "Egnyte",           logoBg: "#DCFCE7", logoColor: "#166534", logoText: "EG"   },
  { name: "Prostream",        logoBg: "#F5F3FF", logoColor: "#5B21B6", logoText: "PS"   },
  { name: "e-Builder",        logoBg: "#FFF7ED", logoColor: "#9A3412", logoText: "EB"   },
  { name: "Kahua",            logoBg: "#EDE9FE", logoColor: "#5B21B6", logoText: "KA"   },
  { name: "Newforma",         logoBg: "#FEF2F2", logoColor: "#991B1B", logoText: "NF"   },
];

const API_ENDPOINTS = [
  { method: "GET",  path: "/projects",                                      desc: "List all projects for authenticated user" },
  { method: "POST", path: "/projects",                                      desc: "Create a new project" },
  { method: "GET",  path: "/projects/:id/files",                            desc: "List all files for a project" },
  { method: "POST", path: "/projects/:id/files",                            desc: "Upload and validate a file" },
  { method: "GET",  path: "/projects/:id/rfis",                             desc: "List all RFIs" },
  { method: "POST", path: "/projects/:id/rfis",                             desc: "Create a new RFI" },
  { method: "GET",  path: "/projects/:id/rfis/:id/audit-certificate",       desc: "Generate audit certificate PDF" },
  { method: "GET",  path: "/projects/:id/submittals",                       desc: "List all submittals" },
  { method: "POST", path: "/projects/:id/submittals",                       desc: "Create a new submittal" },
  { method: "GET",  path: "/projects/:id/submittals/:id/audit-certificate", desc: "Generate submittal audit certificate" },
  { method: "GET",  path: "/projects/:id/activity",                         desc: "Get full activity log" },
];

const METHOD_COLOR: Record<string, { bg: string; color: string }> = {
  GET:  { bg: "#EFF6FF", color: "#1D4ED8" },
  POST: { bg: "#F0FDF4", color: "#166534" },
};

function ApiDocsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Code2 style={{ width: 16, height: 16, color: "#2563EB" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}>BIMLog REST API</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "hsl(var(--secondary))", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>
          <div style={{ padding: "12px 14px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#1E3A5F", lineHeight: 1.7 }}>
            BIMLog exposes a full REST API for integration with any platform that supports standard HTTP authentication.
            <br />
            <strong>Base URL:</strong> <code style={{ fontFamily: "var(--font-mono)", background: "#DBEAFE", padding: "1px 5px", borderRadius: 3 }}>https://bim-log-ignite.replit.app/api/v1</code>
            <br />
            <strong>Authentication:</strong> Bearer token via JWT — contact <a href="mailto:info@ignitesmart.ai" style={{ color: "#2563EB" }}>info@ignitesmart.ai</a> to request API credentials.
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Endpoints</div>
          <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
            {API_ENDPOINTS.map((ep, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: i < API_ENDPOINTS.length - 1 ? "1px solid hsl(var(--border))" : "none", background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--background))" }}>
                <span style={{ fontSize: 9, fontWeight: 800, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 4, background: METHOD_COLOR[ep.method]?.bg ?? "#F3F4F6", color: METHOD_COLOR[ep.method]?.color ?? "#374151", flexShrink: 0, minWidth: 38, textAlign: "center" }}>{ep.method}</span>
                <code style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#1E3A5F", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.path}</code>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>{ep.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, fontSize: 11, color: "#5B21B6", lineHeight: 1.6 }}>
            Webhooks available on Enterprise — contact <a href="mailto:info@ignitesmart.ai" style={{ color: "#7C3AED", fontWeight: 600 }}>info@ignitesmart.ai</a>.
            Full documentation coming soon at <a href="https://ignitesmart.ai/api-docs" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED", fontWeight: 600 }}>ignitesmart.ai/api-docs</a>.
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationInfo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiDocs, setShowApiDocs] = useState(false);

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
          projectId={projectId}
          onNavigate={navigate}
        />
      )}
      {showAddModal && (
        <AddIntegrationModal
          onClose={() => setShowAddModal(false)}
          onSelect={p => setSelectedIntegration(p)}
        />
      )}
      {showApiDocs && <ApiDocsModal onClose={() => setShowApiDocs(false)} />}

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
          width: "100%", padding: "18px 20px",
          borderRadius: 10,
          background: "hsl(var(--secondary))",
          border: "2px dashed hsl(var(--border))",
          color: "hsl(var(--muted-foreground))",
          cursor: "pointer", marginBottom: 16,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Add Integration</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>
          Connect any platform your team uses
        </span>
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
        <button
          onClick={() => setShowApiDocs(true)}
          style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: 6,
            fontSize: 11, fontWeight: 600, background: "#2563EB",
            color: "#fff", border: "none", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          <Code2 style={{ width: 12, height: 12 }} />
          API docs
        </button>
      </div>
    </div>
  );
}
