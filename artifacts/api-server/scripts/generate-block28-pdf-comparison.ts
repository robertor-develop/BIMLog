import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";

// The two production route modules import the fail-closed database authority at
// module load even though these exported renderers perform no database work.
// Bind an unreachable loopback test target before dynamically importing them;
// any accidental query will fail instead of reaching customer data.
process.env.PROD_DATABASE_URL = "postgresql://block28:no-access@127.0.0.1:1/block28_pdf_qa";
const { sendActivityPdf } = await import("../src/routes/activity");
const { sendCoordinatorPdf } = await import("../src/routes/coordinator-actions");

class PdfCapture extends PassThrough {
  readonly headers = new Map<string, string>();
  type(value: string) { this.headers.set("Content-Type", value); return this; }
  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
    return this;
  }
}

async function capture(render: (response: PdfCapture) => void) {
  const response = new PdfCapture();
  const chunks: Buffer[] = [];
  response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const complete = once(response, "end");
  render(response);
  await complete;
  return { buffer: Buffer.concat(chunks), headers: Object.fromEntries(response.headers) };
}

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const outputDirectory = process.env.BIMLOG_BLOCK28_PDF_OUTPUT
  ? path.resolve(process.env.BIMLOG_BLOCK28_PDF_OUTPUT)
  : path.join(os.tmpdir(), "bimlog-block28-pdf-qa");
await fs.mkdir(outputDirectory, { recursive: true });

const project = { id: 28, name: "BIMLog Block 28 QA", code: "BLK28" };
const generatedAt = new Date("2026-09-20T20:00:00.000Z");
const samples = [
  {
    name: "activity-en.pdf",
    requiredText: ["Activity Log", "No activity events match the current filters"],
    render: (response: PdfCapture) => sendActivityPdf(response as never, { project, companyName: "IgniteSmart QA", rows: [], totalRows: 0, query: { lang: "en" } }),
  },
  {
    name: "activity-es.pdf",
    requiredText: ["Registro de Actividad", "Ningún evento de actividad coincide con los filtros actuales"],
    render: (response: PdfCapture) => sendActivityPdf(response as never, { project, companyName: "IgniteSmart QA", rows: [], totalRows: 0, query: { lang: "es" } }),
  },
  {
    name: "coordinator-en.pdf",
    requiredText: ["Coordinator Command Center", "No actions match the current filters"],
    render: (response: PdfCapture) => sendCoordinatorPdf(response as never, {
      project, companyName: "IgniteSmart QA", generatedAt, lang: "en", filters: [["Source modules", "All"]],
      result: { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 } as never,
    }),
  },
  {
    name: "coordinator-es.pdf",
    requiredText: ["Centro de Control de Coordinación", "Ninguna acción coincide con los filtros actuales"],
    render: (response: PdfCapture) => sendCoordinatorPdf(response as never, {
      project, companyName: "IgniteSmart QA", generatedAt, lang: "es", filters: [["Módulos fuente", "Todos"]],
      result: { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 } as never,
    }),
  },
] as const;

const report = [];
for (const sample of samples) {
  const result = await capture(sample.render);
  assert.equal(result.headers["Content-Type"], "application/pdf");
  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(result.headers["Cache-Control"], "private, no-store");
  assert.match(result.headers["Content-Disposition"] ?? "", /filename\*=UTF-8''/u);
  assert.ok(result.buffer.subarray(0, 5).equals(Buffer.from("%PDF-")));

  const document = await PDFDocument.load(result.buffer, { updateMetadata: false });
  const pages = document.getPages();
  assert.ok(pages.length >= 1);
  for (const page of pages) {
    assert.equal(page.getWidth(), 792);
    assert.equal(page.getHeight(), 612);
  }

  const parser = new PDFParse({ data: result.buffer, verbosity: 0 });
  const parsed = await parser.getText();
  await parser.destroy();
  for (const text of sample.requiredText) assert.match(parsed.text, new RegExp(text, "iu"));

  const target = path.join(outputDirectory, sample.name);
  await fs.writeFile(target, result.buffer);
  report.push({
    file: sample.name,
    bytes: result.buffer.byteLength,
    sha256: createHash("sha256").update(result.buffer).digest("hex"),
    pageCount: pages.length,
    mediaBox: { width: pages[0].getWidth(), height: pages[0].getHeight() },
    requiredText: sample.requiredText,
    headers: result.headers,
  });
}

await fs.writeFile(path.join(outputDirectory, "comparison.json"), `${JSON.stringify({ schemaVersion: 1, build: 140, samples: report }, null, 2)}\n`);
console.log(`POST120_BUILD140_PDF_COMPARISON=PASS samples=${report.length} pages=${report.reduce((sum, item) => sum + item.pageCount, 0)}`);
