import { getValidAccessToken, type OAuthProviderKey } from "./oauth";

// Unified browse/download across cloud providers. Each item carries an opaque
// `ref` string: for a folder it's the address to browse into; for a file it's
// what download() needs. The frontend never interprets it. Flat stores (Drive,
// Dropbox) ignore folder nesting mostly; hierarchical ones (BIM 360, Procore)
// encode the navigation level into the ref.
export interface CloudItem {
  name: string;
  type: "file" | "folder";
  ref: string;
  mimeType?: string;
  size?: number;
}

export interface BrowseResult { items: CloudItem[] }
export interface DownloadResult { buffer: Buffer; exportedPdf?: boolean }

async function j(url: string, token: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

// ─── Google Drive ─────────────────────────────────────────────────────────────
async function driveBrowse(token: string, ref: string, q: string): Promise<BrowseResult> {
  const folder = ref || "root";
  const clauses = [`'${folder}' in parents`, "trashed = false"];
  if (q) clauses.push(`name contains '${q.replace(/'/g, "\\'")}'`);
  const params = new URLSearchParams({ q: clauses.join(" and "), pageSize: "100", fields: "files(id,name,mimeType,size)", orderBy: "folder,modifiedTime desc" });
  const d = await j(`https://www.googleapis.com/drive/v3/files?${params}`, token);
  const items: CloudItem[] = (d.files || []).map((f: any) => ({
    name: f.name,
    type: f.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
    ref: f.id,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
  }));
  return { items };
}
async function driveDownload(token: string, ref: string, mimeType?: string): Promise<DownloadResult> {
  const isDoc = (mimeType || "").startsWith("application/vnd.google-apps");
  const url = isDoc
    ? `https://www.googleapis.com/drive/v3/files/${ref}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${ref}?alt=media`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive download failed (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()), exportedPdf: isDoc };
}

