import { useState } from "react";
import { logClientError } from "@/lib/client-log";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function translate(en: string, es: string, language: string): string {
  return language === "es" ? es : en;
}

interface PartyAssignmentStatus {
  code: string;
  hasUsers: boolean;
  companyName?: string;
}

export function ConventionPartyAssignment({ projectId, convention, lang, token, onRefresh }: {
  projectId: number;
  convention: { companyAssignmentStatus?: PartyAssignmentStatus[] } | null | undefined;
  lang: string;
  token: string | null;
  onRefresh: () => void;
}) {
  const [assignCode, setAssignCode] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const items = convention?.companyAssignmentStatus ?? [];

  const handleAssign = async () => {
    if (!assignCode || !token) return;
    if (!fullName.trim() || !email.trim() || !companyName.trim()) {
      setError(translate("All fields are required", "Todos los campos son requeridos", lang));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/assign-company-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyCode: assignCode,
          newUserData: {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            companyName: companyName.trim(),
          },
        }),
      });
      if (response.ok) {
        setAssignCode(null);
        setFullName("");
        setEmail("");
        setCompanyName("");
        onRefresh();
      } else {
        const body = await response.json().catch(errorResponse => {
          logClientError("convention party assignment error response", errorResponse);
          return null;
        });
        setError(body?.error || translate("Assignment failed", "La asignación falló", lang));
      }
    } catch (requestError) {
      logClientError("convention party assignment", requestError);
      setError(translate("Network error", "Error de red", lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: "#F9FAFB", border: "1px solid hsl(var(--border))" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6B7280", marginBottom: 8 }}>
        {translate("User Assignment Status", "Estado de Asignación de Usuarios", lang)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map(item => (
          <button
            key={item.code}
            type="button"
            disabled={item.hasUsers}
            aria-label={item.hasUsers
              ? translate(`${item.code}: users assigned`, `${item.code}: usuarios asignados`, lang)
              : translate(`Assign a user to ${item.code}`, `Asignar un usuario a ${item.code}`, lang)}
            onClick={() => {
              if (!item.hasUsers) {
                setAssignCode(item.code);
                setCompanyName(item.companyName || item.code);
              }
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 16, fontSize: 11, fontWeight: 700,
              background: item.hasUsers ? "#F0FDF4" : "#FEF2F2",
              color: item.hasUsers ? "#15803D" : "#DC2626",
              border: `1px solid ${item.hasUsers ? "#BBF7D0" : "#FECACA"}`,
              cursor: item.hasUsers ? "default" : "pointer",
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: item.hasUsers ? "#16A34A" : "#DC2626" }} />
            {item.code}
            <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.8 }}>
              {item.hasUsers
                ? translate("users assigned", "usuarios asignados", lang)
                : translate("Assign User", "Asignar Usuario", lang)}
            </span>
          </button>
        ))}
      </div>
      {assignCode && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 6, background: "white", border: "1px solid #D1D5DB" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {translate(`Assign user to ${assignCode}`, `Asignar usuario a ${assignCode}`, lang)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input aria-label={translate("Full Name", "Nombre Completo", lang)} value={fullName} onChange={event => setFullName(event.target.value)} placeholder={translate("Full Name", "Nombre Completo", lang)} style={{ padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 5, fontSize: 12 }} />
            <input aria-label="Email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" type="email" style={{ padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 5, fontSize: 12 }} />
            <input aria-label={translate("Company Name", "Nombre de Empresa", lang)} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={translate("Company Name", "Nombre de Empresa", lang)} style={{ padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 5, fontSize: 12 }} />
          </div>
          {error && <div role="alert" style={{ color: "#DC2626", fontSize: 11, marginTop: 6 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => { setAssignCode(null); setError(""); }} style={{ flex: 1, padding: "6px 0", border: "1px solid #D1D5DB", borderRadius: 5, background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {translate("Cancel", "Cancelar", lang)}
            </button>
            <button type="button" onClick={handleAssign} disabled={submitting} style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 5, background: "#1D4ED8", color: "white", fontSize: 12, fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>
              {submitting ? "..." : translate("Assign", "Asignar", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
