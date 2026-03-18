import { useState, useRef, useCallback } from "react";
import { useListFiles, useUploadFile, useDeleteFile, useGetConvention } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileText, AlertCircle, X, CheckCircle2, Shield, Sparkles, Copy, ChevronDown, ChevronRight, History } from "lucide-react";
import { format } from "date-fns";
import { NameGenerator } from "./NameGenerator";

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

interface FileRow {
  id: number;
  projectId: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  version: number;
  parentFileId?: number | null;
  status: string;
  uploadedById: number;
  uploadedByName?: string;
  uploadedByCompany?: string;
  extractedText?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentFamily {
  root: FileRow;
  versions: FileRow[];
}

function buildFamilies(files: FileRow[]): DocumentFamily[] {
  const roots = files.filter(f => f.parentFileId == null);
  const childrenByRoot = new Map<number, FileRow[]>();
  files.filter(f => f.parentFileId != null).forEach(f => {
    const rid = f.parentFileId!;
    if (!childrenByRoot.has(rid)) childrenByRoot.set(rid, []);
    childrenByRoot.get(rid)!.push(f);
  });
  return roots
    .map(root => ({
      root,
      versions: [root, ...(childrenByRoot.get(root.id) ?? [])].sort((a, b) => a.version - b.version),
    }))
    .sort((a, b) => {
      const latestA = a.versions[a.versions.length - 1];
      const latestB = b.versions[b.versions.length - 1];
      return new Date(latestB.createdAt).getTime() - new Date(latestA.createdAt).getTime();
    });
}

function versionColor(v: number): string {
  const palette = ["#1D4ED8", "#7C3AED", "#0F766E", "#9A3412", "#1E3A5F", "#64748B"];
  return palette[(v - 1) % palette.length];
}

export function FilesTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { t } = useI18n();
  const { data: files, isLoading } = useListFiles(projectId);
  const [showUpload, setShowUpload] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleFamily = (rootId: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(rootId) ? s.delete(rootId) : s.add(rootId); return s; });

  const validCount    = files?.filter(f => f.status !== "rejected").length ?? 0;
  const rejectedCount = files?.filter(f => f.status === "rejected").length ?? 0;

  const families = files ? buildFamilies(files) : [];
  const versionedCount = families.filter(f => f.versions.length > 1).length;

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.files")}</div>
          <div className="section-sub">
            {families.length} document{families.length !== 1 ? "s" : ""}
            {" "}·{" "}{files?.length ?? 0} total versions
            {" "}·{" "}{validCount} valid · {rejectedCount} rejected
            {versionedCount > 0 && <> · <span style={{ color: "#7C3AED", fontWeight: 600 }}>{versionedCount} versioned</span></>}
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

      {/* Document families table */}
      {!isLoading && (
        families.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>{t("files.name")}</th>
                  <th>Versions</th>
                  <th>{t("files.status")}</th>
                  <th>Latest upload</th>
                  <th>Date</th>
                  {canWrite && <th style={{ textAlign: "right" }}>{t("files.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {families.map(({ root, versions }) => {
                  const latest = versions[versions.length - 1];
                  const isMulti = versions.length > 1;
                  const isExp = expanded.has(root.id);
                  const isRejected = latest.status === "rejected";

                  return (
                    <>
                      {/* ── Primary document row ── */}
                      <tr
                        key={`root-${root.id}`}
                        style={{ cursor: isMulti ? "pointer" : "default", background: isExp ? "hsl(var(--secondary) / 0.4)" : undefined }}
                        onClick={isMulti ? () => toggleFamily(root.id) : undefined}
                      >
                        {/* Expand chevron */}
                        <td style={{ paddingRight: 0, width: 28, textAlign: "center" }}>
                          {isMulti ? (
                            isExp
                              ? <ChevronDown style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
                              : <ChevronRight style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
                          ) : null}
                        </td>

                        {/* Document name */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className={`file-icon ${getIconClass(root.fileName)}`}>
                              {getExtLabel(root.fileName)}
                            </div>
                            <div>
                              <div className={isRejected ? "file-name-rejected" : "file-name"}>
                                {root.fileName}
                              </div>
                              {isRejected && (
                                <div style={{ fontSize: 10, color: "#BE123C", marginTop: 1 }}>
                                  Naming violation — upload rejected
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Version count / badge */}
                        <td>
                          {isMulti ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <History style={{ width: 11, height: 11, color: "#7C3AED" }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED" }}>
                                {versions.length} versions
                              </span>
                              <span style={{
                                fontSize: 10, fontFamily: "var(--font-mono)",
                                background: `${versionColor(latest.version)}18`,
                                color: versionColor(latest.version),
                                border: `1px solid ${versionColor(latest.version)}40`,
                                padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                              }}>
                                V{latest.version} latest
                              </span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: 10, fontFamily: "var(--font-mono)",
                              color: "hsl(var(--muted-foreground))", fontWeight: 500,
                            }}>
                              v1
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`badge ${isRejected ? "badge-red" : "badge-green"}`}>
                            {isRejected ? "Rejected" : "Valid"}
                          </span>
                        </td>

                        {/* Latest uploader */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="avatar avatar-sm av-blue">
                              {latest.uploadedByName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                {latest.uploadedByName}
                              </div>
                              <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                                {latest.uploadedByCompany}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                          {format(new Date(latest.createdAt), "MMM d, yyyy HH:mm")}
                        </td>

                        {/* Actions (delete latest version) */}
                        {canWrite && (
                          <td style={{ textAlign: "right" }}>
                            <DeleteButton projectId={projectId} fileId={latest.id} />
                          </td>
                        )}
                      </tr>

                      {/* ── Version history rows (expanded) ── */}
                      {isExp && versions.map((ver, idx) => {
                        const isVerRejected = ver.status === "rejected";
                        const isOriginal = idx === 0;
                        const isLatestVer = idx === versions.length - 1;
                        return (
                          <tr key={`ver-${ver.id}`} style={{ background: "hsl(var(--secondary) / 0.25)" }}>
                            <td></td>
                            <td colSpan={1}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 24 }}>
                                {/* Version badge */}
                                <span style={{
                                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                                  background: `${versionColor(ver.version)}18`,
                                  color: versionColor(ver.version),
                                  border: `1px solid ${versionColor(ver.version)}40`,
                                  padding: "2px 7px", borderRadius: 4,
                                  flexShrink: 0,
                                }}>
                                  V{ver.version}
                                </span>
                                <div>
                                  <div style={{ fontSize: 11, color: "hsl(var(--foreground))", fontWeight: 500 }}>
                                    {isOriginal ? "Original document" : isLatestVer ? "Latest response" : `Response v${ver.version}`}
                                  </div>
                                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-mono)" }}>
                                    {ver.fileName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontSize: 10, fontFamily: "var(--font-mono)",
                                color: "hsl(var(--muted-foreground))",
                              }}>
                                {(ver.fileSize / 1024).toFixed(1)} KB
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${isVerRejected ? "badge-red" : "badge-green"}`} style={{ fontSize: 9 }}>
                                {isVerRejected ? "Rejected" : "Valid"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div className="avatar avatar-sm av-blue" style={{ width: 20, height: 20, fontSize: 9 }}>
                                  {ver.uploadedByName?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                    {ver.uploadedByName}
                                  </div>
                                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                                    {ver.uploadedByCompany}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                              {format(new Date(ver.createdAt), "MMM d, yyyy HH:mm")}
                            </td>
                            {canWrite && (
                              <td style={{ textAlign: "right" }}>
                                <DeleteButton projectId={projectId} fileId={ver.id} />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </>
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
      {families.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 12,
          fontSize: 11, color: "hsl(var(--muted-foreground))"
        }}>
          <Shield style={{ width: 12, height: 12 }} />
          Every version is immutably recorded with full attribution. Nobody can hide a submission or claim the original was different.
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
  const [dragOver, setDragOver] = useState(false);
  const [copiedSuggestion, setCopiedSuggestion] = useState(false);
  const [showNameGenerator, setShowNameGenerator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: convention } = useGetConvention(projectId);

  // Build suggested compliant name from the active convention
  const suggestedName = (() => {
    if (!convention || !convention.fields || !convention.isActive) return null;
    const sorted = [...convention.fields].sort((a: any, b: any) => a.fieldOrder - b.fieldOrder);
    const parts = sorted.map((f: any) => (f.allowedValues && f.allowedValues.length > 0 ? f.allowedValues[0] : "???"));
    if (parts.length === 0) return null;
    return parts.join(convention.separator);
  })();

  const handleCopySuggestion = (name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopiedSuggestion(true);
      setTimeout(() => setCopiedSuggestion(false), 2000);
    });
  };

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

  const handleFile = useCallback(async (file: File) => {
    setErrorDetails([]);
    setSuccess(false);
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let fileContent: string | undefined;
    if (ext === "pdf" && file.size < 10 * 1024 * 1024) {
      try {
        const buf = await file.arrayBuffer();
        fileContent = btoa(String.fromCharCode(...new Uint8Array(buf)));
      } catch {
        fileContent = undefined;
      }
    }
    mutate({ projectId, data: { fileName: file.name, fileSize: file.size || 1024, fileType: file.type || "application/octet-stream", fileContent } });
  }, [mutate, projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleBrowse = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFile]);

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

      {/* Text input row */}
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

      {/* Drag and drop zone */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleBrowse}
      />
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          marginTop: 10,
          padding: "20px 16px",
          borderRadius: 8,
          border: `2px dashed ${dragOver ? "#2563EB" : "hsl(var(--border))"}`,
          background: dragOver ? "#EFF6FF" : "hsl(var(--secondary))",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <Upload style={{ width: 20, height: 20, color: dragOver ? "#2563EB" : "hsl(var(--muted-foreground))" }} />
        <div style={{ fontSize: 12, fontWeight: 600, color: dragOver ? "#1D4ED8" : "hsl(var(--foreground))" }}>
          {isPending ? "Validating…" : "Drag and drop your file here or click to browse"}
        </div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
          Only the file name is validated — no content is stored
        </div>
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

          {/* Suggested compliant names */}
          {suggestedName && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #FECDD3" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#1E3A5F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <Sparkles style={{ width: 11, height: 11, color: "#7C3AED" }} />
                Suggested compliant names
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => handleCopySuggestion(suggestedName)}
                  title="Click to copy"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 6,
                    border: `1.5px solid ${copiedSuggestion ? "#86EFAC" : "#2563EB"}`,
                    background: copiedSuggestion ? "#F0FDF4" : "#EFF6FF",
                    cursor: "pointer", fontFamily: "var(--font-mono)",
                    fontSize: 11, fontWeight: 600,
                    color: copiedSuggestion ? "#15803D" : "#1D4ED8",
                    transition: "all 0.15s",
                  }}
                >
                  {copiedSuggestion
                    ? <><CheckCircle2 style={{ width: 12, height: 12 }} />Copied!</>
                    : <><Copy style={{ width: 11, height: 11 }} />{suggestedName}</>
                  }
                </button>
                <button
                  onClick={() => setShowNameGenerator(prev => !prev)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 6,
                    border: "1.5px solid #C4B5FD",
                    background: showNameGenerator ? "#EDE9FE" : "transparent",
                    cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#7C3AED",
                  }}
                >
                  <Sparkles style={{ width: 11, height: 11 }} />
                  {showNameGenerator ? "Close generator" : "Customize name"}
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 5 }}>
                Built from your active naming convention using the first allowed value per field
              </div>
            </div>
          )}

          {/* Inline Name Generator */}
          {showNameGenerator && (
            <div style={{ marginTop: 12, border: "1.5px solid #C4B5FD", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4C1D95" }}>Name Generator</span>
                <button onClick={() => setShowNameGenerator(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#7C3AED", padding: 2 }}>
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <NameGenerator projectId={projectId} />
              </div>
            </div>
          )}
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
