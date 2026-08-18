export interface ProcoreRfiMigrationClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}

export interface ProcoreRfiMigrationPool {
  connect(): Promise<ProcoreRfiMigrationClient>;
}

const PROCORE_RFI_IMPORT_TABLES = [
  "rfi_import_bindings",
  "rfi_import_authorizations",
  "rfi_imports",
  "rfi_import_rows",
] as const;
const PROCORE_RFI_IMPORT_CONSTRAINTS = [
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
] as const;
const PROCORE_RFI_IMPORT_INDEXES = [
  [
    "rfi_import_bindings",
    "rfi_import_single_current_binding_uq",
    [
      "project_id",
      "company_id",
      "provider",
      "source_project_code",
      "capability",
    ],
  ],
  [
    "rfi_import_authorizations",
    "rfi_import_single_current_authorization_uq",
    ["binding_id", "binding_version", "user_id", "capability"],
  ],
] as const;

const invalidKeyColumns = () =>
  new Error("PROCORE_RFI_IMPORT_SCHEMA_INTEGRITY_FAILED");

function assertIdentifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw invalidKeyColumns();
  }
}

/** Decode only node-postgres string arrays or PostgreSQL's canonical text[] output. */
export function decodeProcoreRfiIndexKeyColumns(value: unknown): string[] {
  if (Array.isArray(value)) {
    const decoded = value.map((entry) => {
      assertIdentifier(entry);
      return entry;
    });
    return decoded;
  }
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value[0] !== "{" ||
    value.at(-1) !== "}"
  ) {
    throw invalidKeyColumns();
  }
  if (value === "{}") return [];

  const result: string[] = [];
  let position = 1;
  const end = value.length - 1;
  while (position < end) {
    let entry = "";
    if (value[position] === '"') {
      position += 1;
      let closed = false;
      while (position < end) {
        const character = value[position++];
        if (character === '"') {
          closed = true;
          break;
        }
        if (character === "\\") {
          if (position >= end) throw invalidKeyColumns();
          entry += value[position++];
        } else {
          entry += character;
        }
      }
      if (!closed) throw invalidKeyColumns();
    } else {
      const start = position;
      while (position < end && value[position] !== ",") {
        const character = value[position++];
        if (
          character === '"' ||
          character === "\\" ||
          character === "{" ||
          character === "}" ||
          /\s/.test(character)
        ) {
          throw invalidKeyColumns();
        }
      }
      entry = value.slice(start, position);
      if (entry.toUpperCase() === "NULL") throw invalidKeyColumns();
    }
    assertIdentifier(entry);
    result.push(entry);
    if (position === end) break;
    if (value[position] !== ",") throw invalidKeyColumns();
    position += 1;
    if (position === end) throw invalidKeyColumns();
  }
  return result;
}

function sameOrderedIdentifiers(
  actual: unknown,
  expected: readonly string[],
): boolean {
  const decoded = decodeProcoreRfiIndexKeyColumns(actual);
  return (
    decoded.length === expected.length &&
    decoded.every((value, index) => value === expected[index])
  );
}

