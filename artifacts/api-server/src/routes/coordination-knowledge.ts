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
import {
  CoordinationKnowledgeContractError,
  validateConflictTypeRevision,
  validateCoordinationRuleRevision,
  validateResolutionMethodRevision,
} from "../lib/coordination-knowledge-contract";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError } from "../lib/coordination-knowledge-repository";
import { ensureCoordinationKnowledgeSchema } from "../lib/coordination-knowledge-migration";

const router = Router();
const repository = new CoordinationKnowledgeRepository(pool);
const parameter = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

async function context(req: Parameters<typeof authMiddleware>[0], capability: KnowledgeCapability) {
  await ensureCoordinationKnowledgeSchema();
  const rawProjectId = req.query.projectId;
  const projectId = rawProjectId == null ? null : Number(Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId);
  if (projectId !== null && (!Number.isSafeInteger(projectId) || projectId <= 0)) throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_INVALID", "projectId");
  const resolved = await resolveKnowledgeAuthorizationContext(pool, req.user!.userId, projectId);
  requireKnowledgeCapability(resolved, capability);
  return resolved;
}
function expectedRevision(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new CoordinationKnowledgeContractError("KNOWLEDGE_EXPECTED_REVISION_REQUIRED", "expectedRevision");
  return parsed;
}
function lifecycleRationale(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 1000) throw new CoordinationKnowledgeContractError("KNOWLEDGE_RATIONALE_REQUIRED", "rationale");
  return value.trim();
}
function boundedQuery(value: unknown, field: string, max=160): string | undefined {
  if(value==null||value==="") return undefined;
  if(Array.isArray(value)||typeof value!=="string"||value.trim().length>max) throw new CoordinationKnowledgeContractError("KNOWLEDGE_SEARCH_INVALID",field);
  return value.trim();
}
function pageNumber(value: unknown, field: string, fallback: number, maximum: number): number {
  if(value==null||value==="") return fallback;
  const parsed=Number(value); if(!Number.isSafeInteger(parsed)||parsed<1||parsed>maximum) throw new CoordinationKnowledgeContractError("KNOWLEDGE_SEARCH_INVALID",field);
  return parsed;
}
const evidenceEntityTypes=["conflict_type","coordination_rule","resolution_method","project_case","lesson_proposal"] as const;
const evidenceRoles=["attachment","reference","before","after","supporting"] as const;
function evidenceChoice(value:unknown,choices:readonly string[],field:string):string{if(typeof value!=="string"||!choices.includes(value))throw new CoordinationKnowledgeContractError("KNOWLEDGE_EVIDENCE_INVALID",field);return value;}
function nullableText(value:unknown,field:string,maximum:number):string|null{if(value==null||value==="")return null;if(typeof value!=="string"||value.trim().length>maximum)throw new CoordinationKnowledgeContractError("RESOLUTION_RECORD_INVALID",field);return value.trim();}
function resolutionRecordBody(body:Record<string,unknown>){return {methodRevisionId:nullableText(body.methodRevisionId,"methodRevisionId",64),actualResolution:nullableText(body.actualResolution,"actualResolution",8000),disciplineChanged:nullableText(body.disciplineChanged,"disciplineChanged",160),responsibleTrade:nullableText(body.responsibleTrade,"responsibleTrade",160),rfiRequired:body.rfiRequired===true,rfiReference:nullableText(body.rfiReference,"rfiReference",500),drawingSubmittalReference:nullableText(body.drawingSubmittalReference,"drawingSubmittalReference",1000)};}
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
function ruleContent(body: Record<string, unknown>, actorId: number, companyId: number, ruleId: string, revision: number) {
  return validateCoordinationRuleRevision({ id: randomUUID(), ruleId, companyId, revision, status: "draft",
    title: body.title, guidance: body.guidance, applicability: body.applicability ?? {}, rationale: body.rationale,
    exceptions: body.exceptions ?? [], references: body.references ?? [], authoredById: actorId });
}
function resolutionContent(body: Record<string, unknown>, actorId: number, companyId: number, resolutionMethodId: string, revision: number) {
  return validateResolutionMethodRevision({ id: randomUUID(), resolutionMethodId, companyId, revision, status: "draft",
    name: body.name, description: body.description, applicability: body.applicability ?? {}, responsibleTrade: body.responsibleTrade ?? null,
    constraints: body.constraints ?? [], advantages: body.advantages ?? [], disadvantages: body.disadvantages ?? [], requiredApprovals: body.requiredApprovals ?? [],
    rfiRequirement: body.rfiRequirement ?? "conditional", details: body.details ?? {}, conflictTypeIds: body.conflictTypeIds, ruleRevisionIds: body.ruleRevisionIds ?? [], authoredById: actorId });
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

router.get("/coordination-knowledge/lens-context/:lensViewpointId",authMiddleware,async(req,res)=>{try{
  const resolved=await context(req,"view_approved");
  if(!resolved.projectId) throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_REQUIRED","projectId");
  const lensViewpointId=Number(parameter(req.params.lensViewpointId));
  if(!Number.isSafeInteger(lensViewpointId)||lensViewpointId<1) throw new CoordinationKnowledgeContractError("KNOWLEDGE_ISSUE_SCOPE_INVALID","lensViewpointId");
  const result=await repository.getLensContext({companyId:resolved.companyId,projectId:resolved.projectId,lensViewpointId,allowCompanyPrecedent:resolved.isCompanyPmo||resolved.isSuperAdmin});
  res.json({...result,canClassify:resolved.capabilities.has("classify_issue")});
}catch(error){sendError(res,error);}});

router.put("/coordination-knowledge/lens-context/:lensViewpointId/classification",authMiddleware,async(req,res)=>{try{
  const resolved=await context(req,"classify_issue");
  if(!resolved.projectId) throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_REQUIRED","projectId");
  const lensViewpointId=Number(parameter(req.params.lensViewpointId));
  if(!Number.isSafeInteger(lensViewpointId)||lensViewpointId<1) throw new CoordinationKnowledgeContractError("KNOWLEDGE_ISSUE_SCOPE_INVALID","lensViewpointId");
  const requested=req.body?.conflictTypeRevisionId;
  const expected=req.body?.expectedConflictTypeRevisionId;
  if(requested!==null&&typeof requested!=="string") throw new CoordinationKnowledgeContractError("KNOWLEDGE_CLASSIFICATION_INVALID","conflictTypeRevisionId");
  if(expected!==null&&typeof expected!=="string") throw new CoordinationKnowledgeContractError("KNOWLEDGE_CLASSIFICATION_INVALID","expectedConflictTypeRevisionId");
  await repository.classifyLensIssue({companyId:resolved.companyId,projectId:resolved.projectId,lensViewpointId,conflictTypeRevisionId:requested,expectedConflictTypeRevisionId:expected,actorId:resolved.userId});
  res.json({...await repository.getLensContext({companyId:resolved.companyId,projectId:resolved.projectId,lensViewpointId,allowCompanyPrecedent:resolved.isCompanyPmo||resolved.isSuperAdmin}),canClassify:true});
}catch(error){sendError(res,error);}});

router.get("/coordination-knowledge/lens-context/:lensViewpointId/resolution",authMiddleware,async(req,res)=>{try{
  const resolved=await context(req,"view_approved");if(!resolved.projectId)throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_REQUIRED","projectId");
  const lensViewpointId=Number(parameter(req.params.lensViewpointId));if(!Number.isSafeInteger(lensViewpointId)||lensViewpointId<1)throw new CoordinationKnowledgeContractError("KNOWLEDGE_ISSUE_SCOPE_INVALID","lensViewpointId");
  res.json({item:await repository.getResolutionRecord({companyId:resolved.companyId,projectId:resolved.projectId,lensViewpointId})});
}catch(error){sendError(res,error);}});
router.put("/coordination-knowledge/lens-context/:lensViewpointId/resolution",authMiddleware,async(req,res)=>{try{
  const resolved=await context(req,"edit_draft");if(!resolved.projectId)throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_REQUIRED","projectId");
  const lensViewpointId=Number(parameter(req.params.lensViewpointId)),expected=Number(req.body?.expectedRevision??0),status=req.body?.status;
  if(!Number.isSafeInteger(lensViewpointId)||lensViewpointId<1)throw new CoordinationKnowledgeContractError("KNOWLEDGE_ISSUE_SCOPE_INVALID","lensViewpointId");
  if(!Number.isSafeInteger(expected)||expected<0)throw new CoordinationKnowledgeContractError("KNOWLEDGE_EXPECTED_REVISION_REQUIRED","expectedRevision");
  if(status!=="draft"&&status!=="completed")throw new CoordinationKnowledgeContractError("RESOLUTION_RECORD_INVALID","status");
  const item=await repository.appendResolutionRecordRevision({companyId:resolved.companyId,projectId:resolved.projectId,lensViewpointId,expectedRevision:expected,actorId:resolved.userId,status,...resolutionRecordBody(req.body??{})});
  res.json({item});
}catch(error){sendError(res,error);}});

router.get("/coordination-knowledge/evidence/:entityType/:id",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"view_approved"),entityType=evidenceChoice(parameter(req.params.entityType),evidenceEntityTypes,"entityType"),entityId=parameter(req.params.id);res.json({items:await repository.listEvidence(resolved.companyId,entityType,entityId)});}catch(error){sendError(res,error);}});
router.get("/coordination-knowledge/events/:entityType/:id",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"view_approved"),entityType=evidenceChoice(parameter(req.params.entityType),evidenceEntityTypes,"entityType"),entityId=parameter(req.params.id);res.json({items:await repository.listEvents(resolved.companyId,entityType,entityId)});}catch(error){sendError(res,error);}});
router.post("/coordination-knowledge/evidence/:entityType/:id",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"edit_draft");if(!resolved.projectId)throw new CoordinationKnowledgeContractError("KNOWLEDGE_PROJECT_SCOPE_REQUIRED","projectId");const entityType=evidenceChoice(parameter(req.params.entityType),evidenceEntityTypes,"entityType"),entityId=parameter(req.params.id),fileId=Number(req.body?.fileId);if(!Number.isSafeInteger(fileId)||fileId<1)throw new CoordinationKnowledgeContractError("KNOWLEDGE_EVIDENCE_INVALID","fileId");const item=await repository.addEvidence({companyId:resolved.companyId,projectId:resolved.projectId,entityType,entityId,revisionId:typeof req.body?.revisionId==="string"?req.body.revisionId:null,fileId,evidenceRole:evidenceChoice(req.body?.evidenceRole,evidenceRoles,"evidenceRole"),actorId:resolved.userId});res.status(201).json({item});}catch(error){sendError(res,error);}});

