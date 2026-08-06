import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  commitProcoreRfiImport,
  createProductionProcoreRfiImportStore,
  assertAtomicImportRequest,
  PROCORE_RFI_ALLOWED_ROW_COUNT,
  PROCORE_RFI_ALLOWED_TARGET_PROJECT_ID,
  RFI_IMPORT_CAPABILITY,
  type CommitProcoreRfiImportInput,
  type ProductionRfiImportDatabase,
  type ProductionRfiImportTransaction,
  type StoredRfiImportReplay,
  type VerifiedRfiImportAuthorization,
} from "./procore-rfi-import-commit";
import {
  PROCORE_RFI_HEADERS,
  PROCORE_RFI_LIMITS,
  previewProcoreRfiCsv,
  previewUploadedProcoreRfiCsv,
  procoreProjectIdentityDigest,
  toProcoreRfiPreviewResponse,
} from "./procore-rfi-import";

const csvPath = process.argv[2];
function authorizedSyntheticFixture(): string {
  const lines = [PROCORE_RFI_HEADERS.join(",")];
  for (let number = 43; number >= 1; number -= 1) {
    const sourceNumber = number === 7 ? "East-7" : `East-${String(number).padStart(3, "0")}`;
    const seed: Record<string, string> = {
      Number: sourceNumber,
      Revision: number === 7 ? "1" : "0",
      Subject: number === 43 ? "PLUMBING - 1st Floor Site Drainage - Drawing Update Request" : `Synthetic RFI ${number}`,
      Status: number % 2 === 0 ? "Closed" : "Open",
      "Responsible Contractor Id": number === 43 ? "Supreme Mechanical" : "Synthetic Contractor",
      "Initiated At": "08/04/2026",
      "Due Date": "08/11/2026",
      "Closed Date": number % 2 === 0 ? "08/12/2026" : "",
      Private: "false",
    };
    lines.push(PROCORE_RFI_HEADERS.map((header) => seed[header] ?? "").join(","));
  }
  return `${lines.join("\n")}\n`;
}
const csv = csvPath ? await readFile(csvPath, "utf8") : authorizedSyntheticFixture();
const digest = createHash("sha256").update(csv, "utf8").digest("hex");
const project = { code: "50250001", name: "Elara East", address: "35-45 41st Street, Queens, New York 11101" };
const expectation = { sha256: digest, rowCount: 43, project };

const preview = previewProcoreRfiCsv(csv, expectation);
assert.equal(preview.valid, true, preview.errors.join("\n"));
assert.equal(preview.digest, digest);
assert.equal(preview.rowCount, 43);
assert.equal(preview.rows.length, 43);
assert.equal(new Set(preview.rows.map((row) => row.identity)).size, 43);
assert.equal(preview.rows[0].identity, "50250001/East-043/0");
assert.equal(preview.rows.at(-1)?.identity, "50250001/East-001/0");
assert.equal(preview.rows.find((row) => row.sourceNumber === "East-7")?.revision, 1);
assert.equal(preview.projectIdentityDigest, procoreProjectIdentityDigest(project));

