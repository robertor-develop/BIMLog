import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { ensureDeliveryWorkflowRuntimeSchema } from "./delivery-workflow-template-migration";
import {
  deliveryWorkflowOptions,
  chooseDeliveryWorkflow,
} from "./delivery-workflow-selection";
import {
  deliveryWorkflowFingerprint,
  validateDeliveryWorkflowDefinition,
  type DeliveryWorkflowDefinition,
} from "./delivery-workflow-template-contract";
import { jobOperationScope } from "./job-operations-service";
import { resolveWorkflowGovernanceSnapshot } from "./workflow-governance-binding";
import { validateWorkflowGovernancePolicy, workflowGovernancePolicyFingerprint } from "./workflow-governance-policy-contract";

type Queryable = {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
};
type Role = "execute" | "review" | "approve";
const roles: Role[] = ["execute", "review", "approve"];
const int = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new FinancialControlError(
      400,
      "DELIVERY_WORKFLOW_INPUT_INVALID",
      `${field} must be a positive integer.`,
    );
  return parsed;
};
const identifier = (value: unknown, field: string) => {
  const parsed = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(parsed))
    throw new FinancialControlError(
      400,
      "DELIVERY_WORKFLOW_INPUT_INVALID",
      `${field} is invalid.`,
    );
  return parsed;
};
const reason = (value: unknown) => {
  const parsed = String(value ?? "").trim();
  if (!parsed || parsed.length > 500 || /[\u0000-\u001f\u007f]/.test(parsed))
    throw new FinancialControlError(
      400,
      "DELIVERY_WORKFLOW_REASON_REQUIRED",
      "A bounded reason is required to reopen workflow state.",
    );
  return parsed;
};

export async function bindDeliveryWorkflowWithClient(input: {
  client: Queryable;
  companyId: number;
  projectId: number;
  workItemId: string;
  actorUserId: number;
  deliverableType: unknown;
  selectedVersionId: unknown;
  executeUserId: number | null;
  leaderUserId: number | null;
}) {
  const prior = (await input.client.query(`SELECT work_item_id FROM company_delivery_workflow_work_items
    WHERE work_item_id=$1 AND company_id=$2 AND project_id=$3`, [input.workItemId,input.companyId,input.projectId])).rows[0];
  if (prior) return { workItemId: input.workItemId, created: false };
  const available = await deliveryWorkflowOptions(
    input.client,
    input.companyId,
  );
  const selected = chooseDeliveryWorkflow(
    available,
    input.deliverableType,
    input.selectedVersionId,
  );
  const option = selected.option;
  const governance = await resolveWorkflowGovernanceSnapshot(input.client, input.companyId, { templateId: option.templateId, definition: option.definition });
  const inserted = (
    await input.client.query(
      `INSERT INTO company_delivery_workflow_work_items
    (work_item_id,project_id,company_id,template_id,version_id,source,template_code,template_version,deliverable_type,definition,fingerprint,selection,activated_by_id,
      policy_id,policy_version_id,policy_code,policy_version,policy_definition,policy_fingerprint)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19) ON CONFLICT(work_item_id) DO NOTHING RETURNING work_item_id`,
      [
        input.workItemId,
        input.projectId,
        input.companyId,
        option.templateId,
        option.source === "company" ? option.versionId : null,
        option.source,
        option.code,
        option.version,
        selected.deliverableType,
        JSON.stringify(option.definition),
        option.fingerprint,
        selected.selection,
        input.actorUserId,
        governance?.policyId ?? null,
        governance?.versionId ?? null,
        governance?.code ?? null,
        governance?.version ?? null,
        governance ? JSON.stringify(governance.definition) : null,
        governance?.fingerprint ?? null,
      ],
    )
  ).rows[0];
  if (!inserted) return { workItemId: input.workItemId, created: false };
  for (const phase of option.definition.phases) {
    await input.client.query(
      `INSERT INTO company_delivery_workflow_phase_checks(work_item_id,phase_id) VALUES($1,$2)`,
      [input.workItemId, phase.id],
    );
    for (const task of phase.tasks)
      await input.client.query(
        `INSERT INTO company_delivery_workflow_steps(work_item_id,phase_id,task_id) VALUES($1,$2,$3)`,
        [input.workItemId, phase.id, task.id],
      );
  }
  const assignments: Array<[Role, number | null]> = [
    ["execute", input.executeUserId ?? input.leaderUserId],
    ["review", input.leaderUserId],
    ["approve", input.leaderUserId],
  ];
  for (const [role, userId] of assignments)
    if (userId) {
      const member = (
        await input.client.query(
          `SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active'`,
          [input.projectId, userId],
        )
      ).rows[0];
      if (member)
        await input.client.query(
          `INSERT INTO company_delivery_workflow_roles(work_item_id,role,user_id,assigned_by_id) VALUES($1,$2,$3,$4)`,
          [input.workItemId, role, userId, input.actorUserId],
        );
    }
  await runtimeEvent(input.client, {
    workItemId: input.workItemId,
    projectId: input.projectId,
    actorId: input.actorUserId,
    action: "activated",
    phaseId: option.definition.phases[0].id,
    afterState: "active",
    evidence: {
      versionId: option.versionId,
      source: option.source,
      fingerprint: option.fingerprint,
      selection: selected.selection,
      governancePolicyVersionId: governance?.versionId ?? null,
      governancePolicyFingerprint: governance?.fingerprint ?? null,
    },
  });
  return {
    workItemId: input.workItemId,
    created: true,
    versionId: option.versionId,
    fingerprint: option.fingerprint,
  };
}