router.get("/coordination-knowledge/search",authMiddleware,async(req,res)=>{
  try{
    const resolved=await context(req,"view_approved");
    const status=boundedQuery(req.query.status,"status",40);
    if(status&&!(["draft","under_review","approved","retired"] as const).includes(status as "draft"|"under_review"|"approved"|"retired")) throw new CoordinationKnowledgeContractError("KNOWLEDGE_SEARCH_INVALID","status");
    if(status&&status!=="approved"&&!resolved.capabilities.has("view_draft")) throw new CoordinationKnowledgeAuthorizationError("KNOWLEDGE_CAPABILITY_REQUIRED",403);
    const rawTags=boundedQuery(req.query.tags,"tags",1000);
    const tags=rawTags?rawTags.split(",").map(tag=>tag.trim()).filter(Boolean):[];
    if(tags.length>25||tags.some(tag=>tag.length>120)) throw new CoordinationKnowledgeContractError("KNOWLEDGE_SEARCH_INVALID","tags");
    const items=await repository.searchKnowledge({companyId:resolved.companyId,includeDrafts:resolved.capabilities.has("view_draft"),
      keyword:boundedQuery(req.query.keyword,"keyword",240),discipline:boundedQuery(req.query.discipline,"discipline"),conflictTypeId:boundedQuery(req.query.conflictTypeId,"conflictTypeId",64),
      element:boundedQuery(req.query.element,"element"),category:boundedQuery(req.query.category,"category"),methodId:boundedQuery(req.query.methodId,"methodId",64),
      projectId:resolved.projectId??undefined,status,tags,page:pageNumber(req.query.page,"page",1,100000),pageSize:pageNumber(req.query.pageSize,"pageSize",25,100)});
    res.json(items);
  }catch(error){sendError(res,error);}
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

for (const action of ["submit_for_review", "return_to_draft", "approve", "revise", "retire"] as const) {
  const capability: KnowledgeCapability = action === "approve" ? "approve" : action === "retire" ? "retire" : action === "return_to_draft" ? "review" : action === "submit_for_review" ? "submit_for_review" : "create_draft";
  router.post(`/coordination-knowledge/conflict-types/:id/${action.replaceAll("_", "-")}`, authMiddleware, async (req, res) => {
    try {
      const resolved = await context(req, capability);
      const item = await repository.appendConflictTypeRevision({ companyId: resolved.companyId, conflictTypeId: parameter(req.params.id), expectedRevision: expectedRevision(req.body?.expectedRevision), actorId: resolved.userId, action, rationale:lifecycleRationale(req.body?.rationale) });
      res.json({ item });
    } catch (error) { sendError(res, error); }
  });
}

router.get("/coordination-knowledge/rules", authMiddleware, async (req,res) => { try { const resolved=await context(req,"view_approved"); res.json({items:await repository.listRules(resolved.companyId,resolved.capabilities.has("view_draft"))}); } catch(error){ sendError(res,error); } });
router.post("/coordination-knowledge/rules", authMiddleware, async (req,res) => { try { const resolved=await context(req,"create_draft"), id=randomUUID(), code=String(req.body?.code??"").trim().toUpperCase(); if(!codePattern.test(code)) throw new CoordinationKnowledgeContractError("COORDINATION_KNOWLEDGE_INVALID","code"); await repository.createRule({identity:{id,companyId:resolved.companyId,code,createdById:resolved.userId},revision:ruleContent(req.body??{},resolved.userId,resolved.companyId,id,1)}); res.status(201).json({item:await repository.getRule(resolved.companyId,id,true)}); } catch(error){ sendError(res,error); } });
router.get("/coordination-knowledge/rules/:id/history", authMiddleware, async (req,res) => { try { const resolved=await context(req,"view_approved"),items=await repository.ruleHistory(resolved.companyId,parameter(req.params.id),resolved.capabilities.has("view_draft")); if(!items.length){res.status(404).json({code:"KNOWLEDGE_RULE_NOT_FOUND"});return;} res.json({items}); } catch(error){sendError(res,error);} });
router.get("/coordination-knowledge/rules/:id", authMiddleware, async (req,res) => { try { const resolved=await context(req,"view_approved"),item=await repository.getRule(resolved.companyId,parameter(req.params.id),resolved.capabilities.has("view_draft")); if(!item){res.status(404).json({code:"KNOWLEDGE_RULE_NOT_FOUND"});return;} res.json({item}); } catch(error){sendError(res,error);} });
router.patch("/coordination-knowledge/rules/:id", authMiddleware, async (req,res) => { try { const resolved=await context(req,"edit_draft"), expected=expectedRevision(req.body?.expectedRevision), id=parameter(req.params.id); const item=await repository.appendRuleRevision({companyId:resolved.companyId,ruleId:id,expectedRevision:expected,actorId:resolved.userId,action:"update_draft",content:ruleContent(req.body??{},resolved.userId,resolved.companyId,id,expected+1)}); res.json({item}); } catch(error){sendError(res,error);} });
for(const action of ["submit_for_review","return_to_draft","approve","revise","retire"] as const){ const capability:KnowledgeCapability=action==="approve"?"approve":action==="retire"?"retire":action==="return_to_draft"?"review":action==="submit_for_review"?"submit_for_review":"create_draft"; router.post(`/coordination-knowledge/rules/:id/${action.replaceAll("_","-")}`,authMiddleware,async(req,res)=>{try{const resolved=await context(req,capability);res.json({item:await repository.appendRuleRevision({companyId:resolved.companyId,ruleId:parameter(req.params.id),expectedRevision:expectedRevision(req.body?.expectedRevision),actorId:resolved.userId,action,rationale:lifecycleRationale(req.body?.rationale)})});}catch(error){sendError(res,error);}}); }

router.get("/coordination-knowledge/resolution-methods",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"view_approved");res.json({items:await repository.listResolutionMethods(resolved.companyId,resolved.capabilities.has("view_draft"))});}catch(error){sendError(res,error);}});
router.post("/coordination-knowledge/resolution-methods",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"create_draft"),id=randomUUID(),code=String(req.body?.code??"").trim().toUpperCase();if(!codePattern.test(code))throw new CoordinationKnowledgeContractError("COORDINATION_KNOWLEDGE_INVALID","code");await repository.createResolutionMethod({identity:{id,companyId:resolved.companyId,code,createdById:resolved.userId},revision:resolutionContent(req.body??{},resolved.userId,resolved.companyId,id,1)});res.status(201).json({item:await repository.getResolutionMethod(resolved.companyId,id,true)});}catch(error){sendError(res,error);}});
router.get("/coordination-knowledge/resolution-methods/:id/history",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"view_approved"),items=await repository.resolutionMethodHistory(resolved.companyId,parameter(req.params.id),resolved.capabilities.has("view_draft"));if(!items.length){res.status(404).json({code:"KNOWLEDGE_RESOLUTION_METHOD_NOT_FOUND"});return;}res.json({items});}catch(error){sendError(res,error);}});
router.get("/coordination-knowledge/resolution-methods/:id",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"view_approved"),item=await repository.getResolutionMethod(resolved.companyId,parameter(req.params.id),resolved.capabilities.has("view_draft"));if(!item){res.status(404).json({code:"KNOWLEDGE_RESOLUTION_METHOD_NOT_FOUND"});return;}res.json({item});}catch(error){sendError(res,error);}});
router.patch("/coordination-knowledge/resolution-methods/:id",authMiddleware,async(req,res)=>{try{const resolved=await context(req,"edit_draft"),expected=expectedRevision(req.body?.expectedRevision),id=parameter(req.params.id);res.json({item:await repository.appendResolutionMethodRevision({companyId:resolved.companyId,resolutionMethodId:id,expectedRevision:expected,actorId:resolved.userId,action:"update_draft",content:resolutionContent(req.body??{},resolved.userId,resolved.companyId,id,expected+1)})});}catch(error){sendError(res,error);}});
for(const action of ["submit_for_review","return_to_draft","approve","revise","retire"] as const){const capability:KnowledgeCapability=action==="approve"?"approve":action==="retire"?"retire":action==="return_to_draft"?"review":action==="submit_for_review"?"submit_for_review":"create_draft";router.post(`/coordination-knowledge/resolution-methods/:id/${action.replaceAll("_","-")}`,authMiddleware,async(req,res)=>{try{const resolved=await context(req,capability);res.json({item:await repository.appendResolutionMethodRevision({companyId:resolved.companyId,resolutionMethodId:parameter(req.params.id),expectedRevision:expectedRevision(req.body?.expectedRevision),actorId:resolved.userId,action,rationale:lifecycleRationale(req.body?.rationale)})});}catch(error){sendError(res,error);}});}

export default router;
