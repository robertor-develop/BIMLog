import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, X, Trash2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  endpoint: string;
  entityLabel: string;
  warning?: string;
}

export function DeleteConfirmModal({ open, onClose, onDeleted, endpoint, entityLabel, warning }: Props) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tr = (en: string, es: string) => lang === "es" ? es : en;

  const translatedEntityLabel = (() => {
    if (lang !== "es") return entityLabel;

    const translations: Array<[string, string]> = [
      ["Change Order", "Orden de cambio"],
      ["Transmittal", "Transmisión"],
      ["Submittal", "Entrega"],
      ["Meeting", "Reunión"],
      ["Report", "Informe"],
      ["Clash", "Conflicto"],
      ["RFI", "RFI"],
    ];
    const match = translations.find(([english]) =>
      entityLabel === english || entityLabel.startsWith(`${english} `),
    );
    if (!match) return "elemento seleccionado";

    const [english, spanish] = match;
    return `${spanish}${entityLabel.slice(english.length)}`;
  })();

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const animationFrame = window.requestAnimationFrame(() => initialFocusRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(animationFrame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  const reset = () => {
    setSelectedReason("");
    setOtherReason("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(element => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialogRef.current?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const submit = async () => {
    const reason = selectedReason === "other" ? otherReason.trim() : selectedReason;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(endpoint, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(body || `Request failed (${r.status})`);
      }
      onDeleted();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description"
      onKeyDown={handleKeyDown} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "white", borderRadius: 10, width: "100%", maxWidth: 460,
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #E5E7EB", background: "#FEF2F2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} color="#DC2626" />
            <div id="delete-confirm-title" style={{ fontWeight: 700, fontSize: 14, color: "#991B1B" }}>{tr("Delete", "Eliminar")} {translatedEntityLabel}</div>
          </div>
          <button ref={initialFocusRef} type="button" aria-label={tr("Close", "Cerrar")} onClick={close} disabled={submitting}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "#6B7280" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div id="delete-confirm-description" style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            {tr(
              `This will remove the ${entityLabel.toLowerCase()} from all lists. Any linked items will be detached.`,
              `Esto eliminará ${translatedEntityLabel.toLowerCase()} de todas las listas. Los elementos enlazados serán desvinculados.`,
            )}
            {warning ? <div style={{ marginTop: 6, fontSize: 12, color: "#B45309" }}>{warning}</div> : null}
          </div>

          <label htmlFor="delete-reason" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            {tr("Reason (optional)", "Motivo (opcional)")}
          </label>
          <select
            id="delete-reason"
            value={selectedReason}
            onChange={e => {
              setSelectedReason(e.target.value);
              if (e.target.value !== "other") setOtherReason("");
            }}
            disabled={submitting}
            style={{
              width: "100%", border: "1px solid #D1D5DB", borderRadius: 6,
              padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "white",
            }}
          >
            <option value="">{tr("Select a reason", "Seleccione un motivo")}</option>
            <option value="Duplicate">{tr("Duplicate", "Duplicado")}</option>
            <option value="Created in error">{tr("Created in error", "Creado por error")}</option>
            <option value="No longer needed">{tr("No longer needed", "Ya no es necesario")}</option>
            <option value="Superseded">{tr("Superseded", "Reemplazado")}</option>
            <option value="other">{tr("Other", "Otro")}</option>
          </select>

          {selectedReason === "other" ? (
            <div style={{ marginTop: 10 }}>
              <label htmlFor="delete-other-reason" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                {tr("Other reason", "Otro motivo")}
              </label>
              <textarea
                id="delete-other-reason"
                value={otherReason}
                onChange={e => setOtherReason(e.target.value)}
                placeholder={tr("Enter a reason", "Ingrese un motivo")}
                rows={3}
                disabled={submitting}
                style={{
                  width: "100%", border: "1px solid #D1D5DB", borderRadius: 6,
                  padding: "8px 10px", fontSize: 13, fontFamily: "inherit", resize: "vertical",
                }}
              />
            </div>
          ) : null}

          {error ? (
            <div role="alert" style={{ marginTop: 10, padding: "8px 10px", background: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, color: "#991B1B" }}>
              {error}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 18px", borderTop: "1px solid #E5E7EB", background: "#F9FAFB" }}>
          <button type="button" onClick={close} disabled={submitting}
            style={{ padding: "7px 14px", border: "1px solid #D1D5DB", borderRadius: 6,
              background: "white", cursor: submitting ? "not-allowed" : "pointer", fontSize: 13 }}>
            {tr("Cancel", "Cancelar")}
          </button>
          <button type="button" onClick={submit} disabled={submitting}
            style={{ padding: "7px 14px", border: "none", borderRadius: 6,
              background: "#DC2626", color: "white", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {submitting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
            {tr("Delete", "Eliminar")}
          </button>
        </div>
      </div>
    </div>
  );
}
