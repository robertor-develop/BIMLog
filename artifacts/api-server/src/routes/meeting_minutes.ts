import { Router } from "express";
import { db } from "@workspace/db";
import {
  meetingMinutesTable, meetingAttendeesTable, actionItemsTable,
  activityLogTable, usersTable,
  linkedItemsTable, agentInsightsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne, isNull, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { sendEmail } from "../lib/email";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { extractFileText } from "../lib/extract-file-text";

const FFMPEG_PATH = (() => { try { const { execSync } = require("child_process"); return execSync("which ffmpeg").toString().trim() || "ffmpeg"; } catch { return "ffmpeg"; } })();

const router: Router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
});
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── GET /projects/:projectId/meetings ─────────────────────────────────────────
router.get("/projects/:projectId/meetings", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const meetings = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.projectId, projectId), isNull(meetingMinutesTable.deletedAt)))
      .orderBy(desc(meetingMinutesTable.meetingDate));
    const result = await Promise.all(meetings.map(async m => {
      const attendees = await db.select({ id: meetingAttendeesTable.id }).from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, m.id));
      const actionItems = await db.select({ id: actionItemsTable.id, status: actionItemsTable.status }).from(actionItemsTable).where(eq(actionItemsTable.meetingId, m.id));
      return { ...m, attendeeCount: attendees.length, actionItemCount: actionItems.length, openActionItems: actionItems.filter(a => a.status !== "completed" && a.status !== "cancelled").length };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings ────────────────────────────────────────
router.post("/projects/:projectId/meetings", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as {
    title: string; meeting_date: string; location?: string; notes?: string;
    attendees?: { user_id?: number; external_email?: string; full_name: string; company?: string; role?: string }[];
  };
  if (!body.title || !body.meeting_date) { res.status(400).json({ error: "title and meeting_date required" }); return; }
  try {
    const [meeting] = await db.insert(meetingMinutesTable).values({
      projectId, title: body.title,
      meetingDate: new Date(body.meeting_date),
      location: body.location ?? null, notes: body.notes ?? null,
      createdById: req.user!.userId,
    }).returning();

    if (body.attendees?.length) {
      await db.insert(meetingAttendeesTable).values(
        body.attendees.map(a => ({
          meetingId: meeting.id, userId: a.user_id ?? null,
          externalEmail: a.external_email ?? null, fullName: a.full_name,
          company: a.company ?? null, role: a.role ?? null,
        }))
      );
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "meeting", entityId: meeting.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created meeting: ${body.title} on ${new Date(body.meeting_date).toLocaleDateString()}`,
    });
    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/meetings/:meetingId ──────────────────────────────
router.get("/projects/:projectId/meetings/:meetingId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }
    const attendees = await db.select().from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));
    const actionItems = await db.select().from(actionItemsTable).where(eq(actionItemsTable.meetingId, meetingId));
    res.json({ ...meeting, attendees, actionItems });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/meetings/:meetingId ────────────────────────────
router.patch("/projects/:projectId/meetings/:meetingId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as Partial<{ title: string; notes: string; location: string; ai_summary: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)      updates.title      = body.title;
    if (body.notes !== undefined)      updates.notes      = body.notes;
    if (body.location !== undefined)   updates.location   = body.location;
    if (body.ai_summary !== undefined) updates.aiSummary  = body.ai_summary;
    const [updated] = await db.update(meetingMinutesTable).set(updates as any)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/ai-summary ──────────────────
router.post("/projects/:projectId/meetings/:meetingId/ai-summary", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

    const prompt = `You are a construction project manager. Summarize these meeting notes and extract action items.
Meeting: ${meeting.title} on ${new Date(meeting.meetingDate).toLocaleDateString()}
Notes: ${meeting.notes ?? "(no notes)"}
Return JSON only: { "summary": "...", "action_items": [{ "description": "...", "assigned_to_name": "...", "assigned_to_email": "...", "due_date": "YYYY-MM-DD or null" }] }`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

    await db.update(meetingMinutesTable).set({ aiSummary: parsed.summary, updatedAt: new Date() })
      .where(eq(meetingMinutesTable.id, meetingId));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/action-items ────────────────
router.post("/projects/:projectId/meetings/:meetingId/action-items", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as { items: { description: string; assigned_to_id?: number; assigned_to_name?: string; assigned_to_email?: string; due_date?: string }[] };
  if (!body.items?.length) { res.status(400).json({ error: "items required" }); return; }
  try {
    const created = await db.insert(actionItemsTable).values(
      body.items.map(i => ({
        meetingId, projectId, description: i.description,
        assignedToId: i.assigned_to_id ?? null,
        assignedToName: i.assigned_to_name ?? null,
        assignedToExternalEmail: i.assigned_to_email ?? null,
        dueDate: i.due_date ? new Date(i.due_date) : null,
        status: "open" as const,
      }))
    ).returning();

    // Notify assigned BIMLog users
    for (const item of created) {
      if (item.assignedToId) {
        await createNotification(item.assignedToId, projectId, "action_item_due",
          "New Action Item", item.description,
          `/projects/${projectId}/meetings`);
      }
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "action_items", entityId: meetingId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created ${created.length} action item(s) for meeting`,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/action-items ─────────────────────────────────────
router.get("/projects/:projectId/action-items", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const items = await db.select().from(actionItemsTable)
      .where(and(eq(actionItemsTable.projectId, projectId), ne(actionItemsTable.status, "cancelled")))
      .orderBy(desc(actionItemsTable.createdAt));
    const now = Date.now();
    const withOverdue = items.map(i => ({
      ...i,
      isOverdue: i.status !== "completed" && i.dueDate && new Date(i.dueDate).getTime() < now,
    }));
    res.json(withOverdue);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/action-items/:itemId ───────────────────────────
router.patch("/projects/:projectId/action-items/:itemId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const itemId = Number(req.params.itemId);
  const body = req.body as Partial<{ status: string; description: string; due_date: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") updates.completedAt = new Date();
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.due_date !== undefined)    updates.dueDate = body.due_date ? new Date(body.due_date) : null;
    const [updated] = await db.update(actionItemsTable).set(updates as any)
      .where(and(eq(actionItemsTable.id, itemId), eq(actionItemsTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/transcribe-audio ───────────────────────
router.post("/projects/:projectId/meetings/transcribe-audio",
  authMiddleware,
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }).single("audio"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      const [userRow] = await db.select({ openaiApiKey: usersTable.openaiApiKey })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId));
      if (!userRow?.openaiApiKey) {
        res.status(400).json({ error: "no_openai_key", message: "OpenAI API key not configured. Add it in your Profile." });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "no_file", message: "No audio file uploaded." });
        return;
      }

      const ext = req.file.originalname.split(".").pop()?.toLowerCase() ?? "";
      const allowedExts = ["mp3","mp4","m4a","wav","webm","ogg"];
      if (!allowedExts.includes(ext)) {
        res.status(400).json({ error: "invalid_format", message: "Unsupported format. Use MP3, MP4, M4A, WAV, WebM, or OGG." });
        return;
      }

      const CHUNK_SIZE = 20 * 1024 * 1024;
      const fileBuffer = req.file.buffer;
      const fileSizeMB = Math.round(fileBuffer.length / 1024 / 1024);

      async function transcribeBuffer(buf: Buffer, filename: string): Promise<string> {
        const fs = await import("fs");
        const path = await import("path");
        const os = await import("os");
        const { OpenAI } = await import("openai");
        const openaiClient = new OpenAI({ apiKey: userRow.openaiApiKey as string });
        const tmpPath = path.join(os.tmpdir(), `whisper_${Date.now()}_${filename}`);
        fs.writeFileSync(tmpPath, buf);
        try {
          const response = await openaiClient.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath) as any,
            model: "whisper-1",
          });
          return response.text ?? "";
        } finally {
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }

      let fullTranscript = "";

      if (fileBuffer.length <= CHUNK_SIZE) {
        const { execSync } = await import("child_process");
        const os = await import("os");
        const fs = await import("fs");
        const path = await import("path");
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `bimlog_audio_${Date.now()}.${ext}`);
        const outputPath = path.join(tmpDir, `bimlog_compressed_${Date.now()}.mp3`);
        fs.writeFileSync(inputPath, fileBuffer);
        try {
          execSync(`${FFMPEG_PATH} -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k "${outputPath}" -y`, { stdio: "pipe" });
          const compressed = fs.readFileSync(outputPath);
          fullTranscript = await transcribeBuffer(compressed, "audio.mp3");
        } finally {
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
        }
      } else {
        const { execSync } = await import("child_process");
        const os = await import("os");
        const fs = await import("fs");
        const path = await import("path");
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `bimlog_audio_${Date.now()}.${ext}`);
        const compressedPath = path.join(tmpDir, `bimlog_compressed_${Date.now()}.mp3`);
        fs.writeFileSync(inputPath, fileBuffer);

        try {
          execSync(`${FFMPEG_PATH} -i "${inputPath}" -ar 16000 -ac 1 -b:a 64k "${compressedPath}" -y`, { stdio: "pipe" });
          const compressedBuffer = fs.readFileSync(compressedPath);

          if (compressedBuffer.length <= CHUNK_SIZE) {
            fullTranscript = await transcribeBuffer(compressedBuffer, "audio.mp3");
          } else {
            const numChunks = Math.ceil(compressedBuffer.length / CHUNK_SIZE);
            const transcripts: string[] = [];
            for (let i = 0; i < numChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, compressedBuffer.length);
              const chunk = compressedBuffer.subarray(start, end);
              const chunkPath = path.join(tmpDir, `bimlog_chunk_${Date.now()}_${i}.mp3`);
              fs.writeFileSync(chunkPath, chunk);
              try {
                const chunkTranscript = await transcribeBuffer(chunk, `chunk_${i}.mp3`);
                transcripts.push(chunkTranscript);
              } finally {
                try { fs.unlinkSync(chunkPath); } catch {}
              }
            }
            fullTranscript = transcripts.join(" ");
          }
        } finally {
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(compressedPath); } catch {}
        }
      }

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are a construction project coordinator assistant.
Extract structured meeting information from this transcript.
Return ONLY valid JSON, no markdown, no explanation.

