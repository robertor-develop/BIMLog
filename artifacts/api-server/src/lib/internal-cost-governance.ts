import { pool } from "@workspace/db";
export { canonicalInternalCostRate, canonicalInternalCostRole, internalCostFingerprint } from "./internal-cost-contract";
type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

let migration: Promise<void> | null = null;
export function startInternalCostGovernanceMigration() { if (!migration) migration = ensureInternalCostGovernanceSchema(); return migration; }
export async function waitForInternalCostGovernanceMigration() { await startInternalCostGovernanceMigration(); }

export async function ensureInternalCostGovernanceSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:internal-cost-governance-schema'))");
    await client.query(`
CREATE TABLE IF NOT EXISTS company_internal_cost_policy_versions(
 id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), version integer NOT NULL,
 role_rates jsonb NOT NULL, effective_from date NOT NULL, status text NOT NULL,
 proposed_by_id integer NOT NULL REFERENCES users(id), approved_by_id integer REFERENCES users(id),
 reason text NOT NULL, content_fingerprint text NOT NULL, supersedes_id text REFERENCES company_internal_cost_policy_versions(id),
 proposed_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 CONSTRAINT company_internal_cost_policy_version_positive_chk CHECK(version>0),
 CONSTRAINT company_internal_cost_policy_status_chk CHECK(status IN('proposed','approved','rejected')),
 CONSTRAINT company_internal_cost_policy_rates_object_chk CHECK(jsonb_typeof(role_rates)='object'),
 CONSTRAINT company_internal_cost_policy_reason_chk CHECK(length(reason) BETWEEN 10 AND 1000),
 CONSTRAINT company_internal_cost_policy_approval_chk CHECK((status='approved' AND approved_by_id IS NOT NULL AND decided_at IS NOT NULL) OR status<>'approved')
);
CREATE UNIQUE INDEX IF NOT EXISTS company_internal_cost_policy_version_uidx ON company_internal_cost_policy_versions(company_id,version);
CREATE INDEX IF NOT EXISTS company_internal_cost_policy_effective_idx ON company_internal_cost_policy_versions(company_id,effective_from DESC,version DESC) WHERE status='approved';
CREATE TABLE IF NOT EXISTS member_internal_cost_profile_versions(
 id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), user_id integer NOT NULL REFERENCES users(id), version integer NOT NULL,
 policy_version_id text NOT NULL REFERENCES company_internal_cost_policy_versions(id), cost_role text NOT NULL, hourly_rate numeric(18,6) NOT NULL,
 effective_from date NOT NULL, effective_to date, status text NOT NULL,
 proposed_by_id integer NOT NULL REFERENCES users(id), approved_by_id integer REFERENCES users(id), reason text NOT NULL,
 content_fingerprint text NOT NULL, supersedes_id text REFERENCES member_internal_cost_profile_versions(id), proposed_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 CONSTRAINT member_internal_cost_profile_version_positive_chk CHECK(version>0),
 CONSTRAINT member_internal_cost_profile_role_chk CHECK(cost_role IN('drafter','coordinator')),
 CONSTRAINT member_internal_cost_profile_rate_chk CHECK(hourly_rate>=0),
 CONSTRAINT member_internal_cost_profile_range_chk CHECK(effective_to IS NULL OR effective_to>=effective_from),
 CONSTRAINT member_internal_cost_profile_status_chk CHECK(status IN('proposed','approved','rejected')),
 CONSTRAINT member_internal_cost_profile_reason_chk CHECK(length(reason) BETWEEN 10 AND 1000),
 CONSTRAINT member_internal_cost_profile_approval_chk CHECK((status='approved' AND approved_by_id IS NOT NULL AND decided_at IS NOT NULL) OR status<>'approved')
);
CREATE UNIQUE INDEX IF NOT EXISTS member_internal_cost_profile_version_uidx ON member_internal_cost_profile_versions(company_id,user_id,version);
CREATE INDEX IF NOT EXISTS member_internal_cost_profile_effective_idx ON member_internal_cost_profile_versions(company_id,user_id,effective_from DESC,version DESC) WHERE status='approved';
ALTER TABLE job_activation_resource_assignments ADD COLUMN IF NOT EXISTS internal_cost_profile_version_id text REFERENCES member_internal_cost_profile_versions(id);
ALTER TABLE job_activation_resource_assignments ADD COLUMN IF NOT EXISTS internal_cost_policy_version_id text REFERENCES company_internal_cost_policy_versions(id);
ALTER TABLE job_activation_resource_assignments ADD COLUMN IF NOT EXISTS internal_cost_effective_date date;
`);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function resolveApprovedMemberInternalCost(input: { companyId: number; userId: number; effectiveDate?: string }, client: Queryable = pool) {
  const date = input.effectiveDate ?? new Date().toISOString().slice(0, 10);
  const row = (await client.query(`SELECT p.id "profileVersionId",p.version "profileVersion",p.cost_role "costRole",p.hourly_rate::text "hourlyRate",p.effective_from "effectiveFrom",p.policy_version_id "policyVersionId",policy.version "policyVersion"
    FROM member_internal_cost_profile_versions p JOIN company_internal_cost_policy_versions policy ON policy.id=p.policy_version_id
    WHERE p.company_id=$1 AND p.user_id=$2 AND p.status='approved' AND policy.status='approved'
      AND p.effective_from<=$3::date AND (p.effective_to IS NULL OR p.effective_to>=$3::date) AND policy.effective_from<=$3::date
    ORDER BY p.effective_from DESC,p.version DESC LIMIT 1`, [input.companyId, input.userId, date])).rows[0];
  return row ? { state: "resolved" as const, ...row, effectiveDate: date } : { state: "unresolved" as const, userId: input.userId, effectiveDate: date, code: "INTERNAL_COST_PROFILE_UNRESOLVED" };
}
