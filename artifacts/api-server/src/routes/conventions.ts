import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { namingConventionsTable, namingFieldsTable, namingConventionVersionsTable, projectMembersTable, usersTable, companiesTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { GetConventionParams, UpsertConventionParams, UpsertConventionBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue } from "../middlewares/config-validator";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

const router: IRouter = Router();

router.get("/projects/:projectId/conventions", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = GetConventionParams.parse({ projectId: req.params.projectId });

    const conventions = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId))
      .limit(1);

    if (conventions.length === 0) {
      const defaultSeparator = await getDefaultValue("separator");
      res.json({
        id: 0,
        projectId,
        separator: defaultSeparator,
        enforceUppercase: true,
        applyCharLimits: false,
        companyCode: "",
        isActive: false,
        fields: [],
        setupStatus: "not_started",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const convention = conventions[0];
    const fields = await db
      .select()
      .from(namingFieldsTable)
      .where(eq(namingFieldsTable.conventionId, convention.id))
      .orderBy(namingFieldsTable.fieldOrder);

    const conventionCodes = (convention.companyCode ?? "").split(",").map(c => c.trim()).filter(Boolean);
    let companyAssignmentStatus: Array<{ code: string; hasUsers: boolean; companyName?: string }> = [];
    if (conventionCodes.length > 0) {
      const memberCompanies = await db
        .select({ companyName: companiesTable.name })
        .from(projectMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, projectMembersTable.userId))
        .innerJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
        .where(eq(projectMembersTable.projectId, projectId));
      const memberCompanyNames = [...new Set(memberCompanies.map(r => r.companyName))];
      companyAssignmentStatus = conventionCodes.map(code => ({
        code,
        hasUsers: memberCompanyNames.some(name =>
          name.toUpperCase().includes(code.toUpperCase()) || code.toUpperCase().includes(name.toUpperCase())
        ),
        companyName: memberCompanyNames.find(name =>
          name.toUpperCase().includes(code.toUpperCase()) || code.toUpperCase().includes(name.toUpperCase())
        ),
      }));
    }

    res.json({
      id: convention.id,
      projectId: convention.projectId,
      separator: convention.separator,
      enforceUppercase: convention.enforceUppercase,
      applyCharLimits: convention.applyCharLimits,
      companyCode: convention.companyCode ?? "",
      isActive: convention.isActive,
      userGuidance: convention.userGuidance ?? null,
      setupStatus: convention.setupStatus ?? "not_started",
      companyAssignmentStatus,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldOrder: f.fieldOrder,
        allowedValues: f.allowedValues,
      })),
      createdAt: convention.createdAt.toISOString(),
      updatedAt: convention.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.put("/projects/:projectId/conventions", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const { projectId } = UpsertConventionParams.parse({ projectId: req.params.projectId });
    const explicitComplete = req.body?.markCompleted === true;
    const body = UpsertConventionBody.parse(req.body);

    const existing = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId))
      .limit(1);

    let conventionId: number;

    const currentStatus = existing.length > 0 ? (existing[0].setupStatus ?? "not_started") : "not_started";

    let newSetupStatus: string;
    if (currentStatus === "completed") {
      newSetupStatus = "completed";
    } else if (explicitComplete) {
      newSetupStatus = "completed";
    } else {
      newSetupStatus = "in_progress";
    }

    if (existing.length > 0) {
      const updateSet: Record<string, unknown> = {
        separator: body.separator,
        isActive: body.isActive,
        setupStatus: newSetupStatus,
        updatedAt: new Date(),
      };
      if (typeof body.enforceUppercase === "boolean") updateSet.enforceUppercase = body.enforceUppercase;
      if (typeof body.applyCharLimits === "boolean") updateSet.applyCharLimits = body.applyCharLimits;
      if (typeof body.companyCode === "string") updateSet.companyCode = body.companyCode;
      if (typeof body.userGuidance === "string") updateSet.userGuidance = body.userGuidance;
      const [updated] = await db
        .update(namingConventionsTable)
        .set(updateSet)
        .where(eq(namingConventionsTable.id, existing[0].id))
        .returning();

      conventionId = updated.id;

      await db.delete(namingFieldsTable).where(eq(namingFieldsTable.conventionId, conventionId));
    } else {
      const [created] = await db
        .insert(namingConventionsTable)
        .values({
          projectId,
          separator: body.separator,
          isActive: body.isActive,
          setupStatus: newSetupStatus,
          ...(typeof body.enforceUppercase === "boolean" ? { enforceUppercase: body.enforceUppercase } : {}),
          ...(typeof body.applyCharLimits === "boolean" ? { applyCharLimits: body.applyCharLimits } : {}),
          ...(typeof body.companyCode === "string" ? { companyCode: body.companyCode } : {}),
          ...(typeof body.userGuidance === "string" ? { userGuidance: body.userGuidance } : {}),
        })
        .returning();

      conventionId = created.id;
    }

    if (body.fields && body.fields.length > 0) {
      interface ConventionField {
        label: string;
        fieldOrder: number;
        allowedValues: string[];
      }
      await db.insert(namingFieldsTable).values(
        body.fields.map((f: ConventionField) => ({
          conventionId,
          label: f.label,
          fieldOrder: f.fieldOrder,
          allowedValues: f.allowedValues,
        }))
      );
    }

    const convention = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.id, conventionId))
      .limit(1);

    const fields = await db
      .select()
      .from(namingFieldsTable)
      .where(eq(namingFieldsTable.conventionId, conventionId))
      .orderBy(namingFieldsTable.fieldOrder);

    res.json({
      id: convention[0].id,
      projectId: convention[0].projectId,
      separator: convention[0].separator,
      enforceUppercase: convention[0].enforceUppercase,
      applyCharLimits: convention[0].applyCharLimits,
      companyCode: convention[0].companyCode ?? "",
      isActive: convention[0].isActive,
      userGuidance: convention[0].userGuidance ?? null,
      setupStatus: convention[0].setupStatus ?? "not_started",
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldOrder: f.fieldOrder,
        allowedValues: f.allowedValues,
      })),
      createdAt: convention[0].createdAt.toISOString(),
      updatedAt: convention[0].updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