Transcript:
${fullTranscript}

Return this exact JSON structure:
{
  "title": "meeting title or topic if mentioned",
  "agenda": ["item 1", "item 2"],
  "attendees": [{ "trade": "", "company": "", "fullName": "", "role": "", "email": "", "phone": "" }],
  "rfis": [{ "rfiNumber": "", "description": "", "status": "PENDING", "responsible": "" }],
  "deliverables": [{ "floor": "", "description": "", "plumbing": "", "hvac": "", "fireProt": "", "electrical": "", "other": "", "coordinator": "", "deadline": "" }],
  "viewpoints": [{ "floor": "", "responsible": "", "holdUps": "", "viewpoint": "", "description": "", "deadline": "" }],
  "aiSummary": "two sentence summary of the meeting"
}
For deliverable status fields use only: PENDING, COMPLETE, N/A, or empty string.
For deadlines use MM-DD-YY format if mentioned.
If information is not mentioned use empty string or empty array.`
        }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
      res.json({ ...parsed, transcript: fullTranscript, fileSizeMB });

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[transcribe-audio] FAILED:", errMsg);
      res.status(500).json({ error: "transcription_failed", message: errMsg });
    }
  }
);

router.post("/projects/:projectId/meetings/import",
  authMiddleware,
  requirePermission("admin", "write"),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      let data: any = { title: null, meetingDate: null, meetingTime: null, location: null, meetingNumber: null, notes: null, attendees: [], actionItems: [] };
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `You are analyzing a construction meeting minutes PDF document.
Extract the meeting information. Return ONLY valid JSON, no markdown. Use null for fields not present:
{
  "title": "meeting title or null",
  "meetingDate": "date string or null",
  "meetingTime": "time string or null",
  "location": "location or null",
  "meetingNumber": "meeting number or null",
  "notes": "general notes or null",
  "attendees": [{"trade":"","company":"","fullName":"","role":"","email":"","phone":""}],
  "actionItems": [{"description":"","assignedToName":"","dueDate":"date or null","status":"open"}]
}` }
              ] as any
            }]
          });
          const text = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "{}";
          const clean = text.replace(/```json\n?|```/g, "").trim();
          const parsed = JSON.parse(clean);
          data = {
            title: parsed.title ?? null,
            meetingDate: parsed.meetingDate ?? null,
            meetingTime: parsed.meetingTime ?? null,
            location: parsed.location ?? null,
            meetingNumber: parsed.meetingNumber ?? null,
            notes: parsed.notes ?? null,
            attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
          };
          console.log("[meeting-import] PDF direct extraction: attendees=", data.attendees.length, "actions=", data.actionItems.length);
        } catch (e) {
          console.error("[meeting-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `You are analyzing a chunk of a construction meeting minutes document.
