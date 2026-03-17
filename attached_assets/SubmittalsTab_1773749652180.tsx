import { useState } from "react";
import { useListSubmittals, useCreateSubmittal, useUpdateSubmittal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Plus, X, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const SUBMITTAL_STATUS_BADGE: Record<string, string> = {
  pending:            "badge-gray",
  submitted:          "badge-blue",
  under_review:       "badge-amber",
  approved:           "badge-green",
  approved_as_noted:  "badge-blue",
  rejected:           "badge-red",
  revise_resubmit:    "badge-orange",
};

const STATUS_ORDER = [
  "pending", "submitted", "under_review",
  "revise_resubmit", "approved_as_noted", "approved", "rejected"
];

export function SubmittalsTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { t } = useI18n();
  const { getLabel } = useConfig();
  const { data: submittals, isLoading } = useListSubmittals(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const pendingCount  = submittals?.filter(s => s.status !== "approved" && s.status !== "rejected").length ?? 0;
  const approvedCount = submittals?.filter(s => s.status === "approved" || s.status === "approved_as_noted").length ?? 0;
  const rejectedCount = submittals?.filter(s => s.status === "rejected" || s.status === "revise_resubmit").length ?? 0;

  const actionNeeded = submittals?.filter(s => {
    const days = differenceInDays(new Date(), new Date(s.createdAt));
    return (s.status === "submitted" || s.status === "under_review") && days > 14;
  }).length ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.submittals")}</div>
          <div className="section-sub">
            {submittals?.length ?? 0} total · {pendingCount} pending · {approvedCount} approved · {rejectedCount} action needed
          </div>
        </div>
        {canWrite && !showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 12 }}>
            <Plus style={{ width: 13, height: 13 }} />
            {t("submittals.create")}
          </Button>
        )}
      </div>

      {/* Action needed warning */}
      {actionNeeded > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
          padding: "10px 14px", background: "#FFFBEB",
          border: "1px solid #FDE68A", borderRadius: 8,
          fontSize: 12, color: "#B45309"
        }}>
          <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <strong>{actionNeeded} submittal{actionNeeded !== 1 ? "s" : ""}</strong>&nbsp;
          under review for more than 14 days without a response. Follow up required.
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <CreateSubmittalForm
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
        submittals && submittals.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t("submittals.number")}</th>
                  <th>{t("submittals.titleCol")}</th>
                  <th style={{ width: 120 }}>{t("submittals.type")}</th>
                  <th style={{ width: 130 }}>{t("submittals.status")}</th>
                  <th>{t("submittals.submittedBy")}</th>
                  <th style={{ width: 100 }}>{t("submittals.date")}</th>
                  <th style={{ width: 80 }}>Age</th>
                  {canWrite && <th style={{ width: 80, textAlign: "right" }}>Update</th>}
                </tr>
              </thead>
              <tbody>
                {[...submittals]
                  .sort((a, b) => {
                    const ai = STATUS_ORDER.indexOf(a.status);
                    const bi = STATUS_ORDER.indexOf(b.status);
                    if (ai !== bi) return ai - bi;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map(sub => {
                    const daysOld = differenceInDays(new Date(), new Date(sub.createdAt));
                    const isActionNeeded = (sub.status === "submitted" || sub.status === "under_review") && daysOld > 14;
                    const isExpanded = expandedId === sub.id;

                    return (
                      <>
                        <tr
                          key={sub.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                        >
                          <td>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: 11,
                              fontWeight: 600, color: "hsl(var(--muted-foreground))"
                            }}>
                              {sub.number}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isActionNeeded && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", flexShrink: 0, display: "inline-block" }} />
                              )}
                              <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                {sub.title}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                              {getLabel("submittal_type", sub.submittalType ?? "")}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${SUBMITTAL_STATUS_BADGE[sub.status] ?? "badge-gray"}`}>
                              {getLabel("submittal_status", sub.status)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div className="avatar avatar-sm av-teal">
                                {sub.submittedByName?.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12 }}>{sub.submittedByName}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                            {format(new Date(sub.createdAt), "MMM d, yyyy")}
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600,
                              color: isActionNeeded ? "#D97706" : daysOld > 7 ? "#D97706" : "#16A34A"
                            }}>
                              {daysOld}d
                            </span>
                          </td>
                          {canWrite && (
                            <td style={{ textAlign: "right" }}>
                              <button
                                style={{ padding: 4, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
                                onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : sub.id); }}
                              >
                                {isExpanded
                                  ? <ChevronUp style={{ width: 14, height: 14 }} />
                                  : <ChevronDown style={{ width: 14, height: 14 }} />
                                }
                              </button>
                            </td>
                          )}
                        </tr>

                        {isExpanded && canWrite && (
                          <tr key={`${sub.id}-expand`}>
                            <td colSpan={8} style={{ padding: 0, background: "hsl(var(--secondary) / 0.4)" }}>
                              <UpdateSubmittalRow
                                projectId={projectId}
                                submittal={sub}
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
              <FileCheck style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="empty-title">{t("submittals.empty")}</div>
            <div className="empty-desc">
              Create your first submittal to begin tracking shop drawings, product data, and material samples for this project.
            </div>
          </div>
        )
      )}
    </div>
  );
}

function CreateSubmittalForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const typeOptions = getOptions("submittal_type");
  const [title, setTitle] = useState("");
  const [submittalType, setSubmittalType] = useState(typeOptions[0]?.value ?? "");

  const { mutate, isPending } = useCreateSubmittal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
        toast({ title: t("submittals.createdSuccess") });
        onClose();
      },
    },
  });

  return (
    <div className="inline-form" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{t("submittals.new")}</div>
        <button onClick={onClose} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          style={{ flex: 1 }}
          placeholder={t("submittals.titlePlaceholder")}
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />
        <select
          value={submittalType}
          onChange={e => setSubmittalType(e.target.value)}
          style={{ height: 36, minWidth: 140 }}
        >
          {typeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {lang === "es" ? opt.labelEs : opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!title || isPending}
          onClick={() => mutate({ projectId, data: { title, submittalType } })}
          style={{ minWidth: 80 }}
        >
          {isPending ? "..." : t("submittals.submit")}
        </Button>
      </div>
    </div>
  );
}

function UpdateSubmittalRow({ projectId, submittal, onClose }: {
  projectId: number;
  submittal: { id: number; status: string; submittalType?: string | null };
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusOptions = getOptions("submittal_status");
  const [status, setStatus] = useState(submittal.status);

  const { mutate, isPending } = useUpdateSubmittal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/submittals`] });
        toast({ title: "Submittal updated" });
        onClose();
      },
    },
  });

  return (
    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid hsl(var(--border))" }}>
      <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginRight: 4 }}>Update status:</span>
      <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 32, fontSize: 12, minWidth: 160 }}>
        {statusOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={isPending || status === submittal.status}
        onClick={() => mutate({ projectId, submittalId: submittal.id, data: { status } })}
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
