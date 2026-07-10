import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock, ExternalLink, History,
  LayoutGrid, List, Loader2, MoveRight, Plus, Trash2,
} from "lucide-react";

interface ScheduleItem {
  id: number;
  source: "milestone" | "rfi" | "submittal";
  label: string;
  title: string;
  dueDate: string;
  status: string;
  priority?: string | null;
  company?: string | null;
  responsibleCompany?: string | null;
  assignedUserId?: number | null;
  assignedUserName?: string | null;
  trade?: string | null;
  buildingLevel?: string | null;
  notes?: string | null;
  route?: string | null;
  linkedModule?: string | null;
  linkedId?: number | null;
  bucketId?: number | null;
  bucketName?: string | null;
  rolloverCount: number;
  daysOverdue: number;
  isOverdue?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

type Bucket = { id: number; name: string; bucketType: string; sortOrder: number };
type Member = { userId: number; userFullName: string; userEmail: string; userCompanyName?: string };
type DirectoryEntry = { id: number; companyName?: string | null; role?: string | null };
type LinkOption = { id: number; label: string; title: string; dueDate?: string | null; route: string };
type RolloverRow = { id: number; fromBucketName: string; toBucketName: string; movedByName?: string | null; movedAt: string };

const API = "/api/v1";

const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706",
  in_progress: "#2563EB",
  completed: "#16A34A",
  open: "#DC2626",
  follow_up: "#D97706",
  waiting_design: "#7C3AED",
  approved: "#16A34A",
  approved_as_noted: "#16A34A",
  resolved: "#16A34A",
  closed: "#16A34A",
  delayed: "#DC2626",
  cancelled: "#6B7280",
};

