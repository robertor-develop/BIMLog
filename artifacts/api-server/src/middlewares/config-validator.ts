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

export async function getDefaultValue(category: string): Promise<string> {
  const values = await getValidValues(category);
  if (values.length === 0) {
    throw new Error(`No config options found for category '${category}'. Seed the config_options table.`);
  }
  return values[0];
}

const metaCache = new Map<string, { meta: Record<string, string> | null, expiresAt: number }>();

export async function getConfigOptionMeta(category: string, value: string): Promise<Record<string, string> | null> {
  const cacheKey = `meta:${category}:${value}`;
  const now = Date.now();
  const cached = metaCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.meta;
  }

  const rows = await db
    .select({ value: configOptionsTable.value, meta: configOptionsTable.meta })
    .from(configOptionsTable)
    .where(eq(configOptionsTable.category, category));

  const row = rows.find(r => r.value === value);
  const meta = (row?.meta as Record<string, string> | null) || null;
  metaCache.set(cacheKey, { meta, expiresAt: now + CACHE_TTL });
  return meta;
}

const permissionCache = new Map<string, { roles: string[], expiresAt: number }>();

export async function getRolesByPermission(...permissionLevels: string[]): Promise<string[]> {
  const cacheKey = `perm:${permissionLevels.sort().join(',')}`;
  const now = Date.now();
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.roles;
  }

  const rows = await db
    .select({ value: configOptionsTable.value, meta: configOptionsTable.meta })
    .from(configOptionsTable)
    .where(eq(configOptionsTable.category, 'member_role'));

  const roles = rows
    .filter(r => {
      const perm = (r.meta as Record<string, string> | null)?.permission;
      return perm && permissionLevels.includes(perm);
    })
    .map(r => r.value);

  permissionCache.set(cacheKey, { roles, expiresAt: now + CACHE_TTL });
  return roles;
}