// ── Convention Discovery (AI-powered) ────────────────────────────────────────
router.post("/projects/:projectId/convention/discover", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

    const {
      setupContext,
      projectEnvironment,
      builderIntent,
      scopeType,
      scopeDetails,
      levelsRelevant,
      primaryStructure,
      availableInputs,
      sampleNames = [],
      rawFolderTreeText = "",
      rawIndexText = "",
      rawNotes = "",
    } = req.body;

    const scopeSummary = scopeDetails && typeof scopeDetails === "object"
      ? Object.entries(scopeDetails as Record<string, string>).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v)}`).join("; ")
      : "";

    const userContext = [
      `Setup context: ${setupContext || "not specified"}`,
      `Project environment: ${projectEnvironment || "not specified"}`,
      `Builder intent: ${builderIntent || "not specified"}`,
      `Scope of responsibility: ${scopeType || "not specified"}`,
      scopeSummary ? `Scope details: ${scopeSummary}` : null,
      `Levels relevant: ${levelsRelevant ?? "not specified"}`,
      `Primary structure: ${primaryStructure || "not specified"}`,
      availableInputs && typeof availableInputs === "object" ? `Available evidence types: ${Object.entries(availableInputs as Record<string, unknown>).filter(([, v]) => v).map(([k]) => k).join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const evidenceParts = [
      sampleNames.length > 0 ? `Sample file names:\n${sampleNames.join("\n")}` : null,
      rawFolderTreeText ? `Folder structure:\n${rawFolderTreeText}` : null,
      rawIndexText ? `Document index / register:\n${rawIndexText}` : null,
      rawNotes ? `Additional notes:\n${rawNotes}` : null,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `You are helping BIMLog understand a project document environment.
Do not assume a standard building convention unless the evidence clearly shows one.
The user may only be responsible for part of the project.
The evidence may be incomplete.
Infer probable structure, but do not force certainty where there is ambiguity.
Return ONLY valid JSON with no markdown, no explanation, no code block wrapping.`;

    const userPrompt = `Analyze the following project context and evidence and return a structured discovery result.

USER CONTEXT:
${userContext}

EVIDENCE:
${evidenceParts || "No evidence provided. Base analysis on user context only."}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "projectTypeGuess": "string describing probable project type",
  "scopeInterpretation": "string describing how you interpret the user scope",
  "usesLevels": true or false or null,
  "usesAreas": true or false or null,
  "usesPackages": true or false or null,
  "usesVolumes": true or false or null,
  "suggestedDisciplines": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedSystems": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedDocTypes": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedExtraFields": [
    { "key": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedFieldOrder": ["array of field name strings in recommended order"],
  "ambiguities": ["array of open questions or ambiguous areas"],
  "recommendedMode": "string describing recommended setup mode",
  "analysisSummary": "2-4 sentence summary of findings"
}`;

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") { res.status(500).json({ error: "No text response from AI" }); return; }

    let parsed: unknown;
    try {
      parsed = JSON.parse(block.text.trim());
    } catch {
      res.status(422).json({
        error: "AI returned non-JSON response",
        raw: block.text.slice(0, 500),
        projectTypeGuess: "Unable to parse",
        scopeInterpretation: "Analysis failed — please try again or paste more evidence",
        usesLevels: null, usesAreas: null, usesPackages: null, usesVolumes: null,
        suggestedDisciplines: [], suggestedSystems: [], suggestedDocTypes: [],
        suggestedExtraFields: [], suggestedFieldOrder: [],
        ambiguities: ["AI parse error — try with more specific evidence"],
        recommendedMode: "manual",
        analysisSummary: "The analysis could not be completed. Please add more evidence and try again.",
      });
      return;
    }

    res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    res.status(500).json({ error: message });
  }
});

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}).fields([
  { name: "pdf", maxCount: 30 },
  { name: "spreadsheet", maxCount: 30 },
  { name: "screenshot", maxCount: 30 },
  { name: "sample", maxCount: 30 },
]);

