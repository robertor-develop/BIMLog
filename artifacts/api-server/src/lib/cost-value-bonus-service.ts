import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { authorizeFinancialOperation } from "./financial-control-service";
import { FinancialControlError } from "./financial-control-contract";
import { ensureEdtEngineSchema } from "./edt-engine-migration";
import { withEdtTransaction, type EdtTransactionClient } from "./edt-engine-transaction";
import { prepareBonusProposal, verifyBonusCapacity, verifyIndependentBonusDecision, type BonusProposal, type BonusReservation, type BonusFunding } from "./cost-value-bonus-allocation";

const fail = (code: string, message: string): never => { throw new FinancialControlError(409, code, message); };

export async function getManualBonuses(actorUserId: number, projectId: number, before?: unknown) {
  if (before !== undefined && (typeof before !== "string" || !/^[0-9a-f-]{36}$/i.test(before)))
    throw new FinancialControlError(400, "BONUS_CURSOR_INVALID", "A valid proposal cursor is required.");
  await ensureEdtEngineSchema();
  const auth = await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.view", operation: "read" });
  const companyId = auth.scope.companyId;
  const permitted = async (operation: "prepare" | "review" | "approve", currency?: string) => {
    try { await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation,
      ...(operation === "approve" && currency ? { category: "bonus_allocation", amount: { amount: "0", currency } } : {}) }); return true; }
    catch (error) { if (error instanceof FinancialControlError && error.status === 403) return false; throw error; }
  };
  const rows = (await pool.query(`SELECT p.id,p.proposal,p.fingerprint,p.created_at,d.outcome,d.actor_user_id AS decided_by_id,d.reason AS decision_reason,d.created_at AS decided_at
    FROM job_bonus_proposals p LEFT JOIN job_bonus_decisions d ON d.proposal_id=p.id
    WHERE p.company_id=$1 AND p.project_id=$2 AND ($3::text IS NULL OR (p.created_at,p.id)<
      (SELECT c.created_at,c.id FROM job_bonus_proposals c WHERE c.id=$3 AND c.company_id=$1 AND c.project_id=$2))
    ORDER BY p.created_at DESC,p.id DESC LIMIT 101`, [companyId, projectId, before ?? null])).rows;
  const sources = (await pool.query(`SELECT p.id,p.work_item_id,COALESCE(w.display_code,w.name) AS work_item_label,p.currency,p.incentive_reserve_amount::text AS reserve_amount,p.plan_fingerprint,
    COALESCE((SELECT sum(b.amount) FROM job_bonus_proposals b LEFT JOIN job_bonus_decisions d ON d.proposal_id=b.id
      WHERE b.funding_id=p.id AND COALESCE(d.outcome,'pending') IN ('pending','approved')),0)::text AS reserved_amount
    FROM job_activation_work_item_economic_plans p JOIN job_intakes i ON i.id=p.intake_id AND i.project_id=p.project_id AND i.company_id=p.company_id
    JOIN job_activation_work_items w ON w.id=p.work_item_id AND w.project_id=p.project_id AND w.intake_id=p.intake_id
    WHERE p.project_id=$1 AND p.company_id=$2 AND i.status='activated' ORDER BY p.created_at,p.id`, [projectId, companyId])).rows;
  const recipients = (await pool.query(`SELECT DISTINCT u.id,u.full_name FROM project_members pm JOIN users u ON u.id=pm.user_id
    WHERE pm.project_id=$1 AND pm.status='active' AND u.company_id=$2 ORDER BY u.full_name,u.id`, [projectId, companyId])).rows;
  const approvableCurrencies: string[] = [];
  for (const currency of new Set<string>(sources.map(source => source.currency))) if (await permitted("approve", currency)) approvableCurrencies.push(currency);
  return { proposals: rows.slice(0,100).map(row => ({ ...row, state: row.outcome ?? "pending", paymentAuthorized: false })),
    nextCursor: rows.length > 100 ? rows[99].id : null, sources, recipients,
    actorUserId, canPropose: await permitted("prepare"), canReview: await permitted("review"),
    approvableCurrencies, paymentAuthorized: false };
}
const reason = (value: string) => {
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 1000 || /[\u0000-\u001f\u007f]/.test(value))
    fail("BONUS_REASON_REQUIRED", "Provide a reason of 8 to 1000 characters.");
  return value.trim();
};
function concurrent(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && ["40001", "40P01", "23505"].includes(String(error.code)))
    fail("BONUS_CONCURRENT_CHANGE", "Another allocation changed this reserve. Refresh before trying again.");
  throw error;
}
async function fundingSource(client: EdtTransactionClient, fundingId: string, projectId: number, companyId: number): Promise<BonusFunding> {
  const row = (await client.query<any>(`SELECT p.id,p.plan_fingerprint,p.incentive_reserve_amount::text amount,p.currency
    FROM job_activation_work_item_economic_plans p JOIN job_intakes i ON i.id=p.intake_id AND i.project_id=p.project_id AND i.company_id=p.company_id
    WHERE p.id=$1 AND p.project_id=$2 AND p.company_id=$3 AND i.status='activated' FOR UPDATE OF p`, [fundingId, projectId, companyId])).rows[0];
  if (!row) fail("BONUS_FUNDING_REQUIRED", "An activated, scoped economic-plan reserve is required; a performance scenario is not funding.");
  return { id: row.id, version: 1, fingerprint: row.plan_fingerprint, companyId, projectId, reserve: { amount: row.amount, currency: row.currency } };
}
async function eligibleRecipients(client: EdtTransactionClient, projectId: number, companyId: number): Promise<number[]> {
  const rows = await client.query<{ user_id: number }>(`SELECT DISTINCT pm.user_id FROM project_members pm JOIN users u ON u.id=pm.user_id
    WHERE pm.project_id=$1 AND pm.status='active' AND u.company_id=$2`, [projectId, companyId]);
  return rows.rows.map(row => Number(row.user_id));
}
async function reservations(client: EdtTransactionClient, fundingId: string, excludeId?: string): Promise<BonusReservation[]> {
  return (await client.query<any>(`SELECT p.id,p.funding_id AS "fundingId",p.company_id AS "companyId",p.project_id AS "projectId",
    COALESCE(d.outcome,'pending') AS state,jsonb_build_object('amount',p.amount::text,'currency',p.currency) AS amount
    FROM job_bonus_proposals p LEFT JOIN job_bonus_decisions d ON d.proposal_id=p.id
    WHERE p.funding_id=$1 AND ($2::text IS NULL OR p.id<>$2)`, [fundingId, excludeId ?? null])).rows;
}

