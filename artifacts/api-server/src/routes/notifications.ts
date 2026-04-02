import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: Router = Router();

// ── Helper: createNotification ────────────────────────────────────────────────
export async function createNotification(
  userId: number,
  projectId: number | null,
  type: string,
  title: string,
  message: string,
  actionUrl?: string | null
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId,
      projectId: projectId ?? null,
      type,
      title,
      message,
      isRead: false,
      actionUrl: actionUrl ?? null,
    });
  } catch {
    // non-fatal
  }
}

// ── GET /notifications ────────────────────────────────────────────────────────
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /notifications/read-all ─────────────────────────────────────────────
router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.user!.userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /notifications/:id/read ─────────────────────────────────────────────
router.patch("/notifications/:id/read", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── DELETE /notifications/:id ─────────────────────────────────────────────────
router.delete("/notifications/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db
      .delete(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
