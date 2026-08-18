export const FEEDBACK_CUSTOMER_EVENT_TYPES = new Set(["submission_acknowledged", "staff_response", "staff_decision", "staff_fix", "staff_answer"]);
export const FEEDBACK_STAFF_RESPONSE_TYPES = new Set(["response", "decision", "fix", "answer"]);

export function feedbackEmailCopyEnabled(preferences: unknown, environment: NodeJS.ProcessEnv = process.env) {
  const prefs = preferences && typeof preferences === "object" && !Array.isArray(preferences) ? preferences as Record<string, unknown> : {};
  return prefs.feedback_email_copy === true && typeof environment.SENDGRID_API_KEY === "string" && environment.SENDGRID_API_KEY.length > 0;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export function feedbackEmailCopyHtml(stableId: string, responseType: string, message: string, actionUrl: string) {
  return `<p>BIMLog feedback <strong>${escapeHtml(stableId)}</strong> has a new ${escapeHtml(responseType)}.</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(actionUrl)}">Open feedback in BIMLog</a></p>`;
}