router.post(
  "/projects/:projectId/convention/discover-upload",
  authMiddleware,
  requireProjectMember(),
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) { res.status(400).json({ error: `File upload error: ${err instanceof Error ? err.message : String(err)}` }); return; }
      next();
    });
  },
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const b = req.body as Record<string, string>;
      const files = (req.files as Record<string, Express.Multer.File[]>) || {};

      const setupContext = b.setupContext || "";
      const projectEnvironment = b.projectEnvironment || "";
      const builderIntent = b.builderIntent || "";
      const scopeType = b.scopeType || "";
      const levelsRelevant = b.levelsRelevant || "";
      const primaryStructure = b.primaryStructure || "";
      const rawFolderTreeText = b.rawFolderTreeText || "";
      const rawIndexText = b.rawIndexText || "";
      const rawNotes = b.rawNotes || "";

      const sampleNames: string[] = (b.sampleNames || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

      let scopeDetails: Record<string, string> = {};
      try { scopeDetails = b.scopeDetails ? JSON.parse(b.scopeDetails) : {}; } catch { scopeDetails = {}; }
      let availableInputs: Record<string, unknown> = {};
      try { availableInputs = b.availableInputs ? JSON.parse(b.availableInputs) : {}; } catch { availableInputs = {}; }

      const failedFiles: string[] = [];

      const pdfTexts: string[] = [];
      for (const f of files.pdf || []) {
        try {
          const parser = new PDFParse({ data: new Uint8Array(f.buffer) });
          const result = await parser.getText();
          const txt = ((result as { text?: string }).text ?? "").trim();
          pdfTexts.push(txt
            ? `[From PDF: ${f.originalname}]\n${txt.slice(0, 8000)}`
            : `[PDF: ${f.originalname} — no extractable text]`);
        } catch {
          failedFiles.push(f.originalname);
          pdfTexts.push(`[PDF: ${f.originalname} — could not read]`);
        }
      }

      const sheetTexts: string[] = [];
      for (const f of files.spreadsheet || []) {
        try {
          const workbook = XLSX.read(f.buffer, { type: "buffer" });
          const rows: string[] = [];
          for (const sheetName of workbook.SheetNames.slice(0, 3)) {
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
            const nonEmpty = csv.split("\n").filter((r: string) => r.replace(/,/g, "").trim()).slice(0, 200).join("\n");
            if (nonEmpty) rows.push(`[Sheet: ${sheetName}]\n${nonEmpty}`);
          }
          sheetTexts.push(rows.length > 0
            ? `[From spreadsheet: ${f.originalname}]\n${rows.join("\n").slice(0, 8000)}`
            : `[Spreadsheet: ${f.originalname} — no readable data]`);
        } catch {
          failedFiles.push(f.originalname);
          sheetTexts.push(`[Spreadsheet: ${f.originalname} — could not read]`);
        }
      }

      const screenshotNotes: string[] = (files.screenshot || []).map(f =>
        `[Screenshot: ${f.originalname} — image evidence (filename recorded, OCR not performed)]`
      );

      const sampleFileNotes: string[] = (files.sample || []).map(f => {
        const ext = f.originalname.split(".").pop()?.toLowerCase() || "";
        return `[Sample file: ${f.originalname} (type: .${ext}) — filename used as naming pattern evidence only]`;
      });

      const scopeSummary = Object.entries(scopeDetails).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v)}`).join("; ");
      const userContext = [
        `Setup context: ${setupContext || "not specified"}`,
        `Project environment: ${projectEnvironment || "not specified"}`,
        `Builder intent: ${builderIntent || "not specified"}`,
        `Scope of responsibility: ${scopeType || "not specified"}`,
        scopeSummary ? `Scope details: ${scopeSummary}` : null,
        `Levels relevant: ${levelsRelevant || "not specified"}`,
        `Primary structure: ${primaryStructure || "not specified"}`,
        Object.keys(availableInputs).length > 0 ? `Available evidence types: ${Object.entries(availableInputs).filter(([, v]) => v).map(([k]) => k).join(", ")}` : null,
      ].filter(Boolean).join("\n");

      const evidenceParts = [
        sampleNames.length > 0 ? `Sample file names:\n${sampleNames.join("\n")}` : null,
        rawFolderTreeText ? `Folder structure:\n${rawFolderTreeText}` : null,
        rawIndexText ? `Document index / register:\n${rawIndexText}` : null,
        rawNotes ? `Additional notes:\n${rawNotes}` : null,
        pdfTexts.length > 0 ? `PDF evidence:\n${pdfTexts.join("\n\n")}` : null,
        sheetTexts.length > 0 ? `Spreadsheet evidence:\n${sheetTexts.join("\n\n")}` : null,
        screenshotNotes.length > 0 ? `Screenshot evidence (filenames):\n${screenshotNotes.join("\n")}` : null,
        sampleFileNotes.length > 0 ? `Sample file evidence (filenames):\n${sampleFileNotes.join("\n")}` : null,
      ].filter(Boolean).join("\n\n");

      const systemPrompt = `You are helping BIMLog understand a project document environment.
