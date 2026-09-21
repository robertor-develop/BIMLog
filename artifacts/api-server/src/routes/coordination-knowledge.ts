import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import {
  CoordinationKnowledgeAuthorizationError,
  requireKnowledgeCapability,
  resolveKnowledgeAuthorizationContext,
  type KnowledgeCapability,
} from "../lib/coordination-knowledge-authorization";
import { CoordinationKnowledgeContractError, validateConflictTypeRevision } from "../lib/coordination-knowledge-contract";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError } from "../lib/coordination-knowledge-repository";
import { ensureCoordinationKnowledgeSchema } from "../lib/coordination-knowledge-migration";

const router = Router();
const repository = new CoordinationKnowledgeRepository(pool);
const parameter = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

async function context(req: Parameters<typeof authMiddleware>[0], capability: KnowledgeCapability) {
  await ensureCoordinationKnowledgeSchema();
  const resolved = await resolveKnowledgeAuthorizationContext(pool, req.user!.userId);
  requireKnowledgeCapability(resolved, capability);
  return resolved;
}
function expectedRevision(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new CoordinationKnowledgeContractError("KNOWLEDGE_EXPECTED_REVISION_REQUIRED", "expectedRevision");
  return parsed;
}
function conflictContent(body: Record<string, unknown>, actorId: number, companyId: number, conflictTypeId: string, revision: number) {
  return validateConflictTypeRevision({
    id: randomUUID(), conflictTypeId, companyId, revision, status: "draft",
    name: body.name, description: body.description,
    disciplineA: body.disciplineA, disciplineB: body.disciplineB,
    elementTypeA: body.elementTypeA, elementTypeB: body.elementTypeB,
    conflictCategory: body.conflictCategory, coordinationStage: body.coordinationStage,
    tags: body.tags ?? [], authoredById: actorId,
  });
}
function sendError(res: Response, error: unknown): void {
  if (error instanceof CoordinationKnowledgeAuthorizationError || error instanceof CoordinationKnowledgeRepositoryError) {
    res.status(error.status).json({ code: error.code }); return;
  }
  if (error instanceof CoordinationKnowledgeContractError) { res.status(400).json({ code: error.code, field: error.field }); return; }
  if ((error as { code?: string })?.code === "23505") { res.status(409).json({ code: "KNOWLEDGE_DUPLICATE" }); return; }
  throw error;
}

router.get("/coordination-knowledge/capabilities", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "view_approved");
    res.json({ companyId: resolved.companyId, isCompanyPmo: resolved.isCompanyPmo, isSuperAdmin: resolved.isSuperAdmin, capabilities: [...resolved.capabilities] });
  } catch (error) { sendError(res, error); }
});

router.get("/coordination-knowledge/conflict-types", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "view_approved");
    res.json({ items: await repository.listConflictTypes(resolved.companyId, resolved.capabilities.has("view_draft")) });
  } catch (error) { sendError(res, error); }
});

router.post("/coordination-knowledge/conflict-types", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "create_draft");
    const id = randomUUID();
    const code = String(req.body?.code ?? "").trim().toUpperCase();
    if (!codePattern.test(code)) throw new CoordinationKnowledgeContractError("COORDINATION_KNOWLEDGE_INVALID", "code");
    const revision = conflictContent(req.body ?? {}, resolved.userId, resolved.companyId, id, 1);
    await repository.createConflictType({ identity: { id, companyId: resolved.companyId, code, createdById: resolved.userId }, revision });
    res.status(201).json({ item: await repository.getConflictType(resolved.companyId, id, true) });
  } catch (error) { sendError(res, error); }
});

router.get("/coordination-knowledge/conflict-types/:id/history", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "view_approved");
    const items = await repository.conflictTypeHistory(resolved.companyId, parameter(req.params.id), resolved.capabilities.has("view_draft"));
    if (!items.length) { res.status(404).json({ code: "KNOWLEDGE_CONFLICT_TYPE_NOT_FOUND" }); return; }
    res.json({ items });
  } catch (error) { sendError(res, error); }
});

router.get("/coordination-knowledge/conflict-types/:id", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "view_approved");
    const item = await repository.getConflictType(resolved.companyId, parameter(req.params.id), resolved.capabilities.has("view_draft"));
    if (!item) { res.status(404).json({ code: "KNOWLEDGE_CONFLICT_TYPE_NOT_FOUND" }); return; }
    res.json({ item });
  } catch (error) { sendError(res, error); }
});

router.patch("/coordination-knowledge/conflict-types/:id", authMiddleware, async (req, res) => {
  try {
    const resolved = await context(req, "edit_draft");
    const expected = expectedRevision(req.body?.expectedRevision);
    const content = conflictContent(req.body ?? {}, resolved.userId, resolved.companyId, parameter(req.params.id), expected + 1);
    const item = await repository.appendConflictTypeRevision({ companyId: resolved.companyId, conflictTypeId: parameter(req.params.id), expectedRevision: expected, actorId: resolved.userId, action: "update_draft", content });
    res.json({ item });
  } catch (error) { sendError(res, error); }
});

for (const action of ["submit_for_review", "approve", "revise", "retire"] as const) {
  const capability: KnowledgeCapability = action === "approve" ? "approve" : action === "retire" ? "retire" : action === "submit_for_review" ? "submit_for_review" : "create_draft";
  router.post(`/coordination-knowledge/conflict-types/:id/${action.replaceAll("_", "-")}`, authMiddleware, async (req, res) => {
    try {
      const resolved = await context(req, capability);
      const item = await repository.appendConflictTypeRevision({ companyId: resolved.companyId, conflictTypeId: parameter(req.params.id), expectedRevision: expectedRevision(req.body?.expectedRevision), actorId: resolved.userId, action });
      res.json({ item });
    } catch (error) { sendError(res, error); }
  });
}

export default router;
