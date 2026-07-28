import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintPdfButtonProps = {
  lang: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
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
}: PrintPdfButtonProps) {
  const isSpanish = lang === "es";
  const label = loading
    ? isSpanish ? "Preparando PDF..." : "Preparing PDF..."
    : isSpanish ? "Imprimir PDF" : "Print PDF";
  const title = disabled && disabledReason
    ? disabledReason
    : isSpanish
      ? "Imprime o descarga un PDF de la vista visible actual."
      : "Print or download a PDF of the current visible view.";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-page-level-print-pdf="true"
      className={className}
      disabled={disabled || loading}
      title={title}
      aria-label={label}
      onClick={onClick}
      style={{ gap: 6, whiteSpace: "normal" }}
    >
      {loading
        ? <Loader2 aria-hidden="true" className="animate-spin" style={{ width: 14, height: 14 }} />
        : <Printer aria-hidden="true" style={{ width: 14, height: 14 }} />}
      <span>{label}</span>
    </Button>
  );
}
