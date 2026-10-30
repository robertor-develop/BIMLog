import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  coordinationIntakeEventsTable,
  namingConventionsTable,
  namingFieldsTable,
  projectsTable,
  usersTable,
  companiesTable,
  activityLogTable,
  filesTable,
} from "@workspace/db/schema";
import { createHash } from "crypto";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requirePermission, requireProjectMember } from "../middlewares/auth";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";
import { singleFileUpload } from "../middlewares/multipart";
import * as XLSX from "xlsx";
import { canonicalSpreadsheetReadOptions } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// In-memory buffer cache. Key = UUID returned to client from /intake.
// Entry expires after 30 minutes to bound memory growth.
type CachedFile = {
  projectId:number; userId:number; conventionId:number; conventionSnapshot:unknown; analysis:Record<string,unknown>;
  inFlight?:boolean; confirmed?:{fingerprint:string;eventId:number};
  buffer: Buffer;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  expiresAt: number;
};
const fileCache = new Map<string, CachedFile>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of fileCache) {
    if (v.expiresAt < now) fileCache.delete(k);
  }
}

const uploadMiddleware = singleFileUpload({ fileSize: 50 * 1024 * 1024 });

function detectFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "dwg") return "dwg";
  return "other";
}

async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  if (fileType === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      return ((result as { text?: string }).text ?? "").trim();
    } catch { return ""; }
  }
  if (fileType === "xlsx") {
    try {
      const workbook = XLSX.read(buffer, canonicalSpreadsheetReadOptions("coordination.xlsx", "buffer", { raw: true }));
      const rows: string[] = [];
      for (const sheetName of workbook.SheetNames.slice(0, 3)) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
        const nonEmpty = csv.split("\n").filter((r: string) => r.replace(/,/g, "").trim()).slice(0, 100).join("\n");
        if (nonEmpty) rows.push(`[Sheet: ${sheetName}]\n${nonEmpty}`);
      }
      return rows.join("\n");
    } catch { return ""; }
  }
  return "";
}

