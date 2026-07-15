import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { pathToFileURL } from "url";
import AdmZip from "adm-zip";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import * as XLSX from "xlsx";
import { createPdfDocument } from "./pdf-kit";

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 300 * 1024 * 1024;
const MAX_SOURCE_PAGES = 1_000;
const MAX_PACKAGE_PAGES = 2_000;
const MAX_IMAGE_PIXELS = 100_000_000;
const MAX_IMAGE_PAGE_EDGE = 3_456;
const DEFAULT_CONVERTER_TIMEOUT_MS = 90_000;
const PROCESS_TREE_CLOSE_TIMEOUT_MS = 10_000;

export const COMPLETE_PACKAGE_OOXML_LIMITS = Object.freeze({
  maxEntryCount: 4_096,
  maxDeclaredUncompressedBytes: 256 * 1024 * 1024,
  maxRelationshipEntryBytes: 1024 * 1024,
  maxRelationshipBytesInspected: 4 * 1024 * 1024,
  maxCompressionRatio: 1_000,
  compressionRatioMinimumBytes: 1024 * 1024,
});

export type CompletePackageFailureCategory =
  | "converter_unavailable"
  | "converter_timeout"
  | "corrupt_file"
  | "missing_file"
  | "unsupported_format"
  | "resource_limit"
  | "package_validation"
  | "external_reference"
  | "cancelled";

export class CompletePackageError extends Error {
  constructor(
    message: string,
    readonly category: CompletePackageFailureCategory,
    readonly fileName?: string,
    readonly status = category === "converter_unavailable" ? 503 : category === "cancelled" ? 499 : 422,
  ) {
    super(message);
  }
}

export type CompletePackageInputItem = {
  order: number;
  label: string;
  sourceType: string;
  include: boolean;
  fileName?: string;
  buffer?: Buffer;
  role?: "attachment" | "presentation-image";
  crop?: { x: number; y: number; width: number; height: number } | null;
  exclusionReason?: string;
};

export type PdfPageInventory = {
  page: number;
  mediaBox: [number, number, number, number];
  cropBox: [number, number, number, number];
  trimBox: [number, number, number, number] | null;
  bleedBox: [number, number, number, number] | null;
  artBox: [number, number, number, number] | null;
  rotation: number;
  displayedOrientation: "portrait" | "landscape";
};

export type CompletePackageManifestItem = {
  order: number;
  label: string;
  sourceType: string;
  included: boolean;
  sourceSha256: string | null;
  sourcePageCount: number | null;
  pageRange: string | null;
  sourcePages: PdfPageInventory[];
  conversionMethod: string;
  convertedSha256: string | null;
  warnings: string[];
  failureState: string | null;
};

export type CompletePackageResult = {
  buffer: Buffer;
  logicalFingerprint: string;
  pageCount: number;
  manifest: CompletePackageManifestItem[];
  manifestPageRange: string;
};

type ConvertedItem = {
  pdf: Buffer;
  method: string;
  warnings: string[];
  sourcePages: PdfPageInventory[];
  sourcePageCount: number | null;
  convertedSha256: string;
};

function sha256(buffer: Buffer | string): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function cleanFileName(value: string): string {
  const base = path.posix.basename(path.win32.basename(value || "attachment"));
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "attachment";
}

function cleanLabel(value: string): string {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (/\/api\/v1\/projects\/\d+\/files\/\d+|storage[_ ]?path|source[_ ]?location/i.test(clean)) return "Protected BIMLog file";
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname);
      return `External reference: ${name}`;
    } catch {
      return "External reference";
    }
  }
  if (/^[A-Za-z]:\\/.test(clean)) return path.win32.basename(clean);
  return clean || "Attachment";
}

