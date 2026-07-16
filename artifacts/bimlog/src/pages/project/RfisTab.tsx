import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListRfis, useCreateRfi, useUpdateRfi, useReviseRfi, useGenerateRfiQuestion,
  useListMembers, useListFiles,
} from "@workspace/api-client-react";
import type { Rfi, ProjectFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { LinkedItemsPanel } from "@/components/LinkedItemsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Plus, X, FileText, Download,
  LayoutList, Table2, Sparkles, AlertTriangle,
  RefreshCw, Phone, Loader2,
  Search, Calendar, Trash2,
  Send, Copy, FolderOpen,
  Upload, Camera, Clipboard, UserPlus, Mail, ExternalLink,
  ChevronUp, ChevronDown, CheckCircle2, CircleAlert,
} from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { RfiImageCropEditor, type NormalizedCrop } from "@/components/rfi/RfiImageCropEditor";
import { RfiSnippingWorkspace } from "@/components/rfi/RfiSnippingWorkspace";
import { RfiImagePresentationControls } from "@/components/rfi/RfiImagePresentationControls";
import { logClientError } from "@/lib/client-log";
import { format, differenceInDays, isValid, parseISO } from "date-fns";

// ─── helpers ─────────────────────────────────────────────────────────────────
function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }
function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return isValid(dt) ? format(dt, "MMM d, yyyy") : "—";
}

const STATUS_BADGE: Record<string, string> = {
  open: "badge-blue", in_review: "badge-amber", responded: "badge-purple", closed: "badge-green",
};
const PRIORITY_BADGE: Record<string, string> = {
  low: "badge-gray", medium: "badge-amber", high: "badge-red", critical: "badge-red",
};

const DEFAULT_RFI_TYPES = ["Coordination", "General", "Drawing", "Spec", "Submittal", "Safety Data Sheet", "Change", "Other"];
const FILE_SOURCE_PROVIDERS = [
  { key: "google_drive", param: "google-drive", label: "Google Drive" },
  { key: "dropbox", param: "dropbox", label: "Dropbox" },
  { key: "bim360", param: "bim360", label: "BIM 360" },
  { key: "procore", param: "procore", label: "Procore" },
] as const;
type FileSourceProvider = typeof FILE_SOURCE_PROVIDERS[number];

