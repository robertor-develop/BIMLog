import path from "node:path";

const BLOCKED_EXTENSIONS = new Set([".exe", ".dll", ".com", ".scr", ".msi", ".ps1", ".bat", ".cmd", ".js", ".vbs", ".hta"]);
const MAX_PROJECT_FILE_BYTES = 500 * 1024 * 1024;

export class ProjectFileUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly messageEs: string,
  ) { super(message); }
}

function executableSignature(bytes: Buffer) {
  return bytes.subarray(0, 2).equals(Buffer.from("MZ"))
    || bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
    || bytes.subarray(0, 2).equals(Buffer.from("#!"));
}

export function inspectProjectFileUpload(input: { fileName: string; mediaType: string; bytes: Buffer }) {
  const normalized = input.fileName.normalize("NFKC").trim();
  if (!normalized || normalized !== path.basename(normalized) || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ProjectFileUploadError(400, "PROJECT_FILE_NAME_REJECTED", "The file name is invalid.", "El nombre del archivo no es válido.");
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_PROJECT_FILE_BYTES) {
    throw new ProjectFileUploadError(413, "PROJECT_FILE_SIZE_REJECTED", "The file is empty or exceeds the 500 MB limit.", "El archivo está vacío o supera el límite de 500 MB.");
  }
  const extension = path.extname(normalized).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension) || executableSignature(input.bytes)) {
    throw new ProjectFileUploadError(415, "PROJECT_FILE_ACTIVE_CONTENT_REJECTED", "Executable or script content is not accepted as a project file.", "No se acepta contenido ejecutable o de script como archivo del proyecto.");
  }
  return Object.freeze({ fileName: normalized, mediaType: input.mediaType || "application/octet-stream", byteSize: input.bytes.length });
}
