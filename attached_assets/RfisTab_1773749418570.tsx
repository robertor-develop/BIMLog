import { useState } from "react";
import { useListRfis, useCreateRfi, useUpdateRfi } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const RFI_STATUS_BADGE: Record<string, string> = {
  open:      "badge-blue",
  in_review: "badge-amber",
  responded: "badge-purple",
  closed:    "badge-green",
};

const RFI_PRIORITY_BADGE: Record<string, string> = {
  low:    "badge-gray",
  medium: "badge-amber",
  high:   "badge-red",
};

const STATUS_ORDER = ["open", "in_review", "responded", "closed"];

export function RfisTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { t } = useI18n();
  const { getLabel } = useConfig();
  const { data: rfis, isLoading } = useListRfis(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const openCount     = rfis?.filter(r => r.status !== "closed").length ?? 0;
  const overdueCount  = rfis?.filter(r => {
    if (r.status === "closed") return false;
    return differenceInDays(new Date(), new Date(r.createdAt)) > 7;
  }).length ?? 0;
  const closedCount   = rfis?.filter(r => r.status === "closed").length ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.rfis")}</div>
          <div className="section-sub">
            {rfis?.length ?? 0} total · {openCount} open · {closedCount} closed
          </div>
        </div>
        {canWrite && !showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 12 }}>
            <Plus style={{ width: 13, height: 13 }} />
            {t("rfis.create")}
          </Button>
        )}
      </div>

      {/* Overdue warning */}
      {overdueCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
          padding: "10px 14px", background: "#FFF1F2",
          border: "1px solid #FECDD3", borderRadius: 8,
          fontSize: 12, color: "#BE123C"
        }}>
          <Clock style={{ width: 15, height: 15, flexShrink: 0 }} />
          <strong>{overdueCount} RFI{overdueCount !== 1 ? "s" : ""}</strong>&nbsp;
          overdue (open for more than 7 days). Escalation may be required.
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <CreateRfiForm
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        rfis && rfis.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t("rfis.number")}</th>
                  <th>{t("rfis.subject")}</th>
                  <th style={{ width: 110 }}>{t("rfis.status")}</th>
                  <th style={{ width: 90 }}>{t("rfis.priority")}</th>
                  <th>{t("rfis.creator")}</th>
                  <th style={{ width: 100 }}>{t("rfis.created")}</th>
                  <th style={{ width: 80 }}>Age</th>
                  {canWrite && <th style={{ width: 100, textAlign: "right" }}>Update</th>}
                </tr>
              </thead>
              <tbody>
                {[...rfis]
                  .sort((a, b) => {
                    const ai = STATUS_ORDER.indexOf(a.status);
                    const bi = STATUS_ORDER.indexOf(b.status);
                    if (ai !== bi) return ai - bi;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map(rfi => {
                    const daysOld = differenceInDays(new Date(), new Date(rfi.createdAt));
                    const isOverdue = rfi.status !== "closed" && daysOld > 7;
                    const isExpanded = expandedId === rfi.id;

                    return (
                      <>
                        <tr
                          key={rfi.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedId(isExpanded ? null : rfi.id)}
                        >
                          <td>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: 11,
                              fontWeight: 600, color: "hsl(var(--muted-foreground))"
                            }}>
                              {rfi.number}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isOverdue && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626", flexShrink: 0, display: "inline-block" }} />
                              )}
                              <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                {rfi.subject}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${RFI_STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>
                              {getLabel("rfi_status", rfi.status)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${RFI_PRIORITY_BADGE[rfi.priority] ?? "badge-gray"}`}>
                              {getLabel("rfi_priority", rfi.priority)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div className="avatar avatar-sm av-blue">
                                {rfi.createdByName?.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12 }}>{rfi.createdByName}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                            {format(new Date(rfi.createdAt), "MMM d, yyyy")}
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: isOverdue ? "#DC2626" : daysOld > 3 ? "#D97706" : "#16A34A"
                            }}>
                              {daysOld}d
                            </span>
                          </td>
                          {canWrite && (
                            <td style={{ textAlign: "right" }}>
                              <button
                                style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
                                onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : rfi.id); }}
                              >
                                {isExpanded
                                  ? <ChevronUp style={{ width: 14, height: 14 }} />
                                  : <ChevronDown style={{ width: 14, height: 14 }} />
                                }
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Expanded update row */}
                        {isExpanded && canWrite && (
                          <tr key={`${rfi.id}-expand`}>
                            <td colSpan={8} style={{ padding: "0 0 0 0", background: "hsl(var(--secondary) / 0.4)" }}>
                              <UpdateRfiRow
                                projectId={projectId}
                                rfi={rfi}
                                onClose={() => setExpandedId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <MessageSquare style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="empty-title">{t("rfis.empty")}</div>
            <div className="empty-desc">
              Create your first RFI to begin tracking information requests and responses for this project.
            </div>
          </div>
        )
      )}
    </div>
  );
}

function CreateRfiForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const priorityOptions = getOptions("rfi_priority");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState(priorityOptions[0]?.value ?? "");

  const { mutate, isPending } = useCreateRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: t("rfis.createdSuccess") });
        onClose();
      },
    },
  });

  return (
    <div className="inline-form" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{t("rfis.new")}</div>
        <button onClick={onClose} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          style={{ flex: 1 }}
          placeholder={t("rfis.subjectPlaceholder")}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          autoFocus
        />
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          style={{ height: 36, minWidth: 110 }}
        >
          {priorityOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {lang === "es" ? opt.labelEs : opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!subject || isPending}
          onClick={() => mutate({ projectId, data: { subject, priority } })}
          style={{ minWidth: 80 }}
        >
          {isPending ? "..." : t("rfis.submit")}
        </Button>
      </div>
    </div>
  );
}

function UpdateRfiRow({ projectId, rfi, onClose }: {
  projectId: number;
  rfi: { id: number; status: string; priority: string; subject: string };
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusOptions  = getOptions("rfi_status");
  const priorityOptions = getOptions("rfi_priority");
  const [status, setStatus]   = useState(rfi.status);
  const [priority, setPriority] = useState(rfi.priority);

  const { mutate, isPending } = useUpdateRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: "RFI updated" });
        onClose();
      },
    },
  });

  return (
    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid hsl(var(--border))" }}>
      <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginRight: 4 }}>Update RFI:</span>
      <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 32, fontSize: 12 }}>
        {statusOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
        ))}
      </select>
      <select value={priority} onChange={e => setPriority(e.target.value)} style={{ height: 32, fontSize: 12 }}>
        {priorityOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={isPending || (status === rfi.status && priority === rfi.priority)}
        onClick={() => mutate({ projectId, rfiId: rfi.id, data: { status, priority } })}
        style={{ fontSize: 12 }}
      >
        {isPending ? "..." : "Save"}
      </Button>
      <button
        onClick={onClose}
        style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}
