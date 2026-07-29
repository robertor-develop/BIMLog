import { type ReactNode, useEffect, useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
};

export function printCurrentView(targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return false;
  const cleanup = () => {
    delete document.body.dataset.currentViewPrinting;
    delete target.dataset.currentViewPrintActive;
  };
  document.body.dataset.currentViewPrinting = "true";
  target.dataset.currentViewPrintActive = "true";
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  cleanup();
  return true;
}

export async function downloadAuthenticatedPdf(
  url: string,
  token: string,
  fallbackFileName: string,
) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
}: PrintPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const isSpanish = lang === "es";
  const label = loading
    ? isSpanish ? "Preparando PDF..." : "Preparing PDF..."
    : isSpanish ? "Imprimir PDF" : "Print PDF";
  const title = disabled && disabledReason
    ? disabledReason
    : isSpanish
      ? "Imprime o descarga un PDF de la vista visible actual."
      : "Print or download a PDF of the current visible view.";
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  const confirm = () => {
    setOpen(false);
    onClick();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-page-level-print-pdf="true"
        className={className}
        disabled={disabled || loading}
        title={title}
        aria-label={label}
        onClick={() => setOpen(true)}
        style={{ gap: 6, whiteSpace: "normal" }}
      >
        {loading
          ? <Loader2 aria-hidden="true" className="animate-spin" style={{ width: 14, height: 14 }} />
          : <Printer aria-hidden="true" style={{ width: 14, height: 14 }} />}
        <span>{label}</span>
      </Button>
      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 1500, display: "grid", placeItems: "center", padding: 16, background: "rgba(15, 23, 42, 0.58)" }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="current-view-print-title"
            style={{ width: "min(620px, 100%)", maxHeight: "min(760px, calc(100vh - 32px))", overflowY: "auto", borderRadius: 14, border: "1px solid #CBD5E1", background: "white", color: "#17212B", boxShadow: "0 24px 80px rgba(15,23,42,.28)" }}
          >
            <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <div>
                <h2 id="current-view-print-title" style={{ margin: 0, fontSize: 19 }}>
                  {isSpanish ? "Imprimir vista actual" : "Print current view"}
                </h2>
                <p style={{ margin: "5px 0 0", color: "#64748B", fontSize: 12, lineHeight: 1.5 }}>
                  {isSpanish
                    ? "Los filtros, búsqueda, orden, pestaña, fechas y vista visibles de la página se heredan automáticamente."
                    : "The page's visible filters, search, sort, tab, dates, and view are inherited automatically."}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={isSpanish ? "Cerrar" : "Close"} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer" }}>
                <X aria-hidden="true" style={{ width: 18, height: 18 }} />
              </button>
            </header>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <section style={{ padding: 13, borderRadius: 9, border: "1px solid #BFDBFE", background: "#EFF6FF" }}>
                <strong style={{ display: "block", marginBottom: 5, color: "#1E3A5F", fontSize: 13 }}>
                  {isSpanish ? "Vista actual heredada" : "Inherited current view"}
                </strong>
                {currentViewSummary.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 12, lineHeight: 1.55 }}>
                    {currentViewSummary.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: "#334155", fontSize: 12, lineHeight: 1.55 }}>
                    {isSpanish
                      ? "Se usará exactamente el estado visible actual. Los resultados vacíos se muestran como vacíos, sin filas inventadas."
                      : "The exact current visible state will be used. Empty results remain empty; no rows are fabricated."}
                  </p>
                )}
              </section>
              {options && (
                <section>
                  <strong style={{ display: "block", marginBottom: 9, fontSize: 13 }}>
                    {isSpanish ? "Opciones solo del PDF" : "PDF-only options"}
                  </strong>
                  {options}
                </section>
              )}
            </div>
            <footer style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "14px 20px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {isSpanish ? "Cancelar" : "Cancel"}
              </Button>
              <Button type="button" size="sm" onClick={confirm} disabled={disabled || configurationInvalid || loading} title={configurationInvalid ? disabledReason : undefined}>
                <Printer aria-hidden="true" style={{ width: 14, height: 14, marginRight: 6 }} />
                {isSpanish ? "Imprimir PDF" : "Print PDF"}
              </Button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
