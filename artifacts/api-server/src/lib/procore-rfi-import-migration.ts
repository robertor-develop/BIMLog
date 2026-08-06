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
    (id, version, project_id, provider, audit_identity, source_project_code, source_project_identity_digest),
  CONSTRAINT rfi_import_binding_capability_uq UNIQUE (id, version, capability),
  CONSTRAINT rfi_import_binding_identity_version_uq UNIQUE
    (project_id, company_id, provider, source_project_code, capability, version),
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
    binding_id, binding_version, project_id, provider,
    binding_audit_identity, source_project_code, source_project_identity_digest
  ) REFERENCES rfi_import_bindings(
    id, version, project_id, provider,
    audit_identity, source_project_code, source_project_identity_digest
  ),
  CONSTRAINT rfi_import_composite_identity_uq UNIQUE
    (id, project_id, provider, source_project_code, binding_id, binding_version),
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
    import_id, project_id, provider, source_project_code, binding_id, binding_version
  ) REFERENCES rfi_imports(
    id, project_id, provider, source_project_code, binding_id, binding_version
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