// ── GET /projects/:projectId/coordination/events ─────────────────────────────
router.get(
  "/projects/:projectId/coordination/events",
  authMiddleware,
  requireProjectMember(),
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const events = await db
        .select({
          id: coordinationIntakeEventsTable.id,
          originalFilename: coordinationIntakeEventsTable.originalFilename,
          finalFilename: coordinationIntakeEventsTable.finalFilename,
          proposedFilename: coordinationIntakeEventsTable.proposedFilename,
          fileType: coordinationIntakeEventsTable.fileType,
          aiConfidence: coordinationIntakeEventsTable.aiConfidence,
          warningsTriggered: coordinationIntakeEventsTable.warningsTriggered,
          userAction: coordinationIntakeEventsTable.userAction,
          destinationAction: coordinationIntakeEventsTable.destinationAction,
          uploaderCompany: coordinationIntakeEventsTable.uploaderCompany,
          uploaderId: coordinationIntakeEventsTable.uploaderId,
          uploaderName: usersTable.fullName,
          createdAt: coordinationIntakeEventsTable.createdAt,
        })
        .from(coordinationIntakeEventsTable)
        .leftJoin(usersTable, eq(usersTable.id, coordinationIntakeEventsTable.uploaderId))
        .where(eq(coordinationIntakeEventsTable.projectId, projectId))
        .orderBy(desc(coordinationIntakeEventsTable.createdAt))
        .limit(50);

      res.set("Cache-Control","private, no-store").set("X-BIMLog-Project-Id",String(projectId)).json(events.map(e => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  }
);

// ── POST /projects/:projectId/coordination/intake ────────────────────────────
router.post(
  "/projects/:projectId/coordination/intake",
  authMiddleware,
  requirePermission("admin", "write"),
  uploadMiddleware,
  async (req, res) => {
    try {
      pruneCache();
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

      const fileType = detectFileType(file.originalname);

      // Load active convention
      const conventions = await db.select().from(namingConventionsTable)
        .where(eq(namingConventionsTable.projectId, projectId)).limit(1);
      if (conventions.length === 0 || !conventions[0].isActive) {
        res.status(400).json({ error: "No active convention for this project" });
        return;
      }
      const convention = conventions[0];
      const fields = await db.select().from(namingFieldsTable)
        .where(eq(namingFieldsTable.conventionId, convention.id))
        .orderBy(namingFieldsTable.fieldOrder);

      if (fields.length === 0) {
        res.status(400).json({ error: "Convention has no fields configured" });
        return;
      }

      // Load project context
      const projects = await db.select({ id: projectsTable.id, name: projectsTable.name, code: projectsTable.code })
        .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }
      const project = projects[0];

      // Extract text
      const extracted = await extractText(file.buffer, fileType);
      const textSnippet = extracted ? extracted.slice(0, 3000) : "";

      // Cache the file buffer
      const cacheKey = randomUUID();


      // Build prompt
      const fieldsBlock = fields.map(f =>
        `- ${f.label}: allowedValues = [${(f.allowedValues || []).map(v => JSON.stringify(v)).join(", ")}]`
      ).join("\n");

      const systemPrompt = `You are BIMLog's coordination intelligence engine. Your job is to analyze an uploaded construction document and propose a corrected compliant filename based on the project's active naming convention. You must use all available signals together: the original filename, the extracted document text, the project context, and the convention rules. Never guess randomly — reason from evidence. Return only valid JSON.`;

      const userPrompt = `PROJECT CONTEXT:
- Name: ${project.name}
- Code: ${project.code}

CONVENTION:
- Separator: "${convention.separator}"
- Fields (in order):
${fieldsBlock}

ORIGINAL FILENAME: ${file.originalname}

EXTRACTED DOCUMENT TEXT (first 3000 chars):
${textSnippet || "(no extractable text — base inference on filename + project context only)"}

TASK:
Propose the corrected compliant filename, field-by-field. For each field, pick a value from its allowedValues whenever possible. If the evidence does not clearly map to one allowed value, mark that field as "low" confidence and pick the closest match. If two or more allowed values are equally plausible OR if the evidence contradicts the project context (e.g. wrong project code, wrong discipline), set "severe": true and explain in "severeReason".

For each field where you cannot determine the correct value OR where the value indicated by the original filename / document is not in the field's allowedValues list, you MUST include an "action" object in that field's entry. The action must be exactly one of:
- Type 1 — VALUE_NOT_IN_CONVENTION: the value exists in the document/filename but is not in the convention's allowed values. Action text: "The value [X] is not in the allowed list for [FieldLabel]. A Convention Manager must add it to the Convention Builder under the [FieldLabel] field."
- Type 2 — CANNOT_DETERMINE: not enough information to determine the correct value. Action text: "This field cannot be determined from the filename or document content. Select the correct value manually from the dropdown."
- Type 3 — CONVENTION_INCOMPLETE: the convention field has no allowed values defined (allowedValues is empty). Action text: "The [FieldLabel] field has no allowed values defined. A Convention Manager must configure this field in Convention Builder before this document can be properly named."
If confidence is "high" and the chosen proposedValue is in allowedValues, set "action": null.

Return ONLY this JSON shape (no markdown, no code block):
{
  "proposedFields": [
    { "fieldLabel": "string", "proposedValue": "string", "confidence": "high|medium|low", "reasoning": "string", "action": { "type": "VALUE_NOT_IN_CONVENTION|CANNOT_DETERMINE|CONVENTION_INCOMPLETE", "text": "string" } | null }
  ],
  "proposedFilename": "string",
  "overallConfidence": "high|medium|low",
  "severe": true,
  "severeReason": "string or null",
  "aiSummary": "2-3 sentence summary of document content",
  "detectedDiscipline": "string or null",
  "detectedDocType": "string or null",
  "detectedLevel": "string or null",
  "detectedOriginator": "string or null",
  "keywords": ["array", "of", "strings"]
}`;

      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "coordination_intake",
      });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") {
        res.status(500).json({ error: "No text response from AI" });
        return;
      }

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(block.text.replace(/```json\n?|```/g, "").trim()); }
      catch {
        res.status(422).json({ error: "AI returned non-JSON response", raw: block.text.slice(0, 500) });
        return;
      }

      if(!Array.isArray(parsed.proposedFields)||typeof parsed.proposedFilename!=="string"){res.status(422).json({error:"AI analysis is incomplete; retry intake"});return;}
      const snapshot={separator:convention.separator,fields:fields.map(f=>({label:f.label,fieldOrder:f.fieldOrder,allowedValues:f.allowedValues}))};
      fileCache.set(cacheKey,{projectId,userId:req.user!.userId,conventionId:convention.id,conventionSnapshot:snapshot,analysis:parsed,buffer:file.buffer,originalFilename:file.originalname,fileType,fileSize:file.size,expiresAt:Date.now()+CACHE_TTL_MS});
      res.json({
        cacheKey,
        originalFilename: file.originalname,
        fileType,
        fileSize: file.size,
        conventionId: convention.id,
        conventionSnapshot: {
          separator: convention.separator,
          fields: fields.map(f => ({ label: f.label, fieldOrder: f.fieldOrder, allowedValues: f.allowedValues })),
        },
        analysis: parsed,
      });
    } catch (error) {
      if (sendAiUsageError(res, error)) return;
      res.status(500).json({ error: error instanceof Error ? error.message : "Intake failed" });
    }
  }
);

