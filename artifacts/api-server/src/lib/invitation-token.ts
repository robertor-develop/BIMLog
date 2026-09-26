import { createHash, randomBytes } from "node:crypto";

export type InvitationPurpose = "company_join" | "project_collaboration";
export function invitationTokenHash(token: unknown): string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("INVITATION_INVALID");
  return createHash("sha256").update(token).digest("hex");
}
export function createInvitationCredential(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: invitationTokenHash(token), expiresAt: new Date(now.getTime() + 7 * 86400000) };
}
export function validateInvitationState(row: {
  purpose: string; status: string; expiresAt: Date | null; revokedAt: Date | null;
  email: string; tokenHash: string | null;
}, recipient?: string, now = new Date()) {
  if (!row.tokenHash || !["company_join", "project_collaboration"].includes(row.purpose)) throw new Error("INVITATION_REISSUE_REQUIRED");
  if (row.revokedAt || row.status !== "pending") throw new Error("INVITATION_UNAVAILABLE");
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) throw new Error("INVITATION_EXPIRED");
  if (recipient && row.email.trim().toLowerCase() !== recipient.trim().toLowerCase()) throw new Error("INVITATION_WRONG_ACCOUNT");
}

export function invitationLink(token: string) {
  invitationTokenHash(token);
  const base = new URL(process.env.BIMLOG_URL || "https://bimlog.app");
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("INVITATION_HOST_INVALID");
  // The fragment is not sent to web server access logs or Referer headers.
  return `${base.origin}/register#invite=${encodeURIComponent(token)}`;
}
