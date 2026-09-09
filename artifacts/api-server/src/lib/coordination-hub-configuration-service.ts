import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { protectedSecretEnvelopeSchema } from "./connector-foundation-contract";
import { CoordinationConflictError, coordinationScopeSchema, type CoordinationScope } from "./coordination-hub-service";

const id = z.string().trim().min(1).max(1_024);
const provider = z.enum(["sharepoint", "outlook", "procore"]);
const folderPath = z.string().trim().startsWith("/").max(4_096).refine(
  (value) => !value.split("/").some((segment) => segment === ".."),
  "Folder path cannot contain a parent traversal segment",
);

export const registerConnectorCredentialSchema = z.object({
  scope: coordinationScopeSchema,
  credential: z.object({
    id,
    provider,
    label: z.string().trim().min(1).max(256),
    envelope: protectedSecretEnvelopeSchema,
  }).strict(),
}).strict();

export const configureSharePointProjectSchema = z.object({
  scope: coordinationScopeSchema,
  mapping: z.object({ id, credentialId: id, siteId: id, libraryId: id }).strict(),
  folders: z.array(z.object({
    id,
    category: z.string().trim().min(1).max(128),
    tradeId: z.number().int().positive().nullable(),
    folderId: id,
    folderPath,
  }).strict()).min(1).max(100),
}).strict().superRefine((command, context) => {
  const identities = new Set<string>();
  for (const [index, folder] of command.folders.entries()) {
    const identity = `${folder.category}:${folder.tradeId ?? "all"}`;
    if (identities.has(identity)) context.addIssue({ code: "custom", path: ["folders", index], message: "Folder category/trade identity must be unique" });
    identities.add(identity);
  }
});

export const validateConnectorCredentialSchema = z.object({
  scope: coordinationScopeSchema,
  credentialId: id,
  expectedState: z.literal("pending_validation"),
}).strict();

const credentialValidationResultSchema = z.object({
  valid: z.boolean(),
  evidenceCode: z.string().trim().min(1).max(128).regex(/^[A-Z0-9][A-Z0-9_.:-]*$/),
}).strict();

export type RegisterConnectorCredential = z.infer<typeof registerConnectorCredentialSchema>;
export type ConfigureSharePointProject = z.infer<typeof configureSharePointProjectSchema>;
export type ValidateConnectorCredential = z.infer<typeof validateConnectorCredentialSchema>;
export type ConnectorCredentialRecord = RegisterConnectorCredential["credential"] & Pick<CoordinationScope, "companyId" | "actorUserId"> & { state: "pending_validation" | "active" | "disabled" | "revoked" };
export type SharePointProjectMappingRecord = ConfigureSharePointProject["mapping"] & Pick<CoordinationScope, "companyId" | "projectId" | "actorUserId"> & { state: "active" };
export type SharePointFolderMappingRecord = ConfigureSharePointProject["folders"][number] & Pick<CoordinationScope, "companyId" | "projectId" | "actorUserId"> & { projectMappingId: string; state: "active" };

export interface CoordinationHubConfigurationTransaction {
  assertProjectAdminAuthority(scope: CoordinationScope): Promise<void>;
  findCredential(companyId: number, id: string): Promise<ConnectorCredentialRecord | null>;
  insertPendingCredential(record: ConnectorCredentialRecord): Promise<void>;
  finalizeCredentialValidation(input: {
    scope: CoordinationScope;
    credential: Pick<ConnectorCredentialRecord, "id" | "companyId" | "provider" | "label"> & { keyVersion: number };
    valid: boolean;
    evidenceCode: string;
  }): Promise<"activated" | "rejected" | "stale">;
  assertActiveSharePointCredential(companyId: number, credentialId: string): Promise<void>;
  findSharePointProjectMapping(projectId: number): Promise<SharePointProjectMappingRecord | null>;
  listSharePointFolderMappings(projectMappingId: string): Promise<SharePointFolderMappingRecord[]>;
  insertSharePointProjectMapping(record: SharePointProjectMappingRecord): Promise<void>;
  insertSharePointFolderMapping(record: SharePointFolderMappingRecord): Promise<void>;
}

export interface CoordinationHubConfigurationStore {
  transaction<T>(work: (transaction: CoordinationHubConfigurationTransaction) => Promise<T>): Promise<T>;
}

export interface ConnectorCredentialValidationPort {
  validate(input: {
    credentialId: string;
    companyId: number;
    projectId: number;
    provider: ConnectorCredentialRecord["provider"];
    label: string;
    keyVersion: number;
    configurationDigest: string;
  }): Promise<unknown>;
}

export class ConnectorValidationUnavailableError extends Error {
  readonly code = "CONNECTOR_VALIDATION_UNAVAILABLE";
}

export const unavailableConnectorCredentialValidationPort: ConnectorCredentialValidationPort = {
  async validate(): Promise<never> {
    throw new ConnectorValidationUnavailableError("A governed provider validator is not configured");
  },
};

function sameCredential(left: ConnectorCredentialRecord, right: ConnectorCredentialRecord): boolean {
  return left.id === right.id && left.companyId === right.companyId && left.actorUserId === right.actorUserId && left.provider === right.provider && left.label === right.label && left.state === right.state
    && JSON.stringify(left.envelope) === JSON.stringify(right.envelope);
}

function sameProjectMapping(left: SharePointProjectMappingRecord, right: SharePointProjectMappingRecord): boolean {
  return left.id === right.id && left.companyId === right.companyId && left.projectId === right.projectId && left.actorUserId === right.actorUserId && left.credentialId === right.credentialId && left.siteId === right.siteId && left.libraryId === right.libraryId && left.state === right.state;
}