Extract the meeting information from this chunk. Return ONLY valid JSON, no markdown. Use null for fields not present in this chunk:
{
  "title": "meeting title or null",
  "meetingDate": "date string or null",
  "meetingTime": "time string or null",
  "location": "location or null",
  "meetingNumber": "meeting number or null",
  "notes": "general notes or null",
  "attendees": [{"trade":"","company":"","fullName":"","role":"","email":"","phone":""}],
  "actionItems": [{"description":"","assignedToName":"","dueDate":"date or null","status":"open"}]
}

Document chunk:
${chunk}`
            }]
          });
          const text = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "{}";
          const clean = text.replace(/```json\n?|```/g, "").trim();
          const chunkData = JSON.parse(clean);
          data.title = data.title || chunkData.title || null;
          data.meetingDate = data.meetingDate || chunkData.meetingDate || null;
          data.meetingTime = data.meetingTime || chunkData.meetingTime || null;
          data.location = data.location || chunkData.location || null;
          data.meetingNumber = data.meetingNumber || chunkData.meetingNumber || null;
          data.notes = [data.notes, chunkData.notes].filter(Boolean).join("\n\n") || null;
          if (Array.isArray(chunkData.attendees)) data.attendees = [...data.attendees, ...chunkData.attendees];
          if (Array.isArray(chunkData.actionItems)) data.actionItems = [...data.actionItems, ...chunkData.actionItems];
        } catch (e) {
          console.error("[meeting-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      const [meeting] = await db.insert(meetingMinutesTable).values({
        projectId,
        title: data.title || req.file.originalname,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : new Date(),
        location: data.location || null,
        notes: data.notes || null,
        createdById: req.user!.userId,
      }).returning();

      if (data.attendees?.length > 0) {
        const validAttendees = data.attendees.filter((a: any) => a.fullName);
        if (validAttendees.length > 0) {
          await db.insert(meetingAttendeesTable).values(
            validAttendees.map((a: any) => ({
              meetingId: meeting.id,
              fullName: a.fullName,
              company: a.company || null,
              role: a.role || null,
              externalEmail: a.email || null,
              userId: null,
            }))
          );
        }
      }

      if (data.actionItems?.length > 0) {
        const validItems = data.actionItems.filter((ai: any) => ai.description);
        if (validItems.length > 0) {
          await db.insert(actionItemsTable).values(
            validItems.map((ai: any) => ({
              meetingId: meeting.id,
              projectId,
              description: ai.description,
              assignedToName: ai.assignedToName || null,
              dueDate: ai.dueDate ? new Date(ai.dueDate) : null,
              status: ai.status || "open",
            }))
          );
        }
      }

      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "import",
        entityType: "meeting",
        entityId: meeting.id,
        details: `Imported meeting minutes from ${req.file.originalname} — ${data.attendees?.length ?? 0} attendees, ${data.actionItems?.length ?? 0} action items`,
      });

      res.json({ imported: 1, meetingId: meeting.id, title: meeting.title, message: "Meeting imported successfully" });
    } catch (err) {
      console.error("[meeting-import]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// ── DELETE meeting (soft delete) ──────────────────────────────────────────────
router.delete("/projects/:projectId/meetings/:meetingId",
  authMiddleware, requirePermission("admin", "write"), async (req, res) => {
    const projectId = Number(req.params.projectId);
    const meetingId = Number(req.params.meetingId);
    const reason = (req.body?.reason as string | undefined) ?? null;
    try {
      const [existing] = await db.select().from(meetingMinutesTable)
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
      if (!existing) { res.status(404).json({ error: "not_found" }); return; }

      await db.update(meetingMinutesTable)
        .set({ deletedAt: new Date(), deleteReason: reason })
        .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));

      await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));

      await db.delete(linkedItemsTable).where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, "meeting"), eq(linkedItemsTable.fromId, meetingId)),
          and(eq(linkedItemsTable.toType, "meeting"), eq(linkedItemsTable.toId, meetingId)),
        ),
      ));

      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "delete", entityType: "meeting", entityId: meetingId,
        details: JSON.stringify({ reason, title: existing.title, meetingDate: existing.meetingDate }),
      });

      await db.insert(agentInsightsTable).values({
        projectId, agentType: "meeting", entityType: "meeting", entityId: meetingId,
        insightType: "delete_pattern",
        message: `Meeting "${existing.title}" deleted: ${reason ?? "no reason"}`,
        recommendation: "Review meeting delete reasons to detect scheduling churn.",
        severity: "info",
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
