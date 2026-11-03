import { Router } from "express";
import { db } from "@workspace/db";
import {
  linkedItemsTable,
  activityLogTable,
  rfisTable,
  submittalsTable,
  transmittalsTable,
  changeOrdersTable,
  meetingMinutesTable,
  filesTable,
  clashesTable,
  lensViewpointsTable,
  scheduleItemPlacementsTable,
} from "@workspace/db/schema";
import { eq, and, or, ne,sql } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { canonicalCoordinationType } from "../lib/construction-coordination-records";

const router: Router = Router();

const linkEntityTypes = ["rfi", "submittal", "transmittal", "change_order", "meeting", "schedule", "file", "clash", "lens_viewpoint"] as const;
type LinkEntityType = typeof linkEntityTypes[number];

function isLinkEntityType(value: unknown): value is LinkEntityType {
  return typeof value === "string" && linkEntityTypes.includes(value as LinkEntityType);
}

async function entityBelongsToProject(entityType: LinkEntityType, entityId: number, projectId: number,reader:Pick<typeof db,"select">=db): Promise<boolean> {
  let rows: { id: number }[];
  switch (entityType) {
    case "rfi": rows = await reader.select({ id: rfisTable.id }).from(rfisTable).where(and(eq(rfisTable.id, entityId), eq(rfisTable.projectId, projectId))).limit(1).for("share"); break;
    case "submittal": rows = await reader.select({ id: submittalsTable.id }).from(submittalsTable).where(and(eq(submittalsTable.id, entityId), eq(submittalsTable.projectId, projectId))).limit(1).for("share"); break;
    case "transmittal": rows = await reader.select({ id: transmittalsTable.id }).from(transmittalsTable).where(and(eq(transmittalsTable.id, entityId), eq(transmittalsTable.projectId, projectId))).limit(1).for("share"); break;
    case "change_order": rows = await reader.select({ id: changeOrdersTable.id }).from(changeOrdersTable).where(and(eq(changeOrdersTable.id, entityId), eq(changeOrdersTable.projectId, projectId))).limit(1).for("share"); break;
    case "meeting": rows = await reader.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable).where(and(eq(meetingMinutesTable.id, entityId), eq(meetingMinutesTable.projectId, projectId))).limit(1).for("share"); break;
    case "schedule": rows = await reader.select({ id: scheduleItemPlacementsTable.id }).from(scheduleItemPlacementsTable).where(and(eq(scheduleItemPlacementsTable.id, entityId), eq(scheduleItemPlacementsTable.projectId, projectId))).limit(1).for("share"); break;
    case "file": rows = await reader.select({ id: filesTable.id }).from(filesTable).where(and(eq(filesTable.id, entityId), eq(filesTable.projectId, projectId))).limit(1).for("share"); break;
    case "clash": rows = await reader.select({ id: clashesTable.id }).from(clashesTable).where(and(eq(clashesTable.id, entityId), eq(clashesTable.projectId, projectId))).limit(1).for("share"); break;
    case "lens_viewpoint": rows = await reader.select({ id: lensViewpointsTable.id }).from(lensViewpointsTable).where(and(eq(lensViewpointsTable.id, entityId), eq(lensViewpointsTable.projectId, projectId))).limit(1).for("share"); break;
  }
  return rows.length === 1;
}