// ─── Dropbox ────────────────────────────────────────────────────────────────
async function dropboxBrowse(token: string, ref: string, q: string): Promise<BrowseResult> {
  if (q) {
    const d = await j("https://api.dropboxapi.com/2/files/search_v2", token, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }),
    });
    const items: CloudItem[] = (d.matches || [])
      .map((m: any) => m.metadata?.metadata).filter(Boolean)
      .map((md: any) => ({ name: md.name, type: md[".tag"] === "folder" ? "folder" : "file", ref: md.path_lower, size: md.size }));
    return { items };
  }
  const d = await j("https://api.dropboxapi.com/2/files/list_folder", token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: ref || "", recursive: false }),
  });
  const items: CloudItem[] = (d.entries || []).map((e: any) => ({
    name: e.name, type: e[".tag"] === "folder" ? "folder" : "file", ref: e.path_lower, size: e.size,
  }));
  return { items };
}
async function dropboxDownload(token: string, ref: string): Promise<DownloadResult> {
  const r = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": JSON.stringify({ path: ref }) },
  });
  if (!r.ok) throw new Error(`Dropbox download failed (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()) };
}

// ─── BIM 360 / Autodesk APS (hierarchical: hubs → projects → folders → items) ──
// ref grammar: "" | hub:<hubId> | proj:<hubId>:<projId> | folder:<projId>:<folderId>
//              file:<projId>:<itemId>
async function bim360Browse(token: string, ref: string): Promise<BrowseResult> {
  if (!ref) {
    const d = await j("https://developer.api.autodesk.com/project/v1/hubs", token);
    return { items: (d.data || []).map((h: any) => ({ name: h.attributes?.name || h.id, type: "folder" as const, ref: `hub:${h.id}` })) };
  }
  const [kind, a, b] = ref.split(":");
  if (kind === "hub") {
    const d = await j(`https://developer.api.autodesk.com/project/v1/hubs/${a}/projects`, token);
    return { items: (d.data || []).map((p: any) => ({ name: p.attributes?.name || p.id, type: "folder" as const, ref: `proj:${a}:${p.id}` })) };
  }
  if (kind === "proj") {
    const d = await j(`https://developer.api.autodesk.com/project/v1/hubs/${a}/projects/${b}/topFolders`, token);
    return { items: (d.data || []).map((f: any) => ({ name: f.attributes?.displayName || f.attributes?.name || f.id, type: "folder" as const, ref: `folder:${b}:${f.id}` })) };
  }
  // folder contents
  const projId = a, folderId = b;
  const d = await j(`https://developer.api.autodesk.com/data/v1/projects/${projId}/folders/${encodeURIComponent(folderId)}/contents`, token);
  const items: CloudItem[] = (d.data || []).map((it: any) => {
    const isFolder = it.type === "folders";
    return {
      name: it.attributes?.displayName || it.attributes?.name || it.id,
      type: isFolder ? "folder" as const : "file" as const,
      ref: isFolder ? `folder:${projId}:${it.id}` : `file:${projId}:${it.id}`,
    };
  });
  return { items };
}
async function bim360Download(token: string, ref: string): Promise<DownloadResult> {
  const [, projId, itemId] = ref.split(":");
  // Resolve the item's tip version, then its OSS storage object, then download.
  const item = await j(`https://developer.api.autodesk.com/data/v1/projects/${projId}/items/${encodeURIComponent(itemId)}`, token);
  const storageId: string | undefined = item.included?.[0]?.relationships?.storage?.data?.id
    || item.data?.relationships?.storage?.data?.id;
  if (!storageId) throw new Error("Could not resolve BIM 360 file storage");
  // storageId: urn:adsk.objects:os.object:<bucket>/<object>
  const m = storageId.match(/os\.object:([^/]+)\/(.+)$/);
  if (!m) throw new Error("Unexpected BIM 360 storage id");
  const [, bucket, object] = m;
  const signed = await j(`https://developer.api.autodesk.com/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(object)}/signeds3download`, token);
  const url: string | undefined = signed.url;
  if (!url) throw new Error("No BIM 360 download URL");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`BIM 360 download failed (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()) };
}

// ─── Procore (hierarchical: companies → projects → folders → files) ────────────
// ref grammar: "" | company:<companyId> | project:<companyId>:<projectId>
//              folder:<projectId>:<folderId> | file:<projectId>:<fileId>
async function procoreBrowse(token: string, ref: string): Promise<BrowseResult> {
  if (!ref) {
    const d = await j("https://api.procore.com/rest/v1.0/companies", token) as any[];
    return { items: (d || []).map((c: any) => ({ name: c.name, type: "folder" as const, ref: `company:${c.id}` })) };
  }
  const [kind, a, b] = ref.split(":");
  if (kind === "company") {
    const d = await j(`https://api.procore.com/rest/v1.0/projects?company_id=${a}`, token) as any[];
    return { items: (d || []).map((p: any) => ({ name: p.name, type: "folder" as const, ref: `project:${a}:${p.id}` })) };
  }
  // project root or a folder: Procore folders endpoint returns folders + files
  const projectId = kind === "project" ? b : a;
  const folderParam = kind === "folder" ? `&folder_id=${b}` : "";
  const d = await j(`https://api.procore.com/rest/v1.0/folders?project_id=${projectId}${folderParam}`, token) as any;
  const folders = (d.folders || []).map((f: any) => ({ name: f.name, type: "folder" as const, ref: `folder:${projectId}:${f.id}` }));
  const files = (d.files || []).map((f: any) => ({ name: f.name, type: "file" as const, ref: `file:${projectId}:${f.id}` }));
  return { items: [...folders, ...files] };
}
async function procoreDownload(token: string, ref: string): Promise<DownloadResult> {
  const [, projectId, fileId] = ref.split(":");
  const file = await j(`https://api.procore.com/rest/v1.0/files/${fileId}?project_id=${projectId}`, token) as any;
  const url: string | undefined = file.file_versions?.[0]?.url || file.url;
  if (!url) throw new Error("No Procore file URL");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Procore download failed (${r.status})`);
  return { buffer: Buffer.from(await r.arrayBuffer()) };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────
export async function browseCloud(userId: number, provider: OAuthProviderKey, ref: string, q: string): Promise<BrowseResult> {
  const token = await getValidAccessToken(userId, provider);
  switch (provider) {
    case "google_drive": return driveBrowse(token, ref, q);
    case "dropbox": return dropboxBrowse(token, ref, q);
    case "bim360": return bim360Browse(token, ref);
    case "procore": return procoreBrowse(token, ref);
  }
}

export async function downloadCloud(userId: number, provider: OAuthProviderKey, ref: string, mimeType?: string): Promise<DownloadResult> {
  const token = await getValidAccessToken(userId, provider);
  switch (provider) {
    case "google_drive": return driveDownload(token, ref, mimeType);
    case "dropbox": return dropboxDownload(token, ref);
    case "bim360": return bim360Download(token, ref);
    case "procore": return procoreDownload(token, ref);
  }
}
