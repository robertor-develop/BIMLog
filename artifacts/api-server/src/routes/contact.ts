import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable } from "@workspace/db/schema";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const { fullName, email, companyName, country, interest, message } = req.body as {
      fullName?: string; email?: string; companyName?: string;
      country?: string; interest?: string; message?: string;
    };
    if (!fullName || !email || !companyName || !country || !interest || !message) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }
    await db.insert(contactSubmissionsTable).values({ fullName, email: email.toLowerCase(), companyName, country, interest, message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to submit" });
  }
});

export default router;