class LinkFailure extends Error{constructor(readonly status:number,message:string){super(message);}}
async function linkScope(reader:Pick<typeof db,"execute">,projectId:number,userId:number){
 const result=await reader.execute(sql`SELECT (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active'))) allowed,
 (actor.is_super_admin OR EXISTS(SELECT 1 FROM project_members pm JOIN config_options c ON c.category='member_role' AND c.value=pm.role WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active' AND c.meta->>'permission' IN('admin','write'))) can_write
 FROM projects p JOIN users creator ON creator.id=p.created_by_id JOIN users actor ON actor.id=${userId} WHERE p.id=${projectId} AND p.status<>'archived'`);
 const row=result.rows[0];if(row?.allowed!==true)throw new LinkFailure(403,"Current project membership and company context are required.");return{canWrite:row.can_write===true};
}
function linkError(res:any,error:unknown){if(error instanceof LinkFailure){res.status(error.status).json({error:error.message});return;}console.error("[project-links] request failed",error instanceof Error?error.name:"UnknownError");res.status(500).json({error:"Project links are temporarily unavailable. Reopen the saved record before retrying."});}
router.use("/projects/:projectId/links",(_req,res,next)=>{res.set("Cache-Control","private, no-store");next();});
// GET all links for a specific entity
router.get("/projects/:projectId/links/:entityType/:entityId", authMiddleware, requireProjectMember(), async (req, res) => {
 const projectId=Number(req.params.projectId),entityType=String(req.params.entityType),entityId=Number(req.params.entityId);
 try{if(!Number.isSafeInteger(projectId)||projectId<=0||!isLinkEntityType(entityType)||!Number.isSafeInteger(entityId)||entityId<=0)throw new LinkFailure(400,"A supported source type and positive numeric record ID are required.");
 const access=await linkScope(db,projectId,req.user!.userId);if(!await entityBelongsToProject(entityType,entityId,projectId))throw new LinkFailure(404,"The source record was not found in this project.");
 const links=await db.select().from(linkedItemsTable).where(and(eq(linkedItemsTable.projectId,projectId),ne(linkedItemsTable.linkType,"register_package"),or(and(eq(linkedItemsTable.fromType,entityType),eq(linkedItemsTable.fromId,entityId)),and(eq(linkedItemsTable.toType,entityType),eq(linkedItemsTable.toId,entityId)))));
 res.set({"X-BIMLog-Project-Id":String(projectId),"X-BIMLog-Link-Write":String(access.canWrite)}).json(links);
 }catch(error){linkError(res,error);}
});
// POST create a link
router.post("/projects/:projectId/links", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
 const projectId=Number(req.params.projectId),{fromType,fromId,toType,toId,linkType,notes}=req.body??{};
 try{if(!Number.isSafeInteger(projectId)||projectId<=0||!isLinkEntityType(fromType)||!isLinkEntityType(toType)||!Number.isInteger(fromId)||fromId<=0||!Number.isInteger(toId)||toId<=0)throw new LinkFailure(400,"A supported source and target with authoritative numeric IDs are required");
 const relation=linkType||"related";if(typeof relation!=="string"||relation.length>100||/[\u0000-\u001f]/.test(relation)||(notes!=null&&(typeof notes!=="string"||notes.length>4000)))throw new LinkFailure(400,"Enter a valid relationship label and notes.");
 if(relation==="register_package")throw new LinkFailure(409,"Manage requirement/package links in Submittal Tracking.");
 if(fromType!=="file")canonicalCoordinationType(fromType);if(toType!=="file")canonicalCoordinationType(toType);
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"bimlog:links:"+projectId+":"+fromType+":"+fromId+":"+toType+":"+toId}))`);
  if(!(await linkScope(tx,projectId,req.user!.userId)).canWrite)throw new LinkFailure(403,"Current project write permission is required.");
  const sourceInProject=await entityBelongsToProject(fromType,fromId,projectId,tx),targetInProject=await entityBelongsToProject(toType,toId,projectId,tx);
  if(!sourceInProject||!targetInProject)throw new LinkFailure(404,"Both linked items must exist in the requested project");
  const existing=await tx.select().from(linkedItemsTable).where(and(eq(linkedItemsTable.projectId, projectId),eq(linkedItemsTable.fromType, fromType),eq(linkedItemsTable.fromId, fromId),eq(linkedItemsTable.toType, toType),eq(linkedItemsTable.toId, toId))).for("update");
  if(existing.length)return{existing:true as const,link:existing[0]};
  const [link]=await tx.insert(linkedItemsTable).values({projectId,fromType,fromId,toType,toId,linkType:relation,notes:notes||null,createdById:req.user!.userId}).returning();
  await tx.insert(activityLogTable).values({projectId,userId:req.user!.userId,userFullName:req.user!.fullName??"",userCompanyName:req.user!.companyName??"",actionType:"link",entityType:fromType,entityId:fromId,details:`Linked ${fromType} #${fromId} to ${toType} #${toId} (${relation})`});return{existing:false as const,link};
 });res.status(result.existing?200:201).json(result.existing?result:result.link);
 }catch(error){linkError(res,error);}
});
// DELETE only the relation; source and target records remain intact.
router.delete("/projects/:projectId/links/:linkId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
 const projectId=Number(req.params.projectId),linkId=Number(req.params.linkId);
 try{if(!Number.isSafeInteger(projectId)||projectId<=0||!Number.isSafeInteger(linkId)||linkId<=0)throw new LinkFailure(400,"A positive numeric link ID is required.");
 await db.transaction(async tx=>{
  if(!(await linkScope(tx,projectId,req.user!.userId)).canWrite)throw new LinkFailure(403,"Current project write permission is required.");
  const [existing]=await tx.select().from(linkedItemsTable).where(and(eq(linkedItemsTable.id, linkId), eq(linkedItemsTable.projectId, projectId))).for("update");
  if(existing?.linkType==="register_package")throw new LinkFailure(409,"Manage requirement/package links in Submittal Tracking.");
  if(!existing)return;
  await tx.delete(linkedItemsTable).where(and(eq(linkedItemsTable.id, linkId), eq(linkedItemsTable.projectId, projectId)));
  await tx.insert(activityLogTable).values({projectId,userId:req.user!.userId,userFullName:req.user!.fullName??"",userCompanyName:req.user!.companyName??"",actionType:"unlink",entityType:existing.fromType,entityId:existing.fromId,details:`Unlinked ${existing.fromType} #${existing.fromId} from ${existing.toType} #${existing.toId} (${existing.linkType})`});
 });res.json({success:true});
 }catch(error){linkError(res,error);}
});
export default router;