const MODULE_OPTIONS = [
  { value: "", label: "General Milestone", labelEs: "Hito General" },
  { value: "rfi", label: "Linked RFI", labelEs: "RFI Vinculado" },
  { value: "submittal", label: "Linked Submittal", labelEs: "Entregable Vinculado" },
  { value: "change_order", label: "Change Order", labelEs: "Orden de Cambio" },
  { value: "meeting", label: "Meeting", labelEs: "Reunion" },
  { value: "3d_model", label: "3D Model", labelEs: "Modelo 3D" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", labelEs: "Pendiente" },
  { value: "in_progress", label: "In Progress", labelEs: "En Progreso" },
  { value: "completed", label: "Completed", labelEs: "Completado" },
  { value: "delayed", label: "Delayed", labelEs: "Retrasado" },
  { value: "cancelled", label: "Cancelled", labelEs: "Cancelado" },
];

const LEGACY_EXAMPLE_BUCKETS = new Set(["Sprint 32", "Sprint 33"]);

export function ScheduleTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [rfis, setRfis] = useState<LinkOption[]>([]);
  const [submittals, setSubmittals] = useState<LinkOption[]>([]);
  const [changeOrders, setChangeOrders] = useState<LinkOption[]>([]);
  const [meetings, setMeetings] = useState<LinkOption[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [trades, setTrades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"calendar" | "board" | "list">("board");
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const [editingDetail, setEditingDetail] = useState(false);
  const [historyRows, setHistoryRows] = useState<RolloverRow[]>([]);
  const [bucketName, setBucketName] = useState("");
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null);
  const [rollTarget, setRollTarget] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    title: "",
    due_date: "",
    linked_module: "",
    linked_id: "",
    level: "",
    trade: "",
    company: "",
    add_company_to_directory: false,
    company_contact: "",
    company_email: "",
    company_role: "",
    assigned_user_id: "",
    status: "pending",
    notes: "",
    bucket_id: "",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    due_date: "",
    level: "",
    trade: "",
    company: "",
    assigned_user_id: "",
    status: "pending",
    notes: "",
  });

  const authHeader = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    setActionError("");
    try {
      const [scheduleRes, bucketRes, rfiRes, submittalRes, changeOrderRes, meetingRes, levelsRes, membersRes, directoryRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}/schedule/live`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/schedule/buckets`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/rfis`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/submittals`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/change-orders`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/meetings`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/levels`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/members`, { headers: authHeader }),
        fetch(`${API}/projects/${projectId}/directory`, { headers: authHeader }),
      ]);
      const failedLoads = [
        [scheduleRes, "schedule"],
        [bucketRes, "buckets"],
        [rfiRes, "RFIs"],
        [submittalRes, "submittals"],
        [changeOrderRes, "change orders"],
        [meetingRes, "meetings"],
        [levelsRes, "levels"],
        [membersRes, "members"],
        [directoryRes, "directory"],
      ].filter(([res]) => !(res as Response).ok).map(([, label]) => label as string);
      if (failedLoads.length > 0) {
        setActionError(t(`Could not load connected Schedule data: ${failedLoads.join(", ")}.`, `No se pudo cargar data conectada del cronograma: ${failedLoads.join(", ")}.`));
      }
      if (scheduleRes.ok) setItems(await scheduleRes.json());
      if (bucketRes.ok) setBuckets(await bucketRes.json());
      if (rfiRes.ok) {
        const rows = await rfiRes.json();
        setRfis(rows.map((r: any) => ({
          id: r.id,
          label: r.number || `RFI-${r.id}`,
          title: r.subject || "Untitled RFI",
          dueDate: r.dateRequired || r.dueDate || null,
          route: `/projects/${projectId}/rfis?rfi=${r.id}`,
        })));
      }
      if (submittalRes.ok) {
        const rows = await submittalRes.json();
        setSubmittals(rows.map((s: any) => ({
          id: s.id,
          label: s.number || `SUB-${s.id}`,
          title: s.title || "Untitled submittal",
          dueDate: s.dateRequired || s.dueDate || null,
          route: `/projects/${projectId}/submittals`,
        })));
        setTrades(uniq(rows.map((s: any) => s.trade || s.submittalCategory || s.submittalType).filter(Boolean)));
      }
      if (changeOrderRes.ok) {
        const rows = await changeOrderRes.json();
        setChangeOrders(rows.map((co: any) => ({
          id: co.id,
          label: co.number || `CO-${co.id}`,
          title: co.title || "Untitled change order",
          dueDate: null,
          route: `/projects/${projectId}/change-orders`,
        })));
      }
      if (meetingRes.ok) {
        const rows = await meetingRes.json();
        setMeetings(rows.map((m: any) => ({
          id: m.id,
          label: m.meetingNumber || `MTG-${m.id}`,
          title: m.title || "Untitled meeting",
          dueDate: m.meetingDate || null,
          route: `/projects/${projectId}/meetings`,
        })));
      }
      if (levelsRes.ok) {
        const data = await levelsRes.json();
        setLevels(Array.isArray(data.levels) ? data.levels : []);
      }
      if (membersRes.ok) {
        const rows = await membersRes.json();
        setMembers(rows);
        const memberCompanies = rows.map((m: Member) => m.userCompanyName).filter(Boolean) as string[];
        setCompanies(prev => uniq([...prev, ...memberCompanies]));
      }
      if (directoryRes.ok) {
        const rows = await directoryRes.json() as DirectoryEntry[];
        const directoryCompanies = rows.map(r => r.companyName).filter(Boolean) as string[];
        setCompanies(prev => uniq([...prev, ...directoryCompanies]));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void load();
  }, [projectId, token]);

  const linkOptions =
    form.linked_module === "rfi" ? rfis :
    form.linked_module === "submittal" ? submittals :
    form.linked_module === "change_order" ? changeOrders :
    form.linked_module === "meeting" ? meetings :
    [];
  const defaultBucketId = buckets.find(b => b.name === "This Week")?.id ?? buckets[0]?.id ?? "";

  const applyLinkedItem = (id: string) => {
    const picked = linkOptions.find(o => String(o.id) === id);
    setForm(f => ({
      ...f,
      linked_id: id,
      title: picked && !f.title ? `${picked.label}: ${picked.title}` : f.title,
      due_date: picked?.dueDate ? String(picked.dueDate).slice(0, 10) : f.due_date,
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isModelItem = form.linked_module === "3d_model";
      const modelTitle = isModelItem && form.level ? `3D Model - ${form.level}` : "";
      if (form.add_company_to_directory) {
        if (!form.company.trim() || !form.company_contact.trim() || !form.company_email.trim()) {
          setError(t("Company name, contact name, and email are required to add a company to the directory. Use name only if you do not have the details yet.",
            "Empresa, contacto y correo son requeridos para agregar la empresa al directorio. Usa solo nombre si todavia no tienes los datos."));
          return;
        }
        const companyCreate = await fetch(`${API}/projects/${projectId}/directory`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            full_name: form.company_contact.trim(),
            email: form.company_email.trim(),
            company_name: form.company.trim(),
            role: form.company_role.trim() || "Schedule Responsible",
          }),
        });
        if (!companyCreate.ok) {
          const d = await companyCreate.json().catch(() => ({}));
          setError(d.error || t("Could not add company to directory.", "No se pudo agregar la empresa al directorio."));
          return;
        }
      }
      const body = {
        title: form.title.trim() || modelTitle,
        due_date: form.due_date,
        item_type: isModelItem ? "3d_model" : (form.linked_module || "milestone"),
        building_level: form.level || undefined,
        trade: form.trade || undefined,
        responsible_company: form.company || undefined,
        assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : undefined,
        status: form.status || "pending",
        notes: form.notes || undefined,
        linked_module: form.linked_module || undefined,
        linked_id: form.linked_id ? Number(form.linked_id) : undefined,
        bucket_id: form.bucket_id ? Number(form.bucket_id) : (defaultBucketId ? Number(defaultBucketId) : undefined),
      };
      const r = await fetch(`${API}/projects/${projectId}/milestones`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Could not add schedule item");
        return;
      }
      setShowForm(false);
      setForm({ title: "", due_date: "", linked_module: "", linked_id: "", level: "", trade: "", company: "", add_company_to_directory: false, company_contact: "", company_email: "", company_role: "", assigned_user_id: "", status: "pending", notes: "", bucket_id: "" });
      await load();
      setViewMode("board");
      toast({ title: t("Schedule item added", "Fecha agregada al cronograma") });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    const r = await fetch(`${API}/projects/${projectId}/milestones/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      toast({ title: t("Could not update schedule item", "No se pudo actualizar la fecha"), variant: "destructive" });
      return;
    }
    setSelected(prev => prev && prev.source === "milestone" && prev.id === id ? { ...prev, status } : prev);
    await load();
  };

  const startDetailEdit = (item: ScheduleItem) => {
    setEditForm({
      title: item.title || "",
      due_date: item.dueDate ? dayKey(new Date(item.dueDate)) : "",
      level: item.buildingLevel || "",
      trade: item.trade || "",
      company: item.responsibleCompany || item.company || "",
      assigned_user_id: item.assignedUserId ? String(item.assignedUserId) : "",
      status: item.status || "pending",
      notes: item.notes || "",
    });
    setEditingDetail(true);
  };

  const saveDetailEdit = async () => {
    if (!selected || selected.source !== "milestone") return;
    if (!editForm.title.trim() || !editForm.due_date) {
      setError(t("Title and due date are required.", "Titulo y fecha limite son requeridos."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/milestones/${selected.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          title: editForm.title.trim(),
          due_date: editForm.due_date,
          status: editForm.status,
          building_level: editForm.level,
          trade: editForm.trade,
          responsible_company: editForm.company,
          assigned_user_id: editForm.assigned_user_id ? Number(editForm.assigned_user_id) : null,
          notes: editForm.notes,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || t("Could not update schedule item.", "No se pudo actualizar el item."));
        return;
      }
      const updated = await r.json();
      setSelected(prev => prev ? {
        ...prev,
        title: updated.title,
        dueDate: new Date(updated.dueDate).toISOString(),
        status: updated.status,
        buildingLevel: updated.buildingLevel,
        trade: updated.trade,
        responsibleCompany: updated.responsibleCompany,
        company: updated.responsibleCompany,
        assignedUserId: updated.assignedUserId,
        assignedUserName: updated.assignedUserId ? members.find(m => m.userId === updated.assignedUserId)?.userFullName || prev.assignedUserName : null,
        notes: updated.notes,
        updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : prev.updatedAt,
      } : prev);
      setEditingDetail(false);
      await load();
      toast({ title: t("Schedule item updated", "Item de cronograma actualizado") });
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (item: ScheduleItem, bucketId: number, rollover = false) => {
    const r = await fetch(`${API}/projects/${projectId}/schedule/items/move`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ source_type: item.source, source_id: item.id, bucket_id: bucketId, rollover }),
    });
    if (!r.ok) {
      toast({ title: t("Could not move schedule item", "No se pudo mover el item"), variant: "destructive" });
      return;
    }
    await load();
    if (selected && selected.id === item.id && selected.source === item.source) {
      setSelected({ ...selected, bucketId, bucketName: buckets.find(b => b.id === bucketId)?.name || selected.bucketName });
      void loadHistory(item);
    }
  };

  const rolloverBucket = async (fromBucket: Bucket) => {
    const toId = Number(rollTarget[fromBucket.id]);
    if (!toId) {
      setActionError(t("Select a target bucket before rolling work forward.", "Selecciona un bucket destino antes de transferir trabajo."));
      return;
    }
    setActionError("");
    const r = await fetch(`${API}/projects/${projectId}/schedule/buckets/${fromBucket.id}/rollover`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ to_bucket_id: toId }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setActionError(d.error || t("Could not roll over bucket.", "No se pudo transferir el sprint."));
      toast({ title: t("Could not roll over bucket", "No se pudo transferir el sprint"), variant: "destructive" });
      return;
    }
    const d = await r.json();
    await load();
    toast({ title: t(`Rolled over ${d.moved} unfinished items`, `${d.moved} items transferidos`) });
  };

  const saveBucket = async () => {
    const name = bucketName.trim();
    if (!name) {
      setActionError(t("Enter a bucket or sprint name first.", "Escribe primero el nombre del bucket o sprint."));
      return;
    }
    setActionError("");
    const url = editingBucket
      ? `${API}/projects/${projectId}/schedule/buckets/${editingBucket.id}`
      : `${API}/projects/${projectId}/schedule/buckets`;
    const r = await fetch(url, {
      method: editingBucket ? "PATCH" : "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, bucket_type: "custom", sort_order: editingBucket?.sortOrder ?? 100 }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setActionError(d.error || t("Could not save bucket.", "No se pudo guardar el bucket."));
      toast({ title: t("Could not save bucket", "No se pudo guardar el bucket"), variant: "destructive" });
      return;
    }
    setBucketName("");
    setEditingBucket(null);
    await load();
    toast({ title: editingBucket ? t("Bucket updated", "Bucket actualizado") : t("Bucket created", "Bucket creado") });
  };

  const deleteMilestone = async (id: number) => {
    if (!window.confirm(t("Delete this milestone?", "Eliminar este hito?"))) return;
    await fetch(`${API}/projects/${projectId}/milestones/${id}`, { method: "DELETE", headers: jsonHeaders });
    setSelected(null);
    await load();
  };

  const loadHistory = async (item: ScheduleItem) => {
    const r = await fetch(`${API}/projects/${projectId}/schedule/items/${item.source}/${item.id}/history`, { headers: authHeader });
    setHistoryRows(r.ok ? await r.json() : []);
  };

  const openItem = (item: ScheduleItem) => {
    setSelected(item);
    setEditingDetail(false);
    setError("");
    void loadHistory(item);
  };

  const openNewForDate = (date: Date) => {
    if (!canWrite) return;
    setForm(f => ({ ...f, due_date: dayKey(date), bucket_id: String(defaultBucketId || "") }));
    setError("");
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "overdue") return items.filter(i => i.isOverdue && !isDone(i.status));
    if (filter === "action") return items.filter(i => i.status === "pending" || i.status === "open" || (i.isOverdue && !isDone(i.status)));
    return items.filter(i => i.status === filter);
  }, [filter, items]);

  const total = items.length;
  const completed = items.filter(m => isDone(m.status)).length;
  const overdue = items.filter(m => m.isOverdue && !isDone(m.status)).length;
  const actionNeeded = items.filter(m => m.status === "pending" || m.status === "open" || (m.isOverdue && !isDone(m.status))).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statusBadge = (s: string, itemOverdue?: boolean) => {
    const color = itemOverdue && !isDone(s) ? "#DC2626" : STATUS_COLORS[s] ?? "#6B7280";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 4,
        background: `${color}16`, color, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
      }}>
        {itemOverdue && !isDone(s) ? t("Overdue", "Vencido") : s.replace(/_/g, " ")}
      </span>
    );
  };

  const sourceBadge = (item: ScheduleItem) => {
    const color =
      item.source === "rfi" || item.label.includes("RFI") ? "#7C3AED" :
      item.source === "submittal" || item.label.includes("Submittal") ? "#2563EB" :
      item.label === "3D Model" ? "#0F766E" :
      item.label === "Change Order" ? "#B45309" :
      item.label === "Meeting" ? "#0891B2" :
      "#16A34A";
    return (
      <span style={{
        display: "inline-flex", padding: "3px 7px", borderRadius: 4,
        background: `${color}16`, color, fontSize: 10, fontWeight: 900, textTransform: "uppercase",
      }}>
        {item.label}
      </span>
    );
  };

  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(calendarStart);
    d.setDate(calendarStart.getDate() + i);
    return d;
  });
  const byDay = filtered.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = dayKey(new Date(item.dueDate));
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const itemCountsByBucket = items.reduce<Record<string, number>>((acc, item) => {
    if (item.bucketName) acc[item.bucketName] = (acc[item.bucketName] || 0) + 1;
    return acc;
  }, {});
  const visibleBuckets = buckets.filter(bucket => !LEGACY_EXAMPLE_BUCKETS.has(bucket.name) || (itemCountsByBucket[bucket.name] || 0) > 0);
  const userBuckets = visibleBuckets.filter(bucket => bucket.bucketType !== "system" && !LEGACY_EXAMPLE_BUCKETS.has(bucket.name));
  const rolloverTargetsFor = (bucketId?: number | null) => userBuckets.filter(bucket => bucket.id !== bucketId);
  const derivedBuckets = uniq(items.map(item => item.bucketName).filter(Boolean) as string[])
    .filter(name => !LEGACY_EXAMPLE_BUCKETS.has(name) || (itemCountsByBucket[name] || 0) > 0)
    .map((name, index) => ({ id: -1 - index, name, bucketType: "derived", sortOrder: index }));
  const effectiveBuckets = visibleBuckets.length > 0 ? visibleBuckets : derivedBuckets;
  const itemsByBucket = effectiveBuckets.map(bucket => ({
    bucket,
    rows: filtered.filter(item => item.bucketId === bucket.id || (!item.bucketId && item.bucketName === bucket.name)),
  }));

  const smallButtonStyle = {
    border: "1px solid #D1D5DB",
    background: "white",
    borderRadius: 6,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  } as const;

  return (
    <div className="tab-content-wrapper schedule-planner">
      <style>{`
        .schedule-planner .btn {
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          color: #0F172A;
          border-radius: 6px;
          min-height: 34px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          line-height: 1;
          white-space: nowrap;
        }
        .schedule-planner .btn:hover { background: #F8FAFC; border-color: #94A3B8; }
        .schedule-planner .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .schedule-planner .btn-primary { background: #1E3A5F; border-color: #1E3A5F; color: #FFFFFF; }
        .schedule-planner .btn-primary:hover { background: #15304F; border-color: #15304F; }
        .schedule-planner .btn-outline { background: #FFFFFF; color: #1E3A5F; }
        .schedule-planner .btn-sm { min-height: 30px; padding: 6px 9px; font-size: 11px; }
        .schedule-planner .input {
          width: 100%;
          height: 36px;
          border: 1px solid #CBD5E1;
          background: #FFFFFF;
          color: #0F172A;
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 13px;
          font-family: inherit;
        }
        .schedule-planner textarea.input { height: auto; min-height: 76px; resize: vertical; }
        .schedule-planner .input:focus {
          outline: none;
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .schedule-planner .label {
          display: block;
          margin-bottom: 5px;
          color: #475569;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0, color: "#0F172A" }}>{t("Schedule - Coordination Planner", "Cronograma - Planner de Coordinacion")}</h2>
          <p style={{ margin: "5px 0 0", color: "#64748B", fontSize: 13 }}>
            {t("Calendar, sprint board, and register for RFI due dates, submittal due dates, 3D models, and manual milestones.",
              "Calendario, tablero sprint y registro para RFIs, entregables, modelos 3D e hitos manuales.")}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setForm(f => ({ ...f, bucket_id: String(defaultBucketId || "") })); setShowForm(true); }} type="button">
            <Plus size={14} />
            {t("Add Schedule Item", "Agregar Fecha")}
          </button>
        )}
      </div>

      <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8, padding: "10px 12px", marginBottom: 14, color: "#1E3A5F", fontSize: 12 }}>
        <strong>{t("Workflow:", "Flujo:")}</strong>{" "}
        {t("Calendar is for due dates. Board is for weekly coordination and sprints. List is the complete control register. Roll unfinished sprint work forward instead of recreating it.",
          "Calendario para fechas limite. Tablero para coordinacion semanal y sprints. Lista como registro completo. Transfiere el trabajo pendiente al siguiente sprint sin recrearlo.")}
      </div>
      {actionError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        {[
          [t("Total Items", "Items Totales"), total, "#1E3A5F"],
          [t("Action Needed", "Requiere Accion"), actionNeeded, actionNeeded ? "#D97706" : "#16A34A"],
          [t("Overdue", "Vencidos"), overdue, overdue ? "#DC2626" : "#16A34A"],
          [t("Completed", "Completados"), `${completed}/${total}`, "#2563EB"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 900, color: "#64748B" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: String(color), marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>{t("Overall Progress", "Progreso General")}</div>
          <div style={{ fontWeight: 900, color: "#1D4ED8" }}>{pct}%</div>
        </div>
        <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#2563EB", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["all", t("All", "Todos")],
            ["action", t("Action Needed", "Requiere Accion")],
            ["pending", t("Pending", "Pendiente")],
            ["in_progress", t("In Progress", "En Progreso")],
            ["completed", t("Completed", "Completado")],
            ["overdue", t("Overdue", "Vencidos")],
          ].map(([key, label]) => (
            <button key={key} type="button" className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["board", t("Board", "Tablero"), LayoutGrid],
            ["calendar", t("Calendar", "Calendario"), Calendar],
            ["list", t("List", "Lista"), List],
          ].map(([key, label, Icon]) => (
            <button key={String(key)} type="button" className={`btn btn-sm ${viewMode === key ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode(key as "calendar" | "board" | "list")}>
              <Icon size={13} style={{ marginRight: 4 }} />
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {canWrite && viewMode === "board" && (
        <div className="card" style={{ padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ minWidth: 260, flex: "0 1 320px" }}>
              <label className="label">{editingBucket ? t("Edit Bucket", "Editar Bucket") : t("Create Bucket or Sprint", "Crear Bucket o Sprint")}</label>
              <input className="input" value={bucketName} onChange={e => setBucketName(e.target.value)} placeholder={t("New sprint or bucket name", "Nombre nuevo de sprint o bucket")} />
              {!bucketName.trim() && (
                <div style={{ marginTop: 5, color: "#64748B", fontSize: 11, fontWeight: 700 }}>
                  {t("Enter a name to enable this action.", "Escribe un nombre para activar esta accion.")}
                </div>
              )}
            </div>
            <button className="btn btn-primary" type="button" disabled={!bucketName.trim()} title={!bucketName.trim() ? t("Enter a bucket or sprint name first.", "Escribe primero el nombre del bucket o sprint.") : undefined} onClick={saveBucket}>
              {editingBucket ? t("Save Bucket", "Guardar Bucket") : t("Add Bucket", "Agregar Bucket")}
            </button>
            {editingBucket && <button className="btn btn-outline" type="button" onClick={() => { setEditingBucket(null); setBucketName(""); setActionError(""); }}>{t("Cancel", "Cancelar")}</button>}
          </div>
          {actionError && <div style={{ marginTop: 8, color: "#B91C1C", fontSize: 12, fontWeight: 700 }}>{actionError}</div>}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 18, padding: 18, border: "1.5px solid #BFDBFE" }}>
          <h3 style={{ fontWeight: 800, margin: "0 0 4px", color: "#1E3A5F" }}>{t("Add Schedule Item", "Agregar Fecha")}</h3>
          <p style={{ margin: "0 0 14px", color: "#64748B", fontSize: 12 }}>
            {t("Use this for manual milestones and 3D model coordination. RFI and submittal due dates already appear automatically.",
              "Usa esto para hitos manuales y coordinacion de modelos 3D. RFIs y entregables aparecen automaticamente.")}
          </p>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("Item Type", "Tipo")}>
              <select className="input" value={form.linked_module} onChange={e => setForm(f => ({ ...f, linked_module: e.target.value, linked_id: "", level: "" }))}>
                {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </select>
            </Field>
            <Field label={t("Bucket / Sprint", "Bucket / Sprint")}>
              <select className="input" value={form.bucket_id} onChange={e => setForm(f => ({ ...f, bucket_id: e.target.value }))}>
                <option value="">{t("Auto bucket", "Bucket automatico")}</option>
                {visibleBuckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            {linkOptions.length > 0 && (
              <Field label={
                form.linked_module === "rfi" ? "RFI" :
                form.linked_module === "submittal" ? t("Submittal", "Entregable") :
                form.linked_module === "change_order" ? t("Change Order", "Orden de Cambio") :
                t("Meeting", "Reunion")
              }>
                <select className="input" value={form.linked_id} onChange={e => applyLinkedItem(e.target.value)}>
                  <option value="">{t("Select item", "Seleccionar item")}</option>
                  {linkOptions.map(o => <option key={o.id} value={String(o.id)}>{o.label}: {o.title}</option>)}
                </select>
              </Field>
            )}
            <Field label={t("Building Level", "Nivel")}>
              <select className="input" required={form.linked_module === "3d_model"} value={form.level} onChange={e => setForm(f => ({
                ...f,
                level: e.target.value,
                title: f.title || (form.linked_module === "3d_model" && e.target.value ? `3D Model - ${e.target.value}` : f.title),
              }))}>
                <option value="">{t("Select level", "Seleccionar nivel")}</option>
                {levels.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
            <Field label={t("Trade", "Disciplina")}>
              <input className="input" list="schedule-trades" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} placeholder={t("Select existing trade or type one", "Selecciona o escribe una disciplina")} />
            </Field>
            <Field label={t("Responsible Company", "Empresa Responsable")}>
              <input className="input" list="schedule-companies" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder={t("Select existing company or type name", "Selecciona o escribe una empresa")} />
            </Field>
            <div style={{ gridColumn: "1 / -1", border: "1px solid #E2E8F0", borderRadius: 8, padding: 12, background: "#F8FAFC" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#1E3A5F" }}>
                <input type="checkbox" checked={form.add_company_to_directory} onChange={e => setForm(f => ({ ...f, add_company_to_directory: e.target.checked }))} />
                {t("Add this company to the Project Directory with contact info", "Agregar esta empresa al Directorio del Proyecto con contacto")}
              </label>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}>
                {t("Leave unchecked to save only the company name on this schedule item for now.",
                  "Dejalo sin marcar para guardar solo el nombre de la empresa en este item por ahora.")}
              </div>
              {form.add_company_to_directory && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <Field label={t("Contact Name", "Contacto")}>
                    <input className="input" value={form.company_contact} onChange={e => setForm(f => ({ ...f, company_contact: e.target.value }))} />
                  </Field>
                  <Field label={t("Contact Email", "Correo")}>
                    <input className="input" type="email" value={form.company_email} onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} />
                  </Field>
                  <Field label={t("Role", "Rol")}>
                    <input className="input" value={form.company_role} onChange={e => setForm(f => ({ ...f, company_role: e.target.value }))} placeholder="Schedule Responsible" />
                  </Field>
                </div>
              )}
            </div>
            <Field label={t("Assigned User", "Usuario Asignado")}>
              <select className="input" value={form.assigned_user_id} onChange={e => setForm(f => ({ ...f, assigned_user_id: e.target.value }))}>
                <option value="">{t("Unassigned", "Sin asignar")}</option>
                {members.map(m => <option key={m.userId} value={m.userId}>{m.userFullName} - {m.userCompanyName || m.userEmail}</option>)}
              </select>
            </Field>
            <Field label={t("Status", "Estado")}>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Title", "Titulo")} *</label>
              <input className="input" required={form.linked_module !== "3d_model"} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <Field label={`${t("Due Date", "Fecha Limite")} *`}>
              <input className="input" type="date" required value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Notes", "Notas")}</label>
              <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> : null}
                {saving ? t("Saving...", "Guardando...") : t("Save Schedule Item", "Guardar Item de Cronograma")}
              </button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>
                {t("Cancel", "Cancelar")}
              </button>
            </div>
          </form>
          <datalist id="schedule-trades">{trades.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="schedule-companies">{companies.map(v => <option key={v} value={v} />)}</datalist>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading schedule...", "Cargando cronograma...")}</div>}

      {!loading && filtered.length === 0 && viewMode !== "board" && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF", background: "white", border: "1px solid #E5E7EB", borderRadius: 8 }}>
          <Calendar size={42} color="#D1D5DB" style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700 }}>{t("No schedule dates found", "No hay fechas en el cronograma")}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t("Add a date required to an RFI/submittal, or create a manual schedule item.", "Agrega fecha requerida a un RFI/entregable, o crea una fecha manual.")}</div>
        </div>
      )}

      {!loading && viewMode === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, alignItems: "start" }}>
          {itemsByBucket.map(({ bucket, rows }) => (
            <div key={bucket.id} className="card" style={{ padding: 10, minHeight: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <button type="button" onClick={() => { if (canWrite && bucket.bucketType !== "system" && bucket.id > 0) { setEditingBucket(bucket); setBucketName(bucket.name); setActionError(""); } }} style={{ border: "none", background: "transparent", padding: 0, fontSize: 12, fontWeight: 900, color: "#1E3A5F", cursor: canWrite && bucket.bucketType !== "system" && bucket.id > 0 ? "pointer" : "default" }}>
                  {bucket.name}
                </button>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#64748B" }}>{rows.length}</span>
              </div>
              {canWrite && bucket.bucketType !== "system" && bucket.id > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                  <select className="input" style={{ height: 30, fontSize: 11, padding: "4px 6px" }} value={rollTarget[bucket.id] || ""} onChange={e => setRollTarget(r => ({ ...r, [bucket.id]: e.target.value }))}>
                    <option value="">{t("Roll to...", "Transferir a...")}</option>
                    {rolloverTargetsFor(bucket.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button className="btn btn-sm btn-outline" type="button" disabled={rolloverTargetsFor(bucket.id).length === 0} onClick={() => rolloverBucket(bucket)} title={t("Move unfinished work to selected bucket", "Mover trabajo pendiente al bucket seleccionado")}>
                    <MoveRight size={12} />
                  </button>
                </div>
              )}
              {canWrite && bucket.bucketType !== "system" && bucket.id > 0 && rolloverTargetsFor(bucket.id).length === 0 && (
                <div style={{ marginBottom: 10, color: "#64748B", fontSize: 11, fontWeight: 700 }}>
                  {t("Create another bucket to roll unfinished work forward.", "Crea otro bucket para transferir trabajo pendiente.")}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map(item => (
                  <ScheduleCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    buckets={visibleBuckets}
                    canWrite={canWrite}
                    onOpen={() => openItem(item)}
                    onMove={(bucketId, rollover) => moveItem(item, bucketId, rollover)}
                    onStart={() => updateStatus(item.id, "in_progress")}
                    onDone={() => updateStatus(item.id, "completed")}
                    sourceBadge={sourceBadge}
                    statusBadge={statusBadge}
                    t={t}
                  />
                ))}
                {rows.length === 0 && (
                  <div style={{ border: "1px dashed #CBD5E1", borderRadius: 8, padding: 12, color: "#64748B", fontSize: 12, minHeight: 68 }}>
                    {t("No items in this bucket.", "No hay items en este bucket.")}
                  </div>
                )}
              </div>
            </div>
          ))}
          {itemsByBucket.length === 0 && (
            <div className="card" style={{ padding: 18, color: "#64748B", fontSize: 13 }}>
              {t("No buckets are available. Create a bucket or sprint above.", "No hay buckets disponibles. Crea un bucket o sprint arriba.")}
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "calendar" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontWeight: 900, color: "#1E3A5F" }}>
            {thisMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", background: "#E5E7EB", gap: 1 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} style={{ background: "#F8FAFC", padding: "8px 10px", fontSize: 11, fontWeight: 900, color: "#64748B" }}>{day}</div>
            ))}
            {calendarDays.map(day => {
              const events = byDay[dayKey(day)] || [];
              const inMonth = day.getMonth() === thisMonth.getMonth();
              return (
                <div
                  key={dayKey(day)}
                  onClick={() => openNewForDate(day)}
                  title={canWrite ? t("Click to add a schedule item on this date", "Clic para agregar una fecha en este dia") : undefined}
                  style={{ minHeight: 118, background: "white", padding: 8, opacity: inMonth ? 1 : 0.45, cursor: canWrite ? "pointer" : "default" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>{day.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {events.slice(0, 4).map(item => (
                      <button key={`${item.source}-${item.id}`} onClick={(e) => { e.stopPropagation(); openItem(item); }}
                        style={{ textAlign: "left", border: "1px solid #DBEAFE", background: item.isOverdue ? "#FEF2F2" : "#EFF6FF", color: "#1E3A5F", borderRadius: 5, padding: "4px 5px", fontSize: 10, cursor: "pointer" }}>
                        <strong>{item.label}</strong> {item.title}
                      </button>
                    ))}
                    {events.length > 4 && <div style={{ fontSize: 10, color: "#64748B" }}>+{events.length - 4} {t("more", "mas")}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === "list" && (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1E3A5F", color: "white" }}>
                {["Type", "Title", "Bucket", "Level", "Trade", "Due Date", "Company", "Assigned", "Status", "Overdue", "Rollovers", "Updated", "Actions"].map(h => (
                  <th key={h} style={{ padding: "9px 10px", fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={`${item.source}-${item.id}`} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <td style={{ padding: 10 }}>{sourceBadge(item)}</td>
                  <td style={{ padding: 10, fontSize: 12, fontWeight: 700, minWidth: 220 }}>{item.title}</td>
                  <td style={{ padding: 10, fontSize: 12, whiteSpace: "nowrap" }}>{item.bucketName || "-"}</td>
                  <td style={{ padding: 10, fontSize: 12, whiteSpace: "nowrap" }}>{item.buildingLevel || "-"}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.trade || "-"}</td>
                  <td style={{ padding: 10, fontSize: 12, whiteSpace: "nowrap" }}>{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.responsibleCompany || item.company || "-"}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.assignedUserName || "-"}</td>
                  <td style={{ padding: 10 }}>{statusBadge(item.status, item.isOverdue)}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.daysOverdue || 0}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{item.rolloverCount || 0}</td>
                  <td style={{ padding: 10, fontSize: 12, whiteSpace: "nowrap" }}>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}</td>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                    <button style={smallButtonStyle} onClick={() => openItem(item)}>
                      <ExternalLink size={12} /> {t("Details", "Detalle")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 1000 }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 500, background: "white", boxShadow: "-8px 0 28px rgba(15,23,42,0.18)", padding: 20, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>{selected.label}</div>
                <h3 style={{ margin: "4px 0 0", color: "#0F172A" }}>{selected.title}</h3>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            {editingDetail && selected.source === "milestone" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{t("Title", "Titulo")}</label>
                  <input className="input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <Field label={t("Due Date", "Fecha Limite")}>
                  <input className="input" type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                </Field>
                <Field label={t("Status", "Estado")}>
                  <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === "es" ? o.labelEs : o.label}</option>)}
                  </select>
                </Field>
                <Field label={t("Building Level", "Nivel")}>
                  <select className="input" value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}>
                    <option value="">{t("Select level", "Seleccionar nivel")}</option>
                    {levels.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </Field>
                <Field label={t("Trade", "Disciplina")}>
                  <input className="input" list="schedule-trades" value={editForm.trade} onChange={e => setEditForm(f => ({ ...f, trade: e.target.value }))} />
                </Field>
                <Field label={t("Responsible Company", "Empresa Responsable")}>
                  <input className="input" list="schedule-companies" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
                </Field>
                <Field label={t("Assigned User", "Usuario Asignado")}>
                  <select className="input" value={editForm.assigned_user_id} onChange={e => setEditForm(f => ({ ...f, assigned_user_id: e.target.value }))}>
                    <option value="">{t("Unassigned", "Sin asignar")}</option>
                    {members.map(m => <option key={m.userId} value={m.userId}>{m.userFullName} - {m.userCompanyName || m.userEmail}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">{t("Notes", "Notas")}</label>
                  <textarea className="input" rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" type="button" disabled={saving || !editForm.title.trim() || !editForm.due_date} onClick={saveDetailEdit}>
                    {saving ? t("Saving...", "Guardando...") : t("Save Changes", "Guardar Cambios")}
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => { setEditingDetail(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
                  {(!editForm.title.trim() || !editForm.due_date) && (
                    <div style={{ color: "#64748B", fontSize: 12, fontWeight: 700, alignSelf: "center" }}>
                      {t("Title and due date are required to save.", "Titulo y fecha limite son requeridos para guardar.")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                <Detail label={t("Due Date", "Fecha Limite")} value={new Date(selected.dueDate).toLocaleDateString()} />
                <Detail label={t("Bucket / Sprint", "Bucket / Sprint")} value={selected.bucketName || "-"} />
                <Detail label={t("Building Level", "Nivel")} value={selected.buildingLevel || "-"} />
                <Detail label={t("Trade", "Disciplina")} value={selected.trade || "-"} />
                <Detail label={t("Responsible Company", "Empresa Responsable")} value={selected.responsibleCompany || selected.company || "-"} />
                <Detail label={t("Assigned User", "Usuario Asignado")} value={selected.assignedUserName || "-"} />
                <Detail label={t("Status", "Estado")} value={selected.isOverdue && !isDone(selected.status) ? t("Overdue", "Vencido") : selected.status.replace(/_/g, " ")} />
                <Detail label={t("Days Overdue", "Dias Vencidos")} value={String(selected.daysOverdue || 0)} />
                <Detail label={t("Rollovers", "Transferencias")} value={String(selected.rolloverCount || 0)} />
                <Detail label={t("Created", "Creado")} value={selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "-"} />
                <Detail label={t("Last Updated", "Ultima Actualizacion")} value={selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "-"} />
                <Detail label={t("Notes", "Notas")} value={selected.notes || "-"} />
              </div>
            )}
            {canWrite && selected.source === "milestone" && !editingDetail && (
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" type="button" onClick={() => startDetailEdit(selected)}>
                  {t("Edit Schedule Item", "Editar Item de Cronograma")}
                </button>
              </div>
            )}
            {canWrite && (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid #E5E7EB", borderRadius: 8 }}>
                <label className="label">{t("Move to Bucket", "Mover a Bucket")}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="input" defaultValue={selected.bucketId || ""} onChange={e => e.target.value && moveItem(selected, Number(e.target.value), false)}>
                    <option value="">{t("Select bucket", "Seleccionar bucket")}</option>
                    {visibleBuckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {rolloverTargetsFor(selected.bucketId).length > 0 ? (
                    <select className="input" defaultValue="" onChange={e => e.target.value && moveItem(selected, Number(e.target.value), true)}>
                      <option value="">{t("Rollover to...", "Transferir a...")}</option>
                      {rolloverTargetsFor(selected.bucketId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  ) : (
                    <div style={{ flex: 1, minHeight: 36, display: "flex", alignItems: "center", color: "#64748B", fontSize: 12, fontWeight: 700 }}>
                      {t("Create a sprint/bucket first to roll work forward.", "Crea primero un sprint/bucket para transferir trabajo.")}
                    </div>
                  )}
                </div>
              </div>
            )}
            {selected.route && (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#1E3A5F", marginBottom: 10 }}>
                  {selected.source === "milestone"
                    ? t("This manual schedule item is linked to another BIMLog record.", "Esta fecha manual esta vinculada a otro registro BIMLog.")
                    : t("This date comes from the linked source record. Edit the RFI or submittal to change its due date.", "Esta fecha viene del registro fuente. Edita el RFI o entregable para cambiarla.")}
                </div>
                <button className="btn btn-primary" onClick={() => { window.location.href = selected.route!; }}>
                  <ExternalLink size={13} style={{ marginRight: 4 }} />{t("Open Linked Record", "Abrir Registro Vinculado")}
                </button>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 900, color: "#1E3A5F", marginBottom: 8 }}>
                <History size={13} /> {t("Rollover History", "Historial de Transferencias")}
              </div>
              {historyRows.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748B" }}>{t("No rollover history yet.", "Sin historial de transferencias.")}</div>
              ) : historyRows.map(row => (
                <div key={row.id} style={{ borderTop: "1px solid #E5E7EB", padding: "8px 0", fontSize: 12 }}>
                  <strong>{row.fromBucketName}</strong> <MoveRight size={11} style={{ verticalAlign: "middle" }} /> <strong>{row.toBucketName}</strong>
                  <div style={{ color: "#64748B", marginTop: 2 }}>{new Date(row.movedAt).toLocaleString()} {row.movedByName ? `- ${row.movedByName}` : ""}</div>
                </div>
              ))}
            </div>
            {canWrite && selected.source === "milestone" && (
              <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                {!isDone(selected.status) && (
                  <>
                    <button className="btn btn-outline" onClick={() => updateStatus(selected.id, "in_progress")}>
                      <Clock size={13} style={{ marginRight: 4 }} />{t("Mark In Progress", "Marcar En Progreso")}
                    </button>
                    <button className="btn btn-primary" onClick={() => updateStatus(selected.id, "completed")}>
                      <CheckCircle2 size={13} style={{ marginRight: 4 }} />{t("Mark Done", "Marcar Listo")}
                    </button>
                  </>
                )}
                <button className="btn btn-outline" style={{ color: "#DC2626", borderColor: "#FECACA" }} onClick={() => deleteMilestone(selected.id)}>
                  <Trash2 size={13} style={{ marginRight: 4 }} />{t("Delete", "Eliminar")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderBottom: "1px solid #E5E7EB", paddingBottom: 8 }}>
      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, color: "#0F172A", marginTop: 3, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

function ScheduleCard({
  item,
  buckets,
  canWrite,
  onOpen,
  onMove,
  onStart,
  onDone,
  sourceBadge,
  statusBadge,
  t,
}: {
  item: ScheduleItem;
  buckets: Bucket[];
  canWrite: boolean;
  onOpen: () => void;
  onMove: (bucketId: number, rollover: boolean) => void;
  onStart: () => void;
  onDone: () => void;
  sourceBadge: (item: ScheduleItem) => ReactNode;
  statusBadge: (status: string, overdue?: boolean) => ReactNode;
  t: (en: string, es: string) => string;
}) {
  const done = isDone(item.status);
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, background: item.isOverdue && !done ? "#FEF2F2" : "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
        {sourceBadge(item)}
        {statusBadge(item.status, item.isOverdue)}
      </div>
      <button onClick={onOpen} style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", lineHeight: 1.35 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
          {new Date(item.dueDate).toLocaleDateString()}
          {item.buildingLevel ? ` - ${item.buildingLevel}` : ""}
          {item.trade ? ` - ${item.trade}` : ""}
        </div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
          {item.responsibleCompany || item.company || t("No company", "Sin empresa")}
          {item.assignedUserName ? ` - ${item.assignedUserName}` : ""}
        </div>
        {(item.daysOverdue > 0 || item.rolloverCount > 0) && (
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            {item.daysOverdue > 0 && <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 800 }}><AlertTriangle size={10} /> {item.daysOverdue}d overdue</span>}
            {item.rolloverCount > 0 && <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 800 }}>{item.rolloverCount} rollover{item.rolloverCount === 1 ? "" : "s"}</span>}
          </div>
        )}
      </button>
      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
        <button className="btn btn-sm btn-outline" onClick={onOpen}>
          <ExternalLink size={11} style={{ marginRight: 3 }} />{t("Details", "Detalle")}
        </button>
        {canWrite && (
          <select className="input" value={item.bucketId || ""} onChange={e => e.target.value && onMove(Number(e.target.value), false)} style={{ height: 28, fontSize: 11, padding: "3px 5px", width: 130 }}>
            <option value="">{t("Move", "Mover")}</option>
            {buckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {canWrite && item.source === "milestone" && !done && (
          <>
            {item.status !== "in_progress" && <button className="btn btn-sm btn-outline" onClick={onStart}>{t("Start", "Iniciar")}</button>}
            <button className="btn btn-sm btn-outline" onClick={onDone}>{t("Done", "Listo")}</button>
          </>
        )}
      </div>
    </div>
  );
}

function isDone(status: string | null | undefined) {
  return ["completed", "closed", "resolved", "approved", "approved_as_noted"].includes((status || "").toLowerCase());
}

function dayKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniq(values: string[]) {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
