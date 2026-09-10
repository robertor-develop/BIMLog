import { z } from "zod/v4";
import {
  EnvironmentConnectorKekLeaseSource,
  encryptLeasedConnectorBearerToken,
  type ConnectorKekLeaseSource,
} from "./connector-credential-envelope";
import {
  ConnectorCredentialEnrollmentInputError,
  EnvironmentConnectorEnrollmentKeyVersionSource,
  type ConnectorEnrollmentKeyVersionSource,
} from "./connector-credential-enrollment";
import { coordinationScopeSchema } from "./coordination-hub-service";
import type { RotateConnectorCredential } from "./coordination-hub-configuration-service";

const rotationSchema = z.object({
  scope: coordinationScopeSchema,
  credential: z.object({
    id: z.string().trim().min(1).max(1_024),
    provider: z.literal("sharepoint"),
    token: z.instanceof(Uint8Array).refine((value) => value.byteLength >= 16 && value.byteLength <= 8_192, "Credential token length is invalid"),
  }).strict(),
  expectedState: z.literal("active"),
  expectedKeyVersion: z.number().int().positive().max(2_147_483_647),
}).strict();

export interface ConnectorCredentialRotator {
  rotateCredential(input: RotateConnectorCredential): Promise<{ result: "rotated"; credentialId: string; state: "pending_validation"; previousKeyVersion: number; keyVersion: number }>;
}

export class ConnectorCredentialRotationService {
  constructor(
    private readonly rotator: ConnectorCredentialRotator,
    private readonly keySource: ConnectorKekLeaseSource,
    private readonly keyVersionSource: ConnectorEnrollmentKeyVersionSource,
  ) {}

  async rotate(rawInput: unknown): Promise<{ result: "rotated"; credentialId: string; state: "pending_validation"; previousKeyVersion: number; keyVersion: number }> {
    const possibleToken = rawInput && typeof rawInput === "object" && "credential" in rawInput
      && rawInput.credential && typeof rawInput.credential === "object" && "token" in rawInput.credential
      ? rawInput.credential.token : undefined;
    try {
      const command = rotationSchema.parse(rawInput);
      const keyVersion = this.keyVersionSource.current();
      const envelope = await encryptLeasedConnectorBearerToken({
        context: { credentialId: command.credential.id, companyId: command.scope.companyId, provider: command.credential.provider, keyVersion },
        token: command.credential.token,
        keySource: this.keySource,
      });
      return this.rotator.rotateCredential({
        scope: command.scope,
        credential: { id: command.credential.id, provider: command.credential.provider, envelope },
        expectedState: command.expectedState,
        expectedKeyVersion: command.expectedKeyVersion,
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

export function createRuntimeConnectorCredentialRotationService(rotator: ConnectorCredentialRotator): ConnectorCredentialRotationService {
  return new ConnectorCredentialRotationService(
    rotator,
    new EnvironmentConnectorKekLeaseSource(),
    new EnvironmentConnectorEnrollmentKeyVersionSource(),
  );
}
