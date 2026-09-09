import { z } from "zod/v4";
import {
  ConnectorCredentialEnvelopeError,
  EnvironmentConnectorKekLeaseSource,
  decryptConnectorBearerToken,
  type ConnectorCredentialEnvelope,
  type ConnectorKekLeaseSource,
} from "./connector-credential-envelope";
import { ConnectorValidationUnavailableError } from "./coordination-hub-configuration-service";

const leaseRequestSchema = z.object({
  credentialId: z.string().trim().min(1).max(1_024),
  companyId: z.number().int().positive(),
  provider: z.literal("sharepoint"),
}).strict();

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };
type LeaseClient = { query(sql: string, values?: unknown[]): Promise<QueryResult>; release(): void };
export interface ConnectorCredentialLeasePool { connect(): Promise<LeaseClient>; }

const SELECT_PENDING_CREDENTIAL = `SELECT
 convert_to(id,'UTF8') AS "idBytes",
 company_id AS "companyId",
 convert_to(provider,'UTF8') AS "providerBytes",
 convert_to(state,'UTF8') AS "stateBytes",
 convert_to(secret_ciphertext,'UTF8') AS "secretCiphertextBytes",
 convert_to(secret_iv,'UTF8') AS "secretIvBytes",
 convert_to(secret_tag,'UTF8') AS "secretTagBytes",
 convert_to(wrapped_data_key,'UTF8') AS "wrappedDataKeyBytes",
 convert_to(wrap_iv,'UTF8') AS "wrapIvBytes",
 convert_to(wrap_tag,'UTF8') AS "wrapTagBytes",
 key_version AS "keyVersion"
 FROM connector_credentials
 WHERE id=$1 AND company_id=$2 AND provider=$3 AND state='pending_validation'
 LIMIT 1`;

function unavailable(): never {
  throw new ConnectorValidationUnavailableError("Protected connector credential lease is unavailable");
}

function exactBuffer(row: Record<string, unknown>, field: string): Buffer {
  const value = row[field];
  if (!Buffer.isBuffer(value) || value.byteLength < 1 || value.byteLength > 16_384) unavailable();
  return value;
}

function exactAscii(buffer: Buffer): string {
  const value = buffer.toString("ascii");
  const comparison = Buffer.from(value, "ascii");
  try {
    if (!value || !buffer.equals(comparison)) unavailable();
    return value;
  } finally { comparison.fill(0); }
}

function clearRowBuffers(row: Record<string, unknown> | undefined): void {
  if (!row) return;
  for (const value of Object.values(row)) if (Buffer.isBuffer(value)) value.fill(0);
}

export class PostgresConnectorCredentialLeaseResolver {
  constructor(
    private readonly database: ConnectorCredentialLeasePool,
    private readonly keySource: ConnectorKekLeaseSource,
  ) {}

  async withBearerToken<T>(rawInput: unknown, operation: (token: Uint8Array) => Promise<T>): Promise<T> {
    let input: z.infer<typeof leaseRequestSchema>;
    try { input = leaseRequestSchema.parse(rawInput); }
    catch { unavailable(); }

    let selected: Record<string, unknown> | undefined;
    let selectedRows: Array<Record<string, unknown>> = [];
    let envelope: ConnectorCredentialEnvelope | undefined;
    let token: Buffer | undefined;
    try {
      const client = await this.database.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const result = await client.query(SELECT_PENDING_CREDENTIAL, [input.credentialId, input.companyId, input.provider]);
        selectedRows = result.rows;
        if (result.rowCount !== 1 || result.rows.length !== 1) unavailable();
        selected = result.rows[0];
        if (!selected) unavailable();
        if (Number(selected.companyId) !== input.companyId || exactAscii(exactBuffer(selected, "idBytes")) !== input.credentialId
          || exactAscii(exactBuffer(selected, "providerBytes")) !== input.provider
          || exactAscii(exactBuffer(selected, "stateBytes")) !== "pending_validation") unavailable();
        const keyVersion = Number(selected.keyVersion);
        if (!Number.isSafeInteger(keyVersion) || keyVersion <= 0) unavailable();
        envelope = {
          secretCiphertext: exactAscii(exactBuffer(selected, "secretCiphertextBytes")),
          secretIv: exactAscii(exactBuffer(selected, "secretIvBytes")),
          secretTag: exactAscii(exactBuffer(selected, "secretTagBytes")),
          wrappedDataKey: exactAscii(exactBuffer(selected, "wrappedDataKeyBytes")),
          wrapIv: exactAscii(exactBuffer(selected, "wrapIvBytes")),
          wrapTag: exactAscii(exactBuffer(selected, "wrapTagBytes")),
          keyVersion,
        };
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { client.release(); }

      token = await decryptConnectorBearerToken({
        context: { credentialId: input.credentialId, companyId: input.companyId, provider: input.provider, keyVersion: envelope.keyVersion },
        envelope,
        keySource: this.keySource,
      });
    } catch (error) {
      if (error instanceof ConnectorValidationUnavailableError) throw error;
      if (error instanceof ConnectorCredentialEnvelopeError) unavailable();
      unavailable();
    } finally {
      for (const row of selectedRows) clearRowBuffers(row);
      selectedRows = [];
      selected = undefined;
      envelope = undefined;
    }

    try { return await operation(token); }
    finally { token.fill(0); }
  }
}

export function createRuntimeConnectorCredentialLeaseResolver(): { withBearerToken<T>(input: unknown, operation: (token: Uint8Array) => Promise<T>): Promise<T> } {
  return {
    async withBearerToken<T>(input: unknown, operation: (token: Uint8Array) => Promise<T>): Promise<T> {
      try {
        const { pool } = await import("@workspace/db");
        return await new PostgresConnectorCredentialLeaseResolver(
          pool as unknown as ConnectorCredentialLeasePool,
          new EnvironmentConnectorKekLeaseSource(),
        ).withBearerToken(input, operation);
      } catch (error) {
        if (error instanceof ConnectorValidationUnavailableError) throw error;
        throw new ConnectorValidationUnavailableError("Protected connector credential lease is unavailable");
      }
    },
  };
}
