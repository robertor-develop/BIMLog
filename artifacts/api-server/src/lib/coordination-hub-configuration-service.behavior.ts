import assert from "node:assert/strict";
import { CoordinationConflictError } from "./coordination-hub-service";
import { ConnectorValidationUnavailableError, CoordinationHubConfigurationService, type ConnectorCredentialRecord, type CoordinationHubConfigurationStore, type CoordinationHubConfigurationTransaction, type SharePointFolderMappingRecord, type SharePointProjectMappingRecord } from "./coordination-hub-configuration-service";

let authorityChecks = 0;
let transactions = 0;
const credentials = new Map<string, ConnectorCredentialRecord>();
const activeCredentialIds = new Set<string>();
const mappings = new Map<number, SharePointProjectMappingRecord>();
const folders = new Map<string, SharePointFolderMappingRecord[]>();
const validationAudits: Array<{ credentialId: string; valid: boolean; evidenceCode: string }> = [];
const rotationAudits: Array<{ credentialId: string; previousKeyVersion: number; keyVersion: number }> = [];
const transaction: CoordinationHubConfigurationTransaction = {
  assertProjectAdminAuthority: async (scope) => { authorityChecks += 1; if (scope.projectId !== 7 || scope.companyId !== 3 || scope.actorUserId !== 11) throw new CoordinationConflictError("forbidden"); },
  findCredential: async (companyId, credentialId) => { const record = credentials.get(credentialId); return record?.companyId === companyId ? record : null; },
  insertPendingCredential: async (record) => { credentials.set(record.id, record); },
  rotateActiveCredential: async (input) => {
    const current = credentials.get(input.credential.id);
    if (!current || current.companyId !== input.scope.companyId || current.provider !== input.credential.provider || current.state !== input.expectedState || current.envelope.keyVersion !== input.expectedKeyVersion) return "stale";
    credentials.set(current.id, { ...current, envelope: input.credential.envelope, state: "pending_validation" });
    activeCredentialIds.delete(current.id);
    rotationAudits.push({ credentialId: current.id, previousKeyVersion: input.expectedKeyVersion, keyVersion: input.credential.envelope.keyVersion });
    return "rotated";
  },
  finalizeCredentialValidation: async ({ credential, valid, evidenceCode }) => {
    const current = credentials.get(credential.id);
    if (!current || current.companyId !== credential.companyId || current.provider !== credential.provider || current.label !== credential.label || current.envelope.keyVersion !== credential.keyVersion || current.state !== "pending_validation") return "stale";
    validationAudits.push({ credentialId: credential.id, valid, evidenceCode });
    if (valid) { credentials.set(current.id, { ...current, state: "active" }); activeCredentialIds.add(current.id); return "activated"; }
    return "rejected";
  },
  assertActiveSharePointCredential: async (companyId, credentialId) => { const record = credentials.get(credentialId); if (!record || record.companyId !== companyId || record.provider !== "sharepoint" || !activeCredentialIds.has(credentialId)) throw new CoordinationConflictError("credential unavailable"); },
  findSharePointProjectMapping: async (projectId) => mappings.get(projectId) ?? null,
  listSharePointFolderMappings: async (mappingId) => folders.get(mappingId) ?? [],
  insertSharePointProjectMapping: async (record) => { mappings.set(record.projectId, record); },
  insertSharePointFolderMapping: async (record) => { folders.set(record.projectMappingId, [...(folders.get(record.projectMappingId) ?? []), record]); },
};
const store: CoordinationHubConfigurationStore = { transaction: async (work) => { transactions += 1; return work(transaction); } };
const validatorInputs: unknown[] = [];
let validatorResult = { valid: true, evidenceCode: "SHAREPOINT_OK" };
const service = new CoordinationHubConfigurationService(store, { validate: async (input) => { validatorInputs.push(input); return validatorResult; } });
const scope = { projectId: 7, companyId: 3, actorUserId: 11 };
const envelope = { secretCiphertext: "c".repeat(32), secretIv: "i".repeat(16), secretTag: "t".repeat(16), wrappedDataKey: "k".repeat(32), wrapIv: "w".repeat(16), wrapTag: "g".repeat(16), keyVersion: 1 };
const credentialCommand = { scope, credential: { id: "credential-1", provider: "sharepoint", label: "Coordination SharePoint", envelope } };

assert.deepEqual(await service.registerCredential(credentialCommand), { result: "created", credentialId: "credential-1", state: "pending_validation" });
assert.deepEqual(await service.registerCredential(credentialCommand), { result: "idempotent", credentialId: "credential-1", state: "pending_validation" });
await assert.rejects(() => service.registerCredential({ ...credentialCommand, credential: { ...credentialCommand.credential, label: "Changed" } }), CoordinationConflictError);
await assert.rejects(() => service.registerCredential({ scope, credential: { id: "credential-plain", provider: "sharepoint", label: "Unsafe", secret: "plaintext" } }));
assert.deepEqual(await service.validateCredential({ scope, credentialId: "credential-1", expectedState: "pending_validation" }), { result: "activated", credentialId: "credential-1", state: "active", evidenceCode: "SHAREPOINT_OK" });
assert.deepEqual(await service.validateCredential({ scope, credentialId: "credential-1", expectedState: "pending_validation" }), { result: "idempotent", credentialId: "credential-1", state: "active", evidenceCode: "ALREADY_ACTIVE" });
assert.equal(validatorInputs.length, 1);
assert.equal("envelope" in (validatorInputs[0] as Record<string, unknown>), false);
assert.equal("secretCiphertext" in (validatorInputs[0] as Record<string, unknown>), false);
assert.match(String((validatorInputs[0] as Record<string, unknown>).configurationDigest), /^[a-f0-9]{64}$/);