function canonicalFolders(records: SharePointFolderMappingRecord[]): string {
  return JSON.stringify(records.map(({ id: folderId, projectMappingId, companyId, projectId, actorUserId, category, tradeId, folderId: providerFolderId, folderPath, state }) => ({ id: folderId, projectMappingId, companyId, projectId, actorUserId, category, tradeId, folderId: providerFolderId, folderPath, state })).sort((left, right) => left.id.localeCompare(right.id)));
}

function configurationDigest(record: ConnectorCredentialRecord): string {
  return createHash("sha256").update(JSON.stringify({
    id: record.id,
    companyId: record.companyId,
    provider: record.provider,
    label: record.label,
    envelope: record.envelope,
  })).digest("hex");
}

export class CoordinationHubConfigurationService {
  constructor(
    private readonly store: CoordinationHubConfigurationStore,
    private readonly validator: ConnectorCredentialValidationPort = unavailableConnectorCredentialValidationPort,
  ) {}

  async registerCredential(input: unknown): Promise<{ result: "created" | "idempotent"; credentialId: string; state: "pending_validation" }> {
    const command = registerConnectorCredentialSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      await transaction.assertProjectAdminAuthority(command.scope);
      const record: ConnectorCredentialRecord = { ...command.credential, companyId: command.scope.companyId, actorUserId: command.scope.actorUserId, state: "pending_validation" };
      const existing = await transaction.findCredential(record.companyId, record.id);
      if (existing && !sameCredential(existing, record)) throw new CoordinationConflictError("Connector credential identity conflicts with existing protected configuration");
      if (!existing) await transaction.insertPendingCredential(record);
      return { result: existing ? "idempotent" : "created", credentialId: record.id, state: "pending_validation" };
    });
  }

  async validateCredential(input: unknown): Promise<{ result: "activated" | "idempotent" | "rejected"; credentialId: string; state: "active" | "pending_validation"; evidenceCode: string }> {
    const command = validateConnectorCredentialSchema.parse(input);
    const snapshot = await this.store.transaction(async (transaction) => {
      await transaction.assertProjectAdminAuthority(command.scope);
      const credential = await transaction.findCredential(command.scope.companyId, command.credentialId);
      if (!credential) throw new CoordinationConflictError("Connector credential is not registered for this company");
      if (credential.state === "active") return { credential, alreadyActive: true as const };
      if (credential.state !== command.expectedState) throw new CoordinationConflictError("Connector credential is not pending validation");
      return { credential, alreadyActive: false as const };
    });
    if (snapshot.alreadyActive) return { result: "idempotent", credentialId: snapshot.credential.id, state: "active", evidenceCode: "ALREADY_ACTIVE" };

    const validationResult = credentialValidationResultSchema.safeParse(await this.validator.validate({
      credentialId: snapshot.credential.id,
      companyId: snapshot.credential.companyId,
      projectId: command.scope.projectId,
      provider: snapshot.credential.provider,
      label: snapshot.credential.label,
      keyVersion: snapshot.credential.envelope.keyVersion,
      configurationDigest: configurationDigest(snapshot.credential),
    }));
    if (!validationResult.success) throw new Error("Connector validator returned an invalid governed result");
    const validation = validationResult.data;

    const finalized = await this.store.transaction(async (transaction) => {
      await transaction.assertProjectAdminAuthority(command.scope);
      return transaction.finalizeCredentialValidation({
        scope: command.scope,
        credential: {
          id: snapshot.credential.id,
          companyId: snapshot.credential.companyId,
          provider: snapshot.credential.provider,
          label: snapshot.credential.label,
          keyVersion: snapshot.credential.envelope.keyVersion,
        },
        valid: validation.valid,
        evidenceCode: validation.evidenceCode,
      });
    });
    if (finalized === "stale") throw new CoordinationConflictError("Connector credential changed while validation was in progress");
    return {
      result: finalized,
      credentialId: snapshot.credential.id,
      state: finalized === "activated" ? "active" : "pending_validation",
      evidenceCode: validation.evidenceCode,
    };
  }

  async configureSharePointProject(input: unknown): Promise<{ result: "created" | "idempotent"; mappingId: string; folderCount: number }> {
    const command = configureSharePointProjectSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      await transaction.assertProjectAdminAuthority(command.scope);
      await transaction.assertActiveSharePointCredential(command.scope.companyId, command.mapping.credentialId);
      const projectRecord: SharePointProjectMappingRecord = { ...command.mapping, companyId: command.scope.companyId, projectId: command.scope.projectId, actorUserId: command.scope.actorUserId, state: "active" };
      const folderRecords: SharePointFolderMappingRecord[] = command.folders.map((folder) => ({ ...folder, projectMappingId: command.mapping.id, companyId: command.scope.companyId, projectId: command.scope.projectId, actorUserId: command.scope.actorUserId, state: "active" }));
      const existing = await transaction.findSharePointProjectMapping(command.scope.projectId);
      if (existing) {
        if (!sameProjectMapping(existing, projectRecord)) throw new CoordinationConflictError("SharePoint project mapping conflicts with existing project authority");
        const existingFolders = await transaction.listSharePointFolderMappings(existing.id);
        if (canonicalFolders(existingFolders) !== canonicalFolders(folderRecords)) throw new CoordinationConflictError("SharePoint folder mappings conflict with existing immutable configuration");
        return { result: "idempotent", mappingId: existing.id, folderCount: existingFolders.length };
      }
      await transaction.insertSharePointProjectMapping(projectRecord);
      for (const folder of folderRecords) await transaction.insertSharePointFolderMapping(folder);
      return { result: "created", mappingId: projectRecord.id, folderCount: folderRecords.length };
    });
  }
}
