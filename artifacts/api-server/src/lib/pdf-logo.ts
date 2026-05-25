import { db } from "@workspace/db";
import { companyProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function getCompanyLogo(userId: number): Promise<{ logoBase64: Buffer | null; logoType: "png" | "jpeg" | null }> {
  try {
    const [profile] = await db.select({ logoUrl: companyProfilesTable.logoUrl })
      .from(companyProfilesTable)
      .where(eq(companyProfilesTable.userId, userId));
    if (!profile?.logoUrl) return { logoBase64: null, logoType: null };
    const dataUrl = profile.logoUrl;
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!match) return { logoBase64: null, logoType: null };
    const type = match[1] === "jpg" ? "jpeg" : match[1] as "png" | "jpeg";
    const buffer = Buffer.from(match[2], "base64");
    return { logoBase64: buffer, logoType: type };
  } catch (err) {
    console.error("[pdf-logo] failed:", err);
    return { logoBase64: null, logoType: null };
  }
}