export async function proposeManualBonus(actorUserId: number, projectId: number, input: {
  fundingId: string; idempotencyKey: string; reason: string; entries: Array<{ userId: number; amount: string }>;
}) {
  if (!input || typeof input.fundingId !== "string" || input.fundingId.length > 100 ||
      typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,100}$/.test(input.idempotencyKey))
    fail("BONUS_REQUEST_INVALID", "A funding identity and stable request key are required.");
  await ensureEdtEngineSchema();
  return withEdtTransaction(async client => {
    const auth = await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation: "prepare", client });
    const companyId = auth.scope.companyId;
    const funding = await fundingSource(client, input.fundingId, projectId, companyId);
    const proposal = prepareBonusProposal({ funding, makerUserId: actorUserId, reason: input.reason, entries: input.entries,
      eligibleUserIds: await eligibleRecipients(client, projectId, companyId) });
    const previous = (await client.query<any>(`SELECT id,fingerprint FROM job_bonus_proposals
      WHERE project_id=$1 AND maker_user_id=$2 AND idempotency_key=$3`, [projectId, actorUserId, input.idempotencyKey])).rows[0];
    if (previous) {
      if (previous.fingerprint !== proposal.fingerprint) fail("BONUS_IDEMPOTENCY_CONFLICT", "This request key belongs to different proposal content.");
      return { id: previous.id, fingerprint: previous.fingerprint, idempotent: true, paymentAuthorized: false };
    }
    verifyBonusCapacity(proposal, await reservations(client, funding.id));
    const proposalId = randomUUID();
    await client.query(`INSERT INTO job_bonus_proposals(id,company_id,project_id,funding_id,maker_user_id,idempotency_key,proposal,fingerprint,amount,currency)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`, [proposalId, companyId, projectId, funding.id, actorUserId, input.idempotencyKey, JSON.stringify(proposal), proposal.fingerprint, proposal.total.amount, proposal.total.currency]);
    return { id: proposalId, fingerprint: proposal.fingerprint, idempotent: false, paymentAuthorized: false };
  }).catch(concurrent);
}

