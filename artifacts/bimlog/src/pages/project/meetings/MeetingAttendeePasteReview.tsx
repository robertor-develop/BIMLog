import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type ReviewedAttendeeRow = { fullName: string; email: string; company: string };

const parseRows = (value: string): ReviewedAttendeeRow[] => value
  .split(/\r?\n|;/)
  .map((line) => {
    const [fullName = "", email = "", company = ""] = line.split(/\t|,/);
    return { fullName: fullName.trim().replace(/\s+/g, " "), email: email.trim().toLowerCase(), company: company.trim().replace(/\s+/g, " ") };
  })
  .filter((row) => row.fullName);

export function MeetingAttendeePasteReview({
  canWrite,
  existingEmails,
  onConfirm,
}: {
  canWrite: boolean;
  existingEmails: string[];
  onConfirm: (rows: ReviewedAttendeeRow[]) => void;
}) {
  const { language } = useI18n();
  const t = (en: string, es: string) => language === "es" ? es : en;
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const rows = useMemo(() => parseRows(source).slice(0, 500), [source]);
  const known = useMemo(() => new Set(existingEmails.map((value) => value.trim().toLowerCase()).filter(Boolean)), [existingEmails]);
  const invalid = rows.some((row) => row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));
  const duplicate = rows.some((row, index) => row.email && rows.findIndex((candidate) => candidate.email === row.email) !== index);

  if (!open) return <button type="button" className="btn btn-outline" disabled={!canWrite} onClick={() => setOpen(true)}>{t("Import attendee list", "Importar lista de asistentes")}</button>;
  return <section aria-label={t("Attendee import review", "Revisión de importación de asistentes")} style={{ padding: 12, borderBottom: "1px solid #E5E7EB", display: "grid", gap: 8 }}>
    <strong>{t("Paste and review attendees", "Pegar y revisar asistentes")}</strong>
    <p style={{ margin: 0, fontSize: 12 }}>{t("One person per line: name, email, company. Nothing is added until you review and confirm.", "Una persona por línea: nombre, email, empresa. Nada se agrega hasta revisar y confirmar.")}</p>
    <textarea aria-label={t("Attendee rows", "Filas de asistentes")} value={source} onChange={(event) => { setSource(event.target.value); setReviewing(false); }} rows={5} placeholder="Ruben Crespo, ruben@example.com, BIMTECH" />
    {reviewing && <div role="region" aria-label={t("Review candidates", "Revisar candidatos")}>
      {rows.map((row, index) => <div key={`${row.email}-${index}`} style={{ display: "flex", gap: 8, padding: 4, fontSize: 12 }}>
        <span>{row.fullName}</span><span>{row.email || "—"}</span><span>{row.company || "—"}</span>
        <b>{row.email && known.has(row.email) ? t("Already listed", "Ya incluido") : t("Ready to add", "Listo para agregar")}</b>
      </div>)}
    </div>}
    {(invalid || duplicate) && <p role="alert" style={{ color: "#B91C1C", margin: 0 }}>{invalid ? t("Correct invalid email addresses before continuing.", "Corrija los correos inválidos antes de continuar.") : t("Remove duplicate email addresses before continuing.", "Elimine correos duplicados antes de continuar.")}</p>}
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" className="btn btn-outline" onClick={() => setReviewing(true)} disabled={!rows.length}>{t("Review", "Revisar")}</button>
      <button type="button" className="btn btn-primary" disabled={!reviewing || !rows.length || invalid || duplicate} onClick={() => { onConfirm(rows.filter((row) => !row.email || !known.has(row.email))); setSource(""); setReviewing(false); setOpen(false); }}>{t("Confirm attendees", "Confirmar asistentes")}</button>
      <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setSource(""); setReviewing(false); }}>{t("Cancel", "Cancelar")}</button>
    </div>
  </section>;
}
