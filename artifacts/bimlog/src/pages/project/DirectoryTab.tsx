import { isDirectoryRecipientEmail, isCompanyOnlyEntry } from "@workspace/api-zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import {useConfig} from "@/lib/config-context";
import { PrintPdfButton } from "@/components/PrintPdfButton";
import { useProjectCompanyChoices } from "@/hooks/use-project-company-choices";
import { Download, UserCheck, UserPlus, Users } from "lucide-react";

interface DirectoryEntry {
  id: number; fullName: string; email: string; companyName?: string; companyId?:number;
  role: string; bimlogStatus?: string; notes?: string;
}

interface MemberEntry {
  id: number; userId: number; userFullName: string; userEmail: string;
  userCompanyName?: string; role: string; joinedAt?: string; status?:string;
}

type DirectoryScope = "all" | "members" | "contacts";
type DirectoryRoleFilter = "all" | "admin" | "member" | "external";
type DirectoryStatusFilter = "all" | "active" | "invited" | "external";
type DirectorySort = "name" | "company" | "role" | "status";

type DirectoryPdfOptions = {
  includeMembers: boolean;
  includeContacts: boolean;
  includeEmail: boolean;
  includeCompany: boolean;
  includeRole: boolean;
  includeStatus: boolean;
};

type DirectoryRow = {
  key: string;
  source: "member" | "contact";
  fullName: string;
  email: string;
  companyName?: string;
  role: string;
  status: "active" | "invited" | "external";
};

const API = "/api/v1";

const DEFAULT_PDF_OPTIONS: DirectoryPdfOptions = {
  includeMembers: true,
  includeContacts: true,
  includeEmail: true,
  includeCompany: true,
  includeRole: true,
  includeStatus: true,
};

const normalizeEmail = (value: string | undefined) => (value || "").trim().toLowerCase();