export async function ensureProcoreRfiImportSchema(
  pool: ProcoreRfiMigrationPool,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('bimlog:procore-rfi-import-schema'))",
    );
    const existing = await client.query<{ table_name: string }>(
      `
      SELECT table_name FROM unnest($1::text[]) AS requested(table_name)
       WHERE to_regclass('public.' || table_name) IS NOT NULL
    `,
      [PROCORE_RFI_IMPORT_TABLES],
    );
    if (existing.rowCount === 0)
      await client.query(PROCORE_RFI_IMPORT_MIGRATION_SQL);
    else if (existing.rowCount !== PROCORE_RFI_IMPORT_TABLES.length)
      throw new Error("PROCORE_RFI_IMPORT_SCHEMA_PARTIAL");

    const constraints = await client.query<{
      table_name: string;
      constraint_name: string;
    }>(
      `
      SELECT target.relname AS table_name, constraint_record.conname AS constraint_name
        FROM pg_constraint constraint_record
        JOIN pg_class target ON target.oid = constraint_record.conrelid
        JOIN pg_namespace namespace ON namespace.oid = target.relnamespace
       WHERE namespace.nspname = 'public' AND constraint_record.conname = ANY($1::text[])
    `,
      [PROCORE_RFI_IMPORT_CONSTRAINTS.map(([, name]) => name)],
    );
    const actualConstraints = new Set(
      constraints.rows.map((row) => `${row.table_name}:${row.constraint_name}`),
    );
    const constraintsValid = PROCORE_RFI_IMPORT_CONSTRAINTS.every(
      ([table, name]) => actualConstraints.has(`${table}:${name}`),
    );

    const indexes = await client.query<{
      table_name: string;
      index_name: string;
      key_columns: unknown;
      predicate: string | null;
      is_unique: boolean;
    }>(
      `
      SELECT target.relname AS table_name, index_class.relname AS index_name,
             index_record.indisunique AS is_unique,
             pg_get_expr(index_record.indpred, index_record.indrelid) AS predicate,
             array_agg(attribute.attname ORDER BY key.ordinality) AS key_columns
        FROM pg_index index_record
        JOIN pg_class target ON target.oid = index_record.indrelid
        JOIN pg_namespace namespace ON namespace.oid = target.relnamespace
        JOIN pg_class index_class ON index_class.oid = index_record.indexrelid
        JOIN unnest(index_record.indkey) WITH ORDINALITY AS key(attribute_number, ordinality) ON true
        JOIN pg_attribute attribute ON attribute.attrelid = target.oid AND attribute.attnum = key.attribute_number
       WHERE namespace.nspname = 'public' AND index_class.relname = ANY($1::text[])
       GROUP BY target.relname, index_class.relname, index_record.indisunique,
                index_record.indpred, index_record.indrelid
    `,
      [PROCORE_RFI_IMPORT_INDEXES.map(([, name]) => name)],
    );
    const normalizePredicate = (value: string | null) =>
      (value ?? "").toLowerCase().replace(/[()\s]/g, "");
    const indexesValid = PROCORE_RFI_IMPORT_INDEXES.every(
      ([table, name, expectedColumns]) =>
        indexes.rows.some(
          (row) =>
            row.table_name === table &&
            row.index_name === name &&
            row.is_unique &&
            sameOrderedIdentifiers(row.key_columns, expectedColumns) &&
            [
              "current=trueandrevoked_atisnull",
              "currentandrevoked_atisnull",
            ].includes(normalizePredicate(row.predicate)),
        ),
    );
    if (!constraintsValid || !indexesValid)
      throw new Error("PROCORE_RFI_IMPORT_SCHEMA_INTEGRITY_FAILED");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Review-only migration source. Dry-run validation must never register or execute it. */
