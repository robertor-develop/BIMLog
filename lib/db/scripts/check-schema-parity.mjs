import fs from "node:fs";
import path from "node:path";
import process from "node:process";
const packageRoot = path.resolve(import.meta.dirname, "..");
const schemaDirectory = path.join(packageRoot, "src", "schema");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function expectedObjects() {
  const tables = new Set();
  const indexes = new Set();
  for (const filePath of walk(schemaDirectory).filter((file) => file.endsWith(".ts"))) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/\bpgTable\(\s*["'`]([^"'`]+)["'`]/g)) tables.add(match[1]);
    for (const match of source.matchAll(/\b(?:uniqueIndex|index)\(\s*["'`]([^"'`]+)["'`]/g)) {
      indexes.add(match[1]);
    }
  }
  return { tables: [...tables].sort(), indexes: [...indexes].sort() };
}

function connectionIdentity(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) {
      throw new Error();
    }
    return {
      hostname: url.hostname.toLowerCase(),
      identity: `${url.hostname.toLowerCase()}/${url.pathname
        .replace(/^\/+/, "")
        .toLowerCase()}`,
    };
  } catch {
    throw new Error("Safety refusal: database connection identity is invalid");
  }
}

async function main() {
  const expected = expectedObjects();
  if (process.argv.includes("--inventory-only")) {
    console.log(
      `Database schema inventory: ${expected.tables.length} tables, ${expected.indexes.length} indexes.`,
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (process.env.BIMLOG_SCHEMA_TARGET !== "development") {
    throw new Error("BIMLOG_SCHEMA_TARGET=development is required for the parity gate");
  }
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the Replit development-schema parity gate");
  if (!process.env.PROD_DATABASE_URL) {
    throw new Error("PROD_DATABASE_URL is required for the parity identity comparison");
  }
  const development = connectionIdentity(databaseUrl);
  const production = connectionIdentity(process.env.PROD_DATABASE_URL);
  if (!development.hostname.includes("helium")) {
    throw new Error("Safety refusal: parity inspection is restricted to Replit Helium");
  }
  if (development.identity === production.identity) {
    throw new Error("Safety refusal: DATABASE_URL resolves to the configured production database");
  }

  const { default: pg } = await import("pg");
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl, statement_timeout: 15_000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const tableResult = await client.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`,
    );
    const indexResult = await client.query(
      `SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname='public'`,
    );
    await client.query("COMMIT");

    const actualTables = new Set(tableResult.rows.map((row) => row.tablename));
    const actualIndexes = new Set(indexResult.rows.map((row) => row.indexname));
    const missingTables = expected.tables.filter((name) => !actualTables.has(name));
    const missingIndexes = expected.indexes.filter((name) => !actualIndexes.has(name));

    if (missingTables.length || missingIndexes.length) {
      console.error("Replit development-schema parity FAILED.");
      if (missingTables.length) console.error(`Missing tables: ${missingTables.join(", ")}`);
      if (missingIndexes.length) console.error(`Missing indexes: ${missingIndexes.join(", ")}`);
      console.error("Do not open or approve the Publish migration preview.");
      process.exitCode = 1;
      return;
    }

    console.log(
      `Replit development-schema parity: passed (${expected.tables.length} tables, ${expected.indexes.length} indexes).`,
    );
  } finally {
    await client.end();
  }
}

await main();