export function DirectoryTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const companyChoices = useProjectCompanyChoices(projectId);
  const { lang } = useI18n();
  const { token,user } = useAuthStore();
  const {adminRoles}=useConfig();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<DirectoryScope>("all");
  const [roleFilter, setRoleFilter] = useState<DirectoryRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<DirectoryStatusFilter>("all");
  const [sortBy, setSortBy] = useState<DirectorySort>("name");
  const [pdfOptions, setPdfOptions] = useState<DirectoryPdfOptions>(DEFAULT_PDF_OPTIONS);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", company_name: "", company_id:"", role: "", notes: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const scopeEpoch=useRef(0),loadSequence=useRef(0),actionLock=useRef(false),pdfLock=useRef(false);
  const [savedReceipt,setSavedReceipt]=useState<null|{ids:number[];kind:string;message:string}>(null),[companyContact,setCompanyContact]=useState(false);
  const savedCompanies=Array.from(new Map(entries.filter(entry=>Number.isSafeInteger(entry.companyId)&&Number(entry.companyId)>0).map(entry=>[entry.companyId!,entry.companyName||String(entry.companyId)])).entries());
  const load = async (expectedIds:number[]=[]) => {
    const current=scopeEpoch.current,sequence=++loadSequence.current;setLoading(true);
    try{
      const [rMembers,rDir]=await Promise.all([fetch(`${API}/projects/${projectId}/members`,{headers:{Authorization:`Bearer ${token}`}}),fetch(`${API}/projects/${projectId}/directory`,{headers:{Authorization:`Bearer ${token}`}})]);
      if(!rMembers.ok||!rDir.ok)throw new Error(t("Saved directory could not be loaded. Restore access and retry.","No se pudo cargar el directorio guardado. Restaure acceso y reintente."));
      const memberRows=await rMembers.json(),directoryRows=await rDir.json();
      if(current!==scopeEpoch.current||sequence!==loadSequence.current)return false;
      if(!Array.isArray(memberRows)||!Array.isArray(directoryRows)||expectedIds.some(id=>!directoryRows.some(row=>row.id===id)))throw new Error(t("Saved receipt received, but exact contacts could not be reopened. Verify before submitting again.","Recibo guardado recibido, pero no se reabrieron los contactos exactos. Verifique antes de volver a enviar."));
      setMembers(memberRows.filter(row=>row.status===undefined||row.status==="active"));setEntries(directoryRows);setError("");return true;
    }catch(failure){if(current===scopeEpoch.current&&sequence===loadSequence.current){setError(failure instanceof Error?failure.message:String(failure));setMembers([]);setEntries([]);}return false;}
    finally{if(current===scopeEpoch.current&&sequence===loadSequence.current)setLoading(false);}
  };
  useEffect(()=>{scopeEpoch.current++;actionLock.current=false;pdfLock.current=false;setSavedReceipt(null);setMembers([]);setEntries([]);setShowForm(false);setForm({full_name:"",email:"",company_name:"",company_id:"",role:"",notes:""});setCompanyContact(false);setError("");setImportMsg("");setExportError("");setSaving(false);setImporting(false);setInviting(null);setExporting(false);void load();return()=>{scopeEpoch.current++;};},[projectId,token]);
  const verifyReceipt=async(receipt:NonNullable<typeof savedReceipt>)=>{const current=scopeEpoch.current;if(await load(receipt.ids)&&current===scopeEpoch.current){setSavedReceipt(null);if(receipt.kind==="save"){setShowForm(false);setForm({full_name:"",email:"",company_name:"",company_id:"",role:"",notes:""});}setImportMsg(receipt.message);setError("");}};

  const normalizedSearch = search.trim().toLowerCase();
  const memberEmails = useMemo(() => new Set(members.map(m => normalizeEmail(m.userEmail))), [members]);
  const duplicateContactCount = useMemo(
    () => entries.filter(e => memberEmails.has(normalizeEmail(e.email))).length,
    [entries, memberEmails],
  );
  const additionalContacts = useMemo(
    () => entries.filter(e => !memberEmails.has(normalizeEmail(e.email))),
    [entries, memberEmails],
  );

  const rows = useMemo<DirectoryRow[]>(() => {
    const memberRows: DirectoryRow[] = members.map(m => ({
      key: `m-${m.id}`,
      source: "member",
      fullName: m.userFullName,
      email: m.userEmail,
      companyName: m.userCompanyName,
      role: m.role,
      status: "active",
    }));
    const contactRows: DirectoryRow[] = additionalContacts.map(e => ({
      key: `c-${e.id}`,
      source: "contact",
      fullName: e.fullName,
      email: e.email,
      companyName: e.companyName,
      role: e.role,
      status: e.bimlogStatus === "invited" ? "invited" : "external",
    }));
    return [...memberRows, ...contactRows]
      .filter(row => {
        if (scope === "members" && row.source !== "member") return false;
        if (scope === "contacts" && row.source !== "contact") return false;
        if (roleFilter === "admin" && !["admin", "project_admin"].includes(row.role)) return false;
        if (roleFilter === "member" && (row.source !== "member" || ["admin", "project_admin"].includes(row.role))) return false;
        if (roleFilter === "external" && row.source !== "contact") return false;
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (!normalizedSearch) return true;
        return [row.fullName, row.email, row.companyName, row.role, row.status]
          .some(value => (value || "").toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const read = (row: DirectoryRow) => {
          if (sortBy === "company") return row.companyName || "";
          if (sortBy === "role") return row.role || "";
          if (sortBy === "status") return row.status || "";
          return row.fullName || "";
        };
        return read(a).localeCompare(read(b)) || a.fullName.localeCompare(b.fullName);
      });
  }, [additionalContacts, members, normalizedSearch, roleFilter, scope, sortBy, statusFilter]);

  const filteredMembers = rows.filter(row => row.source === "member");
  const filteredContacts = rows.filter(row => row.source === "contact");
  const canInvite=!!user?.isSuperAdmin||adminRoles.includes(members.find(member=>member.userId===user?.id)?.role??"");
  const anyDirectoryRecords = members.length + additionalContacts.length > 0;
  const selectedSectionCount = [pdfOptions.includeMembers, pdfOptions.includeContacts].filter(Boolean).length;

  const save = async (e:React.FormEvent) => {
    e.preventDefault();if(actionLock.current||savedReceipt||!canWrite)return;
    const current=scopeEpoch.current;actionLock.current=true;setSaving(true);setError("");
    try{
      const response=await fetch(`${API}/projects/${projectId}/directory${companyContact?"/contacts":""}`,{method:"POST",headers,body:JSON.stringify({...form,...(companyContact?{company_id:Number(form.company_id)}:{})})});
      const saved=await response.json();if(current!==scopeEpoch.current)return;if(!response.ok)throw new Error(saved.error||t("Contact could not be saved.","No se pudo guardar el contacto."));
      if(!Number.isSafeInteger(saved.id)||saved.id<=0)throw new Error(t("Contact receipt is incomplete. Reopen the directory before retrying.","El recibo está incompleto. Reabra el directorio antes de reintentar."));
      const receipt={ids:[saved.id],kind:"save",message:t("Contact saved and reopened.","Contacto guardado y reabierto.")};setSavedReceipt(receipt);await verifyReceipt(receipt);
    }catch(failure){if(current===scopeEpoch.current)setError(failure instanceof Error?failure.message:String(failure));}
    finally{if(current===scopeEpoch.current){actionLock.current=false;setSaving(false);}}
  };
  const handleImport=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0],input=e.target;if(!file||actionLock.current||savedReceipt||!canWrite)return;
    const current=scopeEpoch.current;actionLock.current=true;setImporting(true);setImportMsg(t("Reading document with AI...","Leyendo documento con IA..."));setError("");
    try{
      const data=new FormData();data.append("file",file);const response=await fetch(`${API}/projects/${projectId}/directory/import`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:data});const saved=await response.json();
      if(current!==scopeEpoch.current)return;if(!response.ok)throw new Error(saved.error||t("Import could not be saved.","No se pudo guardar la importación."));
      if(saved.projectId!==projectId||!Array.isArray(saved.entryIds)||!saved.entryIds.length||saved.imported!==saved.entryIds.length||!saved.entryIds.every((id:number)=>Number.isSafeInteger(id)&&id>0))throw new Error(t("Import receipt is incomplete. Reopen the directory before retrying.","El recibo de importación está incompleto. Reabra el directorio antes de reintentar."));
      const receipt={ids:saved.entryIds,kind:"import",message:t(`${saved.imported} imported contacts saved and reopened.`,`${saved.imported} contactos importados guardados y reabiertos.`)};setSavedReceipt(receipt);setImportMsg(t("Import saved; verifying exact contacts…","Importación guardada; verificando contactos exactos…"));await verifyReceipt(receipt);
    }catch(failure){if(current===scopeEpoch.current){setImportMsg("");setError(failure instanceof Error?failure.message:String(failure));}}
    finally{if(current===scopeEpoch.current){actionLock.current=false;setImporting(false);input.value="";}}
  };
  const invite=async(id:number)=>{
    if(actionLock.current||savedReceipt||!canInvite)return;const current=scopeEpoch.current;actionLock.current=true;setInviting(id);setError("");setExportError("");
    try{
      const response=await fetch(`${API}/projects/${projectId}/directory/${id}/invite`,{method:"POST",headers});const saved=await response.json();if(current!==scopeEpoch.current)return;
      if(!response.ok)throw new Error(saved.error||t("Invitation could not be confirmed. Reopen saved members before retrying.","No se pudo confirmar la invitación. Reabra miembros guardados antes de reintentar."));
      if(saved.projectId!==projectId||saved.entryId!==id)throw new Error(t("Invitation receipt did not match this contact.","El recibo no coincide con este contacto."));
      const message=saved.status==="invited"?saved.deliveryStatus==="sent"?t("Invitation saved; provider accepted email delivery.","Invitación guardada; el proveedor aceptó el envío."):t("Invitation saved, but email was not delivered. Reopen it before deciding to retry.","Invitación guardada, pero el correo no se entregó. Reábrala antes de decidir reintentar."):t("Project membership confirmed and directory reopened.","Membresía confirmada y directorio reabierto.");
      const receipt={ids:[id],kind:"invite",message};setSavedReceipt(receipt);await verifyReceipt(receipt);
    }catch(failure){if(current===scopeEpoch.current)setError(failure instanceof Error?failure.message:String(failure));}
    finally{if(current===scopeEpoch.current){actionLock.current=false;setInviting(null);}}
  };

  const remove = async (id: number) => {
    if (!confirm(t("Remove this entry?", "Eliminar este contacto?"))) return;
    const rDel = await fetch(`${API}/projects/${projectId}/directory/${id}`, { method: "DELETE", headers });
    if (!rDel.ok) { setExportError(t("Remove failed. Please try again.", "No se pudo eliminar. Intenta de nuevo.")); return; }
    await load();
  };

  const exportCurrentViewPdf = async () => {
    if(pdfLock.current)return;pdfLock.current=true;const current=scopeEpoch.current;
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams({
        lang,
        search,
        scope,
        role: roleFilter,
        status: statusFilter,
        sort: sortBy,
        include_members: String(pdfOptions.includeMembers),
        include_contacts: String(pdfOptions.includeContacts),
        include_email: String(pdfOptions.includeEmail),
        include_company: String(pdfOptions.includeCompany),
        include_role: String(pdfOptions.includeRole),
        include_status: String(pdfOptions.includeStatus),
      });
      const res = await fetch(`${API}/projects/${projectId}/directory/export-pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if(current!==scopeEpoch.current)return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExportError(data.error || t("Directory PDF export failed.", "No se pudo exportar el PDF del directorio."));
        return;
      }
      if(current!==scopeEpoch.current)return;
      if(!res.headers.get("Content-Type")?.includes("application/pdf"))throw new Error("Invalid PDF response");
      const blob = await res.blob();if(!blob.size)throw new Error("Empty PDF response");if(current!==scopeEpoch.current)return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("X-Report-Filename") || "Project-Directory-Current-View.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      if(current===scopeEpoch.current)setExportError(t("Directory PDF export failed.", "No se pudo exportar el PDF del directorio."));
    } finally {
      if(current===scopeEpoch.current){pdfLock.current=false;setExporting(false);}
    }
  };

  const statusBadge = (s?: string) => {
    if (s === "active") return <span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span>;
    if (s === "invited") return <span className="badge badge-info">{t("Invited", "Invitado")}</span>;
    return <span className="badge badge-outline">{t("External", "Externo")}</span>;
  };

  const roleBadge = (role: string) => {
    if (role === "admin" || role === "project_admin") return <span className="badge badge-warning">{t("Admin", "Admin")}</span>;
    return <span className="badge badge-outline">{role}</span>;
  };

  const scopeLabel = (value: DirectoryScope) => ({
    all: t("All Directory Records", "Todos los registros"),
    members: t("Project Members", "Miembros del Proyecto"),
    contacts: t("Additional Contacts", "Contactos Adicionales"),
  }[value]);
  const roleLabel = (value: DirectoryRoleFilter) => ({
    all: t("All Roles", "Todos los roles"),
    admin: t("Administrators", "Administradores"),
    member: t("Project Members", "Miembros del Proyecto"),
    external: t("External Contacts", "Contactos Externos"),
  }[value]);
  const statusLabel = (value: DirectoryStatusFilter) => ({
    all: t("All Statuses", "Todos los estados"),
    active: t("BIMLog Active", "BIMLog Activo"),
    invited: t("Invited", "Invitado"),
    external: t("External", "Externo"),
  }[value]);
  const sortLabel = (value: DirectorySort) => ({
    name: t("Name", "Nombre"),
    company: t("Company", "Empresa"),
    role: t("Role", "Rol"),
    status: t("Status", "Estado"),
  }[value]);
  const selectedSectionLabels = [
    pdfOptions.includeMembers ? t("Project Members", "Miembros del Proyecto") : "",
    pdfOptions.includeContacts ? t("Additional Contacts", "Contactos Adicionales") : "",
  ].filter(Boolean);
  const selectedColumnLabels = [
    t("Name", "Nombre"),
    pdfOptions.includeEmail ? t("Email", "Correo") : "",
    pdfOptions.includeCompany ? t("Company", "Empresa") : "",
    pdfOptions.includeRole ? t("Role", "Rol") : "",
    pdfOptions.includeStatus ? t("Status", "Estado") : "",
  ].filter(Boolean);

  const filterSummary = [
    `${t("Search", "Busqueda")}: ${search.trim() || t("All", "Todos")}`,
    `${t("Scope", "Alcance")}: ${scopeLabel(scope)}`,
    `${t("Role", "Rol")}: ${roleLabel(roleFilter)}`,
    `${t("Status", "Estado")}: ${statusLabel(statusFilter)}`,
    `${t("Sort", "Orden")}: ${sortLabel(sortBy)}`,
    `${t("Sections", "Secciones")}: ${selectedSectionLabels.join(", ") || t("None selected", "Ninguna seleccionada")}`,
    `${t("Columns", "Columnas")}: ${selectedColumnLabels.join(", ")}`,
  ];

  const renderRows = (visibleRows: DirectoryRow[], source: "member" | "contact") => visibleRows.map(row => {
    const contactEntry = source === "contact"
      ? additionalContacts.find(entry => `c-${entry.id}` === row.key)
      : null;
    return (
      <tr key={row.key}>
        <td>
          <div style={{ fontWeight: 500 }}>{row.fullName}</div>
          {pdfOptions.includeEmail && <div style={{ fontSize: 12, color: "#6B7280" }}>{isDirectoryRecipientEmail(row.email) ? row.email : isCompanyOnlyEntry(row) ? t("Company only - add a contact to invite", "Solo empresa - agregue un contacto para invitar") : t("No delivery email", "Sin correo de entrega")}</div>}
        </td>
        {pdfOptions.includeCompany && <td>{row.companyName || "-"}</td>}
        {pdfOptions.includeRole && <td>{source === "member" ? roleBadge(row.role) : row.role}</td>}
        {pdfOptions.includeStatus && <td>{source === "member" ? <span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span> : statusBadge(contactEntry?.bimlogStatus)}</td>}
        {source === "contact" && (
          <td style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {canWrite && (contactEntry?.bimlogStatus === "none" || !contactEntry?.bimlogStatus) && (
                <button className="btn btn-sm btn-outline" title={!canInvite?t("Project administrator invitation permission required.","Se requiere permiso de administrador para invitar."):undefined} onClick={() => contactEntry && invite(contactEntry.id)} disabled={!canInvite||inviting === contactEntry?.id || !isDirectoryRecipientEmail(contactEntry?.email)}>
                  {inviting === contactEntry?.id ? t("Inviting...", "Invitando...") : t("Invite", "Invitar")}
                </button>
              )}
              {canWrite && contactEntry && (
                <button className="btn btn-sm btn-danger-outline" onClick={() => remove(contactEntry.id)}>
                  {t("Remove", "Eliminar")}
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  });

  return (
    <div className="tab-content-wrapper">
      {error&&!showForm&&<p role="alert">{error}</p>}
      {savedReceipt&&<p role="status">{t("Saved change awaits exact-contact verification.","El cambio guardado espera verificación de contactos exactos.")} <button disabled={loading} onClick={()=>void verifyReceipt(savedReceipt)}>{t("Verify saved contacts","Verificar contactos guardados")}</button></p>}
      <button className="btn btn-sm btn-outline" disabled={loading||!!savedReceipt} onClick={()=>void load()}>{t("Reload saved directory","Recargar directorio guardado")}</button>
      <details style={{ marginBottom: 16 }}>
        <summary>{t("Project company choices", "Empresas disponibles del proyecto")}</summary>
        <p>{t("Saved originator codes and connected company names are available across project forms. A code alone does not create a contact, membership or contract participant.", "Los códigos de originador guardados y las empresas vinculadas están disponibles en los formularios del proyecto. Un código solo no crea un contacto, membresía ni participante contractual.")}</p>
        {companyChoices.error ? <p role="alert">{t("Company choices could not be loaded.", "No se pudieron cargar las empresas.")} <button type="button" onClick={() => void companyChoices.refresh()}>{t("Retry", "Reintentar")}</button></p> : <p>{companyChoices.loading ? t("Loading…", "Cargando…") : companyChoices.companies.join(" · ") || t("No saved companies yet.", "Todavía no hay empresas guardadas.")}</p>}
      </details>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Project Directory", "Directorio del Proyecto")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Project members are auto-populated from the team. Add external stakeholders below.", "Los miembros del proyecto se completan automaticamente. Agrega interesados externos abajo.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <PrintPdfButton
            lang={lang}
            onClick={exportCurrentViewPdf}
            loading={exporting}
            configurationInvalid={selectedSectionCount === 0}
            disabledReason={t("Select at least one PDF section", "Selecciona al menos una sección PDF")}
            currentViewSummary={[...filterSummary, `${t("Showing", "Mostrando")}: ${rows.length}/${members.length + additionalContacts.length}`]}
            options={
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {([
                  ["includeMembers", t("Project Members section", "Sección Miembros del Proyecto")],
                  ["includeContacts", t("Additional Contacts section", "Sección Contactos Adicionales")],
                  ["includeEmail", t("Email column", "Columna correo")],
                  ["includeCompany", t("Company column", "Columna empresa")],
                  ["includeRole", t("Role column", "Columna rol")],
                  ["includeStatus", t("Status column", "Columna estado")],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={pdfOptions[key]}
                      onChange={event => setPdfOptions(current => ({ ...current, [key]: event.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            }
          />
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing||!!savedReceipt} style={{ display: "none" }} />
              <span className="btn btn-outline" style={{ opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? t("Importing...","Importando...") : t("Import Contacts","Importar contactos")}
              </span>
            </label>
          )}
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <UserPlus size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {t("Add External Contact", "Agregar Contacto Externo")}
            </button>
          )}
        </div>
      </div>

      {(importMsg || exportError) && (
        <div className={exportError ? "alert alert-danger" : "alert alert-info"} style={{ marginBottom: 12 }}>
          {exportError || importMsg}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label className="label">{t("Search", "Busqueda")}</label>
            <input
              className="input" placeholder={t("Search by name, email, company, role, or status...", "Buscar por nombre, correo, empresa, rol o estado...")}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Directory Scope", "Alcance del Directorio")}</label>
            <select className="input" value={scope} onChange={e => setScope(e.target.value as DirectoryScope)}>
              <option value="all">{t("All Directory Records", "Todos los registros")}</option>
              <option value="members">{t("Project Members", "Miembros del Proyecto")}</option>
              <option value="contacts">{t("Additional Contacts", "Contactos Adicionales")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Role", "Rol")}</label>
            <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value as DirectoryRoleFilter)}>
              <option value="all">{t("All Roles", "Todos los roles")}</option>
              <option value="admin">{t("Administrators", "Administradores")}</option>
              <option value="member">{t("Project Members", "Miembros del Proyecto")}</option>
              <option value="external">{t("External Contacts", "Contactos Externos")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Status", "Estado")}</label>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as DirectoryStatusFilter)}>
              <option value="all">{t("All Statuses", "Todos los estados")}</option>
              <option value="active">{t("BIMLog Active", "BIMLog Activo")}</option>
              <option value="invited">{t("Invited", "Invitado")}</option>
              <option value="external">{t("External", "Externo")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Sort By", "Ordenar por")}</label>
            <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as DirectorySort)}>
              <option value="name">{t("Name", "Nombre")}</option>
              <option value="company">{t("Company", "Empresa")}</option>
              <option value="role">{t("Role", "Rol")}</option>
              <option value="status">{t("Status", "Estado")}</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#6B7280" }}>
          {t("Current view", "Vista actual")}: {filterSummary.join(" | ")} | {t("Showing", "Mostrando")} {rows.length} {t("of", "de")} {members.length + additionalContacts.length}
          {duplicateContactCount > 0 && (
            <> | {t("Duplicate contact emails consolidated under Project Members", "Correos duplicados consolidados bajo Miembros del Proyecto")}: {duplicateContactCount}</>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("Add External Contact", "Agregar Contacto Externo")}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))", gap: 12 }}><fieldset disabled={saving||!!savedReceipt} style={{display:"contents"}}>
            <div>
              <label className="label">{t("Full Name", "Nombre Completo")} *</label>
              <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Email", "Correo")} *</label>
              <input className="input" type="email" required={!companyContact} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label><input type="checkbox" checked={companyContact} onChange={event=>setCompanyContact(event.target.checked)}/>{t("Contact for a saved project company","Contacto de una empresa guardada del proyecto")}</label>
              {companyContact?<select className="input" required aria-label={t("Saved project company","Empresa guardada del proyecto")} value={form.company_id} onChange={event=>setForm(value=>({...value,company_id:event.target.value,company_name:savedCompanies.find(([id])=>id===Number(event.target.value))?.[1]||""}))}><option value="">{t("Choose saved company","Elija empresa guardada")}</option>{savedCompanies.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>:<><label className="label">{t("Company","Empresa")}</label><input className="input" value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))}/></>}
            </div>
            <div>
              <label className="label">{t("Role", "Rol")} *</label>
              <input className="input" required placeholder={t("Architect, Engineer, Contractor...", "Arquitecto, Ingeniero...")} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Notes", "Notas")}</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving...", "Guardando...") : t("Save", "Guardar")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </fieldset></form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading...", "Cargando...")}</div>}

      {!loading && !error && !anyDirectoryRecords && (
        <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
          <Users size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>{t("No directory records yet", "Aun no hay registros del directorio")}</div>
        </div>
      )}

      {!loading && !error && anyDirectoryRecords && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
          <Users size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{t("No records match the current filters", "Ningun registro coincide con los filtros actuales")}</div>
          <div style={{ fontSize: 12 }}>{t("Clear or adjust the filters to show more directory records.", "Limpia o ajusta los filtros para ver mas registros del directorio.")}</div>
        </div>
      )}

      {!loading && pdfOptions.includeMembers && filteredMembers.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <UserCheck size={16} color="#16A34A" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Project Members", "Miembros del Proyecto")} ({filteredMembers.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              - {t("Auto-populated from project team", "Auto-completado desde el equipo")}
            </span>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>{t("Name", "Nombre")}</th>
                  {pdfOptions.includeCompany && <th>{t("Company", "Empresa")}</th>}
                  {pdfOptions.includeRole && <th>{t("Role", "Rol")}</th>}
                  {pdfOptions.includeStatus && <th>{t("Status", "Estado")}</th>}
                </tr>
              </thead>
              <tbody>{renderRows(filteredMembers, "member")}</tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && pdfOptions.includeContacts && filteredContacts.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Users size={16} color="#6B7280" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Additional Contacts", "Contactos Adicionales")} ({filteredContacts.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              - {t("External stakeholders not yet on BIMLog", "Interesados externos aun no en BIMLog")}
            </span>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>{t("Name", "Nombre")}</th>
                  {pdfOptions.includeCompany && <th>{t("Company", "Empresa")}</th>}
                  {pdfOptions.includeRole && <th>{t("Role", "Rol")}</th>}
                  {pdfOptions.includeStatus && <th>{t("Status", "Estado")}</th>}
                  <th style={{ textAlign: "right" }}>{t("Actions", "Acciones")}</th>
                </tr>
              </thead>
              <tbody>{renderRows(filteredContacts, "contact")}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
