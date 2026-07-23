import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDirectory = path.join(root, "lib", "db", "src", "schema");
const schemaIndexPath = path.join(schemaDirectory, "index.ts");
const productionMigrationRoots = [
  path.join(root, "artifacts", "api-server", "src", "app.ts"),
  path.join(root, "artifacts", "api-server", "src", "lib"),
];
const authoritativeRemoteIdentity = "github.com/robertor-develop/BIMLog";

const destructiveRules = [
  ["DROP TABLE", /\bDROP\s+TABLE\b/i],
  ["DROP COLUMN", /\bDROP\s+COLUMN\b/i],
  ["DROP DATABASE", /\bDROP\s+DATABASE\b/i],
  ["DROP DOMAIN", /\bDROP\s+DOMAIN\b/i],
  ["DROP FUNCTION", /\bDROP\s+FUNCTION\b/i],
  ["DROP MATERIALIZED VIEW", /\bDROP\s+MATERIALIZED\s+VIEW\b/i],
  ["DROP PROCEDURE", /\bDROP\s+PROCEDURE\b/i],
  ["DROP ROLE", /\bDROP\s+ROLE\b/i],
  ["DROP SCHEMA", /\bDROP\s+SCHEMA\b/i],
  ["DROP SEQUENCE", /\bDROP\s+SEQUENCE\b/i],
  ["DROP TRIGGER", /\bDROP\s+TRIGGER\b/i],
  ["DROP TYPE", /\bDROP\s+TYPE\b/i],
  ["DROP VIEW", /\bDROP\s+VIEW\b/i],
  ["DROP OWNED", /\bDROP\s+OWNED\b/i],
  ["TRUNCATE", /\bTRUNCATE\b/i],
  ["CASCADE", /\bCASCADE\b/i],
  ["DISABLE ROW LEVEL SECURITY", /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i],
  ["SET ROW_SECURITY OFF", /\bSET\s+(?:LOCAL\s+|SESSION\s+)?ROW_SECURITY\s*=\s*OFF\b/i],
  ["DROP POLICY", /\bDROP\s+POLICY\b/i],
  ["DROP CONSTRAINT", /\bDROP\s+CONSTRAINT\b/i],
  ["DROP INDEX", /\bDROP\s+INDEX\b/i],
];

const exactSourceAllowlist = new Map([
  [
    "artifacts/api-server/src/app.ts",
    new Set([
      "ALTER TABLE lens_viewpoints DROP CONSTRAINT IF EXISTS lens_viewpoints_project_id_viewpoint_id_key",
      "DROP INDEX IF EXISTS lens_viewpoints_project_guid_unique",
    ]),
  ],
  [
    "artifacts/api-server/src/lib/ai-control-plane-migration.ts",
    new Set([
      "ALTER TABLE company_ai_budgets DROP CONSTRAINT IF EXISTS company_ai_budgets_company_id_version_key",
      "ALTER TABLE ai_runs DROP CONSTRAINT IF EXISTS ai_runs_status_chk",
    ]),
  ],
  [
    "artifacts/api-server/src/lib/telegram-product.ts",
    new Set([
      "ALTER TABLE telegram_support_cases DROP CONSTRAINT IF EXISTS telegram_support_cases_status_chk",
    ]),
  ],
]);

function normalizeRelative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function isProductionMigrationFile(filePath) {
  const relative = normalizeRelative(filePath);
  return (
    filePath.endsWith(".ts") &&
    !relative.includes("/scripts/") &&
    !relative.includes("/tests/") &&
    !relative.endsWith(".behavior.ts") &&
    !relative.endsWith(".test.ts") &&
    !relative.endsWith(".spec.ts")
  );
}

function stripAllowedSourceStatements(relativePath, sql) {
  const allowed = exactSourceAllowlist.get(relativePath);
  if (!allowed) return sql;
  let result = sql;
  for (const statement of allowed) result = result.replaceAll(statement, "");
  return result;
}

function stripSqlComments(source) {
  let result = "";
  let quote = null;
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (quote) {
      result += current;
      if (current === quote) {
        if (next === quote) {
          result += next;
          index += 2;
          continue;
        }
        quote = null;
      }
      index += 1;
      continue;
    }
    if (current === "'" || current === '"') {
      quote = current;
      result += current;
      index += 1;
      continue;
    }
    if (current === "-" && next === "-") {
      result += "  ";
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        result += " ";
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      result += "  ";
      index += 2;
      let depth = 1;
      while (index < source.length && depth > 0) {
        const blockCurrent = source[index];
        const blockNext = source[index + 1];
        if (blockCurrent === "/" && blockNext === "*") {
          depth += 1;
          result += "  ";
          index += 2;
        } else if (blockCurrent === "*" && blockNext === "/") {
          depth -= 1;
          result += "  ";
          index += 2;
        } else {
          result += blockCurrent === "\n" ? "\n" : " ";
          index += 1;
        }
      }
      continue;
    }
    result += current;
    index += 1;
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error("Source attestation failed while reading sanitized Git state");
  }
}

