/** Procore secure file access: authenticate only Procore domains, including redirects.
 * https://procore.github.io/documentation/secure-file-access-tips
 */
export async function downloadProcoreFileBytes(
  fileUrl: string,
  token: string,
  fetchFile: typeof fetch = fetch,
  maxBytes = 50 * 1024 * 1024,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 50 * 1024 * 1024) throw Error("PROCORE_DOWNLOAD_LIMIT_INVALID");
  let url: URL;
  try { url = new URL(fileUrl); } catch { throw Error("PROCORE_DOWNLOAD_URL_INVALID"); }
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (url.protocol !== "https:" || url.username || url.password) throw Error("PROCORE_DOWNLOAD_URL_INVALID");
    const procore = url.hostname === "procore.com" || url.hostname.endsWith(".procore.com");
    const response = await fetchFile(url.href, {
      redirect: "manual", signal,
      headers: procore ? { Authorization: `Bearer ${token}` } : {},
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 5) throw Error("PROCORE_DOWNLOAD_REDIRECT_INVALID");
      try { url = new URL(location, url); } catch { throw Error("PROCORE_DOWNLOAD_REDIRECT_INVALID"); }
      continue;
    }
    if (response.status !== 200) { await response.body?.cancel(); throw Error(`PROCORE_DOWNLOAD_HTTP_${response.status}`); }
    const length = response.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
      await response.body?.cancel(); throw Error("PROCORE_DOWNLOAD_TOO_LARGE");
    }
    if (!response.body) throw Error("PROCORE_DOWNLOAD_EMPTY");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > maxBytes) { await reader.cancel(); throw Error("PROCORE_DOWNLOAD_TOO_LARGE"); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    if (bytes === 0) throw Error("PROCORE_DOWNLOAD_EMPTY");
    return Buffer.concat(chunks, bytes);
  }
  throw Error("PROCORE_DOWNLOAD_REDIRECT_INVALID");
}
