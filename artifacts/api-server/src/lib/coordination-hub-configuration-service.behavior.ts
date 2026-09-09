import assert from "node:assert/strict";
import { CoordinationConflictError } from "./coordination-hub-service";
import { CoordinationHubConfigurationService, type ConnectorCredentialRecord, type CoordinationHubConfigurationStore, type CoordinationHubConfigurationTransaction, type SharePointFolderMappingRecord, type SharePointProjectMappingRecord } from "./coordination-hub-configuration-service";

let authorityChecks = 0;
let transactions = 0;
const credentials = new Map<string, ConnectorCredentialRecord>();
const activeCredentialIds = new Set<string>();
const mappings = new Map<number, SharePointProjectMappingRecord>();
const folders = new Map<string, SharePointFolderMappingRecord[]>();
const transaction: CoordinationHubConfigurationTransaction = {
  assertProjectAdminAuthority: async (scope) => { authorityChecks += 1; if (scope.projectId !== 7 || scope.companyId !== 3 || scope.actorUserId !== 11) throw new CoordinationConflictError("forbidden"); },
  findCredential: async (credentialId) => credentials.get(credentialId) ?? null,
  insertPendingCredential: async (record) => { credentials.set(record.id, record); },
  assertActiveSharePointCredential: async (companyId, credentialId) => { const record = credentials.get(credentialId); if (!record || record.companyId !== companyId || record.provider !== "sharepoint" || !activeCredentialIds.has(credentialId)) throw new CoordinationConflictError("credential unavailable"); },
  findSharePointProjectMapping: async (projectId) => mappings.get(projectId) ?? null,
  listSharePointFolderMappings: async (mappingId) => folders.get(mappingId) ?? [],
  insertSharePointProjectMapping: async (record) => { mappings.set(record.projectId, record); },
  insertSharePointFolderMapping: async (record) => { folders.set(record.projectMappingId, [...(folders.get(record.projectMappingId) ?? []), record]); },
};
const store: CoordinationHubConfigurationStore = { transaction: async (work) => { transactions += 1; return work(transaction); } };
const service = new CoordinationHubConfigurationService(store);
const scope = { projectId: 7, companyId: 3, actorUserId: 11 };
const envelope = { secretCiphertext: "c".repeat(32), secretIv: "i".repeat(16), secretTag: "t".repeat(16), wrappedDataKey: "k".repeat(32), wrapIv: "w".repeat(16), wrapTag: "g".repeat(16), keyVersion: 1 };
const credentialCommand = { scope, credential: { id: "credential-1", provider: "sharepoint", label: "Coordination SharePoint", envelope } };

assert.deepEqual(await service.registerCredential(credentialCommand), { result: "created", credentialId: "credential-1", state: "pending_validation" });
assert.deepEqual(await service.registerCredential(credentialCommand), { result: "idempotent", credentialId: "credential-1", state: "pending_validation" });
await assert.rejects(() => service.registerCredential({ ...credentialCommand, credential: { ...credentialCommand.credential, label: "Changed" } }), CoordinationConflictError);
await assert.rejects(() => service.registerCredential({ scope, credential: { id: "credential-plain", provider: "sharepoint", label: "Unsafe", secret: "plaintext" } }));
activeCredentialIds.add("credential-1");

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

assert.equal(credentials.size, 1);
assert.equal(mappings.size, 1);
assert.equal(folders.get("mapping-1")?.length, 2);
assert.equal(authorityChecks, 7);
assert.equal(transactions, 7);
console.log("coordination hub configuration service behavior: PASS");
