import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

export const LIVING_BRIEF_GATE_KEY = "primary";

type QueryClient = {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

export type LivingBriefGateCredential = {
  credential_key: string;
  password_hash: string;
  version: number;
  updated_at: Date;
  session_invalidated_at: Date;
};

export type LivingBriefGateResetInput = {
  actorUserId: number;
  actorEmail: string;
  currentAccountPassword: string;
  newPassword: string;
  reason: string;
  confirmation: string;
  expectedCredentialVersion: number | null;
  failureAfterUpdate?: boolean;
};

export class LivingBriefGateError extends Error {
  constructor(public status: number, public code: string, message = "Living Brief gate update failed") {
    super(message);
  }
}

function normalizeReason(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateResetInput(input: LivingBriefGateResetInput): string {
  if (input.confirmation !== "RESET_LIVING_BRIEF_GATE") throw new LivingBriefGateError(400, "CONFIRMATION_REQUIRED");
  if (input.newPassword.length < 12 || input.newPassword.length > 128) throw new LivingBriefGateError(400, "INVALID_PASSWORD_LENGTH");
  const reason = normalizeReason(input.reason);
  if (reason.length < 10 || reason.length > 240) throw new LivingBriefGateError(400, "INVALID_REASON");
  if (!input.currentAccountPassword) throw new LivingBriefGateError(400, "ACCOUNT_REVALIDATION_REQUIRED");
  return reason;
}

export async function getLivingBriefGateCredential(client: QueryClient = pool): Promise<LivingBriefGateCredential | null> {
  const result = await client.query<LivingBriefGateCredential>(
    `SELECT credential_key, password_hash, version::int AS version, updated_at, session_invalidated_at
     FROM living_brief_gate_credentials
     WHERE credential_key=$1
     LIMIT 1`,
    [LIVING_BRIEF_GATE_KEY],
  );
  return result.rows[0] ?? null;
}

export async function verifyLivingBriefGatePassword(password: string): Promise<LivingBriefGateCredential | null> {
  const credential = await getLivingBriefGateCredential();
  if (!credential) return null;
  return await bcrypt.compare(password, credential.password_hash) ? credential : null;
}

async function revalidateSuperAdminAccount(client: QueryClient, actorUserId: number, currentAccountPassword: string): Promise<void> {
  const result = await client.query<{ password_hash: string; is_super_admin: boolean }>(
    `SELECT password_hash, is_super_admin FROM users WHERE id=$1 LIMIT 1`,
    [actorUserId],
  );
  const user = result.rows[0];
  if (!user?.is_super_admin) throw new LivingBriefGateError(403, "SUPER_ADMIN_REQUIRED");
  if (!(await bcrypt.compare(currentAccountPassword, user.password_hash))) {
    throw new LivingBriefGateError(403, "ACCOUNT_REVALIDATION_FAILED");
  }
}

export async function resetLivingBriefGateCredential(input: LivingBriefGateResetInput): Promise<{ version: number }> {
  const reason = validateResetInput(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('living_brief_gate_credential'))");
    await revalidateSuperAdminAccount(client, input.actorUserId, input.currentAccountPassword);
    const existing = await client.query<{ version: number }>(
      `SELECT version::int AS version FROM living_brief_gate_credentials WHERE credential_key=$1 FOR UPDATE`,
      [LIVING_BRIEF_GATE_KEY],
    );
    if (existing.rows.length && input.expectedCredentialVersion !== existing.rows[0]!.version) {
      throw new LivingBriefGateError(409, "STALE_GATE_CREDENTIAL_VERSION");
    }
    if (!existing.rows.length && input.expectedCredentialVersion !== null) {
      throw new LivingBriefGateError(409, "GATE_BOOTSTRAP_STATE_CHANGED");
    }
    const nextVersion = (existing.rows[0]?.version ?? 0) + 1;
    const nextHash = await bcrypt.hash(input.newPassword, 12);
    if (existing.rows.length) {
      await client.query(
        `UPDATE living_brief_gate_credentials
         SET password_hash=$2, version=$3, updated_at=now(), updated_by_user_id=$4, session_invalidated_at=now()
         WHERE credential_key=$1`,
        [LIVING_BRIEF_GATE_KEY, nextHash, nextVersion, input.actorUserId],
      );
    } else {
      await client.query(
        `INSERT INTO living_brief_gate_credentials
         (credential_key, password_hash, version, created_by_user_id, updated_by_user_id, session_invalidated_at)
         VALUES ($1, $2, $3, $4, $4, now())`,
        [LIVING_BRIEF_GATE_KEY, nextHash, nextVersion, input.actorUserId],
      );
    }
    await client.query(
      `INSERT INTO living_brief_gate_audit (action, actor_user_id, actor_email, reason, credential_version)
       VALUES ($1, $2, $3, $4, $5)`,
      [existing.rows.length ? "reset" : "bootstrap", input.actorUserId, input.actorEmail, reason, nextVersion],
    );
    if (input.failureAfterUpdate) throw new LivingBriefGateError(500, "SIMULATED_ROLLBACK");
    await client.query("COMMIT");
    return { version: nextVersion };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
