import crypto from "node:crypto";
import { pool } from "@workspace/db";
export { canonicalInternalCostRate, canonicalInternalCostRole, internalCostFingerprint } from "./internal-cost-contract";
import { canonicalInternalCostRate, canonicalInternalCostRole, internalCostFingerprint } from "./internal-cost-contract";
import { FinancialControlError } from "./financial-control-contract";
import { waitForJobIntakeMigration } from "./job-intake-migration";
type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

let migration: Promise<void> | null = null;
export function startInternalCostGovernanceMigration() { if (!migration) migration = ensureInternalCostGovernanceSchema(); return migration; }
export async function waitForInternalCostGovernanceMigration() { await startInternalCostGovernanceMigration(); }

export async function ensureInternalCostGovernanceSchema() {
  await waitForJobIntakeMigration();
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
CREATE TABLE IF NOT EXISTS job_activation_floor_hour_estimate_versions(
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id), intake_id text NOT NULL REFERENCES job_intakes(id), work_item_id text NOT NULL REFERENCES job_activation_work_items(id), location_identity text NOT NULL, version integer NOT NULL, approved_hours numeric(30,6) NOT NULL, excess_hourly_rate numeric(30,6) NOT NULL, internal_cost_policy_version_id text NOT NULL REFERENCES company_internal_cost_policy_versions(id), status text NOT NULL DEFAULT 'proposed', reason text NOT NULL, content_fingerprint text NOT NULL, supersedes_id text REFERENCES job_activation_floor_hour_estimate_versions(id), proposed_by_id integer NOT NULL REFERENCES users(id), approved_by_id integer REFERENCES users(id), proposed_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
  CONSTRAINT job_activation_floor_hour_estimate_status_chk CHECK(status IN('proposed','approved','rejected','superseded')), CONSTRAINT job_activation_floor_hour_estimate_values_chk CHECK(version>0 AND approved_hours>0 AND excess_hourly_rate>=0), CONSTRAINT job_activation_floor_hour_estimate_fingerprint_chk CHECK(content_fingerprint ~ '^[a-f0-9]{64}$'), CONSTRAINT job_activation_floor_hour_estimate_version_uidx UNIQUE(project_id,work_item_id,location_identity,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_activation_floor_hour_estimate_active_uidx ON job_activation_floor_hour_estimate_versions(project_id,work_item_id,location_identity) WHERE status='approved';
CREATE INDEX IF NOT EXISTS job_activation_floor_hour_estimate_project_idx ON job_activation_floor_hour_estimate_versions(project_id,status,proposed_at DESC);
CREATE TABLE IF NOT EXISTS job_activation_time_cost_allocation_runs(
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id), work_item_id text NOT NULL REFERENCES job_activation_work_items(id), location_identity text NOT NULL, estimate_version_id text NOT NULL REFERENCES job_activation_floor_hour_estimate_versions(id), reason text NOT NULL, source_fingerprint text NOT NULL, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT job_activation_time_cost_run_fingerprint_chk CHECK(source_fingerprint ~ '^[a-f0-9]{64}$'), CONSTRAINT job_activation_time_cost_run_source_uidx UNIQUE(estimate_version_id,source_fingerprint)
);
CREATE TABLE IF NOT EXISTS job_activation_time_cost_allocations(
  id text PRIMARY KEY, run_id text NOT NULL REFERENCES job_activation_time_cost_allocation_runs(id), time_entry_id text NOT NULL REFERENCES job_activation_time_entries(id), sequence_hours_before numeric(30,6) NOT NULL, normal_hours numeric(30,6) NOT NULL, excess_hours numeric(30,6) NOT NULL, normal_hourly_rate numeric(30,6) NOT NULL, excess_hourly_rate numeric(30,6) NOT NULL, normal_cost numeric(30,6) NOT NULL, excess_cost numeric(30,6) NOT NULL, total_cost numeric(30,6) NOT NULL, calculation_fingerprint text NOT NULL, CONSTRAINT job_activation_time_cost_allocation_entry_uidx UNIQUE(run_id,time_entry_id), CONSTRAINT job_activation_time_cost_allocation_values_chk CHECK(sequence_hours_before>=0 AND normal_hours>=0 AND excess_hours>=0 AND normal_cost>=0 AND excess_cost>=0 AND total_cost=normal_cost+excess_cost), CONSTRAINT job_activation_time_cost_allocation_fingerprint_chk CHECK(calculation_fingerprint ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS job_activation_time_cost_run_project_idx ON job_activation_time_cost_allocation_runs(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS job_activation_time_cost_allocation_entry_idx ON job_activation_time_cost_allocations(time_entry_id,run_id);
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

function effectiveDate(value: unknown) {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new FinancialControlError(400, "INTERNAL_COST_EFFECTIVE_DATE_INVALID", "Effective date is invalid.");
  return date;
}
function reason(value: unknown) { const text = String(value ?? "").trim(); if (text.length < 10 || text.length > 1000) throw new FinancialControlError(400, "INTERNAL_COST_REASON_INVALID", "Reason must contain 10 to 1000 characters."); return text; }
async function actor(client: Queryable, actorUserId: number, companyId: number) {
  const row = (await client.query(`SELECT id,company_id "companyId",is_super_admin "isCeo" FROM users WHERE id=$1`, [actorUserId])).rows[0];
  if (!row || Number(row.companyId) !== companyId) throw new FinancialControlError(403, "INTERNAL_COST_COMPANY_DENIED", "Internal cost governance belongs to another company.");
  return row;
}

export async function proposeInternalCostPolicy(input: { actorUserId: number; companyId: number; drafterRate: unknown; coordinatorRate: unknown; effectiveFrom: unknown; reason: unknown }, host: any = pool) {
  await waitForInternalCostGovernanceMigration(); const client = typeof host.connect === "function" ? await host.connect() : host;
  try { await client.query("BEGIN"); await actor(client, input.actorUserId, input.companyId);
    const latest = (await client.query(`SELECT id,version FROM company_internal_cost_policy_versions WHERE company_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [input.companyId])).rows[0];
    const roleRates = { drafter: canonicalInternalCostRate(input.drafterRate, "drafterRate"), coordinator: canonicalInternalCostRate(input.coordinatorRate, "coordinatorRate") };
    const row = (await client.query(`INSERT INTO company_internal_cost_policy_versions(id,company_id,version,role_rates,effective_from,status,proposed_by_id,reason,content_fingerprint,supersedes_id) VALUES($1,$2,$3,$4::jsonb,$5,'proposed',$6,$7,$8,$9) RETURNING id,version,status,role_rates "roleRates",effective_from "effectiveFrom",proposed_by_id "proposedById",proposed_at "proposedAt"`, [crypto.randomUUID(), input.companyId, Number(latest?.version ?? 0) + 1, JSON.stringify(roleRates), effectiveDate(input.effectiveFrom), input.actorUserId, reason(input.reason), internalCostFingerprint({ roleRates, effectiveFrom: input.effectiveFrom }), latest?.id ?? null])).rows[0];
    await client.query("COMMIT"); return row;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { if (client !== host) client.release(); }
}

export async function proposeMemberInternalCostProfile(input: { actorUserId: number; companyId: number; userId: number; policyVersionId: unknown; costRole: unknown; effectiveFrom: unknown; effectiveTo?: unknown; reason: unknown }, host: any = pool) {
  await waitForInternalCostGovernanceMigration(); const client = typeof host.connect === "function" ? await host.connect() : host;
  try { await client.query("BEGIN"); await actor(client, input.actorUserId, input.companyId);
    const policy = (await client.query(`SELECT id,role_rates "roleRates" FROM company_internal_cost_policy_versions WHERE id=$1 AND company_id=$2 AND status='approved' FOR SHARE`, [String(input.policyVersionId), input.companyId])).rows[0];
    if (!policy) throw new FinancialControlError(409, "INTERNAL_COST_POLICY_NOT_APPROVED", "Choose an approved company internal-cost policy.");
    const member = (await client.query(`SELECT 1 FROM users WHERE id=$1 AND company_id=$2`, [input.userId, input.companyId])).rows[0]; if (!member) throw new FinancialControlError(400, "INTERNAL_COST_MEMBER_INVALID", "Member must belong to this company.");
    const role = canonicalInternalCostRole(input.costRole), from = effectiveDate(input.effectiveFrom), to = input.effectiveTo ? effectiveDate(input.effectiveTo) : null;
    if (to && to < from) throw new FinancialControlError(400, "INTERNAL_COST_EFFECTIVE_RANGE_INVALID", "Effective end cannot precede the start.");
    const latest = (await client.query(`SELECT id,version FROM member_internal_cost_profile_versions WHERE company_id=$1 AND user_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [input.companyId, input.userId])).rows[0];
    const hourlyRate = canonicalInternalCostRate(policy.roleRates[role], "policyRate");
    const row = (await client.query(`INSERT INTO member_internal_cost_profile_versions(id,company_id,user_id,version,policy_version_id,cost_role,hourly_rate,effective_from,effective_to,status,proposed_by_id,reason,content_fingerprint,supersedes_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'proposed',$10,$11,$12,$13) RETURNING id,user_id "userId",version,policy_version_id "policyVersionId",cost_role "costRole",hourly_rate::text "hourlyRate",effective_from "effectiveFrom",effective_to "effectiveTo",status,proposed_by_id "proposedById",proposed_at "proposedAt"`, [crypto.randomUUID(), input.companyId, input.userId, Number(latest?.version ?? 0) + 1, policy.id, role, hourlyRate, from, to, input.actorUserId, reason(input.reason), internalCostFingerprint({ userId: input.userId, policyVersionId: policy.id, role, hourlyRate, from, to }), latest?.id ?? null])).rows[0];
    await client.query("COMMIT"); return row;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { if (client !== host) client.release(); }
}

export async function decideInternalCostVersion(input: { actorUserId: number; companyId: number; kind: "policy" | "profile"; versionId: unknown; outcome: unknown; reason: unknown }, host: any = pool) {
  await waitForInternalCostGovernanceMigration(); const client = typeof host.connect === "function" ? await host.connect() : host;
  try { await client.query("BEGIN"); const authority = await actor(client, input.actorUserId, input.companyId);
    if (!authority.isCeo) throw new FinancialControlError(403, "INTERNAL_COST_CEO_APPROVAL_REQUIRED", "Only the company CEO authority may approve or reject internal-cost versions.");
    const outcome = String(input.outcome); if (!['approved','rejected'].includes(outcome)) throw new FinancialControlError(400, "INTERNAL_COST_DECISION_INVALID", "Decision must be approved or rejected.");
    const table = input.kind === "policy" ? "company_internal_cost_policy_versions" : "member_internal_cost_profile_versions";
    const row = (await client.query(`UPDATE ${table} SET status=$4,approved_by_id=$3,decided_at=now(),reason=reason || E'\\nDecision: ' || $5 WHERE id=$1 AND company_id=$2 AND status='proposed' RETURNING id,version,status,proposed_by_id "proposedById",approved_by_id "approvedById",decided_at "decidedAt",effective_from "effectiveFrom"`, [String(input.versionId), input.companyId, input.actorUserId, outcome, reason(input.reason)])).rows[0];
    if (!row) throw new FinancialControlError(409, "INTERNAL_COST_VERSION_NOT_PENDING", "Internal-cost version is missing or no longer pending.");
    await client.query("COMMIT"); return row;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { if (client !== host) client.release(); }
}

export async function getInternalCostGovernance(input: { actorUserId: number; companyId: number; includeSensitive: boolean }, client: Queryable = pool) {
  await waitForInternalCostGovernanceMigration(); const authority = await actor(client, input.actorUserId, input.companyId);
  if (!input.includeSensitive) return { visible: false, canPropose: false, canApprove: false, activePolicy: null, pendingPolicies: [], memberProfiles: [] };
  const policies = (await client.query(`SELECT id,version,role_rates "roleRates",effective_from "effectiveFrom",status,proposed_by_id "proposedById",approved_by_id "approvedById",proposed_at "proposedAt",decided_at "decidedAt" FROM company_internal_cost_policy_versions WHERE company_id=$1 ORDER BY version DESC LIMIT 25`, [input.companyId])).rows;
  const profiles = (await client.query(`SELECT DISTINCT ON(p.user_id) p.id,p.user_id "userId",u.full_name "memberName",p.version,p.policy_version_id "policyVersionId",p.cost_role "costRole",p.hourly_rate::text "hourlyRate",p.effective_from "effectiveFrom",p.effective_to "effectiveTo",p.status,p.proposed_by_id "proposedById",p.approved_by_id "approvedById",p.decided_at "decidedAt" FROM member_internal_cost_profile_versions p JOIN users u ON u.id=p.user_id WHERE p.company_id=$1 ORDER BY p.user_id,p.version DESC`, [input.companyId])).rows;
  return { visible: true, canPropose: true, canApprove: authority.isCeo === true, activePolicy: policies.find((row:any)=>row.status==='approved' && String(row.effectiveFrom).slice(0,10)<=new Date().toISOString().slice(0,10)) ?? null, pendingPolicies: policies.filter((row:any)=>row.status==='proposed'), memberProfiles: profiles };
}
