import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const expectedIndexes = [
  ["launch_configuration_audit", "launch_configuration_audit_time_idx"],
  ["launch_email_verification_audit", "launch_email_verification_audit_time_idx"],
  ["launch_payment_verification_audit", "launch_payment_verification_audit_time_idx"],
];

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

const normalize = (value) => String(value).replaceAll('"', "").replace(/\bpublic\./gi, "").replace(/\s+/g, " ").trim().toLowerCase();
const expectedDefinition = (table, index) => normalize(`CREATE INDEX ${index} ON public.${table} USING btree (environment, created_at DESC)`);

async function readDefinitions(client) {
  const result = await client.query(`SELECT tablename table_name,indexname name,indexdef definition FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1::text[]) ORDER BY indexname`, [expectedIndexes.map(([, name]) => name)]);
  return new Map(result.rows.map((row) => [row.name, row]));
}

export async function main() {
  validateTargets();
  const production = new pg.Client({ connectionString: process.env.PROD_DATABASE_URL, statement_timeout: 15000 });
  const development = new pg.Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 15000 });
  await production.connect(); await development.connect();
  try {
    await production.query("BEGIN READ ONLY");
    const productionDefinitions = await readDefinitions(production);
    for (const [table, name] of expectedIndexes) {
      const row = productionDefinitions.get(name);
      if (!row || row.table_name !== table || normalize(row.definition) !== expectedDefinition(table, name)) throw new Error(`Safety refusal: production index ${table}.${name} is not the expected canonical definition`);
    }
    await production.query("COMMIT");

    await development.query("BEGIN");
    await development.query("SELECT pg_advisory_xact_lock(hashtext('bimlog-development-launch-audit-index-reconciliation'))");
    for (const [table, name] of expectedIndexes) {
      await development.query(`DROP INDEX IF EXISTS public."${name}"`);
      await development.query(`CREATE INDEX "${name}" ON public."${table}" USING btree ("environment", "created_at" DESC)`);
    }
    const developmentDefinitions = await readDefinitions(development);
    for (const [table, name] of expectedIndexes) {
      const developmentRow = developmentDefinitions.get(name), productionRow = productionDefinitions.get(name);
      if (!developmentRow || developmentRow.table_name !== table || normalize(developmentRow.definition) !== normalize(productionRow.definition)) throw new Error(`Development index reconciliation failed for ${table}.${name}`);
    }
    await development.query("COMMIT");
    console.log("Development launch-audit index reconciliation: passed (3 canonical DESC indexes; production read-only).");
  } catch (error) {
    await development.query("ROLLBACK").catch(() => undefined);
    await production.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { await production.end(); await development.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exit(1); });
