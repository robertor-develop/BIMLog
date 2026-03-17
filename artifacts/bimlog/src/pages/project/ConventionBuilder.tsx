import { useState, useEffect, useRef } from "react";
import { useGetConvention, useUpsertConvention } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Eye, RefreshCw, AlertCircle } from "lucide-react";

interface Field { label: string; values: string; }

const CHIP_COLORS = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
  { bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  { bg: "#FEF9C3", color: "#854D0E", border: "#FDE68A" },
  { bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
  { bg: "#FCE7F3", color: "#9D174D", border: "#FBCFE8" },
  { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  { bg: "#FEF2F2", color: "#991B1B", border: "#FECACA" },
];

export function ConventionBuilder({ projectId }: { projectId: number }) {
  const { lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const separatorOptions = getOptions("separator");
  const { toast } = useToast();

  const { data: convention, isLoading, isError, refetch } = useGetConvention(projectId);

  const [separator, setSeparator] = useState(separatorOptions[0]?.value ?? "-");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadedConventionId = useRef<number | null>(null);
  const loadedConventionTs = useRef<string | null>(null);

  useEffect(() => {
    if (!convention) return;

    const sameId = loadedConventionId.current === convention.id;
    const sameTs = loadedConventionTs.current === convention.updatedAt;

    if (sameId && sameTs) return;

    loadedConventionId.current = convention.id;
    loadedConventionTs.current = convention.updatedAt;

    setSeparator(convention.separator);
    setIsActive(convention.isActive);
    setFields(
      [...convention.fields]
        .sort((a, b) => a.fieldOrder - b.fieldOrder)
        .map(f => ({ label: f.label, values: f.allowedValues.join(", ") }))
    );
    setDirty(false);
  }, [convention]);

  const { mutate, isPending } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
        toast({ title: "Convention saved — validation rules updated immediately" });
        setDirty(false);
      },
      onError: () => toast({ title: "Error saving convention", variant: "destructive" }),
    },
  });

  const handleSave = () => {
    const formattedFields = fields.map((f, idx) => ({
      label: f.label.trim(),
      fieldOrder: idx,
      allowedValues: f.values.split(",").map(v => v.trim()).filter(Boolean),
    }));
    mutate({ projectId, data: { separator, isActive, fields: formattedFields } });
  };

  const addField = () => {
    setFields(prev => [...prev, { label: `Field ${prev.length + 1}`, values: "" }]);
    setDirty(true);
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateField = (idx: number, key: keyof Field, val: string) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
    setDirty(true);
  };

  const handleDiscard = () => {
    if (!convention) return;
    setSeparator(convention.separator);
    setIsActive(convention.isActive);
    setFields(
      [...convention.fields]
        .sort((a, b) => a.fieldOrder - b.fieldOrder)
        .map(f => ({ label: f.label, values: f.allowedValues.join(", ") }))
    );
    setDirty(false);
  };

  const previewTokens = fields.map(f => {
    const vals = f.values.split(",").map(v => v.trim()).filter(Boolean);
    return vals[0] || f.label.toUpperCase().replace(/\s+/g, "").slice(0, 4);
  });
  const previewName = previewTokens.join(separator);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <AlertCircle style={{ width: 32, height: 32, color: "#DC2626", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 6 }}>
          Failed to load convention
        </div>
        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>
          Could not fetch naming convention data. Check your connection and try again.
        </div>
        <Button variant="outline" onClick={() => refetch()} style={{ gap: 6, fontSize: 12 }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 2 }}>
            Naming Convention Builder
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            Define the naming structure enforced on every uploaded file
          </div>
        </div>
        {dirty && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: "#FFFBEB", color: "#B45309",
            border: "1px solid #FDE68A",
            padding: "5px 11px", borderRadius: 6,
            flexShrink: 0,
          }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* Settings row */}
      <div style={{
        padding: "14px 16px", marginBottom: 14,
        background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{
            fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))",
            textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            Separator
          </label>
          <select
            value={separator}
            onChange={e => { setSeparator(e.target.value); setDirty(true); }}
            style={{ height: 34, fontSize: 13, minWidth: 160 }}
          >
            {separatorOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {lang === "es" ? opt.labelEs : opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => { setIsActive(e.target.checked); setDirty(true); }}
              style={{ width: 15, height: 15, accentColor: "#2563EB", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
              Active convention
            </span>
          </label>
          {isActive ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              background: "#F0FDF4", color: "#166534",
              border: "1px solid #BBF7D0",
              padding: "3px 9px", borderRadius: 5,
            }}>
              <CheckCircle2 style={{ width: 10, height: 10 }} />
              Enforcing uploads
            </span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))",
              border: "1px solid hsl(var(--border))",
              padding: "3px 9px", borderRadius: 5,
            }}>
              Not enforcing
            </span>
          )}
        </div>
      </div>

      {/* LIVE PREVIEW — only when there are fields */}
      {fields.length > 0 && (
        <div style={{
          marginBottom: 16, padding: "16px 20px",
          background: "#F0F7FF", border: "1px solid #BFDBFE",
          borderRadius: 8,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
            fontSize: 10, fontWeight: 700, color: "#1D4ED8",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <Eye style={{ width: 12, height: 12 }} />
            Live preview
          </div>

          {/* Colored token chips */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3, marginBottom: 12 }}>
            {previewTokens.map((tok, i) => {
              const c = CHIP_COLORS[i % CHIP_COLORS.length];
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                    background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                    padding: "3px 8px", borderRadius: 4,
                  }}>
                    {tok}
                  </span>
                  {i < previewTokens.length - 1 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#1D4ED8", fontWeight: 700 }}>
                      {separator}
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {/* Large monospace assembled name */}
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
            color: "#0F1623", letterSpacing: "0.01em", wordBreak: "break-all",
            lineHeight: 1.3, marginBottom: 10,
          }}>
            {previewName}
          </div>

          {/* Field legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {fields.map((f, i) => {
              const c = CHIP_COLORS[i % CHIP_COLORS.length];
              return (
                <span key={i} style={{ fontSize: 10, color: "#374151", display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: c.bg, border: `1px solid ${c.border}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: c.color, fontFamily: "var(--font-mono)",
                  }}>
                    {i + 1}
                  </span>
                  {f.label}
                  {i < fields.length - 1 && <span style={{ color: "#BFDBFE", marginLeft: 3 }}>·</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Naming Fields section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
            Naming Fields{" "}
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
              {fields.length} field{fields.length !== 1 ? "s" : ""} defined
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={addField} style={{ gap: 5, fontSize: 12 }}>
            <Plus style={{ width: 12, height: 12 }} />
            Add Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <div style={{
            padding: "40px 24px", textAlign: "center",
            background: "hsl(var(--secondary))",
            border: "2px dashed hsl(var(--border))",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 6 }}>
              No naming convention defined yet
            </div>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 18, maxWidth: 380, margin: "0 auto 18px" }}>
              Add fields to define the ISO 19650 naming structure that every uploaded file must follow.
              Each field can have a list of allowed values.
            </div>
            <Button onClick={addField} style={{ gap: 6, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />
              Add first field
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Column headers */}
            <div style={{
              display: "grid", gridTemplateColumns: "36px 1fr 2fr 32px",
              gap: 8, paddingLeft: 4, paddingRight: 4,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>#</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Field Label</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Allowed Values (comma-separated)</div>
              <div />
            </div>

            {fields.map((field, idx) => {
              const c = CHIP_COLORS[idx % CHIP_COLORS.length];
              const chips = field.values.split(",").map(v => v.trim()).filter(Boolean);
              return (
                <div
                  key={idx}
                  style={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "12px 12px 10px 12px",
                  }}
                >
                  <div style={{
                    display: "grid", gridTemplateColumns: "36px 1fr 2fr 32px",
                    gap: 8, alignItems: "start",
                  }}>
                    {/* Position badge */}
                    <div style={{ paddingTop: 6 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: 6,
                        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                        fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                      }}>
                        {idx + 1}
                      </span>
                    </div>

                    {/* Label input */}
                    <Input
                      value={field.label}
                      onChange={e => updateField(idx, "label", e.target.value)}
                      placeholder="e.g. Project Code"
                      style={{ fontSize: 13 }}
                    />

                    {/* Values input + chips */}
                    <div>
                      <Input
                        value={field.values}
                        onChange={e => updateField(idx, "values", e.target.value)}
                        placeholder="e.g. PROJ01, PROJ02, PROJ03"
                        style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
                      />
                      {chips.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {chips.slice(0, 10).map((v, i) => (
                            <span key={i} style={{
                              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                              background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE",
                              padding: "1px 6px", borderRadius: 3,
                            }}>
                              {v}
                            </span>
                          ))}
                          {chips.length > 10 && (
                            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                              +{chips.length - 10} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remove */}
                    <div style={{ paddingTop: 4 }}>
                      <button
                        onClick={() => removeField(idx)}
                        style={{
                          padding: 5, border: "none", background: "transparent",
                          cursor: "pointer", color: "hsl(var(--muted-foreground))",
                          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                        onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 14, borderTop: "1px solid hsl(var(--border))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#B45309" }}>
          <AlertTriangle style={{ width: 13, height: 13 }} />
          Changes take effect immediately on all new uploads
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              style={{ fontSize: 12 }}
            >
              Discard changes
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isPending || fields.length === 0}
            style={{ gap: 6, fontSize: 12 }}
          >
            {isPending ? "Saving…" : "Save Convention"}
          </Button>
        </div>
      </div>
    </div>
  );
}
