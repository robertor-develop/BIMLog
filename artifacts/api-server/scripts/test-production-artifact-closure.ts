import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const runtimeRoot = path.resolve("dist/runtime");
const bundle = path.join(runtimeRoot, "dist/index.cjs");
const metafile = path.join(runtimeRoot, "dist/index.meta.json");
assert(fs.existsSync(bundle), "Production artifact bundle is missing.");
assert(fs.existsSync(metafile), "Production artifact metafile is missing.");

const deploymentSource = JSON.parse(
  fs.readFileSync(path.join(runtimeRoot, "deployment-source.json"), "utf8"),
) as {
  schemaVersion: number;
  sourceCommit: string;
  livingBriefCatalogSha256: string;
  livingBriefBundleSha256: string;
};
assert.equal(deploymentSource.schemaVersion, 1);
assert.match(deploymentSource.sourceCommit, /^[0-9a-f]{40}$/);
assert.match(deploymentSource.livingBriefCatalogSha256, /^[0-9a-f]{64}$/);
assert.match(deploymentSource.livingBriefBundleSha256, /^[0-9a-f]{64}$/);
const packagedLivingBriefRoot = path.join(runtimeRoot, "living-brief");
const packagedCatalog = JSON.parse(
  fs.readFileSync(path.join(packagedLivingBriefRoot, "catalog.json"), "utf8"),
) as { documents: Array<{ key: string; file: string }> };
const packagedState = JSON.parse(
  fs.readFileSync(path.join(packagedLivingBriefRoot, "state.json"), "utf8"),
) as { documents: Array<{ key: string; file: string; sha256: string }> };
assert.equal(packagedCatalog.documents.length, 11);
assert.equal(packagedState.documents.length, 11);
for (const document of packagedCatalog.documents) {
  const metadata = packagedState.documents.find(
    (entry) => entry.key === document.key,
  );
  assert(metadata && metadata.file === document.file);
  const content = fs.readFileSync(
    path.join(packagedLivingBriefRoot, document.file),
  );
  const contentSha256 = crypto
    .createHash("sha256")
    .update(content.toString("utf8").replace(/\r\n?/g, "\n"))
    .digest("hex");
  assert.equal(contentSha256, metadata.sha256);
}

const requireFromArtifact = createRequire(
  path.join(runtimeRoot, "package.json"),
);
const requiredPackages = [
  "@anthropic-ai/sdk",
  "@napi-rs/canvas",
  "@sendgrid/mail",
  "@workspace/api-zod",
  "@workspace/db",
  "adm-zip",
  "bcryptjs",
  "docx",
  "pdf-lib",
  "pdf-parse",
  "pdfkit",
  "pg",
  "sharp",
] as const;

for (const packageName of requiredPackages) {
  const resolved = fs.realpathSync(requireFromArtifact.resolve(packageName));
  const relative = path.relative(runtimeRoot, resolved);
  assert(
    !relative.startsWith("..") && !path.isAbsolute(relative),
    `${packageName} resolved outside the production artifact.`,
  );
}

const bcrypt = requireFromArtifact("bcryptjs") as typeof import("bcryptjs");
const passwordHash = bcrypt.hashSync("artifact-proof", 4);
assert(bcrypt.compareSync("artifact-proof", passwordHash));

const AdmZip = requireFromArtifact("adm-zip") as typeof import("adm-zip");
const archive = new AdmZip();
archive.addFile("proof.txt", Buffer.from("artifact closure"));
const archiveBytes = archive.toBuffer();
assert.equal(
  new AdmZip(archiveBytes).readAsText("proof.txt"),
  "artifact closure",
);

const { Document, Packer, Paragraph } = requireFromArtifact(
  "docx",
) as typeof import("docx");
const docxBytes = await Packer.toBuffer(
  new Document({
    sections: [{ children: [new Paragraph("artifact closure")] }],
  }),
);
assert(docxBytes.length > 100);

const PDFDocument = requireFromArtifact("pdfkit") as typeof import("pdfkit");
const pdf = new PDFDocument();
const pdfChunks: Buffer[] = [];
pdf.on("data", (chunk: Buffer) => pdfChunks.push(chunk));
const pdfComplete = new Promise<Buffer>((resolve, reject) => {
  pdf.once("end", () => resolve(Buffer.concat(pdfChunks)));
  pdf.once("error", reject);
});
pdf.text("artifact closure");
pdf.end();
const pdfBytes = await pdfComplete;
assert.equal(pdfBytes.subarray(0, 4).toString(), "%PDF");

