import { useMemo, useState } from "react";
import type { Rfi } from "@workspace/api-client-react";

export type RfiListView = "list" | "log";
export type RfiDateField = "created" | "requested" | "required" | "answered";
export type RfiSort = "created_asc" | "created_desc" | "required_asc" | "required_desc" | "number_asc" | "number_desc" | "status_asc";

type RfiListStateOptions = {
  rfis: Rfi[] | undefined;
  lang: string;
  getStatusLabel: (value: string) => string;
  typeOptions: string[];
};

const localized = (en: string, es: string, lang: string) => lang === "es" ? es : en;

export function rfiBallInCourtValue(rfi: Rfi): string {
  if (rfi.status === "closed") return "Closed";
  if (rfi.sendStatus !== "sent" && !rfi.sentAt) return `${rfi.submittedByCompany || rfi.createdByName || "Author"} — to send`;
  const storedResponsibility = rfi.ballInCourt?.trim();
  if (storedResponsibility) return storedResponsibility;
  if (rfi.status === "responded") return rfi.submittedByCompany || rfi.createdByName || "Unassigned";
  return rfi.submittedToCompany || rfi.submittedToPerson || "Unassigned";
}

export function rfiDateValue(rfi: Rfi, field: RfiDateField) {
  if (field === "requested") return rfi.dateRequested || rfi.createdAt;
  if (field === "required") return rfi.dateRequired || rfi.dueDate;
  if (field === "answered") return rfi.dateAnswered || rfi.respondedAt;
  return rfi.createdAt;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function useRfiListState({ rfis, lang, getStatusLabel, typeOptions }: RfiListStateOptions) {
  const [view, setView] = useState<RfiListView>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ballInCourtFilter, setBallInCourtFilter] = useState("all");
  const [sentToCompanyFilter, setSentToCompanyFilter] = useState("all");
  const [dateField, setDateField] = useState<RfiDateField>("required");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<RfiSort>("created_asc");

  const ballInCourtOptions = useMemo(() => uniqueValues((rfis || []).map(rfi => rfiBallInCourtValue(rfi))), [rfis]);
  const sentToCompanyOptions = useMemo(() => uniqueValues((rfis || []).map(rfi => rfi.submittedToCompany || rfi.submittedToPerson)), [rfis]);

  const filtered = useMemo(() => (rfis || [])
    .filter(rfi => statusFilter === "all" || rfi.status === statusFilter)
    .filter(rfi => typeFilter === "all" || (rfi.rfiType || "") === typeFilter)
    .filter(rfi => ballInCourtFilter === "all" || rfiBallInCourtValue(rfi) === ballInCourtFilter)
    .filter(rfi => sentToCompanyFilter === "all" || (rfi.submittedToCompany || rfi.submittedToPerson || "") === sentToCompanyFilter)
    .filter(rfi => {
      if (!dateFrom && !dateTo) return true;
      const raw = rfiDateValue(rfi, dateField);
      if (!raw) return false;
      const value = new Date(raw).getTime();
      if (dateFrom && value < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && value > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
      return true;
    })
    .filter(rfi => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [rfi.number, rfi.subject, rfi.rfiType, rfiBallInCourtValue(rfi), rfi.submittedByCompany, rfi.submittedByContact, rfi.submittedToCompany, rfi.submittedToPerson]
        .some(value => String(value || "").toLowerCase().includes(query));
    })
    .sort((left, right) => {
      if (sortBy === "created_desc") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (sortBy === "required_asc" || sortBy === "required_desc") {
        const leftDate = new Date(left.dateRequired || left.dueDate || "9999-12-31").getTime();
        const rightDate = new Date(right.dateRequired || right.dueDate || "9999-12-31").getTime();
        return sortBy === "required_desc" ? rightDate - leftDate : leftDate - rightDate;
      }
      if (sortBy === "number_asc" || sortBy === "number_desc") {
        const result = left.number.localeCompare(right.number, undefined, { numeric: true, sensitivity: "base" });
        return sortBy === "number_desc" ? -result : result;
      }
      if (sortBy === "status_asc") return `${left.status}-${left.number}`.localeCompare(`${right.status}-${right.number}`, undefined, { numeric: true, sensitivity: "base" });
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }), [ballInCourtFilter, dateField, dateFrom, dateTo, rfis, search, sentToCompanyFilter, sortBy, statusFilter, typeFilter]);

  const buildCurrentViewParams = (mode?: "download" | "print") => {
    const params = new URLSearchParams({ view, status: statusFilter, search: search.trim(), rfi_type: typeFilter, ball_in_court: ballInCourtFilter, sent_to_company: sentToCompanyFilter, date_field: dateField, sort: sortBy });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (mode === "print") params.set("disposition", "inline");
    return params;
  };

  const ballInCourtDisplay = (value: string) => value === "Closed" ? localized("Closed", "Cerrado", lang) : value === "Unassigned" ? localized("Unassigned", "Sin asignar", lang) : value;
  const currentViewSummary = useMemo(() => [
    `${localized("View", "Vista", lang)}: ${view === "log" ? localized("RFI Log", "Registro RFI", lang) : localized("RFI List", "Lista RFI", lang)}`,
    `${localized("Status", "Estado", lang)}: ${statusFilter === "all" ? localized("All", "Todos", lang) : getStatusLabel(statusFilter)}`,
    `${localized("Type", "Tipo", lang)}: ${typeFilter === "all" ? localized("All", "Todos", lang) : typeFilter}`,
    search.trim() ? `${localized("Search", "Busqueda", lang)}: ${search.trim()}` : "",
    ballInCourtFilter !== "all" ? `${localized("Ball in Court", "Responsable", lang)}: ${ballInCourtDisplay(ballInCourtFilter)}` : "",
    sentToCompanyFilter !== "all" ? `${localized("Sent To Company", "Empresa Destino", lang)}: ${sentToCompanyFilter}` : "",
    dateFrom || dateTo ? `${localized("Date Range", "Rango de Fechas", lang)} (${dateField}): ${dateFrom || localized("Any", "Cualquiera", lang)} - ${dateTo || localized("Any", "Cualquiera", lang)}` : "",
    `${localized("Sort", "Orden", lang)}: ${sortBy.replace(/_/g, " ")}`,
    `${localized("Visible", "Visible", lang)}: ${filtered.length}/${rfis?.length ?? 0}`,
  ].filter(Boolean), [ballInCourtFilter, dateField, dateFrom, dateTo, filtered.length, getStatusLabel, lang, rfis?.length, search, sentToCompanyFilter, sortBy, statusFilter, typeFilter, view]);

  return { view, setView, search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter, ballInCourtFilter, setBallInCourtFilter, sentToCompanyFilter, setSentToCompanyFilter, dateField, setDateField, dateFrom, setDateFrom, dateTo, setDateTo, sortBy, setSortBy, typeFilterOptions: typeOptions, ballInCourtOptions, sentToCompanyOptions, filtered, currentViewSummary, buildCurrentViewParams, ballInCourtDisplay };
}
