type MigrationClient = {
  query(sql: string): Promise<unknown>;
  release(): void;
};

type MigrationPool = { connect(): Promise<MigrationClient> };

let startup: Promise<void> | null = null;

export function startEnterpriseIdentityMigration(): Promise<void> {
  startup ??= ensureEnterpriseIdentitySchema();
  return startup;
}

export async function waitForEnterpriseIdentityMigration(): Promise<void> {
  await startEnterpriseIdentityMigration();
}

export async function ensureEnterpriseIdentitySchema(
  migrationPool?: MigrationPool,
): Promise<void> {
  const effectivePool = migrationPool ?? (await import("@workspace/db")).pool as unknown as MigrationPool;
  const client = await effectivePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:enterprise-identity-schema:v1'))");
    await client.query(ENTERPRISE_IDENTITY_MIGRATION_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const ENTERPRISE_IDENTITY_MIGRATION_SQL = String.raw`
CREATE TABLE IF NOT EXISTS enterprise_contacts(
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  linked_user_id integer REFERENCES users(id),
  full_name text NOT NULL,
  email text,
  phone text,
  title text,
  state text NOT NULL DEFAULT 'active',
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT enterprise_contacts_id_company_uq UNIQUE(id,company_id),
  CONSTRAINT enterprise_contacts_company_email_uq UNIQUE(company_id,email),
  CONSTRAINT enterprise_contacts_state_chk CHECK(state IN ('active','inactive','retired')),
  CONSTRAINT enterprise_contacts_lifecycle_chk CHECK((state='retired')=(retired_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS project_company_relationships(
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  company_id integer NOT NULL REFERENCES companies(id),
  relationship_type text NOT NULL,
  state text NOT NULL DEFAULT 'active',
  source_type text NOT NULL DEFAULT 'manual',
  source_record_id text,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT project_company_relationship_id_project_uq UNIQUE(id,project_id),
  CONSTRAINT project_company_relationship_id_project_company_uq UNIQUE(id,project_id,company_id),
  CONSTRAINT project_company_relationship_project_company_role_uq UNIQUE(project_id,company_id,relationship_type),
  CONSTRAINT project_company_relationship_type_chk CHECK(relationship_type IN ('client','owner','general_contractor','service_provider','trade_contractor','consultant','vendor','partner','authority','other')),
  CONSTRAINT project_company_relationship_state_chk CHECK(state IN ('active','inactive','retired')),
  CONSTRAINT project_company_relationship_lifecycle_chk CHECK((state='retired')=(retired_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS project_contact_relationships(
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  company_id integer NOT NULL,
  project_company_relationship_id integer NOT NULL,
  contact_id integer NOT NULL,
  contact_role text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'active',
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_contact_relationship_project_contact_role_uq UNIQUE(project_id,contact_id,contact_role),
  CONSTRAINT project_contact_relationship_project_company_fk FOREIGN KEY(project_company_relationship_id,project_id,company_id) REFERENCES project_company_relationships(id,project_id,company_id),
  CONSTRAINT project_contact_relationship_contact_company_fk FOREIGN KEY(contact_id,company_id) REFERENCES enterprise_contacts(id,company_id),
  CONSTRAINT project_contact_relationship_state_chk CHECK(state IN ('active','inactive','retired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS project_contact_one_primary_role_uq
  ON project_contact_relationships(project_id,project_company_relationship_id,contact_role)
  WHERE is_primary=true AND state='active';

CREATE TABLE IF NOT EXISTS enterprise_trades(
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  state text NOT NULL DEFAULT 'active',
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_trades_code_chk CHECK(code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  CONSTRAINT enterprise_trades_state_chk CHECK(state IN ('active','inactive','retired'))
);

CREATE TABLE IF NOT EXISTS company_trade_relationships(
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  company_id integer NOT NULL,
  project_company_relationship_id integer NOT NULL,
  trade_id integer NOT NULL REFERENCES enterprise_trades(id),
  state text NOT NULL DEFAULT 'active',
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_trade_relationship_project_company_trade_uq UNIQUE(project_id,company_id,trade_id),
  CONSTRAINT company_trade_relationship_project_company_fk FOREIGN KEY(project_company_relationship_id,project_id,company_id) REFERENCES project_company_relationships(id,project_id,company_id),
  CONSTRAINT company_trade_relationship_state_chk CHECK(state IN ('active','inactive','retired'))
);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='financial_contracts_id_project_uq') THEN
    ALTER TABLE financial_contracts ADD CONSTRAINT financial_contracts_id_project_uq UNIQUE(id,project_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contract_party_relationships(
  id serial PRIMARY KEY,
  contract_id text NOT NULL,
  project_id integer NOT NULL,
  project_company_relationship_id integer NOT NULL,
  party_role text NOT NULL,
  state text NOT NULL DEFAULT 'active',
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_party_relationship_contract_company_role_uq UNIQUE(contract_id,project_company_relationship_id,party_role),
  CONSTRAINT contract_party_relationship_contract_project_fk FOREIGN KEY(contract_id,project_id) REFERENCES financial_contracts(id,project_id),
  CONSTRAINT contract_party_relationship_project_company_fk FOREIGN KEY(project_company_relationship_id,project_id) REFERENCES project_company_relationships(id,project_id),
  CONSTRAINT contract_party_relationship_role_chk CHECK(party_role IN ('client','owner','contractor','subcontractor','consultant','vendor','guarantor','other')),
  CONSTRAINT contract_party_relationship_state_chk CHECK(state IN ('active','inactive','retired'))
);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='files_id_project_uq') THEN
    ALTER TABLE files ADD CONSTRAINT files_id_project_uq UNIQUE(id,project_id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='rfis_id_project_uq') THEN
    ALTER TABLE rfis ADD CONSTRAINT rfis_id_project_uq UNIQUE(id,project_id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='submittals_id_project_uq') THEN
    ALTER TABLE submittals ADD CONSTRAINT submittals_id_project_uq UNIQUE(id,project_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='files_parent_same_project_fk') THEN
    ALTER TABLE files ADD CONSTRAINT files_parent_same_project_fk FOREIGN KEY(parent_file_id,project_id) REFERENCES files(id,project_id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='files_superseded_same_project_fk') THEN
    ALTER TABLE files ADD CONSTRAINT files_superseded_same_project_fk FOREIGN KEY(superseded_by_file_id,project_id) REFERENCES files(id,project_id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='rfis_parent_same_project_fk') THEN
    ALTER TABLE rfis ADD CONSTRAINT rfis_parent_same_project_fk FOREIGN KEY(parent_rfi_id,project_id) REFERENCES rfis(id,project_id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='rfis_revision_same_project_fk') THEN
    ALTER TABLE rfis ADD CONSTRAINT rfis_revision_same_project_fk FOREIGN KEY(revision_of,project_id) REFERENCES rfis(id,project_id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='submittals_parent_same_project_fk') THEN
    ALTER TABLE submittals ADD CONSTRAINT submittals_parent_same_project_fk FOREIGN KEY(parent_submittal_id,project_id) REFERENCES submittals(id,project_id) NOT VALID;
  END IF;
END $$;
`;
