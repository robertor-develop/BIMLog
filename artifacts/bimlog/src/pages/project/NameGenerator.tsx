import { useState } from "react";
import { Copy, CheckCircle2, Plus, RotateCcw, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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

const VOLUME_OPTIONS = [
  { code: "ZZ", label: "ZZ – Whole project" },
  { code: "XX", label: "XX – Multiple volumes" },
  { code: "A0", label: "A0 – Block A" },
  { code: "B0", label: "B0 – Block B" },
  { code: "C0", label: "C0 – Block C" },
];

const LEVEL_OPTIONS = [
  { code: "ZZ", label: "ZZ – All levels" },
  { code: "XX", label: "XX – Multiple levels" },
  { code: "B2", label: "B2 – Basement 2" },
  { code: "B1", label: "B1 – Basement 1" },
  { code: "00", label: "00 – Ground floor" },
  { code: "01", label: "01 – Level 1" },
  { code: "02", label: "02 – Level 2" },
  { code: "03", label: "03 – Level 3" },
  { code: "04", label: "04 – Level 4" },
  { code: "RF", label: "RF – Roof" },
];

const TYPE_OPTIONS = [
  { code: "M3", label: "M3 – 3D model (Revit / NWD)" },
  { code: "M2", label: "M2 – 2D model (DWG)" },
  { code: "DR", label: "DR – Drawing" },
  { code: "SP", label: "SP – Specification" },
  { code: "CA", label: "CA – Calculation" },
  { code: "RP", label: "RP – Report" },
  { code: "CO", label: "CO – Correspondence" },
  { code: "FO", label: "FO – Form" },
  { code: "SH", label: "SH – Schedule" },
];

const ROLE_OPTIONS = [
  { code: "A", label: "A – Architect" },
  { code: "C", label: "C – Civil engineer" },
  { code: "S", label: "S – Structural engineer" },
  { code: "M", label: "M – Mechanical engineer" },
  { code: "E", label: "E – Electrical engineer" },
  { code: "P", label: "P – Plumbing engineer" },
  { code: "L", label: "L – Landscape architect" },
  { code: "Q", label: "Q – Quantity surveyor" },
  { code: "X", label: "X – All disciplines" },
];

const STATUS_OPTIONS = [
  { code: "S0", label: "S0 – Work in progress" },
  { code: "S1", label: "S1 – Suitable for coordination" },
  { code: "S2", label: "S2 – Suitable for information" },
  { code: "S3", label: "S3 – Suitable for review" },
  { code: "S4", label: "S4 – Suitable for construction" },
  { code: "A0", label: "A0 – Approved for construction" },
  { code: "A1", label: "A1 – Approved for manufacture" },
  { code: "B0", label: "B0 – Partially approved" },
];

const FORMAT_OPTIONS = [
  { code: ".rvt", label: ".rvt – Revit" },
  { code: ".nwd", label: ".nwd – Navisworks" },
  { code: ".dwg", label: ".dwg – AutoCAD" },
  { code: ".ifc", label: ".ifc – IFC (openBIM)" },
  { code: ".pdf", label: ".pdf – PDF" },
  { code: ".xlsx", label: ".xlsx – Excel" },
  { code: ".pptx", label: ".pptx – PowerPoint" },
];

const STRUCTURE_LABELS = ["Project", "Originator", "Volume", "Level", "Type", "Disc", "Seq", "Status", "Rev", "ext"];

export function NameGenerator({ projectId: _projectId }: { projectId: number }) {
  const { toast } = useToast();
  const [projCode, setProjCode] = useState("PROJ");
  const [originator, setOriginator] = useState("XXX");
  const [volume, setVolume] = useState("ZZ");
  const [level, setLevel] = useState("ZZ");
  const [type, setType] = useState("M3");
  const [role, setRole] = useState("A");
  const [status, setStatus] = useState("S0");
  const [revision, setRevision] = useState("P01");
  const [format, setFormat] = useState(".rvt");
  const [sequence, setSequence] = useState("001");
  const [copied, setCopied] = useState(false);
  const [savedNames, setSavedNames] = useState<SavedName[]>([]);

  const paddedSeq = sequence.replace(/\D/g, "").padStart(4, "0") || "0001";
  const tokens = [projCode || "PROJ", originator || "XXX", volume, level, type, role, paddedSeq, status, revision];
  const chipTokens = [...tokens, format];
  const generatedName = tokens.join("-") + format;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedName);
    setCopied(true);
    toast({ title: "File name copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSavedNames(prev => [{ name: generatedName, savedAt: new Date().toISOString() }, ...prev]);
    toast({ title: "Saved to list" });
  };

  const handleReset = () => {
    setProjCode("PROJ");
    setOriginator("XXX");
    setVolume("ZZ");
    setLevel("ZZ");
    setType("M3");
    setRole("A");
    setStatus("S0");
    setRevision("P01");
    setFormat(".rvt");
    setSequence("001");
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
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 3 }}>
          BIM file name generator
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          Builds structured file names following ISO 19650 / BS 1192 conventions
        </div>
      </div>

      {/* Input grid — 3 columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "12px 16px",
        marginBottom: 14,
      }}>
        <FieldText label="PROJECT CODE" value={projCode} onChange={v => setProjCode(v.toUpperCase())} placeholder="e.g. PROJ01" />
        <FieldText label="ORIGINATOR" value={originator} onChange={v => setOriginator(v.toUpperCase())} placeholder="e.g. ACM" />
        <FieldSelect label="VOLUME / SYSTEM" value={volume} onChange={setVolume} options={VOLUME_OPTIONS} />
        <FieldSelect label="LEVEL / LOCATION" value={level} onChange={setLevel} options={LEVEL_OPTIONS} />
        <FieldSelect label="TYPE / DOCUMENT CLASS" value={type} onChange={setType} options={TYPE_OPTIONS} />
        <FieldSelect label="ROLE / DISCIPLINE" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        <FieldSelect label="STATUS / SUITABILITY" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <FieldText label="REVISION" value={revision} onChange={v => setRevision(v.toUpperCase())} placeholder="P01" mono />
        <FieldSelect label="SOFTWARE / FORMAT" value={format} onChange={setFormat} options={FORMAT_OPTIONS} />
      </div>

      {/* Sequence number — narrow */}
      <div style={{ maxWidth: 180, marginBottom: 20 }}>
        <FieldText label="SEQUENCE NO." value={sequence} onChange={setSequence} placeholder="001" mono />
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
          Generated file name
        </div>

        {/* Assembled name */}
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
          color: "hsl(var(--foreground))", marginBottom: 12, wordBreak: "break-all",
          letterSpacing: "0.01em",
        }}>
          {generatedName}
        </div>

        {/* Token chips */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
          {chipTokens.map((tok, i) => {
            const c = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                  padding: "2px 7px", borderRadius: 4,
                }}>
                  {tok}
                </span>
                {i < chipTokens.length - 1 && (
                  <span style={{ color: "#CBD5E1", fontSize: 13, fontWeight: 400 }}>·</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Button
          onClick={handleCopy}
          style={{
            gap: 6, fontSize: 12,
            background: copied ? "#16A34A" : undefined,
            borderColor: copied ? "#16A34A" : undefined,
          }}
        >
          {copied
            ? <><CheckCircle2 style={{ width: 13, height: 13 }} /> Copied</>
            : <><Copy style={{ width: 13, height: 13 }} /> Copy file name</>}
        </Button>
        <Button variant="outline" onClick={handleSave} style={{ gap: 6, fontSize: 12 }}>
          <Plus style={{ width: 13, height: 13 }} />
          Save to list
        </Button>
        <Button variant="ghost" onClick={handleReset} style={{ gap: 6, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          <RotateCcw style={{ width: 12, height: 12 }} />
          Reset
        </Button>
      </div>

      {/* Naming structure bar */}
      <div style={{
        padding: "12px 16px",
        background: "#F8FAFC",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
          Naming structure
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
          {STRUCTURE_LABELS.map((label, i) => {
            const c = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                  padding: "2px 7px", borderRadius: 4,
                }}>
                  {label}
                </span>
                {i < STRUCTURE_LABELS.length - 1 && (
                  <span style={{ color: "#CBD5E1", fontSize: 13 }}>·</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Saved names list */}
      {savedNames.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
              Saved names{" "}
              <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
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
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <Download style={{ width: 12, height: 12 }} />
              Export .txt
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {savedNames.map((entry, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 7,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  color: "hsl(var(--foreground))", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {entry.name}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(entry.name); toast({ title: "Copied" }); }}
                  style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
                >
                  <Copy style={{ width: 12, height: 12 }} />
                </button>
                <button
                  onClick={() => setSavedNames(prev => prev.filter((_, j) => j !== i))}
                  style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
                >
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

function FieldText({ label, value, onChange, placeholder, mono }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10, fontWeight: 700,
        color: "hsl(var(--muted-foreground))",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
      }}>
        {label}
      </label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: 13, fontFamily: mono ? "var(--font-mono)" : undefined }}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { code: string; label: string }[];
}) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10, fontWeight: 700,
        color: "hsl(var(--muted-foreground))",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", height: 36, fontSize: 12 }}
      >
        {options.map(o => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