const { PDFParse } = requireFromArtifact(
  "pdf-parse",
) as typeof import("pdf-parse");
const parser = new PDFParse({ data: pdfBytes });
try {
  const parsed = await parser.getText();
  assert.match(parsed.text, /artifact closure/i);
} finally {
  await parser.destroy();
}

const sharp = requireFromArtifact("sharp") as typeof import("sharp");
const imageBytes = await sharp({
  create: {
    width: 4,
    height: 4,
    channels: 4,
    background: { r: 12, g: 34, b: 56, alpha: 1 },
  },
})
  .png()
  .toBuffer();
const imageMetadata = await sharp(imageBytes).metadata();
assert.equal(imageMetadata.width, 4);
assert.equal(imageMetadata.height, 4);

const { createCanvas } = requireFromArtifact(
  "@napi-rs/canvas",
) as typeof import("@napi-rs/canvas");
const canvas = createCanvas(4, 4);
const context = canvas.getContext("2d");
context.fillStyle = "#123456";
context.fillRect(0, 0, 4, 4);
assert(canvas.toBuffer("image/png").length > 50);

const sendgrid = requireFromArtifact(
  "@sendgrid/mail",
) as typeof import("@sendgrid/mail");
assert.equal(typeof sendgrid.setApiKey, "function");
assert.equal(typeof sendgrid.send, "function");
const Anthropic = requireFromArtifact("@anthropic-ai/sdk")
  .default as typeof import("@anthropic-ai/sdk").default;
assert.equal(typeof Anthropic, "function");

const { PDFDocument: PdfLibDocument } = requireFromArtifact(
  "pdf-lib",
) as typeof import("pdf-lib");
assert.equal((await PdfLibDocument.load(pdfBytes)).getPageCount(), 1);