const rejectedCommand = { scope, credential: { ...credentialCommand.credential, id: "credential-rejected", label: "Rejected" } };
await service.registerCredential(rejectedCommand);
validatorResult = { valid: false, evidenceCode: "PROVIDER_DENIED" };
assert.deepEqual(await service.validateCredential({ scope, credentialId: "credential-rejected", expectedState: "pending_validation" }), { result: "rejected", credentialId: "credential-rejected", state: "pending_validation", evidenceCode: "PROVIDER_DENIED" });
assert.equal(credentials.get("credential-rejected")?.state, "pending_validation");
assert.deepEqual(validationAudits, [
  { credentialId: "credential-1", valid: true, evidenceCode: "SHAREPOINT_OK" },
  { credentialId: "credential-rejected", valid: false, evidenceCode: "PROVIDER_DENIED" },
]);

const unavailable = new CoordinationHubConfigurationService(store);
await assert.rejects(() => unavailable.validateCredential({ scope, credentialId: "credential-rejected", expectedState: "pending_validation" }), ConnectorValidationUnavailableError);
const invalidValidator = new CoordinationHubConfigurationService(store, { validate: async () => ({ valid: true, evidenceCode: "unsafe evidence with spaces" }) });
await assert.rejects(() => invalidValidator.validateCredential({ scope, credentialId: "credential-rejected", expectedState: "pending_validation" }), /invalid governed result/);

const racingCredential = { ...credentials.get("credential-rejected")!, id: "credential-racing", label: "Racing" };
credentials.set(racingCredential.id, racingCredential);
const racingService = new CoordinationHubConfigurationService(store, { validate: async () => {
  credentials.set(racingCredential.id, { ...racingCredential, state: "revoked" });
  return { valid: true, evidenceCode: "PROVIDER_OK" };
} });
await assert.rejects(() => racingService.validateCredential({ scope, credentialId: racingCredential.id, expectedState: "pending_validation" }), CoordinationConflictError);
assert.equal(credentials.get(racingCredential.id)?.state, "revoked");
assert.equal(validationAudits.some((entry) => entry.credentialId === racingCredential.id), false);

const mappingCommand = {
  scope,
  mapping: { id: "mapping-1", credentialId: "credential-1", siteId: "site-1", libraryId: "library-1" },
  folders: [
    { id: "folder-map-1", category: "coordination", tradeId: null, folderId: "provider-folder-1", folderPath: "/Shared Documents/Coordination" },
    { id: "folder-map-2", category: "shop-drawings", tradeId: 9, folderId: "provider-folder-2", folderPath: "/Shared Documents/Shop Drawings" },
  ],
};
assert.deepEqual(await service.configureSharePointProject(mappingCommand), { result: "created", mappingId: "mapping-1", folderCount: 2 });
assert.deepEqual(await service.configureSharePointProject(mappingCommand), { result: "idempotent", mappingId: "mapping-1", folderCount: 2 });
await assert.rejects(() => service.configureSharePointProject({ ...mappingCommand, mapping: { ...mappingCommand.mapping, libraryId: "changed" } }), CoordinationConflictError);
await assert.rejects(() => service.configureSharePointProject({ ...mappingCommand, folders: [...mappingCommand.folders, { ...mappingCommand.folders[0], id: "duplicate" }] }));
await assert.rejects(() => service.configureSharePointProject({ ...mappingCommand, scope: { ...scope, projectId: 8 } }), CoordinationConflictError);
await assert.rejects(() => service.configureSharePointProject({ ...mappingCommand, folders: [{ ...mappingCommand.folders[0], folderPath: "/Shared Documents/../Private" }] }));

const rotatedEnvelope = { ...envelope, secretCiphertext: "r".repeat(32), keyVersion: 2 };
assert.deepEqual(await service.rotateCredential({ scope, credential: { id: "credential-1", provider: "sharepoint", envelope: rotatedEnvelope }, expectedState: "active", expectedKeyVersion: 1 }), {
  result: "rotated", credentialId: "credential-1", state: "pending_validation", previousKeyVersion: 1, keyVersion: 2,
});
assert.equal(credentials.get("credential-1")?.state, "pending_validation");
assert.deepEqual(rotationAudits, [{ credentialId: "credential-1", previousKeyVersion: 1, keyVersion: 2 }]);
await assert.rejects(() => service.rotateCredential({ scope, credential: { id: "credential-1", provider: "sharepoint", envelope: rotatedEnvelope }, expectedState: "active", expectedKeyVersion: 1 }), CoordinationConflictError);
await assert.rejects(() => service.rotateCredential({ scope, credential: { id: "credential-1", provider: "sharepoint", envelope: rotatedEnvelope }, expectedState: "pending_validation", expectedKeyVersion: 2 }));

assert.equal(credentials.size, 3);
assert.equal(mappings.size, 1);
assert.equal(folders.get("mapping-1")?.length, 2);
assert.equal(authorityChecks, 19);
assert.equal(transactions, 19);
console.log("coordination hub configuration service behavior: PASS");
