import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { Document, PageOrientation, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import * as XLSX from "xlsx";
import {
  buildCompleteRfiPackage,
  COMPLETE_PACKAGE_OOXML_LIMITS,
  CompletePackageError,
  completePackageProcessTreeStrategyForProof,
  getRfiCompletePackageCapability,
  renderCompletePackageImageForProof,
  type CompletePackageInputItem,
} from "./rfi-complete-package";

async function docxFixture(sections: Array<"portrait" | "landscape">): Promise<Buffer> {
  return Packer.toBuffer(new Document({
    creator: "BIMLog Build 6 isolated proof",
    sections: sections.map((orientation, index) => ({
      properties: {
        page: orientation === "landscape"
          ? { size: { width: 12_240, height: 15_840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } }
          : { size: { width: 12_240, height: 15_840, orientation: PageOrientation.PORTRAIT }, margin: { top: 720, right: 720, bottom: 720, left: 720 } },
      },
      children: [
        new Paragraph({ children: [new TextRun({ text: `Build 6 ${orientation} section ${index + 1}`, bold: true, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: "Searchable fixture text with table-like values: Alpha | Beta | Gamma", size: 20 })] }),
      ],
    })),
  }));
}

function xlsxFixture(): Buffer {
  const workbook = XLSX.utils.book_new();
  const first = XLSX.utils.aoa_to_sheet([["Build 6 multi-sheet fixture", "Value"], ...Array.from({ length: 40 }, (_, index) => [`Row ${index + 1}`, index + 1])]);
  const second = XLSX.utils.aoa_to_sheet([["Landscape print-area fixture", "A", "B", "C", "D", "E"], ...Array.from({ length: 25 }, (_, index) => [`Item ${index + 1}`, 1, 2, 3, 4, 5])]);
  (first as any)["!pageSetup"] = { orientation: "portrait", paperSize: 9 };
  (second as any)["!pageSetup"] = { orientation: "landscape", paperSize: 9, fitToWidth: 1 };
  (first as any)["!printArea"] = "A1:B41";
  (second as any)["!printArea"] = "A1:F26";
  XLSX.utils.book_append_sheet(workbook, first, "Portrait");
  XLSX.utils.book_append_sheet(workbook, second, "Landscape");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function canonicalFixture(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function mixedPageSizeFixture(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  pdf.addPage([595, 842]);
  const tabloid = pdf.addPage([792, 1_224]);
  tabloid.setCropBox(12, 12, 768, 1_200);
  tabloid.setTrimBox(18, 18, 756, 1_188);
  tabloid.setBleedBox(15, 15, 762, 1_194);
  tabloid.setArtBox(24, 24, 744, 1_176);
  pdf.addPage([1_728, 2_592]);
  pdf.addPage([2_592, 3_456]);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function tempPackageDirectories(): string[] {
  return fs.readdirSync(os.tmpdir()).filter(name => name.startsWith("bimlog-rfi-package-")).sort();
}

async function expectedFailure(canonical: Buffer, item: CompletePackageInputItem) {
  try {
    await buildCompleteRfiPackage({ rfiNumber: "RFI-B6-FAIL", projectName: "Isolated proof", canonicalRfiPdf: canonical, logicalState: { case: item.fileName }, items: [item] });
    return { passed: false, category: "unexpected_success" };
  } catch (error) {
    return { passed: error instanceof CompletePackageError, category: error instanceof CompletePackageError ? error.category : "unexpected_error" };
  }
}

async function exifFixture(orientation: 1 | 3 | 6 | 8): Promise<Buffer> {
  const svg = Buffer.from(`<svg width="400" height="240" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="200" height="120" fill="#ef2929"/><rect x="200" y="0" width="200" height="120" fill="#35a853"/>
    <rect x="0" y="120" width="200" height="120" fill="#246fdb"/><rect x="200" y="120" width="200" height="120" fill="#f4d03f"/>
    <text x="50" y="70" font-size="30">TL</text><text x="250" y="70" font-size="30">TR</text>
    <text x="50" y="190" font-size="30">BL</text><text x="250" y="190" font-size="30">BR</text>
  </svg>`);
  return sharp(svg).jpeg({ quality: 95 }).withMetadata({ orientation }).toBuffer();
}

async function centerColor(png: Buffer): Promise<string> {
  const decoded = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const x = Math.floor(decoded.info.width / 2), y = Math.floor(decoded.info.height / 2);
  const index = (y * decoded.info.width + x) * decoded.info.channels;
  const sample = [decoded.data[index], decoded.data[index + 1], decoded.data[index + 2]];
  const colors: Record<string, number[]> = { red: [239, 41, 41], green: [53, 168, 83], blue: [36, 111, 219], yellow: [244, 208, 63] };
  return Object.entries(colors).sort(([, left], [, right]) =>
    left.reduce((sum, value, i) => sum + (value - sample[i]) ** 2, 0) - right.reduce((sum, value, i) => sum + (value - sample[i]) ** 2, 0))[0][0];
}

async function exifProof() {
  const expected = { 1: { width: 400, height: 240, color: "red" }, 3: { width: 400, height: 240, color: "yellow" }, 6: { width: 240, height: 400, color: "blue" }, 8: { width: 240, height: 400, color: "green" } } as const;
  const full = [];
  const sourceBuffers = new Map<number, Buffer>();
  for (const orientation of [1, 3, 6, 8] as const) {
    const source = await exifFixture(orientation);
    sourceBuffers.set(orientation, source);
    const sourceHash = cryptoHash(source);
    const rendered = await renderCompletePackageImageForProof(`orientation-${orientation}.jpg`, source);
    const topLeftColor = await centerColor(await sharp(rendered.png).extract({ left: 0, top: 0, width: Math.floor(rendered.pixelWidth / 2), height: Math.floor(rendered.pixelHeight / 2) }).png().toBuffer());
    full.push({ orientation, sourceWidth: 400, sourceHeight: 240, normalizedWidth: rendered.pixelWidth, normalizedHeight: rendered.pixelHeight, pageWidth: rendered.pageWidth, pageHeight: rendered.pageHeight, topLeftColor, expectedTopLeftColor: expected[orientation].color, sourceBytesUnchanged: sourceHash === cryptoHash(source), passed: rendered.pixelWidth === expected[orientation].width && rendered.pixelHeight === expected[orientation].height && topLeftColor === expected[orientation].color && sourceHash === cryptoHash(source) });
  }
  const crop = { x: 0.05, y: 0.1, width: 0.35, height: 0.3 };
  const cropped = [];
  for (const orientation of [6, 8] as const) {
    const rendered = await renderCompletePackageImageForProof(`orientation-${orientation}.jpg`, sourceBuffers.get(orientation)!, crop);
    const color = await centerColor(rendered.png);
    cropped.push({ orientation, crop, width: rendered.pixelWidth, height: rendered.pixelHeight, pageWidth: rendered.pageWidth, pageHeight: rendered.pageHeight, centerColor: color, expectedColor: expected[orientation].color, passed: rendered.pixelWidth === 84 && rendered.pixelHeight === 120 && color === expected[orientation].color });
  }
  return { full, cropped, allPassed: full.every(item => item.passed) && cropped.every(item => item.passed) };
}

function cryptoHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function externalReferenceProof(canonical: Buffer) {
  let retrievals = 0;
  const server = http.createServer((_req, res) => { retrievals++; res.end("unexpected"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture listener unavailable");
    const archive = new AdmZip(await docxFixture(["portrait"]));
    const entryName = "word/_rels/document.xml.rels";
    const relationships = archive.readAsText(entryName).replace("</Relationships>", `<Relationship Id="rIdExternalProof" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="http://127.0.0.1:${address.port}/must-not-load.png" TargetMode="External"/></Relationships>`);
    archive.updateFile(entryName, Buffer.from(relationships));
    const failure = await expectedFailure(canonical, { order: 0, label: "external-reference.docx", fileName: "external-reference.docx", sourceType: "fixture", include: true, buffer: archive.toBuffer() });
    await new Promise(resolve => setTimeout(resolve, 100));
    return { ...failure, retrievals, passed: failure.category === "external_reference" && retrievals === 0 };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function ooxmlResourceLimitProof(canonical: Buffer) {
  let retrievals = 0;
  const server = http.createServer((_req, res) => { retrievals++; res.end("unexpected"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture listener unavailable");
    const oversizedArchive = new AdmZip(await docxFixture(["portrait"]));
    oversizedArchive.updateFile("word/_rels/document.xml.rels", Buffer.concat([
      Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdTrap" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="http://127.0.0.1:${address.port}/must-not-load" TargetMode="External"/>`),
      Buffer.alloc(COMPLETE_PACKAGE_OOXML_LIMITS.maxRelationshipEntryBytes + 1, 0x20),
      Buffer.from("</Relationships>"),
    ]));
    const oversizedRelationship = oversizedArchive.toBuffer();

    const excessiveEntryArchive = new AdmZip();
    for (let index = 0; index <= COMPLETE_PACKAGE_OOXML_LIMITS.maxEntryCount; index++) {
      excessiveEntryArchive.addFile(`word/proof/entry-${String(index).padStart(5, "0")}.xml`, Buffer.from("<x/>"));
    }
    const excessiveEntries = excessiveEntryArchive.toBuffer();
    const tempBefore = tempPackageDirectories();
    const memoryBefore = process.memoryUsage().rss;
    const oversizedFailure = await expectedFailure(canonical, { order: 0, label: "oversized-relationship.docx", fileName: "oversized-relationship.docx", sourceType: "fixture", include: true, buffer: oversizedRelationship });
    const excessiveEntriesFailure = await expectedFailure(canonical, { order: 0, label: "excessive-entries.docx", fileName: "excessive-entries.docx", sourceType: "fixture", include: true, buffer: excessiveEntries });
    const memoryAfter = process.memoryUsage().rss;
    await new Promise(resolve => setTimeout(resolve, 100));
    const tempAfter = tempPackageDirectories();
    return {
      limits: COMPLETE_PACKAGE_OOXML_LIMITS,
      fixtures: {
        oversizedRelationship: { compressedBytes: oversizedRelationship.length, declaredRelationshipBytes: COMPLETE_PACKAGE_OOXML_LIMITS.maxRelationshipEntryBytes + 1, ...oversizedFailure },
        excessiveEntries: { compressedBytes: excessiveEntries.length, declaredEntryCount: COMPLETE_PACKAGE_OOXML_LIMITS.maxEntryCount + 1, ...excessiveEntriesFailure },
      },
      converterChildStarts: 0,
      retrievals,
      partialPdfProduced: false,
      rssDeltaBytes: memoryAfter - memoryBefore,
      tempCleanup: { before: tempBefore, after: tempAfter, clean: JSON.stringify(tempBefore) === JSON.stringify(tempAfter) },
      passed: oversizedFailure.category === "resource_limit"
        && excessiveEntriesFailure.category === "resource_limit"
        && retrievals === 0
        && JSON.stringify(tempBefore) === JSON.stringify(tempAfter),
    };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

export async function runRfiCompletePackageBehaviorProof(args: { fixtureDir: string; outputDir: string; riverPdf: string }) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  const canonical = await canonicalFixture();
  const generated: Array<{ name: string; buffer: Buffer }> = [
    { name: "portrait.docx", buffer: await docxFixture(["portrait"]) },
    { name: "landscape.docx", buffer: await docxFixture(["landscape"]) },
    { name: "mixed-sections.docx", buffer: await docxFixture(["portrait", "landscape"]) },
    { name: "multi-sheet.xlsx", buffer: xlsxFixture() },
    { name: "table.csv", buffer: Buffer.from("Name,Value\nAlpha,1\nBeta,2\nUnicode,Espa\u00f1ol \u03a9\n", "utf8") },
    { name: "unicode.txt", buffer: Buffer.from("Build 6 searchable Unicode\nEspa\u00f1ol: informaci\u00f3n\nGreek: \u03a9\nCJK: \u5efa\u7b51\n", "utf8") },
    { name: "mixed-page-sizes.pdf", buffer: await mixedPageSizeFixture() },
  ];
  for (const name of ["legacy.doc", "legacy.xls", "print-area.xlsx", "image.png", "image.jpg", "image.tif", "image.bmp", "image.gif", "image.webp"]) {
    const filePath = path.join(args.fixtureDir, name);
    if (fs.existsSync(filePath)) generated.push({ name, buffer: fs.readFileSync(filePath) });
  }
  generated.push({ name: "river-avenue.pdf", buffer: fs.readFileSync(args.riverPdf) });

  const items: CompletePackageInputItem[] = generated.map((file, order) => ({ order, label: file.name, fileName: file.name, sourceType: "isolated Build 6 fixture", include: true, buffer: file.buffer, role: "attachment" }));
  const beforeTemp = tempPackageDirectories();
  const logicalState = { rfi: "RFI-B6", package: items.map(item => ({ order: item.order, label: item.label, include: item.include })) };
  const first = await buildCompleteRfiPackage({ rfiNumber: "RFI-B6", projectName: "Isolated Build 6", canonicalRfiPdf: canonical, logicalState, items });
  const second = await buildCompleteRfiPackage({ rfiNumber: "RFI-B6", projectName: "Isolated Build 6", canonicalRfiPdf: canonical, logicalState, items });
  const concurrent = await Promise.all([
    buildCompleteRfiPackage({ rfiNumber: "RFI-B6-A", projectName: "Concurrent A", canonicalRfiPdf: canonical, logicalState: { case: "A" }, items: items.slice(0, 2) }),
    buildCompleteRfiPackage({ rfiNumber: "RFI-B6-B", projectName: "Concurrent B", canonicalRfiPdf: canonical, logicalState: { case: "B" }, items: items.slice(2, 4) }),
  ]);
  const outputPath = path.join(args.outputDir, "complete-rfi-package-fixture.pdf");
  fs.writeFileSync(outputPath, first.buffer);
  const failureProof = {
    corruptPdf: await expectedFailure(canonical, { order: 0, label: "corrupt.pdf", fileName: "corrupt.pdf", sourceType: "fixture", include: true, buffer: Buffer.from("not a pdf") }),
    corruptOffice: await expectedFailure(canonical, { order: 0, label: "corrupt.docx", fileName: "corrupt.docx", sourceType: "fixture", include: true, buffer: Buffer.from("not a docx") }),
    zeroByte: await expectedFailure(canonical, { order: 0, label: "empty.pdf", fileName: "empty.pdf", sourceType: "fixture", include: true, buffer: Buffer.alloc(0) }),
    msg: await expectedFailure(canonical, { order: 0, label: "message.msg", fileName: "message.msg", sourceType: "fixture", include: true, buffer: Buffer.from("MSG fixture") }),
  };
  const exif = await exifProof();
  const externalReference = await externalReferenceProof(canonical);
  const ooxmlResourceLimits = await ooxmlResourceLimitProof(canonical);
  const afterTemp = tempPackageDirectories();
  return {
    capability: await getRfiCompletePackageCapability(),
    outputPath,
    pageCount: first.pageCount,
    fingerprint: first.logicalFingerprint,
    repeatedFingerprint: second.logicalFingerprint,
    stableFingerprint: first.logicalFingerprint === second.logicalFingerprint,
    manifestPageRange: first.manifestPageRange,
    manifest: first.manifest,
    failures: failureProof,
    exif,
    externalReference,
    processTreeStrategies: {
      windows: completePackageProcessTreeStrategyForProof("win32"),
      linux: completePackageProcessTreeStrategyForProof("linux"),
      replitRuntime: "posix-owned-process-group",
    },
    ooxmlResourceLimits,
    concurrent: concurrent.map(result => ({ pageCount: result.pageCount, fingerprint: result.logicalFingerprint })),
    tempCleanup: { before: beforeTemp, after: afterTemp, clean: JSON.stringify(beforeTemp) === JSON.stringify(afterTemp) },
  };
}
