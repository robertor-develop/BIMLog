import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { FinancialControlError } from "./financial-control-contract";
import { exactDelta, exactPositiveAmount } from "./financial-contract-contract";

export type ContractExport = Awaited<ReturnType<typeof import("./financial-contract-service").contractExportData>>;

const safe = (value: unknown) => {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  if (/(?:storage[_ ]?path|[A-Za-z]:\\|https?:\/\/\S*[?&](?:token|key|signature)=)/i.test(text)) return "Protected value";
  return text;
};

export async function buildContractPdf(data: ContractExport): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 42, bufferPages: true, info: { Title: `Contract ${safe(data.contract.legalNumber)}`, Author: "BIMLog", Subject: "Operational contract and schedule of values" } });
  const chunks: Buffer[] = []; doc.on("data", (chunk) => chunks.push(chunk));
  doc.fontSize(18).text("BIMLog Contract & Commitment Record").fontSize(9).text("Operational project-control record — not an accounting posting or payment authorization.").moveDown();
  doc.fontSize(11).text(`${safe(data.project.companyName)} | ${safe(data.project.name)} (${safe(data.project.code)})`);
  doc.text(`${safe(data.contract.legalNumber)} | ${safe(data.contract.title)} | ${safe(data.contract.status)}`);
  doc.text(`${safe(data.contract.counterpartyName)} | ${safe(data.contract.perspective)} | ${safe(data.contract.contractType)}`);
  doc.text(`Original: ${data.contract.originalValue} ${data.contract.currency} | Executed amendments: ${data.contract.executedAmendmentTotal} | Current commitment: ${data.contract.currentCommitment}`).moveDown();
  doc.fontSize(12).text("Schedule of Values").fontSize(9);
  for (const line of data.contract.lines) {
    if (doc.y > 700) doc.addPage();
    doc.text(`${safe(line.projectCode)} — ${safe(line.description)}`, 42, doc.y, { continued: true, width: 400 }).text(`${line.amount} ${data.contract.currency}`, { align: "right" });
  }
  if (data.contract.amendments.length) {
    doc.moveDown().fontSize(12).text("Amendments").fontSize(9);
    for (const amendment of data.contract.amendments) doc.text(`${safe(amendment.legalNumber)} | ${safe(amendment.title)} | ${safe(amendment.status)} | ${amendment.amountDelta} ${amendment.currency}`);
  }
  doc.moveDown().fontSize(8).text(`BIMLog ID: ${safe(data.contract.bimlogId)}`).text(`Content fingerprint: ${data.contract.contentFingerprint}`).text(`Generated: ${data.generatedAt}`);
  const range = doc.bufferedPageRange(); for (let i = 0; i < range.count; i++) { doc.switchToPage(i); doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 42, 742, { align: "right", width: 528 }); }
  doc.end(); return new Promise((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
}

export function buildContractXlsx(data: ContractExport): Buffer {
  const wb = XLSX.utils.book_new();
  const sov = XLSX.utils.json_to_sheet(data.contract.lines.map((line: any) => ({ "SOV Line": safe(line.stableLineId), "Cost Code": safe(line.projectCode), "Cost Name": safe(line.projectName), Description: safe(line.description), Amount: exactPositiveAmount(line.amount), Currency: data.contract.currency, "Budget Amount": exactDelta(line.budgetAmount), "Schedule Item": line.schedule ? `${safe(line.schedule.sourceType)}:${line.schedule.sourceId}` : "" })));
  const amendments = XLSX.utils.json_to_sheet(data.contract.amendments.map((a: any) => ({ Number: safe(a.legalNumber), Title: safe(a.title), Version: a.version, Status: safe(a.status), Delta: exactDelta(a.amountDelta), Currency: a.currency, Approved: a.approvedAt ?? "", Executed: a.executedAt ?? "" })));
  const info = XLSX.utils.aoa_to_sheet([["Contract & Commitment Record"], ["Project", safe(data.project.name)], ["Project Code", safe(data.project.code)], ["Company", safe(data.project.companyName)], ["BIMLog ID", safe(data.contract.bimlogId)], ["Legal Number", safe(data.contract.legalNumber)], ["Perspective", data.contract.perspective], ["Type", data.contract.contractType], ["Counterparty", safe(data.contract.counterpartyName)], ["Status", data.contract.status], ["Currency", data.contract.currency], ["Original Value", data.contract.originalValue], ["Executed Amendment Total", data.contract.executedAmendmentTotal], ["Current Commitment", data.contract.currentCommitment], ["Content Fingerprint", data.contract.contentFingerprint], ["Generated", data.generatedAt], ["Boundary", "Operational record only; no accounting posting, invoice payment, money movement, or bank behavior."]]);
  sov["!autofilter"] = { ref: sov["!ref"] ?? "A1:H1" }; sov["!cols"] = [{wch:16},{wch:16},{wch:24},{wch:42},{wch:16},{wch:10},{wch:16},{wch:20}];
  XLSX.utils.book_append_sheet(wb, sov, "Schedule of Values"); XLSX.utils.book_append_sheet(wb, amendments, "Amendments"); XLSX.utils.book_append_sheet(wb, info, "Contract Information");
  const output: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
  const zip = new AdmZip(output), entry = zip.getEntry("xl/worksheets/sheet1.xml");
  if (!entry) throw new FinancialControlError(500, "CONTRACT_EXPORT_SHEET_MISSING", "Contract worksheet could not be finalized.");
  const xml = entry.getData().toString("utf8").replace(/(<sheetView[^>]*>)/, '$1<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
  zip.updateFile("xl/worksheets/sheet1.xml", Buffer.from(xml, "utf8")); return zip.toBuffer();
}
