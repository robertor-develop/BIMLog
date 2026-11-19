import {pool} from "@workspace/db";
let migration:Promise<void>|null=null;
export function waitForBimtechSetupPackageMigration(){if(!migration)migration=ensure();return migration;}
async function ensure(){const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:bimtech-setup-package-v1'))");await client.query(`
CREATE TABLE IF NOT EXISTS bimtech_setup_package_imports(
 id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),
 source_organization_id text NOT NULL,source_project_id text NOT NULL,source_export_id text NOT NULL,source_revision integer NOT NULL,
 content_sha256 text NOT NULL,package_sha256 text NOT NULL,package_json jsonb NOT NULL,preview_json jsonb NOT NULL,mappings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'staged',target_intake_id text REFERENCES job_intakes(id),requested_by_id integer NOT NULL REFERENCES users(id),applied_by_id integer REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz,
 CONSTRAINT bimtech_setup_status_chk CHECK(status IN('staged','mapped','applied','rejected')),UNIQUE(project_id,content_sha256)
);
CREATE TABLE IF NOT EXISTS bimtech_setup_package_events(
 id text PRIMARY KEY,import_id text NOT NULL REFERENCES bimtech_setup_package_imports(id),project_id integer NOT NULL REFERENCES projects(id),actor_user_id integer NOT NULL REFERENCES users(id),
 event_type text NOT NULL,evidence jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bimtech_setup_package_project_idx ON bimtech_setup_package_imports(project_id,created_at DESC);
`);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");migration=null;throw error;}finally{client.release();}}
