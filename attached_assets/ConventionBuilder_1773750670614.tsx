import { useState, useEffect } from "react";
import { useGetConvention, useUpsertConvention } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2, GripVertical, AlertTriangle, CheckCircle2, Eye } from "lucide-react";

interface Field { label: string; values: string; }

export function ConventionBuilder({ projectId }: { projectId: number }) {
  const { t, lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const separatorOptions = getOptions("separator");
  const { toast } = useToast();

  const { data: convention, isLoading } = useGetConvention(projectId);

  const [separator, setSeparator] = useState(separatorOptions[0]?.value ?? "-");
  const [isActive, setIsActive]   = useState(true);
  const [fields, setFields]       = useState<Field[]>([]);
  const [dirty, setDirty]         = useState(false);

  useEffect(() => {
    if (convention) {
      setSeparator(convention.separator);
      setIsActive(convention.isActive);
      setFields(
        [...convention.fields]
          .sort((a, b) => a.fieldOrder - b.fieldOrder)
          .map(f => ({ label: f.label, values: f.allowedValues.join(", ") }))
      );
      setDirty(false);
    }
  }, [convention]);

  const { mutate, isPending } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
        toast({ title: "Convention saved — validation rules updated immediately" });
        setDirty(false);
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
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

  // Live preview of generated name
  const previewName = fields
    .map(f => {
      const vals = f.values.split(",").map(v => v.trim()).filter(Boolean);
      return vals[0] || f.label.toUpperCase().replace(/\s+/g, "").slice(0, 4);
    })
    .join(separator);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Settings2 style={{ width: 16, height: 16, color: "#2563EB" }} />
            <div className="section-title" style={{ fontSize: 16 }}>{t("convention.title")}</div>
          </div>
          <div className="section-sub" style={{ marginTop: 3 }}>{t("convention.desc")}</div>
        </div>
        {dirty && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: "#FFFBEB", color: "#B45309",
            border: "1px solid #FDE68A",
            padding: "4px 10px", borderRadius: 5
          }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* Settings row */}
      <div className="card-padded" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t("convention.separator")}
            </label>
            <select
              value={separator}
              onChange={e => { setSeparator(e.target.value); setDirty(true); }}
              style={{ width: "100%", height: 36 }}
            >
              {separatorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {lang === "es" ? opt.labelEs : opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ paddingTop: 26, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => { setIsActive(e.target.checked); setDirty(true); }}
                style={{ width: 16, height: 16, accentColor: "#2563EB", cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                {t("convention.active")}
              </span>
            </label>
            {isActive ? (
              <span className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 style={{ width: 10, height: 10 }} />
                Enforcing uploads
              </span>
            ) : (
              <span className="badge badge-gray">Not enforcing</span>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      {fields.length > 0 && (
        <div style={{
          marginBottom: 14, padding: "12px 16px",
          background: "#F0F7FF", border: "1px solid #BFDBFE",
          borderRadius: 8
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            <Eye style={{ width: 12, height: 12 }} />
            Live preview
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, marginBottom: 8 }}>
            {fields.map((f, i) => {
              const firstVal = f.values.split(",")[0]?.trim() || f.label.toUpperCase().replace(/\s+/g, "").slice(0, 4);
              return (
                <span key={i}>
                  <span className="name-tag name-tag-valid" style={{ fontSize: 12 }}>{firstVal}</span>
                  {i < fields.length - 1 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#1D4ED8", margin: "0 1px" }}>{separator}</span>
                  )}
                </span>
              );
            })}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "#1D4ED8" }}>
            {previewName}
          </div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {fields.map((f, i) => (
              <span key={i} style={{ fontSize: 10, color: "#374151" }}>
                <span style={{ color: "#6B7280" }}>Field {i + 1}:</span> {f.label}
                {i < fields.length - 1 && <span style={{ color: "#BFDBFE" }}> · </span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fields section */}
      <div style={{ marginBottom: 14 }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
            {t("convention.fields")}
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 400, marginLeft: 6 }}>
              {fields.length} field{fields.length !== 1 ? "s" : ""} defined
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={addField} style={{ gap: 5, fontSize: 12 }}>
            <Plus style={{ width: 12, height: 12 }} />
            {t("convention.addField")}
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 24px" }}>
            <div className="empty-icon">
              <Settings2 style={{ width: 20, height: 20, color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="empty-title" style={{ fontSize: 13 }}>{t("convention.noFields")}</div>
            <div className="empty-desc">
              Add fields to define the structure every file name must follow. Each field can have a list of allowed values.
            </div>
            <Button variant="outline" size="sm" onClick={addField} style={{ marginTop: 12, gap: 5, fontSize: 12 }}>
              <Plus style={{ width: 12, height: 12 }} />
              Add first field
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Column labels */}
            <div style={{ display: "grid", gridTemplateColumns: "32px 40px 1fr 2fr 32px", gap: 8, paddingLeft: 2, paddingRight: 2 }}>
              <div />
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>#</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("convention.fieldLabel")}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("convention.allowedValues")}</div>
              <div />
            </div>

            {fields.map((field, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid", gridTemplateColumns: "32px 40px 1fr 2fr 32px",
                  gap: 8, alignItems: "center",
                  padding: "10px 10px",
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              >
                {/* Drag handle */}
                <div style={{ color: "hsl(var(--muted-foreground))", cursor: "grab", display: "flex", justifyContent: "center" }}>
                  <GripVertical style={{ width: 14, height: 14 }} />
                </div>

                {/* Position badge */}
                <div style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: "#EFF6FF", color: "#1D4ED8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)"
                }}>
                  {idx + 1}
                </div>

                {/* Label input */}
                <Input
                  value={field.label}
                  onChange={e => updateField(idx, "label", e.target.value)}
                  placeholder="e.g. Project Code"
                  style={{ fontSize: 13 }}
                />

                {/* Values input */}
                <div style={{ position: "relative" }}>
                  <Input
                    value={field.values}
                    onChange={e => updateField(idx, "values", e.target.value)}
                    placeholder="e.g. PROJ01, PROJ02, PROJ03"
                    style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
                  />
                  {field.values && (
                    <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {field.values.split(",").map(v => v.trim()).filter(Boolean).slice(0, 8).map((v, i) => (
                        <span key={i} style={{
                          fontFamily: "var(--font-mono)", fontSize: 10,
                          background: "#EFF6FF", color: "#1D4ED8",
                          border: "1px solid #BFDBFE",
                          padding: "1px 5px", borderRadius: 3
                        }}>{v}</span>
                      ))}
                      {field.values.split(",").filter(v => v.trim()).length > 8 && (
                        <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                          +{field.values.split(",").filter(v => v.trim()).length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeField(idx)}
                  style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 14, borderTop: "1px solid hsl(var(--border))"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#B45309" }}>
          <AlertTriangle style={{ width: 13, height: 13 }} />
          {t("convention.changesWarning")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (convention) {
                  setSeparator(convention.separator);
                  setIsActive(convention.isActive);
                  setFields(
                    [...convention.fields]
                      .sort((a, b) => a.fieldOrder - b.fieldOrder)
                      .map(f => ({ label: f.label, values: f.allowedValues.join(", ") }))
                  );
                  setDirty(false);
                }
              }}
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
            {isPending ? "Saving..." : t("convention.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