Do not assume a standard building convention unless the evidence clearly shows one.
The user may only be responsible for part of the project.
The evidence may be incomplete.
Infer probable structure, but do not force certainty where there is ambiguity.
Return ONLY valid JSON with no markdown, no explanation, no code block wrapping.`;

      const userPrompt = `Analyze the following project context and evidence and return a structured discovery result.

USER CONTEXT:
${userContext}

EVIDENCE:
${evidenceParts || "No evidence provided. Base analysis on user context only."}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "projectTypeGuess": "string describing probable project type",
  "scopeInterpretation": "string describing how you interpret the user scope",
  "usesLevels": true or false or null,
  "usesAreas": true or false or null,
  "usesPackages": true or false or null,
  "usesVolumes": true or false or null,
  "suggestedDisciplines": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedSystems": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedDocTypes": [
    { "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedExtraFields": [
    { "key": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "suggestedFieldOrder": ["array of field name strings in recommended order"],
  "ambiguities": ["array of open questions or ambiguous areas"],
  "recommendedMode": "string describing recommended setup mode",
  "analysisSummary": "2-4 sentence summary of findings"
}`;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") { res.status(500).json({ error: "No text response from AI" }); return; }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(block.text.trim()) as Record<string, unknown>;
      } catch {
        res.status(422).json({
          error: "AI returned non-JSON response",
          raw: block.text.slice(0, 500),
          projectTypeGuess: "Unable to parse",
          scopeInterpretation: "Analysis failed — please try again or paste more evidence",
          usesLevels: null, usesAreas: null, usesPackages: null, usesVolumes: null,
          suggestedDisciplines: [], suggestedSystems: [], suggestedDocTypes: [],
          suggestedExtraFields: [], suggestedFieldOrder: [],
          ambiguities: ["AI parse error — try with more specific evidence"],
          recommendedMode: "manual",
          analysisSummary: "The analysis could not be completed. Please add more evidence and try again.",
        });
        return;
      }

      if (failedFiles.length > 0) {
        parsed._extractionWarning = `Some files could not be fully read, but BIMLog still used the available evidence. Affected: ${failedFiles.join(", ")}`;
      }

      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discovery failed";
      res.status(500).json({ error: message });
    }
  }
);

// ── Convention Versions — list ────────────────────────────────────────────────
router.get("/projects/:projectId/convention/versions", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

    const versions = await db
      .select()
      .from(namingConventionVersionsTable)
      .where(eq(namingConventionVersionsTable.projectId, projectId))
      .orderBy(desc(namingConventionVersionsTable.conventionVersion));

    res.json(versions.map(v => ({
      id: v.id,
      conventionVersion: v.conventionVersion,
      analysisSummary: v.analysisSummary,
      changeSummary: v.changeSummary,
      userGuidance: v.userGuidance,
      acceptedDisciplines: v.acceptedDisciplines,
      acceptedSystems: v.acceptedSystems,
      acceptedDocTypes: v.acceptedDocTypes,
      acceptedExtraFields: v.acceptedExtraFields,
      acceptedFieldOrder: v.acceptedFieldOrder,
      ambiguities: v.ambiguities,
      userNotes: v.userNotes,
      createdAt: v.createdAt.toISOString(),
      createdById: v.createdById,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ── Convention Status — compact orientation object ────────────────────────────
router.get("/projects/:projectId/convention/status", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

    const versions = await db
      .select()
      .from(namingConventionVersionsTable)
      .where(eq(namingConventionVersionsTable.projectId, projectId))
      .orderBy(desc(namingConventionVersionsTable.conventionVersion))
      .limit(2);

    if (versions.length === 0) {
      res.json({
        activeVersion: 0,
        baselineVersion: 0,
        currentMode: "no_version",
        currentGuidance: "",
        lastChangeSummary: "",
        unresolvedCount: 0,
        unresolvedItems: [],
        latestEvidenceSummary: { hasAnalysis: false, fileCount: null, usedPastedText: null, usedPdf: null, usedSpreadsheet: null, usedScreenshot: null, usedSampleFilenames: null },
        latestAcceptedChanges: { disciplines: [], systems: [], documentTypes: [], conflictsResolved: [] },
      });
      return;
    }

    const latest = versions[0];
    const prev = versions[1] ?? null;

    const latestAcceptedChanges: {
      disciplines: Array<{ code: string; label: string }>;
      systems: Array<{ code: string; label: string }>;
      documentTypes: Array<{ code: string; label: string }>;
      conflictsResolved: string[];
    } = { disciplines: [], systems: [], documentTypes: [], conflictsResolved: [] };

    if (prev) {
      const prevDiscCodes = new Set(prev.acceptedDisciplines.map(d => d.code));
      latestAcceptedChanges.disciplines = latest.acceptedDisciplines.filter(d => !prevDiscCodes.has(d.code));
      const prevSysCodes = new Set(prev.acceptedSystems.map(s => s.code));
      latestAcceptedChanges.systems = latest.acceptedSystems.filter(s => !prevSysCodes.has(s.code));
      const prevDocCodes = new Set(prev.acceptedDocTypes.map(d => d.code));
      latestAcceptedChanges.documentTypes = latest.acceptedDocTypes.filter(d => !prevDocCodes.has(d.code));
    }

    res.json({
      activeVersion: latest.conventionVersion,
      baselineVersion: latest.conventionVersion,
      currentMode: "accepted_baseline",
      currentGuidance: latest.userGuidance ?? "",
      lastChangeSummary: latest.changeSummary ?? "",
      unresolvedCount: latest.ambiguities.length,
      unresolvedItems: latest.ambiguities,
      latestEvidenceSummary: {
        hasAnalysis: !!latest.analysisSummary,
        fileCount: null,
        usedPastedText: null,
        usedPdf: null,
        usedSpreadsheet: null,
        usedScreenshot: null,
        usedSampleFilenames: null,
      },
      latestAcceptedChanges,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ── Convention Versions — save snapshot ──────────────────────────────────────
router.post("/projects/:projectId/convention/versions", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
    const userId = req.user!.userId;

    const {
      acceptedDisciplines = [],
      acceptedSystems = [],
      acceptedDocTypes = [],
      acceptedExtraFields = [],
      acceptedFieldOrder = [],
      analysisSummary,
      ambiguities = [],
      userNotes,
      changeSummary,
      userGuidance,
    } = req.body as Record<string, unknown>;

    const existing = await db
      .select({ conventionVersion: namingConventionVersionsTable.conventionVersion })
      .from(namingConventionVersionsTable)
      .where(eq(namingConventionVersionsTable.projectId, projectId))
      .orderBy(desc(namingConventionVersionsTable.conventionVersion))
      .limit(1);

    const nextVersion = existing.length > 0 ? existing[0].conventionVersion + 1 : 1;

    const [inserted] = await db
      .insert(namingConventionVersionsTable)
      .values({
        projectId,
        conventionVersion: nextVersion,
        acceptedDisciplines: acceptedDisciplines as Array<{ code: string; label: string }>,
        acceptedSystems: acceptedSystems as Array<{ code: string; label: string }>,
        acceptedDocTypes: acceptedDocTypes as Array<{ code: string; label: string }>,
        acceptedExtraFields: acceptedExtraFields as Array<{ key: string; label: string }>,
        acceptedFieldOrder: acceptedFieldOrder as string[],
        analysisSummary: typeof analysisSummary === "string" ? analysisSummary : null,
        ambiguities: ambiguities as string[],
        userNotes: typeof userNotes === "string" ? userNotes : null,
        changeSummary: typeof changeSummary === "string" ? changeSummary : null,
        userGuidance: typeof userGuidance === "string" ? userGuidance : null,
        createdById: userId,
      })
      .returning();

    // Propagate guidance to the active convention row as well
    if (typeof userGuidance === "string") {
      await db
        .update(namingConventionsTable)
        .set({ userGuidance })
        .where(eq(namingConventionsTable.projectId, projectId));
    }

    res.json({ id: inserted.id, conventionVersion: inserted.conventionVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ── Convention Re-analysis (comparison against baseline) ──────────────────────
router.post(
  "/projects/:projectId/convention/reanalyze",
  authMiddleware,
  requireProjectMember(),
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) { res.status(400).json({ error: `File upload error: ${err instanceof Error ? err.message : String(err)}` }); return; }
      next();
    });
  },
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

      const b = req.body as Record<string, string>;
      const rawFiles = (req.files as Record<string, Express.Multer.File[]>) || {};

      // Deduplicate files per category by originalname — silently skip exact-name duplicates.
      // This prevents crashes when the user re-uploads previously used files alongside new ones.
      const skippedDuplicates: string[] = [];
      const files: Record<string, Express.Multer.File[]> = {};
      for (const [cat, catFiles] of Object.entries(rawFiles)) {
        const seen = new Set<string>();
        const deduped: Express.Multer.File[] = [];
        for (const f of catFiles) {
          if (seen.has(f.originalname)) {
            skippedDuplicates.push(f.originalname);
          } else {
            seen.add(f.originalname);
            deduped.push(f);
          }
        }
        files[cat] = deduped;
      }

      const rawFolderTreeText = b.rawFolderTreeText || "";
      const rawIndexText = b.rawIndexText || "";
      const rawNotes = b.rawNotes || "";
      const sampleNames: string[] = (b.sampleNames || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

      const failedFiles: string[] = [];

      const pdfTexts: string[] = [];
      for (const f of files.pdf || []) {
        try {
          const parser = new PDFParse({ data: new Uint8Array(f.buffer) });
          const result = await parser.getText();
          const txt = ((result as { text?: string }).text ?? "").trim();
          pdfTexts.push(txt
            ? `[From PDF: ${f.originalname}]\n${txt.slice(0, 8000)}`
            : `[PDF: ${f.originalname} — no extractable text]`);
        } catch {
          failedFiles.push(f.originalname);
          pdfTexts.push(`[PDF: ${f.originalname} — could not read]`);
        }
      }

      const sheetTexts: string[] = [];
      for (const f of files.spreadsheet || []) {
        try {
          const workbook = XLSX.read(f.buffer, { type: "buffer" });
          const rows: string[] = [];
          for (const sheetName of workbook.SheetNames.slice(0, 3)) {
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
            const nonEmpty = csv.split("\n").filter((r: string) => r.replace(/,/g, "").trim()).slice(0, 200).join("\n");
            if (nonEmpty) rows.push(`[Sheet: ${sheetName}]\n${nonEmpty}`);
          }
          sheetTexts.push(rows.length > 0
            ? `[From spreadsheet: ${f.originalname}]\n${rows.join("\n").slice(0, 8000)}`
            : `[Spreadsheet: ${f.originalname} — no readable data]`);
        } catch {
          failedFiles.push(f.originalname);
          sheetTexts.push(`[Spreadsheet: ${f.originalname} — could not read]`);
        }
      }

      const screenshotNotes: string[] = (files.screenshot || []).map(f =>
        `[Screenshot: ${f.originalname} — image evidence (filename recorded, OCR not performed)]`
      );
      const sampleFileNotes: string[] = (files.sample || []).map(f => {
        const ext = f.originalname.split(".").pop()?.toLowerCase() || "";
        return `[Sample file: ${f.originalname} (type: .${ext}) — filename used as naming pattern evidence only]`;
      });

      const latestVersions = await db
        .select()
        .from(namingConventionVersionsTable)
        .where(eq(namingConventionVersionsTable.projectId, projectId))
        .orderBy(desc(namingConventionVersionsTable.conventionVersion))
        .limit(1);

      const baseline = latestVersions[0] ?? null;

      const baselineSummary = baseline
        ? `Current accepted convention (Version ${baseline.conventionVersion}):
- Disciplines: ${(baseline.acceptedDisciplines as Array<{ code: string; label: string }>).map(d => `${d.code} (${d.label})`).join(", ") || "none"}
- Systems: ${(baseline.acceptedSystems as Array<{ code: string; label: string }>).map(s => `${s.code} (${s.label})`).join(", ") || "none"}
- Document types: ${(baseline.acceptedDocTypes as Array<{ code: string; label: string }>).map(d => `${d.code} (${d.label})`).join(", ") || "none"}
- Extra fields: ${(baseline.acceptedExtraFields as Array<{ key: string; label: string }>).map(f => f.label).join(", ") || "none"}
- Field order: ${(baseline.acceptedFieldOrder as string[]).join(" → ") || "default"}
- Original summary: ${baseline.analysisSummary || "not recorded"}`
        : "No previously accepted convention baseline found for this project.";

      const evidenceParts = [
        sampleNames.length > 0 ? `Sample file names:\n${sampleNames.join("\n")}` : null,
        rawFolderTreeText ? `Folder structure:\n${rawFolderTreeText}` : null,
        rawIndexText ? `Document index / register:\n${rawIndexText}` : null,
        rawNotes ? `Additional notes:\n${rawNotes}` : null,
        pdfTexts.length > 0 ? `PDF evidence:\n${pdfTexts.join("\n\n")}` : null,
        sheetTexts.length > 0 ? `Spreadsheet evidence:\n${sheetTexts.join("\n\n")}` : null,
        screenshotNotes.length > 0 ? `Screenshot evidence (filenames):\n${screenshotNotes.join("\n")}` : null,
        sampleFileNotes.length > 0 ? `Sample file evidence (filenames):\n${sampleFileNotes.join("\n")}` : null,
      ].filter(Boolean).join("\n\n");

      const guidanceText = (baseline?.userGuidance as string | null) ?? null;

      const systemPrompt = `You are re-evaluating an existing project naming convention using newly provided evidence.
Do not discard the current convention blindly.
Identify what is confirmed, what is newly discovered, what conflicts with the current convention, and what remains unresolved.
If no baseline exists, treat this as an initial discovery and return empty confirmedItems.${guidanceText ? `

MANDATORY PROJECT GUIDANCE (set by the project team — you must respect this):
${guidanceText}

Apply this guidance strictly when determining what to include, exclude, or change in the next convention version. Do not override or ignore it.` : ""}
Return ONLY valid JSON with no markdown, no explanation, no code block wrapping.`;

      const userPrompt = `BASELINE CONVENTION:
${baselineSummary}
${guidanceText ? `\nPROJECT CONVENTION GUIDANCE (carry this forward — human-governed):\n${guidanceText}\n` : ""}
NEW EVIDENCE:
${evidenceParts || "No new evidence provided — returning baseline as confirmed."}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "baselineVersion": ${baseline?.conventionVersion ?? 0},
  "analysisSummary": "2-4 sentence summary of what the new evidence shows",
  "confirmedItems": {
    "disciplines": ["array of discipline codes confirmed by new evidence"],
    "systems": ["array of system codes confirmed by new evidence"],
    "documentTypes": ["array of doc type codes confirmed by new evidence"],
    "extraFields": ["array of extra field keys confirmed"],
    "fieldOrder": ["array of field names confirmed in order"]
  },
  "newlySuggestedItems": {
    "disciplines": [{ "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }],
    "systems": [{ "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }],
    "documentTypes": [{ "code": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }],
    "extraFields": [{ "key": "string", "label": "string", "reason": "string", "confidence": "high|medium|low" }],
    "fieldOrder": []
  },
  "conflicts": [
    { "category": "string", "existingValue": "string", "newValue": "string", "reason": "string", "confidence": "high|medium|low" }
  ],
  "stillUnresolved": ["array of open questions or ambiguous areas"],
  "recommendedActions": ["array of recommended next actions"],
  "proposedNextVersionSummary": "one paragraph describing what the next version snapshot should include"
}`;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") { res.status(500).json({ error: "No text response from AI" }); return; }

      let parsed: Record<string, unknown>;
      try {
        let raw = block.text.trim();
        if (raw.startsWith("```")) {
          raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
        }
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          raw = raw.slice(firstBrace, lastBrace + 1);
        }
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        res.status(422).json({
          error: "AI returned non-JSON response",
          baselineVersion: baseline?.conventionVersion ?? 0,
          analysisSummary: "The re-analysis could not be completed. Please add more evidence and try again.",
          confirmedItems: { disciplines: [], systems: [], documentTypes: [], extraFields: [], fieldOrder: [] },
          newlySuggestedItems: { disciplines: [], systems: [], documentTypes: [], extraFields: [], fieldOrder: [] },
          conflicts: [],
          stillUnresolved: ["AI parse error — try with more specific evidence"],
          recommendedActions: [],
          proposedNextVersionSummary: "",
        });
        return;
      }

      const warningParts: string[] = [];
      if (failedFiles.length > 0) warningParts.push(`Some files could not be fully read: ${failedFiles.join(", ")}`);
      if (skippedDuplicates.length > 0) warningParts.push(`Duplicate files ignored (already included): ${skippedDuplicates.join(", ")}`);
      if (warningParts.length > 0) parsed._extractionWarning = warningParts.join(" | ");

      const ciRisk = (parsed.confirmedItems || {}) as Record<string, unknown[]>;
      const baseDiscCount = baseline ? (baseline.acceptedDisciplines as unknown[]).length : 0;
      const baseDocCount = baseline ? (baseline.acceptedDocTypes as unknown[]).length : 0;
      const confirmedDiscCount = (ciRisk.disciplines || []).length;
      const confirmedDocCount = (ciRisk.documentTypes || []).length;
      const conflictCount = ((parsed.conflicts || []) as unknown[]).length;
      const totalBaseline = baseDiscCount + baseDocCount;
      const totalConfirmed = confirmedDiscCount + confirmedDocCount;
      let riskLevel = "low";
      if (baseline && totalBaseline > 0) {
        if (totalConfirmed === 0) {
          riskLevel = "high";
        } else if (conflictCount >= 2 || totalConfirmed < totalBaseline / 2) {
          riskLevel = "high";
        } else if (conflictCount > 0) {
          riskLevel = "medium";
        }
      }
      parsed.riskLevel = riskLevel;

      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Re-analysis failed";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