function repositoryIdentity(rawRemote) {
  const scpLike = rawRemote.match(/^[^@]+@([^:]+):(.+)$/);
  if (scpLike) {
    return `${scpLike[1].toLowerCase()}/${scpLike[2].replace(/\.git$/i, "")}`;
  }
  try {
    const parsed = new URL(rawRemote);
    return `${parsed.hostname.toLowerCase()}/${parsed.pathname
      .replace(/^\/+/, "")
      .replace(/\.git$/i, "")}`;
  } catch {
    throw new Error("Source attestation refused an unrecognized origin URL");
  }
}

export function attestSource() {
  const originIdentity = repositoryIdentity(git(["remote", "get-url", "origin"]));
  if (originIdentity !== authoritativeRemoteIdentity) {
    throw new Error("Source attestation refused an unexpected origin repository");
  }

  const remoteResult = git(["ls-remote", "--exit-code", "origin", "refs/heads/master"]);
  const remoteMatch = remoteResult.match(/^([0-9a-f]{40})\s+refs\/heads\/master$/i);
  if (!remoteMatch) throw new Error("Source attestation could not resolve authoritative master");
  const remoteMaster = remoteMatch[1].toLowerCase();
  const trackedMaster = git(["rev-parse", "refs/remotes/origin/master"]).toLowerCase();
  const head = git(["rev-parse", "HEAD"]).toLowerCase();
  const explicitAccepted = process.env.BIMLOG_ACCEPTED_COMMIT?.toLowerCase();
  if (explicitAccepted && !/^[0-9a-f]{40}$/.test(explicitAccepted)) {
    throw new Error("BIMLOG_ACCEPTED_COMMIT must be a full 40-character commit");
  }
  const acceptedCommit = explicitAccepted ?? remoteMaster;
  if (head !== acceptedCommit || trackedMaster !== acceptedCommit || remoteMaster !== acceptedCommit) {
    throw new Error(
      "Source attestation refused stale or divergent source; HEAD, origin/master, remote master, and the accepted commit must match",
    );
  }

  const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (branch !== "master") {
    throw new Error("Source attestation requires the authoritative master branch");
  }
  if (git(["status", "--porcelain", "--untracked-files=all"])) {
    throw new Error("Source attestation requires a clean workspace");
  }
  return {
    acceptedCommit,
    tree: git(["rev-parse", "HEAD^{tree}"]).toLowerCase(),
  };
}

