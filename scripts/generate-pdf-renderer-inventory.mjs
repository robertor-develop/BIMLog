import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repoRoot, "artifacts", "api-server", "src");
const outputPath = path.join(
  repoRoot,
  "evidence",
  "stabilization-program-20260919",
  "BLOCK_28_PDF_RENDERER_INVENTORY.json",
);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

function occurrences(source, pattern) {
  return source.split(/\r?\n/u).flatMap((line, index) => (
    pattern.test(line) ? [{ line: index + 1, text: line.trim().slice(0, 240) }] : []
  ));
}

const files = walk(sourceRoot)
  .filter((file) => !/\.behavior\.ts$/u.test(file) && !/\.test\.ts$/u.test(file))
  .map((file) => {
    const source = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(repoRoot, file).replaceAll("\\", "/");
    const sharedDocumentCreates = occurrences(source, /\bcreatePdfDocument\s*\(/u);
    const directDocumentCreates = occurrences(source, /\bnew\s+PDFDocument\s*\(/u);
    const pdfResponses = occurrences(source, /application\/pdf/u);
    const directDispositions = occurrences(source, /Content-Disposition/u);
    const sharedHeaderCalls = occurrences(source, /\bapplyPdfDownloadHeaders\s*\(/u);
    if (
      sharedDocumentCreates.length === 0
      && directDocumentCreates.length === 0
      && pdfResponses.length === 0
    ) return null;

    const isSharedPrimitive = relativePath.endsWith("/lib/pdf-kit.ts");
    const rendererContract = directDocumentCreates.length > 0 && !isSharedPrimitive
      ? "BESPOKE_PDFKIT_CONSTRUCTOR"
      : sharedDocumentCreates.length > 0
        ? "SHARED_PDF_DOCUMENT_FACTORY"
        : "PDF_BYTES_OR_RESPONSE_ONLY";
    const deliveryContract = sharedHeaderCalls.length > 0
      ? "SHARED_SAFE_DOWNLOAD_HEADERS"
      : pdfResponses.length > 0 || directDispositions.length > 0
        ? "BESPOKE_OR_BUFFERED_DELIVERY"
        : "INTERNAL_ARTIFACT_ONLY";

    return {
      path: relativePath,
      rendererContract,
      deliveryContract,
      sharedDocumentCreates,
      directDocumentCreates,
      pdfResponses,
      directDispositions,
      sharedHeaderCalls,
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.path.localeCompare(right.path));

const productionFiles = files.filter((file) => !file.path.endsWith("/lib/pdf-kit.ts"));
const inventory = {
  schemaVersion: 1,
  build: 136,
  scope: "artifacts/api-server/src production TypeScript excluding behavior/test fixtures",
  generatedFrom: "source",
  counts: {
    files: productionFiles.length,
    sharedFactoryFiles: productionFiles.filter((file) => file.rendererContract === "SHARED_PDF_DOCUMENT_FACTORY").length,
    directConstructorFiles: productionFiles.filter((file) => file.rendererContract === "BESPOKE_PDFKIT_CONSTRUCTOR").length,
    responseOnlyFiles: productionFiles.filter((file) => file.rendererContract === "PDF_BYTES_OR_RESPONSE_ONLY").length,
    sharedHeaderFiles: productionFiles.filter((file) => file.deliveryContract === "SHARED_SAFE_DOWNLOAD_HEADERS").length,
    bespokeDeliveryFiles: productionFiles.filter((file) => file.deliveryContract === "BESPOKE_OR_BUFFERED_DELIVERY").length,
    rendererSites: productionFiles.reduce((sum, file) => sum + file.sharedDocumentCreates.length + file.directDocumentCreates.length, 0),
    pdfResponseSites: productionFiles.reduce((sum, file) => sum + file.pdfResponses.length, 0),
  },
  sharedPrimitive: files.find((file) => file.path.endsWith("/lib/pdf-kit.ts")),
  files: productionFiles,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`PDF_RENDERER_INVENTORY=PASS files=${inventory.counts.files} rendererSites=${inventory.counts.rendererSites} bespokeDeliveryFiles=${inventory.counts.bespokeDeliveryFiles}`);