const platformPreview = previewUploadedProcoreRfiCsv(csv, { code: "ANY-001", name: "Any BIMLog Project" });
assert.equal(platformPreview.valid, true, platformPreview.errors.join("\n"));
assert.equal(platformPreview.rowCount, 43);
assert.equal(platformPreview.rows[0]?.identity, "ANY-001/East-043/0");
const routesSource = await readFile(new URL("../routes/rfis.ts", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../../../bimlog/src/pages/project/RfisTab.tsx", import.meta.url), "utf8");
const platformRoute = routesSource.slice(routesSource.indexOf('router.post("/projects/:projectId/rfis/import",'));
assert.match(platformRoute, /requireProjectMember\(\)/);
assert.match(platformRoute, /previewUploadedProcoreRfiCsv/);
assert.match(platformRoute, /await db\.transaction\(async tx =>/);
const platformInput = uiSource.slice(uiSource.indexOf('ref={importFileInputRef}'), uiSource.indexOf('ref={importFileInputRef}') + 500);
assert.match(platformInput, /accept="\.csv,text\/csv,\.pdf,application\/pdf"/);
assert.match(platformInput, /onChange=\{handleImport\}/);
assert.doesNotMatch(platformInput, /projectId === 26/);

assert.equal(previewProcoreRfiCsv(csv, { ...expectation, sha256: "0".repeat(64) }).valid, false);
assert.deepEqual(previewProcoreRfiCsv(csv, { ...expectation, sha256: "0".repeat(64) }).errors, ["SOURCE_SHA256_MISMATCH"]);
assert.equal(previewProcoreRfiCsv(csv, { ...expectation, rowCount: 42 }).errors.includes("SOURCE_ROW_COUNT_MISMATCH"), true);
assert.equal(previewProcoreRfiCsv(csv, { ...expectation, project: { code: "", name: "" } }).errors.includes("PROCORE_PROJECT_IDENTITY_REQUIRED"), true);

const badHeader = `Unexpected,${csv.slice(csv.indexOf(",") + 1)}`;
assert.equal(previewProcoreRfiCsv(badHeader, { ...expectation, sha256: createHash("sha256").update(badHeader).digest("hex") }).errors.includes("HEADER_MISMATCH"), true);

const duplicateSeed: Record<string, string> = {
  Number: "East-test", Revision: "0", Subject: "Test", Status: "Open",
  "Initiated At": "08/04/2026", "Due Date": "08/11/26", Private: "false",
};
const duplicateValues = PROCORE_RFI_HEADERS.map((header) => duplicateSeed[header] ?? "");
const duplicateCsv = `${PROCORE_RFI_HEADERS.join(",")}\n${duplicateValues.join(",")}\n${duplicateValues.join(",")}\n`;
const duplicate = previewProcoreRfiCsv(duplicateCsv, {
  sha256: createHash("sha256").update(duplicateCsv).digest("hex"), rowCount: 2, project,
});
assert.equal(duplicate.valid, false);
assert.equal(duplicate.errors.some((error) => error.endsWith("DUPLICATE_NUMBER_REVISION")), true);

const secret = "PRIVATE-SOURCE-MARKER-DO-NOT-LEAK";
const firstSubject = "PLUMBING - 1st Floor Site Drainage - Drawing Update Request";
assert.equal(csv.includes(firstSubject), true);
const rawOnlyMarker = ",Supreme Mechanical,";
assert.equal(csv.includes(rawOnlyMarker), true);
const secretCsv = csv.replace(rawOnlyMarker, `,${secret},`);
const secretPreview = previewProcoreRfiCsv(secretCsv, {
  ...expectation, sha256: createHash("sha256").update(secretCsv).digest("hex"),
});
assert.equal(secretPreview.valid, true);
assert.equal(JSON.stringify(toProcoreRfiPreviewResponse(secretPreview)).includes(secret), false);
const oversizedCsv = csv.replace(rawOnlyMarker, `,${"x".repeat(8_193)},`);
const oversizedPreview = previewProcoreRfiCsv(oversizedCsv, {
  ...expectation, sha256: createHash("sha256").update(oversizedCsv).digest("hex"),
});
assert.equal(oversizedPreview.valid, false);
assert.equal(oversizedPreview.errors.some((error) => error.endsWith("TOO_LARGE")), true);
assert.equal(JSON.stringify(oversizedPreview.errors).includes("x".repeat(100)), false);

const tooLargeCsv = `${csv}${"x".repeat(PROCORE_RFI_LIMITS.csvBytes)}`;
assert.equal(previewProcoreRfiCsv(tooLargeCsv, {
  ...expectation, sha256: createHash("sha256").update(tooLargeCsv).digest("hex"),
}).errors.includes("CSV_TOO_LARGE"), true);
assert.equal(previewProcoreRfiCsv(csv, {
  ...expectation, project: { ...project, code: "p".repeat(PROCORE_RFI_LIMITS.projectCodeBytes + 1) },
}).errors.includes("PROCORE_PROJECT_IDENTITY_TOO_LARGE"), true);

function syntheticCsv(rowCount: number, retainedField = ""): string {
  const lines = [PROCORE_RFI_HEADERS.join(",")];
  for (let index = 0; index < rowCount; index += 1) {
    const seed: Record<string, string> = {
      Number: `Synthetic-${index}`,
      Revision: "0",
      Subject: `Synthetic ${index}`,
      Status: "Open",
      "Initiated At": "08/04/2026",
      "Due Date": "08/11/2026",
      Private: "false",
      "Responsible Contractor Id": retainedField,
      "Received From Id": retainedField,
      "RFI Manager": retainedField,
      "Assigned Id": retainedField,
      "Ball In Court": retainedField,
      "Location Id": retainedField,
      "Cost Code": retainedField,
    };
    lines.push(PROCORE_RFI_HEADERS.map((header) => seed[header] ?? "").join(","));
  }
  return `${lines.join("\n")}\n`;
}

const tooManyRowsCsv = syntheticCsv(PROCORE_RFI_LIMITS.rows + 1);
const tooManyRows = previewProcoreRfiCsv(tooManyRowsCsv, {
  sha256: createHash("sha256").update(tooManyRowsCsv).digest("hex"),
  rowCount: PROCORE_RFI_LIMITS.rows + 1,
  project,
});
assert.equal(tooManyRows.errors.includes("EXPECTED_ROW_COUNT_INVALID"), true);
assert.equal(tooManyRows.errors.includes("ROW_LIMIT_EXCEEDED"), true);

const aggregateCsv = syntheticCsv(90, "a".repeat(7_000));
assert.equal(Buffer.byteLength(aggregateCsv, "utf8") < PROCORE_RFI_LIMITS.csvBytes, true);
const aggregatePreview = previewProcoreRfiCsv(aggregateCsv, {
  sha256: createHash("sha256").update(aggregateCsv).digest("hex"), rowCount: 90, project,
});
assert.equal(aggregatePreview.errors.includes("AGGREGATE_PAYLOAD_TOO_LARGE"), true);

const validAuthorization: VerifiedRfiImportAuthorization = {
  bindingId: 71,
  bindingVersion: 3,
  bindingAuditIdentity: "binding-audit-immutable-71-v3",
  projectId: 26,
  projectCode: "ELA01",
  companyId: 9,
  provider: "procore",
  sourceProjectCode: project.code,
  sourceProjectIdentityDigest: procoreProjectIdentityDigest(project),
  capability: RFI_IMPORT_CAPABILITY,
  current: true,
  revokedAt: null,
  actorUserId: 14,
  actorAuthorized: true,
};

type MemoryState = {
  imports: Map<string, StoredRfiImportReplay>;
  identities: Set<string>;
  sequence: number;
};

class MemoryTransactionalDatabase implements ProductionRfiImportDatabase {
  authorization: VerifiedRfiImportAuthorization | null = validAuthorization;
  private state: MemoryState = { imports: new Map(), identities: new Set(), sequence: 100 };
  private serial: Promise<void> = Promise.resolve();
  failNext = false;
  transactionCount = 0;

  get importCount(): number { return this.state.imports.size; }

  async transaction<T>(work: (transaction: ProductionRfiImportTransaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.serial;
    this.serial = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      this.transactionCount += 1;
      const draft: MemoryState = {
        imports: new Map(this.state.imports),
        identities: new Set(this.state.identities),
        sequence: this.state.sequence,
      };
      const transaction: ProductionRfiImportTransaction = {
        lockAndLoadAuthorization: async () => this.authorization,
        findReplay: async (requirement, idempotencyKey) => (
          draft.imports.get(`${requirement.projectId}/${requirement.provider}/${requirement.sourceProjectCode}/${idempotencyKey}`) ?? null
        ),
        countSourceDuplicates: async (requirement, rows) => rows.filter((row) => (
          draft.identities.has(`${requirement.projectId}/${requirement.provider}/${requirement.sourceProjectCode}/${row.sourceNumber}/${row.sourceRevision}`)
        )).length,
        insertImportWithRows: async (authorization, request) => {
          const importId = draft.sequence++;
          draft.imports.set(`${request.authorization.projectId}/${request.authorization.provider}/${request.authorization.sourceProjectCode}/${request.idempotencyKey}`, {
            importId,
            sourceDigest: request.sourceDigest,
            sourceProjectIdentityDigest: request.authorization.sourceProjectIdentityDigest,
            rowCount: request.rowCount,
          });
          request.rows.forEach((row) => draft.identities.add(
            `${request.authorization.projectId}/${request.authorization.provider}/${request.authorization.sourceProjectCode}/${row.sourceNumber}/${row.sourceRevision}`,
          ));
          if (this.failNext) { this.failNext = false; throw new Error("SYNTHETIC_TRANSACTION_ROLLBACK"); }
          return { importId };
        },
      };
      const result = await work(transaction);
      this.state = draft;
      return result;
    } finally { release(); }
  }
}

const input: CommitProcoreRfiImportInput = {
  projectId: 26,
  expectedProjectCode: "ELA01",
  expectedCompanyId: 9,
  expectedSourceSha256: digest,
  expectedRowCount: 43,
  sourceProject: project,
  idempotencyKey: "customer-file-cb0088dc",
  csvText: csv,
  actorUserId: 14,
};
const controlSubjectCsv = csv.replace(firstSubject, `${firstSubject}\u0000Ruben`);

assert.equal(input.projectId, PROCORE_RFI_ALLOWED_TARGET_PROJECT_ID);
assert.equal(input.expectedRowCount, PROCORE_RFI_ALLOWED_ROW_COUNT);
let rejectedStoreCalls = 0;
const rejectedStore = {
  atomicImport: async () => {
    rejectedStoreCalls += 1;
    throw new Error("STORE_MUST_NOT_BE_CALLED");
  },
};
for (const rejectedInput of [
  { ...input, projectId: 27 },
  { ...input, expectedRowCount: 42 },
  { ...input, expectedProjectCode: " ELA01" },
  { ...input, expectedProjectCode: `ELA01\u0000RUBEN` },
  { ...input, idempotencyKey: ` ${input.idempotencyKey}` },
  { ...input, sourceProject: { ...project, name: `${project.name}\u0000Ruben` } },
  {
    ...input,
    csvText: controlSubjectCsv,
    expectedSourceSha256: createHash("sha256").update(controlSubjectCsv).digest("hex"),
  },
]) {
  await assert.rejects(
    commitProcoreRfiImport(rejectedInput, rejectedStore),
    /RFI_IMPORT_(TARGET_INVALID|IDEMPOTENCY_KEY_INVALID|INVALID:)/,
  );
}
assert.equal(rejectedStoreCalls, 0);

const invalidQuoteCsv = csv.replace(firstSubject, `${firstSubject}"unexpected`);
assert.equal(previewProcoreRfiCsv(invalidQuoteCsv, {
  ...expectation,
  sha256: createHash("sha256").update(invalidQuoteCsv).digest("hex"),
}).errors.includes("CSV_INVALID_QUOTE"), true);

const controlNumberCsv = csv.replace("East-043", "East-043\u0000Ruben");
const controlNumberPreview = previewProcoreRfiCsv(controlNumberCsv, {
  ...expectation,
  sha256: createHash("sha256").update(controlNumberCsv).digest("hex"),
});
assert.equal(controlNumberPreview.errors.some((error) => error.endsWith("NUMBER_CONTROL_CHARACTER")), true);

const controlSubjectPreview = previewProcoreRfiCsv(controlSubjectCsv, {
  ...expectation,
  sha256: createHash("sha256").update(controlSubjectCsv).digest("hex"),
});
assert.equal(controlSubjectPreview.valid, false);
assert.equal(controlSubjectPreview.errors.some((error) => error.endsWith("SUBJECT_CONTROL_CHARACTER")), true);
assert.equal(controlSubjectPreview.rows.length, 42);

for (const unsafeProject of [
  { ...project, code: `${project.code}\u0000Ruben` },
  { ...project, name: `${project.name}\u0000Ruben` },
  { ...project, address: `${project.address}\u0000Ruben` },
]) {
  const unsafeProjectPreview = previewProcoreRfiCsv(csv, { ...expectation, project: unsafeProject });
  assert.equal(unsafeProjectPreview.valid, false);
  assert.equal(unsafeProjectPreview.errors.includes("PROCORE_PROJECT_IDENTITY_CONTROL_CHARACTER"), true);
}

const validAtomicRequest = {
  authorization: {
    projectId: input.projectId,
    projectCode: input.expectedProjectCode,
    companyId: input.expectedCompanyId,
    provider: "procore" as const,
    sourceProjectCode: preview.project.code,
    sourceProjectIdentityDigest: preview.projectIdentityDigest,
    capability: RFI_IMPORT_CAPABILITY,
    actorUserId: input.actorUserId,
  },
  idempotencyKey: input.idempotencyKey,
  sourceDigest: preview.digest,
  rowCount: preview.rowCount,
  rows: preview.rows.map((row) => ({
    sourceNumber: row.sourceNumber,
    sourceRevision: row.revision,
    sourcePayload: row.raw,
  })),
};
assert.doesNotThrow(() => assertAtomicImportRequest(validAtomicRequest));
const invalidAtomicRequests = [
  { ...validAtomicRequest, sourceDigest: validAtomicRequest.sourceDigest.toUpperCase() },
  {
    ...validAtomicRequest,
    authorization: {
      ...validAtomicRequest.authorization,
      sourceProjectIdentityDigest: validAtomicRequest.authorization.sourceProjectIdentityDigest.toUpperCase(),
    },
  },
  {
    ...validAtomicRequest,
    rows: validAtomicRequest.rows.map((row, index) => index === 0
      ? { ...row, sourcePayload: { ...row.sourcePayload, Number: "forged-number" } }
      : row),
  },
  {
    ...validAtomicRequest,
    rows: validAtomicRequest.rows.map((row, index) => index === 0
      ? { ...row, sourcePayload: { ...row.sourcePayload, Revision: String(row.sourceRevision + 1) } }
      : row),
  },
] as const;
let rejectedTransactionCalls = 0;
const guardedAtomicStore = createProductionProcoreRfiImportStore({
  transaction: async () => {
    rejectedTransactionCalls += 1;
    throw new Error("DATABASE_MUST_NOT_BE_CONNECTED");
  },
});
for (const invalidAtomicRequest of invalidAtomicRequests) {
  assert.throws(() => assertAtomicImportRequest(invalidAtomicRequest), /RFI_IMPORT_REQUEST_INVALID/);
  await assert.rejects(async () => guardedAtomicStore.atomicImport(invalidAtomicRequest), /RFI_IMPORT_REQUEST_INVALID/);
}
assert.equal(rejectedTransactionCalls, 0);

for (const denied of [
  null,
  { ...validAuthorization, actorAuthorized: false },
  { ...validAuthorization, current: false },
  { ...validAuthorization, revokedAt: "2026-08-05T00:00:00.000Z" },
  { ...validAuthorization, bindingVersion: 0 },
  { ...validAuthorization, capability: "RFI_READ" as typeof RFI_IMPORT_CAPABILITY },
  { ...validAuthorization, bindingAuditIdentity: "" },
]) {
  const database = new MemoryTransactionalDatabase();
  database.authorization = denied;
  await assert.rejects(
    commitProcoreRfiImport(input, createProductionProcoreRfiImportStore(database)),
    /RFI_IMPORT_AUTHORIZATION_DENIED/,
  );
}

await assert.rejects(
  commitProcoreRfiImport({ ...input, idempotencyKey: "x".repeat(129) }, createProductionProcoreRfiImportStore(new MemoryTransactionalDatabase())),
  /RFI_IMPORT_IDEMPOTENCY_KEY_INVALID/,
);

const concurrentDatabase = new MemoryTransactionalDatabase();
const concurrentStore = createProductionProcoreRfiImportStore(concurrentDatabase);
const concurrent = await Promise.all([
  commitProcoreRfiImport(input, concurrentStore),
  commitProcoreRfiImport(input, concurrentStore),
]);
assert.deepEqual(concurrent.map((result) => result.outcome).sort(), ["created", "replay"]);
assert.equal(concurrentDatabase.importCount, 1);
assert.equal(concurrentDatabase.transactionCount, 2);

const rollbackDatabase = new MemoryTransactionalDatabase();
const rollbackStore = createProductionProcoreRfiImportStore(rollbackDatabase);
rollbackDatabase.failNext = true;
await assert.rejects(commitProcoreRfiImport(input, rollbackStore), /SYNTHETIC_TRANSACTION_ROLLBACK/);
assert.equal(rollbackDatabase.importCount, 0);
assert.equal((await commitProcoreRfiImport(input, rollbackStore)).outcome, "created");
assert.equal(rollbackDatabase.importCount, 1);

const conflictDatabase = new MemoryTransactionalDatabase();
const conflictStore = createProductionProcoreRfiImportStore(conflictDatabase);
assert.equal((await commitProcoreRfiImport(input, conflictStore)).outcome, "created");
const changedCsv = csv.replace(firstSubject, `${firstSubject} Updated`);
await assert.rejects(commitProcoreRfiImport({
  ...input,
  csvText: changedCsv,
  expectedSourceSha256: createHash("sha256").update(changedCsv).digest("hex"),
}, conflictStore), /RFI_IMPORT_IDEMPOTENCY_CONFLICT/);

conflictDatabase.authorization = {
  ...validAuthorization,
  bindingId: 72,
  bindingVersion: 4,
  bindingAuditIdentity: "binding-audit-immutable-72-v4",
};
assert.equal((await commitProcoreRfiImport(input, conflictStore)).outcome, "replay");
const duplicateResult = await commitProcoreRfiImport(
  { ...input, idempotencyKey: "customer-file-second-key" },
  conflictStore,
);
assert.deepEqual(duplicateResult, { outcome: "duplicate", duplicateCount: 43, rowCount: 0, digest });
assert.equal(JSON.stringify(duplicateResult).includes("East-043"), false);

const schema = await readFile(new URL("../../../../lib/db/src/schema/rfis.ts", import.meta.url), "utf8");
assert.match(schema, /rfi_import_binding_identity_fk/);
assert.match(schema, /rfi_import_row_composite_fk/);
assert.match(schema, /rfi_import_single_current_binding_uq/);
assert.match(schema, /rfi_import_binding_version_positive/);
assert.match(schema, /rfi_import_source_payload_bounded/);
assert.match(schema, /bindingAuditIdentity/);
assert.match(schema, /sourceProjectIdentityDigest/);
assert.doesNotMatch(schema, /rfiId: integer\("rfi_id"\)/);

console.log(JSON.stringify({
  status: "PASS",
  rows: preview.rowCount,
  digest: preview.digest,
  tests: ["source-freeze", "limits", "project-identity", "authorization", "production-adapter", "binding-rotation", "replay", "conflict", "rollback", "concurrency", "schema-integrity", "leakage"],
}));
