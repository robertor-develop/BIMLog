import crypto from "node:crypto";

export type DrawingIdentity = {
  tenantId: number; projectId: number; fileId: number; fileSha256: string;
  setCode: string; sheetNumber: string; title: string; discipline: string;
};

const normalized = (value: string, code: string) => {
  const result = value.trim().replace(/\s+/g, " ");
  if (!result) throw new Error(code);
  return result;
};

export function defineDrawingIdentity(input: DrawingIdentity) {
  if (![input.tenantId, input.projectId, input.fileId].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("DRAWING_SCOPE_INVALID");
  const fileSha256 = input.fileSha256.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fileSha256)) throw new Error("DRAWING_FILE_DIGEST_INVALID");
  const setCode = normalized(input.setCode, "DRAWING_SET_REQUIRED").toUpperCase();
  const sheetNumber = normalized(input.sheetNumber, "DRAWING_SHEET_REQUIRED").toUpperCase();
  const body = Object.freeze({ tenantId: input.tenantId, projectId: input.projectId, fileId: input.fileId, fileSha256, setCode, sheetNumber,
    title: normalized(input.title, "DRAWING_TITLE_REQUIRED"), discipline: normalized(input.discipline, "DRAWING_DISCIPLINE_REQUIRED"),
    projectSheetKey: `${input.tenantId}:${input.projectId}:${setCode}:${sheetNumber}` });
  return Object.freeze({ ...body, fingerprint: crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
