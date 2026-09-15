import process from "node:process";
import pg from "pg";

function connectionIdentity(rawUrl) {
  const url = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) throw new Error("Safety refusal: database connection identity is invalid");
  return { hostname: url.hostname.toLowerCase(), identity: `${url.hostname.toLowerCase()}/${url.pathname.replace(/^\/+/, "").toLowerCase()}` };
}

export function validateTargets(environment = process.env) {
  if (environment.BIMLOG_SCHEMA_TARGET !== "development") throw new Error("Safety refusal: BIMLOG_SCHEMA_TARGET=development is required");
  if (!environment.DATABASE_URL || !environment.PROD_DATABASE_URL) throw new Error("Safety refusal: both database identities are required");
  const development = connectionIdentity(environment.DATABASE_URL), production = connectionIdentity(environment.PROD_DATABASE_URL);
  if (!development.hostname.includes("helium")) throw new Error("Safety refusal: reconciliation is restricted to Replit Helium");
  if (development.identity === production.identity) throw new Error("Safety refusal: development resolves to production");
}

const normalizedConstraint = (value) => String(value).replaceAll('"', "").replace(/\bpublic\./gi, "").replace(/\s+/g, " ").trim().toLowerCase();
const normalizedIndex = (value) => String(value).replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+\S+\s+/i, "CREATE $1INDEX ").replaceAll('"', "").replace(/\bpublic\./gi, "").replace(/\s+/g, " ").trim().toLowerCase();
const identifier = (value) => {
  const text = String(value);
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(text)) throw new Error(`Unsafe PostgreSQL identifier: ${text}`);
  return `"${text}"`;
};

async function inventory(client) {
  const constraints = (await client.query(`SELECT t.relname table_name,c.conname name,pg_get_constraintdef(c.oid,true) definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' ORDER BY t.relname,c.conname`)).rows;
  const indexes = (await client.query(`SELECT tablename table_name,indexname name,indexdef definition FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`)).rows;
  return { constraints, indexes };
}

export function reconciliationPlan(development, production) {
  const plan = [];
  const devConstraints = Map.groupBy(development.constraints, (row) => `${row.table_name}|${normalizedConstraint(row.definition)}`);
  const prodConstraints = Map.groupBy(production.constraints, (row) => `${row.table_name}|${normalizedConstraint(row.definition)}`);
  for (const [key, expected] of prodConstraints) {
    const available = [...(devConstraints.get(key) ?? [])];
    for (const row of expected) {
      const exactIndex = available.findIndex((match) => match.name === row.name);
      if (exactIndex >= 0) available.splice(exactIndex, 1);
    }
    for (const row of expected) {
      const alreadyPresent = (devConstraints.get(key) ?? []).some((match) => match.name === row.name);
      if (alreadyPresent) continue;
      const candidate = available.shift();
      if (candidate) plan.push({ kind: "constraint", tableName: row.table_name, from: candidate.name, to: row.name });
    }
    for (const duplicate of available) {
      plan.push({ kind: "drop_redundant_constraint", tableName: duplicate.table_name, name: duplicate.name });
    }
  }
  const devIndexes = new Map(development.indexes.map((row) => [`${row.table_name}|${normalizedIndex(row.definition)}`, row]));
  for (const row of production.indexes) {
    const match = devIndexes.get(`${row.table_name}|${normalizedIndex(row.definition)}`);
    if (match && match.name !== row.name) plan.push({ kind: "index", tableName: row.table_name, from: match.name, to: row.name });
  }
  return plan;
}

export async function main() {
  validateTargets();
  const production = new pg.Client({ connectionString: process.env.PROD_DATABASE_URL, statement_timeout: 15000 });
  const development = new pg.Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 15000 });
  await production.connect(); await development.connect();
  try {
    await production.query("BEGIN READ ONLY");
    const productionInventory = await inventory(production);
    await production.query("COMMIT");
    await development.query("BEGIN");
    const developmentInventory = await inventory(development);
    const completePlan = reconciliationPlan(developmentInventory, productionInventory);
    const plan = process.argv.includes("--duplicates-only")
      ? completePlan.filter((item) => item.kind === "drop_redundant_constraint")
      : completePlan;
    for (const item of plan) {
      if (item.kind === "constraint") await development.query(`ALTER TABLE ${identifier(item.tableName)} RENAME CONSTRAINT ${identifier(item.from)} TO ${identifier(item.to)}`);
      else if (item.kind === "drop_redundant_constraint") await development.query(`ALTER TABLE ${identifier(item.tableName)} DROP CONSTRAINT ${identifier(item.name)}`);
      else await development.query(`ALTER INDEX ${identifier(item.from)} RENAME TO ${identifier(item.to)}`);
    }
    await development.query("COMMIT");
    console.log(`Development schema name reconciliation: passed (${plan.length} equivalent objects renamed; production read-only).`);
  } catch (error) {
    await development.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { await production.end(); await development.end(); }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exit(1); });
