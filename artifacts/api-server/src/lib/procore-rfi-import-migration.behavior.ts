import assert from "node:assert/strict";
import {
  decodeProcoreRfiIndexKeyColumns,
  ensureProcoreRfiImportSchema,
  type ProcoreRfiMigrationClient,
  type ProcoreRfiMigrationPool,
} from "./procore-rfi-import-migration";

assert.deepEqual(
  decodeProcoreRfiIndexKeyColumns(
    "{project_id,company_id,provider,source_project_code,capability}",
  ),
  ["project_id", "company_id", "provider", "source_project_code", "capability"],
  "PostgreSQL 18/node-postgres observed text[] representation must decode",
);
assert.deepEqual(
  decodeProcoreRfiIndexKeyColumns(["binding_id", "binding_version"]),
  ["binding_id", "binding_version"],
);
assert.deepEqual(
  decodeProcoreRfiIndexKeyColumns(
    String.raw`{"comma,name","quote\"name","slash\\name","NULL"}`,
  ),
  ["comma,name", 'quote"name', "slash\\name", "NULL"],
);
for (const rejected of [
  null,
  undefined,
  {},
  { 0: "project_id" },
  ["ok", null],
  "NULL",
  "{NULL}",
  "{a,}",
  "{a b}",
  '{"unterminated}',
  "{{nested}}",
] as unknown[]) {
  assert.throws(
    () => decodeProcoreRfiIndexKeyColumns(rejected),
    /PROCORE_RFI_IMPORT_SCHEMA_INTEGRITY_FAILED/,
  );
}

const constraints = [
  ["rfi_import_bindings", "rfi_import_binding_reference_uq"],
  ["rfi_import_bindings", "rfi_import_binding_capability_uq"],
  ["rfi_import_bindings", "rfi_import_binding_identity_version_uq"],
  ["rfi_import_bindings", "rfi_import_binding_lifecycle_chk"],
  ["rfi_import_authorizations", "rfi_import_authorization_binding_fk"],
  ["rfi_import_authorizations", "rfi_import_authorization_lifecycle_chk"],
  ["rfi_imports", "rfi_import_binding_identity_fk"],
  ["rfi_imports", "rfi_import_composite_identity_uq"],
  ["rfi_imports", "rfi_import_replay_uq"],
  ["rfi_import_rows", "rfi_import_row_composite_fk"],
  ["rfi_import_rows", "rfi_import_source_identity_uq"],
].map(([table_name, constraint_name]) => ({ table_name, constraint_name }));

class FakeClient implements ProcoreRfiMigrationClient {
  readonly commands: string[] = [];
  released = false;
  constructor(
    private readonly existingCount: number,
    private readonly keyColumns: unknown = "{project_id,company_id,provider,source_project_code,capability}",
    private readonly failAfterBegin = false,
  ) {}
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
  ): Promise<{ rows: T[]; rowCount: number }> {
    const normalized = sql.trim();
    this.commands.push(normalized);
    if (this.failAfterBegin && normalized.includes("pg_advisory_xact_lock"))
      throw new Error("FORCED_MIGRATION_FAILURE");
    if (normalized.includes("FROM unnest($1::text[])"))
      return { rows: [], rowCount: this.existingCount };
    if (normalized.includes("FROM pg_constraint"))
      return { rows: constraints as unknown as T[], rowCount: constraints.length };
    if (normalized.includes("FROM pg_index")) {
      return {
        rows: [
          {
            table_name: "rfi_import_bindings",
            index_name: "rfi_import_single_current_binding_uq",
            is_unique: true,
            predicate: "((current = true) AND (revoked_at IS NULL))",
            key_columns: this.keyColumns,
          },
          {
            table_name: "rfi_import_authorizations",
            index_name: "rfi_import_single_current_authorization_uq",
            is_unique: true,
            predicate: "(current AND (revoked_at IS NULL))",
            key_columns: [
              "binding_id",
              "binding_version",
              "user_id",
              "capability",
            ],
          },
        ] as unknown as T[],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  }
  release(): void {
    this.released = true;
  }
}

class FakePool implements ProcoreRfiMigrationPool {
  readonly clients: FakeClient[] = [];
  constructor(private readonly factory: () => FakeClient) {}
  async connect(): Promise<FakeClient> {
    const client = this.factory();
    this.clients.push(client);
    return client;
  }
}

const additivePool = new FakePool(() => new FakeClient(4));
await ensureProcoreRfiImportSchema(additivePool);
await ensureProcoreRfiImportSchema(additivePool);
assert.equal(additivePool.clients.length, 2);
assert.equal(
  additivePool.clients.every(
    (client) => client.commands.at(-1) === "COMMIT" && client.released,
  ),
  true,
  "schema ensure must be twice-idempotent",
);

const freshPool = new FakePool(() => new FakeClient(0));
await ensureProcoreRfiImportSchema(freshPool);
assert.equal(
  freshPool.clients[0].commands.some((command) =>
    command.startsWith("CREATE TABLE rfi_import_bindings"),
  ),
  true,
  "empty schema must be created additively",
);

const parityPool = new FakePool(
  () =>
    new FakeClient(
      4,
      "{company_id,project_id,provider,source_project_code,capability}",
    ),
);
await assert.rejects(
  ensureProcoreRfiImportSchema(parityPool),
  /PROCORE_RFI_IMPORT_SCHEMA_INTEGRITY_FAILED/,
);
assert.equal(
  parityPool.clients[0].commands.at(-1),
  "ROLLBACK",
  "ordered index mismatch must fail closed and roll back",
);

const rollbackPool = new FakePool(() => new FakeClient(4, undefined, true));
await assert.rejects(
  ensureProcoreRfiImportSchema(rollbackPool),
  /FORCED_MIGRATION_FAILURE/,
);
assert.equal(rollbackPool.clients[0].commands.at(-1), "ROLLBACK");
assert.equal(rollbackPool.clients[0].released, true);

console.log("procore RFI import migration behavior: passed");
