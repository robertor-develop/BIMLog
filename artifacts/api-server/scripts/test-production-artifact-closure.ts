import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
const child = spawn(process.execPath, [bundle], {
  cwd: path.resolve("../.."),
  env: {
    ...inheritedRuntimeEnvironment,
    PORT: String(port),
    NODE_ENV: "production",
    REPLIT_DEPLOYMENT: "1",
    DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:55999/bimlog",
    PROD_DATABASE_URL:
      "postgresql://synthetic:synthetic@127.0.0.1:55999/bimlog",
    JWT_SECRET: "synthetic-local-artifact-proof-only-0000000000000000",
    BIMLOG_ARTIFACT_RUNTIME_ROOT: runtimeRoot,
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
  assert.equal(apiStatus, 404);
  assert.equal(readyStatus, 200);
  assert(readyMs < 6_000);
  assert.match(stdout, /phase=bootstrap_bound/);
  assert.match(stdout, /phase=app_import_begin/);
  assert.match(stdout, /phase=app_import_complete/);
  assert.match(stdout, /phase=ready_transition/);
  assert.doesNotMatch(stderr, /outside its runtime closure/);
  console.log(
    JSON.stringify({
      isolatedProductionArtifact: true,
      externalPackagesResolvedInsideArtifact: requiredPackages.length,
      workspaceLinksPresent: true,
      pdfGenerationAndParsing: true,
      imageAndCanvasNativeRuntime: true,
      emailArchiveDocxAuthImports: true,
      apiHistoricalNon5xx: apiStatus,
      readinessStatus: readyStatus,
      readyMs: Number(readyMs.toFixed(1)),
      platform: `${os.platform()}-${os.arch()}`,
    }),
  );
} finally {
  child.kill();
}
