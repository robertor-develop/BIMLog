import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod/v4";
import { protectedSecretEnvelopeSchema } from "./connector-foundation-contract";

const ENVELOPE_SCHEMA = "bimlog.connector-credential-envelope.v1";
const PAYLOAD_PREFIX = Buffer.from("BIMLOG-CONNECTOR-BEARER-V1\0", "ascii");
const contextSchema = z.object({
  credentialId: z.string().trim().min(1).max(1_024),
  companyId: z.number().int().positive(),
  provider: z.literal("sharepoint"),
  keyVersion: z.number().int().positive().max(2_147_483_647),
}).strict();

export type ConnectorCredentialEnvelope = z.infer<typeof protectedSecretEnvelopeSchema>;
export type ConnectorCredentialContext = z.infer<typeof contextSchema>;

export class ConnectorCredentialEnvelopeError extends Error {
  readonly code = "CONNECTOR_CREDENTIAL_ENVELOPE_INVALID";
  constructor() { super("Connector credential envelope is unavailable"); }
}

export interface ConnectorKekLeaseSource {
  withKey<T>(keyVersion: number, operation: (key: Uint8Array) => Promise<T>): Promise<T>;
}

export class EnvironmentConnectorKekLeaseSource implements ConnectorKekLeaseSource {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  async withKey<T>(keyVersion: number, operation: (key: Uint8Array) => Promise<T>): Promise<T> {
    if (!Number.isSafeInteger(keyVersion) || keyVersion <= 0) throw new ConnectorCredentialEnvelopeError();
    const encoded = this.environment[`BIMLOG_CONNECTOR_KEK_V${keyVersion}`];
    const key = encoded ? decodeCanonicalBase64Url(encoded) : null;
    if (!key || key.byteLength !== 32) {
      key?.fill(0);
      throw new ConnectorCredentialEnvelopeError();
    }
    try { return await operation(key); }
    finally { key.fill(0); }
  }
}

export type ConnectorEnvelopeRandomSource = (size: number) => Buffer;

function fail(): never { throw new ConnectorCredentialEnvelopeError(); }

function encode(value: Uint8Array): string {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64url");
}

function decodeCanonicalBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    decoded.fill(0);
    fail();
  }
  return decoded;
}

function aad(context: ConnectorCredentialContext, purpose: "secret" | "wrapped-data-key"): Buffer {
  return Buffer.from(JSON.stringify({
    schema: ENVELOPE_SCHEMA,
    credentialId: context.credentialId,
    companyId: context.companyId,
    provider: context.provider,
    keyVersion: context.keyVersion,
    purpose,
  }), "utf8");
}

function exactRandomBytes(source: ConnectorEnvelopeRandomSource, size: number): Buffer {
  const bytes = source(size);
  if (!Buffer.isBuffer(bytes) || bytes.byteLength !== size) {
    if (bytes instanceof Uint8Array) bytes.fill(0);
    fail();
  }
  return bytes;
}

export async function encryptLeasedConnectorBearerToken(input: {
  context: ConnectorCredentialContext;
  token: Uint8Array;
  keySource: ConnectorKekLeaseSource;
  randomSource?: ConnectorEnvelopeRandomSource;
}): Promise<ConnectorCredentialEnvelope> {
  const token = input.token;
  try {
    const context = contextSchema.parse(input.context);
    if (!(token instanceof Uint8Array) || token.byteLength < 16 || token.byteLength > 8_192) fail();
    const randomSource = input.randomSource ?? randomBytes;
    return await input.keySource.withKey(context.keyVersion, async (leasedKey) => {
      if (!(leasedKey instanceof Uint8Array) || leasedKey.byteLength !== 32) fail();
      const key = Buffer.from(leasedKey.buffer, leasedKey.byteOffset, leasedKey.byteLength);
      const dataKey = exactRandomBytes(randomSource, 32);
      const secretIv = exactRandomBytes(randomSource, 12);
      const wrapIv = exactRandomBytes(randomSource, 12);
      const plaintext = Buffer.concat([PAYLOAD_PREFIX, Buffer.from(token.buffer, token.byteOffset, token.byteLength)]);
      try {
        const secretCipher = createCipheriv("aes-256-gcm", dataKey, secretIv);
        secretCipher.setAAD(aad(context, "secret"));
        const secretCiphertext = Buffer.concat([secretCipher.update(plaintext), secretCipher.final()]);
        const secretTag = secretCipher.getAuthTag();
        const wrapCipher = createCipheriv("aes-256-gcm", key, wrapIv);
        wrapCipher.setAAD(aad(context, "wrapped-data-key"));
        const wrappedDataKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
        const wrapTag = wrapCipher.getAuthTag();
        return protectedSecretEnvelopeSchema.parse({
          secretCiphertext: encode(secretCiphertext),
          secretIv: encode(secretIv),
          secretTag: encode(secretTag),
          wrappedDataKey: encode(wrappedDataKey),
          wrapIv: encode(wrapIv),
          wrapTag: encode(wrapTag),
          keyVersion: context.keyVersion,
        });
      } catch (error) {
        if (error instanceof ConnectorCredentialEnvelopeError) throw error;
        throw new ConnectorCredentialEnvelopeError();
      } finally {
        plaintext.fill(0);
        dataKey.fill(0);
        secretIv.fill(0);
        wrapIv.fill(0);
        leasedKey.fill(0);
      }
    });
  } catch (error) {
    if (error instanceof ConnectorCredentialEnvelopeError) throw error;
    throw new ConnectorCredentialEnvelopeError();
  } finally {
    if (token instanceof Uint8Array) token.fill(0);
  }
}

