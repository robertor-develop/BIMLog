import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function FixSpecificLink() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const valid = Number.isSafeInteger(Number(userId)) && Number(userId) > 0 && Number.isSafeInteger(Number(projectId)) && Number(projectId) > 0;

  const repair = async () => {
    if (!token || !valid || !confirmed) { setState("error"); setMessage(t("Enter positive IDs and confirm the bounded read-only repair.", "Ingrese identificadores positivos y confirme la reparación limitada de solo lectura.")); return; }
    setState("saving"); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/admin/fix-specific-link`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: Number(userId), projectId: Number(projectId) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error || `REQUEST_${response.status}`));
      setState("success");
      setMessage(body.message === "Link already exists" ? t(`No change was needed. Membership ${body.memberId} already exists.`, `No fue necesario ningún cambio. La membresía ${body.memberId} ya existe.`) : t(`Read-only membership ${body.memberId} created for ${body.userName} in project ${body.projectCode}.`, `Membresía de solo lectura ${body.memberId} creada para ${body.userName} en el proyecto ${body.projectCode}.`));
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : t("The link could not be repaired.", "No se pudo reparar el vínculo.")); }
  };

  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 820, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <Button variant="outline" onClick={() => setLocation("/all-tools")}>{t("Back to All Tools", "Volver a Todas las herramientas")}</Button>
    <h1>{t("Repair User–Project Link", "Reparar vínculo usuario–proyecto")}</h1>
    <p>{t("Use this bounded recovery only when an existing user is missing from an existing project. It creates read-only membership, never elevated authority, and records the Super Admin action in the audit log.", "Use esta recuperación limitada solo cuando falte un usuario existente en un proyecto existente. Crea una membresía de solo lectura, nunca autoridad elevada, y registra la acción del Super Admin en el registro de auditoría.")}</p>
    <section aria-labelledby="repair-link-form" style={{ display: "grid", gap: 14, padding: 18, border: "1px solid hsl(var(--border))", borderRadius: 12 }}>
      <h2 id="repair-link-form" style={{ margin: 0, fontSize: 18 }}>{t("Exact repair target", "Objetivo exacto de reparación")}</h2>
      <label>{t("Existing user ID", "ID de usuario existente")}<Input inputMode="numeric" value={userId} onChange={event => { setUserId(event.target.value); setConfirmed(false); setState("idle"); }} /></label>
      <label>{t("Existing project ID", "ID de proyecto existente")}<Input inputMode="numeric" value={projectId} onChange={event => { setProjectId(event.target.value); setConfirmed(false); setState("idle"); }} /></label>
      <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t("I verified both IDs and understand this creates only read-only project membership.", "Verifiqué ambos ID y entiendo que esto crea únicamente una membresía de proyecto de solo lectura.")}</label>
      <Button disabled={!valid || !confirmed || state === "saving"} onClick={() => void repair()}>{state === "saving" ? t("Repairing and recording evidence…", "Reparando y registrando evidencia…") : t("Repair read-only link", "Reparar vínculo de solo lectura")}</Button>
    </section>
    {state === "success" && <div role="status" aria-live="polite" style={{ marginTop: 14, padding: 12, border: "1px solid #86efac", background: "#f0fdf4", borderRadius: 8 }}>{message} <Button size="sm" variant="outline" onClick={() => setLocation("/admin?tab=audit-activity")}>{t("Open audit evidence", "Abrir evidencia de auditoría")}</Button></div>}
    {state === "error" && <div role="alert" style={{ marginTop: 14, padding: 12, border: "1px solid #fca5a5", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}
  </main>;
}

export default FixSpecificLink;
