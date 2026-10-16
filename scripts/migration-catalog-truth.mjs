import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function buildMigrationCatalog({ files, startupSource }) {
  const migrations = files.map(({ name, source }) => ({
    name,
    sha256: sha256(source),
    startupReferenced: startupSource.includes(name.replace(/\.ts$/, "")),
    destructiveToken: /\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE)\b/i.test(source),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    schemaVersion: "bimlog-migration-catalog-v1",
    catalogSha256: sha256(JSON.stringify(migrations)),
    migrations,
    missingStartupReferences: migrations.filter((entry) => !entry.startupReferenced).map((entry) => entry.name),
    destructiveMigrations: migrations.filter((entry) => entry.destructiveToken).map((entry) => entry.name),
  };
}

export function readMigrationCatalog(root) {
  const sourceRoot = path.join(root, "artifacts", "api-server", "src");
  const lib = path.join(sourceRoot, "lib");
  const files = fs.readdirSync(lib).filter((name) => name.endsWith("-migration.ts")).map((name) => ({ name, source: fs.readFileSync(path.join(lib, name), "utf8") }));
  const collect = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(full);
    if (!entry.name.endsWith(".ts") || entry.name.includes(".behavior.") || entry.name.endsWith("-migration.ts")) return [];
    return [fs.readFileSync(full, "utf8")];
  });
  return buildMigrationCatalog({ files, startupSource: collect(sourceRoot).join("\n") });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const catalog = readMigrationCatalog(root);
  console.log(JSON.stringify(catalog, null, 2));
  if (catalog.missingStartupReferences.length || catalog.destructiveMigrations.length) process.exitCode = 1;
}