export const PROCORE_RFI_IMPORT_MIGRATION_SQL = String.raw`
CREATE TABLE rfi_import_bindings (
  id serial NOT NULL,
  version integer NOT NULL,
  audit_identity text NOT NULL,
  project_id integer NOT NULL REFERENCES projects(id),
  company_id integer NOT NULL REFERENCES companies(id),
  provider text NOT NULL,
  source_project_code text NOT NULL,
  source_project_identity_digest char(64) NOT NULL,
  capability text NOT NULL,
  current boolean NOT NULL DEFAULT true,
  revoked_at timestamp,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT rfi_import_binding_pk PRIMARY KEY (id, version),
  CONSTRAINT rfi_import_binding_reference_uq UNIQUE
    (id, version, audit_identity, project_id, provider, source_project_code, source_project_identity_digest),
  CONSTRAINT rfi_import_binding_capability_uq UNIQUE (id, version, capability),
  CONSTRAINT rfi_import_binding_identity_version_uq UNIQUE
    (version, project_id, company_id, provider, source_project_code, capability),
  CONSTRAINT rfi_import_binding_version_positive CHECK (version > 0),
  CONSTRAINT rfi_import_binding_audit_identity_bounded CHECK
    (octet_length(audit_identity) BETWEEN 1 AND 256),
  CONSTRAINT rfi_import_binding_provider_bounded CHECK
    (octet_length(provider) BETWEEN 1 AND 64),
  CONSTRAINT rfi_import_binding_source_project_bounded CHECK
    (octet_length(source_project_code) BETWEEN 1 AND 128),
  CONSTRAINT rfi_import_binding_digest_format CHECK
    (source_project_identity_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT rfi_import_binding_capability_rfi_import CHECK (capability = 'RFI_IMPORT'),
  CONSTRAINT rfi_import_binding_lifecycle_chk CHECK
    ((current = true AND revoked_at IS NULL) OR (current = false AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX rfi_import_single_current_binding_uq
  ON rfi_import_bindings(project_id, company_id, provider, source_project_code, capability)
  WHERE current = true AND revoked_at IS NULL;

CREATE TABLE rfi_import_authorizations (
  id serial PRIMARY KEY,
  binding_id integer NOT NULL,
  binding_version integer NOT NULL,
  user_id integer NOT NULL REFERENCES users(id),
  capability text NOT NULL,
  current boolean NOT NULL DEFAULT true,
  revoked_at timestamp,
  granted_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT rfi_import_authorization_binding_fk FOREIGN KEY(binding_id, binding_version, capability)
    REFERENCES rfi_import_bindings(id, version, capability),
  CONSTRAINT rfi_import_authorization_binding_version_positive CHECK (binding_version > 0),
  CONSTRAINT rfi_import_authorization_capability_rfi_import CHECK (capability = 'RFI_IMPORT'),
  CONSTRAINT rfi_import_authorization_lifecycle_chk CHECK
    ((current = true AND revoked_at IS NULL) OR (current = false AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX rfi_import_single_current_authorization_uq
  ON rfi_import_authorizations(binding_id, binding_version, user_id, capability)
  WHERE current = true AND revoked_at IS NULL;

CREATE TABLE rfi_imports (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  provider text NOT NULL,
  binding_id integer NOT NULL,
  binding_version integer NOT NULL,
  binding_audit_identity text NOT NULL,
  idempotency_key text NOT NULL,
  source_digest char(64) NOT NULL,
  source_project_code text NOT NULL,
  source_project_identity_digest char(64) NOT NULL,
  actor_user_id integer NOT NULL REFERENCES users(id),
  row_count integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT rfi_import_binding_identity_fk FOREIGN KEY(
    binding_id, binding_version, binding_audit_identity, project_id,
    provider, source_project_code, source_project_identity_digest
  ) REFERENCES rfi_import_bindings(
    id, version, audit_identity, project_id,
    provider, source_project_code, source_project_identity_digest
  ),
  CONSTRAINT rfi_import_composite_identity_uq UNIQUE
    (id, binding_id, binding_version, project_id, provider, source_project_code),
  CONSTRAINT rfi_import_replay_uq UNIQUE
    (project_id, provider, source_project_code, idempotency_key),
  CONSTRAINT rfi_import_row_count_positive CHECK (row_count > 0),
  CONSTRAINT rfi_import_binding_version_positive CHECK (binding_version > 0),
  CONSTRAINT rfi_import_provider_bounded CHECK
    (octet_length(provider) BETWEEN 1 AND 64),
  CONSTRAINT rfi_import_source_digest_format CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT rfi_import_project_digest_format CHECK
    (source_project_identity_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT rfi_import_idempotency_key_bounded CHECK
    (octet_length(idempotency_key) BETWEEN 1 AND 128),
  CONSTRAINT rfi_import_idempotency_key_format CHECK
    (idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
  CONSTRAINT rfi_import_source_project_bounded CHECK
    (octet_length(source_project_code) BETWEEN 1 AND 128)
);

CREATE TABLE rfi_import_rows (
  id serial PRIMARY KEY,
  import_id integer NOT NULL,
  project_id integer NOT NULL REFERENCES projects(id),
  provider text NOT NULL,
  source_project_code text NOT NULL,
  binding_id integer NOT NULL,
  binding_version integer NOT NULL,
  source_number text NOT NULL,
  source_revision integer NOT NULL,
  source_payload jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT rfi_import_row_composite_fk FOREIGN KEY(
    import_id, binding_id, binding_version, project_id, provider, source_project_code
  ) REFERENCES rfi_imports(
    id, binding_id, binding_version, project_id, provider, source_project_code
  ),
  CONSTRAINT rfi_import_source_identity_uq UNIQUE
    (project_id, provider, source_project_code, source_number, source_revision),
  CONSTRAINT rfi_import_row_binding_version_positive CHECK (binding_version > 0),
  CONSTRAINT rfi_import_source_revision_nonnegative CHECK (source_revision >= 0),
  CONSTRAINT rfi_import_source_number_bounded CHECK
    (octet_length(source_number) BETWEEN 1 AND 8192),
  CONSTRAINT rfi_import_source_payload_bounded CHECK
    (octet_length(source_payload::text) <= 65536),
  CONSTRAINT rfi_import_row_source_project_bounded CHECK
    (octet_length(source_project_code) BETWEEN 1 AND 128),
  CONSTRAINT rfi_import_row_provider_bounded CHECK
    (octet_length(provider) BETWEEN 1 AND 64)
);
`;
