import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { Copy, CheckCircle2, Plus, RotateCcw, Download, Trash2, Settings, AlertCircle, ChevronDown, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGetConvention } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

// ─── helpers ─────────────────────────────────────────────────────────────────
function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }

// ─── searchable combobox ──────────────────────────────────────────────────────
function SearchableSelect({
  value, onChange, options, color, placeholder, lang,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  color: { bg: string; color: string; border: string };
  placeholder?: string;
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // focus the search input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 10px", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${open ? color.color : color.border}`,
          background: color.bg, color: color.color,
          fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
          boxShadow: open ? `0 0 0 2px ${color.border}` : "none",
          transition: "box-shadow 0.15s",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder || w("Select…", "Seleccionar…", lang)}
        </span>
        <ChevronDown style={{ width: 13, height: 13, flexShrink: 0, marginLeft: 6, opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {/* dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
          background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden",
          minWidth: 180,
        }}>
          {/* search box */}
          <div style={{ padding: "8px 8px 4px" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && filtered.length > 0) select(filtered[0]);
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
              }}
              placeholder={w("Type to search…", "Escribe para buscar…", lang)}
              style={{
                width: "100%", height: 30, fontSize: 12, padding: "0 8px",
                border: "1px solid hsl(var(--border))", borderRadius: 5,
                background: "hsl(var(--secondary))", color: "hsl(var(--foreground))",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          {/* option list */}
          <div style={{ maxHeight: 240, overflowY: "auto", padding: "4px 4px 8px" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
                {w("No match", "Sin coincidencias", lang)}
              </div>
            ) : filtered.map(opt => (
              <button
                key={opt}
                onClick={() => select(opt)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "7px 12px", borderRadius: 5, cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: opt === value ? 700 : 500,
                  background: opt === value ? color.bg : "transparent",
                  color: opt === value ? color.color : "hsl(var(--foreground))",
                  border: "none",
                }}
                onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--secondary))"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = opt === value ? color.bg : "transparent"; }}
              >
                {opt}
                {opt === value && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>Selected</span>}
              </button>
            ))}
          </div>
          {/* count hint */}
          {options.length > 10 && (
            <div style={{ padding: "4px 12px 8px", fontSize: 10, color: "hsl(var(--muted-foreground))", borderTop: "1px solid hsl(var(--border))" }}>
              {filtered.length} / {options.length} {w("options", "opciones", lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SavedName { name: string; savedAt: string; }

const CHIP_COLORS = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
  { bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  { bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" },
  { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
  { bg: "#FCE7F3", color: "#9D174D", border: "#FBCFE8" },
  { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA" },
  { bg: "#E0F2FE", color: "#0C4A6E", border: "#BAE6FD" },
  { bg: "#F3F4F6", color: "#374151", border: "#D1D5DB" },
];

// ─── component ───────────────────────────────────────────────────────────────
export function NameGenerator({ projectId: projectIdProp, onGoToConvention }: { projectId?: number; onGoToConvention?: () => void }) {
  const { toast } = useToast();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const search = useSearch();

  // Read returnTo from query params
  const returnTo = new URLSearchParams(search).get("returnTo");

  // Read projectId from URL params as fallback (supports direct navigation via setLocation)
  const [matchGenerator, paramsGenerator] = useRoute("/projects/:id/generator");
  const [matchTab, paramsTab] = useRoute("/projects/:id/:tab");
  const urlProjectId = matchGenerator
    ? parseInt(paramsGenerator!.id)
    : matchTab
      ? parseInt(paramsTab!.id)
      : 0;
  const projectId = projectIdProp ?? urlProjectId;

  const { data: convention, isLoading, isError } = useGetConvention(projectId);

  // Build fields from convention — one selected value per field
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [disabledFields, setDisabledFields] = useState<Record<string, boolean>>({});

  const toggleField = (label: string) => {
    setDisabledFields(prev => ({ ...prev, [label]: !prev[label] }));
  };
  const [copied, setCopied] = useState(false);
  const [savedNames, setSavedNames] = useState<SavedName[]>([]);
  const [recentNames, setRecentNames] = useState<{ name: string; ts: string }[]>([]);

  // When convention loads, initialise selections with the first allowed value of each field
  useEffect(() => {
    if (!convention || !convention.fields) return;
    const initial: Record<string, string> = {};
    [...convention.fields]
      .sort((a: any, b: any) => a.fieldOrder - b.fieldOrder)
      .forEach((field: any) => {
        if (field.allowedValues && field.allowedValues.length > 0) {
          initial[field.label] = field.allowedValues[0];
        } else {
          initial[field.label] = "";
        }
      });
    setSelections(initial);
  }, [convention]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <AlertCircle style={{ width: 32, height: 32, color: "#DC2626", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{w("Failed to load convention","Error al cargar la convención",lang)}</div>
      </div>
    );
  }

  const hasConvention = convention && convention.fields && convention.fields.length > 0 && convention.isActive;

  if (!hasConvention) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", maxWidth: 500, margin: "0 auto" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "#F0F7FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Settings style={{ width: 24, height: 24, color: "#2563EB" }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "hsl(var(--foreground))" }}>
          {w("No active convention set up for this project", "No hay convención activa para este proyecto", lang)}
        </div>
        <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.6 }}>
          {w("A naming convention defines the structure and allowed values for every file name on this project. Once set up, the Name Generator will let your team build perfectly structured file names.", "Una convención de nombres define la estructura y los valores permitidos. Una vez configurada, el Generador de Nombres permitirá crear nombres de archivo perfectamente estructurados.", lang)}
        </div>
        {onGoToConvention && (
          <Button onClick={onGoToConvention} style={{ gap: 6, fontSize: 13 }}>
            <Settings style={{ width: 14, height: 14 }} />
            {w("Go to Convention Builder", "Ir al Constructor de Convenciones", lang)}
          </Button>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          {w("Only the project admin (GC) can create the naming convention.", "Solo el administrador del proyecto puede crear la convención de nombres.", lang)}
        </div>
      </div>
    );
  }

  const sep: string = (convention as any).separator || "-";

  const fields = [...convention.fields]
    .sort((a: any, b: any) => a.fieldOrder - b.fieldOrder);

  const tokens = fields
    .filter((field: any) => !disabledFields[field.label])
    .map((field: any) => selections[field.label] || "");
  const generatedName = tokens.filter(Boolean).join(sep);

  const handleCopy = () => {
    if (!generatedName) return;
    navigator.clipboard.writeText(generatedName);
    setCopied(true);
    toast({ title: w("File name copied to clipboard", "Nombre de archivo copiado", lang) });
    setTimeout(() => setCopied(false), 2000);
    setRecentNames(prev => [{ name: generatedName, ts: new Date().toISOString() }, ...prev].slice(0, 5));
  };

  const handleSave = () => {
    if (!generatedName) return;
    setSavedNames(prev => [{ name: generatedName, savedAt: new Date().toISOString() }, ...prev]);
    setRecentNames(prev => [{ name: generatedName, ts: new Date().toISOString() }, ...prev].slice(0, 5));
    toast({ title: w("Saved to list", "Guardado en la lista", lang) });
  };

  const handleReset = () => {
    const initial: Record<string, string> = {};
    fields.forEach((field: any) => {
      initial[field.label] = field.allowedValues?.[0] || "";
    });
    setSelections(initial);
  };

  const exportList = () => {
    if (!savedNames.length) return;
    const content = savedNames.map(n => n.name).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bimlog-names-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Back to Files button — always visible */}
      <button
        onClick={() => setLocation(returnTo || `/projects/${projectId}/files`)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginBottom: 16, padding: "6px 12px", borderRadius: 6,
          border: "1px solid hsl(var(--border))",
          background: "transparent", cursor: "pointer",
          fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-foreground))",
        }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        {w("Back to Files", "Volver a Archivos", lang)}
      </button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 3 }}>
          {w("File Name Generator", "Generador de Nombres de Archivo", lang)}
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          {w("Select values for each field to build a perfectly structured file name. All options come from the active naming convention.", "Selecciona valores para cada campo y construye un nombre de archivo estructurado. Todas las opciones provienen de la convención activa.", lang)}
        </div>
      </div>

      {/* Field selectors — convention-driven */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "12px 16px",
        marginBottom: 20,
      }}>
        {fields.map((field: any, idx: number) => {
          const c = CHIP_COLORS[idx % CHIP_COLORS.length];
          const vals: string[] = field.allowedValues || [];
          const current = selections[field.label] || "";
          const isProjectCode = field.label === "Project Code";
          return (
            <div key={field.label} style={{ opacity: disabledFields[field.label] ? 0.4 : 1 }}>
              {(field.label === "Sequence" || field.label === "Status" || field.label === "Revision") && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <button
                    onClick={() => toggleField(field.label)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 4, cursor: "pointer",
                      border: `1px solid ${disabledFields[field.label] ? "#D1D5DB" : "#1D4ED8"}`,
                      background: disabledFields[field.label] ? "#F3F4F6" : "#EFF6FF",
                      color: disabledFields[field.label] ? "#6B7280" : "#1D4ED8",
                    }}
                  >
                    {disabledFields[field.label] ? "Include" : "Exclude"}
                  </button>
                </div>
              )}
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                color: "hsl(var(--muted-foreground))",
                textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
              }}>
                {field.label}
              </label>
              {isProjectCode ? (
                <div style={{
                  padding: "8px 14px",
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1D4ED8",
                  letterSpacing: "0.05em",
                  fontFamily: "var(--font-mono)",
                }}>
                  {vals[0] ?? "—"}
                </div>
              ) : vals.length > 0 ? (
                <SearchableSelect
                  value={current}
                  onChange={v => setSelections(prev => ({ ...prev, [field.label]: v }))}
                  options={vals}
                  color={c}
                  lang={lang}
                />
              ) : (
                <Input
                  value={current}
                  onChange={e => setSelections(prev => ({ ...prev, [field.label]: e.target.value }))}
                  placeholder={w("Enter value…", "Ingresa un valor…", lang)}
                  style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Generated file name box */}
      <div style={{
        padding: "16px 20px",
        background: "#F8FAFC",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))",
          textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10,
        }}>
          {w("Generated File Name", "Nombre de Archivo Generado", lang)}
        </div>

        {/* Assembled name */}
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700,
          color: "hsl(var(--foreground))", marginBottom: 12, wordBreak: "break-all",
          letterSpacing: "0.01em", lineHeight: 1.4,
        }}>
          {generatedName || <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>{w("Select values above to generate a file name", "Selecciona valores arriba para generar un nombre", lang)}</span>}
        </div>

        {/* Token chips */}
        {tokens.some(t => t) && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
            {tokens.map((tok, i) => {
              const c = CHIP_COLORS[i % CHIP_COLORS.length];
              const fieldLabel = fields[i]?.label || `Field ${i+1}`;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span
                    title={fieldLabel}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                      padding: "2px 7px", borderRadius: 4, cursor: "default",
                    }}
                  >
                    {tok}
                  </span>
                  {i < tokens.length - 1 && (
                    <span style={{ color: "#CBD5E1", fontSize: 13, fontWeight: 400, fontFamily: "var(--font-mono)" }}>{sep}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Button
          onClick={handleCopy}
          disabled={!generatedName}
          style={{
            gap: 6, fontSize: 12,
            background: copied ? "#16A34A" : undefined,
            borderColor: copied ? "#16A34A" : undefined,
          }}
        >
          {copied
            ? <><CheckCircle2 style={{ width: 13, height: 13 }} /> {w("Copied!","¡Copiado!",lang)}</>
            : <><Copy style={{ width: 13, height: 13 }} /> {w("Copy file name","Copiar nombre",lang)}</>
          }
        </Button>
        <Button variant="outline" onClick={handleSave} disabled={!generatedName} style={{ gap: 6, fontSize: 12 }}>
          <Plus style={{ width: 13, height: 13 }} />
          {w("Save to list","Guardar en lista",lang)}
        </Button>
        <Button variant="ghost" onClick={handleReset} style={{ gap: 6, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          <RotateCcw style={{ width: 12, height: 12 }} />
          {w("Reset","Restablecer",lang)}
        </Button>
      </div>

      {/* Recent Names */}
      {recentNames.length > 0 && (
        <div style={{ marginBottom: 20, padding: "12px 16px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>{w("Recent names","Nombres recientes",lang)}</span>
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>({w("this session","esta sesión",lang)})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recentNames.map((entry, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "hsl(var(--foreground))", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                  {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button onClick={() => { navigator.clipboard.writeText(entry.name); toast({ title: w("Copied","Copiado",lang) }); }} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                  <Copy style={{ width: 11, height: 11 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Naming structure bar */}
      <div style={{
        padding: "12px 16px",
        background: "#F8FAFC",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
          {w("Convention structure (from your active convention)","Estructura de la convención (de tu convención activa)",lang)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
          {fields.map((field: any, i: number) => {
            const c = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                  padding: "2px 7px", borderRadius: 4,
                }}>
                  {field.label}
                </span>
                {i < fields.length - 1 && (
                  <span style={{ color: "#CBD5E1", fontSize: 13, fontFamily: "var(--font-mono)" }}>{sep}</span>
                )}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
          {w(`Separator: "${sep === "-" ? "hyphen (-)" : "underscore (_)"}" • ${fields.length} fields`, `Separador: "${sep === "-" ? "guión (-)" : "guión bajo (_)"}" • ${fields.length} campos`, lang)}
        </div>
      </div>

      {/* Saved names list */}
      {savedNames.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {w("Saved names","Nombres guardados",lang)}{" "}
              <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
                {savedNames.length} {w("in list","en lista",lang)}
              </span>
            </div>
            <button
              onClick={exportList}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              <Download style={{ width: 12, height: 12 }} />
              {w("Export .txt","Exportar .txt",lang)}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {savedNames.map((entry, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 7 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "hsl(var(--foreground))", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.name}
                </span>
                <button onClick={() => { navigator.clipboard.writeText(entry.name); toast({ title: w("Copied","Copiado",lang) }); }} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                  <Copy style={{ width: 12, height: 12 }} />
                </button>
                <button onClick={() => setSavedNames(prev => prev.filter((_, j) => j !== i))} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