// ── POST /projects/:projectId/coordination/confirm ───────────────────────────
router.post("/projects/:projectId/coordination/confirm",authMiddleware,requirePermission("admin","write"),async(req,res)=>{
 pruneCache();const projectId=Number(req.params.projectId),actor=req.user!;
 const {cacheKey,userAction,finalFilename,manualFieldsChanged,destinationAction,warningAcknowledged}=req.body??{};
 if(typeof cacheKey!=="string"||!["accepted","manually_corrected","rejected"].includes(userAction)){res.status(400).json({error:"A valid upload session and action are required"});return;}
 const cached=fileCache.get(cacheKey);
 if(!cached||cached.projectId!==projectId||cached.userId!==actor.userId){res.status(410).json({error:"Upload session expired or unavailable — re-upload in this project"});return;}
 if(userAction!=="rejected"&&(typeof finalFilename!=="string"||!finalFilename.trim()||/[\\/\\\\\x00-\x1f]/.test(finalFilename)||finalFilename.length>240||!["downloaded","queued_sync"].includes(destinationAction))){res.status(400).json({error:"A confirmed file needs a safe filename and destination action"});return;}
 if(userAction!=="rejected"&&destinationAction==="queued_sync"){res.status(409).json({error:"COORDINATION_SYNC_NOT_CONFIGURED",message:"SharePoint delivery is not configured. Confirm and download the file instead."});return;}
 const fingerprint=createHash("sha256").update(JSON.stringify({userAction,finalFilename:userAction==="rejected"?"":finalFilename,manualFieldsChanged:manualFieldsChanged??null,destinationAction:userAction==="rejected"?"pending":destinationAction,warningAcknowledged:warningAcknowledged===true})).digest("hex");
 if(cached.confirmed&&cached.confirmed.fingerprint!==fingerprint){res.status(409).json({error:"Upload session was already confirmed differently; reopen recent events"});return;}
 if(cached.inFlight){res.status(409).json({error:"Confirmation is already in progress; reopen recent events before retrying"});return;}
 cached.inFlight=true;
 try{
  let eventId=cached.confirmed?.eventId;
  if(!eventId){
   const analysis=cached.analysis,sev=analysis.severe===true;
   eventId=await db.transaction(async tx=>{
    const [company]=await tx.select({name:companiesTable.name}).from(companiesTable).where(eq(companiesTable.id,actor.companyId)).limit(1);
    const [event]=await tx.insert(coordinationIntakeEventsTable).values({
     projectId,uploaderId:actor.userId,uploaderCompany:company?.name??null,originalFilename:cached.originalFilename,
     proposedFilename:typeof analysis.proposedFilename==="string"?analysis.proposedFilename:null,finalFilename:userAction==="rejected"?null:finalFilename,
     fileType:cached.fileType,fileSizeBytes:cached.fileSize,detectedDiscipline:typeof analysis.detectedDiscipline==="string"?analysis.detectedDiscipline:null,
     detectedDocType:typeof analysis.detectedDocType==="string"?analysis.detectedDocType:null,detectedLevel:typeof analysis.detectedLevel==="string"?analysis.detectedLevel:null,
     detectedOriginator:typeof analysis.detectedOriginator==="string"?analysis.detectedOriginator:null,aiConfidence:typeof analysis.overallConfidence==="string"?analysis.overallConfidence:null,
     aiSummary:typeof analysis.aiSummary==="string"?analysis.aiSummary:null,aiExtractedKeywords:Array.isArray(analysis.keywords)?JSON.stringify(analysis.keywords):null,
     warningsTriggered:sev,warningDetail:[sev&&typeof analysis.severeReason==="string"?analysis.severeReason:"",warningAcknowledged===true?"user_acknowledged_severe_warning":""].filter(Boolean).join(" | ")||null,
     userAction,manualFieldsChanged:manualFieldsChanged?JSON.stringify(manualFieldsChanged):null,destinationAction:userAction==="rejected"?"pending":destinationAction,
     conventionId:cached.conventionId,conventionSnapshot:JSON.stringify(cached.conventionSnapshot)
    }).returning({id:coordinationIntakeEventsTable.id});
    await tx.insert(activityLogTable).values({projectId,userId:actor.userId,userFullName:actor.fullName,userCompanyName:actor.companyName,actionType:userAction==="rejected"?"coordination_rejected":userAction==="manually_corrected"?"coordination_corrected":"coordination_accepted",entityType:"coordination_intake",entityId:event.id,fileNameBefore:cached.originalFilename,fileNameAfter:userAction==="rejected"?null:finalFilename,details:`Coordination Hub: ${userAction} (download preparation; browser delivery must be verified)`});
    if(userAction!=="rejected")await tx.insert(filesTable).values({projectId,fileName:finalFilename,fileSize:cached.fileSize,fileType:cached.fileType,status:"compliant",uploadedById:actor.userId,fileHash:createHash("sha256").update(cached.buffer).digest("hex"),fileSizeBytes:cached.fileSize,documentRelationship:"created",documentRelationshipDeclaredAt:new Date(),source:"coordination_hub",isCompliant:true,conventionVersion:String(cached.conventionId)});
    return event.id;
   });
   cached.confirmed={fingerprint,eventId};
  }
  res.set("Cache-Control","private, no-store").set("X-BIMLog-Project-Id",String(projectId)).set("X-Coordination-Event-Id",String(eventId));
  if(userAction!=="rejected"){res.type("application/octet-stream").set("Content-Disposition",`attachment; filename="coordination-file"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`).send(cached.buffer);return;}
  res.json({ok:true,eventId});
 }catch{res.status(500).json({error:"Confirmation was not saved. Retry the same upload session."});}
 finally{cached.inFlight=false;}
});
export default router;
