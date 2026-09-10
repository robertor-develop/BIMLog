import { z } from "zod/v4";
import {
  EnvironmentConnectorKekLeaseSource,
  encryptLeasedConnectorBearerToken,
  type ConnectorKekLeaseSource,
} from "./connector-credential-envelope";
import { coordinationScopeSchema } from "./coordination-hub-service";
import type { RegisterConnectorCredential } from "./coordination-hub-configuration-service";

const enrollmentSchema = z.object({
  scope: coordinationScopeSchema,
  credential: z.object({
    id: z.string().trim().min(1).max(1_024),
    provider: z.literal("sharepoint"),
    label: z.string().trim().min(1).max(256),
    token: z.instanceof(Uint8Array).refine((value) => value.byteLength >= 16 && value.byteLength <= 8_192, "Credential token length is invalid"),
  }).strict(),
}).strict();

export class ConnectorCredentialEnrollmentInputError extends Error {
  readonly code = "CONNECTOR_CREDENTIAL_ENROLLMENT_INPUT_INVALID";
  constructor() { super("Connector credential enrollment input is invalid"); }
}

export interface ConnectorEnrollmentKeyVersionSource { current(): number; }

export class EnvironmentConnectorEnrollmentKeyVersionSource implements ConnectorEnrollmentKeyVersionSource {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}
  current(): number {
    const raw = this.environment.BIMLOG_CONNECTOR_ACTIVE_KEK_VERSION;
    if (!raw || !/^[1-9][0-9]{0,9}$/.test(raw)) throw new ConnectorCredentialEnrollmentInputError();
    const version = Number(raw);
    if (!Number.isSafeInteger(version) || version > 2_147_483_647) throw new ConnectorCredentialEnrollmentInputError();
    return version;
  }
}

export interface ConnectorCredentialRegistrar {
  registerCredential(input: RegisterConnectorCredential): Promise<{ result: "created" | "idempotent"; credentialId: string; state: "pending_validation" }>;
}

export class ConnectorCredentialEnrollmentService {
  constructor(
    private readonly registrar: ConnectorCredentialRegistrar,
    private readonly keySource: ConnectorKekLeaseSource,
    private readonly keyVersionSource: ConnectorEnrollmentKeyVersionSource,
  ) {}

  async enroll(rawInput: unknown): Promise<{ result: "created" | "idempotent"; credentialId: string; state: "pending_validation" }> {
    const possibleToken = rawInput && typeof rawInput === "object" && "credential" in rawInput
      && rawInput.credential && typeof rawInput.credential === "object" && "token" in rawInput.credential
      ? rawInput.credential.token : undefined;
    try {
      const command = enrollmentSchema.parse(rawInput);
      const keyVersion = this.keyVersionSource.current();
      const envelope = await encryptLeasedConnectorBearerToken({
        context: { credentialId: command.credential.id, companyId: command.scope.companyId, provider: command.credential.provider, keyVersion },
        token: command.credential.token,
        keySource: this.keySource,
      });
      return this.registrar.registerCredential({
        scope: command.scope,
        credential: { id: command.credential.id, provider: command.credential.provider, label: command.credential.label, envelope },
      });
    } catch (error) {
      if (error instanceof ConnectorCredentialEnrollmentInputError) throw error;
      if (error instanceof z.ZodError) throw new ConnectorCredentialEnrollmentInputError();
      throw error;
    } finally {
      if (possibleToken instanceof Uint8Array) possibleToken.fill(0);
    }
  }
}

export function decodeCanonicalConnectorEnrollmentToken(value: unknown): Buffer {
  if (typeof value !== "string" || value.length < 22 || value.length > 10_923 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ConnectorCredentialEnrollmentInputError();
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength < 16 || decoded.byteLength > 8_192 || decoded.toString("base64url") !== value) {
    decoded.fill(0);
    throw new ConnectorCredentialEnrollmentInputError();
  }
  return decoded;
}

export function createRuntimeConnectorCredentialEnrollmentService(registrar: ConnectorCredentialRegistrar): ConnectorCredentialEnrollmentService {
  return new ConnectorCredentialEnrollmentService(
    registrar,
    new EnvironmentConnectorKekLeaseSource(),
    new EnvironmentConnectorEnrollmentKeyVersionSource(),
  );
}
