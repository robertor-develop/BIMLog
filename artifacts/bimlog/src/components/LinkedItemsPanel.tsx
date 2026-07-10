import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";

const API = "/api/v1";

type LinkType = "clash" | "submittal" | "transmittal" | "change_order" | "meeting" | "file";

const TYPE_LABELS: Record<LinkType, string> = {
  clash: "Clash",
  submittal: "Submittal",
  transmittal: "Transmittal",
  change_order: "Change Order",
  meeting: "Meeting",
  file: "File",
};

// Document-style linked items. Clash is deliberately kept separate (its own
// section) - mixing clashes with documents was confusing.
const DOC_TYPES: LinkType[] = ["submittal", "transmittal", "change_order", "meeting", "file"];

// Where to go to create a new item of each type (opened in a new tab so the RFI
// stays put; come back and link it from the picker).
const CREATE_ROUTES: Record<LinkType, string> = {
  clash: "clash-reports",
  submittal: "submittals",
  transmittal: "transmittals",
  change_order: "change-orders",
  meeting: "meetings",
  file: "files",
};

interface LinkRow {
  id: number; fromType: string; fromId: number; toType: string; toId: number; linkType: string;
}

interface Props {
  projectId: number;
  entityType: "rfi" | "submittal" | "lens_viewpoint";
  entityId: number;
  canWrite?: boolean;
}

