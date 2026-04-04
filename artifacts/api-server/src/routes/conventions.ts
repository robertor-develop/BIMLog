import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { namingConventionsTable, namingFieldsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { GetConventionParams, UpsertConventionParams, UpsertConventionBody } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { getDefaultValue } from "../middlewares/config-validator";
import Anthropic from "@anthropic-ai/sdk";

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
        isActive: false,
        fields: [],
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

    res.json({
      id: convention.id,
      projectId: convention.projectId,
      separator: convention.separator,
      isActive: convention.isActive,
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
    const body = UpsertConventionBody.parse(req.body);

    const existing = await db
      .select()
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId))
      .limit(1);

    let conventionId: number;

    if (existing.length > 0) {
      const [updated] = await db
        .update(namingConventionsTable)
        .set({
          separator: body.separator,
          isActive: body.isActive,
          updatedAt: new Date(),
        })
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
      isActive: convention[0].isActive,
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

export default router;
