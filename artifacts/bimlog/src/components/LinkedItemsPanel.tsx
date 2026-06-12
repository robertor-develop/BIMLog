import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";

const API = "/api/v1";

type LinkType = "clash" | "submittal" | "transmittal" | "change_order" | "meeting";

const TYPE_LABELS: Record<LinkType, string> = {
  clash: "Clash",
  submittal: "Submittal",
  transmittal: "Transmittal",
  change_order: "Change Order",
  meeting: "Meeting",
};

const REL_OPTIONS = ["related", "resolves", "caused_by", "blocks"];

interface LinkRow {
  id: number; fromType: string; fromId: number; toType: string; toId: number; linkType: string;
}

interface Props {
  projectId: number;
  entityType: "rfi" | "submittal";
  entityId: number;
  canWrite?: boolean;
}

export function LinkedItemsPanel({ projectId, entityType, entityId, canWrite = true }: Props) {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [items, setItems] = useState<Record<LinkType, { id: number; label: string }[]>>({
    clash: [], submittal: [], transmittal: [], change_order: [], meeting: [],
  });
  const [selType, setSelType] = useState<LinkType>("clash");
  const [selId, setSelId] = useState("");
  const [rel, setRel] = useState("related");
  const [busy, setBusy] = useState(false);

  const loadLinks = async () => {
    const r = await fetch(`${API}/projects/${projectId}/links/${entityType}/${entityId}`, { headers });
    if (r.ok) setLinks(await r.json());
  };

  const mkLabel = (o: any, fallbackPrefix: string) =>
    o.number || o.subject || o.title || o.fileName || o.reportNumber || `${fallbackPrefix} #${o.id}`;

  const loadItems = async () => {
    try {
      const [subRes, transRes, coRes, meetRes, reportRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}/submittals`, { headers }),
        fetch(`${API}/projects/${projectId}/transmittals`, { headers }),
        fetch(`${API}/projects/${projectId}/change-orders`, { headers }),
        fetch(`${API}/projects/${projectId}/meetings`, { headers }),
        fetch(`${API}/projects/${projectId}/clash-reports`, { headers }),
      ]);
      const submittalsRaw = subRes.ok ? await subRes.json() : [];
      const transRaw = transRes.ok ? await transRes.json() : [];
      const coRaw = coRes.ok ? await coRes.json() : [];
      const meetRaw = meetRes.ok ? await meetRes.json() : [];
      const reports = reportRes.ok ? await reportRes.json() : [];

      const submittals = (Array.isArray(submittalsRaw) ? submittalsRaw : submittalsRaw.submittals ?? [])
        .map((s: any) => ({ id: s.id, label: mkLabel(s, "Submittal") }));
      const transmittals = (Array.isArray(transRaw) ? transRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "Transmittal") }));
      const changeOrders = (Array.isArray(coRaw) ? coRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "CO") }));
      const meetings = (Array.isArray(meetRaw) ? meetRaw : []).map((s: any) => ({ id: s.id, label: mkLabel(s, "Meeting") }));

      const reportList = Array.isArray(reports) ? reports : [];
      const clashArrays = await Promise.all(reportList.map(async (rep: any) => {
        const cr = await fetch(`${API}/projects/${projectId}/clash-reports/${rep.id}`, { headers });
        if (!cr.ok) return [] as { id: number; label: string }[];
        const data = await cr.json();
        return (data.clashes ?? []).map((c: any) => ({
          id: c.id,
          label: `${rep.fileName || rep.reportNumber || `Report ${rep.id}`} — ${c.description || c.clashIdOriginal || `Clash #${c.id}`}`,
        }));
      }));
      const clashes = clashArrays.flat();

      setItems({ clash: clashes, submittal: submittals, transmittal: transmittals, change_order: changeOrders, meeting: meetings });
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

  const addLink = async () => {
    const toId = Number(selId);
    if (!toId) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/links`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fromType: entityType, fromId: entityId, toType: selType, toId, linkType: rel }),
      });
      if (r.ok) { setSelId(""); await loadLinks(); }
    } finally { setBusy(false); }
  };

  const removeLink = async (linkId: number) => {
    await fetch(`${API}/projects/${projectId}/links/${linkId}`, { method: "DELETE", headers });
    await loadLinks();
  };

  const currentOptions = items[selType].filter(o => !(selType === entityType && o.id === entityId));

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Linked Items</div>
      {links.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>No linked items yet</div>}
      {links.map(l => {
        const o = otherSide(l);
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>{TYPE_LABELS[o.type as LinkType] || o.type}</span>
            <span style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{findLabel(o.type, o.id)}</span>
            <span style={{ fontSize: 10, color: "#6B7280" }}>{l.linkType}</span>
            {canWrite && (
              <button onClick={() => removeLink(l.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 14 }}>×</button>
            )}
          </div>
        );
      })}
      {canWrite && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <select value={selType} onChange={e => { setSelType(e.target.value as LinkType); setSelId(""); }}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
            {(Object.keys(TYPE_LABELS) as LinkType[]).map(tp => <option key={tp} value={tp}>{TYPE_LABELS[tp]}</option>)}
          </select>
          <select value={selId} onChange={e => setSelId(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12, flex: 1, minWidth: 200 }}>
            <option value="">— Select —</option>
            {currentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={rel} onChange={e => setRel(e.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
            {REL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" disabled={busy || !selId} onClick={addLink}>+ Link</button>
        </div>
      )}
    </div>
  );
}
