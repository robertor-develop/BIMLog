import { useState, useEffect } from "react";
import { useGetConvention } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Copy, CheckCircle2, Plus, Trash2, Download, RotateCcw } from "lucide-react";

interface SavedName { name: string; savedAt: string; }

export function NameGenerator({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: convention, isLoading } = useGetConvention(projectId);

  const [selections, setSelections] = useState<Record<number, string>>({});
  const [copied, setCopied]         = useState(false);
  const [savedNames, setSavedNames] = useState<SavedName[]>([]);

  // Initialize selections with first allowed value per field
  useEffect(() => {
    if (convention?.fields) {
      const initial: Record<number, string> = {};
      convention.fields.forEach(f => {
        if (f.allowedValues.length > 0) initial[f.id] = f.allowedValues[0];
      });
      setSelections(initial);
    }
  }, [convention]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />)}
      </div>
    );
  }

  if (!convention || !convention.isActive || convention.fields.length === 0) {
    return (
      <div>
        <div className="section-header" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Wand2 style={{ width: 16, height: 16, color: "#2563EB" }} />
              <div className="section-title" style={{ fontSize: 16 }}>{t("convention.generator.title")}</div>
            </div>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">
            <Wand2 style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div className="empty-title">{t("convention.generator.noConvention")}</div>
          <div className="empty-desc">{t("convention.generator.noConventionDesc")}</div>
        </div>
      </div>
    );
  }

  const sortedFields = [...convention.fields].sort((a, b) => a.fieldOrder - b.fieldOrder);
  const generatedName = sortedFields.map(f => selections[f.id] || "---").join(convention.separator);
  const isComplete = sortedFields.every(f => selections[f.id] && selections[f.id] !== "---");

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedName);
    setCopied(true);
    toast({ title: t("convention.generator.copiedToast") });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!isComplete) return;
    const entry: SavedName = { name: generatedName, savedAt: new Date().toISOString() };
    setSavedNames(prev => [entry, ...prev]);
    toast({ title: "Saved to list" });
  };

  const handleReset = () => {
    const initial: Record<number, string> = {};
    convention.fields.forEach(f => {
      if (f.allowedValues.length > 0) initial[f.id] = f.allowedValues[0];
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
    a.download = `bimlog-names-${projectId}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wand2 style={{ width: 16, height: 16, color: "#2563EB" }} />
            <div className="section-title" style={{ fontSize: 16 }}>{t("convention.generator.title")}</div>
          </div>
          <div className="section-sub" style={{ marginTop: 3 }}>{t("convention.generator.hint")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", padding: "4px 10px", borderRadius: 5 }}>
          <CheckCircle2 style={{ width: 11, height: 11 }} />
          {sortedFields.length} fields · {convention.separator} separator
        </div>
      </div>

      {/* Field dropdowns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 20
      }}>
        {sortedFields.map((field, idx) => {
          const selectedVal = selections[field.id] || "";
          return (
            <div key={field.id}>
              {/* Field label with position */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: "#EFF6FF", color: "#1D4ED8",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                  flexShrink: 0
                }}>{idx + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                  {field.label}
                </span>
              </div>

              {/* Dropdown — only allowed values, no free text */}
              <select
                value={selectedVal}
                onChange={e => setSelections(prev => ({ ...prev, [field.id]: e.target.value }))}
                style={{
                  width: "100%",
                  height: 36,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {field.allowedValues.map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>

              {/* Selected value preview chip */}
              {selectedVal && (
                <div style={{ marginTop: 4 }}>
                  <span className="name-tag name-tag-valid" style={{ fontSize: 11 }}>{selectedVal}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Generated name display */}
      <div style={{
        padding: "20px 24px",
        background: isComplete ? "#F0F7FF" : "hsl(var(--secondary) / 0.5)",
        border: `1px solid ${isComplete ? "#BFDBFE" : "hsl(var(--border))"}`,
        borderRadius: 10,
        marginBottom: 16,
        transition: "all 0.2s"
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: isComplete ? "#1D4ED8" : "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          {t("convention.generator.preview")}
        </div>

        {/* Token breakdown */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, marginBottom: 12 }}>
          {sortedFields.map((field, i) => {
            const val = selections[field.id] || "---";
            const isSet = val !== "---";
            return (
              <span key={field.id}>
                <span
                  className={`name-tag ${isSet ? "name-tag-valid" : "name-tag-invalid"}`}
                  style={{ fontSize: 13 }}
                  title={field.label}
                >
                  {val}
                </span>
                {i < sortedFields.length - 1 && (
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 16,
                    color: isComplete ? "#1D4ED8" : "hsl(var(--muted-foreground))",
                    margin: "0 2px", fontWeight: 700
                  }}>
                    {convention.separator}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* Full assembled name */}
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 700,
          color: isComplete ? "#0F1623" : "hsl(var(--muted-foreground))",
          letterSpacing: "0.02em",
          wordBreak: "break-all",
          lineHeight: 1.4,
          marginBottom: 14
        }}>
          {generatedName}
        </div>

        {/* Field legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sortedFields.map((field, i) => (
            <span key={field.id} style={{ fontSize: 10, color: isComplete ? "#374151" : "hsl(var(--muted-foreground))" }}>
              <span style={{ color: isComplete ? "#1D4ED8" : "hsl(var(--muted-foreground))", fontWeight: 700 }}>F{i + 1}</span> {field.label}
              {i < sortedFields.length - 1 && <span style={{ margin: "0 4px", opacity: 0.4 }}>·</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <Button
          onClick={handleCopy}
          disabled={!isComplete}
          style={{ gap: 6, fontSize: 12, minWidth: 140, background: copied ? "#16A34A" : undefined, borderColor: copied ? "#16A34A" : undefined }}
        >
          {copied
            ? <><CheckCircle2 style={{ width: 13, height: 13 }} />{t("convention.generator.copied")}</>
            : <><Copy style={{ width: 13, height: 13 }} />{t("convention.generator.copy")}</>
          }
        </Button>
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!isComplete}
          style={{ gap: 6, fontSize: 12 }}
        >
          <Plus style={{ width: 13, height: 13 }} />
          Save to list
        </Button>
        <Button
          variant="ghost"
          onClick={handleReset}
          style={{ gap: 6, fontSize: 12, color: "hsl(var(--muted-foreground))" }}
        >
          <RotateCcw style={{ width: 12, height: 12 }} />
          Reset
        </Button>
      </div>

      {/* Saved names list */}
      {savedNames.length > 0 && (
        <div>
          <div className="section-header" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
              Saved names
              <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 400, marginLeft: 6 }}>
                {savedNames.length} in list
              </span>
            </div>
            <button
              onClick={exportList}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--muted-foreground))"
              }}
            >
              <Download style={{ width: 12, height: 12 }} />
              Export .txt
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {savedNames.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px",
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 7
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  color: "hsl(var(--foreground))", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {entry.name}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(entry.name);
                    toast({ title: "Copied" });
                  }}
                  style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
                  title="Copy"
                >
                  <Copy style={{ width: 12, height: 12 }} />
                </button>
                <button
                  onClick={() => setSavedNames(prev => prev.filter((_, j) => j !== i))}
                  style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
                  title="Remove"
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 16, fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: 6 }}>
        <Wand2 style={{ width: 12, height: 12 }} />
        All fields use dropdown selection only — free text input is disabled to guarantee 100% convention compliance.
      </div>
    </div>
  );
}
