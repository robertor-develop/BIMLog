"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
  return false;
}

function preflight(environment = process.env) {
  if (environment.NODE_ENV !== "production") return true;

  const backend = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND;
  if (backend === "replit-app-storage") return true;
  if (backend !== "durable-filesystem") {
    return fail("FEEDBACK_DURABLE_STORAGE_REQUIRED");
  }

  const backendId = environment.BIMLOG_FEEDBACK_STORAGE_BACKEND_ID;
  const dataRoot = environment.BIMLOG_FEEDBACK_UPLOAD_ROOT;
  const manifestPath = environment.BIMLOG_FEEDBACK_STORAGE_AUTHORITY_MANIFEST;
  const expectedSha256 = environment.BIMLOG_FEEDBACK_STORAGE_AUTHORITY_SHA256;
  if (!backendId || !dataRoot || !manifestPath) {
    return fail("FEEDBACK_STORAGE_AUTHORITY_REQUIRED");
  }

  const resolvedRoot = path.resolve(dataRoot);
  const resolvedManifest = path.resolve(manifestPath);
  if (
    resolvedManifest === resolvedRoot ||
    resolvedManifest.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    return fail("FEEDBACK_STORAGE_AUTHORITY_REQUIRED");
  }

  let bytes;
  try {
    bytes = fs.readFileSync(resolvedManifest);
  } catch {
    return fail("FEEDBACK_STORAGE_AUTHORITY_INVALID");
  }
  const actualSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 || "") || actualSha256 !== expectedSha256) {
    return fail("FEEDBACK_STORAGE_AUTHORITY_INVALID");
  }
  return true;
}

if (preflight()) require("./index.cjs");
