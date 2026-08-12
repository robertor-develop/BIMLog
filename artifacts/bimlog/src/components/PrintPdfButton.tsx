import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PrintPdfButtonProps = {
  lang: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  currentViewSummary?: string[];
  options?: ReactNode;
  configurationInvalid?: boolean;
  selectionMode?: boolean;
};

export async function downloadPdfResponse(
  response: Response,
  fallbackFileName: string,
) {
  if (!response.ok) throw new Error("current_view_pdf_failed");
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  let candidate = fallbackFileName;
  try {
    candidate = decodeURIComponent(encodedMatch?.[1] || plainMatch?.[1] || fallbackFileName);
  } catch {
    candidate = fallbackFileName;
  }
  const safeName = candidate
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 160);
  const fileName = /\.pdf$/i.test(safeName || "") ? safeName! : `${safeName || fallbackFileName}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadAuthenticatedPdf(
  url: string,
  token: string,
  fallbackFileName: string,
  signal?: AbortSignal,
) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  await downloadPdfResponse(response, fallbackFileName);
}

export async function downloadGovernedCurrentViewPdf(
  projectId: number,
  token: string,
  payload: {
    surface:
      | "reports-hub"
      | "integrations"
      | "clash-reports"
      | "submittal-register"
      | "naming-convention"
      | "job-intake"
      | "job-operations"
      | "cost-value-planner"
      | "team-performance";
    lang: string;
    context: string[];
    columns: string[];
    rows: string[][];
    emptyMessage: string;
  },
  fallbackFileName: string,
) {
  const response = await fetch(`/api/v1/projects/${projectId}/reports/current-view/pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  await downloadPdfResponse(response, fallbackFileName);
}

export function PrintPdfButton({
  lang,
  onClick,
  loading = false,
  disabled = false,
  disabledReason,
  className,
  currentViewSummary = [],
  options,
  configurationInvalid = false,
  selectionMode = false,
}: PrintPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const statusId = useId();
  const disabledReasonId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreAfterActionRef = useRef(false);
  const isSpanish = lang === "es";
  const label = loading
    ? isSpanish ? "Preparando PDF..." : "Preparing PDF..."
    : isSpanish ? "Imprimir PDF" : "Print PDF";
  const title = disabled && disabledReason
    ? disabledReason
    : isSpanish
      ? "Imprime o descarga un PDF de la vista visible actual."
      : "Print or download a PDF of the current visible view.";
  const restoreTriggerFocus = () => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) restoreTriggerFocus();
  };
  const confirm = () => {
    restoreAfterActionRef.current = true;
    onClick();
    setOpen(false);
  };
  useEffect(() => {
    if (!open && !loading && restoreAfterActionRef.current) {
      restoreAfterActionRef.current = false;
      restoreTriggerFocus();
    }
  }, [loading, open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        data-page-level-print-pdf="true"
        className={className}
        disabled={disabled || loading}
        title={title}
        aria-label={label}
        aria-busy={loading}
        aria-describedby={[
          disabled && disabledReason ? disabledReasonId : "",
          statusId,
        ].filter(Boolean).join(" ") || undefined}
        onClick={() => setOpen(true)}
        style={{ gap: 6, whiteSpace: "normal" }}
      >
        {loading
          ? <Loader2 aria-hidden="true" className="animate-spin" style={{ width: 14, height: 14 }} />
          : <Printer aria-hidden="true" style={{ width: 14, height: 14 }} />}
        <span>{label}</span>
      </Button>
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {loading ? label : ""}
      </span>
      {disabled && disabledReason && (
        <span id={disabledReasonId} className="sr-only">{disabledReason}</span>
      )}
      <DialogContent
        className="max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[620px] gap-0 overflow-y-auto border-slate-300 p-0 text-slate-900"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-slate-200 px-5 py-[18px] pr-12 text-left">
          <DialogTitle>
            {selectionMode
              ? isSpanish ? "Configurar PDF" : "Configure PDF"
              : isSpanish ? "Imprimir vista actual" : "Print current view"}
          </DialogTitle>
          <DialogDescription className="leading-5">
            {selectionMode
              ? isSpanish
                ? "Elija las secciones que debe incluir el PDF. BIMLog generará y descargará el archivo completado automáticamente."
                : "Choose the sections to include. BIMLog will generate and download the completed PDF automatically."
              : isSpanish
                ? "Los filtros, búsqueda, orden, pestaña, fechas y vista visibles de la página se heredan automáticamente."
                : "The page's visible filters, search, sort, tab, dates, and view are inherited automatically."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-5">
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-[13px]">
            <strong className="mb-1 block text-[13px] text-[#1E3A5F]">
              {isSpanish ? "Vista actual heredada" : "Inherited current view"}
            </strong>
            {currentViewSummary.length ? (
              <ul className="m-0 list-disc pl-[18px] text-xs leading-[1.55] text-slate-700">
                {currentViewSummary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="m-0 text-xs leading-[1.55] text-slate-700">
                {selectionMode
                  ? isSpanish
                    ? "Solo se incluirán las secciones seleccionadas. Los datos se toman del proyecto y borrador visibles; no se inventan filas."
                    : "Only selected sections are included. Data comes from the visible project and draft; no rows are fabricated."
                  : isSpanish
                    ? "Se usará exactamente el estado visible actual. Los resultados vacíos se muestran como vacíos, sin filas inventadas."
                    : "The exact current visible state will be used. Empty results remain empty; no rows are fabricated."}
              </p>
            )}
          </section>
          {options && (
            <section>
              <strong className="mb-2 block text-[13px]">
                {isSpanish ? "Opciones solo del PDF" : "PDF-only options"}
              </strong>
              {options}
            </section>
          )}
        </div>
        <DialogFooter className="flex-row flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:space-x-0">
          <Button ref={cancelRef} type="button" variant="outline" size="sm" className="min-w-0 flex-1 sm:flex-none" onClick={() => handleOpenChange(false)}>
            {isSpanish ? "Cancelar" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-w-0 flex-1 whitespace-normal sm:flex-none"
            onClick={confirm}
            disabled={disabled || configurationInvalid || loading}
            aria-describedby={configurationInvalid && disabledReason ? disabledReasonId : undefined}
            title={configurationInvalid ? disabledReason : undefined}
          >
            <Printer aria-hidden="true" style={{ width: 14, height: 14, marginRight: 6 }} />
            {isSpanish ? "Imprimir PDF" : "Print PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