export async function decideManualBonus(actorUserId: number, projectId: number, proposalId: string, input: {
  outcome: "approved" | "rejected"; expectedFingerprint: string; reason: string;
}) {
  if (!input || !["approved", "rejected"].includes(input.outcome)) fail("BONUS_DECISION_INVALID", "Choose approval or rejection.");
  const decisionReason = reason(input.reason);
  await ensureEdtEngineSchema();
  return withEdtTransaction(async client => {
    const read = await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.view", operation: "read", client });
    const row = (await client.query<any>(`SELECT * FROM job_bonus_proposals WHERE id=$1 AND project_id=$2 AND company_id=$3`, [proposalId, projectId, read.scope.companyId])).rows[0];
    if (!row) fail("BONUS_PROPOSAL_NOT_FOUND", "Proposal not found in this scope.");
    const proposal = row.proposal as BonusProposal;
    const funding = await fundingSource(client, row.funding_id, projectId, read.scope.companyId);
    const related = (await client.query<any>(`SELECT p.maker_user_id,p.amount::text,p.currency,p.created_at FROM job_bonus_proposals p
      LEFT JOIN job_bonus_decisions d ON d.proposal_id=p.id
      WHERE p.company_id=$1 AND p.project_id=$2 AND p.maker_user_id=$3 AND p.id<>$4
        AND p.created_at>=now()-interval '24 hours' AND COALESCE(d.outcome,'pending')<>'rejected'`,
      [read.scope.companyId, projectId, row.maker_user_id, proposalId])).rows;
    const auth = await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation: input.outcome === "approved" ? "approve" : "review",
      makerUserId: row.maker_user_id, category: "bonus_allocation", amount: proposal.total,
      relatedRequests: related.map(item => ({ makerUserId: item.maker_user_id, category: "bonus_allocation", amount: { amount: item.amount, currency: item.currency }, createdAt: new Date(item.created_at) })), client });
    verifyIndependentBonusDecision(proposal, { actorUserId, expectedFingerprint: input.expectedFingerprint, authority: auth.decision, outcome: input.outcome });
    if (funding.fingerprint !== proposal.funding.fingerprint) fail("BONUS_SOURCE_CHANGED", "The funding source differs from the submitted proposal.");
    if ((await client.query(`SELECT proposal_id FROM job_bonus_decisions WHERE proposal_id=$1`, [proposalId])).rows.length)
      fail("BONUS_ALREADY_DECIDED", "This proposal already has an immutable decision.");
    if (input.outcome === "approved") {
      const eligible = await eligibleRecipients(client, projectId, read.scope.companyId);
      if (proposal.entries.some(entry => !eligible.includes(entry.userId))) fail("BONUS_RECIPIENT_INELIGIBLE", "A recipient is no longer active in this company/project.");
      verifyBonusCapacity(proposal, await reservations(client, funding.id, proposalId));
    }
    await client.query(`INSERT INTO job_bonus_decisions(proposal_id,actor_user_id,outcome,reason,authority) VALUES($1,$2,$3,$4,$5::jsonb)`,
      [proposalId, actorUserId, input.outcome, decisionReason, JSON.stringify(auth.decision)]);
    return { id: proposalId, outcome: input.outcome, paymentAuthorized: false };
  }).catch(concurrent);
}