async function runtimeEvent(
  client: Queryable,
  value: {
    workItemId: string;
    projectId: number;
    actorId: number;
    action: string;
    phaseId?: string | null;
    taskId?: string | null;
    beforeState?: string | null;
    afterState?: string | null;
    reason?: string | null;
    evidence?: object;
  },
) {
  await client.query(
    `INSERT INTO company_delivery_workflow_work_item_events(id,work_item_id,project_id,action,phase_id,task_id,actor_id,before_state,after_state,reason,evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [
      randomUUID(),
      value.workItemId,
      value.projectId,
      value.action,
      value.phaseId ?? null,
      value.taskId ?? null,
      value.actorId,
      value.beforeState ?? null,
      value.afterState ?? null,
      value.reason ?? null,
      JSON.stringify(value.evidence ?? {}),
    ],
  );
}

async function locked(
  client: Queryable,
  input: {
    actorUserId: number;
    projectId: unknown;
    workItemId: unknown;
    expectedRevision?: unknown;
  },
) {
  const projectId = int(input.projectId, "projectId"),
    workItemId = identifier(input.workItemId, "workItemId");
  const access = await jobOperationScope(input.actorUserId, projectId, client);
  const binding = (
    await client.query(
      `SELECT b.* FROM company_delivery_workflow_work_items b JOIN job_activation_work_items w ON w.id=b.work_item_id
    WHERE b.work_item_id=$1 AND b.project_id=$2 AND b.company_id=$3 AND w.project_id=$2 FOR UPDATE OF b`,
      [workItemId, projectId, access.companyId],
    )
  ).rows[0];
  if (!binding)
    throw new FinancialControlError(
      404,
      "DELIVERY_WORKFLOW_WORK_ITEM_NOT_FOUND",
      "This Work Item has no activated Delivery Workflow.",
    );
  if (
    input.expectedRevision !== undefined &&
    Number(binding.revision) !== int(input.expectedRevision, "expectedRevision")
  )
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_STALE",
      "This Delivery Workflow changed. Reload before saving.",
    );
  const definition = validateDeliveryWorkflowDefinition(binding.definition);
  if (deliveryWorkflowFingerprint(definition) !== binding.fingerprint)
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_SNAPSHOT_MISMATCH",
      "The activated Delivery Workflow snapshot failed integrity verification.",
    );
  if (binding.policy_definition != null && workflowGovernancePolicyFingerprint(binding.policy_definition) !== binding.policy_fingerprint)
    throw new FinancialControlError(409,"WORKFLOW_POLICY_SNAPSHOT_MISMATCH","The activated Governance Policy snapshot failed integrity verification.");
  const phase = definition.phases[Number(binding.phase_index) - 1];
  if (!phase)
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_PHASE_INVALID",
      "The current workflow phase is invalid.",
    );
  return { access, binding, definition, phase, projectId, workItemId };
}

async function requireRole(
  client: Queryable,
  workItemId: string,
  role: Role,
  actorUserId: number,
) {
  const row = (
    await client.query(
      `SELECT user_id FROM company_delivery_workflow_roles WHERE work_item_id=$1 AND role=$2`,
      [workItemId, role],
    )
  ).rows[0];
  if (!row || Number(row.user_id) !== actorUserId)
    throw new FinancialControlError(
      403,
      "DELIVERY_WORKFLOW_ROLE_REQUIRED",
      `The assigned ${role} role is required for this action.`,
    );
}
async function allStepsComplete(
  client: Queryable,
  workItemId: string,
  phase: DeliveryWorkflowDefinition["phases"][number],
) {
  const rows = (
    await client.query(
      `SELECT task_id,status FROM company_delivery_workflow_steps WHERE work_item_id=$1 AND phase_id=$2`,
      [workItemId, phase.id],
    )
  ).rows;
  if (
    rows.length !== phase.tasks.length ||
    phase.tasks.some(
      (task) =>
        rows.find((row) => row.task_id === task.id)?.status !== "complete",
    )
  )
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_TASKS_INCOMPLETE",
      "Complete every workflow checkpoint in this phase first.",
    );
}
async function requiredEvidence(
  client: Queryable,
  workItemId: string,
  phase: DeliveryWorkflowDefinition["phases"][number],
  transitionDocuments: string[] = [],
) {
  const rows = (
    await client.query(
      `SELECT phase_id,task_id,document_code FROM company_delivery_workflow_evidence WHERE work_item_id=$1 AND phase_id=$2`,
      [workItemId, phase.id],
    )
  ).rows;
  for (const task of phase.tasks)
    for (const code of task.requiredDocuments) {
      if (
        !rows.some(
          (row) => row.task_id === task.id && row.document_code === code,
        )
      )
        throw new FinancialControlError(
          409,
          "DELIVERY_WORKFLOW_DOCUMENT_REQUIRED",
          `Required ${code} evidence is missing for ${task.name}.`,
        );
    }
  for (const code of transitionDocuments)
    if (!rows.some((row) => row.document_code === code))
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_DOCUMENT_REQUIRED",
        `Required ${code} phase evidence is missing.`,
      );
}
async function phaseChecks(
  client: Queryable,
  workItemId: string,
  phaseId: string,
) {
  return (
    await client.query(
      `SELECT * FROM company_delivery_workflow_phase_checks WHERE work_item_id=$1 AND phase_id=$2`,
      [workItemId, phaseId],
    )
  ).rows[0];
}
async function bump(client: Queryable, workItemId: string) {
  return (
    await client.query(
      `UPDATE company_delivery_workflow_work_items SET revision=revision+1,updated_at=now() WHERE work_item_id=$1 RETURNING revision`,
      [workItemId],
    )
  ).rows[0].revision;
}
async function mutate<T>(
  input: {
    actorUserId: number;
    projectId: unknown;
    workItemId: unknown;
    expectedRevision: unknown;
  },
  run: (
    client: Queryable,
    context: Awaited<ReturnType<typeof locked>>,
  ) => Promise<T>,
) {
  // Mutations always require the revision observed by the caller, including first writes.
  if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 1)
    throw new FinancialControlError(400,"DELIVERY_WORKFLOW_REVISION_REQUIRED","Reload the workflow and submit its current revision.");
  await ensureDeliveryWorkflowRuntimeSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const context = await locked(client, input);
    const result = await run(client, context);
    const revision = await bump(client, context.workItemId);
    await client.query("COMMIT");
    return { ...result, revision: Number(revision) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWorkItemDeliveryWorkflow(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
}) {
  await ensureDeliveryWorkflowRuntimeSchema();
  const projectId = int(input.projectId, "projectId"),
    workItemId = identifier(input.workItemId, "workItemId");
  const access = await jobOperationScope(input.actorUserId, projectId, pool);
  const binding = (
    await pool.query(
      `SELECT b.* FROM company_delivery_workflow_work_items b JOIN job_activation_work_items w ON w.id=b.work_item_id
    WHERE b.work_item_id=$1 AND b.project_id=$2 AND b.company_id=$3 AND w.project_id=$2`,
      [workItemId, projectId, access.companyId],
    )
  ).rows[0];
  if (!binding)
    throw new FinancialControlError(
      404,
      "DELIVERY_WORKFLOW_WORK_ITEM_NOT_FOUND",
      "This Work Item has no activated Delivery Workflow.",
    );
  const definition = validateDeliveryWorkflowDefinition(binding.definition);
  if (deliveryWorkflowFingerprint(definition) !== binding.fingerprint)
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_SNAPSHOT_MISMATCH",
      "The activated Delivery Workflow snapshot failed integrity verification.",
    );
  const governance = binding.policy_definition == null ? null : validateWorkflowGovernancePolicy(binding.policy_definition);
  if (governance && workflowGovernancePolicyFingerprint(governance) !== binding.policy_fingerprint)
    throw new FinancialControlError(409,"WORKFLOW_POLICY_SNAPSHOT_MISMATCH","The activated Governance Policy snapshot failed integrity verification.");
  const [steps, roles, evidence, checks, events] = await Promise.all([
    pool.query(
      `SELECT phase_id "phaseId",task_id "taskId",status,revision,completed_by_id "completedById",completed_at "completedAt" FROM company_delivery_workflow_steps WHERE work_item_id=$1 ORDER BY phase_id,task_id`,
      [workItemId],
    ),
    pool.query(
      `SELECT role,user_id "userId",assigned_at "assignedAt" FROM company_delivery_workflow_roles WHERE work_item_id=$1 ORDER BY role`,
      [workItemId],
    ),
    pool.query(
      `SELECT id,phase_id "phaseId",task_id "taskId",document_code "documentCode",file_id "fileId",linked_at "linkedAt" FROM company_delivery_workflow_evidence WHERE work_item_id=$1 ORDER BY linked_at,id`,
      [workItemId],
    ),
    pool.query(
      `SELECT phase_id "phaseId",qc_approved_by_id "qcApprovedById",qc_approved_at "qcApprovedAt",approved_by_id "approvedById",approved_at "approvedAt" FROM company_delivery_workflow_phase_checks WHERE work_item_id=$1`,
      [workItemId],
    ),
    pool.query(
      `SELECT id,action,phase_id "phaseId",task_id "taskId",actor_id "actorId",before_state "beforeState",after_state "afterState",reason,evidence,created_at "createdAt" FROM company_delivery_workflow_work_item_events WHERE work_item_id=$1 ORDER BY created_at,id`,
      [workItemId],
    ),
  ]);
  return {
    workItemId,
    projectId,
    templateCode: binding.template_code,
    templateVersion: Number(binding.template_version),
    versionId:
      binding.version_id ??
      (binding.source === "bimlog"
        ? `bimlog:${binding.template_code}:1`
        : null),
    source: binding.source,
    deliverableType: binding.deliverable_type,
    definition,
    fingerprint: binding.fingerprint,
    selection: binding.selection,
    governancePolicy: governance ? { code:binding.policy_code,version:Number(binding.policy_version),
      versionId:binding.policy_version_id,fingerprint:binding.policy_fingerprint,definition:governance } : null,
    status: binding.status,
    phaseIndex: Number(binding.phase_index),
    revision: Number(binding.revision),
    canManage: access.canManage,
    steps: steps.rows,
    roles: roles.rows,
    evidence: evidence.rows,
    checks: checks.rows,
    events: events.rows,
  };
}

export function assignWorkItemDeliveryRole(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
  role: unknown;
  userId: unknown;
}) {
  return mutate(input, async (client, context) => {
    if (!context.access.canManage)
      throw new FinancialControlError(
        403,
        "DELIVERY_WORKFLOW_MANAGER_REQUIRED",
        "Only a project manager may assign Delivery Workflow roles.",
      );
    const role = String(input.role) as Role,
      userId = int(input.userId, "userId");
    if (!roles.includes(role))
      throw new FinancialControlError(
        400,
        "DELIVERY_WORKFLOW_ROLE_INVALID",
        "Choose Execute, Review, or Approve.",
      );
    const member = (
      await client.query(
        `SELECT 1 FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.status='active' AND u.company_id=$3`,
        [context.projectId, userId, context.access.companyId],
      )
    ).rows[0];
    if (!member)
      throw new FinancialControlError(
        400,
        "DELIVERY_WORKFLOW_ROLE_MEMBER_INVALID",
        "The role holder must be an active member of this project and company.",
      );
    const before = (
      await client.query(
        `SELECT user_id FROM company_delivery_workflow_roles WHERE work_item_id=$1 AND role=$2`,
        [context.workItemId, role],
      )
    ).rows[0];
    await client.query(
      `INSERT INTO company_delivery_workflow_roles(work_item_id,role,user_id,assigned_by_id) VALUES($1,$2,$3,$4)
      ON CONFLICT(work_item_id,role) DO UPDATE SET user_id=EXCLUDED.user_id,assigned_by_id=EXCLUDED.assigned_by_id,assigned_at=now()`,
      [context.workItemId, role, userId, input.actorUserId],
    );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: "role_assigned",
      beforeState: before?.user_id == null ? null : String(before.user_id),
      afterState: String(userId),
      evidence: { role },
    });
    return { workItemId: context.workItemId, role, userId };
  });
}

export function setWorkItemDeliveryStep(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
  phaseId: unknown;
  taskId: unknown;
  status: unknown;
  reason?: unknown;
}) {
  return mutate(input, async (client, context) => {
    const phaseId = identifier(input.phaseId, "phaseId"),
      taskId = identifier(input.taskId, "taskId"),
      status = String(input.status);
    if (
      context.phase.id !== phaseId ||
      !context.phase.tasks.some((task) => task.id === taskId) ||
      context.binding.status !== "active"
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_STEP_NOT_CURRENT",
        "Only a checkpoint in the current active phase may change.",
      );
    if (status !== "complete" && status !== "pending")
      throw new FinancialControlError(
        400,
        "DELIVERY_WORKFLOW_STEP_STATUS_INVALID",
        "Choose pending or complete.",
      );
    await requireRole(
      client,
      context.workItemId,
      status === "pending" ? context.definition.reopen.role : "execute",
      input.actorUserId,
    );
    const before = (
      await client.query(
        `SELECT status FROM company_delivery_workflow_steps WHERE work_item_id=$1 AND phase_id=$2 AND task_id=$3 FOR UPDATE`,
        [context.workItemId, phaseId, taskId],
      )
    ).rows[0];
    if (!before || before.status === status)
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_STEP_UNCHANGED",
        "The checkpoint is already in that state.",
      );
    const reopenReason = status === "pending" ? reason(input.reason) : null;
    await client.query(
      `UPDATE company_delivery_workflow_steps SET status=$4,revision=revision+1,completed_by_id=$5,completed_at=CASE WHEN $4='complete' THEN now() ELSE NULL END
      WHERE work_item_id=$1 AND phase_id=$2 AND task_id=$3`,
      [
        context.workItemId,
        phaseId,
        taskId,
        status,
        status === "complete" ? input.actorUserId : null,
      ],
    );
    if (status === "pending")
      await client.query(
        `UPDATE company_delivery_workflow_phase_checks SET qc_approved_by_id=NULL,qc_approved_at=NULL,approved_by_id=NULL,approved_at=NULL WHERE work_item_id=$1 AND phase_id=$2`,
        [context.workItemId, phaseId],
      );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: status === "complete" ? "step_completed" : "step_reopened",
      phaseId,
      taskId,
      beforeState: before.status,
      afterState: status,
      reason: reopenReason,
    });
    return { workItemId: context.workItemId, phaseId, taskId, status };
  });
}

export function linkWorkItemDeliveryEvidence(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
  phaseId: unknown;
  taskId: unknown;
  documentCode: unknown;
  fileId: unknown;
}) {
  return mutate(input, async (client, context) => {
    const phaseId = identifier(input.phaseId, "phaseId"),
      taskId = identifier(input.taskId, "taskId"),
      documentCode = identifier(input.documentCode, "documentCode"),
      fileId = int(input.fileId, "fileId");
    if (
      context.phase.id !== phaseId ||
      !context.phase.tasks.some((task) => task.id === taskId) ||
      context.binding.status !== "active"
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_STEP_NOT_CURRENT",
        "Evidence belongs to a checkpoint in the current active phase.",
      );
    const task = context.phase.tasks.find(
      (candidate) => candidate.id === taskId,
    )!;
    const transition =
      context.definition.transitions[Number(context.binding.phase_index) - 1];
    if (
      ![
        ...task.requiredDocuments,
        ...(transition?.requiredDocuments ?? []),
      ].includes(documentCode)
    )
      throw new FinancialControlError(
        400,
        "DELIVERY_WORKFLOW_DOCUMENT_CODE_INVALID",
        "The document code is not required by this checkpoint or phase gate.",
      );
    await requireRole(client, context.workItemId, "execute", input.actorUserId);
    const file = (
      await client.query(`SELECT 1 FROM files WHERE id=$1 AND project_id=$2`, [
        fileId,
        context.projectId,
      ])
    ).rows[0];
    if (!file)
      throw new FinancialControlError(
        404,
        "DELIVERY_WORKFLOW_FILE_NOT_FOUND",
        "Choose an existing file in this project.",
      );
    const id = randomUUID();
    const inserted = (
      await client.query(
        `INSERT INTO company_delivery_workflow_evidence(id,work_item_id,phase_id,task_id,document_code,file_id,linked_by_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(work_item_id,phase_id,task_id,document_code,file_id) DO NOTHING RETURNING id`,
        [
          id,
          context.workItemId,
          phaseId,
          taskId,
          documentCode,
          fileId,
          input.actorUserId,
        ],
      )
    ).rows[0];
    if (!inserted)
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_EVIDENCE_EXISTS",
        "This file is already linked to that requirement.",
      );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: "evidence_linked",
      phaseId,
      taskId,
      evidence: { fileId, documentCode },
    });
    return {
      workItemId: context.workItemId,
      evidenceId: id,
      fileId,
      documentCode,
    };
  });
}

export function approveWorkItemDeliveryPhase(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
  kind: "qc" | "approval";
}) {
  return mutate(input, async (client, context) => {
    if (context.binding.status !== "active")
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_ALREADY_COMPLETE",
        "Reopen the workflow before approving a phase.",
      );
    const phase = context.phase;
    if (
      (input.kind === "qc" &&
        !(phase.qcRequired || phase.completionRule === "all_tasks_reviewed")) ||
      (input.kind === "approval" && !phase.approvalRequired)
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_APPROVAL_NOT_REQUIRED",
        "This phase does not require that approval.",
      );
    await requireRole(
      client,
      context.workItemId,
      input.kind === "qc" ? "review" : "approve",
      input.actorUserId,
    );
    await allStepsComplete(client, context.workItemId, phase);
    await requiredEvidence(client, context.workItemId, phase);
    const before = await phaseChecks(client, context.workItemId, phase.id);
    if (
      input.kind === "approval" &&
      (phase.qcRequired || phase.completionRule === "all_tasks_reviewed") &&
      !before?.qc_approved_at
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_QC_REQUIRED",
        "QC must approve this phase first.",
      );
    if (
      (input.kind === "qc" && before?.qc_approved_at) ||
      (input.kind === "approval" && before?.approved_at)
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_ALREADY_APPROVED",
        "This phase already has that approval.",
      );
    if (input.kind === "qc")
      await client.query(
        `UPDATE company_delivery_workflow_phase_checks SET qc_approved_by_id=$3,qc_approved_at=now() WHERE work_item_id=$1 AND phase_id=$2`,
        [context.workItemId, phase.id, input.actorUserId],
      );
    else
      await client.query(
        `UPDATE company_delivery_workflow_phase_checks SET approved_by_id=$3,approved_at=now() WHERE work_item_id=$1 AND phase_id=$2`,
        [context.workItemId, phase.id, input.actorUserId],
      );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: input.kind === "qc" ? "qc_approved" : "phase_approved",
      phaseId: phase.id,
      afterState: "approved",
    });
    return {
      workItemId: context.workItemId,
      phaseId: phase.id,
      kind: input.kind,
    };
  });
}

export function advanceWorkItemDeliveryPhase(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
}) {
  return mutate(input, async (client, context) => {
    if (context.binding.status !== "active")
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_ALREADY_COMPLETE",
        "This workflow is already complete.",
      );
    await requireRole(client, context.workItemId, "approve", input.actorUserId);
    await allStepsComplete(client, context.workItemId, context.phase);
    const index = Number(context.binding.phase_index) - 1;
    const transition = context.definition.transitions[index];
    await requiredEvidence(
      client,
      context.workItemId,
      context.phase,
      transition?.requiredDocuments ?? [],
    );
    const checks = await phaseChecks(
      client,
      context.workItemId,
      context.phase.id,
    );
    if (
      (context.phase.qcRequired ||
        context.phase.completionRule === "all_tasks_reviewed" ||
        transition?.gate === "qc_approved") &&
      !checks?.qc_approved_at
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_QC_REQUIRED",
        "QC approval is required before leaving this phase.",
      );
    if (
      (context.phase.approvalRequired ||
        transition?.gate === "approval_granted") &&
      !checks?.approved_at
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_APPROVAL_REQUIRED",
        "Approval is required before leaving this phase.",
      );
    const next = context.definition.phases[index + 1];
    if (next)
      await client.query(
        `UPDATE company_delivery_workflow_work_items SET phase_index=phase_index+1 WHERE work_item_id=$1`,
        [context.workItemId],
      );
    else
      await client.query(
        `UPDATE company_delivery_workflow_work_items SET status='complete' WHERE work_item_id=$1`,
        [context.workItemId],
      );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: next ? "phase_advanced" : "workflow_completed",
      phaseId: context.phase.id,
      beforeState: context.phase.id,
      afterState: next?.id ?? "complete",
    });
    return {
      workItemId: context.workItemId,
      phaseId: next?.id ?? null,
      status: next ? "active" : "complete",
    };
  });
}

export function reopenWorkItemDeliveryPhase(input: {
  actorUserId: number;
  projectId: unknown;
  workItemId: unknown;
  expectedRevision: unknown;
  targetPhaseId: unknown;
  reason: unknown;
}) {
  return mutate(input, async (client, context) => {
    await requireRole(
      client,
      context.workItemId,
      context.definition.reopen.role,
      input.actorUserId,
    );
    const targetPhaseId = identifier(input.targetPhaseId, "targetPhaseId");
    const targetIndex = context.definition.phases.findIndex(
      (phase) => phase.id === targetPhaseId,
    );
    if (
      targetIndex < 0 ||
      targetIndex + 1 > Number(context.binding.phase_index) ||
      (context.binding.status === "active" &&
        targetIndex + 1 === Number(context.binding.phase_index))
    )
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_REOPEN_TARGET_INVALID",
        "Choose a completed or earlier phase to reopen.",
      );
    const reopenReason = reason(input.reason);
    const affected = context.definition.phases
      .slice(targetIndex)
      .map((phase) => phase.id);
    await client.query(
      `UPDATE company_delivery_workflow_work_items SET phase_index=$2,status='active' WHERE work_item_id=$1`,
      [context.workItemId, targetIndex + 1],
    );
    await client.query(
      `UPDATE company_delivery_workflow_steps SET status='pending',revision=revision+1,completed_by_id=NULL,completed_at=NULL WHERE work_item_id=$1 AND phase_id=ANY($2::text[])`,
      [context.workItemId, affected],
    );
    await client.query(
      `UPDATE company_delivery_workflow_phase_checks SET qc_approved_by_id=NULL,qc_approved_at=NULL,approved_by_id=NULL,approved_at=NULL WHERE work_item_id=$1 AND phase_id=ANY($2::text[])`,
      [context.workItemId, affected],
    );
    await runtimeEvent(client, {
      workItemId: context.workItemId,
      projectId: context.projectId,
      actorId: input.actorUserId,
      action: "phase_reopened",
      phaseId: targetPhaseId,
      beforeState:
        context.binding.status === "complete" ? "complete" : context.phase.id,
      afterState: targetPhaseId,
      reason: reopenReason,
      evidence: { resetPhases: affected },
    });
    return {
      workItemId: context.workItemId,
      phaseId: targetPhaseId,
      status: "active",
    };
  });
}