const configuredProofRoot = process.env.BIMLOG_ARTIFACT_PROOF_ROOT;
if (process.platform === "win32" && !configuredProofRoot) {
  throw new Error(
    "BIMLOG_ARTIFACT_PROOF_ROOT must point to an F: disposable directory.",
  );
}
const resolvedProofRoot = path.resolve(
  configuredProofRoot ??
    fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-artifact-proof-")),
);
if (process.platform === "win32") {
  assert(
    resolvedProofRoot.toUpperCase().startsWith("F:\\BIMLOG\\"),
    "Artifact proof output must remain under F:\\BIMLog.",
  );
}
fs.mkdirSync(resolvedProofRoot, { recursive: true });
const storageRoot = path.join(
  resolvedProofRoot,
  `feedback-durable-storage-${crypto.randomUUID()}`,
);
assert.equal(
  fs.existsSync(storageRoot),
  false,
  "Durable fixture must be collision-new.",
);
const storageRelative = path.relative(resolvedProofRoot, storageRoot);
assert(
  storageRelative &&
    !storageRelative.startsWith("..") &&
    !path.isAbsolute(storageRelative),
);
fs.mkdirSync(storageRoot, { recursive: false });
assert.equal(fs.realpathSync.native(storageRoot), path.resolve(storageRoot));
for (const candidate of [resolvedProofRoot, storageRoot]) {
  const stat = fs.lstatSync(candidate);
  assert(
    !stat.isSymbolicLink(),
    `Artifact proof custody cannot contain links: ${candidate}`,
  );
}
if (process.platform === "win32") {
  const acl = spawnSync("icacls.exe", [storageRoot], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(acl.status, 0, "Durable fixture ACL must be readable.");
  assert.doesNotMatch(
    `${acl.stdout}\n${acl.stderr}`,
    /(?:Everyone|Todos|Authenticated Users|Usuarios autentificados|BUILTIN\\Users|BUILTIN\\Usuarios)/i,
    "Durable fixture ACL must not grant broad principals.",
  );
}
const storageBackendId = "artifact-proof-durable";
const storageMaxReadBytes = 20 * 1024 * 1024;
const storageAuthority = {
  schemaVersion: 1,
  backendId: storageBackendId,
  dataRoot: storageRoot,
  backupRequired: true,
  capabilities: ["exact-bytes", "bounded-read"],
  maxReadBytes: storageMaxReadBytes,
};
assert.deepEqual(Object.keys(storageAuthority).sort(), [
  "backendId",
  "backupRequired",
  "capabilities",
  "dataRoot",
  "maxReadBytes",
  "schemaVersion",
]);
const storageAuthorityPath = path.join(
  resolvedProofRoot,
  "feedback-storage-authority.json",
);
const storageAuthorityBytes = Buffer.from(JSON.stringify(storageAuthority));
fs.writeFileSync(storageAuthorityPath, storageAuthorityBytes, {
  flag: "wx",
  mode: 0o600,
});
const storageAuthoritySha256 = crypto
  .createHash("sha256")
  .update(storageAuthorityBytes)
  .digest("hex");
assert.match(storageAuthoritySha256, /^[a-f0-9]{64}$/);
const guardPath = path.join(resolvedProofRoot, "artifact-resolution-guard.cjs");
fs.writeFileSync(
  guardPath,
  `"use strict";
const Module = require("node:module");
const path = require("node:path");
const root = path.resolve(process.env.BIMLOG_ARTIFACT_RUNTIME_ROOT);
const original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  const resolved = original.call(this, request, parent, isMain, options);
  if (typeof resolved === "string" && path.isAbsolute(resolved) && resolved.includes("node_modules")) {
    const relative = path.relative(root, path.resolve(resolved));
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Production artifact attempted dependency resolution outside its runtime closure.");
    }
  }
  return resolved;
};
`,
);

const proofDatabaseUrl = process.env.BIMLOG_ARTIFACT_PROOF_DATABASE_URL;
assert(
  proofDatabaseUrl,
  "BIMLOG_ARTIFACT_PROOF_DATABASE_URL is required for the exact-artifact authorization proof.",
);
const proofDatabaseIdentity = new URL(proofDatabaseUrl);
const proofDatabaseHostname = proofDatabaseIdentity.hostname.replace(
  /^\[|\]$/g,
  "",
);
assert(["127.0.0.1", "localhost", "::1"].includes(proofDatabaseHostname));
const proofDatabasePort = Number(proofDatabaseIdentity.port);
assert(
  Number.isInteger(proofDatabasePort) &&
    proofDatabasePort >= 1024 &&
    proofDatabasePort <= 65535,
);
assert.equal(proofDatabaseIdentity.pathname, "/bimlog_rfi_test");
const { Pool } = requireFromArtifact("pg") as typeof import("pg");
const proofPool = new Pool({ connectionString: proofDatabaseUrl, max: 2 });
const proofMarker = `artifact-living-brief-${process.pid}-${Date.now()}`;
const company = await proofPool.query<{ id: number }>(
  `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
  [`${proofMarker}-company`],
);
const companyId = company.rows[0]!.id;
const users = await Promise.all([
  proofPool.query<{ id: number; email: string }>(
    `INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief)
     VALUES ($1,$2,$3,$4,false,true) RETURNING id,email`,
    [
      `${proofMarker}-eligible@example.test`,
      "artifact-proof-not-used",
      "Artifact Eligible",
      companyId,
    ],
  ),
  proofPool.query<{ id: number; email: string }>(
    `INSERT INTO users (email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief)
     VALUES ($1,$2,$3,$4,false,false) RETURNING id,email`,
    [
      `${proofMarker}-ineligible@example.test`,
      "artifact-proof-not-used",
      "Artifact Ineligible",
      companyId,
    ],
  ),
]);
const eligibleUser = users[0].rows[0]!;
const ineligibleUser = users[1].rows[0]!;
const jwtSecret = "synthetic-local-artifact-proof-only-0000000000000000";
function signProofJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ ...payload, iat: now, exp: now + 600 })}`;
  return `${unsigned}.${crypto.createHmac("sha256", jwtSecret).update(unsigned).digest("base64url")}`;
}
const commonClaims = { companyId, companyName: `${proofMarker}-company` };
const eligibleToken = signProofJwt({
  ...commonClaims,
  userId: eligibleUser.id,
  email: eligibleUser.email,
  fullName: "Artifact Eligible",
  isSuperAdmin: false,
});
const ineligibleToken = signProofJwt({
  ...commonClaims,
  userId: ineligibleUser.id,
  email: ineligibleUser.email,
  fullName: "Artifact Ineligible",
  isSuperAdmin: false,
});

