import { createHash } from "node:crypto";

export type ApprovedLaborSource = {
  ledgerId: string; entryId: string; entryVersion: number; workItemId: string; taskId: string;
  userId: number; approvedById: number; approvedAt: string; workDate: string;
  hours: string; amount: string; currency: string; baselineFingerprint: string;
  sourceFingerprint: string; assignmentVersion: number;
};

export const approvedLaborEvidenceSql = `SELECT l.id AS "ledgerId",e.id AS "entryId",
  e.optimistic_version AS "entryVersion",e.work_item_id AS "workItemId",e.task_id AS "taskId",
  e.user_id AS "userId",e.decided_by_id AS "approvedById",to_char(e.decided_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "approvedAt",
  e.work_date::text AS "workDate",(-l.hours_delta)::text AS hours,(-l.amount_delta)::text AS amount,
  l.evidence->>'currency' AS currency,l.evidence->>'baselineFingerprint' AS "baselineFingerprint",
  l.source_fingerprint AS "sourceFingerprint",(l.evidence->>'assignmentVersion')::integer AS "assignmentVersion"
  FROM job_activation_time_entries e
  JOIN job_intakes i ON i.id=e.intake_id AND i.project_id=e.project_id
  LEFT JOIN job_activation_budget_ledger_entries l ON l.time_entry_id=e.id AND l.project_id=e.project_id
    AND l.company_id=i.company_id AND l.work_item_id=e.work_item_id AND l.task_id=e.task_id
    AND l.intake_id=e.intake_id AND l.assignment_id=e.assignment_id AND l.actor_user_id=e.decided_by_id
    AND -l.hours_delta=e.hours
    AND l.source_version=e.optimistic_version-1 AND l.ledger_state='approved_consumed'
  WHERE e.project_id=$1 AND i.company_id=$2 AND e.status='approved'
    AND e.superseded_by_entry_id IS NULL AND e.work_date<=$3::date
    AND e.decided_by_id IS NOT NULL AND e.decided_at IS NOT NULL
    AND e.decided_by_id<>e.user_id AND e.decided_by_id<>e.created_by_id
    AND e.decided_by_id<>e.submitted_by_id
  ORDER BY l.id LIMIT 5001`;

const units = (value: string) => {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) throw new Error("APPROVED_LABOR_DECIMAL_INVALID");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6,"0"));
};
const decimal = (value: bigint) => `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6,"0")}`;

/** Evidence of approved labor cost, never a derived earning or bonus entitlement. */
export function buildApprovedLaborEvidence(rows: ApprovedLaborSource[], currency: string, cutoff: string) {
  if (rows.length > 5000) throw new Error("APPROVED_LABOR_EVIDENCE_LIMIT");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("APPROVED_LABOR_CURRENCY_MISMATCH");
  const seen = new Set<string>();
  let amount = 0n, hours = 0n;
  if(rows.some(row=>!row.ledgerId)) throw new Error("APPROVED_LABOR_PROVENANCE_MISSING");
  const sources = rows.map(row=>({...row})).sort((a,b)=>a.ledgerId.localeCompare(b.ledgerId));
  for (const row of sources) {
    if (seen.has(row.entryId)) throw new Error("APPROVED_LABOR_DUPLICATE_ENTRY");
    seen.add(row.entryId);
    if (row.currency !== currency || !/^[A-Z]{3}$/.test(currency)) throw new Error("APPROVED_LABOR_CURRENCY_MISMATCH");
    if (!row.baselineFingerprint || !row.sourceFingerprint || !row.approvedById || !row.assignmentVersion)
      throw new Error("APPROVED_LABOR_PROVENANCE_MISSING");
    amount += units(row.amount); hours += units(row.hours);
  }
  const evidence = { schemaVersion:1, classification:"approved_labor_cost", cutoff, currency,
    policy:"current_independently_approved_entries.v1", sourceCount:sources.length,
    amount:decimal(amount), hours:decimal(hours), paymentAuthorized:false, sources };
  return {...evidence,fingerprint:createHash("sha256").update(JSON.stringify(evidence)).digest("hex")};
}
