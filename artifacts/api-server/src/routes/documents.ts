import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { filesTable, usersTable } from "@workspace/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

interface SearchResult {
  id: number;
  fileName: string;
  fileType: string;
  uploadedByName: string;
  uploadedAt: string;
  matchType: "pdf_content" | "bim_metadata" | "filename";
  excerpt?: string;
  fileMetadata?: Record<string, unknown>;
}

function excerptText(text: string, query: string, maxLen = 300): string {
  const lc = text.toLowerCase();
  const qLc = query.toLowerCase();
  const idx = lc.indexOf(qLc);
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + query.length + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

// ─── GET /projects/:projectId/documents/search?q=... ─────────────────────────
router.get("/projects/:projectId/documents/search", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const rawQ = req.query.q;
    const q = String(Array.isArray(rawQ) ? rawQ[0] ?? "" : rawQ ?? "").trim();

    if (!q) {
      res.json({ results: [], query: "" });
      return;
    }

    const allFiles = await db.query.filesTable.findMany({
      where: eq(filesTable.projectId, projectId),
    });

    const results: SearchResult[] = [];
    const qLc = q.toLowerCase();

    for (const f of allFiles) {
      const uploaderRows = await db.select().from(usersTable).where(eq(usersTable.id, f.uploadedById)).limit(1);
      const uploadedByName = uploaderRows[0]?.fullName || "";

      const base: Omit<SearchResult, "matchType" | "excerpt" | "fileMetadata"> = {
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        uploadedByName,
        uploadedAt: f.createdAt.toISOString(),
      };

      let matched = false;

      // 1. Search extracted PDF text
      if (f.extractedText) {
        const textLc = f.extractedText.toLowerCase();
        if (textLc.includes(qLc)) {
          results.push({
            ...base,
            matchType: "pdf_content",
            excerpt: excerptText(f.extractedText, q),
          });
          matched = true;
        }
      }

      // 2. Search BIM file metadata (field values)
      if (!matched && f.fileMetadata) {
        const meta = f.fileMetadata as Record<string, unknown>;
        const fields = meta.fields as Record<string, string> | undefined;
        if (fields) {
          const fieldValues = Object.values(fields).join(" ").toLowerCase();
          if (fieldValues.includes(qLc)) {
            results.push({
              ...base,
              matchType: "bim_metadata",
              fileMetadata: meta,
              excerpt: `Fields: ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(", ")}`,
            });
            matched = true;
          }
        }
      }

      // 3. Fall back to filename search
      if (!matched && f.fileName.toLowerCase().includes(qLc)) {
        results.push({
          ...base,
          matchType: "filename",
          excerpt: f.fileName,
        });
      }
    }

    res.json({ results, query: q, total: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    res.status(500).json({ error: message });
  }
});

// ─── POST /projects/:projectId/documents/ai-search ────────────────────────────
// AI Report Assistant — answers questions about project documents
router.post("/projects/:projectId/documents/ai-search", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const { question } = req.body as { question: string };

    if (!question?.trim()) {
      res.status(400).json({ error: "question is required" });
      return;
    }

    const allFiles = await db.query.filesTable.findMany({
      where: eq(filesTable.projectId, projectId),
    });

    // Build document context from extracted text and metadata
    const docContext: string[] = [];
    const relevantFiles: SearchResult[] = [];

    for (const f of allFiles) {
      const uploaderRows = await db.select().from(usersTable).where(eq(usersTable.id, f.uploadedById)).limit(1);
      const uploadedByName = uploaderRows[0]?.fullName || "";
      const uploadedAt = f.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      let context = `FILE: ${f.fileName}\nUploaded by: ${uploadedByName} on ${uploadedAt}\nType: ${f.fileType}`;

      if (f.extractedText) {
        // Include first 2000 chars of PDF text for context
        const snippet = f.extractedText.slice(0, 2000);
        context += `\nPDF Content (excerpt):\n${snippet}`;
        relevantFiles.push({
          id: f.id, fileName: f.fileName, fileType: f.fileType,
          uploadedByName, uploadedAt: f.createdAt.toISOString(),
          matchType: "pdf_content",
          excerpt: excerptText(f.extractedText, question, 200),
        });
      }

      if (f.fileMetadata) {
        const meta = f.fileMetadata as Record<string, unknown>;
        const fields = meta.fields as Record<string, string> | undefined;
        if (fields) {
          context += `\nBIM Metadata: ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(", ")}`;
          if (!relevantFiles.find(r => r.id === f.id)) {
            relevantFiles.push({
              id: f.id, fileName: f.fileName, fileType: f.fileType,
              uploadedByName, uploadedAt: f.createdAt.toISOString(),
              matchType: "bim_metadata",
              fileMetadata: meta,
              excerpt: `Fields: ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(", ")}`,
            });
          }
        }
      }

      docContext.push(context);
    }

    const systemPrompt = `You are an AI Report Assistant for BIMLog by IgniteSmart, a BIM project coordination platform.
You have access to project documents, including extracted PDF text and BIM file metadata parsed from file names according to the project's naming convention.
Answer questions about project documents clearly and precisely. Reference specific file names when possible.
If you don't find relevant information in the documents, say so clearly.`;

    const userPrompt = `Project has ${allFiles.length} document(s).

DOCUMENT CONTENTS:
${docContext.length > 0 ? docContext.join("\n\n---\n\n") : "No indexed document content available yet."}

USER QUESTION: ${question}

Answer the question based on the document contents above. Include specific file references.`;

    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const block = message.content[0];
    const answer = block.type === "text" ? block.text : "No response generated.";

    res.json({ answer, relevantFiles, totalFiles: allFiles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI search failed";
    res.status(500).json({ error: message });
  }
});

export default router;