const port = await new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    assert(address && typeof address === "object");
    const selected = address.port;
    server.close((error) => (error ? reject(error) : resolve(selected)));
  });
});
const startedAt = performance.now();
const inheritedRuntimeEnvironment = Object.fromEntries(
  ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE"]
    .map((key) => [key, process.env[key]])
    .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const feedbackStorageEnvironment = {
  BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem",
  BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: storageBackendId,
  BIMLOG_FEEDBACK_UPLOAD_ROOT: storageRoot,
  BIMLOG_FEEDBACK_STORAGE_AUTHORITY_MANIFEST: storageAuthorityPath,
  BIMLOG_FEEDBACK_STORAGE_AUTHORITY_SHA256: storageAuthoritySha256,
};
const negativePort = await new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    assert(address && typeof address === "object");
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const invalidStorageChild = spawn(process.execPath, [bundle], {
  cwd: runtimeRoot,
  env: {
    ...inheritedRuntimeEnvironment,
    PORT: String(negativePort),
    NODE_ENV: "production",
    REPLIT_DEPLOYMENT: "1",
    DATABASE_URL: proofDatabaseUrl,
    PROD_DATABASE_URL: proofDatabaseUrl,
    JWT_SECRET: jwtSecret,
    BIMLOG_SOURCE_COMMIT: deploymentSource.sourceCommit,
    BIMLOG_ARTIFACT_RUNTIME_ROOT: runtimeRoot,
    ...feedbackStorageEnvironment,
    BIMLOG_FEEDBACK_STORAGE_AUTHORITY_SHA256: "0".repeat(64),
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --require ${guardPath}`.trim(),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const invalidStorageStartedAt = performance.now();
let invalidStorageStdout = "";
let invalidStorageStderr = "";
invalidStorageChild.stdout.on("data", (chunk) => {
  invalidStorageStdout += String(chunk);
});
invalidStorageChild.stderr.on("data", (chunk) => {
  invalidStorageStderr += String(chunk);
});
let invalidStorageReadinessReached = false;
let invalidStorageTcpReached = false;
let invalidStorageTimedOut = false;
let invalidStorageCleanupRequired = false;
const invalidStorageProbeTimingsMs: number[] = [];
const invalidStorageExit = new Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>((resolve) => {
  invalidStorageChild.once("exit", (code, signal) => resolve({ code, signal }));
});
try {
  const deadline = performance.now() + 6_000;
  while (
    invalidStorageChild.exitCode === null &&
    performance.now() < deadline
  ) {
    const probeStartedAt = performance.now();
    const response = await fetch(
      `http://127.0.0.1:${negativePort}/api/v1/healthz`,
    ).catch(() => null);
    invalidStorageProbeTimingsMs.push(
      Number((performance.now() - probeStartedAt).toFixed(1)),
    );
    if (response) {
      invalidStorageTcpReached = true;
      if (response.status === 200) invalidStorageReadinessReached = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  invalidStorageTimedOut = invalidStorageChild.exitCode === null;
} finally {
  if (invalidStorageChild.exitCode === null) {
    invalidStorageCleanupRequired = true;
    invalidStorageChild.kill();
  }
}
const invalidStorageExitResult = await invalidStorageExit;
const invalidStorageElapsedMs = Number(
  (performance.now() - invalidStorageStartedAt).toFixed(1),
);
const invalidStorageOutput = `${invalidStorageStdout}\n${invalidStorageStderr}`;
assert.equal(
  invalidStorageTimedOut,
  false,
  "Invalid authority child did not exit naturally.",
);
assert.equal(
  invalidStorageCleanupRequired,
  false,
  "Invalid authority denial required forced process cleanup.",
);
assert.notEqual(invalidStorageExitResult.code, 0);
assert.equal(invalidStorageExitResult.signal, null);
assert.match(invalidStorageOutput, /FEEDBACK_STORAGE_AUTHORITY_INVALID/);
assert.doesNotMatch(invalidStorageOutput, /phase=bootstrap_bound/);
assert.doesNotMatch(invalidStorageOutput, /phase=ready_transition/);
assert.equal(invalidStorageTcpReached, false);
assert.equal(invalidStorageReadinessReached, false);
assert(!invalidStorageOutput.includes(proofDatabaseUrl));
await new Promise<void>((resolve, reject) => {
  const reuse = net.createServer();
  reuse.once("error", reject);
  reuse.listen(negativePort, "127.0.0.1", () =>
    reuse.close((error) => (error ? reject(error) : resolve())),
  );
});
const child = spawn(process.execPath, [bundle], {
  cwd: runtimeRoot,
  env: {
    ...inheritedRuntimeEnvironment,
    PORT: String(port),
    NODE_ENV: "production",
    REPLIT_DEPLOYMENT: "1",
    DATABASE_URL: proofDatabaseUrl,
    PROD_DATABASE_URL: proofDatabaseUrl,
    JWT_SECRET: jwtSecret,
    BIMLOG_SOURCE_COMMIT: deploymentSource.sourceCommit,
    BIMLOG_ARTIFACT_RUNTIME_ROOT: runtimeRoot,
    ...feedbackStorageEnvironment,
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --require ${guardPath}`.trim(),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += String(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

async function waitForResponse(
  pathname: string,
  accepted: (status: number) => boolean,
) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`).catch(
      () => null,
    );
    if (response && accepted(response.status)) return response.status;
    if (child.exitCode !== null) {
      throw new Error(
        `Production artifact exited before readiness. ${stdout}\n${stderr}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Production artifact did not satisfy ${pathname} within 6 seconds. ${stdout}\n${stderr}`,
  );
}

try {
  const apiStatus = await waitForResponse("/api", (status) => status < 500);
  const readyStatus = await waitForResponse(
    "/api/v1/healthz",
    (status) => status === 200,
  );
  const readyMs = performance.now() - startedAt;
  assert.equal(apiStatus, 200);
  assert.equal(readyStatus, 200);
  assert(readyMs < 6_000);
  assert.match(stdout, /phase=bootstrap_bound/);
  assert.match(stdout, /phase=app_import_begin/);
  assert.match(stdout, /phase=app_import_complete/);
  assert.match(stdout, /phase=ready_transition/);
  assert.match(
    stdout,
    /\[feedback-storage\] artifact-proof-durable durable-filesystem healthy/,
  );
  assert(storageAuthority.capabilities.includes("bounded-read"));
  assert.equal(storageAuthority.maxReadBytes, storageMaxReadBytes);
  assert.doesNotMatch(stderr, /outside its runtime closure/);
  const api = async (
    pathname: string,
    token: string,
    init: RequestInit = {},
  ) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    };
  };
  const eligible = await api("/living-brief/eligibility", eligibleToken);
  assert.equal(eligible.status, 200);
  assert.equal(eligible.body.eligible, true);
  const ineligible = await api("/living-brief/eligibility", ineligibleToken);
  assert.equal(ineligible.status, 200);
  assert.equal(ineligible.body.eligible, false);
  const deniedUnlock = await api("/living-brief/unlock", ineligibleToken, {
    method: "POST",
    body: "{}",
  });
  assert.equal(deniedUnlock.status, 403);
  const unlock = await api("/living-brief/unlock", eligibleToken, {
    method: "POST",
    body: "{}",
  });
  assert.equal(unlock.status, 200);
  assert.equal(typeof unlock.body.briefToken, "string");
  const documents = await api("/living-brief/docs", eligibleToken, {
    headers: { "X-Brief-Token": String(unlock.body.briefToken) },
  });
  assert.equal(documents.status, 200);
  const docs = documents.body.docs as Array<Record<string, unknown>>;
  const catalog = documents.body.catalog as Array<Record<string, unknown>>;
  assert.equal(docs.length, 11);
  assert.equal(catalog.length, 11);
  assert.deepEqual(
    docs.map((document) => document.name),
    packagedCatalog.documents.map((document) => document.file),
  );
  for (const document of docs) {
    assert.equal(document.sourceCommit, deploymentSource.sourceCommit);
    assert.equal(document.deployedSourceCommit, deploymentSource.sourceCommit);
    assert.equal(typeof document.content, "string");
    assert((document.content as string).length > 0);
  }
  console.log(
    JSON.stringify({
      isolatedProductionArtifact: true,
      externalPackagesResolvedInsideArtifact: requiredPackages.length,
      workspaceLinksPresent: true,
      pdfGenerationAndParsing: true,
      imageAndCanvasNativeRuntime: true,
      emailArchiveDocxAuthImports: true,
      apiRootStatus: apiStatus,
      readinessStatus: readyStatus,
      packagedLivingBriefDocuments: docs.length,
      passwordlessEligibleUnlock: true,
      ineligibleUnlockDenied: deniedUnlock.status,
      deployedSourceCommit: deploymentSource.sourceCommit,
      feedbackStorageBackend: "durable-filesystem",
      feedbackStorageBoundedRead: true,
      feedbackStorageMaxReadBytes: storageMaxReadBytes,
      invalidStorageAuthorityDenied: true,
      invalidStorageProof: {
        naturalExit: !invalidStorageCleanupRequired,
        exitCode: invalidStorageExitResult.code,
        signal: invalidStorageExitResult.signal,
        elapsedMs: invalidStorageElapsedMs,
        tcpReached: invalidStorageTcpReached,
        readinessReached: invalidStorageReadinessReached,
        negativePortReusable: true,
        probeCount: invalidStorageProbeTimingsMs.length,
        probeTimingsMs: invalidStorageProbeTimingsMs,
        stdout: invalidStorageStdout,
        stderr: invalidStorageStderr,
      },
      readyMs: Number(readyMs.toFixed(1)),
      platform: `${os.platform()}-${os.arch()}`,
    }),
  );
} finally {
  if (child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await proofPool.end();
}
