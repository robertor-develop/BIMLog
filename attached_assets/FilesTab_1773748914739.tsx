import { useState } from "react";
import { useListFiles, useUploadFile, useDeleteFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileText, AlertCircle, X, CheckCircle2, Shield } from "lucide-react";
import { format } from "date-fns";

interface ValidationDetail {
  field: string;
  message: string;
  expected?: string[];
  received: string;
}

interface ApiError {
  data?: { error?: string; details?: ValidationDetail[] };
  response?: { data?: { error?: string; details?: ValidationDetail[] } };
  message?: string;
}

const FILE_EXT_ICON: Record<string, string> = {
  rvt: "icon-rvt", rfa: "icon-rvt",
  nwd: "icon-nwd", nwf: "icon-nwd", nwc: "icon-nwd",
  dwg: "icon-dwg", dxf: "icon-dwg",
  pdf: "icon-pdf",
  ifc: "icon-ifc",
};

function getIconClass(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_EXT_ICON[ext] || "icon-rvt";
}

function getExtLabel(fileName: string): string {
  return (fileName.split(".").pop() || "FILE").toUpperCase().slice(0, 3);
}

export function FilesTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { t } = useI18n();
  const { data: files, isLoading } = useListFiles(projectId);
  const [showUpload, setShowUpload] = useState(false);

  const validCount    = files?.filter(f => f.status !== "rejected").length ?? 0;
  const rejectedCount = files?.filter(f => f.status === "rejected").length ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.files")}</div>
          <div className="section-sub">
            {files?.length ?? 0} total · {validCount} valid · {rejectedCount} rejected
          </div>
        </div>
        {canWrite && !showUpload && (
          <Button size="sm" onClick={() => setShowUpload(true)} style={{ gap: 6, fontSize: 12 }}>
            <Upload style={{ width: 13, height: 13 }} />
            {t("files.upload")}
          </Button>
        )}
      </div>

      {/* Inline compliance notice */}
      {rejectedCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
          padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 8, fontSize: 12, color: "#B45309"
        }}>
          <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <strong>{rejectedCount} file{rejectedCount !== 1 ? "s" : ""}</strong>&nbsp;
          rejected due to naming convention violations. Review below.
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <UploadForm projectId={projectId} onClose={() => setShowUpload(false)} />
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
        files && files.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("files.name")}</th>
                  <th>{t("files.version")}</th>
                  <th>{t("files.status")}</th>
                  <th>{t("files.uploader")}</th>
                  <th>{t("files.date")}</th>
                  {canWrite && <th style={{ textAlign: "right" }}>{t("files.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {[...files]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(file => {
                    const isRejected = file.status === "rejected";
                    return (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className={`file-icon ${getIconClass(file.fileName)}`}>
                              {getExtLabel(file.fileName)}
                            </div>
                            <div>
                              <div className={isRejected ? "file-name-rejected" : "file-name"}>
                                {file.fileName}
                              </div>
                              {isRejected && (
                                <div style={{ fontSize: 10, color: "#BE123C", marginTop: 1 }}>
                                  Naming violation — upload rejected
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                          v{file.version}
                        </td>
                        <td>
                          <span className={`badge ${isRejected ? "badge-red" : "badge-green"}`}>
                            {isRejected ? "Rejected" : "Valid"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="avatar avatar-sm av-blue">
                              {file.uploadedByName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                {file.uploadedByName}
                              </div>
                              <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                                {file.uploadedByCompany}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                          {format(new Date(file.createdAt), "MMM d, yyyy HH:mm")}
                        </td>
                        {canWrite && (
                          <td style={{ textAlign: "right" }}>
                            <DeleteButton projectId={projectId} fileId={file.id} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="empty-title">{t("files.empty")}</div>
            <div className="empty-desc">
              Upload a file to test naming convention validation. Files that don't match the active convention will be rejected automatically.
            </div>
          </div>
        )
      )}

      {/* Audit trail notice */}
      {(files?.length ?? 0) > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 12,
          fontSize: 11, color: "hsl(var(--muted-foreground))"
        }}>
          <Shield style={{ width: 12, height: 12 }} />
          All file events are permanently recorded in the immutable audit trail. Go to Activity Log to view the full history.
        </div>
      )}
    </div>
  );
}

function UploadForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const [errorDetails, setErrorDetails] = useState<ValidationDetail[]>([]);
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useUploadFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/activity`] });
        setSuccess(true);
        setTimeout(() => onClose(), 1200);
      },
      onError: (err: ApiError) => {
        const data = err.data || err.response?.data;
        if (data?.details) {
          setErrorDetails(data.details);
        } else {
          toast({ title: t("common.error"), description: data?.error || err.message, variant: "destructive" });
        }
      },
    },
  });

  return (
    <div className="inline-form" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{t("files.simulate")}</div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{t("files.simulateHint")}</div>
        </div>
        <button
          onClick={onClose}
          style={{ padding: 5, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Input
          style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
          placeholder={t("files.placeholder")}
          value={fileName}
          onChange={e => { setFileName(e.target.value); setErrorDetails([]); setSuccess(false); }}
        />
        <Button
          size="sm"
          disabled={!fileName || isPending || success}
          onClick={() => mutate({ projectId, data: { fileName, fileSize: 1024, fileType: "application/octet-stream" } })}
          style={{ gap: 5, minWidth: 110 }}
        >
          {success
            ? <><CheckCircle2 style={{ width: 13, height: 13 }} /> Accepted</>
            : isPending ? "Validating..."
            : t("files.testUpload")}
        </Button>
      </div>

      {/* Validation error breakdown */}
      {errorDetails.length > 0 && (
        <div className="validation-error" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#BE123C", marginBottom: 10 }}>
            <AlertCircle style={{ width: 14, height: 14 }} />
            {t("files.namingViolation")}
          </div>

          {/* Token breakdown */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9F1239", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              File name breakdown
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
              {fileName.split(/[-_.]/).map((part, i, arr) => {
                const hasError = errorDetails.some(d => d.received === part);
                return (
                  <span key={i}>
                    <span className={hasError ? "name-tag name-tag-invalid" : "name-tag name-tag-valid"}>
                      {part}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="name-tag-sep">{fileName.includes("-") ? "-" : "_"}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Error list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {errorDetails.map((detail, i) => (
              <div key={i} style={{ fontSize: 11, color: "#9F1239" }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {detail.field}: {detail.message}
                </div>
                {detail.expected && detail.expected.length > 0 && (
                  <div>
                    <span style={{ color: "#6B7280" }}>Allowed values: </span>
                    {detail.expected.map(v => (
                      <span key={v} style={{
                        fontFamily: "var(--font-mono)", fontSize: 10,
                        background: "#FEE2E2", color: "#991B1B",
                        border: "1px solid #FECDD3",
                        padding: "1px 6px", borderRadius: 3,
                        marginRight: 4, marginBottom: 2, display: "inline-block"
                      }}>{v}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="validation-success" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 style={{ width: 15, height: 15, color: "#16A34A" }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#15803D" }}>File accepted</div>
            <div style={{ fontSize: 11, color: "#166534", fontFamily: "var(--font-mono)", marginTop: 1 }}>{fileName}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteButton({ projectId, fileId }: { projectId: number; fileId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useDeleteFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/files`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/activity`] });
        toast({ title: t("files.deleted") });
      },
    },
  });

  return (
    <button
      disabled={isPending}
      onClick={() => { if (confirm(t("files.deleteConfirm"))) mutate({ projectId, fileId }); }}
      style={{
        padding: 6, borderRadius: 6, border: "none",
        background: "transparent", cursor: "pointer",
        color: "hsl(var(--muted-foreground))",
        opacity: isPending ? 0.5 : 1,
        transition: "color 0.12s"
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
      onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  );
}