export function LinkedItemsPanel({ projectId, entityType, entityId, canWrite = true }: Props) {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [items, setItems] = useState<Record<LinkType, { id: number; label: string }[]>>({
    clash: [], submittal: [], transmittal: [], change_order: [], meeting: [], file: [],
  });
  const [selType, setSelType] = useState<LinkType>("submittal");
  const [selId, setSelId] = useState("");
  const [selClashId, setSelClashId] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLinks = async () => {
    const r = await fetch(`${API}/projects/${projectId}/links/${entityType}/${entityId}`, { headers });
    if (r.ok) setLinks(await r.json());
  };

  const mkLabel = (o: any, fallbackPrefix: string) =>
    o.number || o.subject || o.title || o.fileName || o.reportNumber || `${fallbackPrefix} #${o.id}`;

  const loadItems = async () => {
    try {
      const [subRes, transRes, coRes, meetRes, fileRes, reportRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}/submittals`, { headers }),
        fetch(`${API}/projects/${projectId}/transmittals`, { headers }),
        fetch(`${API}/projects/${projectId}/change-orders`, { headers }),
        fetch(`${API}/projects/${projectId}/meetings`, { headers }),
        fetch(`${API}/projects/${projectId}/files`, { headers }),
        fetch(`${API}/projects/${projectId}/clash-reports`, { headers }),
      ]);
      const submittalsRaw = subRes.ok ? await subRes.json() : [];
      const transRaw = transRes.ok ? await transRes.json() : [];
      const coRaw = coRes.ok ? await coRes.json() : [];
      const meetRaw = meetRes.ok ? await meetRes.json() : [];
      const fileRaw = fileRes.ok ? await fileRes.json() : [];
      const reports = reportRes.ok ? await reportRes.json() : [];

      const submittals = (Array.isArray(submittalsRaw) ? submittalsRaw : submittalsRaw.submittals ?? [])
        .map((s: any) => ({ id: s.id, label: mkLabel(s, "Submittal") }));
      const transmittals = (Array.isArray(transRaw) ? transRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "Transmittal") }));
      const changeOrders = (Array.isArray(coRaw) ? coRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "CO") }));
      const meetings = (Array.isArray(meetRaw) ? meetRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "Meeting") }));
      const files = (Array.isArray(fileRaw) ? fileRaw : fileRaw.files ?? []).map((s: any) => ({ id: s.id, label: mkLabel(s, "File") }));

      const reportList = Array.isArray(reports) ? reports : [];
      const clashArrays = await Promise.all(reportList.map(async (rep: any) => {
        const cr = await fetch(`${API}/projects/${projectId}/clash-reports/${rep.id}`, { headers });
        if (!cr.ok) return [] as { id: number; label: string }[];
        const data = await cr.json();
        return (data.clashes ?? []).map((c: any) => ({
          id: c.id,
          label: `${rep.fileName || rep.reportNumber || `Report ${rep.id}`} - ${c.name || c.clashIdOriginal || `Clash #${c.id}`}`,
        }));
      }));
      const clashes = clashArrays.flat();

      setItems({ clash: clashes, submittal: submittals, transmittal: transmittals, change_order: changeOrders, meeting: meetings, file: files });
    } catch (e) {
      console.error("[LinkedItemsPanel.loadItems]", e);
    }
  };

  useEffect(() => { loadLinks(); loadItems(); }, [projectId, entityType, entityId]);

  const otherSide = (l: LinkRow) => {
    const isFrom = l.fromType === entityType && l.fromId === entityId;
    return { type: isFrom ? l.toType : l.fromType, id: isFrom ? l.toId : l.fromId };
  };

  const findLabel = (type: string, id: number) => {
    const list = (items as any)[type] as { id: number; label: string }[] | undefined;
    return list?.find(x => x.id === id)?.label || `#${id}`;
  };

  const createLink = async (toType: LinkType, toIdStr: string, clearSel: () => void) => {
    const toId = Number(toIdStr);
    if (!toId) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/links`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fromType: entityType, fromId: entityId, toType, toId, linkType: "related" }),
      });
      if (r.ok) { clearSel(); await loadLinks(); }
    } finally { setBusy(false); }
  };

  const removeLink = async (linkId: number) => {
    await fetch(`${API}/projects/${projectId}/links/${linkId}`, { method: "DELETE", headers });
    await loadLinks();
  };

  // Open the target module's create page in a new tab so this RFI stays open;
  // the user creates the item there, returns here, and picks it to link.
  const openCreate = (type: LinkType) => window.open(`/projects/${projectId}/${CREATE_ROUTES[type]}`, "_blank");

  const docOptions = items[selType].filter(o => !(selType === entityType && o.id === entityId));
  const clashOptions = items.clash;

  const docLinks = links.filter(l => otherSide(l).type !== "clash");
  const clashLinks = links.filter(l => otherSide(l).type === "clash");

  const renderLink = (l: LinkRow) => {
    const o = otherSide(l);
    return (
      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>{TYPE_LABELS[o.type as LinkType] || o.type}</span>
        <span style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{findLabel(o.type, o.id)}</span>
        {canWrite && (
          <button onClick={() => removeLink(l.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 14 }}>x</button>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
      {/* Documents */}
      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Linked Documents</div>
      {docLinks.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>No linked documents yet</div>}
      {docLinks.map(renderLink)}
      {canWrite && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <select value={selType} onChange={e => { setSelType(e.target.value as LinkType); setSelId(""); }}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
            {DOC_TYPES.map(tp => <option key={tp} value={tp}>{TYPE_LABELS[tp]}</option>)}
          </select>
          <select value={selId} onChange={e => setSelId(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12, flex: 1, minWidth: 200 }}>
            <option value="">{docOptions.length ? "- Select existing -" : `- No ${TYPE_LABELS[selType]} yet -`}</option>
            {docOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" disabled={busy || !selId} onClick={() => createLink(selType, selId, () => setSelId(""))}>+ Attach</button>
          <button className="btn btn-sm" onClick={() => openCreate(selType)} title={`Create a new ${TYPE_LABELS[selType]} in a new tab, then attach it here`}>+ Create {TYPE_LABELS[selType]}</button>
        </div>
      )}

      {/* Clashes - kept separate from documents */}
      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", margin: "16px 0 8px" }}>Linked Clashes</div>
      {clashLinks.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>No linked clashes yet</div>}
      {clashLinks.map(renderLink)}
      {canWrite && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <select value={selClashId} onChange={e => setSelClashId(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12, flex: 1, minWidth: 200 }}>
            <option value="">{clashOptions.length ? "- Select clash -" : "- No clashes yet -"}</option>
            {clashOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" disabled={busy || !selClashId} onClick={() => createLink("clash", selClashId, () => setSelClashId(""))}>+ Attach</button>
          <button className="btn btn-sm" onClick={() => openCreate("clash")} title="Open clash reports in a new tab">+ Open Clashes</button>
        </div>
      )}
    </div>
  );
}
