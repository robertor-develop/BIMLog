import { useState } from "react";
import { useAuthStore } from "@/store/auth";
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
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
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
      setReason("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
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
            <div style={{ fontWeight: 700, fontSize: 14, color: "#991B1B" }}>Delete {entityLabel}</div>
          </div>
          <button onClick={onClose} disabled={submitting}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "#6B7280" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            This will remove the {entityLabel.toLowerCase()} from all lists. Any linked items will be detached.
            {warning ? <div style={{ marginTop: 6, fontSize: 12, color: "#B45309" }}>{warning}</div> : null}
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. duplicate, created in error, superseded"
            rows={3}
            disabled={submitting}
            style={{
              width: "100%", border: "1px solid #D1D5DB", borderRadius: 6,
              padding: "8px 10px", fontSize: 13, fontFamily: "inherit", resize: "vertical",
            }}
          />

          {error ? (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, color: "#991B1B" }}>
              {error}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 18px", borderTop: "1px solid #E5E7EB", background: "#F9FAFB" }}>
          <button onClick={onClose} disabled={submitting}
            style={{ padding: "7px 14px", border: "1px solid #D1D5DB", borderRadius: 6,
              background: "white", cursor: submitting ? "not-allowed" : "pointer", fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={submit} disabled={submitting}
            style={{ padding: "7px 14px", border: "none", borderRadius: 6,
              background: "#DC2626", color: "white", cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {submitting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
