export type PreparedBrowserDownload = Readonly<{ url: string; filename: string }>;

type BrowserDownloadEnvironment = Readonly<{
  createObjectURL: (blob: Blob) => string;
  document: Pick<Document, "createElement" | "body">;
}>;

export function prepareBrowserDownload(
  blob: Blob,
  filename: string,
  environment: BrowserDownloadEnvironment = { createObjectURL: URL.createObjectURL.bind(URL), document },
): PreparedBrowserDownload {
  if (!filename.trim()) throw new Error("A download filename is required.");
  const url = environment.createObjectURL(blob);
  const anchor = environment.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.hidden = true;
  environment.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  return Object.freeze({ url, filename });
}