const INTERNAL_FILE_LOCATOR = /^\/api\/v1\/projects\/(\d+)\/files\/(\d+)\/download(?:\?name=[^#&]*)?$/;
const UNSAFE_REFERENCE_SCHEME = /^(?:javascript|data|file|vbscript|blob):/i;

function parseInternalFileLocator(value: string): { projectId: number; fileId: number } | null {
  const match = value.match(INTERNAL_FILE_LOCATOR);
  return match ? { projectId: Number(match[1]), fileId: Number(match[2]) } : null;
}

function canonicalFileLocator(projectId: number, fileId: number) {
  return `/api/v1/projects/${projectId}/files/${fileId}/download`;
}

function isFileAttachment(value: string) { return parseInternalFileLocator(value) !== null; }

const attachLabel = (v: string) => {
  const m = v.match(/[?&]name=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  try {
    if (/^https?:\/\//i.test(v) || v.startsWith("/api/")) {
      const path = new URL(v, window.location.origin).pathname;
      return decodeURIComponent(path.split("/").filter(Boolean).pop() || v);
    }
  } catch {
    return v;
  }
  return v;
};

const isOpenableAttachment = (value: string) => /^https?:\/\//i.test(value) || value.startsWith("/api/");

function normalizeManualReference(value: string): { value?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { error: "Reference cannot be blank." };
  if (trimmed.startsWith("/api/")) return { error: "Use Select Project File for BIMLog files." };
  if (UNSAFE_REFERENCE_SCHEME.test(trimmed)) return { error: "That reference URL scheme is not allowed." };
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return { error: "Only HTTP or HTTPS external references are allowed." };
  if (/^https?:\/\//i.test(trimmed)) {
    try { return { value: new URL(trimmed).toString() }; } catch { return { error: "Enter a valid HTTP or HTTPS URL." }; }
  }
  return { value: trimmed };
}

function splitRfiEvidence(values: string[] | null | undefined) {
  return (values || []).reduce((result, value) => {
    (isFileAttachment(value) ? result.attachments : result.references).push(value);
    return result;
  }, { references: [] as string[], attachments: [] as string[] });
}

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentLabelFromFiles(value: string, files: ProjectFile[]) {
  const fileId = fileIdFromAttachment(value);
  return (fileId ? files.find(file => file.id === fileId)?.fileName : undefined) || attachLabel(value);
}

async function openRfiAttachment(value: string) {
  if (/^https?:\/\//i.test(value)) {
    window.open(value, "_blank", "noopener,noreferrer");
    return;
  }
  if (!value.startsWith("/api/")) return;
  const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
  const response = await fetch(value, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) throw new Error("Attachment could not be opened");
  const disposition = response.headers.get("Content-Disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basicName = disposition.match(/filename="([^"]+)"/i)?.[1];
  let downloadName = basicName || attachLabel(value);
  if (encodedName) { try { downloadName = decodeURIComponent(encodedName); } catch { /* use the safe ASCII fallback */ } }
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = downloadName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

type ParsedDistributionEntry = { name: string; email: string; phone: string; isExternal: boolean; display: string };

function encodeExternalDistributionEntry(name: string, email: string, phone: string) {
  return `EXT:${encodeURIComponent(name.trim())}:${encodeURIComponent(email.trim())}:${encodeURIComponent(phone.trim())}`;
}

function parseDistributionEntry(entry: string): ParsedDistributionEntry {
  if (!entry.startsWith("EXT:")) return { name: "", email: entry, phone: "", isExternal: false, display: entry };
  const [rawName = "", rawEmail = "", rawPhone = ""] = entry.slice(4).split(":");
  const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
  const name = decode(rawName);
  const email = decode(rawEmail);
  const phone = decode(rawPhone);
  return { name, email, phone, isExternal: true, display: `${name} <${email}>${phone ? ` - ${phone}` : ""} (external)` };
}

export function getRfiDistributionCcEmails(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.flatMap(entry => {
    const email = parseDistributionEntry(entry).email.trim();
    if (!/^[^\s<>@]+@[^\s<>@]+$/.test(email)) return [];
    const key = email.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [email];
  });
}

export function getRfiDistributionCcProof() {
  return {
    plainEmail: getRfiDistributionCcEmails(["project@company.com"]),
    legacyExternal: getRfiDistributionCcEmails(["EXT:Legacy Contact:legacy@company.com:555-0100"]),
    encodedExternal: getRfiDistributionCcEmails([encodeExternalDistributionEntry("Encoded Contact", "name@company.com", "555-0200")]),
    duplicateCaseInsensitive: getRfiDistributionCcEmails(["duplicate@company.com", "DUPLICATE@COMPANY.COM"]),
    malformed: getRfiDistributionCcEmails(["", "not-an-email", "EXT:Broken:%E0%A4%A:"]),
  };
}

type RfiDirectoryContact = { fullName: string; email: string; companyName?: string | null };
type RfiAttachmentSource = "reference" | "attachment";

type RfiPackageItem = {
  key: string;
  label: string;
  fileId?: number | null;
  attachment?: string | null;
  source?: string | null;
  include: boolean;
  order: number;
};

type RfiImagePresentation = {
  sourceFileId?: number | null;
  replacementFileId?: number | null;
  sourceKind?: "viewpoint" | "upload" | "paste" | "screen-snip" | null;
  replacementKind?: "upload" | "paste" | "screen-snip" | null;
  showInRfi?: boolean;
  includeInCompletePdf?: boolean;
  crop?: { x: number; y: number; width: number; height: number } | null;
} | null;

type PendingImage = {
  file: File;
  url: string;
  mode: "source" | "replacement";
  kind: "upload" | "paste" | "screen-snip";
};

type PendingImageInput = Omit<PendingImage, "url">;

type CapturedFrame = { url: string; fileName: string };

async function validateImageForReview(file: File): Promise<void> {
  if (!file.type.startsWith("image/") || file.size <= 0 || !["image/png", "image/jpeg"].includes(file.type)) throw new Error("unsupported_or_empty_image");
  try {
    const bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) throw new Error("empty_image_frame");
    bitmap.close();
  } catch {
    throw new Error("image_decode_failed");
  }
}

function revokeObjectUrlAfterRender(url: string): void {
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function acquireCapturedFrame(fileName: string): Promise<CapturedFrame> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("capture_api_unavailable");
  let stream: MediaStream | null = null;
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  try {
    const captureOptions: DisplayMediaStreamOptions & {
      preferCurrentTab?: boolean;
      selfBrowserSurface?: "include" | "exclude";
    } = {
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    };
    stream = await navigator.mediaDevices.getDisplayMedia(captureOptions);
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState === "ended") throw new Error("capture_source_ended");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    if (stream.getVideoTracks()[0]?.readyState === "ended") throw new Error("capture_source_ended");
    if (!video.videoWidth || !video.videoHeight) throw new Error("empty_capture_frame");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("capture_canvas_failed");
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("capture_canvas_failed");
    return { url: URL.createObjectURL(blob), fileName };
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") throw new Error("capture_cancelled_or_denied");
    throw error;
  } finally {
    stream?.getTracks().forEach(track => track.stop());
    video.pause();
    video.srcObject = null;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }
}

type RfiUiMode = "create" | "view" | "edit";
type RfiRecordState = "new" | "draft" | "sent" | "closed" | "reopened" | "revised";

type RfiActionKey =
  | "back"
  | "submit"
  | "cancel"
  | "save-rfi"
  | "export-pdf"
  | "export-complete-pdf"
  | "export-docx"
  | "export-audit-pdf"
  | "viewed-by"
  | "edit"
  | "close"
  | "reopen"
  | "raise-change-order"
  | "jump-viewpoint"
  | "revise"
  | "save-response";

type RfiActionDefinition = {
  key: RfiActionKey;
  label: string;
  variant: "primary" | "secondary" | "danger";
};

type RfiCanonicalValues = {
  number?: string;
  projectName?: string;
  projectAddress?: string;
  subject: string;
  status: string;
  priority: string;
  rfiType: string;
  dateRequested?: string;
  dateRequired?: string;
  daysOutstanding?: string;
  dateAnswered?: string;
  submittedByCompany: string;
  submittedByContact: string;
  submittedByAddress: string;
  submittedByPhone: string;
  submittedByEmail: string;
  submittedToCompany: string;
  submittedToPerson: string;
  submittedToAddress?: string;
  submittedToPhone?: string;
  submittedToEmail: string;
  drawingNumber: string;
  drawingTitle: string;
  specSection: string;
  detailNumber: string;
  noteNumber: string;
  locationDescription: string;
  referenceInput?: string;
  question: string;
  costImpact: string;
  costImpactAmount: string;
  costImpactReason: string;
  scheduleImpact: string;
  scheduleImpactDays: string;
  scheduleImpactReason: string;
  distributionList: string[];
  emailDescription?: string;
  emailDraft?: string;
  questionAssistDescription?: string;
  responseText?: string;
  answeredBy?: string;
};

type RfiCanonicalPermissions = {
  canEdit: boolean;
  canRespond: boolean;
  canClose: boolean;
  canReopen: boolean;
  canExport: boolean;
  canRaiseChangeOrder: boolean;
  canJumpViewpoint: boolean;
};

type RfiCanonicalActions = Partial<Record<RfiActionKey, () => void>>;
type RfiCanonicalOption = { value: string; label: string };
type RfiCanonicalPickerAction = { key: string; label: string; icon?: "cloud" | "upload" | "paste" | "capture" | "replace"; onClick: () => void };

type RfiCanonicalFormProps = {
  lang: string;
  mode: RfiUiMode;
  recordState: RfiRecordState;
  values: RfiCanonicalValues;
  permissions: RfiCanonicalPermissions;
  validation?: Record<string, string | undefined>;
  references: string[];
  attachments: string[];
  attachmentFiles?: ProjectFile[];
  uploadResults?: Array<{ name: string; state: "uploading" | "success" | "error"; message?: string }>;
  imagePresentation: RfiImagePresentation;
  packageItems: RfiPackageItem[];
  responses: Array<{ id?: number; text: string; by?: string; date?: string; attachments?: string[] }>;
  loading?: Partial<Record<"saving" | "uploading" | "questionAi" | "emailAi" | "response", boolean>>;
  options?: {
    priorities?: RfiCanonicalOption[];
    rfiTypes?: RfiCanonicalOption[];
    costImpact?: RfiCanonicalOption[];
    scheduleImpact?: RfiCanonicalOption[];
  };
  cloudAttachmentActions?: RfiCanonicalPickerAction[];
  imageAttachmentActions?: RfiCanonicalPickerAction[];
  pendingImagePreview?: { url: string; mode?: "source" | "replacement" } | null;
  imagePresentationContent?: React.ReactNode;
  onAttachPendingImage?: () => void;
  onCancelPendingImage?: () => void;
  actions: RfiCanonicalActions;
  onChange: (field: keyof RfiCanonicalValues, value: string) => void;
  onAddReference: () => void;
  onRemoveReference: (source: RfiAttachmentSource, index: number) => void;
  onOpenReference?: (value: string) => void;
  onUploadFile: () => void;
  onGenerateQuestionAi: () => void;
  onGenerateEmailAi: () => void;
  onCopyEmail: () => void;
  emailCopied?: boolean;
  statusContent?: React.ReactNode;
  submittedByDirectoryContent?: React.ReactNode;
  submittedToDirectoryContent?: React.ReactNode;
  distributionContent?: React.ReactNode;
  referenceContent?: React.ReactNode;
  impactContent?: React.ReactNode;
  responseContent?: React.ReactNode;
  onTogglePackageItem?: (key: string, include: boolean) => void;
  onMovePackageItem?: (key: string, direction: -1 | 1) => void;
  onToggleViewpointImage?: (include: boolean) => void;
  onClearImageCrop?: () => void;
  actionMatrix?: RfiActionDefinition[];
};

function getCreateRfiActionMatrix(params: { hasViewpoint: boolean; lang: string }): RfiActionDefinition[] {
  const { hasViewpoint, lang } = params;
  const actions: RfiActionDefinition[] = [
    { key: "submit", label: w("Submit RFI", "Enviar RFI", lang), variant: "primary" },
    { key: "cancel", label: w("Cancel", "Cancelar", lang), variant: "secondary" },
  ];
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}

export function getRfiCanonicalActionMatrix(params: {
  mode: RfiUiMode;
  recordState: RfiRecordState;
  permissions: RfiCanonicalPermissions;
  lang: string;
}): RfiActionDefinition[] {
  const { mode, recordState, permissions, lang } = params;
  if (recordState === "new") return getCreateRfiActionMatrix({ hasViewpoint: permissions.canJumpViewpoint, lang });
  if (mode === "edit") {
    const editActions: RfiActionDefinition[] = [
      { key: "save-rfi", label: w("Save RFI", "Guardar RFI", lang), variant: "primary" },
      { key: "cancel", label: w("Cancel", "Cancelar", lang), variant: "secondary" },
    ];
    if (permissions.canRespond) editActions.push({ key: "save-response", label: w("Save Response", "Guardar Respuesta", lang), variant: "primary" });
    if (recordState === "closed" && permissions.canReopen) editActions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
    return editActions;
  }
  const actions: RfiActionDefinition[] = [];
  if (permissions.canEdit) actions.push({ key: "edit", label: w("Edit RFI", "Editar RFI", lang), variant: "secondary" });
  if (permissions.canExport) {
    actions.push(
      { key: "export-pdf", label: w("RFI PDF", "RFI PDF", lang), variant: "secondary" },
      { key: "export-complete-pdf", label: w("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
      { key: "export-docx", label: w("RFI DOCX", "RFI DOCX", lang), variant: "secondary" },
      { key: "export-audit-pdf", label: w("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
    );
  }
  if (recordState === "closed") {
    if (permissions.canReopen) actions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (permissions.canClose) {
    actions.push({ key: "close", label: w("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  }
  if (permissions.canRespond) actions.push({ key: "save-response", label: w("Save Response", "Guardar Respuesta", lang), variant: "primary" });
  if (permissions.canJumpViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  if (permissions.canRaiseChangeOrder) actions.push({ key: "raise-change-order", label: w("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  return actions;
}

function getSavedRfiActionMatrix(params: {
  rfi: Rfi;
  canWrite: boolean;
  isProjectAdmin: boolean;
  hasViewpoint: boolean;
  isEditing: boolean;
  lang: string;
}): RfiActionDefinition[] {
  const { rfi, canWrite, isProjectAdmin, hasViewpoint, isEditing, lang } = params;
  if (canWrite && isEditing) {
    return [
      { key: "save-rfi", label: w("Save RFI", "Guardar RFI", lang), variant: "primary" },
      { key: "cancel", label: w("Cancel", "Cancelar", lang), variant: "secondary" },
    ];
  }
  const actions: RfiActionDefinition[] = [
    { key: "back", label: w("Back to RFI Log", "Volver al Registro RFI", lang), variant: "secondary" },
    { key: "export-pdf", label: w("RFI PDF", "RFI PDF", lang), variant: "secondary" },
    { key: "export-complete-pdf", label: w("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
    { key: "export-docx", label: w("RFI DOCX", "RFI DOCX", lang), variant: "secondary" },
    { key: "export-audit-pdf", label: w("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
    { key: "viewed-by", label: w("Viewed By", "Visto Por", lang), variant: "secondary" },
  ];
  if (canWrite && !isEditing) actions.push({ key: "edit", label: w("Edit RFI", "Editar RFI", lang), variant: "secondary" });
  if (canWrite && !isEditing) actions.push({ key: "revise", label: w("Create Revision", "Crear Revision", lang), variant: "secondary" });
  if (rfi.status === "closed") {
    if (canWrite) actions.push({ key: "reopen", label: w("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (isProjectAdmin) {
    actions.push({ key: "close", label: w("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  }
  if (canWrite) actions.push({ key: "raise-change-order", label: w("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: w("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}

function fileIdFromAttachment(value: string): number | null {
  return parseInternalFileLocator(value)?.fileId ?? null;
}

function completePackageMethodLabel(fileName: string, lang: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return w("Native PDF pages", "Paginas PDF nativas", lang);
  if (["doc", "docx", "xls", "xlsx", "csv", "txt"].includes(ext)) return w("Requires configured document converter; readiness checked at export", "Requiere convertidor de documentos configurado; disponibilidad verificada al exportar", lang);
  if (["png", "jpg", "jpeg", "tif", "tiff", "bmp", "gif", "webp"].includes(ext)) return w("Validated image page", "Pagina de imagen validada", lang);
  if (ext === "msg") return w("Not supported - export will explain the required action", "No compatible - la exportacion explicara la accion requerida", lang);
  return w("Format checked during export", "Formato verificado durante la exportacion", lang);
}

function packageItemsFromAttachments(attachments: string[], files: ProjectFile[] = []): RfiPackageItem[] {
  const seen = new Set<string>();
  return attachments.flatMap((attachment, order) => {
    const fileId = fileIdFromAttachment(attachment);
    const identity = fileId ? `file:${fileId}` : `ref:${attachment.trim().toLowerCase()}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const file = fileId ? files.find(f => f.id === fileId) : undefined;
    const label = file?.fileName || attachLabel(attachment);
    return [{
      key: fileId ? `file:${fileId}` : `ref:${encodeURIComponent(attachment)}`,
      label,
      fileId: file?.id ?? fileId,
      attachment,
      source: file?.source || null,
      include: true,
      order,
    }];
  }).map((item, order) => ({ ...item, order }));
}

function normalizePackageItems(value: unknown, attachments: string[], files: ProjectFile[] = []): RfiPackageItem[] {
  if (!Array.isArray(value) || value.length === 0) return packageItemsFromAttachments(attachments, files);
  const normalized = value.map((raw, order) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const fileId = typeof item.fileId === "number" ? item.fileId : null;
    const attachment = typeof item.attachment === "string" ? item.attachment : null;
    const file = fileId ? files.find(f => f.id === fileId) : undefined;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : file?.fileName || (attachment ? attachLabel(attachment) : `Package item ${order + 1}`);
    return {
      key: fileId ? `file:${fileId}` : `ref:${encodeURIComponent(attachment || label)}`,
      label,
      fileId: file?.id ?? fileId,
      attachment,
      source: typeof item.source === "string" ? item.source : file?.source || null,
      include: item.include !== false,
      order: typeof item.order === "number" ? item.order : order,
    };
  }).filter(item => (!item.attachment || attachments.includes(item.attachment)) && (!files.length || !item.fileId || files.some(file => file.id === item.fileId)))
    .sort((a, b) => a.order - b.order);
  const seen = new Set<string>();
  return normalized.filter(item => {
    const identity = item.fileId ? `file:${item.fileId}` : `ref:${String(item.attachment || item.label).trim().toLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map((item, order) => ({ ...item, order }));
}

function getBallInCourt(rfi: Rfi): { label: string; color: string } | null {
  if (rfi.status === "closed") return null;
  // Not sent yet: the author still holds it — nobody is "responding" to a draft.
  if (rfi.sendStatus !== "sent" && !rfi.sentAt) {
    return { label: `${rfi.submittedByCompany || rfi.createdByName || "Author"} — to send`, color: "#B45309" };
  }
  if (rfi.status === "responded") {
    return { label: rfi.submittedByCompany || rfi.createdByName || "Submitter", color: "#7C3AED" };
  }
  return { label: rfi.submittedToCompany || rfi.submittedToPerson || "Reviewer", color: "#0369A1" };
}

function daysColor(days: number, isOverdue: boolean) {
  if (isOverdue) return "#DC2626";
  if (days > 7) return "#D97706";
  return "#16A34A";
}

// ─── FileSearchDropdown ───────────────────────────────────────────────────────
function FileSearchDropdown({ files, onSelect, onClose }: {
  files: ProjectFile[];
  onSelect: (file: ProjectFile) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = files.filter(f => !q || f.fileName.toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <div style={{
      position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0,
      background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
      borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 8,
    }}>
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search files…" style={{ fontSize: 11, marginBottom: 6 }} autoFocus />
      {filtered.length === 0 && <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", padding: "4px 6px" }}>No files found</p>}
      {filtered.map(f => (
        <button key={f.id} onClick={() => { onSelect(f); onClose(); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 8px", fontSize: 11, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--foreground))" }}
          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--secondary))")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <FileText style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          {f.fileName}
        </button>
      ))}
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export function RfisTab({ projectId, canWrite = true }: { projectId: number; canWrite?: boolean }) {
  const { lang } = useI18n();
  const { getLabel, getOptions } = useConfig();
  const { user, token } = useAuthStore();
  const { data: rfis, isLoading } = useListRfis(projectId);
  const { data: members } = useListMembers(projectId);
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "log">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRfi, setSelectedRfi] = useState<Rfi | null>(null);
  const [createPreload, setCreatePreload] = useState<{ subject?: string; question?: string; location?: string } | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [deleteRfi, setDeleteRfi] = useState<{ id: number; label: string; projectId: number } | null>(null);
  const [exportingRegister, setExportingRegister] = useState(false);
  const rfisQueryClient = useQueryClient();

  // Prefill a new RFI from query params (e.g. navigated from a Lens viewpoint).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const note = sp.get("note");
    const trade = sp.get("trade");
    const floor = sp.get("floor");
    const ref = sp.get("ref");
    const rfiParam = sp.get("rfi");

    // Deep-link straight to an existing RFI's detail panel (the plugin opens the
    // browser after creating an RFI from a viewpoint). Fetch by id rather than
    // relying on the list, since a brand-new draft may not be loaded/filtered in yet.
    if (rfiParam) {
      const rfiId = Number(rfiParam);
      window.history.replaceState({}, "", `/projects/${projectId}/rfis`);
      if (Number.isFinite(rfiId)) {
        (async () => {
          const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfiId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) {
            setSelectedRfi(await r.json() as Rfi);
          } else {
            toast({ title: w("Could not open that RFI.", "No se pudo abrir ese RFI.", lang), variant: "destructive" });
          }
        })();
      }
      return;
    }

    if (note || trade || floor || ref) {
      const base = trade
        ? `${trade}${floor ? ` — ${floor}` : ""}`
        : (note || "").slice(0, 80);
      const subject = ref ? `${ref}${base ? ` — ${base}` : ""}` : base;
      setCreatePreload({ subject, question: note || "", location: floor || "" });
      setShowCreate(true);
      window.history.replaceState({}, "", `/projects/${projectId}/rfis`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/projects/${projectId}/rfis/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiresConfirmation) {
          const warningText = data.warnings.slice(0,3).map((w: any) => `${w.message}`).join("\n");
          const proceed = confirm(`AI found potential issues:\n\n${warningText}\n\n${data.safeCount ?? 0} records are safe to import.\n\nProceed with safe records only?`);
          if (proceed) {
            const fd2 = new FormData();
            fd2.append("file", e.target.files![0]);
            fd2.append("forceImport", "true");
            const r2 = await fetch(`/api/v1/projects/${projectId}/rfis/import`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd2,
            });
            const d2 = await r2.json();
            setImportMsg(`${d2.imported ?? 0} RFIs imported (duplicates skipped)`);
          } else {
            setImportMsg("Import cancelled.");
          }
        } else {
          let msg = `${data.imported ?? 0} RFIs imported successfully`;
          if (data.renameCount > 0) {
            msg += `. ${data.renameCount} duplicate(s) renamed: ${data.renamed.slice(0,3).map((r: any) => `${r.original} → ${r.renamed}`).join(", ")}`;
          }
          setImportMsg(msg);
          setTimeout(() => window.location.reload(), 2500);
        }
        setTimeout(() => setImportMsg(""), 8000);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const handleExportAllExcel = async () => {
    if (!rfis) return;
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    setExportingRegister(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, search });
      const response = await fetch(`/api/v1/projects/${projectId}/rfis/export-excel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Excel export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const basicName = disposition.match(/filename="([^"]+)"/i)?.[1];
      let downloadName = basicName || `Project-${projectId}-RFI-Register.xlsx`;
      if (encodedName) { try { downloadName = decodeURIComponent(encodedName); } catch { /* use fallback */ } }
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("RFI Register Excel exported", "Registro RFI Excel exportado", lang) });
    } catch (error) {
      logClientError("RFI Excel export", error);
      toast({ title: w("RFI Register Excel export failed", "Error al exportar Registro RFI Excel", lang), variant: "destructive" });
    } finally {
      setExportingRegister(false);
    }
  };
  const filtered = useMemo(() => {
    if (!rfis) return [];
    return rfis
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .filter(r => {
        if (!search) return true;
        const s = search.toLowerCase();
        return r.number.toLowerCase().includes(s) ||
          r.subject.toLowerCase().includes(s) ||
          (r.submittedByCompany || "").toLowerCase().includes(s) ||
          (r.submittedToCompany || "").toLowerCase().includes(s);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [rfis, statusFilter, search]);

  const stats = useMemo(() => ({
    total: rfis?.length ?? 0,
    open: rfis?.filter(r => r.status === "open").length ?? 0,
    inReview: rfis?.filter(r => r.status === "in_review").length ?? 0,
    responded: rfis?.filter(r => r.status === "responded").length ?? 0,
    closed: rfis?.filter(r => r.status === "closed").length ?? 0,
  }), [rfis]);

  const overdueCount = useMemo(() =>
    rfis?.filter(r => {
      if (r.status === "closed") return false;
      const due = r.dateRequired || r.dueDate;
      if (due) return new Date(due) < new Date();
      return differenceInDays(new Date(), new Date(r.createdAt)) > 14;
    }).length ?? 0
  , [rfis]);

  const handleExportPdf = async (rfi: Rfi) => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-Request-for-Information.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCompletePdf = async (rfi: Rfi) => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-complete`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({})) as { error?: string; details?: string[] };
      toast({
        title: data.error || "Complete RFI PDF failed",
        description: data.details?.join("; "),
        variant: "destructive",
      });
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-Complete-RFI-Package.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWordRfi = async (rfi: Rfi) => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-word`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${rfi.number} exported as Word (.docx)` });
    } catch {
      toast({ title: w("Word export failed", "Error al exportar Word", lang), variant: "destructive" });
    }
  };

  // Config can contain duplicate rfi_status entries; dedupe by value so the stats
  // strip, filter tabs, and status <select> each show a status only once.
  const statusOptions = [...new Map(getOptions("rfi_status").map(o => [o.value, o])).values()];

  // Full-page RFI detail (not a modal): when a row is selected, render only the detail page
  // with a Back button — matching Change Orders / Lens Viewpoints. No overlay, no pop-up.
  if (selectedRfi) {
    return (
      <RfiDetailPanel
        projectId={projectId}
        rfi={selectedRfi}
        canWrite={canWrite}
        lang={lang}
        members={members || []}
        user={user}
        onClose={() => setSelectedRfi(null)}
        onRevise={setSelectedRfi}
        onExportPdf={handleExportPdf}
        onExportCompletePdf={handleExportCompletePdf}
        onUpdate={(updated) => setSelectedRfi(updated)}
      />
    );
  }

  // Create / edit RFI as a full page too (not a modal).
  if (showCreate) {
    return (
      <RfiCreatePanel
        projectId={projectId}
        prefill={createPreload}
        existingRfis={rfis || []}
        members={members || []}
        user={user}
        lang={lang}
        onClose={() => { setShowCreate(false); setCreatePreload(undefined); }}
      />
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{w("RFIs", "Solicitudes de Información", lang)}</div>
          <div className="section-sub">
            {stats.total} {w("total", "total", lang)} · {stats.open} {w("open", "abierto", lang)} · {stats.inReview} {w("in review", "en revisión", lang)} · {stats.responded} {w("responded", "respondido", lang)} · {stats.closed} {w("closed", "cerrado", lang)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid hsl(var(--border))", borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => setView("list")} style={{ padding: "5px 10px", background: view === "list" ? "hsl(var(--primary))" : "transparent", color: view === "list" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <LayoutList style={{ width: 13, height: 13 }} />{w("List", "Lista", lang)}
            </button>
            <button onClick={() => setView("log")} style={{ padding: "5px 10px", background: view === "log" ? "hsl(var(--primary))" : "transparent", color: view === "log" ? "white" : "hsl(var(--muted-foreground))", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <Table2 style={{ width: 13, height: 13 }} />{w("Log", "Registro", lang)}
            </button>
          </div>
          {rfis && rfis.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportAllExcel} disabled={exportingRegister} style={{ gap: 5, fontSize: 11 }}>
              {exportingRegister ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : <Download style={{ width: 12, height: 12 }} />}
              {exportingRegister ? w("Exporting Register...", "Exportando Registro...", lang) : w("RFI Register Excel", "Registro RFI Excel", lang)}
            </Button>
          )}
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline btn-sm" style={{ fontSize: 12, opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? w("Importing...","Importando...",lang) : w("Import","Importar",lang)}
              </span>
            </label>
          )}
          {importMsg && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", color: "#1D4ED8", fontSize: 13, marginTop: 10 }}>
              {importMsg}
            </div>
          )}
          {canWrite && (
            <Button size="sm" onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />{w("New RFI", "Nuevo RFI", lang)}
            </Button>
          )}
        </div>
      </div>

      {overdueCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, fontSize: 12, color: "#BE123C" }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span><strong>{overdueCount}</strong> RFI{overdueCount !== 1 ? "s" : ""} {w("overdue — response required.", "vencido(s) — se requiere respuesta.", lang)}</span>
        </div>
      )}

      {/* Stats strip — Lens-style, clickable to filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--secondary) / 0.3)" }}>
        <button onClick={() => setStatusFilter("all")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: statusFilter === "all" ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
          {stats.total} {w("total", "total", lang)}
        </button>
        {statusOptions.map(o => {
          const n = (rfis || []).filter(r => r.status === o.value).length;
          return (
            <button key={o.value} onClick={() => setStatusFilter(o.value)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: statusFilter === o.value ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {getLabel("rfi_status", o.value)} <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>{n}</span>
            </button>
          );
        })}
        {overdueCount > 0 && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#BE123C" }}>{overdueCount} {w("overdue", "vencido(s)", lang)}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <Input placeholder={w("Search RFIs…", "Buscar RFIs…", lang)} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, fontSize: 12 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", ...([...new Set(statusOptions.map(o => o.value))])].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: statusFilter === s ? "1.5px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
              background: statusFilter === s ? "hsl(var(--primary) / 0.08)" : "transparent",
              color: statusFilter === s ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}>
              {s === "all" ? w("All", "Todos", lang) : getLabel("rfi_status", s)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><MessageSquare style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} /></div>
          <div className="empty-title">{rfis?.length === 0 ? w("No RFIs yet", "Sin RFIs aún", lang) : w("No matching RFIs", "No hay RFIs que coincidan", lang)}</div>
          <div className="empty-desc">{rfis?.length === 0 ? w("Create your first RFI to begin tracking information requests.", "Crea tu primer RFI para comenzar a rastrear solicitudes de información.", lang) : w("Try adjusting your search or filter.", "Intenta ajustar tu búsqueda o filtro.", lang)}</div>
        </div>
      )}

      {/* LIST VIEW */}
      {!isLoading && filtered.length > 0 && view === "list" && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>{w("RFI #", "RFI #", lang)}</th>
                <th>{w("Subject", "Asunto", lang)}</th>
                <th style={{ width: 100 }}>{w("Status", "Estado", lang)}</th>
                <th style={{ width: 85 }}>{w("Priority", "Prioridad", lang)}</th>
                <th>{w("Ball in Court", "Responsable", lang)}</th>
                <th>{w("Submitted By", "Enviado por", lang)}</th>
                <th style={{ width: 100 }}>{w("Date Req.", "Fecha Req.", lang)}</th>
                <th style={{ width: 80 }}>{w("Days Out", "Días", lang)}</th>
                <th style={{ width: 110, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfi => {
                const due = rfi.dateRequired || rfi.dueDate;
                const isOverdue = rfi.status !== "closed" && due ? new Date(due) < new Date() : false;
                const days = differenceInDays(new Date(), new Date(rfi.createdAt));
                const bic = getBallInCourt(rfi);
                return (
                  <tr key={rfi.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRfi(rfi)}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>
                        {rfi.number}{(rfi.revisionNumber ?? 0) > 0 && <span style={{ color: "#7C3AED", marginLeft: 2 }}>R{rfi.revisionNumber}</span>}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isOverdue && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626", flexShrink: 0, display: "inline-block" }} />}
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{rfi.subject}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[rfi.priority] ?? "badge-gray"}`}>{getLabel("rfi_priority", rfi.priority)}</span></td>
                    <td>
                      {bic ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: bic.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: bic.color }}>{bic.label}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#16A34A" }}>{w("Closed", "Cerrado", lang)}</span>
                      )}
                    </td>
                    <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || rfi.createdByName || "—"}</span></td>
                    <td style={{ fontSize: 11, color: isOverdue ? "#DC2626" : "hsl(var(--muted-foreground))", fontWeight: isOverdue ? 700 : 400, whiteSpace: "nowrap" }}>{fmt(due)}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: daysColor(days, isOverdue) }}>{days}d</span>
                      {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact" && (
                        <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, color: "#D97706" }}><AlertTriangle size={8} /> {w("Sched.", "Prog.", lang)}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button title="Export RFI PDF"
                          style={{ padding: "3px 6px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#2563EB", display: "flex", alignItems: "center", gap: 3 }}
                          onClick={e => { e.stopPropagation(); handleExportPdf(rfi); }}
                        >
                          <FileText style={{ width: 10, height: 10 }} />RFI PDF
                        </button>
                        <button title="Export RFI DOCX"
                          style={{ padding: "3px 6px", fontSize: 10, border: "1px solid #C4B5FD", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#7C3AED", display: "flex", alignItems: "center", gap: 3 }}
                          onClick={e => { e.stopPropagation(); handleExportWordRfi(rfi); }}
                        >
                          <FileText style={{ width: 10, height: 10 }} />RFI DOCX
                        </button>
                        {canWrite && (
                          <button
                            style={{ padding: "3px 7px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
                            onClick={e => { e.stopPropagation(); setSelectedRfi(rfi); }}
                          >
                            {w("View", "Ver", lang)}
                          </button>
                        )}
                        {canWrite && (
                          <button
                            title={w("Delete RFI", "Eliminar RFI", lang)}
                            style={{ padding: "3px 6px", fontSize: 10, border: "1px solid #FECACA", borderRadius: 4, background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}
                            onClick={e => { e.stopPropagation(); setDeleteRfi({ id: rfi.id, label: rfi.number, projectId }); }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* LOG VIEW */}
      {!isLoading && filtered.length > 0 && view === "log" && (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid hsl(var(--border))" }}>
          <table className="data-table" style={{ minWidth: 980, borderRadius: 0, border: "none" }}>
            <thead>
              <tr>
                <th style={{ width: 80, whiteSpace: "nowrap" }}>{w("RFI #", "RFI #", lang)}</th>
                <th style={{ minWidth: 160 }}>{w("Description", "Descripción", lang)}</th>
                <th style={{ minWidth: 110 }}>{w("Req. By Co.", "Empresa Solic.", lang)}</th>
                <th style={{ minWidth: 110 }}>{w("Sent To Co.", "Empresa Destino", lang)}</th>
                <th style={{ width: 88, whiteSpace: "nowrap" }}>{w("Forwarded", "Enviado", lang)}</th>
                <th style={{ width: 88, whiteSpace: "nowrap" }}>{w("Answered", "Respondido", lang)}</th>
                <th style={{ width: 90, whiteSpace: "nowrap" }}>{w("Status", "Estado", lang)}</th>
                <th style={{ minWidth: 120 }}>{w("Sched. Impact", "Impacto Prog.", lang)}</th>
                <th style={{ width: 110, textAlign: "right", position: "sticky", right: 0, background: "hsl(var(--card))", zIndex: 2, boxShadow: "-2px 0 4px rgba(0,0,0,0.05)" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfi => (
                <tr key={rfi.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRfi(rfi)}>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{rfi.number}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.subject}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedByCompany || "—"}</span></td>
                  <td><span style={{ fontSize: 12 }}>{rfi.submittedToCompany || rfi.submittedToPerson || "—"}</span></td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateRequested || rfi.createdAt)}</td>
                  <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>{fmt(rfi.dateAnswered || rfi.respondedAt)}</td>
                  <td><span className={`badge ${STATUS_BADGE[rfi.status] ?? "badge-gray"}`}>{getLabel("rfi_status", rfi.status)}</span></td>
                  <td>
                    {rfi.scheduleImpact && rfi.scheduleImpact !== "No Schedule Impact"
                      ? <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>{rfi.scheduleImpact}{rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays}d)` : ""}</span>
                      : <span style={{ fontSize: 11, color: "#16A34A" }}>{w("None", "Ninguno", lang)}</span>
                    }
                  </td>
                  <td style={{ textAlign: "right", position: "sticky", right: 0, background: "hsl(var(--card))", zIndex: 1, boxShadow: "-2px 0 4px rgba(0,0,0,0.05)" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button title="Export RFI PDF"
                        style={{ padding: "3px 7px", fontSize: 10, border: "1px solid hsl(var(--border))", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#2563EB", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}
                        onClick={e => { e.stopPropagation(); handleExportPdf(rfi); }}
                      >
                        <FileText style={{ width: 10, height: 10 }} />RFI PDF
                      </button>
                      <button title="Export RFI DOCX"
                        style={{ padding: "3px 7px", fontSize: 10, border: "1px solid #C4B5FD", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#7C3AED", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}
                        onClick={e => { e.stopPropagation(); handleExportWordRfi(rfi); }}
                      >
                        <FileText style={{ width: 10, height: 10 }} />RFI DOCX
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteRfi && (
        <DeleteConfirmModal
          open
          onClose={() => setDeleteRfi(null)}
          onDeleted={() => {
            rfisQueryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
            setDeleteRfi(null);
          }}
          endpoint={`/api/v1/projects/${deleteRfi.projectId}/rfis/${deleteRfi.id}`}
          entityLabel={`RFI ${deleteRfi.label}`}
          warning={w("Linked items will be detached.", "Los elementos enlazados serán desvinculados.", lang)}
        />
      )}

      {/* Create/edit and detail both render as full pages via the early returns above — no modals. */}
    </div>
  );
}

// ─── RFI Create Panel ─────────────────────────────────────────────────────────
function SubmittedToParticipantEditor({ projectId, contacts, selectedCompany, onSelect, onAddDistribution, onDirectoryAdded, lang }: {
  projectId: number;
  contacts: RfiDirectoryContact[];
  selectedCompany: string;
  onSelect: (company: string, person: string, email: string) => void;
  onAddDistribution: (entry: string) => void;
  onDirectoryAdded: (contact: RfiDirectoryContact) => void;
  lang: string;
}) {
  const { toast } = useToast();
  const [showExternalPerson, setShowExternalPerson] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const companies = [...new Set(contacts.map(contact => contact.companyName).filter((value): value is string => !!value))].sort();
  const companyContacts = selectedCompany ? contacts.filter(contact => contact.companyName === selectedCompany) : contacts;

  const addExternalPerson = () => {
    if (!externalName.trim() || !externalEmail.trim()) return;
    const entry = encodeExternalDistributionEntry(externalName, externalEmail, externalPhone);
    onSelect(selectedCompany, externalName.trim(), externalEmail.trim());
    onAddDistribution(entry);
    setExternalName(""); setExternalEmail(""); setExternalPhone(""); setShowExternalPerson(false);
  };

  const addCompany = async () => {
    if (!companyName.trim() || !companyContact.trim() || !companyEmail.trim()) {
      toast({ title: w("Company, contact, and email are required.", "Empresa, contacto y correo son obligatorios.", lang), variant: "destructive" });
      return;
    }
    setSavingCompany(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const response = await fetch(`/api/v1/projects/${projectId}/directory`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: companyContact.trim(), email: companyEmail.trim(), company_name: companyName.trim(), role: "External Company",
          notes: [companyPhone.trim() && `Phone: ${companyPhone.trim()}`, companyAddress.trim() && `Address: ${companyAddress.trim()}`].filter(Boolean).join(" | ") || undefined,
        }),
      });
      const data = await response.json().catch(() => ({})) as RfiDirectoryContact;
      if (!response.ok) throw new Error(response.status === 403 ? w("You do not have permission to add project directory companies.", "No tiene permiso para agregar empresas al directorio del proyecto.", lang) : w("Company could not be added.", "No se pudo agregar la empresa.", lang));
      const contact = { fullName: data.fullName || companyContact.trim(), email: data.email || companyEmail.trim(), companyName: data.companyName || companyName.trim() };
      onDirectoryAdded(contact);
      onSelect(contact.companyName || "", contact.fullName, contact.email);
      onAddDistribution(contact.email);
      setCompanyName(""); setCompanyContact(""); setCompanyEmail(""); setCompanyPhone(""); setCompanyAddress(""); setShowCompany(false);
      toast({ title: w("Company added to the project directory.", "Empresa agregada al directorio del proyecto.", lang) });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : w("Company could not be added.", "No se pudo agregar la empresa.", lang), variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  return <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 700 }}>{w("Project company", "Empresa del proyecto", lang)}<select value={selectedCompany} onChange={event => onSelect(event.target.value, "", "")} style={{ width: "100%", height: 36, marginTop: 4, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", padding: "0 8px", fontSize: 12 }}><option value="">{w("Select company...", "Seleccionar empresa...", lang)}</option>{companies.map(company => <option key={company} value={company}>{company}</option>)}</select></label>
      <label style={{ fontSize: 11, fontWeight: 700 }}>{w("Project contact", "Contacto del proyecto", lang)}<select value="" onChange={event => { const contact = contacts.find(item => item.email === event.target.value); if (contact) onSelect(contact.companyName || "", contact.fullName, contact.email); }} style={{ width: "100%", height: 36, marginTop: 4, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", padding: "0 8px", fontSize: 12 }}><option value="">{w("Select contact...", "Seleccionar contacto...", lang)}</option>{companyContacts.map(contact => <option key={contact.email} value={contact.email}>{contact.fullName} - {contact.email}</option>)}</select></label>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Button type="button" size="sm" variant="outline" onClick={() => setShowExternalPerson(value => !value)}><UserPlus style={{ width: 12, height: 12, marginRight: 4 }} />{w("Add person not in list", "Agregar persona fuera de lista", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowCompany(value => !value)}><Plus style={{ width: 12, height: 12, marginRight: 4 }} />{w("Add company not in list", "Agregar empresa fuera de lista", lang)}</Button></div>
    {showExternalPerson && <div style={{ padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }}><strong style={{ fontSize: 11 }}>{w("External person (RFI only, not a project member)", "Persona externa (solo RFI, no es miembro del proyecto)", lang)}</strong><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}><Input value={externalName} onChange={event => setExternalName(event.target.value)} placeholder={w("Name *", "Nombre *", lang)} /><Input value={externalEmail} onChange={event => setExternalEmail(event.target.value)} placeholder={w("Email *", "Correo *", lang)} /><Input value={externalPhone} onChange={event => setExternalPhone(event.target.value)} placeholder={w("Phone", "Telefono", lang)} /></div><div style={{ display: "flex", gap: 6, marginTop: 8 }}><Button type="button" size="sm" onClick={addExternalPerson} disabled={!externalName.trim() || !externalEmail.trim()}>{w("Add and Select", "Agregar y Seleccionar", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowExternalPerson(false)}>{w("Cancel", "Cancelar", lang)}</Button></div></div>}
    {showCompany && <div style={{ padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }}><strong style={{ fontSize: 11 }}>{w("Add company to the project directory", "Agregar empresa al directorio del proyecto", lang)}</strong><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}><Input value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={w("Company *", "Empresa *", lang)} /><Input value={companyContact} onChange={event => setCompanyContact(event.target.value)} placeholder={w("Contact person *", "Persona de contacto *", lang)} /><Input value={companyEmail} onChange={event => setCompanyEmail(event.target.value)} placeholder={w("Email *", "Correo *", lang)} /><Input value={companyPhone} onChange={event => setCompanyPhone(event.target.value)} placeholder={w("Phone", "Telefono", lang)} /><Input value={companyAddress} onChange={event => setCompanyAddress(event.target.value)} placeholder={w("Address", "Direccion", lang)} style={{ gridColumn: "1 / -1" }} /></div><div style={{ display: "flex", gap: 6, marginTop: 8 }}><Button type="button" size="sm" onClick={() => void addCompany()} disabled={savingCompany}>{savingCompany ? w("Adding...", "Agregando...", lang) : w("Add Company", "Agregar Empresa", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowCompany(false)}>{w("Cancel", "Cancelar", lang)}</Button></div></div>}
  </div>;
}

function RfiDistributionEditor({ entries, contacts, editable, onChange, lang }: { entries: string[]; contacts: RfiDirectoryContact[]; editable: boolean; onChange: (entries: string[]) => void; lang: string }) {
  const [showExternal, setShowExternal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const uniqueContacts = [...new Map(contacts.filter(contact => contact.email).map(contact => [contact.email.toLowerCase(), contact])).values()];
  const add = (entry: string) => onChange(entries.includes(entry) ? entries : [...entries, entry]);
  const remove = (index: number) => onChange(entries.filter((_, itemIndex) => itemIndex !== index));
  return <div style={{ display: "grid", gap: 8 }}>
    {editable && uniqueContacts.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>{w("Project contacts", "Contactos del proyecto", lang)}</div>{uniqueContacts.map(contact => <label key={contact.email} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginTop: 4 }}><input type="checkbox" checked={entries.includes(contact.email)} onChange={event => event.target.checked ? add(contact.email) : onChange(entries.filter(entry => entry !== contact.email))} /><span>{contact.fullName}{contact.companyName ? ` - ${contact.companyName}` : ""}</span><span style={{ color: "hsl(var(--muted-foreground))" }}>{contact.email}</span></label>)}</div>}
    <div><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>{w("Current distribution", "Distribucion actual", lang)}</div>{entries.length === 0 ? <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No distribution recipients selected.", "No hay destinatarios seleccionados.", lang)}</span> : entries.map((entry, index) => { const parsed = parseDistributionEntry(entry); const contact = !parsed.isExternal ? uniqueContacts.find(item => item.email.toLowerCase() === parsed.email.toLowerCase()) : undefined; const display = contact ? `${contact.fullName}${contact.companyName ? ` - ${contact.companyName}` : ""} <${contact.email}>` : parsed.display; return <div key={`${entry}-${index}`} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderTop: index ? "1px solid hsl(var(--border) / 0.5)" : undefined, fontSize: 12 }}>{parsed.isExternal ? <UserPlus style={{ width: 12, height: 12 }} /> : <Mail style={{ width: 12, height: 12 }} />}<span style={{ flex: 1 }}>{display}</span>{editable && <Button type="button" size="sm" variant="outline" onClick={() => remove(index)}>{w("Remove", "Quitar", lang)}</Button>}</div>; })}</div>
    {editable && <><Button type="button" size="sm" variant="outline" onClick={() => setShowExternal(value => !value)} style={{ justifySelf: "start" }}><UserPlus style={{ width: 12, height: 12, marginRight: 4 }} />{w("Add external contact", "Agregar contacto externo", lang)}</Button>{showExternal && <div style={{ padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }}><strong style={{ fontSize: 11 }}>{w("External contact (RFI notifications only, not a project member)", "Contacto externo (solo notificaciones RFI, no es miembro del proyecto)", lang)}</strong><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}><Input value={name} onChange={event => setName(event.target.value)} placeholder={w("Name *", "Nombre *", lang)} /><Input value={email} onChange={event => setEmail(event.target.value)} placeholder={w("Email *", "Correo *", lang)} /><Input value={phone} onChange={event => setPhone(event.target.value)} placeholder={w("Phone (optional)", "Telefono (opcional)", lang)} /></div><div style={{ display: "flex", gap: 6, marginTop: 8 }}><Button type="button" size="sm" disabled={!name.trim() || !email.trim()} onClick={() => { add(encodeExternalDistributionEntry(name, email, phone)); setName(""); setEmail(""); setPhone(""); setShowExternal(false); }}>{w("Add to Distribution", "Agregar a Distribucion", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowExternal(false)}>{w("Cancel", "Cancelar", lang)}</Button></div></div>}</>}
  </div>;
}

function RfiCreatePanel({ projectId, prefill, existingRfis, members, user, lang, onClose }: {
  projectId: number;
  prefill?: { subject?: string; question?: string; location?: string };
  existingRfis: Rfi[];
  members: { userFullName: string; userCompanyName?: string; userEmail: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  lang: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getOptions } = useConfig();
  const priorityOptions = getOptions("rfi_priority");
  const configuredRfiTypes = getOptions("rfi_type");
  const rfiTypeOptions = configuredRfiTypes.length
    ? configuredRfiTypes.map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label }))
    : DEFAULT_RFI_TYPES.map(t => ({ value: t, label: t }));
  const { data: files } = useListFiles(projectId);
  const [rfiDirectory, setRfiDirectory] = useState<RfiDirectoryContact[]>([]);
  const memberContacts = useMemo<RfiDirectoryContact[]>(() => members.map(member => ({ fullName: member.userFullName, email: member.userEmail, companyName: member.userCompanyName || null })), [members]);
  const availableContacts = useMemo(() => [...new Map([...memberContacts, ...rfiDirectory].filter(contact => contact.email).map(contact => [contact.email.toLowerCase(), contact])).values()], [memberContacts, rfiDirectory]);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/projects/${projectId}/directory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(w("Project directory could not be loaded.", "No se pudo cargar el directorio del proyecto.", lang));
        setRfiDirectory(Array.isArray(data) ? data : []);
      })
      .catch(error => toast({ title: error instanceof Error ? error.message : w("Project directory could not be loaded.", "No se pudo cargar el directorio del proyecto.", lang), variant: "destructive" }));
  }, [projectId, lang, toast]);

  // Fix 1 — auto-populate project address from last RFI that has one
  const lastAddress = useMemo(() => {
    const withAddr = [...existingRfis].reverse().find(r => r.projectAddress);
    return withAddr?.projectAddress || "";
  }, [existingRfis]);

  const [subject, setSubject] = useState(prefill?.subject || "");
  const [rfiType, setRfiType] = useState(rfiTypeOptions[0]?.value || "");
  const [priority, setPriority] = useState(priorityOptions[0]?.value || "medium");
  const [dateRequested, setDateRequested] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateRequired, setDateRequired] = useState("");
  const [projectAddress, setProjectAddress] = useState(lastAddress);

  const [sByCompany, setsByCompany] = useState(user?.companyName || "");
  const [sByContact, setsByContact] = useState(user?.fullName || "");
  const [sByAddress, setsByAddress] = useState("");
  const [sByPhone, setsByPhone] = useState("");
  const [sByEmail, setsByEmail] = useState(user?.email || "");

  const [sToCompany, setsToCompany] = useState("");
  const [sToPerson, setsToPerson] = useState("");
  const [sToEmail, setsToEmail] = useState("");

  // Fix 2 — add external person to submitted to

  const [drawingNum, setDrawingNum] = useState("");
  const [drawingTitle, setDrawingTitle] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [detailNum, setDetailNum] = useState("");
  const [noteNum, setNoteNum] = useState("");
  const [location, setLocation] = useState(prefill?.location || "");

  // Fix 3 — file search state per reference field
  const [fileSearch, setFileSearch] = useState<string | null>(null);

  const [question, setQuestion] = useState(prefill?.question || "");
  const [references, setReferences] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const allEvidence = useMemo(() => [...references, ...attachments], [references, attachments]);
  const [packageItems, setPackageItems] = useState<RfiPackageItem[]>([]);
  const [imagePresentation, setImagePresentation] = useState<RfiImagePresentation>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingImageQueue, setPendingImageQueue] = useState<PendingImageInput[]>([]);
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [savedImagePreviewUrl, setSavedImagePreviewUrl] = useState<string | null>(null);
  const [editingSavedImage, setEditingSavedImage] = useState(false);
  const [attachInput, setAttachInput] = useState("");
  const stagedFileIds = useRef(new Set<number>());
  const [uploadResults, setUploadResults] = useState<Array<{ name: string; state: "uploading" | "success" | "error"; message?: string }>>([]);

  const [costImpact, setCostImpact] = useState("No Cost Impact");
  const [costAmount, setCostAmount] = useState("");
  const [costReason, setCostReason] = useState("");
  const [schedImpact, setSchedImpact] = useState("No Schedule Impact");
  const [schedDays, setSchedDays] = useState("");
  const [schedReason, setSchedReason] = useState("");

  const [distList, setDistList] = useState<string[]>([]);

  // Fix 4 — external contact form state

  const [aiDesc, setAiDesc] = useState("");
  const [emailDescription, setEmailDescription] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  const [emailDraftError, setEmailDraftError] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);
  const costReasonRequired = costImpact === "Cost Increase TBD" || costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const costAmountRequired = costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const scheduleDaysRequired = schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days";
  const addReference = () => {
    const normalized = normalizeManualReference(attachInput);
    if (!normalized.value) {
      toast({ title: w(normalized.error || "Invalid reference.", "Referencia no valida.", lang), variant: "destructive" });
      return;
    }
    const value = normalized.value;
    setReferences(prev => prev.includes(value) ? prev : [...prev, value]);
    setPackageItems(prev => prev.some(item => item.attachment === value) ? prev : [...prev, ...packageItemsFromAttachments([value], files || []).map(item => ({ ...item, order: prev.length }))]);
    setAttachInput("");
  };
  useEffect(() => {
    setPackageItems(prev => {
      const next = [...prev];
      for (const item of packageItemsFromAttachments(allEvidence, files || [])) {
        if (!next.some(existing => existing.attachment === item.attachment || (existing.fileId && existing.fileId === item.fileId))) {
          next.push({ ...item, order: next.length });
        }
      }
      return next.filter(item => !item.attachment || allEvidence.includes(item.attachment)).map((item, order) => ({ ...item, order }));
    });
  }, [allEvidence, files]);

  // AI document import: read an existing PDF/Word/Excel and prefill this form.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const handleImportPrefill = async (file: File) => {
    setImporting(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/import-prefill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Import failed"); }
      const { fields } = await resp.json() as { fields: Record<string, string | null> };
      const s = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string).trim() : "");
      if (s("subject")) setSubject(s("subject"));
      if (s("question")) setQuestion(s("question"));
      if (s("submittedToCompany")) setsToCompany(s("submittedToCompany"));
      if (s("submittedToPerson")) setsToPerson(s("submittedToPerson"));
      if (s("submittedToEmail")) setsToEmail(s("submittedToEmail"));
      if (s("submittedByCompany")) setsByCompany(s("submittedByCompany"));
      if (s("submittedByContact")) setsByContact(s("submittedByContact"));
      if (s("submittedByEmail")) setsByEmail(s("submittedByEmail"));
      if (s("drawingNumber")) setDrawingNum(s("drawingNumber"));
      if (s("specSection")) setSpecSection(s("specSection"));
      if (s("locationDescription")) setLocation(s("locationDescription"));
      if (["No Cost Impact", "Cost Increase TBD", "Cost Increase Known", "Cost Decrease"].includes(s("costImpact"))) setCostImpact(s("costImpact"));
      if (["No Schedule Impact", "Increase in Calendar Days", "Decrease in Calendar Days"].includes(s("scheduleImpact"))) setSchedImpact(s("scheduleImpact"));
      if (["low", "medium", "high"].includes(s("priority"))) setPriority(s("priority"));
      if (/^\d{4}-\d{2}-\d{2}$/.test(s("dateRequired"))) setDateRequired(s("dateRequired"));
      setImportedFrom(file.name);
      toast({ title: w("Fields filled from document — review before creating", "Campos completados del documento — revise antes de crear", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Could not read document", "No se pudo leer el documento", lang), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Upload an attachment from the user's computer, then add its download URL.
  const attachFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const uploadAttachment = async (file: File, imageCrop?: NormalizedCrop | null, imageKind: PendingImage["kind"] = "upload") => {
    setUploadingAtt(true);
    setUploadResults(prev => [...prev.filter(item => item.name !== file.name), { name: file.name, state: "uploading" }]);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const imagePath = imageKind === "paste" ? "paste-image" : imageKind === "screen-snip" ? "screen-snip" : "upload";
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/${file.type.startsWith("image/") ? imagePath : "upload"}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const result = await resp.json().catch(() => ({})) as { downloadUrl?: string; fileId?: number; fileName?: string; error?: string };
      if (!resp.ok || !result.downloadUrl || !result.fileId || !result.fileName) throw new Error(result.error || "Upload failed");
      const { downloadUrl, fileId, fileName } = result as { downloadUrl: string; fileId: number; fileName: string };
      stagedFileIds.current.add(fileId);
      setAttachments(prev => prev.includes(downloadUrl) ? prev : [...prev, downloadUrl]);
      setPackageItems(prev => prev.some(item => item.fileId === fileId) ? prev : [...prev, { key: `file:${fileId}`, label: fileName, fileId, attachment: downloadUrl, source: "rfi-attachment", include: true, order: prev.length }]);
      if (file.type.startsWith("image/")) {
        setImagePresentation({ sourceFileId: fileId, sourceKind: imageKind, showInRfi: true, includeInCompletePdf: true, crop: imageCrop || null });
        setSavedImagePreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
      }
      setUploadResults(prev => prev.map(item => item.name === file.name ? { name: fileName, state: "success", message: w("Attached", "Adjuntado", lang) } : item));
      toast({ title: w("File uploaded and attached", "Archivo subido y adjuntado", lang) });
    } catch (error) {
      const message = error instanceof TypeError ? w("Network error while uploading the image.", "Error de red al subir la imagen.", lang) : error instanceof Error ? error.message : w("Upload failed", "Error al subir", lang);
      setUploadResults(prev => prev.map(item => item.name === file.name ? { name: file.name, state: "error", message } : item));
      toast({ title: message, variant: "destructive" });
    } finally {
      setUploadingAtt(false);
    }
  };

  const removeStagedAttachment = async (index: number) => {
    const value = attachments[index];
    const fileId = fileIdFromAttachment(value);
    if (fileId && stagedFileIds.current.has(fileId)) {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const response = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/staged/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { toast({ title: data.error || w("Staged upload could not be removed.", "No se pudo quitar el archivo temporal.", lang), variant: "destructive" }); return; }
      stagedFileIds.current.delete(fileId);
    }
    setAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const cancelCreate = async () => {
    const ids = [...stagedFileIds.current];
    if (ids.length) {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const results = await Promise.all(ids.map(fileId => fetch(`/api/v1/projects/${projectId}/rfis/attachments/staged/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })));
      if (results.some(response => !response.ok)) {
        toast({ title: w("Some staged uploads could not be removed. The form remains open.", "No se pudieron quitar algunos archivos temporales. El formulario permanece abierto.", lang), variant: "destructive" });
        return;
      }
      stagedFileIds.current.clear();
    }
    onClose();
  };

  const beginPendingImage = async (file: File, kind: PendingImage["kind"] = "upload") => {
    try { await validateImageForReview(file); } catch (error) {
      const code = error instanceof Error ? error.message : "image_decode_failed";
      toast({ title: code === "unsupported_or_empty_image" ? w("Select a supported, non-empty image.", "Seleccione una imagen compatible y no vacia.", lang) : w("The image could not be decoded.", "No se pudo decodificar la imagen.", lang), variant: "destructive" }); return;
    }
    setUploadResults(prev => [...prev.filter(item => item.name !== file.name), { name: file.name, state: "uploading", message: w("Awaiting crop review", "Esperando revision de recorte", lang) }]);
    setPendingImageQueue(prev => [...prev, { file, mode: "source", kind }]);
  };

  useEffect(() => {
    if (pendingImage || pendingImageQueue.length === 0) return;
    const [next, ...rest] = pendingImageQueue;
    setPendingImageQueue(rest);
    setPendingImage({ ...next, url: URL.createObjectURL(next.file) });
  }, [pendingImage, pendingImageQueue]);

  const pasteCreateImage = async () => {
    if (!navigator.clipboard?.read) {
      toast({ title: w("Clipboard image access is unavailable in this browser.", "El acceso a imagenes del portapapeles no esta disponible en este navegador.", lang), variant: "destructive" });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await beginPendingImage(new File([blob], "clipboard-rfi-image.png", { type }), "paste");
          return;
        }
      }
      toast({ title: w("Clipboard does not contain an image.", "El portapapeles no contiene una imagen.", lang), variant: "destructive" });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      toast({ title: denied ? w("Clipboard image access was denied.", "Se denego el acceso a imagenes del portapapeles.", lang) : w("The clipboard image could not be read.", "No se pudo leer la imagen del portapapeles.", lang), variant: "destructive" });
    }
  };

  const captureCreateImage = async () => {
    try {
      const frame = await acquireCapturedFrame("screen-snip-rfi-image.png");
      setCapturedFrame(prev => { if (prev) URL.revokeObjectURL(prev.url); return frame; });
    } catch (error) {
      const code = error instanceof Error ? error.message : "capture_failed";
      const messages: Record<string, string> = { capture_api_unavailable:w("Screen Capture API is unavailable.","La API de captura de pantalla no esta disponible.",lang),capture_cancelled_or_denied:w("Screen capture was cancelled or permission was denied.","La captura fue cancelada o el permiso fue denegado.",lang),capture_source_ended:w("The selected capture source ended before a frame was captured.","La fuente seleccionada termino antes de capturar un fotograma.",lang),empty_capture_frame:w("The selected source returned an empty frame.","La fuente seleccionada devolvio un fotograma vacio.",lang),capture_canvas_failed:w("The captured frame could not be converted.","No se pudo convertir el fotograma capturado.",lang)};
      toast({ title: messages[code] || w("Screen capture failed.", "Fallo la captura de pantalla.", lang), variant: "destructive" });
    }
  };

  useEffect(() => () => { if (capturedFrame) URL.revokeObjectURL(capturedFrame.url); if (pendingImage) URL.revokeObjectURL(pendingImage.url); if (savedImagePreviewUrl) URL.revokeObjectURL(savedImagePreviewUrl); }, [capturedFrame, pendingImage, savedImagePreviewUrl]);

  const [connectedFileSourcesCreate, setConnectedFileSourcesCreate] = useState<FileSourceProvider[]>([]);
  const [cloudPickerCreate, setCloudPickerCreate] = useState<FileSourceProvider | null>(null);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/me/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d as { provider: string; status: string }[] : [];
        setConnectedFileSourcesCreate(FILE_SOURCE_PROVIDERS.filter(p => list.some(c => c.provider === p.key && c.status === "connected")));
      })
      .catch((error) => logClientError("RFI create file source connection load", error));
  }, []);


  const lastRfiData = useRef<any>(null);

  const { mutate: createRfi, isPending } = useCreateRfi({
    mutation: {
      onSuccess: () => {
        stagedFileIds.current.clear();
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w("RFI created", "RFI creado", lang) });
        onClose();
      },
      onError: (error: any) => {
        const data = error?.response?.data ?? error?.data ?? {};
        if (data.error === "duplicate_number" && data.suggestedNumber) {
          const msg = `${data.message}\n\nSuggested number: ${data.suggestedNumber}\n\nUse suggested number?`;
          if (confirm(msg)) {
            createRfi({
              projectId,
              data: {
                ...(lastRfiData.current ?? {}),
                number: data.suggestedNumber,
                forceNumber: true,
              } as any,
            });
          }
        } else {
          toast({ title: w("Error creating RFI", "Error al crear RFI", lang), variant: "destructive" });
        }
      },
    },
  });

  const { mutate: generateQ, isPending: isGenerating } = useGenerateRfiQuestion({
    mutation: {
      onSuccess: (data) => { setQuestion(data.question); setAiDesc(""); },
      onError: () => toast({ title: w("AI generation failed", "Generación IA falló", lang), variant: "destructive" }),
    },
  });

  const generateCreateEmailDraft = async () => {
    setEmailDraftLoading(true);
    setEmailDraftError("");
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/generate-email-draft`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          question,
          userContext: emailDescription.trim() || undefined,
          submittedToPerson: sToPerson,
          submittedToCompany: sToCompany,
          submittedByContact: sByContact,
          submittedByCompany: sByCompany,
          dateRequired,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { email?: string; error?: string };
      if (!resp.ok || !data.email?.trim()) throw new Error(data.error || "AI email draft failed");
      setEmailDraft(data.email);
      toast({ title: w("Email draft created from text fields only", "Borrador de correo creado solo con campos de texto", lang) });
    } catch (error) {
      const message = error instanceof Error ? error.message : w("AI email draft failed", "Falló el borrador de email IA", lang);
      setEmailDraftError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setEmailDraftLoading(false);
    }
  };

  const copyCreateEmailDraft = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
      toast({ title: w("Email copied to clipboard", "Email copiado al portapapeles", lang) });
    } catch {
      toast({ title: w("Copy failed", "Error al copiar", lang), variant: "destructive" });
    }
  };

  // Fix 2 — save external person

  // Fix 4 — save external contact

  const handleSubmit = () => {
    if (!subject.trim()) {
      toast({ title: w("Subject is required", "El asunto es requerido", lang), variant: "destructive" }); return;
    }
    const data = {
      subject, priority,
      rfiType,
      dateRequested: dateRequested ? new Date(dateRequested).toISOString() : "",
      dateRequired: dateRequired ? new Date(dateRequired).toISOString() : "",
      projectAddress,
      submittedByCompany: sByCompany,
      submittedByContact: sByContact,
      submittedByAddress: sByAddress,
      submittedByPhone: sByPhone,
      submittedByEmail: sByEmail,
      submittedToCompany: sToCompany,
      submittedToPerson: sToPerson,
      submittedToEmail: sToEmail,
      drawingNumber: drawingNum,
      drawingTitle,
      specSection,
      detailNumber: detailNum,
      noteNumber: noteNum,
      locationDescription: location,
      question,
      costImpact,
      costImpactAmount: costAmountRequired ? costAmount : null,
      costImpactReason: costReasonRequired ? costReason : null,
      scheduleImpact: schedImpact,
      scheduleImpactDays: scheduleDaysRequired && schedDays ? parseInt(schedDays) : null,
      scheduleImpactReason: scheduleDaysRequired ? schedReason : null,
      distributionList: distList,
      emailDescription,
      emailDraft,
      attachmentsJson: allEvidence,
      attachmentPackageJson: packageItems,
      imagePresentationJson: imagePresentation,
    };
    lastRfiData.current = data;
    createRfi({
      projectId,
      data,
    });
  };

  const handleCanonicalCreateChange = (field: keyof RfiCanonicalValues, value: string) => {
    switch (field) {
      case "subject": setSubject(value); break;
      case "priority": setPriority(value); break;
      case "rfiType": setRfiType(value); break;
      case "dateRequested": setDateRequested(value); break;
      case "dateRequired": setDateRequired(value); break;
      case "projectAddress": setProjectAddress(value); break;
      case "submittedByCompany": setsByCompany(value); break;
      case "submittedByContact": setsByContact(value); break;
      case "submittedByAddress": setsByAddress(value); break;
      case "submittedByPhone": setsByPhone(value); break;
      case "submittedByEmail": setsByEmail(value); break;
      case "submittedToCompany": setsToCompany(value); break;
      case "submittedToPerson": setsToPerson(value); break;
      case "submittedToEmail": setsToEmail(value); break;
      case "drawingNumber": setDrawingNum(value); break;
      case "drawingTitle": setDrawingTitle(value); break;
      case "specSection": setSpecSection(value); break;
      case "detailNumber": setDetailNum(value); break;
      case "noteNumber": setNoteNum(value); break;
      case "locationDescription": setLocation(value); break;
      case "referenceInput": setAttachInput(value); break;
      case "question": setQuestion(value); break;
      case "costImpact":
        setCostImpact(value);
        if (value !== "Cost Increase Known" && value !== "Cost Decrease") setCostAmount("");
        if (value !== "Cost Increase TBD" && value !== "Cost Increase Known" && value !== "Cost Decrease") setCostReason("");
        break;
      case "costImpactAmount": setCostAmount(value); break;
      case "costImpactReason": setCostReason(value); break;
      case "scheduleImpact":
        setSchedImpact(value);
        if (value !== "Increase in Calendar Days" && value !== "Decrease in Calendar Days") { setSchedDays(""); setSchedReason(""); }
        break;
      case "scheduleImpactDays": setSchedDays(value); break;
      case "scheduleImpactReason": setSchedReason(value); break;
      case "distributionList": setDistList(value.split(",").map(v => v.trim()).filter(Boolean)); break;
      case "emailDescription": setEmailDescription(value); break;
      case "questionAssistDescription": setAiDesc(value); break;
      default: break;
    }
  };

  return (
    <>
      <RfiCanonicalForm
        lang={lang}
        mode="create"
        recordState="new"
        values={{
          subject,
          status: "draft",
          priority,
          rfiType,
          dateRequested,
          dateRequired,
          projectAddress,
          submittedByCompany: sByCompany,
          submittedByContact: sByContact,
          submittedByAddress: sByAddress,
          submittedByPhone: sByPhone,
          submittedByEmail: sByEmail,
          submittedToCompany: sToCompany,
          submittedToPerson: sToPerson,
          submittedToEmail: sToEmail,
          drawingNumber: drawingNum,
          drawingTitle,
          specSection,
          detailNumber: detailNum,
          noteNumber: noteNum,
          locationDescription: location,
          referenceInput: attachInput,
          question,
          costImpact,
          costImpactAmount: costAmount,
          costImpactReason: costReason,
          scheduleImpact: schedImpact,
          scheduleImpactDays: schedDays,
          scheduleImpactReason: schedReason,
          distributionList: distList,
          emailDescription,
          emailDraft,
          questionAssistDescription: aiDesc,
        }}
        permissions={{ canEdit: true, canRespond: false, canClose: false, canReopen: false, canExport: false, canRaiseChangeOrder: false, canJumpViewpoint: false }}
        references={references}
        attachments={attachments}
        attachmentFiles={files || []}
        uploadResults={uploadResults}
        imagePresentation={imagePresentation}
        packageItems={packageItems}
        responses={[]}
        loading={{ saving: isPending, uploading: uploadingAtt, questionAi: isGenerating, emailAi: emailDraftLoading }}
        options={{ priorities: priorityOptions.map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label })), rfiTypes: rfiTypeOptions }}
        cloudAttachmentActions={connectedFileSourcesCreate.map(provider => ({ key: provider.key, label: w(`From ${provider.label}`, `Desde ${provider.label}`, lang), icon: "cloud" as const, onClick: () => setCloudPickerCreate(provider) }))}
        imageAttachmentActions={[
          { key: "upload-image", label: w("Upload Image", "Subir Imagen", lang), icon: "upload", onClick: () => imageFileRef.current?.click() },
          { key: "paste-image", label: w("Paste Image", "Pegar Imagen", lang), icon: "paste", onClick: pasteCreateImage },
          { key: "capture-screen", label: w("Capture Screen", "Capturar Pantalla", lang), icon: "capture", onClick: captureCreateImage },
        ]}
        imagePresentationContent={imagePresentation ? <RfiImagePresentationControls lang={lang} imageUrl={savedImagePreviewUrl} label={w(imagePresentation.sourceKind === "screen-snip" ? "Screen snip" : imagePresentation.sourceKind === "paste" ? "Pasted image" : "Uploaded image", imagePresentation.sourceKind === "screen-snip" ? "Recorte de pantalla" : imagePresentation.sourceKind === "paste" ? "Imagen pegada" : "Imagen subida", lang)} crop={imagePresentation.crop} showInRfi={imagePresentation.showInRfi !== false} includeInCompletePdf={imagePresentation.includeInCompletePdf !== false} editable onCrop={() => setEditingSavedImage(true)} onFullImage={() => setImagePresentation(prev => prev ? { ...prev, crop: null } : prev)} onShowChange={showInRfi => setImagePresentation(prev => prev ? { ...prev, showInRfi } : prev)} onPdfChange={includeInCompletePdf => setImagePresentation(prev => prev ? { ...prev, includeInCompletePdf } : prev)} /> : null}
        actions={{ submit: handleSubmit, cancel: () => { void cancelCreate(); } }}
        onChange={handleCanonicalCreateChange}
        onAddReference={addReference}
        onRemoveReference={(source, index) => source === "reference" ? setReferences(prev => prev.filter((_, i) => i !== index)) : void removeStagedAttachment(index)}
        onOpenReference={value => { void openRfiAttachment(value).catch(error => toast({ title: error instanceof Error ? error.message : w("Attachment could not be opened", "No se pudo abrir el adjunto", lang), variant: "destructive" })); }}
        onUploadFile={() => attachFileRef.current?.click()}
        onGenerateQuestionAi={() => {
          const description = aiDesc.trim() || question.trim() || subject.trim();
          if (!description) { toast({ title: w("Add a description before using AI assist.", "Agregue una descripcion antes de usar asistencia IA.", lang), variant: "destructive" }); return; }
          generateQ({ data: { description, subject, projectName: undefined } });
        }}
        onGenerateEmailAi={generateCreateEmailDraft}
        onCopyEmail={copyCreateEmailDraft}
        emailCopied={emailCopied}
        submittedByDirectoryContent={availableContacts.length > 0 ? <div style={{ marginTop: 8 }}><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Choose from project directory", "Elegir del directorio del proyecto", lang)}</label><select value="" onChange={e => { const contact = availableContacts.find(item => item.email === e.target.value); if (contact) { setsByContact(contact.fullName); setsByCompany(contact.companyName || ""); setsByEmail(contact.email); } }} style={{ width: "100%", height: 36, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", padding: "0 8px", fontSize: 12 }}><option value="">{w("Select a contact...", "Seleccione un contacto...", lang)}</option>{availableContacts.map(contact => <option key={`from-${contact.email}`} value={contact.email}>{contact.fullName}{contact.companyName ? ` - ${contact.companyName}` : ""}</option>)}</select></div> : null}
        submittedToDirectoryContent={<SubmittedToParticipantEditor projectId={projectId} contacts={availableContacts} selectedCompany={sToCompany} onSelect={(company, person, email) => { setsToCompany(company); setsToPerson(person); setsToEmail(email); }} onAddDistribution={entry => setDistList(prev => prev.includes(entry) ? prev : [...prev, entry])} onDirectoryAdded={contact => setRfiDirectory(prev => prev.some(item => item.email.toLowerCase() === contact.email.toLowerCase()) ? prev : [...prev, contact])} lang={lang} />}
        distributionContent={<RfiDistributionEditor entries={distList} contacts={availableContacts} editable onChange={setDistList} lang={lang} />}
        referenceContent={<div style={{ position: "relative", marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><Button type="button" size="sm" variant="outline" onClick={() => setFileSearch(fileSearch === "reference" ? null : "reference")}><Search style={{ width: 12, height: 12, marginRight: 4 }} />{w("Select Project File", "Seleccionar Archivo del Proyecto", lang)}</Button><Button type="button" size="sm" variant="outline" disabled={importing} onClick={() => { if (window.confirm(w("AI file reading uses higher-cost AI credits and will read the selected document. Continue?", "La lectura de archivos con IA usa creditos IA de mayor costo y leera el documento seleccionado. Continuar?", lang))) importInputRef.current?.click(); }}>{importing ? w("Reading File with AI...", "Leyendo Archivo con IA...", lang) : w("Read File with AI", "Leer Archivo con IA", lang)}</Button>{importedFrom && <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("Prefilled from", "Completado desde", lang)}: {importedFrom}</span>}{fileSearch === "reference" && <FileSearchDropdown files={files || []} onSelect={file => { const locator = canonicalFileLocator(projectId, file.id); setAttachments(prev => prev.includes(locator) ? prev : [...prev, locator]); setFileSearch(null); }} onClose={() => setFileSearch(null)} />}</div>}
        responseContent={emailDraftError ? <p style={{ marginTop: 8, fontSize: 11, color: "#DC2626" }}>{emailDraftError}</p> : null}
        onTogglePackageItem={(key, include) => setPackageItems(prev => prev.map(item => item.key === key ? { ...item, include } : item))}
        onMovePackageItem={(key, direction) => setPackageItems(prev => { const ordered = [...prev].sort((a, b) => a.order - b.order); const index = ordered.findIndex(item => item.key === key); const target = index + direction; if (index < 0 || target < 0 || target >= ordered.length) return prev; [ordered[index], ordered[target]] = [ordered[target], ordered[index]]; return ordered.map((item, order) => ({ ...item, order })); })}
        onToggleViewpointImage={include => setImagePresentation(prev => prev ? { ...prev, includeInCompletePdf: include } : prev)}
      />
      <input ref={attachFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { const selected = [...(e.target.files || [])]; if (selected.length) { const images=selected.filter(file=>file.type.startsWith("image/")); const documents=selected.filter(file=>!file.type.startsWith("image/")); documents.forEach(file=>{void uploadAttachment(file);}); images.forEach(file=>{void beginPendingImage(file,"upload");}); } e.target.value = ""; }} />
      <input ref={importInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportPrefill(f); e.target.value = ""; }} />
      <input ref={imageFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void beginPendingImage(f, "upload"); e.target.value = ""; }} />
      {capturedFrame && <RfiSnippingWorkspace src={capturedFrame.url} fileName={capturedFrame.fileName} lang={lang} onComplete={file => { setCapturedFrame(null); revokeObjectUrlAfterRender(capturedFrame.url); void beginPendingImage(file, "screen-snip"); }} onRetake={() => { setCapturedFrame(null); revokeObjectUrlAfterRender(capturedFrame.url); void captureCreateImage(); }} onCancel={() => { setCapturedFrame(null); revokeObjectUrlAfterRender(capturedFrame.url); }} />}
      {pendingImage && <RfiImageCropEditor src={pendingImage.url} fileName={pendingImage.file.name} initialCrop={null} lang={lang} onApply={crop => { const current=pendingImage; setPendingImage(null); void uploadAttachment(current.file,crop,current.kind).finally(()=>URL.revokeObjectURL(current.url)); }} onCancel={() => { setUploadResults(prev=>prev.map(item=>item.name===pendingImage.file.name?{name:item.name,state:"error",message:w("Canceled - not uploaded","Cancelado - no subido",lang)}:item)); setPendingImage(null); revokeObjectUrlAfterRender(pendingImage.url); }} onRetake={pendingImage.kind === "screen-snip" ? () => { setPendingImage(null); revokeObjectUrlAfterRender(pendingImage.url); void captureCreateImage(); } : undefined} />}
      {editingSavedImage && savedImagePreviewUrl && <RfiImageCropEditor src={savedImagePreviewUrl} fileName={w("Saved RFI image","Imagen RFI guardada",lang)} initialCrop={imagePresentation?.crop || null} lang={lang} onApply={crop => { setImagePresentation(prev => prev ? { ...prev, crop } : prev); setEditingSavedImage(false); }} onCancel={() => setEditingSavedImage(false)} />}
      {cloudPickerCreate && (
        <CloudPicker
          provider={cloudPickerCreate}
          projectId={projectId}
          lang={lang}
          onAttached={file => { stagedFileIds.current.add(file.fileId); setAttachments(prev => prev.includes(file.downloadUrl) ? prev : [...prev, file.downloadUrl]); setPackageItems(prev => prev.some(item => item.fileId === file.fileId) ? prev : [...prev, { key: `file:${file.fileId}`, label: file.fileName, fileId: file.fileId, attachment: file.downloadUrl, source: `cloud:${cloudPickerCreate.key}`, include: true, order: prev.length }]); }}
          onClose={() => setCloudPickerCreate(null)}
        />
      )}
    </>
  );

}

// ─── RFI Detail Panel ─────────────────────────────────────────────────────────
function RfiDetailPanel({ projectId, rfi, canWrite, lang, members, user, onClose, onRevise, onExportPdf, onExportCompletePdf, onUpdate }: {
  projectId: number;
  rfi: Rfi;
  canWrite: boolean;
  lang: string;
  members: { userFullName: string; userCompanyName?: string; userEmail: string; role?: string }[];
  user: { fullName: string; companyName: string; email: string } | null;
  onClose: () => void;
  onRevise: (rfi: Rfi) => void;
  onExportPdf: (rfi: Rfi) => void;
  onExportCompletePdf: (rfi: Rfi) => void;
  onUpdate: (rfi: Rfi) => void;
}) {
  const persistedEmail = rfi as Rfi & { emailDescription?: string | null; emailDraft?: string | null };
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getLabel, getOptions } = useConfig();
  const { data: files } = useListFiles(projectId);
  const priorityOptions = getOptions("rfi_priority").map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label }));
  const configuredRfiTypes = getOptions("rfi_type");
  const rfiTypeOptions = configuredRfiTypes.length
    ? configuredRfiTypes.map(o => ({ value: o.value, label: lang === "es" ? o.labelEs : o.label }))
    : DEFAULT_RFI_TYPES.map(t => ({ value: t, label: t }));
  const configuredRespondedStatus = getOptions("rfi_status").find(option => option.value.toLowerCase() === "responded")?.value || rfi.status;

  const [answer, setAnswer] = useState(rfi.answer || rfi.response || "");
  const [answeredBy, setAnsweredBy] = useState(rfi.answeredBy || user?.fullName || "");
  const [closingStatus, setClosingStatus] = useState(configuredRespondedStatus);
  const [costImpact, setCostImpact] = useState(rfi.costImpact || "No Cost Impact");
  const [costAmount, setCostAmount] = useState(rfi.costImpactAmount || "");
  const [costReason, setCostReason] = useState((rfi as Rfi & { costImpactReason?: string }).costImpactReason || "");
  const [schedImpact, setSchedImpact] = useState(rfi.scheduleImpact || "No Schedule Impact");
  const [schedDays, setSchedDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : "");
  const [schedReason, setSchedReason] = useState((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || "");

  // Inline edit of the RFI's OWN details (question + cost/schedule impact), separate from the
  // Response fields above — so editing happens right in the detail, no separate form to hunt for.
  // Cost/schedule are free text plus an amount/days field, so "GC to determine" or "3 days @ $75"
  // both fit.
  const [infoEdit, setInfoEdit] = useState(false);
  const [infoQuestion, setInfoQuestion] = useState("");
  const [questionAiDescription, setQuestionAiDescription] = useState("");
  const [infoCost, setInfoCost] = useState("");
  const [infoCostAmt, setInfoCostAmt] = useState("");
  const [infoCostReason, setInfoCostReason] = useState("");
  const [infoSched, setInfoSched] = useState("");
  const [infoSchedDays, setInfoSchedDays] = useState("");
  const [infoSchedReason, setInfoSchedReason] = useState("");
  const [infoToCompany, setInfoToCompany] = useState("");
  const [infoToPerson, setInfoToPerson] = useState("");
  const [infoToEmail, setInfoToEmail] = useState("");
  const [infoFromCompany, setInfoFromCompany] = useState("");
  const [infoFromContact, setInfoFromContact] = useState("");
  const [infoFromAddress, setInfoFromAddress] = useState("");
  const [infoFromPhone, setInfoFromPhone] = useState("");
  const [infoFromEmail, setInfoFromEmail] = useState("");
  const [infoDateRequired, setInfoDateRequired] = useState("");
  const [infoProjectAddress, setInfoProjectAddress] = useState(rfi.projectAddress || "");
  const initialQuestionEvidence = splitRfiEvidence(rfi.attachmentsJson as string[] | null);
  const [questionReferences, setQuestionReferences] = useState<string[]>(initialQuestionEvidence.references);
  const [questionDocs, setQuestionDocs] = useState<string[]>(initialQuestionEvidence.attachments);
  const questionEvidence = useMemo(() => [...questionReferences, ...questionDocs], [questionReferences, questionDocs]);
  const [packageItems, setPackageItems] = useState<RfiPackageItem[]>(() => normalizePackageItems((rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, (rfi.attachmentsJson as string[] | null) || [], []));
  const [imagePresentation, setImagePresentation] = useState<RfiImagePresentation>(() => ((rfi as Rfi & { imagePresentationJson?: RfiImagePresentation }).imagePresentationJson || null));
  const [questionDocInput, setQuestionDocInput] = useState("");
  const [infoSubject, setInfoSubject] = useState("");
  const [infoPriority, setInfoPriority] = useState(rfi.priority || "medium");
  const [infoType, setInfoType] = useState("");
  const [infoDrawingNumber, setInfoDrawingNumber] = useState(rfi.drawingNumber || "");
  const [infoDrawingTitle, setInfoDrawingTitle] = useState(rfi.drawingTitle || "");
  const [infoSpecSection, setInfoSpecSection] = useState(rfi.specSection || "");
  const [infoDetailNumber, setInfoDetailNumber] = useState(rfi.detailNumber || "");
  const [infoNoteNumber, setInfoNoteNumber] = useState(rfi.noteNumber || "");
  const [infoLocationDescription, setInfoLocationDescription] = useState(rfi.locationDescription || "");
  const [infoVpLabel, setInfoVpLabel] = useState("");
  const [infoDist, setInfoDist] = useState<string[]>((rfi.distributionList as string[] | null) || []);
  const startInfoEdit = () => {
    const evidence = splitRfiEvidence(rfi.attachmentsJson as string[] | null);
    setQuestionDocs(evidence.attachments);
    setQuestionReferences(evidence.references);
    setPackageItems(normalizePackageItems((rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, (rfi.attachmentsJson as string[] | null) || [], files || []));
    setImagePresentation((rfi as Rfi & { imagePresentationJson?: RfiImagePresentation }).imagePresentationJson || null);
    setQuestionDocInput("");
    setInfoSubject(rfi.subject || "");
    setInfoPriority(rfi.priority || "medium");
    setInfoType(rfi.rfiType || "");
    setInfoDrawingNumber(rfi.drawingNumber || "");
    setInfoDrawingTitle(rfi.drawingTitle || "");
    setInfoSpecSection(rfi.specSection || "");
    setInfoDetailNumber(rfi.detailNumber || "");
    setInfoNoteNumber(rfi.noteNumber || "");
    setInfoLocationDescription(rfi.locationDescription || "");
    setInfoVpLabel((rfi as { sourceViewpointLabel?: string | null }).sourceViewpointLabel || "");
    setInfoDateRequired(rfi.dateRequired ? format(parseISO(String(rfi.dateRequired)), "yyyy-MM-dd") : "");
    setInfoProjectAddress(rfi.projectAddress || "");
    setInfoDist((rfi.distributionList as string[] | null) || []);
    setInfoQuestion(rfi.question || rfi.description || "");
    setQuestionAiDescription("");
    setInfoCost(rfi.costImpact || "No Cost Impact");
    setInfoCostAmt(rfi.costImpactAmount || "");
    setInfoCostReason((rfi as Rfi & { costImpactReason?: string }).costImpactReason || "");
    setInfoSched(rfi.scheduleImpact || "No Schedule Impact");
    setInfoSchedDays(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : "");
    setInfoSchedReason((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || "");
    setInfoToCompany(rfi.submittedToCompany || "");
    setInfoToPerson(rfi.submittedToPerson || "");
    setInfoToEmail(rfi.submittedToEmail || "");
    setInfoFromCompany(rfi.submittedByCompany || "");
    setInfoFromContact(rfi.submittedByContact || rfi.createdByName || "");
    setInfoFromAddress(rfi.submittedByAddress || "");
    setInfoFromPhone(rfi.submittedByPhone || "");
    setInfoFromEmail(rfi.submittedByEmail || "");
    setUserContext(persistedEmail.emailDescription || "");
    setAiPreview(persistedEmail.emailDraft || null);
    setInfoEdit(true);
  };

  // Project Directory for the recipient picker: pick an existing company/person (auto-fills
  // their email) or just type a new one.
  const [rfiDirectory, setRfiDirectory] = useState<RfiDirectoryContact[]>([]);
  const detailContacts = useMemo(() => [...new Map([...members.map(member => ({ fullName: member.userFullName, email: member.userEmail, companyName: member.userCompanyName || null })), ...rfiDirectory].filter(contact => contact.email).map(contact => [contact.email.toLowerCase(), contact])).values()], [members, rfiDirectory]);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/projects/${projectId}/directory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(w("Project directory could not be loaded.", "No se pudo cargar el directorio del proyecto.", lang));
        if (Array.isArray(data)) setRfiDirectory(data);
      })
      .catch(error => toast({ title: error instanceof Error ? error.message : w("Project directory could not be loaded.", "No se pudo cargar el directorio del proyecto.", lang), variant: "destructive" }));
  }, [projectId, lang, toast]);

  const viewpointFile = useMemo(() => (files || []).find(f => f.source === "lens-viewpoint" && f.linkedRfiId === rfi.id), [files, rfi.id]);

  const activeImageFileId = imagePresentation?.replacementFileId ?? imagePresentation?.sourceFileId ?? viewpointFile?.id ?? null;
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!activeImageFileId) { setActiveImageUrl(null); return; }
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    let url: string | null = null;
    fetch(`/api/v1/projects/${projectId}/files/${activeImageFileId}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { url = URL.createObjectURL(b); setActiveImageUrl(url); } })
      .catch((error) => logClientError("RFI image load", error));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [activeImageFileId, projectId]);

  useEffect(() => {
    setPackageItems(prev => {
      const base = normalizePackageItems(prev.length ? prev : (rfi as Rfi & { attachmentPackageJson?: unknown }).attachmentPackageJson, questionEvidence, files || []);
      const next = [...base];
      for (const docItem of packageItemsFromAttachments(questionEvidence, files || [])) {
        if (!next.some(item => item.attachment === docItem.attachment || (item.fileId && item.fileId === docItem.fileId))) {
          next.push({ ...docItem, order: next.length });
        }
      }
      return next.filter(item => !!item.attachment && questionEvidence.includes(item.attachment)).map((item, order) => ({ ...item, order }));
    });
    if (viewpointFile && !imagePresentation?.sourceFileId) {
      setImagePresentation({ sourceFileId: viewpointFile.id, sourceKind: "viewpoint", showInRfi: true, includeInCompletePdf: true, crop: null });
    }
  }, [files, questionEvidence, rfi.id, projectId, viewpointFile, imagePresentation?.sourceFileId]);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [rfiResponses, setRfiResponses] = useState<Array<{
    id: number; responseText: string; answeredBy: string | null; answeredByEmail: string | null;
    answeredByCompany: string | null; costImpact: string | null; costImpactAmount: string | null; costImpactReason: string | null;
    scheduleImpact: string | null; scheduleImpactDays: number | null; scheduleImpactReason: string | null;
    isConflictOfInterest: boolean | null; createdAt: string; responseAttachmentsJson?: string[] | null;
  }>>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Conflict of interest detection
  const isCoi = !!(
    user && (
      (user.email && rfi.submittedByEmail && user.email.toLowerCase() === rfi.submittedByEmail.toLowerCase()) ||
      (user.companyName && rfi.submittedByCompany && user.companyName.toLowerCase() === rfi.submittedByCompany.toLowerCase())
    )
  );

  // view tracking
  const [viewEvents, setViewEvents] = useState<{ id: number; userFullName: string; userCompanyName: string; viewedAt: string }[]>([]);
  const [showViewedBy, setShowViewedBy] = useState(false);
  const [ballHistory, setBallHistory] = useState<Array<{ id: number; heldBy: string; heldByCompany: string; fromDate: string; toDate: string | null; daysHeld: number | null }>>([]);

  // Track view event on panel open, and load viewed-by list
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch((error) => logClientError("RFI view event log", error));
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/viewed-by`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: { id: number; userFullName: string; userCompanyName: string; viewedAt: string }[]) => {
        if (Array.isArray(data)) setViewEvents(data);
      })
      .catch((error) => logClientError("RFI viewed-by load", error));
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/ball-in-court-history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setBallHistory(data); })
      .catch((error) => logClientError("RFI ball-in-court history load", error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all responses for this RFI
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    setResponsesLoading(true);
    fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/responses`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((data) => { if (Array.isArray(data)) setRfiResponses(data); })
      .catch((error) => logClientError("RFI responses load", error))
      .finally(() => setResponsesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfi.id]);

  // response documents
  const [responseDocInput, setResponseDocInput] = useState("");
  const [responseDocs, setResponseDocs] = useState<string[]>([]);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [showQuestionFileSearch, setShowQuestionFileSearch] = useState(false);
  const [showAddResponse, setShowAddResponse] = useState(false);

  // ── RFI sending (manual, self-reported — no platform delivery) ───────────
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(persistedEmail.emailDraft || null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [userContext, setUserContext] = useState(persistedEmail.emailDescription || "");

  const sendPreviewText = [
    `To: ${rfi.submittedToEmail || rfi.submittedToPerson || rfi.submittedToCompany || ""}`,
    `Subject: ${rfi.number} — ${rfi.subject}`,
    ``,
    `${rfi.submittedToPerson || rfi.submittedToCompany || "Hello"},`,
    ``,
    `Please find RFI ${rfi.number} below for your review and response.`,
    rfi.dateRequired ? `Response required by: ${fmt(rfi.dateRequired)}.` : null,
    ``,
    `Subject: ${rfi.subject}`,
    `Question:`,
    `${rfi.question || rfi.description || ""}`,
    ``,
    `Submitted by ${rfi.submittedByContact || rfi.createdByName || ""}${rfi.submittedByCompany ? `, ${rfi.submittedByCompany}` : ""}.`,
  ].filter((l) => l !== null).join("\n");

  // AI-drafted email body; falls back to the static template above on failure.
  const previewText = aiPreview ?? sendPreviewText;

  const generatePreview = async () => {
    setPreviewLoading(true);
    setPreviewFailed(false);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/generate-email-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userContext: userContext.trim() || undefined }),
      });
      const data = await resp.json().catch(() => ({})) as { email?: string; error?: string };
      if (!resp.ok) throw new Error(data.error || "generate failed");
      if (!data.email || !data.email.trim()) throw new Error("empty draft");
      setAiPreview(data.email);
      toast({ title: w("Email draft created from text fields only", "Borrador de correo creado solo con campos de texto", lang) });
    } catch (error) {
      setAiPreview(null);
      setPreviewFailed(true);
      toast({ title: error instanceof Error ? error.message : w("AI draft unavailable", "Borrador IA no disponible", lang), variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleMarkSent = async () => {
    setMarking(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/mark-sent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to mark as sent");
      }
      const data = await resp.json() as Rfi;
      onUpdate(data);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI marked as sent — ball is now with the recipient", "RFI marcado como enviado — la pelota está con el destinatario", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Failed to mark as sent", "Error al marcar como enviado", lang), variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  // Does THIS user have their own SendGrid connected? Drives the real Send
  // button vs. the copy-paste + "connect" nudge.
  const [sgConnected, setSgConnected] = useState<boolean | null>(null);
  const [connectedFileSources, setConnectedFileSources] = useState<FileSourceProvider[]>([]);
  const [cloudPickerTarget, setCloudPickerTarget] = useState<null | { target: "question" | "response"; provider: FileSourceProvider }>(null);
  const [hideSgNudge, setHideSgNudge] = useState(() => localStorage.getItem("bimlog-hide-sendgrid-nudge") === "1");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`/api/v1/me/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d as { provider: string; status: string }[] : [];
        const sg = list.find(c => c.provider === "sendgrid");
        setSgConnected(!!sg && sg.status === "connected");
        setConnectedFileSources(FILE_SOURCE_PROVIDERS.filter(p => list.some(c => c.provider === p.key && c.status === "connected")));
      })
      .catch(() => setSgConnected(false));
  }, []);

  const handleSendReal = async () => {
    setSending(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const to = rfi.submittedToEmail || "";
      const cc = getRfiDistributionCcEmails((rfi.distributionList as string[] | null) || []);
      const subject = `${rfi.number} — ${rfi.subject}`;
      // Strip any leading To:/Subject: header lines so the body is clean.
      const body = previewText.replace(/^(To:.*\n|Subject:.*\n|\s*\n)+/i, "").trim();
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, body }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Send failed");
      }
      const data = await resp.json() as Rfi;
      onUpdate(data);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI sent via your SendGrid — ball is now with the recipient", "RFI enviado por tu SendGrid — la pelota está con el destinatario", lang) });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Send failed", "Error al enviar", lang), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Upload attachments from the user's computer (question + response docs).
  const qAttachFileRef = useRef<HTMLInputElement>(null);
  const rAttachFileRef = useRef<HTMLInputElement>(null);
  const editStagedFileIds = useRef(new Set<number>());
  const responseStagedFileIds = useRef(new Set<number>());
  const imageEvidenceInputRef = useRef<HTMLInputElement>(null);
  const imageReplacementInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [detailUploadResults, setDetailUploadResults] = useState<Array<{ name: string; state: "uploading" | "success" | "error"; message?: string }>>([]);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingImageQueue, setPendingImageQueue] = useState<PendingImageInput[]>([]);
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [editingPersistedImage, setEditingPersistedImage] = useState(false);
  useEffect(() => () => {
    if (capturedFrame) URL.revokeObjectURL(capturedFrame.url);
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
  }, [capturedFrame, pendingImage]);
  const uploadDoc = async (file: File, onUploaded: (uploaded: { downloadUrl: string; fileId: number; fileName: string }) => void, stagingTarget: "edit" | "response" = "edit") => {
    setUploadingDoc(true);
    setDetailUploadResults(prev => [...prev.filter(item => item.name !== file.name), { name: file.name, state: "uploading" }]);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await resp.json().catch(() => ({})) as { downloadUrl?: string; fileId?: number; fileName?: string; error?: string };
      if (!resp.ok || !data.downloadUrl || !data.fileId || !data.fileName) throw new Error(data.error || "Upload failed");
      const uploaded = data as { downloadUrl: string; fileId: number; fileName: string };
      (stagingTarget === "edit" ? editStagedFileIds : responseStagedFileIds).current.add(uploaded.fileId);
      onUploaded(uploaded);
      setDetailUploadResults(prev => prev.map(item => item.name === file.name ? { name: data.fileName || file.name, state: "success", message: w("Attached", "Adjuntado", lang) } : item));
      toast({ title: w("File uploaded and attached", "Archivo subido y adjuntado", lang) });
    } catch (error) {
      const message = error instanceof TypeError ? w("Network error while uploading the file.", "Error de red al subir el archivo.", lang) : error instanceof Error ? error.message : w("Upload failed", "Error al subir", lang);
      setDetailUploadResults(prev => prev.map(item => item.name === file.name ? { name: file.name, state: "error", message } : item));
      toast({ title: message, variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: w("Copied to clipboard", "Copiado al portapapeles", lang) });
    } catch {
      toast({ title: w("Copy failed", "Error al copiar", lang), variant: "destructive" });
    }
  };

  const [qAiLoading, setQAiLoading] = useState(false);
  const handleQuestionAi = async (extraDesc?: string) => {
    const seed = (extraDesc || infoQuestion || rfi.question || rfi.description || "").trim();
    setQAiLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const vpCode = (rfi as { sourceViewpointId?: string | null }).sourceViewpointId || undefined;
      const atts = questionEvidence.length ? questionEvidence : ((rfi.attachmentsJson as string[] | null) || undefined);
      const resp = await fetch(`/api/v1/rfis/generate-question`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          description: seed,
          subject: rfi.subject,
          viewpointCode: vpCode,
          drawingRef: rfi.drawingNumber || undefined,
          specRef: rfi.specSection || undefined,
          location: rfi.locationDescription || undefined,
          attachments: atts,
          costImpact: rfi.costImpact || undefined,
          scheduleImpact: rfi.scheduleImpact || undefined,
        }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const data = await resp.json() as { question: string };
      const q = (data.question || "").trim();
      if (q.toUpperCase().startsWith("NEED_MORE_INFO:")) {
        const ask = q.replace(/^NEED_MORE_INFO:\s*/i, "");
        const more = window.prompt(w("The AI needs a bit more to write a specific question:", "La IA necesita un poco más para escribir una pregunta específica:", lang) + "\n\n" + ask, "");
        if (more && more.trim()) {
          await handleQuestionAi(`${seed}\nCoordinator clarification (${ask}): ${more.trim()}`);
        } else {
          toast({ title: w("Add a brief description and try AI Assist again.", "Agregue una breve descripción e intente Asistencia IA de nuevo.", lang) });
        }
        return;
      }
      setInfoQuestion(q);
      toast({ title: w("AI drafted the question — review before saving", "IA redactó la pregunta — revise antes de guardar", lang) });
    } catch {
      toast({ title: w("AI assist failed", "Asistencia IA falló", lang), variant: "destructive" });
    } finally {
      setQAiLoading(false);
    }
  };

  const handleAiAssist = async () => {
    setAiAssistLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const userDraft = answer.trim();
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/generate-response`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userDraft }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const data = await resp.json() as { response: string };
      setAnswer(data.response);
      const msg = userDraft.length > 0
        ? w("AI rewrote your draft — review before saving", "IA reescribió tu borrador — revise antes de guardar", lang)
        : w("AI draft ready — review before saving", "Borrador listo — revise antes de guardar", lang);
      toast({ title: msg });
    } catch {
      toast({ title: w("AI assist failed", "Asistencia IA falló", lang), variant: "destructive" });
    } finally {
      setAiAssistLoading(false);
    }
  };

  const [, setPage] = useLocation();
  const [raisingCo, setRaisingCo] = useState(false);
  const handleRaiseChangeOrder = async () => {
    setRaisingCo(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `${rfi.number} — ${rfi.subject}`,
          description: rfi.question || rfi.description || "",
          contract_value_impact: rfi.costImpactAmount || rfi.costImpact || null,
          schedule_impact_days: rfi.scheduleImpactDays ?? null,
          linked_rfi_ids: [rfi.id],
        }),
      });
      if (!resp.ok) throw new Error("Create failed");
      toast({ title: w("Change Order raised from RFI", "Orden de Cambio creada desde RFI", lang) });
      setPage(`/projects/${projectId}/change-orders`);
    } catch {
      toast({ title: w("Could not raise Change Order", "No se pudo crear la Orden de Cambio", lang), variant: "destructive" });
    } finally {
      setRaisingCo(false);
    }
  };

  const handleExportWord = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/export-word`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("Word document exported", "Documento Word exportado", lang) });
    } catch {
      toast({ title: w("Word export failed", "Error al exportar Word", lang), variant: "destructive" });
    }
  };


  const handleDownloadAuditCert = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/audit-certificate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to generate audit certificate");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${rfi.number}-RFI-Audit-Report.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: w("Audit certificate downloaded", "Certificado de auditoría descargado", lang) });
    } catch {
      toast({ title: w("Download failed", "Descarga fallida", lang), variant: "destructive" });
    }
  };

  const handleCloseRfi = async () => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error || "Failed"); }
      const updated = await r.json() as typeof rfi;
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI closed.", "RFI cerrado.", lang) });
      onUpdate(updated);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Close failed", "Error al cerrar", lang), variant: "destructive" });
    }
  };

  const uploadImageEvidence = async (file: File, mode: "source" | "replacement", crop: NormalizedCrop | null, kind: PendingImage["kind"]) => {
    setUploadingDoc(true);
    setDetailUploadResults(prev => [...prev.filter(item => item.name !== file.name), { name: file.name, state: "uploading", message: w("Uploading confirmed image", "Subiendo imagen confirmada", lang) }]);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const fd = new FormData();
      fd.append("file", file);
      const imagePath = kind === "paste" ? "paste-image" : kind === "screen-snip" ? "screen-snip" : "upload";
      const resp = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/${imagePath}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const data = await resp.json() as { fileId: number; fileName: string; downloadUrl: string };
      editStagedFileIds.current.add(data.fileId);
      setQuestionDocs(prev => prev.includes(data.downloadUrl) ? prev : [...prev, data.downloadUrl]);
      setPackageItems(prev => {
        const sourceId = imagePresentation?.sourceFileId ?? viewpointFile?.id ?? null;
        const adjusted = mode === "replacement" && sourceId
          ? prev.map(item => item.fileId === sourceId ? { ...item, include: false } : item)
          : prev;
        return [...adjusted, { key: `file:${data.fileId}`, label: data.fileName, fileId: data.fileId, attachment: data.downloadUrl, source: "rfi-attachment", include: true, order: adjusted.length }];
      });
      setImagePresentation(prev => ({
        sourceFileId: mode === "source" ? data.fileId : prev?.sourceFileId ?? viewpointFile?.id ?? data.fileId,
        replacementFileId: mode === "replacement" ? data.fileId : prev?.replacementFileId ?? null,
        sourceKind: mode === "source" ? kind : prev?.sourceKind ?? (viewpointFile ? "viewpoint" : kind),
        replacementKind: mode === "replacement" ? kind : prev?.replacementKind ?? null,
        showInRfi: prev?.showInRfi !== false,
        includeInCompletePdf: prev?.includeInCompletePdf !== false,
        crop,
      }));
      setDetailUploadResults(prev => prev.map(item => item.name === file.name ? { name: data.fileName, state: "success", message: w("Attached", "Adjuntado", lang) } : item));
      toast({ title: mode === "replacement" ? w("Replacement image attached. Original evidence preserved.", "Imagen de reemplazo adjuntada. Evidencia original preservada.", lang) : w("Image attached.", "Imagen adjuntada.", lang) });
    } catch (error) {
      const message = error instanceof TypeError ? w("Network error while uploading the image.", "Error de red al subir la imagen.", lang) : error instanceof Error ? error.message : w("Image upload failed", "Error al subir imagen", lang);
      setDetailUploadResults(prev => prev.map(item => item.name === file.name ? { name: file.name, state: "error", message } : item));
      toast({ title: message, variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const beginPendingImage = async (file: File, mode: "source" | "replacement", kind: PendingImage["kind"]) => {
    try { await validateImageForReview(file); } catch (error) { toast({ title: error instanceof Error && error.message === "unsupported_or_empty_image" ? w("Select a supported, non-empty image.", "Seleccione una imagen compatible y no vacia.", lang) : w("The image could not be decoded.", "No se pudo decodificar la imagen.", lang), variant: "destructive" }); return; }
    setDetailUploadResults(prev => [...prev.filter(item => item.name !== file.name), { name: file.name, state: "uploading", message: w("Awaiting crop review", "Esperando revision de recorte", lang) }]);
    setPendingImageQueue(prev => [...prev, { file, mode, kind }]);
  };

  useEffect(() => {
    if (pendingImage || pendingImageQueue.length === 0) return;
    const [next, ...rest] = pendingImageQueue;
    setPendingImageQueue(rest);
    setPendingImage({ ...next, url: URL.createObjectURL(next.file) });
  }, [pendingImage, pendingImageQueue]);

  const pasteImageEvidence = async () => {
    if (!navigator.clipboard?.read) {
      toast({ title: w("Clipboard image access is unavailable in this browser.", "El acceso a imagenes del portapapeles no esta disponible en este navegador.", lang), variant: "destructive" });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await beginPendingImage(new File([blob], `clipboard-rfi-${rfi.id}.png`, { type }), "replacement", "paste");
          return;
        }
      }
      toast({ title: w("Clipboard does not contain an image.", "El portapapeles no contiene una imagen.", lang), variant: "destructive" });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      toast({ title: denied ? w("Clipboard image access was denied.", "Se denego el acceso a imagenes del portapapeles.", lang) : w("The clipboard image could not be read.", "No se pudo leer la imagen del portapapeles.", lang), variant: "destructive" });
    }
  };

  const captureScreenImage = async () => {
    try {
      const frame=await acquireCapturedFrame(`screen-snip-rfi-${rfi.id}.png`);
      setCapturedFrame(prev=>{if(prev)URL.revokeObjectURL(prev.url);return frame;});
    } catch (error) {
      const code=error instanceof Error?error.message:"capture_failed";const messages:Record<string,string>={capture_api_unavailable:w("Screen Capture API is unavailable.","La API de captura de pantalla no esta disponible.",lang),capture_cancelled_or_denied:w("Screen capture was cancelled or permission was denied.","La captura fue cancelada o el permiso fue denegado.",lang),capture_source_ended:w("The selected capture source ended before a frame was captured.","La fuente seleccionada termino antes de capturar un fotograma.",lang),empty_capture_frame:w("The selected source returned an empty frame.","La fuente seleccionada devolvio un fotograma vacio.",lang),capture_canvas_failed:w("The captured frame could not be converted.","No se pudo convertir el fotograma capturado.",lang)};toast({title:messages[code]||w("Screen capture failed.","Fallo la captura de pantalla.",lang),variant:"destructive"});
    }
  };

  const handleReopenRfi = async () => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})) as { error?: string }; throw new Error(d.error || "Failed"); }
      const updated = await r.json() as typeof rfi;
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      toast({ title: w("RFI reopened.", "RFI reabierto.", lang) });
      onUpdate(updated);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Reopen failed", "Error al reabrir", lang), variant: "destructive" });
    }
  };

  const allStatusOptions = [...new Map(getOptions("rfi_status").map(o => [o.value, o])).values()];
  // Only project_admin can close an RFI
  const currentMember = members.find(m => m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase());
  const isProjectAdmin = currentMember?.role === "project_admin" || Boolean((user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin);
  const statusOptions = isProjectAdmin
    ? allStatusOptions
    : allStatusOptions.filter(o => o.value !== "closed");

  const { mutate: updateRfi, isPending: isUpdating } = useUpdateRfi({
    mutation: {
      onSuccess: (updated) => {
        editStagedFileIds.current.clear();
        setInfoEdit(false);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w("RFI updated", "RFI actualizado", lang) });
        onUpdate(updated);
      },
      onError: () => toast({ title: w("Update failed", "Actualización falló", lang), variant: "destructive" }),
    },
  });

  const { mutate: reviseRfi, isPending: isRevising } = useReviseRfi({
    mutation: {
      onSuccess: (revised) => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
        toast({ title: w("Revision created", "Revision creada", lang) });
        onRevise(revised);
      },
      onError: () => toast({ title: w("Revision failed", "Error al crear revision", lang), variant: "destructive" }),
    },
  });

  const bic = getBallInCourt(rfi);
  const due = rfi.dateRequired || rfi.dueDate;
  const isOverdue = rfi.status !== "closed" && due ? new Date(due) < new Date() : false;
  const days = differenceInDays(new Date(), new Date(rfi.createdAt));
  // The response form is open (drafting an answer). The single Save Response
  // action for it lives at the very bottom of the page, below the email.
  const responseFormOpen = canWrite && rfi.status !== "closed" && ((rfiResponses.length === 0 && !rfi.answer && !rfi.response) || showAddResponse);
  // The single impact block shows what the asker flagged plus what the latest response confirmed.
  const confirmedCost = [...rfiResponses].reverse().find(r => r.costImpact);
  const confirmedSched = [...rfiResponses].reverse().find(r => r.scheduleImpact);
  const responseCostReasonRequired = costImpact === "Cost Increase TBD" || costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const responseCostAmountRequired = costImpact === "Cost Increase Known" || costImpact === "Cost Decrease";
  const responseScheduleDaysRequired = schedImpact === "Increase in Calendar Days" || schedImpact === "Decrease in Calendar Days";
  const infoCostReasonRequired = infoCost === "Cost Increase TBD" || infoCost === "Cost Increase Known" || infoCost === "Cost Decrease";
  const infoCostAmountRequired = infoCost === "Cost Increase Known" || infoCost === "Cost Decrease";
  const infoScheduleDaysRequired = infoSched === "Increase in Calendar Days" || infoSched === "Decrease in Calendar Days";
  const lifecycleRfi = rfi as Rfi & { closedAt?: string | null; reopenedAt?: string | null };
  const timeline = [
    { label: w("Created", "Creado", lang), date: rfi.createdAt as string | Date | null, by: rfi.createdByName || undefined },
    ...(rfi.sentAt ? [{ label: w("Sent to reviewer", "Enviado al revisor", lang), date: rfi.sentAt as string | Date | null, by: undefined as string | undefined }] : []),
    ...rfiResponses.map(r => ({ label: w("Response", "Respuesta", lang), date: r.createdAt as string | Date | null, by: r.answeredBy || undefined })),
    ...(rfi.dateAnswered ? [{ label: w("Answered", "Respondido", lang), date: rfi.dateAnswered as string | Date | null, by: undefined as string | undefined }] : []),
    ...(lifecycleRfi.closedAt ? [{ label: w("Closed", "Cerrado", lang), date: lifecycleRfi.closedAt as string | Date | null, by: undefined as string | undefined }] : []),
    ...(lifecycleRfi.reopenedAt ? [{ label: w("Reopened", "Reabierto", lang), date: lifecycleRfi.reopenedAt as string | Date | null, by: undefined as string | undefined }] : []),
  ].filter(e => !!e.date).sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());

  const handleSaveResponse = async () => {
    if (!answer.trim()) {
      toast({ title: w("Official response text is required.", "Se requiere texto de respuesta oficial.", lang), variant: "destructive" });
      return;
    }
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/${rfi.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          responseText: answer,
          answeredBy: answeredBy || undefined,
          costImpact: costImpact || undefined,
          costImpactAmount: responseCostAmountRequired ? costAmount : undefined,
          costImpactReason: responseCostReasonRequired ? costReason : undefined,
          scheduleImpact: schedImpact || undefined,
          scheduleImpactDays: responseScheduleDaysRequired && schedDays ? parseInt(schedDays) : undefined,
          scheduleImpactReason: responseScheduleDaysRequired ? schedReason : undefined,
          closingStatus,
          responseAttachmentsJson: responseDocs.length > 0 ? responseDocs : [],
        }),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error || "Failed"); }
      const newResp = await r.json() as typeof rfiResponses[0] & { rfi?: Rfi };
      setRfiResponses(prev => [...prev, newResp]);
      responseStagedFileIds.current.clear();
      setResponseDocs([]);
      setResponseDocInput("");
      setShowAddResponse(false);
      if (newResp.isConflictOfInterest) {
        toast({ title: w("Conflict of interest flagged in audit trail.", "Conflicto de interés marcado en la auditoría.", lang), variant: "destructive" });
      } else {
        toast({ title: w("Response saved.", "Respuesta guardada.", lang) });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/rfis`] });
      if (newResp.rfi) onUpdate(newResp.rfi);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : w("Save failed", "Error al guardar", lang), variant: "destructive" });
    }
  };

  const savedRfiActions = getSavedRfiActionMatrix({
    rfi,
    canWrite,
    isProjectAdmin,
    hasViewpoint: !!(rfi as { sourceViewpointId?: string | null }).sourceViewpointId,
    isEditing: infoEdit,
    lang,
  });

  const wasPersistentlyReopened = !!lifecycleRfi.reopenedAt
    && (!lifecycleRfi.closedAt || new Date(lifecycleRfi.reopenedAt).getTime() > new Date(lifecycleRfi.closedAt).getTime());
  const recordState: RfiRecordState = rfi.status === "closed"
    ? "closed"
    : wasPersistentlyReopened
      ? "reopened"
    : rfi.revisionNumber && rfi.revisionNumber > 0
      ? "revised"
      : rfi.sendStatus === "sent" || rfi.sentAt
        ? "sent"
        : "draft";
  const detailPermissions: RfiCanonicalPermissions = {
    canEdit: canWrite,
    canRespond: responseFormOpen,
    canClose: isProjectAdmin && rfi.status !== "closed",
    canReopen: canWrite && rfi.status === "closed",
    canExport: true,
    canRaiseChangeOrder: canWrite,
    canJumpViewpoint: !!(rfi as { sourceViewpointId?: string | null }).sourceViewpointId,
  };
  const removeEditStagedFile = async (fileId: number): Promise<boolean> => {
    if (!editStagedFileIds.current.has(fileId)) return true;
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    const response = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/staged/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      toast({ title: data.error || w("Staged upload could not be removed.", "No se pudo quitar el archivo temporal.", lang), variant: "destructive" });
      return false;
    }
    editStagedFileIds.current.delete(fileId);
    return true;
  };
  const cancelInfoEdit = async () => {
    const results = await Promise.all([...editStagedFileIds.current].map(removeEditStagedFile));
    if (results.some(result => !result)) {
      toast({ title: w("Cancel is incomplete. The RFI remains in edit mode until staged files are removed.", "La cancelacion esta incompleta. El RFI permanece en edicion hasta quitar los archivos temporales.", lang), variant: "destructive" });
      return;
    }
    setPendingImageQueue([]);
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage(null);
    if (capturedFrame) URL.revokeObjectURL(capturedFrame.url);
    setCapturedFrame(null);
    startInfoEdit();
    setInfoEdit(false);
  };
  const saveCanonicalRfi = () => {
    updateRfi({
      projectId,
      rfiId: rfi.id,
      data: {
        subject: infoSubject,
        priority: infoPriority,
        rfiType: infoType,
        drawingNumber: infoDrawingNumber,
        drawingTitle: infoDrawingTitle,
        specSection: infoSpecSection,
        detailNumber: infoDetailNumber,
        noteNumber: infoNoteNumber,
        locationDescription: infoLocationDescription,
        sourceViewpointLabel: infoVpLabel,
        dateRequired: infoDateRequired ? new Date(infoDateRequired).toISOString() : "",
        projectAddress: infoProjectAddress,
        question: infoQuestion,
        costImpact: infoCost,
        costImpactAmount: infoCostAmountRequired ? infoCostAmt : null,
        costImpactReason: infoCostReasonRequired ? infoCostReason : null,
        scheduleImpact: infoSched,
        scheduleImpactDays: infoScheduleDaysRequired && infoSchedDays.trim() && !Number.isNaN(Number(infoSchedDays)) ? Number(infoSchedDays) : null,
        scheduleImpactReason: infoScheduleDaysRequired ? infoSchedReason : null,
        distributionList: infoDist,
        submittedByCompany: infoFromCompany,
        submittedByContact: infoFromContact,
        submittedByAddress: infoFromAddress,
        submittedByPhone: infoFromPhone,
        submittedByEmail: infoFromEmail,
        submittedToCompany: infoToCompany,
        submittedToPerson: infoToPerson,
        submittedToEmail: infoToEmail,
        emailDescription: userContext,
        emailDraft: previewText,
        attachmentsJson: [...questionReferences, ...questionDocs],
        attachmentPackageJson: packageItems,
        imagePresentationJson: imagePresentation,
      },
    });
  };
  const handleCanonicalDetailChange = (field: keyof RfiCanonicalValues, value: string) => {
    switch (field) {
      case "subject": setInfoSubject(value); break;
      case "priority": setInfoPriority(value); break;
      case "rfiType": setInfoType(value); break;
      case "dateRequired": setInfoDateRequired(value); break;
      case "projectAddress": setInfoProjectAddress(value); break;
      case "submittedByCompany": setInfoFromCompany(value); break;
      case "submittedByContact": setInfoFromContact(value); break;
      case "submittedByAddress": setInfoFromAddress(value); break;
      case "submittedByPhone": setInfoFromPhone(value); break;
      case "submittedByEmail": setInfoFromEmail(value); break;
      case "submittedToCompany": setInfoToCompany(value); break;
      case "submittedToPerson": setInfoToPerson(value); break;
      case "submittedToEmail": setInfoToEmail(value); break;
      case "drawingNumber": setInfoDrawingNumber(value); break;
      case "drawingTitle": setInfoDrawingTitle(value); break;
      case "specSection": setInfoSpecSection(value); break;
      case "detailNumber": setInfoDetailNumber(value); break;
      case "noteNumber": setInfoNoteNumber(value); break;
      case "locationDescription": setInfoLocationDescription(value); break;
      case "referenceInput": setQuestionDocInput(value); break;
      case "question": setInfoQuestion(value); break;
      case "questionAssistDescription": setQuestionAiDescription(value); break;
      case "costImpact":
        setInfoCost(value);
        if (value !== "Cost Increase Known" && value !== "Cost Decrease") setInfoCostAmt("");
        if (value !== "Cost Increase TBD" && value !== "Cost Increase Known" && value !== "Cost Decrease") setInfoCostReason("");
        break;
      case "costImpactAmount": setInfoCostAmt(value); break;
      case "costImpactReason": setInfoCostReason(value); break;
      case "scheduleImpact":
        setInfoSched(value);
        if (value !== "Increase in Calendar Days" && value !== "Decrease in Calendar Days") { setInfoSchedDays(""); setInfoSchedReason(""); }
        break;
      case "scheduleImpactDays": setInfoSchedDays(value.replace(/[^0-9]/g, "")); break;
      case "scheduleImpactReason": setInfoSchedReason(value); break;
      case "distributionList": setInfoDist(value.split(",").map(v => v.trim()).filter(Boolean)); break;
      case "responseText": setAnswer(value); break;
      case "emailDescription": setUserContext(value); break;
      default: break;
    }
  };

  const movePackageItem = (key: string, direction: -1 | 1) => {
    setPackageItems(prev => {
      const ordered = [...prev].sort((a, b) => a.order - b.order);
      const presentationIds = new Set([imagePresentation?.sourceFileId, imagePresentation?.replacementFileId]
        .filter((id): id is number => typeof id === "number"));
      const visible = ordered.filter(item => !item.fileId || !presentationIds.has(item.fileId));
      const index = visible.findIndex(item => item.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= visible.length) return prev;
      const left = ordered.findIndex(item => item.key === visible[index].key);
      const right = ordered.findIndex(item => item.key === visible[target].key);
      [ordered[left], ordered[right]] = [ordered[right], ordered[left]];
      return ordered.map((item, order) => ({ ...item, order }));
    });
  };

  const statusContent = (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}>
        <strong>{w("Current ball in court", "Responsable actual", lang)}:</strong>{" "}
        <span style={{ color: bic?.color }}>{bic?.label || w("Closed - no active custody", "Cerrado - sin custodia activa", lang)}</span>
        {isOverdue && <span style={{ marginLeft: 8, color: "#DC2626", fontWeight: 700 }}>{w("Overdue", "Vencido", lang)}</span>}
      </div>
      {showViewedBy && <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}><strong>{w("Viewed By", "Visto Por", lang)}</strong><div style={{ marginTop: 6 }}>{viewEvents.length ? viewEvents.map(v => `${v.userFullName || v.userCompanyName} (${fmt(v.viewedAt)})`).join(", ") : w("No view events recorded.", "No hay vistas registradas.", lang)}</div></div>}
      <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 7 }}>{w("Ball-in-Court History", "Historial de Responsable", lang)}</div>{ballHistory.length ? ballHistory.map(row => <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr auto", gap: 8, fontSize: 11, padding: "4px 0", borderTop: "1px solid hsl(var(--border) / 0.5)" }}><span><strong>{row.heldBy}</strong>{row.heldByCompany ? ` - ${row.heldByCompany}` : ""}</span><span>{fmt(row.fromDate)} - {row.toDate ? fmt(row.toDate) : w("Current", "Actual", lang)}</span><span>{row.toDate ? `${row.daysHeld ?? differenceInDays(new Date(row.toDate), new Date(row.fromDate))} ${w("days", "dias", lang)}` : w("Open", "Abierto", lang)}</span></div>) : <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{rfi.sendStatus === "sent" ? w("No custody rows have been logged yet.", "Aun no hay filas de custodia registradas.", lang) : w("Not sent yet. The author holds the RFI until it is sent.", "Aun no enviado. El autor conserva el RFI hasta enviarlo.", lang)}</div>}</div>
      {timeline.length > 0 && <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: 7 }}>{w("Activity", "Actividad", lang)}</div>{timeline.map((event, index) => <div key={`${event.label}-${index}`} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0" }}><strong>{event.label}</strong>{event.by && <span>{event.by}</span>}<span style={{ marginLeft: "auto", color: "hsl(var(--muted-foreground))" }}>{fmt(event.date)}</span></div>)}</div>}
    </div>
  );

  const directoryPicker = (target: "from" | "to") => infoEdit && detailContacts.length > 0 ? (
    <div style={{ marginTop: 8 }}><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Choose from project directory", "Elegir del directorio del proyecto", lang)}</label><select value="" onChange={e => { const contact = detailContacts.find(item => item.email === e.target.value); if (!contact) return; if (target === "from") { setInfoFromContact(contact.fullName); setInfoFromCompany(contact.companyName || ""); setInfoFromEmail(contact.email); } else { setInfoToPerson(contact.fullName); setInfoToCompany(contact.companyName || ""); setInfoToEmail(contact.email); } }} style={{ width: "100%", height: 36, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--background))", padding: "0 8px", fontSize: 12 }}><option value="">{w("Select a contact...", "Seleccione un contacto...", lang)}</option>{detailContacts.map(contact => <option key={`${target}-${contact.email}`} value={contact.email}>{contact.fullName}{contact.companyName ? ` - ${contact.companyName}` : ""}</option>)}</select></div>
  ) : null;

  const referenceContent = (
    <>
      {infoEdit && <div style={{ position: "relative", marginTop: 8 }}><Button type="button" size="sm" variant="outline" onClick={() => setShowQuestionFileSearch(!showQuestionFileSearch)} style={{ gap: 5 }}><Search style={{ width: 12, height: 12 }} />{w("Select Project File", "Seleccionar Archivo del Proyecto", lang)}</Button>{showQuestionFileSearch && <FileSearchDropdown files={files || []} onSelect={file => { const locator = canonicalFileLocator(projectId, file.id); setQuestionDocs(prev => prev.includes(locator) ? prev : [...prev, locator]); setShowQuestionFileSearch(false); }} onClose={() => setShowQuestionFileSearch(false)} />}</div>}
      <LinkedItemsPanel projectId={projectId} entityType="rfi" entityId={rfi.id} canWrite={canWrite} />
    </>
  );

  const removeResponseDraftAttachment = async (index: number) => {
    const value = responseDocs[index];
    const fileId = fileIdFromAttachment(value);
    if (fileId && responseStagedFileIds.current.has(fileId)) {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const response = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/staged/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { toast({ title: data.error || w("Response upload could not be removed.", "No se pudo quitar el archivo de respuesta.", lang), variant: "destructive" }); return; }
      responseStagedFileIds.current.delete(fileId);
    }
    setResponseDocs(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const impactContent = (confirmedCost?.costImpact || confirmedSched?.scheduleImpact) ? <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 12, color: "#166534" }}>{confirmedCost?.costImpact && <div><strong>{w("Latest confirmed cost impact", "Ultimo impacto de costo confirmado", lang)}:</strong> {confirmedCost.costImpact}{confirmedCost.costImpactAmount ? ` (${confirmedCost.costImpactAmount})` : ""}{confirmedCost.costImpactReason ? ` - ${confirmedCost.costImpactReason}` : ""}</div>}{confirmedSched?.scheduleImpact && <div><strong>{w("Latest confirmed schedule impact", "Ultimo impacto de programa confirmado", lang)}:</strong> {confirmedSched.scheduleImpact}{confirmedSched.scheduleImpactDays != null ? ` (${confirmedSched.scheduleImpactDays}d)` : ""}{confirmedSched.scheduleImpactReason ? ` - ${confirmedSched.scheduleImpactReason}` : ""}</div>}</div> : null;

  const openNewResponse = () => {
    setAnswer("");
    setAnsweredBy(user?.fullName || "");
    setClosingStatus(configuredRespondedStatus);
    setCostImpact("No Cost Impact");
    setCostAmount("");
    setCostReason("");
    setSchedImpact("No Schedule Impact");
    setSchedDays("");
    setSchedReason("");
    setResponseDocInput("");
    setResponseDocs([]);
    setShowAddResponse(true);
  };

  const responseContent = (
    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
      <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>{w("Issue and email actions", "Acciones de envio y email", lang)}</strong>{canWrite && rfi.status !== "closed" && sgConnected === true && <Button type="button" size="sm" onClick={handleSendReal} disabled={sending || !rfi.submittedToEmail} title={!rfi.submittedToEmail ? w("Set the Submitted To email first", "Defina el correo del destinatario primero", lang) : undefined}>{sending ? w("Sending...", "Enviando...", lang) : w("Send via SendGrid", "Enviar por SendGrid", lang)}</Button>}{canWrite && rfi.status !== "closed" && rfi.sendStatus !== "sent" && <Button type="button" size="sm" variant="outline" onClick={handleMarkSent} disabled={marking}>{marking ? w("Saving...", "Guardando...", lang) : w("Mark as Sent", "Marcar como Enviado", lang)}</Button>}{sgConnected === false && <Button type="button" size="sm" variant="outline" onClick={() => setPage("/profile")}>{w("Set Up Email Sending", "Configurar Envio de Email", lang)}</Button>}</div>{sgConnected === false && !hideSgNudge && <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, padding: "8px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 11 }}><span style={{ flex: 1 }}>{w("Connect your own SendGrid account to send RFIs directly. Mark as Sent remains available for delivery outside BIMLog.", "Conecte su propia cuenta SendGrid para enviar RFIs directamente. Marcar como Enviado sigue disponible para envios fuera de BIMLog.", lang)}</span><button type="button" title={w("Don't remind me", "No recordarme", lang)} onClick={() => { localStorage.setItem("bimlog-hide-sendgrid-nudge", "1"); setHideSgNudge(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X style={{ width: 14, height: 14 }} /></button></div>}{previewFailed && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 6 }}>{w("AI email draft was unavailable. The standard editable draft remains available.", "El borrador IA no estuvo disponible. El borrador estandar editable sigue disponible.", lang)}</p>}</div>
      {responsesLoading && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("Loading responses...", "Cargando respuestas...", lang)}</div>}
      {!responsesLoading && rfiResponses.length === 0 && (rfi.answer || rfi.response) && <div style={{ padding: "10px 12px", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 12 }}><strong>{w("Existing official response", "Respuesta oficial existente", lang)}</strong><p style={{ whiteSpace: "pre-wrap", marginTop: 5 }}>{rfi.answer || rfi.response}</p>{rfi.answeredBy && <div>{w("Answered By", "Respondido Por", lang)}: {rfi.answeredBy}</div>}</div>}
      {canWrite && rfi.status !== "closed" && !responseFormOpen && <Button type="button" variant="outline" onClick={openNewResponse} style={{ justifySelf: "start", gap: 5 }}><Plus style={{ width: 13, height: 13 }} />{w("Add Response", "Agregar Respuesta", lang)}</Button>}
      {responseFormOpen && <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
        {isCoi && <div style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #FCA5A5", borderRadius: 6, color: "#991B1B", fontSize: 11 }}>{w("Conflict-of-interest warning: you are responding from the submitting person or company. This will be recorded in the audit trail.", "Advertencia de conflicto de interes: responde desde la persona o empresa remitente. Se registrara en la auditoria.", lang)}</div>}
        <CanonicalField label={w("Official Response", "Respuesta Oficial", lang)} value={answer} editable onChange={setAnswer} full multiline />
        <Button type="button" size="sm" variant="outline" onClick={handleAiAssist} disabled={aiAssistLoading} style={{ marginTop: 8, gap: 5 }}><Sparkles style={{ width: 12, height: 12 }} />{aiAssistLoading ? w("Generating...", "Generando...", lang) : w("AI Assist Response", "Asistencia IA de Respuesta", lang)}</Button>
        <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 5 }}>{w("Text assist uses AI credits. It does not read response attachments.", "La asistencia de texto usa creditos IA. No lee los adjuntos de respuesta.", lang)}</p>
        <FormGrid><CanonicalField label={w("Answered By", "Respondido Por", lang)} value={answeredBy} editable onChange={setAnsweredBy} /><CanonicalField label={w("Closing Status", "Estado al Guardar", lang)} value={closingStatus} editable onChange={setClosingStatus} options={statusOptions.map(option => ({ value: option.value, label: lang === "es" ? option.labelEs : option.label }))} /></FormGrid>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}><div><CanonicalField label={w("Cost Impact", "Impacto en Costo", lang)} value={costImpact} editable onChange={value => { setCostImpact(value); if (value !== "Cost Increase Known" && value !== "Cost Decrease") setCostAmount(""); if (value !== "Cost Increase TBD" && value !== "Cost Increase Known" && value !== "Cost Decrease") setCostReason(""); }} options={[{ value: "No Cost Impact", label: w("No Cost Impact", "Sin Impacto en Costo", lang) }, { value: "Cost Increase TBD", label: w("Cost Increase TBD", "Aumento por Definir", lang) }, { value: "Cost Increase Known", label: w("Cost Increase Known", "Aumento Conocido", lang) }, { value: "Cost Decrease", label: w("Cost Decrease", "Disminucion", lang) }]} />{responseCostAmountRequired && <CanonicalField label={w("Cost Amount", "Monto de Costo", lang)} value={costAmount} editable onChange={setCostAmount} />}{responseCostReasonRequired && <CanonicalField label={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} value={costReason} editable onChange={setCostReason} multiline />}</div><div><CanonicalField label={w("Schedule Impact", "Impacto en Programa", lang)} value={schedImpact} editable onChange={value => { setSchedImpact(value); if (value !== "Increase in Calendar Days" && value !== "Decrease in Calendar Days") { setSchedDays(""); setSchedReason(""); } }} options={[{ value: "No Schedule Impact", label: w("No Schedule Impact", "Sin Impacto en Programa", lang) }, { value: "Increase in Calendar Days", label: w("Increase in Calendar Days", "Aumento en Dias Calendario", lang) }, { value: "Decrease in Calendar Days", label: w("Decrease in Calendar Days", "Disminucion en Dias Calendario", lang) }]} />{responseScheduleDaysRequired && <CanonicalField label={w("Calendar Days", "Dias Calendario", lang)} value={schedDays} editable onChange={value => setSchedDays(value.replace(/[^0-9]/g, ""))} />}{responseScheduleDaysRequired && <CanonicalField label={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} value={schedReason} editable onChange={setSchedReason} multiline />}</div></div>
        <div style={{ marginTop: 10 }}><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{w("Response Attachments", "Adjuntos de Respuesta", lang)}</label><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Input value={responseDocInput} onChange={e => setResponseDocInput(e.target.value)} placeholder={w("Reference or HTTP/HTTPS URL", "Referencia o URL HTTP/HTTPS", lang)} style={{ flex: "1 1 240px", fontSize: 12 }} /><Button type="button" size="sm" variant="outline" onClick={() => { const normalized = normalizeManualReference(responseDocInput); if (!normalized.value) { toast({ title: normalized.error || w("Invalid reference", "Referencia no valida", lang), variant: "destructive" }); return; } setResponseDocs(prev => prev.includes(normalized.value!) ? prev : [...prev, normalized.value!]); setResponseDocInput(""); }}>{w("Add Reference", "Agregar Referencia", lang)}</Button><Button type="button" size="sm" variant="outline" disabled={uploadingDoc} onClick={() => rAttachFileRef.current?.click()}>{uploadingDoc ? w("Uploading...", "Subiendo...", lang) : w("Upload Response File", "Subir Archivo de Respuesta", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowFileSearch(!showFileSearch)}>{w("Select Project File", "Seleccionar Archivo del Proyecto", lang)}</Button>{connectedFileSources.map(provider => <Button key={`response-${provider.key}`} type="button" size="sm" variant="outline" onClick={() => setCloudPickerTarget({ target: "response", provider })}>{w(`From ${provider.label}`, `Desde ${provider.label}`, lang)}</Button>)}</div>{showFileSearch && <div style={{ position: "relative" }}><FileSearchDropdown files={files || []} onSelect={file => { const locator = canonicalFileLocator(projectId, file.id); setResponseDocs(prev => prev.includes(locator) ? prev : [...prev, locator]); setShowFileSearch(false); }} onClose={() => setShowFileSearch(false)} /></div>}{responseDocs.map((doc, index) => <div key={`${doc}-${index}`} style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 5, fontSize: 12 }}><FileText style={{ width: 12, height: 12 }} />{isOpenableAttachment(doc) ? <button type="button" onClick={() => { void openRfiAttachment(doc).catch(error => toast({ title: error instanceof Error ? error.message : w("Attachment could not be opened", "No se pudo abrir el adjunto", lang), variant: "destructive" })); }} style={{ flex: 1, padding: 0, border: 0, background: "transparent", color: "#1D4ED8", textAlign: "left", cursor: "pointer", fontSize: 12 }}>{attachmentLabelFromFiles(doc, files || [])}</button> : <span style={{ flex: 1 }}>{doc}</span>}<Button type="button" size="sm" variant="outline" onClick={() => { void removeResponseDraftAttachment(index); }} style={{ color: "#DC2626", borderColor: "#FCA5A5" }}>{w("Remove", "Quitar", lang)}</Button></div>)}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 12, paddingTop: 12, borderTop: "1px solid hsl(var(--border))" }}>{(rfiResponses.length > 0 || rfi.answer || rfi.response) && <Button type="button" size="sm" variant="outline" onClick={() => setShowAddResponse(false)}>{w("Cancel Response", "Cancelar Respuesta", lang)}</Button>}<Button type="button" size="sm" onClick={handleSaveResponse} disabled={isUpdating}>{isUpdating ? w("Saving...", "Guardando...", lang) : w("Save Response", "Guardar Respuesta", lang)}</Button></div>
      </div>}
    </div>
  );

  return (
    <>
      <RfiCanonicalForm
        lang={lang}
        mode={infoEdit ? "edit" : "view"}
        recordState={recordState}
        values={{
          number: rfi.number,
          subject: infoEdit ? infoSubject : rfi.subject,
          status: rfi.status,
          priority: infoEdit ? infoPriority : (rfi.priority || "medium"),
          rfiType: infoEdit ? infoType : (rfi.rfiType || ""),
          dateRequested: rfi.dateRequested ? format(parseISO(String(rfi.dateRequested)), "yyyy-MM-dd") : (rfi.createdAt ? format(parseISO(String(rfi.createdAt)), "yyyy-MM-dd") : ""),
          dateRequired: infoEdit ? infoDateRequired : (rfi.dateRequired ? format(parseISO(String(rfi.dateRequired)), "yyyy-MM-dd") : (rfi.dueDate ? format(parseISO(String(rfi.dueDate)), "yyyy-MM-dd") : "")),
          projectAddress: infoEdit ? infoProjectAddress : (rfi.projectAddress || ""),
          daysOutstanding: `${days}d`,
          dateAnswered: fmt(rfi.dateAnswered || rfi.respondedAt),
          submittedByCompany: infoEdit ? infoFromCompany : (rfi.submittedByCompany || ""),
          submittedByContact: infoEdit ? infoFromContact : (rfi.submittedByContact || rfi.createdByName || ""),
          submittedByAddress: infoEdit ? infoFromAddress : (rfi.submittedByAddress || ""),
          submittedByPhone: infoEdit ? infoFromPhone : (rfi.submittedByPhone || ""),
          submittedByEmail: infoEdit ? infoFromEmail : (rfi.submittedByEmail || ""),
          submittedToCompany: infoEdit ? infoToCompany : (rfi.submittedToCompany || ""),
          submittedToPerson: infoEdit ? infoToPerson : (rfi.submittedToPerson || ""),
          submittedToEmail: infoEdit ? infoToEmail : (rfi.submittedToEmail || ""),
          drawingNumber: infoEdit ? infoDrawingNumber : (rfi.drawingNumber || ""),
          drawingTitle: infoEdit ? infoDrawingTitle : (rfi.drawingTitle || ""),
          specSection: infoEdit ? infoSpecSection : (rfi.specSection || ""),
          detailNumber: infoEdit ? infoDetailNumber : (rfi.detailNumber || ""),
          noteNumber: infoEdit ? infoNoteNumber : (rfi.noteNumber || ""),
          locationDescription: infoEdit ? infoLocationDescription : (rfi.locationDescription || ""),
          referenceInput: questionDocInput,
          question: infoEdit ? infoQuestion : (rfi.question || rfi.description || ""),
          costImpact: infoEdit ? infoCost : (rfi.costImpact || "No Cost Impact"),
          costImpactAmount: infoEdit ? infoCostAmt : (rfi.costImpactAmount || ""),
          costImpactReason: infoEdit ? infoCostReason : ((rfi as Rfi & { costImpactReason?: string }).costImpactReason || ""),
          scheduleImpact: infoEdit ? infoSched : (rfi.scheduleImpact || "No Schedule Impact"),
          scheduleImpactDays: infoEdit ? infoSchedDays : (rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : ""),
          scheduleImpactReason: infoEdit ? infoSchedReason : ((rfi as Rfi & { scheduleImpactReason?: string }).scheduleImpactReason || ""),
          distributionList: infoEdit ? infoDist : ((rfi.distributionList as string[] | null) || []),
          emailDescription: userContext,
          emailDraft: previewText,
          questionAssistDescription: questionAiDescription,
          responseText: answer,
        }}
        permissions={detailPermissions}
        references={questionReferences}
        attachments={questionDocs}
        attachmentFiles={files || []}
        uploadResults={detailUploadResults}
        imagePresentation={imagePresentation}
        packageItems={packageItems}
        responses={rfiResponses.map(resp => ({ id: resp.id, text: resp.responseText, by: resp.answeredBy || undefined, date: resp.createdAt, attachments: resp.responseAttachmentsJson || undefined }))}
        loading={{ saving: isUpdating, uploading: uploadingDoc, questionAi: qAiLoading, emailAi: previewLoading, response: isUpdating }}
        options={{ priorities: priorityOptions, rfiTypes: rfiTypeOptions }}
        cloudAttachmentActions={infoEdit ? connectedFileSources.map(provider => ({ key: provider.key, label: w(`From ${provider.label}`, `Desde ${provider.label}`, lang), icon: "cloud" as const, onClick: () => setCloudPickerTarget({ target: "question", provider }) })) : []}
        imageAttachmentActions={infoEdit ? [
          { key: "upload-image", label: w("Upload Image", "Subir Imagen", lang), icon: "upload", onClick: () => imageEvidenceInputRef.current?.click() },
          { key: "replace-image", label: w("Replace Image", "Reemplazar Imagen", lang), icon: "replace", onClick: () => imageReplacementInputRef.current?.click() },
          { key: "paste-image", label: w("Paste Image", "Pegar Imagen", lang), icon: "paste", onClick: pasteImageEvidence },
          { key: "capture-screen", label: w("Capture Screen", "Capturar Pantalla", lang), icon: "capture", onClick: captureScreenImage },
        ] : []}
        imagePresentationContent={(imagePresentation || viewpointFile) ? <RfiImagePresentationControls lang={lang} imageUrl={activeImageUrl} label={w(imagePresentation?.replacementFileId ? "Replacement image" : imagePresentation?.sourceKind === "screen-snip" ? "Screen snip" : imagePresentation?.sourceKind === "paste" ? "Pasted image" : imagePresentation?.sourceKind === "upload" || !viewpointFile ? "Uploaded image" : "Original viewpoint image", imagePresentation?.replacementFileId ? "Imagen de reemplazo" : imagePresentation?.sourceKind === "screen-snip" ? "Recorte de pantalla" : imagePresentation?.sourceKind === "paste" ? "Imagen pegada" : imagePresentation?.sourceKind === "upload" || !viewpointFile ? "Imagen subida" : "Imagen original del punto de vista", lang)} crop={imagePresentation?.crop || null} showInRfi={imagePresentation?.showInRfi !== false} includeInCompletePdf={imagePresentation?.includeInCompletePdf !== false} editable={infoEdit} canRestore={!!imagePresentation?.replacementFileId && !!(imagePresentation?.sourceFileId || viewpointFile?.id)} onCrop={() => setEditingPersistedImage(true)} onFullImage={() => setImagePresentation(prev => prev ? { ...prev, crop: null } : prev)} onShowChange={showInRfi => setImagePresentation(prev => prev ? { ...prev, showInRfi } : prev)} onPdfChange={includeInCompletePdf => setImagePresentation(prev => prev ? { ...prev, includeInCompletePdf } : prev)} onRestore={() => setImagePresentation(prev => prev ? { ...prev, replacementFileId: null, replacementKind: null, crop: null, sourceFileId: prev.sourceFileId ?? viewpointFile?.id, sourceKind: prev.sourceKind ?? "viewpoint" } : prev)} /> : null}
        actions={{
          back: onClose,
          "export-pdf": () => onExportPdf(rfi),
          "export-complete-pdf": () => onExportCompletePdf(rfi),
          "export-docx": handleExportWord,
          "export-audit-pdf": handleDownloadAuditCert,
          "viewed-by": () => setShowViewedBy(!showViewedBy),
          edit: startInfoEdit,
          revise: () => { if (!isRevising) reviseRfi({ projectId, rfiId: rfi.id, data: {} }); },
          close: handleCloseRfi,
          reopen: handleReopenRfi,
          "raise-change-order": () => { if (!raisingCo) void handleRaiseChangeOrder(); },
          "jump-viewpoint": () => { void fetch(`http://localhost:8765/jump?code=${encodeURIComponent((rfi as { sourceViewpointId?: string | null }).sourceViewpointId || "")}`, { mode: "no-cors" }); },
          "save-rfi": saveCanonicalRfi,
          cancel: () => { void cancelInfoEdit(); },
          "save-response": handleSaveResponse,
        }}
        onChange={handleCanonicalDetailChange}
        onAddReference={() => { const normalized = normalizeManualReference(questionDocInput); if (!normalized.value) { toast({ title: normalized.error || w("Invalid reference", "Referencia no valida", lang), variant: "destructive" }); return; } setQuestionReferences(prev => prev.includes(normalized.value!) ? prev : [...prev, normalized.value!]); setQuestionDocInput(""); }}
        onRemoveReference={(source, index) => { if (source === "reference") { setQuestionReferences(prev => prev.filter((_, i) => i !== index)); return; } const value=questionDocs[index];const fileId=fileIdFromAttachment(value);if(fileId&&editStagedFileIds.current.has(fileId)){void removeEditStagedFile(fileId).then(removed=>{if(removed)setQuestionDocs(prev=>prev.filter((_,i)=>i!==index));});}else setQuestionDocs(prev=>prev.filter((_,i)=>i!==index)); }}
        onOpenReference={value => { void openRfiAttachment(value).catch(error => toast({ title: error instanceof Error ? error.message : w("Attachment could not be opened", "No se pudo abrir el adjunto", lang), variant: "destructive" })); }}
        onUploadFile={() => qAttachFileRef.current?.click()}
        onGenerateQuestionAi={() => handleQuestionAi(questionAiDescription)}
        onGenerateEmailAi={() => void generatePreview()}
        onCopyEmail={handleCopyPreview}
        emailCopied={copied}
        statusContent={statusContent}
        submittedByDirectoryContent={directoryPicker("from")}
        submittedToDirectoryContent={infoEdit ? <SubmittedToParticipantEditor projectId={projectId} contacts={detailContacts} selectedCompany={infoToCompany} onSelect={(company, person, email) => { setInfoToCompany(company); setInfoToPerson(person); setInfoToEmail(email); }} onAddDistribution={entry => setInfoDist(prev => prev.includes(entry) ? prev : [...prev, entry])} onDirectoryAdded={contact => setRfiDirectory(prev => prev.some(item => item.email.toLowerCase() === contact.email.toLowerCase()) ? prev : [...prev, contact])} lang={lang} /> : null}
        distributionContent={<RfiDistributionEditor entries={infoEdit ? infoDist : ((rfi.distributionList as string[] | null) || [])} contacts={detailContacts} editable={infoEdit} onChange={setInfoDist} lang={lang} />}
        referenceContent={referenceContent}
        impactContent={impactContent}
        responseContent={responseContent}
        onTogglePackageItem={(key, include) => setPackageItems(prev => prev.map(item => item.key === key ? { ...item, include } : item))}
        onMovePackageItem={movePackageItem}
        onToggleViewpointImage={include => setImagePresentation(prev => prev ? { ...prev, includeInCompletePdf: include } : prev)}
        onClearImageCrop={() => setImagePresentation(prev => prev ? { ...prev, crop: null } : prev)}
        actionMatrix={savedRfiActions.map(action => action.key === "raise-change-order" && raisingCo ? { ...action, label: w("Creating Change Order...", "Creando Orden de Cambio...", lang) } : action.key === "revise" && isRevising ? { ...action, label: w("Creating Revision...", "Creando Revision...", lang) } : action)}
      />
      <input ref={qAttachFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { const selected = [...(e.target.files || [])]; if (selected.length) { const images=selected.filter(file=>file.type.startsWith("image/")); const documents=selected.filter(file=>!file.type.startsWith("image/")); documents.forEach(file=>{void uploadDoc(file,uploaded=>{setQuestionDocs(prev=>prev.includes(uploaded.downloadUrl)?prev:[...prev,uploaded.downloadUrl]);setPackageItems(prev=>prev.some(item=>item.fileId===uploaded.fileId)?prev:[...prev,{key:`file:${uploaded.fileId}`,label:uploaded.fileName,fileId:uploaded.fileId,attachment:uploaded.downloadUrl,source:"rfi-attachment",include:true,order:prev.length}]);});}); images.forEach(file=>{void beginPendingImage(file,"replacement","upload");}); } e.target.value = ""; }} />
      <input ref={rAttachFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { const selected = [...(e.target.files || [])]; if (selected.length) selected.forEach(file => { void uploadDoc(file, uploaded => setResponseDocs(prev => prev.includes(uploaded.downloadUrl) ? prev : [...prev, uploaded.downloadUrl]), "response"); }); e.target.value = ""; }} />
      <input ref={imageEvidenceInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void beginPendingImage(f, "source", "upload"); e.target.value = ""; }} />
      <input ref={imageReplacementInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) void beginPendingImage(f, "replacement", "upload"); e.target.value = ""; }} />
      {capturedFrame && <RfiSnippingWorkspace src={capturedFrame.url} fileName={capturedFrame.fileName} lang={lang} onComplete={file=>{setCapturedFrame(null);revokeObjectUrlAfterRender(capturedFrame.url);void beginPendingImage(file,"replacement","screen-snip");}} onRetake={()=>{setCapturedFrame(null);revokeObjectUrlAfterRender(capturedFrame.url);void captureScreenImage();}} onCancel={()=>{setCapturedFrame(null);revokeObjectUrlAfterRender(capturedFrame.url);}}/>}
      {pendingImage&&<RfiImageCropEditor src={pendingImage.url} fileName={pendingImage.file.name} initialCrop={null} lang={lang} onApply={crop=>{const current=pendingImage;setPendingImage(null);void uploadImageEvidence(current.file,current.mode,crop,current.kind).finally(()=>URL.revokeObjectURL(current.url));}} onCancel={()=>{setDetailUploadResults(prev=>prev.map(item=>item.name===pendingImage.file.name?{name:item.name,state:"error",message:w("Canceled - not uploaded","Cancelado - no subido",lang)}:item));setPendingImage(null);revokeObjectUrlAfterRender(pendingImage.url);}} onRetake={pendingImage.kind==="screen-snip"?()=>{setPendingImage(null);revokeObjectUrlAfterRender(pendingImage.url);void captureScreenImage();}:undefined}/>}
      {editingPersistedImage&&activeImageUrl&&<RfiImageCropEditor src={activeImageUrl} fileName={w("Persisted RFI image","Imagen RFI persistida",lang)} initialCrop={imagePresentation?.crop||null} lang={lang} onApply={crop=>{setImagePresentation(prev=>prev?{...prev,crop}:prev);setEditingPersistedImage(false);}} onCancel={()=>setEditingPersistedImage(false)} onReplace={()=>imageReplacementInputRef.current?.click()}/>}
      {cloudPickerTarget && (
        <CloudPicker
          provider={cloudPickerTarget.provider}
          projectId={projectId}
          lang={lang}
          onAttached={file => { if (cloudPickerTarget.target === "question") { editStagedFileIds.current.add(file.fileId); setQuestionDocs(prev => prev.includes(file.downloadUrl) ? prev : [...prev, file.downloadUrl]); setPackageItems(prev => prev.some(item => item.fileId === file.fileId) ? prev : [...prev, { key: `file:${file.fileId}`, label: file.fileName, fileId: file.fileId, attachment: file.downloadUrl, source: `cloud:${cloudPickerTarget.provider.key}`, include: true, order: prev.length }]); } else { responseStagedFileIds.current.add(file.fileId); setResponseDocs(prev => prev.includes(file.downloadUrl) ? prev : [...prev, file.downloadUrl]); } }}
          onClose={() => setCloudPickerTarget(null)}
        />
      )}
    </>
  );

}