export async function decryptConnectorBearerToken(input: {
  context: ConnectorCredentialContext;
  envelope: unknown;
  keySource: ConnectorKekLeaseSource;
}): Promise<Buffer> {
  let secretCiphertext: Buffer | undefined;
  let secretIv: Buffer | undefined;
  let secretTag: Buffer | undefined;
  let wrappedDataKey: Buffer | undefined;
  let wrapIv: Buffer | undefined;
  let wrapTag: Buffer | undefined;
  let dataKey: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    const context = contextSchema.parse(input.context);
    const envelope = protectedSecretEnvelopeSchema.parse(input.envelope);
    if (envelope.keyVersion !== context.keyVersion) fail();
    secretCiphertext = decodeCanonicalBase64Url(envelope.secretCiphertext);
    secretIv = decodeCanonicalBase64Url(envelope.secretIv);
    secretTag = decodeCanonicalBase64Url(envelope.secretTag);
    wrappedDataKey = decodeCanonicalBase64Url(envelope.wrappedDataKey);
    wrapIv = decodeCanonicalBase64Url(envelope.wrapIv);
    wrapTag = decodeCanonicalBase64Url(envelope.wrapTag);
    if (secretIv.byteLength !== 12 || secretTag.byteLength !== 16 || wrappedDataKey.byteLength !== 32 || wrapIv.byteLength !== 12 || wrapTag.byteLength !== 16) fail();

    return await input.keySource.withKey(context.keyVersion, async (leasedKey) => {
      if (!(leasedKey instanceof Uint8Array) || leasedKey.byteLength !== 32) fail();
      const key = Buffer.from(leasedKey.buffer, leasedKey.byteOffset, leasedKey.byteLength);
      try {
        const unwrap = createDecipheriv("aes-256-gcm", key, wrapIv!);
        unwrap.setAAD(aad(context, "wrapped-data-key"));
        unwrap.setAuthTag(wrapTag!);
        dataKey = Buffer.concat([unwrap.update(wrappedDataKey!), unwrap.final()]);
        if (dataKey.byteLength !== 32) fail();
        const decipher = createDecipheriv("aes-256-gcm", dataKey, secretIv!);
        decipher.setAAD(aad(context, "secret"));
        decipher.setAuthTag(secretTag!);
        plaintext = Buffer.concat([decipher.update(secretCiphertext!), decipher.final()]);
        if (plaintext.byteLength < PAYLOAD_PREFIX.byteLength + 16 || plaintext.byteLength > PAYLOAD_PREFIX.byteLength + 8_192 || !plaintext.subarray(0, PAYLOAD_PREFIX.byteLength).equals(PAYLOAD_PREFIX)) fail();
        return Buffer.from(plaintext.subarray(PAYLOAD_PREFIX.byteLength));
      } finally { leasedKey.fill(0); }
    });
  } catch (error) {
    if (error instanceof ConnectorCredentialEnvelopeError) throw error;
    throw new ConnectorCredentialEnvelopeError();
  } finally {
    secretCiphertext?.fill(0);
    secretIv?.fill(0);
    secretTag?.fill(0);
    wrappedDataKey?.fill(0);
    wrapIv?.fill(0);
    wrapTag?.fill(0);
    dataKey?.fill(0);
    plaintext?.fill(0);
  }
}
