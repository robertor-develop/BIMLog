export type FileCustodyInput = {
  storagePath: string | null;
  fileHash: string | null;
  fileSizeBytes: number | null;
  source: string | null;
};

export type FileCustodyState =
  | "portable"
  | "generated_on_demand"
  | "legacy_binary_missing"
  | "custody_incomplete";

export function fileCustodyState(file: FileCustodyInput): FileCustodyState {
  if (file.source === "system-generated" && !file.storagePath) return "generated_on_demand";
  if (!file.storagePath && !file.fileHash) return "legacy_binary_missing";
  if (
    file.storagePath &&
    typeof file.fileHash === "string" &&
    /^[a-f0-9]{64}$/.test(file.fileHash) &&
    Number.isSafeInteger(file.fileSizeBytes) &&
    (file.fileSizeBytes ?? -1) >= 0
  ) return "portable";
  return "custody_incomplete";
}

export function fileDownloadFailure(state: FileCustodyState) {
  if (state === "legacy_binary_missing") return {
    status: 409,
    body: {
      code: "FILE_BINARY_NOT_RETAINED",
      error: "This legacy file record is preserved, but its original binary was not retained. Contact a project administrator to restore the verified original.",
    },
  };
  return {
    status: 409,
    body: {
      code: "FILE_CUSTODY_INCOMPLETE",
      error: "This file does not have complete portable custody evidence.",
    },
  };
}