// ─── Sub-components ────────────────────────────────────────────────────────────
export function RfiActionBar({ actions, handlers, loading }: { actions: RfiActionDefinition[]; handlers: RfiCanonicalActions; loading?: boolean }) {
  const seen = new Set<RfiActionKey>();
  const uniqueActions = actions.filter(action => {
    if (!handlers[action.key]) return false;
    if (seen.has(action.key)) return false;
    seen.add(action.key);
    return true;
  });
  return (
    <div className="rfi-actions" style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {uniqueActions.map(action => (
        <Button
          key={action.key}
          type="button"
          size="sm"
          variant={action.variant === "primary" ? "default" : "outline"}
          disabled={loading}
          onClick={handlers[action.key]}
          style={{ gap: 5, fontSize: 11, color: action.variant === "danger" ? "#DC2626" : undefined, borderColor: action.variant === "danger" ? "#FCA5A5" : undefined }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function CanonicalField({ label, value, editable, onChange, full, multiline, type = "text", options }: {
  label: string;
  value: string;
  editable: boolean;
  onChange?: (value: string) => void;
  full?: boolean;
  multiline?: boolean;
  type?: string;
  options?: RfiCanonicalOption[];
}) {
  return (
    <div className={full ? "rfi-field full" : "rfi-field"} style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{label}</label>
      {editable ? (
        options ? (
          <select value={value} onChange={e => onChange?.(e.target.value)} style={{ width: "100%", height: 36, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: "0 8px" }}>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : multiline ? (
          <textarea value={value} onChange={e => onChange?.(e.target.value)} style={{ width: "100%", minHeight: 76, fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))", padding: "7px 9px", background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        ) : (
          <Input type={type} value={value} onChange={e => onChange?.(e.target.value)} style={{ fontSize: 12 }} />
        )
      ) : (
        <div style={{ minHeight: 28, display: "flex", alignItems: "center", fontSize: 13, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>{value || "-"}</div>
      )}
    </div>
  );
}

function CanonicalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-rfi-canonical-section={title}>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

export function RfiCanonicalForm({
  lang, mode, recordState, values, permissions, references, attachments, attachmentFiles = [], uploadResults = [], imagePresentation, packageItems, responses,
  loading, options, cloudAttachmentActions = [], imageAttachmentActions = [], pendingImagePreview, onAttachPendingImage, onCancelPendingImage, imagePresentationContent,
  actions, onChange, onAddReference, onRemoveReference, onOpenReference = () => undefined, onUploadFile, onGenerateQuestionAi, onGenerateEmailAi,
  onCopyEmail, emailCopied, statusContent, submittedByDirectoryContent, submittedToDirectoryContent, distributionContent, referenceContent, impactContent, responseContent,
  onTogglePackageItem, onMovePackageItem, onToggleViewpointImage, onClearImageCrop, actionMatrix,
}: RfiCanonicalFormProps) {
  const editable = mode === "create" || mode === "edit";
  const matrix = actionMatrix ?? getRfiCanonicalActionMatrix({ mode, recordState, permissions, lang });
  const recordStateLabel: Record<RfiRecordState, string> = {
    new: w("New RFI", "Nuevo RFI", lang),
    draft: w("Draft RFI", "RFI Borrador", lang),
    sent: w("Sent RFI", "RFI Enviado", lang),
    closed: w("Closed RFI", "RFI Cerrado", lang),
    reopened: w("Reopened RFI", "RFI Reabierto", lang),
    revised: w("Revised RFI", "RFI Revisado", lang),
  };
  const headerActions = matrix.filter(action => action.key !== "save-response");
  const responseActions = matrix.filter(action => action.key === "save-response");
  const priorityOptions = options?.priorities?.length ? options.priorities : [
    { value: "low", label: w("Low", "Baja", lang) },
    { value: "medium", label: w("Medium", "Media", lang) },
    { value: "high", label: w("High", "Alta", lang) },
    { value: "critical", label: w("Critical", "Critica", lang) },
  ];
  const typeOptions = options?.rfiTypes?.length ? options.rfiTypes : DEFAULT_RFI_TYPES.map(type => ({ value: type, label: type }));
  const costOptions = options?.costImpact?.length ? options.costImpact : [
    { value: "No Cost Impact", label: w("No Cost Impact", "Sin Impacto en Costo", lang) },
    { value: "Cost Increase TBD", label: w("Cost Increase TBD", "Aumento de Costo por Definir", lang) },
    { value: "Cost Increase Known", label: w("Cost Increase Known", "Aumento de Costo Conocido", lang) },
    { value: "Cost Decrease", label: w("Cost Decrease", "Disminucion de Costo", lang) },
  ];
  const scheduleOptions = options?.scheduleImpact?.length ? options.scheduleImpact : [
    { value: "No Schedule Impact", label: w("No Schedule Impact", "Sin Impacto en Programa", lang) },
    { value: "Increase in Calendar Days", label: w("Increase in Calendar Days", "Aumento en Dias Calendario", lang) },
    { value: "Decrease in Calendar Days", label: w("Decrease in Calendar Days", "Disminucion en Dias Calendario", lang) },
  ];
  const costNeedsReason = values.costImpact === "Cost Increase TBD" || values.costImpact === "Cost Increase Known" || values.costImpact === "Cost Decrease";
  const costNeedsAmount = values.costImpact === "Cost Increase Known" || values.costImpact === "Cost Decrease";
  const scheduleNeedsFields = values.scheduleImpact === "Increase in Calendar Days" || values.scheduleImpact === "Decrease in Calendar Days";
  const presentationFileIds = new Set([imagePresentation?.sourceFileId, imagePresentation?.replacementFileId].filter((id): id is number => typeof id === "number"));
  const packageDisplayItems = packageItems.filter(item => !item.fileId || !presentationFileIds.has(item.fileId));
  const fileForAttachment = (value: string) => {
    const fileId = fileIdFromAttachment(value);
    return fileId ? attachmentFiles.find(file => file.id === fileId) : undefined;
  };
  return (
    <div className="rfi-canonical-form" style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>{recordStateLabel[recordState]}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {values.number && <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{values.number}</span>}
              <span className={`badge ${STATUS_BADGE[values.status] ?? "badge-gray"}`}>{values.status || w("Draft", "Borrador", lang)}</span>
              <span className={`badge ${PRIORITY_BADGE[values.priority] ?? "badge-gray"}`}>{values.priority || "medium"}</span>
              {values.rfiType && <span className="badge badge-blue">{values.rfiType}</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{values.subject || w("Untitled RFI", "RFI sin titulo", lang)}</div>
          </div>
          <RfiActionBar actions={headerActions} handlers={actions} loading={!!loading?.saving} />
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <CanonicalSection title={w("1. Header / RFI Status", "1. Encabezado / Estado RFI", lang)}>
            <FormGrid>
              <CanonicalField label={w("RFI number", "Numero RFI", lang)} value={values.number || w("Assigned after save", "Asignado al guardar", lang)} editable={false} />
              {values.projectName && <CanonicalField label={w("Project", "Proyecto", lang)} value={values.projectName} editable={false} />}
              {(editable || values.projectAddress) && <CanonicalField label={w("Project Address", "Direccion del Proyecto", lang)} value={values.projectAddress || ""} editable={editable} onChange={v => onChange("projectAddress", v)} full />}
              <CanonicalField label={w("Subject/title", "Asunto/titulo", lang)} value={values.subject} editable={editable} onChange={v => onChange("subject", v)} full />
              <CanonicalField label={w("Status", "Estado", lang)} value={values.status} editable={false} />
              <CanonicalField label={w("Priority", "Prioridad", lang)} value={values.priority} editable={editable} onChange={v => onChange("priority", v)} options={priorityOptions} />
              <CanonicalField label={w("Type", "Tipo", lang)} value={values.rfiType} editable={editable} onChange={v => onChange("rfiType", v)} options={typeOptions} />
              <CanonicalField label={w("Date Requested", "Fecha Solicitada", lang)} value={values.dateRequested || ""} editable={mode === "create"} onChange={v => onChange("dateRequested", v)} type="date" />
              <CanonicalField label={w("Date Required", "Fecha Requerida", lang)} value={values.dateRequired || ""} editable={editable} onChange={v => onChange("dateRequired", v)} type="date" />
              <CanonicalField label={w("Days Outstanding", "Dias Pendientes", lang)} value={values.daysOutstanding || ""} editable={false} />
              <CanonicalField label={w("Date Answered", "Fecha Respondido", lang)} value={values.dateAnswered || ""} editable={false} />
            </FormGrid>
            {statusContent}
          </CanonicalSection>
          <CanonicalSection title={w("2. Submitted By", "2. Enviado Por", lang)}>
            <FormGrid>
              <CanonicalField label={w("Company", "Empresa", lang)} value={values.submittedByCompany} editable={editable} onChange={v => onChange("submittedByCompany", v)} />
              <CanonicalField label={w("Contact/person", "Contacto/persona", lang)} value={values.submittedByContact} editable={editable} onChange={v => onChange("submittedByContact", v)} />
              <CanonicalField label={w("Address", "Direccion", lang)} value={values.submittedByAddress} editable={editable} onChange={v => onChange("submittedByAddress", v)} full />
              <CanonicalField label={w("Phone", "Telefono", lang)} value={values.submittedByPhone} editable={editable} onChange={v => onChange("submittedByPhone", v)} />
              <CanonicalField label={w("Email", "Correo", lang)} value={values.submittedByEmail} editable={editable} onChange={v => onChange("submittedByEmail", v)} />
            </FormGrid>
            {submittedByDirectoryContent}
          </CanonicalSection>
          <CanonicalSection title={w("3. Submitted To", "3. Enviado A", lang)}>
            <FormGrid>
              <CanonicalField label={w("Company", "Empresa", lang)} value={values.submittedToCompany} editable={editable} onChange={v => onChange("submittedToCompany", v)} />
              <CanonicalField label={w("Contact/person", "Contacto/persona", lang)} value={values.submittedToPerson} editable={editable} onChange={v => onChange("submittedToPerson", v)} />
              {values.submittedToAddress && <CanonicalField label={w("Address", "Direccion", lang)} value={values.submittedToAddress} editable={false} full />}
              {values.submittedToPhone && <CanonicalField label={w("Phone", "Telefono", lang)} value={values.submittedToPhone} editable={false} />}
              <CanonicalField label={w("Email", "Correo", lang)} value={values.submittedToEmail} editable={editable} onChange={v => onChange("submittedToEmail", v)} />
            </FormGrid>
            {submittedToDirectoryContent}
          </CanonicalSection>
          <CanonicalSection title={w("4. Reference Information / Attachments", "4. Informacion de Referencia / Adjuntos", lang)}>
            <FormGrid>
              <CanonicalField label={w("Drawing number", "Numero de Plano", lang)} value={values.drawingNumber} editable={editable} onChange={v => onChange("drawingNumber", v)} />
              <CanonicalField label={w("Drawing title", "Titulo del Plano", lang)} value={values.drawingTitle} editable={editable} onChange={v => onChange("drawingTitle", v)} />
              <CanonicalField label={w("Spec section", "Seccion de Especificacion", lang)} value={values.specSection} editable={editable} onChange={v => onChange("specSection", v)} />
              <CanonicalField label={w("Detail number", "Numero de Detalle", lang)} value={values.detailNumber} editable={editable} onChange={v => onChange("detailNumber", v)} />
              <CanonicalField label={w("Note number", "Numero de Nota", lang)} value={values.noteNumber} editable={editable} onChange={v => onChange("noteNumber", v)} />
              <CanonicalField label={w("Location", "Ubicacion", lang)} value={values.locationDescription} editable={editable} onChange={v => onChange("locationDescription", v)} full />
            </FormGrid>
            {editable && <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}><Input value={values.referenceInput || ""} onChange={e => onChange("referenceInput", e.target.value)} placeholder={w("Reference/file name/URL", "Referencia/nombre/URL", lang)} style={{ flex: "1 1 260px", fontSize: 12 }} /><Button type="button" size="sm" variant="outline" onClick={onAddReference}>{w("Add Reference", "Agregar Referencia", lang)}</Button><Button type="button" size="sm" variant="outline" onClick={onUploadFile}>{loading?.uploading ? w("Uploading...", "Subiendo...", lang) : w("Upload File", "Subir Archivo", lang)}</Button>{imageAttachmentActions.map(action => <Button key={action.key} type="button" size="sm" variant="outline" onClick={action.onClick} style={{ gap: 4 }}>{action.icon === "capture" ? <Camera style={{ width: 12, height: 12 }} /> : action.icon === "paste" ? <Clipboard style={{ width: 12, height: 12 }} /> : action.icon === "replace" ? <RefreshCw style={{ width: 12, height: 12 }} /> : <Upload style={{ width: 12, height: 12 }} />}{action.label}</Button>)}{cloudAttachmentActions.map(action => <Button key={action.key} type="button" size="sm" variant="outline" onClick={action.onClick} style={{ gap: 4 }}><FolderOpen style={{ width: 12, height: 12 }} />{action.label}</Button>)}</div>}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{w("Manual References", "Referencias Manuales", lang)}</div>
              <div style={{ display: "grid", gap: 5, marginTop: 5 }}>
                {references.length === 0 && <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No manual references.", "Sin referencias manuales.", lang)}</span>}
                {references.map((value, index) => <div key={`reference-${value}-${index}`} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}><FileText style={{ width: 13, height: 13 }} />{/^https?:\/\//i.test(value) ? <button type="button" onClick={() => onOpenReference(value)} style={{ flex: 1, padding: 0, border: 0, background: "transparent", color: "#1D4ED8", textAlign: "left", cursor: "pointer", fontSize: 12 }}><ExternalLink style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />{value}</button> : <span style={{ flex: 1 }}>{value}</span>}{editable && <Button type="button" size="sm" variant="outline" onClick={() => onRemoveReference("reference", index)} style={{ color: "#DC2626", borderColor: "#FCA5A5" }}>{w("Remove Reference", "Quitar Referencia", lang)}</Button>}</div>)}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{w("Files / Attachments", "Archivos / Adjuntos", lang)}</div>
              <div style={{ display: "grid", gap: 6, marginTop: 5 }}>
                {attachments.length === 0 && <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No files attached.", "Sin archivos adjuntos.", lang)}</span>}
                {attachments.map((value, index) => { const file = fileForAttachment(value); const packageItem = packageItems.find(item => item.fileId === fileIdFromAttachment(value)); const sourceLabel = packageItem?.source?.startsWith("cloud:") ? w("Imported cloud file", "Archivo importado de nube", lang) : file?.source === "rfi-attachment" || packageItem?.source === "rfi-attachment" ? w("Uploaded BIMLog file", "Archivo BIMLog subido", lang) : w("Selected project file", "Archivo del proyecto seleccionado", lang); return <div key={`attachment-${value}-${index}`} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}><FileText style={{ width: 13, height: 13 }} /><span style={{ flex: 1 }}><strong>{file?.fileName || packageItem?.label || attachLabel(value)}</strong><span style={{ display: "block", color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{sourceLabel}{file ? ` - ${String(file.fileType || "file").toUpperCase()}${formatFileSize(file.fileSize) ? ` - ${formatFileSize(file.fileSize)}` : ""}` : ""}</span></span><Button type="button" size="sm" variant="outline" onClick={() => onOpenReference(value)}><Download style={{ width: 12, height: 12, marginRight: 4 }} />{w("Open / Download", "Abrir / Descargar", lang)}</Button>{editable && <Button type="button" size="sm" variant="outline" onClick={() => onRemoveReference("attachment", index)} style={{ color: "#DC2626", borderColor: "#FCA5A5" }}>{w("Remove from RFI", "Quitar del RFI", lang)}</Button>}</div>; })}
              </div>
              {uploadResults.length > 0 && <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{uploadResults.map((result, index) => <div key={`${result.name}-${index}`} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: result.state === "error" ? "#B91C1C" : result.state === "success" ? "#166534" : "hsl(var(--muted-foreground))" }}>{result.state === "success" ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : result.state === "error" ? <CircleAlert style={{ width: 13, height: 13 }} /> : <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />}<span>{result.name}{result.message ? ` - ${result.message}` : ""}</span></div>)}</div>}
            </div>
            {imagePresentationContent}
            {(imagePresentation || packageDisplayItems.length > 0) && <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{w("Complete RFI PDF package", "Paquete PDF Completo RFI", lang)}</div>
              {packageDisplayItems.map((item, index) => <div key={item.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, padding: "5px 0", borderTop: index ? "1px solid hsl(var(--border) / 0.5)" : undefined }}><input type="checkbox" checked={item.include} disabled={!editable || !onTogglePackageItem} onChange={e => onTogglePackageItem?.(item.key, e.target.checked)} /><span><strong style={{ display: "block" }}>{item.label}</strong><span style={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{completePackageMethodLabel(item.label, lang)}</span></span>{editable && onMovePackageItem && <span style={{ display: "flex", gap: 4 }}><Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => onMovePackageItem(item.key, -1)} title={w("Move up", "Mover arriba", lang)}><ChevronUp style={{ width: 14, height: 14 }} /></Button><Button type="button" size="icon" variant="outline" disabled={index === packageDisplayItems.length - 1} onClick={() => onMovePackageItem(item.key, 1)} title={w("Move down", "Mover abajo", lang)}><ChevronDown style={{ width: 14, height: 14 }} /></Button></span>}</div>)}
            </div>}
            {referenceContent}
          </CanonicalSection>
          <CanonicalSection title={w("5. Description of Question", "5. Descripcion de la Pregunta", lang)}>
            <CanonicalField label={w("Question", "Pregunta", lang)} value={values.question} editable={editable} onChange={v => onChange("question", v)} full multiline />
            {editable && <CanonicalField label={w("Description for AI question assist", "Descripcion para asistencia IA de pregunta", lang)} value={values.questionAssistDescription || ""} editable={editable} onChange={v => onChange("questionAssistDescription", v)} full multiline />}
            {editable && <Button type="button" size="sm" variant="outline" onClick={onGenerateQuestionAi} disabled={loading?.questionAi} style={{ marginTop: 8, gap: 5 }}><Sparkles style={{ width: 12, height: 12 }} />{loading?.questionAi ? w("Generating...", "Generando...", lang) : w("Generate Question with AI", "Generar Pregunta con IA", lang)}</Button>}
            <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{w("Text assist uses AI credits and does not read attached files unless file-reading AI is explicitly used.", "La asistencia de texto usa creditos IA y no lee adjuntos salvo que se use IA de lectura de archivos explicitamente.", lang)}</p>
          </CanonicalSection>
          <CanonicalSection title={w("6. Impact Assessment", "6. Evaluacion de Impacto", lang)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                <CanonicalField label={w("Cost Impact", "Impacto en Costo", lang)} value={values.costImpact} editable={editable} onChange={v => onChange("costImpact", v)} options={costOptions} />
                {costNeedsAmount && <CanonicalField label={w("Cost Amount", "Monto de Costo", lang)} value={values.costImpactAmount} editable={editable} onChange={v => onChange("costImpactAmount", v)} />}
                {costNeedsReason && <CanonicalField label={w("Cost Reason / Explanation", "Razon / Explicacion de Costo", lang)} value={values.costImpactReason} editable={editable} onChange={v => onChange("costImpactReason", v)} multiline />}
              </div>
              <div style={{ padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                <CanonicalField label={w("Schedule Impact", "Impacto en Programa", lang)} value={values.scheduleImpact} editable={editable} onChange={v => onChange("scheduleImpact", v)} options={scheduleOptions} />
                {scheduleNeedsFields && <CanonicalField label={w("Calendar Days", "Dias Calendario", lang)} value={values.scheduleImpactDays} editable={editable} onChange={v => onChange("scheduleImpactDays", v)} />}
                {scheduleNeedsFields && <CanonicalField label={w("Schedule Reason / Explanation", "Razon / Explicacion de Programa", lang)} value={values.scheduleImpactReason} editable={editable} onChange={v => onChange("scheduleImpactReason", v)} multiline />}
              </div>
            </div>
            {impactContent}
          </CanonicalSection>
          <CanonicalSection title={w("7. Distribution / Email / Responses", "7. Distribucion / Email / Respuestas", lang)}>
            {distributionContent ?? <RfiDistributionEditor entries={values.distributionList} contacts={[]} editable={editable} onChange={entries => onChange("distributionList", entries.join(","))} lang={lang} />}
            <CanonicalField label={w("Description of Email", "Descripcion de Email", lang)} value={values.emailDescription || ""} editable={editable} onChange={v => onChange("emailDescription", v)} full multiline />
            {editable && <><Button type="button" size="sm" variant="outline" onClick={onGenerateEmailAi} disabled={loading?.emailAi} style={{ marginTop: 8, gap: 5 }}><Sparkles style={{ width: 12, height: 12 }} />{loading?.emailAi ? w("Generating...", "Generando...", lang) : w("Generate Email with AI", "Generar Email con IA", lang)}</Button><p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>{w("Email text assist uses AI credits and does not read attachments.", "La asistencia de email usa creditos IA y no lee adjuntos.", lang)}</p></>}
            {values.emailDraft && <div style={{ marginTop: 8 }}><Button type="button" size="sm" variant="outline" onClick={onCopyEmail} style={{ marginBottom: 6, gap: 5 }}><Copy style={{ width: 12, height: 12 }} />{emailCopied ? w("Email Copied", "Email Copiado", lang) : w("Copy Email", "Copiar Email", lang)}</Button><pre style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12 }}>{values.emailDraft}</pre></div>}
            {responses.length > 0 && <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{responses.map((response, index) => <div key={response.id ?? index} style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}><strong>{w("Response", "Respuesta", lang)} {index + 1}</strong>{response.by && <span> - {response.by}</span>}<p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{response.text}</p>{response.attachments?.map((attachment, attachmentIndex) => <div key={`${attachment}-${attachmentIndex}`} style={{ display: "flex", gap: 5, alignItems: "center", color: "#1D4ED8", marginTop: 3 }}><FileText style={{ width: 11, height: 11 }} />{isOpenableAttachment(attachment) ? <button type="button" onClick={() => onOpenReference(attachment)} style={{ padding: 0, border: 0, background: "transparent", color: "#1D4ED8", cursor: "pointer", fontSize: 12 }}>{attachmentLabelFromFiles(attachment, attachmentFiles)}</button> : attachment}</div>)}</div>)}</div>}
            {responseContent ?? (permissions.canRespond && <div style={{ marginTop: 10 }}><CanonicalField label={w("Official Response", "Respuesta Oficial", lang)} value={values.responseText || ""} editable={editable} onChange={v => onChange("responseText", v)} full multiline />{responseActions.length > 0 && <RfiActionBar actions={responseActions} handlers={actions} loading={!!loading?.response} />}</div>)}
          </CanonicalSection>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 2, paddingBottom: 6, borderBottom: "2px solid hsl(var(--primary) / 0.15)", display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginTop: 10 }}>
      {children}
    </div>
  );
}

// Google Drive file picker — browse the user's connected Drive and import a file
// as an RFI attachment. A transient modal (the RFI itself stays a full page).
type CloudItem = { name: string; type: "file" | "folder"; ref: string; mimeType?: string; size?: number };

function CloudPicker({ provider, projectId, rfiId, lang, onAttached, onClose }: {
  provider: FileSourceProvider; projectId: number; rfiId?: number; lang: string;
  onAttached: (file: { downloadUrl: string; fileId: number; fileName: string }) => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CloudItem[]>([]);
  const [crumbs, setCrumbs] = useState<Array<{ name: string; ref: string }>>([{ name: provider.label, ref: "" }]);
  const [loading, setLoading] = useState(false);
  const [importingRef, setImportingRef] = useState<string | null>(null);
  const tok = () => JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
  const current = crumbs[crumbs.length - 1];

  const load = async (ref = current.ref, query = q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ref, q: query });
      const r = await fetch(`/api/v1/me/connections/${provider.param}/browse?${params.toString()}`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Failed to load files"); }
      const d = await r.json() as { items?: CloudItem[] };
      setItems(d.items || []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Failed to load files", "Error al cargar archivos", lang), variant: "destructive" });
      setItems([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load("", ""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [provider.param]);

  const openFolder = async (item: CloudItem) => {
    const next = [...crumbs, { name: item.name, ref: item.ref }];
    setCrumbs(next);
    setQ("");
    await load(item.ref, "");
  };

  const pick = async (item: CloudItem) => {
    setImportingRef(item.ref);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/rfis/attachments/from-cloud`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ provider: provider.param, ref: item.ref, fileName: item.name, mimeType: item.mimeType, rfiId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Import failed"); }
      const file = await r.json() as { downloadUrl: string; fileId: number; fileName: string };
      onAttached(file);
      toast({ title: w(`Attached from ${provider.label}`, `Adjuntado desde ${provider.label}`, lang) });
      onClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : w("Import failed", "Error al importar", lang), variant: "destructive" });
    } finally { setImportingRef(null); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "hsl(var(--background))", borderRadius: 12, border: "1px solid hsl(var(--border))", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{w(`Attach from ${provider.label}`, `Adjuntar desde ${provider.label}`, lang)}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: "8px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {crumbs.map((c, i) => (
            <button key={`${c.ref}-${i}`} type="button" onClick={() => { const next = crumbs.slice(0, i + 1); setCrumbs(next); setQ(""); void load(c.ref, ""); }}
              style={{ border: "none", background: "transparent", color: i === crumbs.length - 1 ? "hsl(var(--foreground))" : "#1D4ED8", fontSize: 11, fontWeight: i === crumbs.length - 1 ? 700 : 600, cursor: "pointer", padding: 0 }}>
              {i > 0 ? " / " : ""}{c.name}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 6 }}>
          <Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") load(current.ref, q); }} placeholder={w("Search files...", "Buscar archivos...", lang)} style={{ fontSize: 12, flex: 1 }} />
          <Button size="sm" onClick={() => load(current.ref, q)} disabled={loading} style={{ fontSize: 11, gap: 4 }}>
            {loading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Search style={{ width: 12, height: 12 }} />}{w("Search", "Buscar", lang)}
          </Button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 10px" }}>
          {loading && items.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("Loading...", "Cargando...", lang)}</div>}
          {!loading && items.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("No files found.", "No se encontraron archivos.", lang)}</div>}
          {items.map(item => (
            <button key={item.ref} onClick={() => item.type === "folder" ? void openFolder(item) : void pick(item)} disabled={!!importingRef} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--muted) / 0.5)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {item.type === "folder" ? <FolderOpen style={{ width: 14, height: 14, color: "#1D4ED8", flexShrink: 0 }} /> : <FileText style={{ width: 14, height: 14, color: "#1D4ED8", flexShrink: 0 }} />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
              {importingRef === item.ref && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
