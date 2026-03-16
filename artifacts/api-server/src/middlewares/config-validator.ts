import { db } from "@workspace/db";
import { configOptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const cache = new Map<string, { values: string[], expiresAt: number }>();
const CACHE_TTL = 60_000;

export async function getValidValues(category: string): Promise<string[]> {
  const now = Date.now();
  const cached = cache.get(category);
  if (cached && cached.expiresAt > now) {
    return cached.values;
  }

  const rows = await db
    .select({ value: configOptionsTable.value })
    .from(configOptionsTable)
    .where(eq(configOptionsTable.category, category));

  const values = rows.map(r => r.value);
  cache.set(category, { values, expiresAt: now + CACHE_TTL });
  return values;
}

export async function validateConfigValue(category: string, value: string): Promise<boolean> {
  const validValues = await getValidValues(category);
  return validValues.includes(value);
}