function extension(fileName: string): string {
  return (fileName.split(".").pop() || "").toLowerCase();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["generatedAt", "exportedAt"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function boxTuple(box: { x: number; y: number; width: number; height: number }): [number, number, number, number] {
  return [box.x, box.y, box.x + box.width, box.y + box.height].map(value => Number(value.toFixed(5))) as [number, number, number, number];
}

function inventoryPdf(pdf: PDFDocument): PdfPageInventory[] {
  return pdf.getPages().map((page, index) => {
    const media = page.getMediaBox();
    const inheritedBox = (name: string, fallback: () => { x: number; y: number; width: number; height: number }) =>
      page.node.getInheritableAttribute(PDFName.of(name)) instanceof PDFArray ? boxTuple(fallback()) : null;
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const displayedWidth = rotation === 90 || rotation === 270 ? media.height : media.width;
    const displayedHeight = rotation === 90 || rotation === 270 ? media.width : media.height;
    return {
      page: index + 1,
      mediaBox: boxTuple(media),
      cropBox: boxTuple(page.getCropBox()),
      trimBox: inheritedBox("TrimBox", () => page.getTrimBox()),
      bleedBox: inheritedBox("BleedBox", () => page.getBleedBox()),
      artBox: inheritedBox("ArtBox", () => page.getArtBox()),
      rotation,
      displayedOrientation: displayedWidth > displayedHeight ? "landscape" : "portrait",
    };
  });
}

async function loadPdf(buffer: Buffer, fileName: string): Promise<{ pdf: PDFDocument; inventory: PdfPageInventory[] }> {
  if (!buffer.length) throw new CompletePackageError(`${fileName} is empty.`, "corrupt_file", fileName);
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
    const pageCount = pdf.getPageCount();
    if (!pageCount) throw new Error("PDF has no pages");
    if (pageCount > MAX_SOURCE_PAGES) throw new CompletePackageError(`${fileName} exceeds the ${MAX_SOURCE_PAGES}-page source limit.`, "resource_limit", fileName);
    return { pdf, inventory: inventoryPdf(pdf) };
  } catch (error) {
    if (error instanceof CompletePackageError) throw error;
    throw new CompletePackageError(`${fileName} is corrupt, encrypted, or not a readable PDF.`, "corrupt_file", fileName);
  }
}

function converterExecutable(): string {
  if (process.env.LIBREOFFICE_PATH?.trim()) return process.env.LIBREOFFICE_PATH.trim();
  if (process.env.SOFFICE_PATH?.trim()) return process.env.SOFFICE_PATH.trim();
  const windowsCandidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.com",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  ];
  return windowsCandidates.find(candidate => fs.existsSync(candidate)) || "soffice";
}

function converterTimeoutMs(): number {
  const configured = Number(process.env.RFI_OFFICE_CONVERTER_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(300_000, Math.max(10_000, configured)) : DEFAULT_CONVERTER_TIMEOUT_MS;
}

function converterEnvironment(workspace?: string): NodeJS.ProcessEnv {
  const allowed = ["PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "SystemDrive", "LANG", "LC_ALL", "LD_LIBRARY_PATH"];
  const environment = Object.fromEntries(allowed.flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
  if (workspace) Object.assign(environment, { HOME: workspace, USERPROFILE: workspace, TMP: workspace, TEMP: workspace });
  return environment;
}

type ProcessTermination = "none" | "timeout" | "cancelled" | "output_limit";

type BoundedProcessResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  termination: ProcessTermination;
};

export function completePackageProcessTreeStrategyForProof(platform: NodeJS.Platform = process.platform): "windows-taskkill-tree" | "posix-owned-process-group" {
  return platform === "win32" ? "windows-taskkill-tree" : "posix-owned-process-group";
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function waitForProcessGroupClosure(processGroupId: number): Promise<void> {
  const deadline = Date.now() + PROCESS_TREE_CLOSE_TIMEOUT_MS;
  while (processGroupExists(processGroupId) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (processGroupExists(processGroupId)) throw new Error(`Converter process group ${processGroupId} did not terminate.`);
}

async function runTaskkillTree(processId: number): Promise<number | null> {
  return new Promise<number | null>((resolve, reject) => {
    const killer = spawn("taskkill", ["/PID", String(processId), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      shell: false,
    });
    killer.once("error", reject);
    killer.once("close", code => resolve(code));
  });
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  const processId = child.pid;
  if (!processId) return;
  if (process.platform === "win32") {
    try {
      const taskkillCode = await runTaskkillTree(processId);
      if (taskkillCode !== 0 && child.exitCode == null) child.kill("SIGKILL");
    } catch {
      if (child.exitCode == null) child.kill("SIGKILL");
    }
    return;
  }

  try {
    process.kill(-processId, "SIGKILL");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH" && child.exitCode == null) child.kill("SIGKILL");
  }
  await waitForProcessGroupClosure(processId);
}

async function runBoundedProcess(args: {
  executable: string;
  argv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<BoundedProcessResult> {
  if (args.signal?.aborted) throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled");
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(args.executable, args.argv, {
        windowsHide: true,
        detached: process.platform !== "win32",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: args.env,
      });
    } catch (error) {
      reject(error);
      return;
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let termination: ProcessTermination = "none";
    let terminationPromise: Promise<void> | null = null;
    let terminationError: unknown;
    let settled = false;
    const stop = (reason: Exclude<ProcessTermination, "none">) => {
      if (termination !== "none") return;
      termination = reason;
      terminationPromise = terminateProcessTree(child).catch(error => { terminationError = error; });
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > args.maxOutputBytes) { stop("output_limit"); return; }
      target.push(chunk);
    };
    child.stdout!.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr!.on("data", (chunk: Buffer) => collect(stderr, chunk));
    const onAbort = () => stop("cancelled");
    args.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => stop("timeout"), args.timeoutMs);
    child.once("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      args.signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    child.once("close", async (code, childSignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      args.signal?.removeEventListener("abort", onAbort);
      try {
        await terminationPromise;
        if (terminationError) throw terminationError;
        resolve({
          code,
          signal: childSignal,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          termination,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function runCompletePackageProcessForProof(args: {
  executable: string;
  argv: string[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<BoundedProcessResult> {
  return runBoundedProcess({ ...args, maxOutputBytes: 1024 * 1024, env: converterEnvironment() });
}

export async function getRfiCompletePackageCapability() {
  const executable = converterExecutable();
  let ready = false;
  try {
    const probe = await runBoundedProcess({ executable, argv: ["--headless", "--version"], timeoutMs: 5_000, maxOutputBytes: 1024 * 1024, env: converterEnvironment() });
    ready = probe.termination === "none" && probe.code === 0;
  } catch { /* explicit not-ready result below */ }
  return {
    officeConverterReady: ready,
    supportedOfficeFormats: ["doc", "docx", "xls", "xlsx", "csv", "txt"],
    timeoutMs: converterTimeoutMs(),
    imageFormats: ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "gif", "webp"],
    msgSupported: false,
  };
}

function validateOfficeSignature(fileName: string, buffer: Buffer): void {
  const ext = extension(fileName);
  const zip = buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const ole = buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (["docx", "xlsx"].includes(ext) && !zip) throw new CompletePackageError(`${fileName} is not a valid Office Open XML file.`, "corrupt_file", fileName);
  if (["doc", "xls"].includes(ext) && !ole) throw new CompletePackageError(`${fileName} is not a valid legacy Office file.`, "corrupt_file", fileName);
}

function declaredZipEntryCount(fileName: string, buffer: Buffer): number {
  const minimumEocdBytes = 22;
  const maximumCommentBytes = 65_535;
  const earliestOffset = Math.max(0, buffer.length - minimumEocdBytes - maximumCommentBytes);
  for (let offset = buffer.length - minimumEocdBytes; offset >= earliestOffset; offset--) {
    if (buffer.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + minimumEocdBytes + commentLength !== buffer.length) continue;
    const entryCount = buffer.readUInt16LE(offset + 10);
    if (entryCount === 0xffff) {
      throw new CompletePackageError(`${fileName} uses ZIP64 entry counts beyond the Complete RFI PDF Office package limit.`, "resource_limit", fileName);
    }
    return entryCount;
  }
  throw new CompletePackageError(`${fileName} is not a readable Office Open XML package.`, "corrupt_file", fileName);
}

function rejectExternalOfficeRelationships(fileName: string, buffer: Buffer): void {
  if (!["docx", "xlsx"].includes(extension(fileName))) return;
  try {
    if (declaredZipEntryCount(fileName, buffer) > COMPLETE_PACKAGE_OOXML_LIMITS.maxEntryCount) {
      throw new CompletePackageError(`${fileName} exceeds the Office Open XML entry-count limit.`, "resource_limit", fileName);
    }
    const archive = new AdmZip(buffer);
    const entries = archive.getEntries();
    if (entries.length > COMPLETE_PACKAGE_OOXML_LIMITS.maxEntryCount) {
      throw new CompletePackageError(`${fileName} exceeds the Office Open XML entry-count limit.`, "resource_limit", fileName);
    }
    let declaredUncompressedBytes = 0;
    let relationshipBytesInspected = 0;
    const relationshipEntries = [];
    for (const entry of entries) {
      const declaredSize = entry.header.size;
      const compressedSize = entry.header.compressedSize;
      if (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || !Number.isSafeInteger(compressedSize) || compressedSize < 0) {
        throw new CompletePackageError(`${fileName} contains invalid Office Open XML ZIP metadata.`, "resource_limit", fileName);
      }
      const isRelationship = entry.entryName.toLowerCase().endsWith(".rels");
      if (isRelationship) {
        if (declaredSize > COMPLETE_PACKAGE_OOXML_LIMITS.maxRelationshipEntryBytes) {
          throw new CompletePackageError(`${fileName} exceeds the Office relationship-entry size limit.`, "resource_limit", fileName);
        }
        relationshipBytesInspected += declaredSize;
        if (relationshipBytesInspected > COMPLETE_PACKAGE_OOXML_LIMITS.maxRelationshipBytesInspected) {
          throw new CompletePackageError(`${fileName} exceeds the total Office relationship-data limit.`, "resource_limit", fileName);
        }
        relationshipEntries.push(entry);
      }
      declaredUncompressedBytes += declaredSize;
      if (declaredUncompressedBytes > COMPLETE_PACKAGE_OOXML_LIMITS.maxDeclaredUncompressedBytes) {
        throw new CompletePackageError(`${fileName} exceeds the Office Open XML uncompressed-size limit.`, "resource_limit", fileName);
      }
      if (declaredSize >= COMPLETE_PACKAGE_OOXML_LIMITS.compressionRatioMinimumBytes
        && (compressedSize === 0 || declaredSize / compressedSize > COMPLETE_PACKAGE_OOXML_LIMITS.maxCompressionRatio)) {
        throw new CompletePackageError(`${fileName} exceeds the Office Open XML compression-ratio limit.`, "resource_limit", fileName);
      }
    }
    const external = relationshipEntries.some(entry => /TargetMode\s*=\s*["']External["']/i.test(entry.getData().toString("utf8")));
    if (external) throw new CompletePackageError(`${fileName} contains an external Office relationship and cannot be converted without outbound-retrieval risk.`, "external_reference", fileName);
  } catch (error) {
    if (error instanceof CompletePackageError) throw error;
    throw new CompletePackageError(`${fileName} is not a readable Office Open XML package.`, "corrupt_file", fileName);
  }
}

export function inspectOfficeOpenXmlForProof(fileName: string, buffer: Buffer): void {
  validateOfficeSignature(fileName, buffer);
  rejectExternalOfficeRelationships(fileName, buffer);
}

function writeLockedDownLibreOfficeProfile(profileDir: string): void {
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, "registrymodifications.xcu"), `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/Security"><prop oor:name="HyperlinksWithProtocol" oor:op="fuse"><value>false</value></prop></item>
  <item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateLinks" oor:op="fuse"><value>0</value></prop></item>
</oor:items>`, "utf8");
}

async function convertWithLibreOffice(fileName: string, buffer: Buffer, signal?: AbortSignal): Promise<Buffer> {
  validateOfficeSignature(fileName, buffer);
  rejectExternalOfficeRelationships(fileName, buffer);
  const ext = extension(fileName);
  const capability = await getRfiCompletePackageCapability();
  if (!capability.officeConverterReady) {
    throw new CompletePackageError(`${fileName} requires the configured LibreOffice PDF converter, but it is not ready.`, "converter_unavailable", fileName);
  }
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-rfi-package-"));
  try {
    const profileDir = path.join(workspace, "profile");
    const outputDir = path.join(workspace, "output");
    fs.mkdirSync(outputDir);
    writeLockedDownLibreOfficeProfile(profileDir);
    const inputName = `input.${ext}`;
    const inputPath = path.join(workspace, inputName);
    fs.writeFileSync(inputPath, buffer, { flag: "wx" });
    const result = await runBoundedProcess({
      executable: converterExecutable(),
      argv: [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      "--headless", "--invisible", "--nologo", "--nodefault", "--nolockcheck", "--norestore", "--nofirststartwizard",
      "--convert-to", "pdf", "--outdir", outputDir, inputPath,
      ],
      timeoutMs: converterTimeoutMs(),
      maxOutputBytes: 2 * 1024 * 1024,
      env: converterEnvironment(workspace),
      signal,
    });
    if (result.termination === "cancelled") throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled", fileName);
    if (result.termination === "timeout") {
      throw new CompletePackageError(`${fileName} exceeded the Office conversion time limit.`, "converter_timeout", fileName);
    }
    if (result.termination === "output_limit") throw new CompletePackageError(`${fileName} exceeded the Office converter output limit.`, "resource_limit", fileName);
    if (result.code !== 0) {
      throw new CompletePackageError(`${fileName} could not be converted by the configured Office converter.`, "corrupt_file", fileName);
    }
    const outputPath = path.join(outputDir, "input.pdf");
    if (!fs.existsSync(outputPath)) throw new CompletePackageError(`${fileName} did not produce a PDF during conversion.`, "corrupt_file", fileName);
    const output = fs.readFileSync(outputPath);
    if (!output.length) throw new CompletePackageError(`${fileName} produced an empty PDF during conversion.`, "corrupt_file", fileName);
    return output;
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

async function textToDocx(text: string, title: string): Promise<Buffer> {
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n").map(line => new Paragraph({
    spacing: { after: 80, line: 260 },
    children: [new TextRun({ text: line || " ", font: "Arial", size: 19 })],
  }));
  const document = new Document({
    creator: "BIMLog by IgniteSmart",
    title,
    sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, children: paragraphs }],
  });
  return Packer.toBuffer(document);
}

async function renderTextFile(fileName: string, buffer: Buffer, signal?: AbortSignal): Promise<Buffer> {
  if (!buffer.length) throw new CompletePackageError(`${fileName} is empty.`, "corrupt_file", fileName);
  if (extension(fileName) === "csv") {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer", raw: true, codepage: 65001 });
      if (!workbook.SheetNames.length) throw new Error("no worksheets");
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
        if (range) {
          const columnCount = range.e.c - range.s.c + 1;
          sheet["!cols"] = Array.from({ length: columnCount }, (_, column) => {
            let width = 10;
            for (let row = range.s.r; row <= range.e.r; row++) width = Math.max(width, String(sheet[XLSX.utils.encode_cell({ r: row, c: column })]?.v ?? "").length + 2);
            return { wch: Math.min(width, 45) };
          });
        }
      }
      return await convertWithLibreOffice("table.xlsx", Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), signal);
    } catch (error) {
      if (error instanceof CompletePackageError) throw error;
      throw new CompletePackageError(`${fileName} is not a readable CSV file.`, "corrupt_file", fileName);
    }
  }
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) throw new CompletePackageError(`${fileName} is not valid UTF-8 text.`, "corrupt_file", fileName);
  return convertWithLibreOffice("text.docx", await textToDocx(text, fileName), signal);
}

type NormalizedImagePage = {
  png: Buffer;
  pixelWidth: number;
  pixelHeight: number;
  pageWidth: number;
  pageHeight: number;
  warnings: string[];
};

async function normalizeImagePage(fileName: string, buffer: Buffer, crop: CompletePackageInputItem["crop"]): Promise<NormalizedImagePage> {
  if (!buffer.length) throw new CompletePackageError(`${fileName} is empty.`, "corrupt_file", fileName);
  try {
    const warnings: string[] = [];
    let decodedBuffer = buffer;
    if (extension(fileName) === "bmp") {
      const bitmap = await loadImage(buffer);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error("invalid BMP dimensions");
      const canvas = createCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      decodedBuffer = canvas.toBuffer("image/png");
      warnings.push("BMP was validated and losslessly normalized to PNG before PDF embedding.");
    }
    const metadata = await sharp(decodedBuffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false, failOn: "warning" }).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("missing image dimensions");
    if ((metadata.pages || 1) > 1) warnings.push("Multi-frame image rendered as its first frame.");
    const density = extension(fileName) !== "bmp" && metadata.density && metadata.density >= 36 && metadata.density <= 2_400 ? metadata.density : null;
    if (!density) warnings.push("No reliable physical DPI was present; one source pixel was mapped to one PDF point, with downscaling only when required by the 48-inch page-edge limit.");
    const normalized = await sharp(decodedBuffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false, failOn: "warning" })
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    let png = normalized.data;
    let width = normalized.info.width;
    let height = normalized.info.height;
    if (!width || !height) throw new Error("missing normalized image dimensions");
    let pageWidth = density ? width * 72 / density : width;
    let pageHeight = density ? height * 72 / density : height;
    if (crop) {
      const left = Math.min(width - 1, Math.max(0, Math.round(crop.x * width)));
      const top = Math.min(height - 1, Math.max(0, Math.round(crop.y * height)));
      const cropWidth = Math.min(width - left, Math.max(1, Math.round(crop.width * width)));
      const cropHeight = Math.min(height - top, Math.max(1, Math.round(crop.height * height)));
      const cropped = await sharp(png, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" })
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      png = cropped.data;
      width = cropped.info.width;
      height = cropped.info.height;
      pageWidth = density ? width * 72 / density : width;
      pageHeight = density ? height * 72 / density : height;
      warnings.push("Persisted RFI presentation crop applied.");
    }
    const scale = Math.min(1, MAX_IMAGE_PAGE_EDGE / pageWidth, MAX_IMAGE_PAGE_EDGE / pageHeight);
    pageWidth *= scale;
    pageHeight *= scale;
    if (scale < 1) warnings.push("Image was downscaled proportionally to the deterministic 48-inch maximum page edge; it was not cropped or stretched.");
    return { png, pixelWidth: width, pixelHeight: height, pageWidth, pageHeight, warnings };
  } catch (error) {
    if (error instanceof CompletePackageError) throw error;
    throw new CompletePackageError(`${fileName} is corrupt or uses unsupported image encoding.`, "corrupt_file", fileName);
  }
}

export async function renderCompletePackageImageForProof(fileName: string, buffer: Buffer, crop: CompletePackageInputItem["crop"] = null): Promise<NormalizedImagePage & { pdf: Buffer }> {
  const normalized = await normalizeImagePage(fileName, buffer, crop);
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(normalized.png);
  const page = pdf.addPage([normalized.pageWidth, normalized.pageHeight]);
  page.drawImage(image, { x: 0, y: 0, width: normalized.pageWidth, height: normalized.pageHeight });
  return { ...normalized, pdf: Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false })) };
}

async function convertItem(item: CompletePackageInputItem, signal?: AbortSignal): Promise<ConvertedItem> {
  if (signal?.aborted) throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled");
  const fileName = cleanFileName(item.fileName || item.label);
  const buffer = item.buffer;
  if (!buffer) throw new CompletePackageError(`${fileName} is unavailable.`, "missing_file", fileName);
  if (!buffer.length) throw new CompletePackageError(`${fileName} is empty.`, "corrupt_file", fileName);
  if (buffer.length > MAX_SOURCE_BYTES) throw new CompletePackageError(`${fileName} exceeds the ${MAX_SOURCE_BYTES / 1024 / 1024} MB package source limit.`, "resource_limit", fileName);
  const ext = extension(fileName);
  const sourceHash = sha256(buffer);
  let pdfBuffer: Buffer;
  let method: string;
  let warnings: string[] = [];
  let sourcePages: PdfPageInventory[] = [];
  let sourcePageCount: number | null = null;

  if (ext === "pdf") {
    const loaded = await loadPdf(buffer, fileName);
    pdfBuffer = buffer;
    sourcePages = loaded.inventory;
    sourcePageCount = loaded.pdf.getPageCount();
    method = "Native PDF page import (no rasterization or page-size normalization)";
    warnings.push("Source PDF annotations are imported as supported by pdf-lib; cross-document destinations are not rewritten.");
  } else if (["doc", "docx", "xls", "xlsx"].includes(ext)) {
    pdfBuffer = await convertWithLibreOffice(fileName, buffer, signal);
    method = "LibreOffice headless conversion with isolated profile and restricted child environment";
    warnings.push("OOXML external relationships are rejected before conversion. LibreOffice still runs with the host process account and is not an OS-level network or filesystem sandbox.");
  } else if (["csv", "txt"].includes(ext)) {
    pdfBuffer = await renderTextFile(fileName, buffer, signal);
    method = ext === "csv" ? "UTF-8 CSV table conversion through XLSX and LibreOffice" : "UTF-8 text conversion through DOCX and LibreOffice";
    warnings.push("LibreOffice runs with a restricted child environment and isolated profile, but not an OS-level network or filesystem sandbox.");
  } else if (["png", "jpg", "jpeg", "tif", "tiff", "bmp", "gif", "webp"].includes(ext)) {
    const rendered = await renderCompletePackageImageForProof(fileName, buffer, item.role === "presentation-image" ? item.crop : null);
    pdfBuffer = rendered.pdf;
    warnings = rendered.warnings;
    method = "Sharp validated decode and lossless PDF image embedding";
  } else if (ext === "msg") {
    throw new CompletePackageError(`${fileName} cannot be included because production-safe Outlook MSG conversion is not available.`, "unsupported_format", fileName);
  } else {
    throw new CompletePackageError(`${fileName} has an unsupported Complete RFI PDF file type.`, "unsupported_format", fileName);
  }

  const converted = await loadPdf(pdfBuffer, fileName);
  if (!sourcePages.length) sourcePages = converted.inventory;
  if (sourcePageCount == null) sourcePageCount = converted.pdf.getPageCount();
  return { pdf: pdfBuffer, method, warnings, sourcePages, sourcePageCount, convertedSha256: sha256(pdfBuffer) || sourceHash };
}

function renderManifestPdf(args: {
  rfiNumber: string;
  projectName: string;
  fingerprint: string;
  items: CompletePackageManifestItem[];
  manifestPageRange: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createPdfDocument({ margin: 44, size: "LETTER", autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const bottom = 742;
    const ensure = (height: number) => { if (doc.y + height > bottom) doc.addPage(); };
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#173F6B").text("COMPLETE RFI PDF PACKAGE MANIFEST");
    doc.moveDown(0.35).font("Helvetica").fontSize(9).fillColor("#334155")
      .text(`RFI: ${cleanLabel(args.rfiNumber)}`)
      .text(`Project: ${cleanLabel(args.projectName)}`)
      .text(`Logical package fingerprint: ${args.fingerprint}`)
      .text(`Manifest pages: ${args.manifestPageRange}`)
      .text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(0.6).fontSize(8).fillColor("#64748B")
      .text("The logical fingerprint is derived from canonical saved package state and source hashes, not PDF serialization or generation time.")
      .text("Office security boundary: OOXML external relationships are rejected before conversion; macros and interactive prompts are disabled; application secrets are excluded from the child environment. LibreOffice still runs under the host process account and is not an OS-level network or filesystem sandbox.");
    for (const item of args.items) {
      ensure(115);
      doc.moveDown(0.7).font("Helvetica-Bold").fontSize(10).fillColor("#173F6B")
        .text(`${item.order}. ${cleanLabel(item.label)}`);
      doc.font("Helvetica").fontSize(8).fillColor("#111827")
        .text(`Source type: ${cleanLabel(item.sourceType)} | Status: ${item.included ? "Included" : "Excluded"}`)
        .text(`Page range: ${item.pageRange || "No package pages"} | Source pages: ${item.sourcePageCount ?? "Not applicable"}`)
        .text(`Conversion method: ${cleanLabel(item.conversionMethod)}`)
        .text(`Source SHA-256: ${item.sourceSha256 || "Not applicable"}`)
        .text(`Converted-output SHA-256: ${item.convertedSha256 || "Not applicable"}`);
      if (item.sourcePages.length) {
        const pages = item.sourcePages.map(page => `p${page.page} MediaBox[${page.mediaBox.join(" ")}] CropBox[${page.cropBox.join(" ")}] rot ${page.rotation}`).join("; ");
        doc.text(`Original page inventory: ${pages}`);
      }
      item.warnings.forEach(warning => doc.fillColor("#7C2D12").text(`Warning: ${cleanLabel(warning)}`));
      if (item.failureState) doc.fillColor("#991B1B").text(`Failure: ${cleanLabel(item.failureState)}`);
    }
    doc.end();
  });
}

async function appendPdf(target: PDFDocument, buffer: Buffer, label: string): Promise<{ start: number; end: number; inventory: PdfPageInventory[] }> {
  const loaded = await loadPdf(buffer, label);
  const start = target.getPageCount() + 1;
  if (start + loaded.pdf.getPageCount() - 1 > MAX_PACKAGE_PAGES) throw new CompletePackageError(`The Complete RFI PDF exceeds the ${MAX_PACKAGE_PAGES}-page package limit.`, "resource_limit");
  const pages = await target.copyPages(loaded.pdf, loaded.pdf.getPageIndices());
  pages.forEach(page => target.addPage(page));
  const copiedInventory = inventoryPdf(target).slice(start - 1);
  const structuralBoxes = (inventory: PdfPageInventory[]) => inventory.map(page => ({ ...page, page: 0 }));
  if (JSON.stringify(structuralBoxes(copiedInventory)) !== JSON.stringify(structuralBoxes(loaded.inventory))) {
    throw new CompletePackageError(`${label} page boxes or rotation changed during package assembly.`, "package_validation", label);
  }
  return { start, end: target.getPageCount(), inventory: loaded.inventory };
}

export async function buildCompleteRfiPackage(args: {
  rfiNumber: string;
  projectName: string;
  canonicalRfiPdf: Buffer;
  logicalState: unknown;
  items: CompletePackageInputItem[];
  signal?: AbortSignal;
}): Promise<CompletePackageResult> {
  if (args.signal?.aborted) throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled");
  const included = args.items.filter(item => item.include);
  const totalBytes = included.reduce((sum, item) => sum + (item.buffer?.length || 0), args.canonicalRfiPdf.length);
  if (totalBytes > MAX_TOTAL_SOURCE_BYTES) throw new CompletePackageError("The selected Complete RFI PDF sources exceed the 300 MB package limit.", "resource_limit");

  const prepared = new Map<number, ConvertedItem>();
  for (const item of included) {
    if (args.signal?.aborted) throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled");
    prepared.set(item.order, await convertItem(item, args.signal));
  }
  const sourceHashes = args.items.map(item => ({
    order: item.order,
    label: cleanLabel(item.label),
    sourceType: item.sourceType,
    include: item.include,
    role: item.role || "attachment",
    sourceSha256: item.buffer ? sha256(item.buffer) : null,
    crop: item.role === "presentation-image" ? item.crop || null : null,
  }));
  const logicalFingerprint = sha256(JSON.stringify(canonicalize({ state: args.logicalState, sources: sourceHashes })));
  const output = await PDFDocument.create();
  const manifest: CompletePackageManifestItem[] = [];
  const canonical = await appendPdf(output, args.canonicalRfiPdf, "BIMLog RFI record");
  manifest.push({
    order: 0, label: "BIMLog canonical RFI record", sourceType: "BIMLog-generated RFI pages", included: true,
    sourceSha256: sha256(args.canonicalRfiPdf), sourcePageCount: canonical.inventory.length,
    pageRange: `${canonical.start}-${canonical.end}`, sourcePages: canonical.inventory,
    conversionMethod: "Build 5 canonical RFI PDF renderer", convertedSha256: sha256(args.canonicalRfiPdf), warnings: [], failureState: null,
  });

  for (const item of [...args.items].sort((left, right) => left.order - right.order)) {
    if (args.signal?.aborted) throw new CompletePackageError("Complete RFI PDF generation was cancelled.", "cancelled");
    const label = cleanLabel(item.label);
    if (!item.include) {
      manifest.push({ order: item.order + 1, label, sourceType: item.sourceType, included: false, sourceSha256: item.buffer ? sha256(item.buffer) : null, sourcePageCount: null, pageRange: null, sourcePages: [], conversionMethod: "Not converted", convertedSha256: null, warnings: item.exclusionReason ? [item.exclusionReason] : [], failureState: null });
      continue;
    }
    const converted = prepared.get(item.order)!;
    const range = await appendPdf(output, converted.pdf, label);
    manifest.push({
      order: item.order + 1, label, sourceType: item.sourceType, included: true,
      sourceSha256: sha256(item.buffer!), sourcePageCount: converted.sourcePageCount,
      pageRange: `${range.start}-${range.end}`, sourcePages: converted.sourcePages,
      conversionMethod: converted.method, convertedSha256: converted.convertedSha256,
      warnings: converted.warnings, failureState: null,
    });
  }

  const manifestStart = output.getPageCount() + 1;
  let manifestPdf = await renderManifestPdf({ rfiNumber: args.rfiNumber, projectName: args.projectName, fingerprint: logicalFingerprint, items: manifest, manifestPageRange: "0000-0000" });
  const manifestProbe = await loadPdf(manifestPdf, "Complete RFI PDF manifest");
  let manifestRange = `${manifestStart}-${manifestStart + manifestProbe.pdf.getPageCount() - 1}`;
  manifestPdf = await renderManifestPdf({ rfiNumber: args.rfiNumber, projectName: args.projectName, fingerprint: logicalFingerprint, items: manifest, manifestPageRange: manifestRange });
  const finalManifestProbe = await loadPdf(manifestPdf, "Complete RFI PDF manifest");
  if (finalManifestProbe.pdf.getPageCount() !== manifestProbe.pdf.getPageCount()) {
    manifestRange = `${manifestStart}-${manifestStart + finalManifestProbe.pdf.getPageCount() - 1}`;
    manifestPdf = await renderManifestPdf({ rfiNumber: args.rfiNumber, projectName: args.projectName, fingerprint: logicalFingerprint, items: manifest, manifestPageRange: manifestRange });
  }
  await appendPdf(output, manifestPdf, "Complete RFI PDF manifest");
  const buffer = Buffer.from(await output.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false }));
  const validated = await loadPdf(buffer, "Complete RFI PDF package");
  return { buffer, logicalFingerprint, pageCount: validated.pdf.getPageCount(), manifest, manifestPageRange: manifestRange };
}
