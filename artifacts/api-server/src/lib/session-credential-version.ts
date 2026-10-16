import crypto from "node:crypto";
export function credentialVersion(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);
}
