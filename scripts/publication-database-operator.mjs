import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifySchemaInventory, readDatabaseInventory, sourceSchemaReceipt } from "./database-schema-receipt.mjs";
import { createMigrationPreviewReceipt } from "./migration-preview-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function evaluatePublicationDatabases(source, development, production) {
  const developmentPreview = createMigrationPreviewReceipt(source, development);
  const productionPreview = createMigrationPreviewReceipt(source, production);
  const schemaAction = developmentPreview.status === "ZERO_PENDING" && productionPreview.status === "ZERO_PENDING"
    ? "NONE"
    : "STOP_COMPLETE_PREVIEW_AND_RESTORE_PROOF_REQUIRED";
  return { developmentPreview, productionPreview, schemaAction, publishable: schemaAction === "NONE" };
}

function git(args) {
  return execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "-C", root, ...args], { encoding: "utf8", windowsHide: true }).trim();
}

async function main() {
  const developmentUrl = process.env.DATABASE_URL;
  const productionUrl = process.env.PROD_DATABASE_URL;
  if (!developmentUrl || !productionUrl) throw new Error("DATABASE_URL and PROD_DATABASE_URL are required for publication database proof.");
  const source = sourceSchemaReceipt();
  const [development, production] = await Promise.all([
    readDatabaseInventory(developmentUrl),
    readDatabaseInventory(productionUrl),
  ]);
  const decision = evaluatePublicationDatabases(source, development, production);
  const head = git(["rev-parse", "HEAD"]).toLowerCase();
  const tree = git(["rev-parse", "HEAD^{tree}"]).toLowerCase();
  const payload = {
    schemaVersion: "bimlog-publication-database-receipt-v1",
    source: { commit: head, tree, contractSha256: source.sourceContractSha256 },
    database: {
      development: { name: development.identity.database, classification: classifySchemaInventory(source, development) },
      production: { name: production.identity.database, classification: classifySchemaInventory(source, production) },
      schemaAction: decision.schemaAction,
    },
    publishable: decision.publishable,
    developmentDataCopy: "OFF_REQUIRED",
  };
  const receipt = { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error("--output requires a path");
    fs.writeFileSync(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  }
  console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.publishable) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