export function analyzeSql(sql, label = "SQL", options = {}) {
  const violations = [];
  const executableSql = options.sourceContainer
    ? sql.replace(/\/\*[\s\S]*?\*\//g, " ")
    : stripSqlComments(sql);
  for (const [name, pattern] of destructiveRules) {
    if (pattern.test(executableSql)) violations.push(`${label}: ${name}`);
  }
  return violations;
}

export function collectSchemaContract() {
  const indexSource = fs.readFileSync(schemaIndexPath, "utf8");
  const tables = new Set();
  const indexes = new Set();
  const missingExports = [];

  for (const filePath of walk(schemaDirectory).filter((file) => file.endsWith(".ts") && file !== schemaIndexPath)) {
    const source = fs.readFileSync(filePath, "utf8");
    const fileTables = [...source.matchAll(/\bpgTable\(\s*["'`]([^"'`]+)["'`]/g)].map(
      (match) => match[1],
    );
    for (const table of fileTables) tables.add(table);
    for (const match of source.matchAll(/\b(?:uniqueIndex|index)\(\s*["'`]([^"'`]+)["'`]/g)) {
      indexes.add(match[1]);
    }
    if (fileTables.length > 0) {
      const basename = path.basename(filePath, ".ts");
      const exportPattern = new RegExp(
        `export\\s+\\*\\s+from\\s+["']\\./${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      );
      if (!exportPattern.test(indexSource)) missingExports.push(basename);
    }
  }

  return {
    tables: [...tables].sort(),
    indexes: [...indexes].sort(),
    missingExports: missingExports.sort(),
  };
}

export function runStaticGate() {
  const violations = [];
  const contract = collectSchemaContract();
  const startupTables = new Set();
  if (contract.missingExports.length > 0) {
    violations.push(
      `Drizzle schema files missing from schema/index.ts: ${contract.missingExports.join(", ")}`,
    );
  }

  const sourceFiles = productionMigrationRoots.flatMap((entry) =>
    fs.statSync(entry).isDirectory() ? walk(entry) : [entry],
  );
  for (const filePath of sourceFiles.filter(isProductionMigrationFile)) {
    const relative = normalizeRelative(filePath);
    const source = stripAllowedSourceStatements(relative, fs.readFileSync(filePath, "utf8"));
    for (const match of source.matchAll(
      /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:(?:"?public"?)\.)?["'`]?([a-zA-Z0-9_]+)/gi,
    )) {
      startupTables.add(match[1]);
    }
    violations.push(...analyzeSql(source, relative, { sourceContainer: true }));
  }

  const missingStartupDeclarations = [...startupTables]
    .filter((table) => !contract.tables.includes(table))
    .sort();
  if (missingStartupDeclarations.length > 0) {
    violations.push(
      `Startup-created tables missing from Drizzle schema: ${missingStartupDeclarations.join(", ")}`,
    );
  }

  return { contract, startupTables: [...startupTables].sort(), violations };
}

function sourceContractSha256(result) {
  return sha256(
    JSON.stringify({
      tables: result.contract.tables,
      indexes: result.contract.indexes,
      startupTables: result.startupTables,
    }),
  );
}

function splitPreviewStatements(sql) {
  return stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function isAdditiveStatement(statement) {
  return [
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
    /^CREATE\s+TABLE\b/i,
    /^CREATE\s+(?:DOMAIN|FUNCTION|POLICY|PROCEDURE|SEQUENCE|TRIGGER|TYPE|VIEW)\b/i,
    /^ALTER\s+TABLE\b[\s\S]*\bADD\b/i,
    /^ALTER\s+TABLE\b[\s\S]*\b(?:ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY\b/i,
    /^ALTER\s+TYPE\b[\s\S]*\bADD\s+VALUE\b/i,
  ].some((pattern) => pattern.test(statement));
}

function validatePreviewInventory(previewSql, previewPath, source, attestation) {
  const statements = splitPreviewStatements(previewSql);
  const previewHash = sha256(previewSql);
  if (statements.length === 0) {
    return { previewHash, statementCount: 0 };
  }

  const inventoryIndex = process.argv.indexOf("--additive-inventory");
  const inventoryPath = inventoryIndex >= 0 ? process.argv[inventoryIndex + 1] : null;
  if (!inventoryPath) {
    throw new Error("A non-empty preview requires --additive-inventory");
  }
  const inventory = JSON.parse(fs.readFileSync(path.resolve(inventoryPath), "utf8"));
  const expectedStatementHashes = statements.map((statement) => sha256(statement));
  if (
    inventory.completePreview !== true ||
    inventory.acceptedCommit !== attestation.acceptedCommit ||
    inventory.sourceContractSha256 !== sourceContractSha256(source) ||
    inventory.previewSha256 !== previewHash ||
    !Array.isArray(inventory.additiveStatementSha256) ||
    JSON.stringify(inventory.additiveStatementSha256) !== JSON.stringify(expectedStatementHashes)
  ) {
    throw new Error("Preview inventory is incomplete or does not match source and SQL exactly");
  }
  if (
    inventory.backupRestorePointVerified !== true ||
    !/^[0-9a-f]{64}$/i.test(inventory.preRecordCountManifestSha256 ?? "") ||
    inventory.postRecordCountVerificationRequired !== true
  ) {
    throw new Error("Preview inventory lacks the mandatory recovery and record-count evidence");
  }
  const nonAdditive = statements.filter((statement) => !isAdditiveStatement(statement));
  if (nonAdditive.length > 0) {
    throw new Error("Preview inventory contains a statement that is not explicitly additive");
  }
  return { previewHash, statementCount: statements.length };
}

function printFailure(violations) {
  console.error("Database safety gate FAILED:");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("No push or publication may proceed until every item is reviewed and removed.");
}

function main() {
  const previewIndex = process.argv.indexOf("--preview");
  if (previewIndex >= 0) {
    const previewPath = process.argv[previewIndex + 1];
    if (!previewPath) throw new Error("--preview requires a generated SQL file path");
    if (!process.argv.includes("--complete-preview")) {
      throw new Error("Preview validation requires --complete-preview after complete-log review");
    }
    const attestation = attestSource();
    const source = runStaticGate();
    if (source.violations.length > 0) {
      printFailure(source.violations);
      process.exit(1);
    }
    const previewSql = fs.readFileSync(path.resolve(previewPath), "utf8");
    const violations = analyzeSql(previewSql, path.basename(previewPath));
    if (violations.length > 0) {
      printFailure(violations);
      process.exit(1);
    }
    const preview = validatePreviewInventory(previewSql, previewPath, source, attestation);
    console.log(
      `Database migration preview safety: passed (${preview.statementCount} explicitly inventoried additive statements; source ${attestation.acceptedCommit}; contract ${sourceContractSha256(source)}; preview ${preview.previewHash}).`,
    );
    return;
  }

  const result = runStaticGate();
  if (result.violations.length > 0) {
    printFailure(result.violations);
    process.exit(1);
  }
  console.log(
    `Database source safety: passed (${result.contract.tables.length} tables, ${result.contract.indexes.length} indexes, ${result.startupTables.length} startup tables reconciled, all schema files exported).`,
  );
  if (process.argv.includes("--attest-source")) {
    const attestation = attestSource();
    console.log(
      `Publication source attestation: passed (${attestation.acceptedCommit}; tree ${attestation.tree}; contract ${sourceContractSha256(result)}).`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
