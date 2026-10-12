import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type LaunchSecretEnvelope = Readonly<{ version: "v1"; keyVersion: string; iv: string; tag: string; ciphertext: string }>;

export class LaunchSecretError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

function parseKey(encoded: string | undefined) {
  if (!encoded) throw new LaunchSecretError("LAUNCH_CONFIGURATION_KEK_MISSING", "Launch configuration encryption is unavailable.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new LaunchSecretError("LAUNCH_CONFIGURATION_KEK_INVALID", "Launch configuration encryption is misconfigured.");
  return key;
}

function aad(environment: string, field: string, keyVersion: string) {
  if (!/^(development|staging|production)$/.test(environment) || !/^[a-z][a-zA-Z0-9]{1,80}$/.test(field)) throw new LaunchSecretError("LAUNCH_SECRET_CONTEXT_INVALID", "Secret context is invalid.");
  return Buffer.from(`bimlog-launch:${environment}:${field}:${keyVersion}`, "utf8");
}

export function encryptLaunchSecret(input: { environment: string; field: string; value: string; keyVersion?: string; encodedKey?: string }): LaunchSecretEnvelope {
  const value = input.value.trim();
  if (value.length < 8 || value.length > 8_192) throw new LaunchSecretError("LAUNCH_SECRET_INVALID", "Secret value is invalid.");
  const keyVersion = input.keyVersion ?? "v1", key = parseKey(input.encodedKey ?? process.env[`BIMLOG_LAUNCH_KEK_${keyVersion.toUpperCase()}`]);
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(input.environment, input.field, keyVersion));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Object.freeze({ version: "v1", keyVersion, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") });
}

export function decryptLaunchSecret(input: { environment: string; field: string; envelope: LaunchSecretEnvelope; encodedKey?: string }): Buffer {
  try {
    const key = parseKey(input.encodedKey ?? process.env[`BIMLOG_LAUNCH_KEK_${input.envelope.keyVersion.toUpperCase()}`]);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.envelope.iv, "base64url"));
    decipher.setAAD(aad(input.environment, input.field, input.envelope.keyVersion));
    decipher.setAuthTag(Buffer.from(input.envelope.tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(input.envelope.ciphertext, "base64url")), decipher.final()]);
  } catch (error) {
    if (error instanceof LaunchSecretError) throw error;
    throw new LaunchSecretError("LAUNCH_SECRET_DECRYPT_FAILED", "Launch secret could not be decrypted.");
  }
}

export function maskLaunchSecret(envelope: LaunchSecretEnvelope | null | undefined) {
  return envelope ? `configured (${envelope.keyVersion})` : "not configured";
}
