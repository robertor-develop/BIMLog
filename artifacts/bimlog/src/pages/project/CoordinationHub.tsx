import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  Upload, AlertTriangle, CheckCircle2, X, Loader2, FileText,
  Download, Inbox, ChevronDown, ArrowRight, ShieldAlert,
  Wrench, HelpCircle, Plus, Mail, Copy,
} from "lucide-react";
import {
  useGetConvention,
  useGetProject,
  useCoordinationEvents,
  useCoordinationIntake,
  useCoordinationConfirm,
  type CoordinationIntakeResponse,
  type CoordinationProposedField,
  type CoordinationConventionFieldSnapshot,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";

const COORD_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── chip palette (same as NameGenerator.tsx) ─────────────────────────────────
const CHIP_COLORS = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
  { bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  { bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" },
  { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
  { bg: "#FCE7F3", color: "#9D174D", border: "#FBCFE8" },
  { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA" },
  { bg: "#E0F2FE", color: "#0C4A6E", border: "#BAE6FD" },
  { bg: "#F3F4F6", color: "#374151", border: "#D1D5DB" },
];

// ── searchable select (same shape as NameGenerator.tsx) ──────────────────────
function SearchableSelect({
  value, onChange, options, color,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  color: { bg: string; color: string; border: string };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const select = (v: string) => { onChange(v); setOpen(false); setQuery(""); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: 32, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 8px", borderRadius: 5, cursor: "pointer",
          border: `1px solid ${open ? color.color : color.border}`,
          background: color.bg, color: color.color,
          fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "Select…"}</span>
        <ChevronDown style={{ width: 12, height: 12, marginLeft: 6, opacity: 0.7 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
          background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 180,
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && filtered.length > 0) select(filtered[0]);
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
              }}
              placeholder="Type to search…"
              style={{
                width: "100%", height: 28, fontSize: 11, padding: "0 8px",
                border: "1px solid hsl(var(--border))", borderRadius: 5,
                background: "hsl(var(--secondary))", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 4px 8px" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 11, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>No match</div>
            ) : filtered.map(opt => (
              <button
                key={opt}
                onClick={() => select(opt)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "6px 12px", borderRadius: 4, cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: opt === value ? 700 : 500,
                  background: opt === value ? color.bg : "transparent",
                  color: opt === value ? color.color : "hsl(var(--foreground))",
                  border: "none",
                }}
              >{opt}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── confidence colors ────────────────────────────────────────────────────────
function confColor(c: string | null | undefined): string {
  if (c === "high") return "#16A34A";
  if (c === "medium") return "#CA8A04";
  if (c === "low") return "#DC2626";
  return "#6B7280";
}

// ── component ────────────────────────────────────────────────────────────────
interface CoordHubMember {
  userId: number;
  userFullName: string;
  userEmail?: string;
  userCompanyName?: string;
  role: string;
}

export function CoordinationHub({
  projectId, canWrite, currentUserRole = "", members = [],
}: {
  projectId: number;
  canWrite: boolean;
  currentUserRole?: string;
  members?: CoordHubMember[];
}) {
  const conventionManager = members.find(m => m.role === "convention_manager");
  const projectAdmin = members.find(m => m.role === "project_admin");
  const helpContact = conventionManager ?? projectAdmin ?? null;
  const helpContactRoleLabel = conventionManager ? "Convention Manager" : "Convention Admin";
  const canFix = currentUserRole === "project_admin" || currentUserRole === "convention_manager";
  const { toast } = useToast();
  const { data: convention, isLoading: convLoading } = useGetConvention(projectId);
  const { data: projectInfo } = useGetProject(projectId);
  const projectName = projectInfo?.name ?? `Project ${projectId}`;
  const { data: events = [], isLoading: eventsLoading } = useCoordinationEvents(projectId);
  const intakeMutation = useCoordinationIntake(projectId);
  const confirmMutation = useCoordinationConfirm(projectId);

  const [intakeResult, setIntakeResult] = useState<CoordinationIntakeResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ filename: string; mode: "downloaded" | "queued_sync" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  const isActive = !!(convention?.isActive && (convention.fields?.length ?? 0) > 0);
  const fields = useMemo(
    () => [...(convention?.fields ?? [])].sort((a, b) => a.fieldOrder - b.fieldOrder),
    [convention],
  );

  function reset() {
    setIntakeResult(null);
    setOverrides({});
    setEditing(null);

    setSuccessInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (!isActive) {
      toast({ title: "No active convention", description: "Set up the naming convention first.", variant: "destructive" });
      return;
    }
    try {
      const result = await intakeMutation.mutateAsync(file);
      setIntakeResult(result);
      setOverrides({});
  
    } catch (e) {
      toast({
        title: "Intake failed",
        description: e instanceof Error ? e.message : "Could not analyze file",
        variant: "destructive",
      });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function buildFinalFilename(): { filename: string; fieldsChanged: Record<string, string>; manuallyCorrected: boolean } {
    if (!intakeResult) return { filename: "", fieldsChanged: {}, manuallyCorrected: false };
    const sep = intakeResult.conventionSnapshot.separator;
    const parts: string[] = [];
    const fieldsChanged: Record<string, string> = {};
    intakeResult.analysis.proposedFields.forEach(pf => {
      const final = overrides[pf.fieldLabel] ?? pf.proposedValue;
      parts.push(final);
      if (overrides[pf.fieldLabel] && overrides[pf.fieldLabel] !== pf.proposedValue) {
        fieldsChanged[pf.fieldLabel] = `${pf.proposedValue} -> ${overrides[pf.fieldLabel]}`;
      }
    });
    const ext = intakeResult.originalFilename.includes(".")
      ? "." + intakeResult.originalFilename.split(".").pop()
      : "";
    const baseName = parts.filter(Boolean).join(sep);
    const filename = baseName ? `${baseName}${ext}` : intakeResult.analysis.proposedFilename;
    return { filename, fieldsChanged, manuallyCorrected: Object.keys(fieldsChanged).length > 0 };
  }

  async function doConfirm(destinationAction: "downloaded" | "queued_sync") {
    if (!intakeResult) return;
    const { filename, fieldsChanged, manuallyCorrected } = buildFinalFilename();
    try {
      const r = await confirmMutation.mutateAsync({
        cacheKey: intakeResult.cacheKey,
        userAction: manuallyCorrected ? "manually_corrected" : "accepted",
        finalFilename: filename,
        manualFieldsChanged: manuallyCorrected ? fieldsChanged : undefined,
        destinationAction,
        proposedFilename: intakeResult.analysis.proposedFilename,
        analysis: intakeResult.analysis,
        conventionId: intakeResult.conventionId,
        conventionSnapshot: intakeResult.conventionSnapshot,
        warningAcknowledged: intakeResult.analysis.severe,
      });
      if (destinationAction === "downloaded" && r.blob) {
        const url = URL.createObjectURL(r.blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
      setIntakeResult(null);
      setOverrides({});
      setEditing(null);
  
      setSuccessInfo({ filename, mode: destinationAction });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      toast({ title: "Confirm failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  async function doReject() {
    if (!intakeResult) return;
    try {
      await confirmMutation.mutateAsync({
        cacheKey: intakeResult.cacheKey,
        userAction: "rejected",
        finalFilename: "",
        destinationAction: "pending",
        proposedFilename: intakeResult.analysis.proposedFilename,
        analysis: intakeResult.analysis,
        conventionId: intakeResult.conventionId,
        conventionSnapshot: intakeResult.conventionSnapshot,
        warningAcknowledged: false,
      });
      toast({ title: "Rejected", description: "Logged as rejected." });
      reset();
    } catch (e) {
      toast({ title: "Reject failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (convLoading) {
    return <div style={{ padding: 32 }}><div className="skeleton" style={{ height: 100 }} /></div>;
  }

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Title + header strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", color: "#1D4ED8",
        }}><Inbox style={{ width: 18, height: 18 }} /></div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Coordination Hub</h1>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Smart intake — every file is read, understood, and renamed to your convention.</div>
        </div>
      </div>

      {/* ZONE A — convention summary or no-convention banner */}
      {!isActive ? (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderLeft: "4px solid #DC2626",
          borderRadius: 8, padding: "14px 16px", marginTop: 14,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: "#DC2626", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D" }}>No active convention</div>
            <div style={{ fontSize: 12, color: "#991B1B", marginTop: 4 }}>
              This project cannot use Coordination Hub until a coordinator sets up the naming convention.
            </div>
            <Link href={`/projects/${projectId}/convention`}>
              <button style={{
                marginTop: 10, padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                background: "#DC2626", color: "white", border: "none", cursor: "pointer",
              }}>Open Convention Builder</button>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{
          background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8,
          padding: "12px 14px", marginTop: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Active Convention · separator <code style={{ fontFamily: "var(--font-mono)", background: "#F3F4F6", padding: "1px 6px", borderRadius: 3 }}>{convention!.separator}</code>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {fields.map((f, i) => {
              const c = CHIP_COLORS[i % CHIP_COLORS.length];
              return (
                <span key={f.id} style={{
                  display: "inline-flex", alignItems: "center", padding: "4px 10px",
                  borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                }}>{f.label}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* SUCCESS CARD — replaces upload zone after a successful confirm */}
      {isActive && successInfo && (
        <div style={{
          marginTop: 16, padding: "20px 22px", borderRadius: 10,
          background: "#F0FDF4", border: "1px solid #BBF7D0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <CheckCircle2 style={{ width: 22, height: 22, color: "#16A34A" }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "#14532D" }}>
              {successInfo.mode === "downloaded" ? "File renamed and downloaded" : "File renamed and queued for sync"}
            </div>
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#14532D",
            background: "white", border: "1px solid #BBF7D0", borderRadius: 6,
            padding: "8px 12px", marginBottom: 14, wordBreak: "break-all",
          }}>{successInfo.filename}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: "#16A34A", color: "white", border: "none", cursor: "pointer",
              }}
            >
              <Upload style={{ width: 13, height: 13 }} />
              Process Another File
            </button>
            <button
              onClick={() => recentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: "white", color: "#16A34A", border: "1.5px solid #BBF7D0", cursor: "pointer",
              }}
            >
              <Inbox style={{ width: 13, height: 13 }} />
              View in Recent Intake
            </button>
          </div>
        </div>
      )}

      {/* ZONE B — Upload / Review */}
      {isActive && !intakeResult && !successInfo && (
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => canWrite && fileInputRef.current?.click()}
          style={{
            marginTop: 16, padding: "40px 24px", borderRadius: 10, textAlign: "center",
            border: `2px dashed ${dragActive ? "#1D4ED8" : "#D1D5DB"}`,
            background: dragActive ? "#EFF6FF" : "#FAFAFA",
            cursor: canWrite ? "pointer" : "not-allowed",
            opacity: canWrite ? 1 : 0.6,
            transition: "all 0.15s",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.dwg,.rvt,.ifc,.nwd,.nwc,.txt"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {intakeMutation.isPending ? (
            <>
              <Loader2 className="spin" style={{ width: 28, height: 28, color: "#1D4ED8", margin: "0 auto 10px", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>BIMLog is reading your document…</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Extracting text · matching convention · proposing rename</div>
            </>
          ) : (
            <>
              <Upload style={{ width: 32, height: 32, color: "#6B7280", margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Drop a file here, or click to browse</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                PDF · DOCX · XLSX · DWG · IFC · RVT — up to 50 MB
              </div>
            </>
          )}
        </div>
      )}

      {/* REVIEW PANEL */}
      {isActive && intakeResult && (
        <ReviewPanel
          projectId={projectId}
          result={intakeResult}
          fields={intakeResult.conventionSnapshot.fields}
          overrides={overrides}
          setOverride={(label, val) => setOverrides(o => ({ ...o, [label]: val }))}
          editing={editing}
          setEditing={setEditing}
          finalFilename={buildFinalFilename().filename}
          onConfirmDownload={() => doConfirm("downloaded")}
          onConfirmQueue={() => doConfirm("queued_sync")}
          onReject={doReject}
          confirming={confirmMutation.isPending}
          canFix={canFix}
          helpContact={helpContact}
          helpContactRoleLabel={helpContactRoleLabel}
          projectName={projectName}
        />
      )}

      {/* ZONE C — Recent events */}
      <div ref={recentRef} style={{ marginTop: 28, scrollMarginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Recent Intake
        </div>
        {eventsLoading ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : events.length === 0 ? (
          <div style={{
            padding: "24px 16px", textAlign: "center",
            background: "#FAFAFA", border: "1px dashed #E5E7EB", borderRadius: 8,
            fontSize: 12, color: "#6B7280",
          }}>
            No files processed yet — uploads will appear here.
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
            {events.map((e, i) => (
              <EventRow key={e.id} ev={e} isFirst={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── review panel ─────────────────────────────────────────────────────────────
function ReviewPanel({
  projectId,
  result, fields, overrides, setOverride, editing, setEditing,
  finalFilename,
  onConfirmDownload, onConfirmQueue, onReject, confirming,
  canFix, helpContact, helpContactRoleLabel, projectName,
}: {
  projectId: number;
  canFix: boolean;
  helpContact: { userFullName: string; userEmail?: string } | null;
  helpContactRoleLabel: string;
  projectName: string;
  result: CoordinationIntakeResponse;
  fields: CoordinationConventionFieldSnapshot[];
  overrides: Record<string, string>;
  setOverride: (label: string, val: string) => void;
  editing: string | null;
  setEditing: (s: string | null) => void;
  finalFilename: string;
  onConfirmDownload: () => void;
  onConfirmQueue: () => void;
  onReject: () => void;
  confirming: boolean;
}) {
  const a = result.analysis;
  const sep = result.conventionSnapshot.separator;
  const severe = a.severe;

  // Build chips in convention field order; fall back to AI's order if labels mismatch.
  const fieldsByLabel = new Map(a.proposedFields.map(pf => [pf.fieldLabel, pf]));
  const orderedFields: { label: string; pf: CoordinationProposedField | undefined; index: number; allowed: string[] }[] =
    fields.length > 0
      ? fields.map((cf, idx) => ({
          label: cf.label,
          pf: fieldsByLabel.get(cf.label),
          index: idx,
          allowed: cf.allowedValues || [],
        }))
      : a.proposedFields.map((pf, idx) => ({ label: pf.fieldLabel, pf, index: idx, allowed: [] }));

  return (
    <div style={{
      marginTop: 16, background: "white", borderRadius: 10,
      border: severe ? "1px solid #FECACA" : "1px solid hsl(var(--border))",
      borderLeft: severe ? "4px solid #DC2626" : "1px solid hsl(var(--border))",
      padding: "16px 18px",
    }}>
      {severe && (
        <div style={{
          background: "#FEF2F2", color: "#7F1D1D",
          border: "1px solid #FECACA", borderRadius: 6,
          padding: "10px 12px", marginBottom: 14,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <ShieldAlert style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>BIMLog detected a serious conflict — review carefully before confirming.</div>
            {a.severeReason && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>{a.severeReason}</div>}
          </div>
        </div>
      )}

      {/* Original vs Proposed */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Original</div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 12, color: "#6B7280",
          textDecoration: "line-through", padding: "6px 10px", background: "#F9FAFB",
          border: "1px solid #E5E7EB", borderRadius: 5, display: "inline-block",
        }}>
          {result.originalFilename}
        </div>
      </div>

      <div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Proposed</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: confColor(a.overallConfidence) }}>
            {a.overallConfidence?.toUpperCase()} CONFIDENCE
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {orderedFields.map(({ label, pf, index, allowed }, idx) => {
            const c = CHIP_COLORS[index % CHIP_COLORS.length];
            const value = overrides[label] ?? pf?.proposedValue ?? "";
            const changed = overrides[label] && overrides[label] !== pf?.proposedValue;
            const lowConf = pf?.confidence === "low";
            const hasOptions = allowed.length > 0;
            return (
              <div key={label} style={{ minWidth: 120 }}>
                {hasOptions ? (
                  <SearchableSelect
                    value={value}
                    onChange={v => setOverride(label, v)}
                    options={allowed}
                    color={c}
                  />
                ) : (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4, height: 32,
                    padding: "0 10px", borderRadius: 6,
                    background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800,
                  }}>
                    {value || "—"}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  {(lowConf || changed) && <AlertTriangle style={{ width: 9, height: 9, color: "#D97706" }} />}
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}{changed ? " · edited" : (lowConf ? " · low conf." : "")}
                  </div>
                </div>
                {pf?.reasoning && (
                  <div style={{ fontSize: 9, color: "#9CA3AF", fontStyle: "italic", marginTop: 2, maxWidth: 180, lineHeight: 1.4 }}>
                    {pf.reasoning}
                  </div>
                )}
                {pf?.action && (
                  <ActionBanner
                    action={pf.action}
                    canFix={canFix}
                    helpContact={helpContact}
                    helpContactRoleLabel={helpContactRoleLabel}
                    projectId={projectId}
                    fieldLabel={label}
                    suggestedValue={value || pf?.proposedValue || ""}
                    reason={pf?.reasoning ?? ""}
                    originalFilename={result.originalFilename}
                    projectName={projectName}
                  />
                )}
                {idx < orderedFields.length - 1 && (
                  <div style={{ display: "none" }}>{sep}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: 12, padding: "8px 12px",
          background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 5,
          fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#111827",
        }}>
          {finalFilename}
        </div>
      </div>

      {/* AI understanding */}
      <div style={{
        marginTop: 16, padding: "12px 14px",
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          What BIMLog understood
        </div>
        <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5 }}>{a.aiSummary || "(no summary)"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, fontSize: 10 }}>
          {a.detectedDiscipline && <DetectedTag label="Discipline" value={a.detectedDiscipline} />}
          {a.detectedDocType && <DetectedTag label="Doc Type" value={a.detectedDocType} />}
          {a.detectedLevel && <DetectedTag label="Level" value={a.detectedLevel} />}
          {a.detectedOriginator && <DetectedTag label="Originator" value={a.detectedOriginator} />}
        </div>
        {a.keywords && a.keywords.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {a.keywords.map(k => (
              <span key={k} style={{
                padding: "2px 8px", borderRadius: 10, background: "#E5E7EB", color: "#374151",
                fontSize: 10, fontWeight: 600,
              }}>{k}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons (Fix 4: always active, no checkbox) */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onConfirmDownload}
          disabled={confirming}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: "#1D4ED8", color: "white",
            border: "none", cursor: "pointer",
            opacity: confirming ? 0.6 : 1,
          }}
        >
          <Download style={{ width: 13, height: 13 }} />
          Confirm & Download
        </button>
        <button
          onClick={onConfirmQueue}
          disabled={confirming}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: "white", color: "#1D4ED8", border: "1.5px solid #BFDBFE",
            cursor: "pointer",
            opacity: confirming ? 0.6 : 1,
          }}
        >
          <CheckCircle2 style={{ width: 13, height: 13 }} />
          Confirm & Queue for Sync
        </button>
        <button
          onClick={onReject}
          disabled={confirming}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: "transparent", color: "#6B7280", border: "1px solid transparent",
            cursor: "pointer", marginLeft: "auto",
          }}
        >
          <X style={{ width: 13, height: 13 }} />
          Reject
        </button>
      </div>
    </div>
  );
}

function ActionBanner({
  action, canFix, helpContact, helpContactRoleLabel, projectId,
  fieldLabel, suggestedValue, reason, originalFilename, projectName,
}: {
  action: { type: string; text: string };
  canFix: boolean;
  helpContact: { userFullName: string; userEmail?: string } | null;
  helpContactRoleLabel: string;
  projectId: number;
  fieldLabel: string;
  suggestedValue: string;
  reason: string;
  originalFilename: string;
  projectName: string;
}) {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  const showFixLink =
    canFix && (action.type === "VALUE_NOT_IN_CONVENTION" || action.type === "CONVENTION_INCOMPLETE");
  const showAddNow =
    canFix && action.type === "VALUE_NOT_IN_CONVENTION" && !!suggestedValue;
  const showMemberEmail =
    !canFix && action.type === "VALUE_NOT_IN_CONVENTION" && !!suggestedValue;

  async function handleAddNow() {
    if (!suggestedValue) return;
    setAdding(true);
    try {
      const r = await fetch(`${COORD_API_BASE}/api/v1/projects/${projectId}/conventions/suggest-value`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fieldLabel, suggestedValue, reason, sourceFile: originalFilename }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.added !== true) {
        throw new Error(data?.error || "Could not add value");
      }
      setAdded(true);
      // Refresh convention so the chip dropdowns include the new value.
      // Generated query key is the URL path itself (see generated/api.ts).
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
    } catch (e) {
      toast({
        title: "Could not add value",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  const adminName = helpContact?.userFullName || "team admin";
  const adminEmail = helpContact?.userEmail || "";
  const emailSubject = `BIMLog — Convention update needed for ${projectName}`;
  const emailBody =
    `Hi ${adminName},\n\n` +
    `I uploaded ${originalFilename} to the Coordination Hub and BIMLog detected ` +
    `that the value "${suggestedValue}" is not in the allowed list for the ${fieldLabel} field. ` +
    `Please add it to the Convention Builder so the file can be correctly named.\n\n` +
    `Project: ${projectName}\n` +
    `File: ${originalFilename}`;

  function handlePrepareEmail() {
    const url = `mailto:${encodeURIComponent(adminEmail)}` +
      `?subject=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${emailSubject}\n\n${emailBody}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Clipboard not available", variant: "destructive" });
    }
  }

  if (canFix) {
    return (
      <div style={{
        marginTop: 6, maxWidth: 240,
        padding: "6px 8px", borderRadius: 5,
        background: added ? "#ECFDF5" : "#EFF6FF",
        border: `1px solid ${added ? "#A7F3D0" : "#BFDBFE"}`,
        color: added ? "#065F46" : "#1E3A8A",
        fontSize: 10, lineHeight: 1.4,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
          {added
            ? <CheckCircle2 style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
            : <Wrench style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />}
          <span>
            {added
              ? `'${suggestedValue}' added to ${fieldLabel} — re-analyze to update this file.`
              : action.text}
          </span>
        </div>
        {!added && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5, alignItems: "center" }}>
            {showFixLink && (
              <Link
                href={`/projects/${projectId}/convention`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, fontWeight: 700,
                  color: "#1D4ED8", textDecoration: "none",
                }}
              >
                Fix in Convention Builder <ArrowRight style={{ width: 10, height: 10 }} />
              </Link>
            )}
            {showAddNow && (
              <button
                type="button"
                onClick={handleAddNow}
                disabled={adding}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "3px 8px", borderRadius: 4,
                  background: "#1D4ED8", color: "white", border: "none",
                  fontSize: 10, fontWeight: 700, cursor: adding ? "default" : "pointer",
                  opacity: adding ? 0.6 : 1,
                }}
              >
                {adding
                  ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
                  : <Plus style={{ width: 10, height: 10 }} />}
                Add '{suggestedValue}' now
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Member view: yellow banner with rephrased text + contact line
  const memberText = action.text.replace(
    /A Convention Manager must/g,
    "Ask your Convention Manager to",
  );
  return (
    <div style={{
      marginTop: 6, maxWidth: 240,
      padding: "6px 8px", borderRadius: 5,
      background: "#FEF9C3", border: "1px solid #FDE68A",
      color: "#854D0E", fontSize: 10, lineHeight: 1.4,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
        <HelpCircle style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
        <span>{memberText}</span>
      </div>
      {helpContact && (
        <div style={{ marginTop: 4, fontWeight: 700 }}>
          {helpContactRoleLabel}: {helpContact.userFullName}
          {helpContact.userEmail && (
            <>
              {" — "}
              <a href={`mailto:${helpContact.userEmail}`} style={{ color: "#854D0E", textDecoration: "underline" }}>
                {helpContact.userEmail}
              </a>
            </>
          )}
        </div>
      )}
      {showMemberEmail && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={handlePrepareEmail}
            disabled={!adminEmail}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "3px 8px", borderRadius: 4,
              background: "#854D0E", color: "white", border: "none",
              fontSize: 10, fontWeight: 700,
              cursor: adminEmail ? "pointer" : "not-allowed",
              opacity: adminEmail ? 1 : 0.5,
            }}
          >
            <Mail style={{ width: 10, height: 10 }} />
            Prepare email to admin
          </button>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "3px 8px", borderRadius: 4,
              background: "white", color: "#854D0E", border: "1px solid #FDE68A",
              fontSize: 10, fontWeight: 700, cursor: "pointer",
            }}
          >
            {copied
              ? <CheckCircle2 style={{ width: 10, height: 10 }} />
              : <Copy style={{ width: 10, height: 10 }} />}
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>
      )}
    </div>
  );
}

function DetectedTag({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, background: "white",
      border: "1px solid #CBD5E1", color: "#1E293B", fontSize: 10, fontWeight: 600,
    }}>
      <span style={{ color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 8 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

// ── event row ────────────────────────────────────────────────────────────────
function EventRow({ ev, isFirst }: { ev: { id: number; originalFilename: string; finalFilename: string | null; aiConfidence: string | null; warningsTriggered: boolean | null; userAction: string | null; uploaderCompany: string | null; uploaderName: string | null; createdAt: string; destinationAction: string | null }; isFirst: boolean }) {
  const conf = ev.warningsTriggered ? "low" : (ev.aiConfidence ?? null);
  const finalColor = confColor(conf);

  const actionStyle: Record<string, { bg: string; color: string; label: string }> = {
    accepted:           { bg: "#DCFCE7", color: "#166534", label: "Auto-accepted" },
    manually_corrected: { bg: "#FEF9C3", color: "#854D0E", label: "Manually corrected" },
    rejected:           { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" },
  };
  const a = ev.userAction ? actionStyle[ev.userAction] : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px",
      borderTop: isFirst ? "none" : "1px solid hsl(var(--border))",
      fontSize: 12,
    }}>
      <FileText style={{ width: 14, height: 14, color: "#9CA3AF", flexShrink: 0 }} />
      <span style={{
        fontFamily: "var(--font-mono)", color: "#9CA3AF", textDecoration: "line-through",
        maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{ev.originalFilename}</span>
      <ArrowRight style={{ width: 12, height: 12, color: "#D1D5DB", flexShrink: 0 }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontWeight: 700, color: finalColor,
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{ev.finalFilename || "(no name)"}</span>
      {a && (
        <span style={{
          padding: "2px 8px", borderRadius: 10, background: a.bg, color: a.color,
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>{a.label}</span>
      )}
      <span style={{ color: "#6B7280", fontSize: 11, flexShrink: 0, minWidth: 100, textAlign: "right" }}>
        {ev.uploaderName ?? "—"}{ev.uploaderCompany ? ` · ${ev.uploaderCompany}` : ""}
      </span>
      <span style={{ color: "#9CA3AF", fontSize: 10, flexShrink: 0, minWidth: 90, textAlign: "right" }}>
        {new Date(ev.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
