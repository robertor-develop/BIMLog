export const LENS_REFERENCE_MAX_BYTES = 5 * 1024 * 1024;
const types = new Map([["pdf", "application/pdf"], ["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"]]);

export class LensReferenceValidationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); this.name = "LensReferenceValidationError"; }
}

export function cleanLensReferenceFileName(value: string): string {
  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
}

export function validateLensReferenceFile(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): { fileName: string; mimeType: string } {
  const fileName = cleanLensReferenceFileName(file.originalname), extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const mimeType = types.get(extension);
  if (!fileName || !mimeType || file.mimetype.toLowerCase() !== mimeType) throw new LensReferenceValidationError("unsupported_reference_type", "Only PDF, JPG/JPEG, and PNG reference files are allowed.", 415);
  if (file.size <= 0 || file.size > LENS_REFERENCE_MAX_BYTES) throw new LensReferenceValidationError("reference_too_large", "Reference files must be no larger than 5 MB.", 413);
  const bytes = file.buffer;
  const signatureValid = extension === "pdf" ? bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
    : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
    : bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!signatureValid) throw new LensReferenceValidationError("reference_signature_mismatch", "The file content does not match its declared reference-file type.", 415);
  return { fileName, mimeType };
}
