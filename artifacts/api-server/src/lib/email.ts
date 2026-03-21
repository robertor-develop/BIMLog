import sgMail from "@sendgrid/mail";
import { db } from "@workspace/db";
import { emailLogTable } from "@workspace/db/schema";

const FROM = "notifications@ignitesmart.ai";
const APP_URL = process.env.BIMLOG_URL || "https://bim-log-ignite.replit.app";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("[email] SENDGRID_API_KEY not set — email notifications are disabled.");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  triggerType?: string;
}): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn(`[email] Skipping send to ${params.to} — SENDGRID_API_KEY not set.`);
    setImmediate(async () => {
      try {
        await db.insert(emailLogTable).values({ toEmail: params.to, subject: params.subject, triggerType: params.triggerType || null, status: "skipped", errorMessage: "SENDGRID_API_KEY not set" });
      } catch (_) {}
    });
    return;
  }
  try {
    await sgMail.send({
      to: params.to,
      from: FROM,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
    });
    console.log(`[email] Sent "${params.subject}" to ${params.to}`);
    setImmediate(async () => {
      try {
        await db.insert(emailLogTable).values({ toEmail: params.to, subject: params.subject, triggerType: params.triggerType || null, status: "sent" });
      } catch (_) {}
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send to ${params.to}:`, errMsg);
    setImmediate(async () => {
      try {
        await db.insert(emailLogTable).values({ toEmail: params.to, subject: params.subject, triggerType: params.triggerType || null, status: "failed", errorMessage: errMsg });
      } catch (_) {}
    });
  }
}

export function getAppUrl(): string {
  return APP_URL;
}

function emailWrapper(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BIMLog by IgniteSmart</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0F172A;border-radius:8px 8px 0 0;padding:24px 32px;">
            <span style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">BIMLog</span>
            <span style="font-size:13px;color:#94A3B8;margin-left:8px;">by IgniteSmart</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#FFFFFF;padding:32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0F172A;border-radius:0 0 8px 8px;padding:20px 32px;text-align:center;">
            <span style="font-size:12px;color:#64748B;">© 2026 BIMCapital Partners INC · </span>
            <a href="mailto:info@ignitesmart.ai" style="font-size:12px;color:#64748B;text-decoration:none;">info@ignitesmart.ai</a>
            <br /><span style="font-size:11px;color:#475569;margin-top:4px;display:block;">7901 4th Street North STE 300 · St. Petersburg, FL 33702</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1E40AF;color:#FFFFFF;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:20px;">${label}</a>`;
}

function field(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#64748B;width:40%;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#1E293B;font-weight:500;">${value}</td>
  </tr>`;
}

function table(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows}</table>`;
}

function heading(text: string): string {
  return `<h2 style="font-size:20px;font-weight:700;color:#0F172A;margin:0 0 8px 0;">${text}</h2>`;
}

function para(text: string): string {
  return `<p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 12px 0;">${text}</p>`;
}

function badge(label: string, color = "#1E40AF"): string {
  return `<span style="display:inline-block;background:${color}1A;color:${color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em;">${label}</span>`;
}

// ─── Template 1 — Project Invitation ─────────────────────────────────────────
export function makeInvitationEmail(opts: {
  lang: string;
  projectName: string;
  role: string;
  invitedByName: string;
  invitedEmail: string;
  projectId: number;
}): string {
  const url = `${APP_URL}/register?email=${encodeURIComponent(opts.invitedEmail)}`;
  const isEs = opts.lang === "es";
  const body = `
    ${heading(isEs ? `Has sido invitado a unirte a ${opts.projectName} en BIMLog` : `You have been invited to join ${opts.projectName} on BIMLog`)}
    ${para(isEs ? `<strong>${opts.invitedByName}</strong> te ha invitado a colaborar en <strong>${opts.projectName}</strong> en la plataforma BIMLog.` : `<strong>${opts.invitedByName}</strong> has invited you to collaborate on <strong>${opts.projectName}</strong> on the BIMLog platform.`)}
    ${table(
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Tu Rol" : "Your Role", opts.role) +
      field(isEs ? "Invitado por" : "Invited By", opts.invitedByName)
    )}
    ${btn(url, isEs ? "Aceptar Invitación y Crear Cuenta" : "Accept Invitation & Create Account")}
    ${para(isEs ? "<small>Si no esperabas esta invitación puedes ignorar este correo.</small>" : "<small>If you were not expecting this invitation you can safely ignore this email.</small>")}
  `;
  return emailWrapper(body);
}

// ─── Template 2 — RFI Assigned ────────────────────────────────────────────────
export function makeRfiAssignedEmail(opts: {
  lang: string;
  rfiNumber: string;
  subject: string;
  projectName: string;
  submittedByName: string;
  dateRequired: string | null;
  projectId: number;
  rfiId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/rfis`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("RFI", "#1E40AF")}
    ${heading(isEs ? `Nuevo RFI Asignado: ${opts.rfiNumber}` : `New RFI Assigned: ${opts.rfiNumber}`)}
    ${para(isEs ? `Se ha creado un nuevo RFI que requiere tu respuesta.` : `A new RFI has been created that requires your response.`)}
    ${table(
      field(isEs ? "Número de RFI" : "RFI Number", opts.rfiNumber) +
      field(isEs ? "Asunto" : "Subject", opts.subject) +
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Enviado por" : "Submitted By", opts.submittedByName) +
      field(isEs ? "Fecha Requerida" : "Date Required", opts.dateRequired || "—")
    )}
    ${btn(url, isEs ? "Ver RFI" : "View RFI")}
  `;
  return emailWrapper(body);
}

// ─── Template 3 — RFI Overdue ─────────────────────────────────────────────────
export function makeRfiOverdueEmail(opts: {
  lang: string;
  rfiNumber: string;
  subject: string;
  projectName: string;
  daysOverdue: number;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/rfis`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("OVERDUE", "#DC2626")}
    ${heading(isEs ? `VENCIDO: RFI ${opts.rfiNumber} — Respuesta requerida` : `OVERDUE: RFI ${opts.rfiNumber} — Response required`)}
    ${para(isEs ? `Este RFI está vencido por <strong>${opts.daysOverdue} día${opts.daysOverdue !== 1 ? "s" : ""}</strong> y aún no ha sido respondido.` : `This RFI is overdue by <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""}</strong> and has not yet been responded to.`)}
    ${table(
      field(isEs ? "Número de RFI" : "RFI Number", opts.rfiNumber) +
      field(isEs ? "Asunto" : "Subject", opts.subject) +
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Días Vencido" : "Days Overdue", String(opts.daysOverdue))
    )}
    ${btn(url, isEs ? "Ver RFI" : "View RFI")}
  `;
  return emailWrapper(body);
}

// ─── Template 4 — Submittal Assigned ─────────────────────────────────────────
export function makeSubmittalAssignedEmail(opts: {
  lang: string;
  submittalNumber: string;
  title: string;
  specSection: string | null;
  projectName: string;
  submittedByName: string;
  dateRequired: string | null;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/submittals`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("SUBMITTAL", "#7C3AED")}
    ${heading(isEs ? `Nuevo Entregable para Revisión: ${opts.submittalNumber}` : `New Submittal for Review: ${opts.submittalNumber}`)}
    ${para(isEs ? `Se ha enviado un nuevo entregable que requiere tu revisión.` : `A new submittal has been submitted that requires your review.`)}
    ${table(
      field(isEs ? "Número" : "Number", opts.submittalNumber) +
      field(isEs ? "Título" : "Title", opts.title) +
      field(isEs ? "Sección de Especificación" : "Spec Section", opts.specSection || "—") +
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Enviado por" : "Submitted By", opts.submittedByName) +
      field(isEs ? "Fecha Requerida" : "Date Required", opts.dateRequired || "—")
    )}
    ${btn(url, isEs ? "Ver Entregable" : "View Submittal")}
  `;
  return emailWrapper(body);
}

// ─── Template 5 — Submittal Overdue ──────────────────────────────────────────
export function makeSubmittalOverdueEmail(opts: {
  lang: string;
  submittalNumber: string;
  title: string;
  projectName: string;
  daysOverdue: number;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/submittals`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("OVERDUE", "#DC2626")}
    ${heading(isEs ? `VENCIDO: Revisión de Entregable ${opts.submittalNumber} requerida` : `OVERDUE: Submittal ${opts.submittalNumber} review required`)}
    ${para(isEs ? `Este entregable está vencido por <strong>${opts.daysOverdue} día${opts.daysOverdue !== 1 ? "s" : ""}</strong> y aún no ha sido revisado.` : `This submittal is overdue by <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""}</strong> and has not yet been reviewed.`)}
    ${table(
      field(isEs ? "Número" : "Number", opts.submittalNumber) +
      field(isEs ? "Título" : "Title", opts.title) +
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Días Vencido" : "Days Overdue", String(opts.daysOverdue))
    )}
    ${btn(url, isEs ? "Ver Entregable" : "View Submittal")}
  `;
  return emailWrapper(body);
}

// ─── Template 6 — Naming Violation ───────────────────────────────────────────
export function makeNamingViolationEmail(opts: {
  lang: string;
  fileName: string;
  projectName: string;
  failedFields: string[];
  projectId: number;
  recipientName: string;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/files`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("NAMING VIOLATION", "#D97706")}
    ${heading(isEs ? `Violación de Convención de Nombres Detectada` : `Naming Violation Detected`)}
    ${para(isEs ? `El archivo <strong>${opts.fileName}</strong> en el proyecto <strong>${opts.projectName}</strong> fue rechazado porque no cumple con la convención de nombres activa.` : `The file <strong>${opts.fileName}</strong> in project <strong>${opts.projectName}</strong> was rejected because it does not comply with the active naming convention.`)}
    ${table(
      field(isEs ? "Archivo Rechazado" : "Rejected File", opts.fileName) +
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Campos Fallidos" : "Failed Fields", opts.failedFields.join(", ") || "—")
    )}
    ${btn(url, isEs ? "Ver Archivos del Proyecto" : "View Project Files")}
  `;
  return emailWrapper(body);
}

// ─── Template 7 — Procurement Before Approval ────────────────────────────────
export function makeProcurementAlertEmail(opts: {
  lang: string;
  submittalNumber: string;
  title: string;
  procurementStatus: string;
  projectName: string;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/submittals`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("ALERT", "#DC2626")}
    ${heading(isEs ? `ALERTA: Adquisición Antes de Aprobación — ${opts.submittalNumber}` : `ALERT: Procurement Before Approval — ${opts.submittalNumber}`)}
    ${para(isEs ? `Un entregable ha sido marcado como <strong>${opts.procurementStatus}</strong> pero aún <strong>no ha sido aprobado</strong>. Esto puede representar un riesgo contractual significativo.` : `A submittal has been marked as <strong>${opts.procurementStatus}</strong> but has <strong>not yet been approved</strong>. This may represent a significant contractual risk.`)}
    ${table(
      field(isEs ? "Número de Entregable" : "Submittal Number", opts.submittalNumber) +
      field(isEs ? "Título" : "Title", opts.title) +
      field(isEs ? "Estado de Adquisición" : "Procurement Status", opts.procurementStatus) +
      field(isEs ? "Proyecto" : "Project", opts.projectName)
    )}
    ${btn(url, isEs ? "Ver Entregable" : "View Submittal")}
  `;
  return emailWrapper(body);
}

// ─── Template 8 — Rapid Approval ─────────────────────────────────────────────
export function makeRapidApprovalEmail(opts: {
  lang: string;
  submittalNumber: string;
  title: string;
  reviewerName: string;
  projectName: string;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/submittals`;
  const isEs = opts.lang === "es";
  const body = `
    ${badge("WARNING", "#D97706")}
    ${heading(isEs ? `ADVERTENCIA: Aprobación Rápida Detectada — ${opts.submittalNumber}` : `WARNING: Rapid Approval Detected — ${opts.submittalNumber}`)}
    ${para(isEs ? `El entregable <strong>${opts.submittalNumber}</strong> fue aprobado en menos de 60 segundos desde la primera apertura. Es posible que no haya sido revisado adecuadamente.` : `Submittal <strong>${opts.submittalNumber}</strong> was approved in under 60 seconds of first being opened. The review may not have been conducted properly.`)}
    ${table(
      field(isEs ? "Número de Entregable" : "Submittal Number", opts.submittalNumber) +
      field(isEs ? "Título" : "Title", opts.title) +
      field(isEs ? "Revisado por" : "Reviewed By", opts.reviewerName) +
      field(isEs ? "Proyecto" : "Project", opts.projectName)
    )}
    ${btn(url, isEs ? "Ver Entregable" : "View Submittal")}
  `;
  return emailWrapper(body);
}

// ─── Template 9 — Team Member Added ──────────────────────────────────────────
export function makeTeamMemberAddedEmail(opts: {
  lang: string;
  memberName: string;
  projectName: string;
  role: string;
  addedByName: string;
  projectId: number;
}): string {
  const url = `${APP_URL}/projects/${opts.projectId}/team`;
  const isEs = opts.lang === "es";
  const body = `
    ${heading(isEs ? `Has sido agregado a ${opts.projectName} en BIMLog` : `You have been added to ${opts.projectName} on BIMLog`)}
    ${para(isEs ? `<strong>${opts.addedByName}</strong> te ha agregado como miembro del proyecto <strong>${opts.projectName}</strong>.` : `<strong>${opts.addedByName}</strong> has added you to the project <strong>${opts.projectName}</strong>.`)}
    ${table(
      field(isEs ? "Proyecto" : "Project", opts.projectName) +
      field(isEs ? "Tu Rol" : "Your Role", opts.role) +
      field(isEs ? "Agregado por" : "Added By", opts.addedByName)
    )}
    ${btn(url, isEs ? "Ir al Proyecto" : "Go to Project")}
  `;
  return emailWrapper(body);
}

// ─── Template 10 — Password Reset ────────────────────────────────────────────
export function makePasswordResetEmail(opts: {
  lang: string;
  token: string;
  recipientName: string;
}): string {
  const url = `${APP_URL}/reset-password?token=${opts.token}`;
  const isEs = opts.lang === "es";
  const body = `
    ${heading(isEs ? "Restablece tu contraseña de BIMLog" : "Reset your BIMLog password")}
    ${para(isEs ? `Hola ${opts.recipientName}, recibimos una solicitud para restablecer la contraseña de tu cuenta de BIMLog.` : `Hi ${opts.recipientName}, we received a request to reset the password for your BIMLog account.`)}
    ${para(isEs ? "Haz clic en el botón a continuación para restablecer tu contraseña. Este enlace expira en <strong>1 hora</strong>." : "Click the button below to reset your password. This link expires in <strong>1 hour</strong>.")}
    ${btn(url, isEs ? "Restablecer Contraseña" : "Reset Password")}
    ${para(isEs ? "<small>Si no solicitaste un restablecimiento de contraseña puedes ignorar este correo. Tu contraseña no cambiará.</small>" : "<small>If you did not request a password reset you can safely ignore this email. Your password will not change.</small>")}
  `;
  return emailWrapper(body);
}

// ─── Helper: get lang from notification_preferences ──────────────────────────
export function getUserLang(prefs: unknown): string {
  if (prefs && typeof prefs === "object" && "lang" in prefs) {
    return (prefs as Record<string, string>).lang === "es" ? "es" : "en";
  }
  return "en";
}

// ─── Helper: check if notification type is enabled ────────────────────────────
export function notifEnabled(prefs: unknown, key: string): boolean {
  if (prefs && typeof prefs === "object" && key in prefs) {
    return (prefs as Record<string, boolean>)[key] !== false;
  }
  return true; // Default: enabled
}
