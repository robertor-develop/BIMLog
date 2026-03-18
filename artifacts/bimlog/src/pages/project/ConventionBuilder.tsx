import { useState, useEffect, useRef, useMemo } from "react";
import { useGetConvention, useUpsertConvention } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Edit2, GripVertical, Search, ChevronDown, ChevronUp,
  FileText, Download, RotateCcw, AlertTriangle, CheckCircle2, X
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────
function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── types ───────────────────────────────────────────────────────────────────
interface Company  { id: string; name: string; code: string; editing?: boolean; }
interface DisciplineEntry { id: string; code: string; name: string; desc: string; selected: boolean; custom?: boolean; }
interface DocTypeEntry    { id: string; code: string; name: string; desc: string; category: string; selected: boolean; custom?: boolean; }
interface StatusEntry     { id: string; code: string; meaning: string; selected: boolean; custom?: boolean; }

// ─── constants ────────────────────────────────────────────────────────────────
const DEFAULT_DISCIPLINES: Omit<DisciplineEntry, "id" | "selected">[] = [
  { code: "ARC", name: "Architecture",       desc: "Architectural drawings and models" },
  { code: "STR", name: "Structure",          desc: "Structural engineering documents" },
  { code: "MEP", name: "Mechanical",         desc: "Mechanical and HVAC documents" },
  { code: "ELE", name: "Electrical",         desc: "Electrical engineering documents" },
  { code: "PLM", name: "Plumbing",           desc: "Plumbing and drainage documents" },
  { code: "CIV", name: "Civil",              desc: "Civil and site engineering documents" },
  { code: "LAN", name: "Landscape",          desc: "Landscape architecture documents" },
  { code: "INT", name: "Interior Design",    desc: "Interior design documents" },
  { code: "FPR", name: "Fire Protection",    desc: "Fire protection and suppression documents" },
  { code: "ICT", name: "Technology",         desc: "IT and communications documents" },
  { code: "GEO", name: "Geotechnical",       desc: "Geotechnical and survey documents" },
  { code: "EST", name: "Cost Estimating",    desc: "Cost and quantity documents" },
  { code: "SHM", name: "Sheet Metal",        desc: "Sheet metal fabrication documents" },
  { code: "MPI", name: "Mech. Piping",       desc: "Mechanical piping documents" },
  { code: "ENV", name: "Environmental",      desc: "Environmental engineering documents" },
  { code: "PRC", name: "Procurement",        desc: "Procurement and contracts documents" },
];

const DOC_TYPE_CATEGORIES: { cat: string; types: Omit<DocTypeEntry,"id"|"selected"|"category">[] }[] = [
  { cat: "3D Models & BIM", types: [
    { code: "M3",  name: "3D Model",              desc: "Revit, NWD and BIM model files" },
    { code: "M2",  name: "2D Model",              desc: "2D CAD model files" },
    { code: "BM",  name: "BIM Model",             desc: "Building Information Model" },
    { code: "NW",  name: "Navisworks",            desc: "Navisworks coordination model" },
    { code: "IFC", name: "IFC Model",             desc: "Open BIM IFC format" },
    { code: "RVT", name: "Revit Model",           desc: "Autodesk Revit native file" },
    { code: "SKP", name: "SketchUp Model",        desc: "SketchUp 3D model" },
  ]},
  { cat: "Drawings", types: [
    { code: "DR",  name: "Drawing",               desc: "General drawing" },
    { code: "GA",  name: "General Arrangement",   desc: "Overall layout drawing" },
    { code: "PL",  name: "Plan",                  desc: "Floor plan drawing" },
    { code: "EL",  name: "Elevation",             desc: "Building elevation drawing" },
    { code: "SE",  name: "Section",               desc: "Building section drawing" },
    { code: "DT",  name: "Detail",                desc: "Construction detail drawing" },
    { code: "SD",  name: "Shop Drawing",          desc: "Subcontractor shop drawing" },
    { code: "WD",  name: "Working Drawing",       desc: "Construction working drawing" },
    { code: "AD",  name: "As-Built Drawing",      desc: "As-constructed drawing" },
    { code: "DD",  name: "Design Development",    desc: "Design development drawing" },
    { code: "CD",  name: "Construction Doc",      desc: "Construction document drawing" },
    { code: "SK",  name: "Sketch",                desc: "Preliminary sketch" },
    { code: "DG",  name: "Diagram",               desc: "Schematic diagram" },
    { code: "FP",  name: "Floor Plan",            desc: "Floor plan" },
    { code: "RCP", name: "Reflected Ceiling Plan",desc: "Ceiling plan" },
    { code: "STP", name: "Site Plan",             desc: "Site layout plan" },
    { code: "LP",  name: "Landscape Plan",        desc: "Landscape drawing" },
    { code: "DP",  name: "Drainage Plan",         desc: "Drainage layout" },
    { code: "EP",  name: "Electrical Plan",       desc: "Electrical layout" },
    { code: "MP",  name: "Mechanical Plan",       desc: "Mechanical layout" },
    { code: "PP",  name: "Plumbing Plan",         desc: "Plumbing layout" },
    { code: "FLP", name: "Fire Protection Plan",  desc: "Fire suppression layout" },
    { code: "TP",  name: "Technology Plan",       desc: "IT and communications layout" },
    { code: "CP",  name: "Civil Plan",            desc: "Civil engineering drawing" },
    { code: "ST",  name: "Structural Plan",       desc: "Structural drawing" },
    { code: "ZP",  name: "Zoning Plan",           desc: "Zoning and planning drawing" },
  ]},
  { cat: "Specifications & Technical", types: [
    { code: "SP",  name: "Specification",         desc: "Technical specification" },
    { code: "TS",  name: "Technical Spec",        desc: "Detailed technical specification" },
    { code: "PS",  name: "Performance Spec",      desc: "Performance based specification" },
    { code: "MS",  name: "Method Statement",      desc: "Construction method statement" },
    { code: "WP",  name: "Work Package",          desc: "Construction work package" },
    { code: "TPR", name: "Test Procedure",        desc: "Testing and commissioning procedure" },
    { code: "TR",  name: "Test Report",           desc: "Testing results report" },
    { code: "ITP", name: "Insp. & Test Plan",     desc: "Quality inspection plan" },
    { code: "QP",  name: "Quality Plan",          desc: "Project quality plan" },
    { code: "HSP", name: "H&S Plan",              desc: "Health and safety management plan" },
    { code: "RA",  name: "Risk Assessment",       desc: "Risk assessment document" },
  ]},
  { cat: "Calculations & Analysis", types: [
    { code: "CA",  name: "Calculation",           desc: "Engineering calculation" },
    { code: "SC",  name: "Structural Calc",       desc: "Structural engineering calc" },
    { code: "MC",  name: "Mechanical Calc",       desc: "Mechanical engineering calc" },
    { code: "EC",  name: "Electrical Calc",       desc: "Electrical engineering calc" },
    { code: "HC",  name: "Hydraulic Calc",        desc: "Hydraulic and plumbing calc" },
    { code: "FC",  name: "Fire Calc",             desc: "Fire engineering calculation" },
    { code: "AC",  name: "Acoustic Calc",         desc: "Acoustic and noise analysis" },
    { code: "TC",  name: "Thermal Calc",          desc: "Thermal and energy calculation" },
    { code: "LC",  name: "Lighting Calc",         desc: "Lighting design calculation" },
    { code: "GC",  name: "Geotechnical Calc",     desc: "Ground and foundation calc" },
    { code: "EN",  name: "Energy Analysis",       desc: "Energy performance analysis" },
    { code: "CF",  name: "CFD Analysis",          desc: "Computational fluid dynamics" },
    { code: "FE",  name: "Finite Element",        desc: "Structural FEA" },
    { code: "WA",  name: "Wind Analysis",         desc: "Wind loading analysis" },
    { code: "SA",  name: "Seismic Analysis",      desc: "Seismic and earthquake analysis" },
  ]},
  { cat: "Reports & Studies", types: [
    { code: "RP",  name: "Report",                desc: "General report" },
    { code: "SR",  name: "Survey Report",         desc: "Site survey report" },
    { code: "GR",  name: "Geotechnical Report",   desc: "Ground investigation report" },
    { code: "ER",  name: "Environmental Report",  desc: "Environmental impact report" },
    { code: "PR",  name: "Progress Report",       desc: "Construction progress report" },
    { code: "IR",  name: "Inspection Report",     desc: "Site inspection report" },
    { code: "AR",  name: "Audit Report",          desc: "Quality audit report" },
    { code: "CR",  name: "Clash Report",          desc: "BIM clash detection report" },
    { code: "VR",  name: "Validation Report",     desc: "Design validation report" },
    { code: "CMR", name: "Commissioning Report",  desc: "System commissioning report" },
    { code: "MR",  name: "Meeting Report",        desc: "Meeting minutes and notes" },
    { code: "WR",  name: "Weekly Report",         desc: "Weekly progress report" },
    { code: "MOR", name: "Monthly Report",        desc: "Monthly progress report" },
    { code: "FR",  name: "Final Report",          desc: "Project completion report" },
    { code: "HR",  name: "Handover Report",       desc: "Building handover report" },
    { code: "DDR", name: "Due Diligence Report",  desc: "Technical due diligence" },
  ]},
  { cat: "Schedules & Programmes", types: [
    { code: "SH",  name: "Schedule",              desc: "General schedule" },
    { code: "PSC", name: "Project Schedule",      desc: "Master project programme" },
    { code: "CSC", name: "Construction Schedule", desc: "Construction programme" },
    { code: "MSC", name: "Milestone Schedule",    desc: "Key milestone tracker" },
    { code: "SS",  name: "Submittal Schedule",    desc: "Submittal register and schedule" },
    { code: "RS",  name: "RFI Schedule",          desc: "RFI log and schedule" },
    { code: "IS",  name: "Inspection Schedule",   desc: "Inspection and testing schedule" },
    { code: "AS",  name: "Activity Schedule",     desc: "Work activity schedule" },
    { code: "LS",  name: "Look Ahead Schedule",   desc: "Short term look ahead" },
  ]},
  { cat: "Cost & Quantity", types: [
    { code: "ES",  name: "Estimate",              desc: "Cost estimate" },
    { code: "BQ",  name: "Bill of Quantities",    desc: "Detailed BOQ" },
    { code: "VO",  name: "Variation Order",       desc: "Change order document" },
    { code: "CO",  name: "Change Order",          desc: "Contract change order" },
    { code: "CL",  name: "Cost Log",              desc: "Running cost log" },
    { code: "CB",  name: "Cost Breakdown",        desc: "Cost breakdown structure" },
    { code: "CV",  name: "Cost Variation",        desc: "Cost variation report" },
    { code: "TK",  name: "Takeoff",               desc: "Quantity takeoff" },
    { code: "BU",  name: "Budget",                desc: "Project budget document" },
    { code: "CFW", name: "Cash Flow",             desc: "Cash flow forecast" },
  ]},
  { cat: "Contracts & Legal", types: [
    { code: "CT",  name: "Contract",              desc: "Contract document" },
    { code: "AG",  name: "Agreement",             desc: "Project agreement" },
    { code: "NDA", name: "Non Disclosure",        desc: "Confidentiality agreement" },
    { code: "NL",  name: "Notice Letter",         desc: "Formal notice" },
    { code: "EX",  name: "Extension of Time",     desc: "EOT claim document" },
    { code: "NC",  name: "Non Conformance",       desc: "Non conformance report" },
    { code: "RFI", name: "Request for Info",      desc: "Formal RFI document" },
    { code: "RFC", name: "Request for Change",    desc: "Change request document" },
    { code: "RFP", name: "Request for Proposal",  desc: "Procurement document" },
    { code: "RFQ", name: "Request for Quotation", desc: "Tender document" },
    { code: "TN",  name: "Tender",                desc: "Tender submission" },
    { code: "BI",  name: "Bid",                   desc: "Bid document" },
    { code: "PO",  name: "Purchase Order",        desc: "Procurement order" },
    { code: "WO",  name: "Work Order",            desc: "Work instruction order" },
    { code: "LI",  name: "Letter of Intent",      desc: "LOI document" },
    { code: "PC",  name: "Practical Completion",  desc: "Completion certificate" },
    { code: "DL",  name: "Defects List",          desc: "Snagging and defects list" },
  ]},
  { cat: "Submittals & Transmittals", types: [
    { code: "SB",  name: "Submittal",             desc: "Formal submittal package" },
    { code: "TM",  name: "Transmittal",           desc: "Document transmittal record" },
    { code: "DS",  name: "Data Sheet",            desc: "Product data sheet" },
    { code: "PD",  name: "Product Data",          desc: "Manufacturer product information" },
    { code: "OM",  name: "Operation Manual",      desc: "Operations manual" },
    { code: "MM",  name: "Maintenance Manual",    desc: "Maintenance manual" },
    { code: "HM",  name: "Handover Manual",       desc: "Building handover manual" },
  ]},
  { cat: "Photographs & Visual", types: [
    { code: "PH",  name: "Photograph",            desc: "Site photograph" },
    { code: "VI",  name: "Video",                 desc: "Site video recording" },
    { code: "DRN", name: "Drone",                 desc: "Drone survey footage and images" },
    { code: "RI",  name: "Render",                desc: "Architectural visualisation render" },
    { code: "AN",  name: "Animation",             desc: "Design animation" },
    { code: "VRM", name: "Virtual Reality",       desc: "VR model or walkthrough" },
    { code: "ARM", name: "Augmented Reality",     desc: "AR overlay model" },
  ]},
  { cat: "BIM & Digital", types: [
    { code: "BEP", name: "BIM Execution Plan",    desc: "Project BIM protocol" },
    { code: "EIR", name: "Employer Info Req.",    desc: "Client BIM requirements" },
    { code: "AIR", name: "Asset Info Req.",       desc: "Asset data requirements" },
    { code: "PIM", name: "Project Info Model",    desc: "Federated project model" },
    { code: "AIM", name: "Asset Info Model",      desc: "Handover asset model" },
    { code: "CDE", name: "Common Data Env.",      desc: "CDE protocol document" },
    { code: "LOD", name: "Level of Development",  desc: "LOD specification" },
    { code: "BCM", name: "BIM Coordination",      desc: "Coordination protocol" },
    { code: "FM",  name: "Federated Model",       desc: "Combined discipline model" },
  ]},
  { cat: "Survey & Geospatial", types: [
    { code: "SV",  name: "Survey",                desc: "General survey document" },
    { code: "LSV", name: "Land Survey",           desc: "Topographic survey" },
    { code: "BS",  name: "Building Survey",       desc: "Existing building survey" },
    { code: "GS",  name: "Ground Survey",         desc: "Ground investigation" },
    { code: "US",  name: "Utility Survey",        desc: "Underground utility survey" },
    { code: "PC",  name: "Point Cloud",           desc: "Laser scan and point cloud files" },
    { code: "GPS", name: "GPS Survey",            desc: "GPS coordinate survey" },
  ]},
  { cat: "Mechanical & Electrical", types: [
    { code: "SLD", name: "Single Line Diagram",   desc: "Electrical single line" },
    { code: "DB",  name: "Distribution Board",    desc: "DB schedule" },
    { code: "CSS", name: "Cable Schedule",        desc: "Cable routing schedule" },
    { code: "EQ",  name: "Equipment Schedule",    desc: "Equipment list and specs" },
    { code: "PID", name: "P&ID",                  desc: "Piping and instrumentation diagram" },
    { code: "ISO", name: "Isometric",             desc: "Pipe or duct isometric drawing" },
    { code: "HV",  name: "HVAC Schedule",         desc: "HVAC equipment schedule" },
    { code: "DU",  name: "Duct Schedule",         desc: "Ductwork schedule" },
    { code: "PMP", name: "Pump Schedule",         desc: "Pump specification schedule" },
    { code: "LTS", name: "Lighting Schedule",     desc: "Luminaire schedule" },
  ]},
];

const DEFAULT_STATUS: Omit<StatusEntry,"id"|"selected">[] = [
  { code: "S0", meaning: "Work in progress" },
  { code: "S1", meaning: "Preliminary" },
  { code: "S2", meaning: "Contract issue" },
  { code: "S3", meaning: "Statutory approval" },
  { code: "S4", meaning: "As constructed" },
  { code: "A0", meaning: "Shared for coordination" },
  { code: "A1", meaning: "Suitable for information" },
  { code: "A2", meaning: "Suitable for internal review" },
  { code: "A3", meaning: "Suitable for coordination" },
  { code: "A4", meaning: "Suitable for approval" },
  { code: "B0", meaning: "Partially released" },
  { code: "CR", meaning: "For construction" },
];

const FILE_EXTENSIONS = [".rvt",".rfa",".nwd",".nwf",".nwc",".dwg",".dxf",".pdf",".ifc",".xlsx",".docx",".pptx",".jpg",".png"];

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

// ─── state shape ─────────────────────────────────────────────────────────────
interface WizardState {
  step: number;
  // step 1
  companies: Company[];
  separator: "-" | "_";
  enforceUppercase: boolean;
  applyCharLimits: boolean;
  // step 2
  disciplines: DisciplineEntry[];
  floorsAbove: number;
  basements: number;
  hasGroundFloor: boolean;
  groundFloorCode: string;
  hasRoof: boolean;
  roofCode: string;
  includeZZ: boolean;
  customLevels: string[];
  // step 3
  docTypes: DocTypeEntry[];
  seqDigits: 3 | 4 | 5;
  statusCodes: StatusEntry[];
  // step 4
  revisionFormat: "alpha" | "numerical" | "custom";
  customRevisions: string[];
  mandatoryFields: Record<string, boolean>;
  saveAsTemplate: boolean;
  templateName: string;
  gracePeriod: boolean;
  graceDays: number;
  requireAcceptance: boolean;
  enableExtRestrictions: boolean;
  extRestrictions: Record<string, string[]>;
}

// ─── helper fns ──────────────────────────────────────────────────────────────
function generateLevelCodes(
  floorsAbove: number,
  basements: number,
  hasGroundFloor: boolean,
  groundFloorCode: string,
  hasRoof: boolean,
  roofCode: string,
  includeZZ: boolean,
  customLevels: string[],
): string[] {
  const codes: string[] = [];
  for (let b = basements; b >= 1; b--) codes.push(`B${b}`);
  if (hasGroundFloor) codes.push(groundFloorCode || "G0");
  for (let f = 1; f <= floorsAbove; f++) codes.push(`L${f}`);
  if (hasRoof) codes.push(roofCode || "RF");
  if (includeZZ) codes.push("ZZ");
  customLevels.forEach(cl => { if (cl && !codes.includes(cl)) codes.push(cl); });
  return codes;
}

function buildRevisionCodes(format: "alpha" | "numerical" | "custom", custom: string[]): string[] {
  if (format === "alpha") return ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
  if (format === "numerical") return ["P01","P02","P03","P04","C01","C02","C03","C04","S0","S1","S2"];
  return custom;
}

// ─── small UI helpers ─────────────────────────────────────────────────────────
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 3 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{sub}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0" }}>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: checked ? "#2563EB" : "hsl(var(--border))",
          position: "relative", flexShrink: 0, marginTop: 2,
          transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 20 : 2,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s",
        }} />
      </button>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Chip({ label, selected, onClick, title }: { label: string; selected: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "5px 10px", borderRadius: 6, border: `1px solid ${selected ? "#2563EB" : "hsl(var(--border))"}`,
        background: selected ? "#EFF6FF" : "hsl(var(--card))",
        color: selected ? "#1D4ED8" : "hsl(var(--foreground))",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "var(--font-mono)",
      }}
    >
      {label}
    </button>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "10px 12px", marginTop: 8,
      background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6,
      fontSize: 12, color: "#92400E",
    }}>
      <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
      {text}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 8, padding: "16px 18px", ...style,
    }}>
      {children}
    </div>
  );
}

// ─── progress bar ─────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Companies & Separator" },
  { label: "Disciplines & Levels" },
  { label: "Doc Types, Sequence & Status" },
  { label: "Revision & Advanced" },
  { label: "Review" },
];

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: "absolute", top: 14, left: "50%", width: "100%", height: 2,
                  background: done ? "#2563EB" : "hsl(var(--border))",
                  zIndex: 0,
                }} />
              )}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "#2563EB" : active ? "#EFF6FF" : "hsl(var(--secondary))",
                border: `2px solid ${done || active ? "#2563EB" : "hsl(var(--border))"}`,
                color: done ? "#fff" : active ? "#2563EB" : "hsl(var(--muted-foreground))",
                fontSize: 12, fontWeight: 700, zIndex: 1, position: "relative",
              }}>
                {done ? <Check style={{ width: 13, height: 13 }} /> : i + 1}
              </div>
              <div style={{
                fontSize: 10, fontWeight: active ? 700 : 500, marginTop: 5, textAlign: "center",
                color: active ? "#2563EB" : done ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                maxWidth: 80,
              }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── step 1 ───────────────────────────────────────────────────────────────────
function Step1({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const code = newCode.trim().toUpperCase() || newName.trim().slice(0, 3).toUpperCase();
    setState(s => ({ ...s, companies: [...s.companies, { id: uid(), name: newName.trim(), code }] }));
    setNewName(""); setNewCode("");
  };

  const remove = (id: string) => setState(s => ({ ...s, companies: s.companies.filter(c => c.id !== id) }));

  const saveEdit = (id: string) => {
    setState(s => ({ ...s, companies: s.companies.map(c => c.id === id ? { ...c, code: editCode.toUpperCase() } : c) }));
    setEditingId(null);
  };

  return (
    <div>
      <SectionTitle
        title={w("Who is on this project?", "¿Quiénes participan en este proyecto?", lang)}
        sub={w("Add every company that will submit files. Each company gets a unique code used in every file name.", "Agrega cada empresa que enviará archivos. Cada empresa obtiene un código único.", lang)}
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "hsl(var(--foreground))" }}>
          {w("Add Company", "Agregar Empresa", lang)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input
            value={newName}
            onChange={e => { setNewName(e.target.value); setNewCode(e.target.value.slice(0, 3).toUpperCase()); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder={w("Company Name", "Nombre de Empresa", lang)}
            style={{ flex: 2, fontSize: 13 }}
          />
          <Input
            value={newCode}
            onChange={e => setNewCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder={w("Code (auto)", "Código (auto)", lang)}
            style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
          <Button onClick={handleAdd} size="sm" style={{ gap: 5, fontSize: 12, flexShrink: 0 }}>
            <Plus style={{ width: 13, height: 13 }} />
            {w("Add", "Agregar", lang)}
          </Button>
        </div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
          {w("Each person on your team will be identified by their company code in every file name they upload.", "Cada persona se identificará por el código de su empresa en cada archivo.", lang)}
        </div>

        {state.companies.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {state.companies.map(c => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 7,
                background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                  background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE",
                  padding: "3px 8px", borderRadius: 4, flexShrink: 0, minWidth: 50, textAlign: "center",
                }}>
                  {editingId === c.id ? (
                    <input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value.toUpperCase().slice(0, 6))}
                      onKeyDown={e => e.key === "Enter" && saveEdit(c.id)}
                      onBlur={() => saveEdit(c.id)}
                      autoFocus
                      style={{ width: 60, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, border: "none", background: "transparent", outline: "none", color: "#1D4ED8" }}
                    />
                  ) : c.code}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "hsl(var(--foreground))" }}>{c.name}</span>
                <button onClick={() => { setEditingId(c.id); setEditCode(c.code); }} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}>
                  <Edit2 style={{ width: 13, height: 13 }} />
                </button>
                <button onClick={() => remove(c.id)} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{w("Separator Character", "Carácter Separador", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("This character separates every field in the file name.", "Este carácter separa cada campo en el nombre de archivo.", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["-", "_"] as const).map(sep => (
            <button
              key={sep}
              onClick={() => setState(s => ({ ...s, separator: sep }))}
              style={{
                padding: "16px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                border: `2px solid ${state.separator === sep ? "#2563EB" : "hsl(var(--border))"}`,
                background: state.separator === sep ? "#EFF6FF" : "hsl(var(--card))",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 900, color: state.separator === sep ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 4 }}>{sep}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: state.separator === sep ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 2 }}>
                {sep === "-" ? w("Hyphen", "Guión", lang) : w("Underscore", "Guión bajo", lang)}
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {sep === "-" ? w("Most common in ISO 19650 projects", "Más común en proyectos ISO 19650", lang) : w("Used in some US and Latin American standards", "Usado en estándares de EEUU y Latinoamérica", lang)}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Toggle
          checked={state.enforceUppercase}
          onChange={v => setState(s => ({ ...s, enforceUppercase: v }))}
          label={w("Force uppercase on all file names", "Forzar mayúsculas en todos los nombres", lang)}
          sub={w("BIMLog will reject any file name containing lowercase letters. Recommended for ISO 19650.", "BIMLog rechazará nombres con letras minúsculas. Recomendado para ISO 19650.", lang)}
        />
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 12, marginTop: 4 }}>
          <Toggle
            checked={state.applyCharLimits}
            onChange={v => setState(s => ({ ...s, applyCharLimits: v }))}
            label={w("Apply character limits per field", "Aplicar límite de caracteres por campo", lang)}
            sub={w("You will be able to set min and max characters per field in the review screen.", "Podrás establecer mínimos y máximos por campo en la pantalla de revisión.", lang)}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── step 2 ───────────────────────────────────────────────────────────────────
function Step2({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [customDName, setCustomDName] = useState("");
  const [customDCode, setCustomDCode] = useState("");
  const [customLevel, setCustomLevel] = useState("");

  const toggleDisc = (id: string) => setState(s => ({
    ...s,
    disciplines: s.disciplines.map(d => d.id === id ? { ...d, selected: !d.selected } : d)
  }));

  const addCustomDisc = () => {
    if (!customDName.trim() || !customDCode.trim()) return;
    setState(s => ({
      ...s,
      disciplines: [...s.disciplines, { id: uid(), code: customDCode.toUpperCase().slice(0, 6), name: customDName, desc: "Custom discipline", selected: true, custom: true }]
    }));
    setCustomDName(""); setCustomDCode("");
  };

  const addCustomLevel = () => {
    if (!customLevel.trim()) return;
    setState(s => ({ ...s, customLevels: [...s.customLevels, customLevel.toUpperCase().trim()] }));
    setCustomLevel("");
  };

  const generatedLevels = generateLevelCodes(
    state.floorsAbove, state.basements, state.hasGroundFloor, state.groundFloorCode,
    state.hasRoof, state.roofCode, state.includeZZ, state.customLevels
  );

  return (
    <div>
      <SectionTitle
        title={w("What disciplines and floors does this project have?", "¿Qué disciplinas y pisos tiene este proyecto?", lang)}
      />

      {/* Disciplines */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Disciplines", "Disciplinas", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
          {w("Select all disciplines that will submit files on this project.", "Selecciona todas las disciplinas que enviarán archivos.", lang)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {state.disciplines.map(d => (
            <button
              key={d.id}
              onClick={() => toggleDisc(d.id)}
              style={{
                padding: "10px 12px", borderRadius: 7, border: `2px solid ${d.selected ? "#2563EB" : "hsl(var(--border))"}`,
                background: d.selected ? "#EFF6FF" : "hsl(var(--card))",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.code}</span>
                {d.selected && <Check style={{ width: 13, height: 13, color: "#1D4ED8" }} />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.name}</div>
              <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 2, lineHeight: 1.3 }}>{d.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Input value={customDName} onChange={e => { setCustomDName(e.target.value); setCustomDCode(e.target.value.slice(0,4).toUpperCase()); }} placeholder={w("Discipline Name", "Nombre de disciplina", lang)} style={{ flex: 2, fontSize: 12 }} />
          <Input value={customDCode} onChange={e => setCustomDCode(e.target.value.toUpperCase().slice(0,6))} placeholder={w("Code", "Código", lang)} style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }} />
          <Button variant="outline" size="sm" onClick={addCustomDisc} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}><Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}</Button>
        </div>
      </Card>

      {/* Building Levels */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Building Levels", "Pisos del Edificio", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 14 }}>
          {w("Tell BIMLog about your building and we will generate all level codes automatically.", "Dinos sobre tu edificio y generaremos todos los códigos de nivel automáticamente.", lang)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>
              {w("Floors above ground", "Pisos sobre nivel de suelo", lang)}
            </label>
            <Input type="number" min={0} max={200} value={state.floorsAbove}
              onChange={e => setState(s => ({ ...s, floorsAbove: Math.max(0, parseInt(e.target.value) || 0) }))}
              style={{ fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>
              {w("Basement levels", "Niveles de sótano", lang)}
            </label>
            <Input type="number" min={0} max={20} value={state.basements}
              onChange={e => setState(s => ({ ...s, basements: Math.max(0, parseInt(e.target.value) || 0) }))}
              style={{ fontSize: 13 }} />
          </div>
        </div>

        <Toggle checked={state.hasGroundFloor} onChange={v => setState(s => ({ ...s, hasGroundFloor: v }))}
          label={w("Separate ground floor level", "Piso de planta baja separado", lang)} />
        {state.hasGroundFloor && (
          <div style={{ marginLeft: 54, marginTop: -6, marginBottom: 8 }}>
            <Input value={state.groundFloorCode}
              onChange={e => setState(s => ({ ...s, groundFloorCode: e.target.value.toUpperCase().slice(0, 4) }))}
              placeholder="G0" style={{ width: 100, fontSize: 13, fontFamily: "var(--font-mono)" }} />
          </div>
        )}

        <Toggle checked={state.hasRoof} onChange={v => setState(s => ({ ...s, hasRoof: v }))}
          label={w("Include roof level", "Incluir nivel de techo", lang)} />
        {state.hasRoof && (
          <div style={{ marginLeft: 54, marginTop: -6, marginBottom: 8 }}>
            <Input value={state.roofCode}
              onChange={e => setState(s => ({ ...s, roofCode: e.target.value.toUpperCase().slice(0, 4) }))}
              placeholder="RF" style={{ width: 100, fontSize: 13, fontFamily: "var(--font-mono)" }} />
          </div>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
          <input type="checkbox" checked={state.includeZZ} onChange={e => setState(s => ({ ...s, includeZZ: e.target.checked }))}
            style={{ width: 15, height: 15, accentColor: "#2563EB" }} />
          {w("Include all-levels code ZZ", "Incluir código para todos los niveles ZZ", lang)}
        </label>

        {generatedLevels.length > 0 && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 7 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {w("Generated Level Codes", "Códigos de Nivel Generados", lang)} ({generatedLevels.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {generatedLevels.map(lv => (
                <span key={lv} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 7px", borderRadius: 4 }}>
                  {lv}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Input value={customLevel} onChange={e => setCustomLevel(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addCustomLevel()}
            placeholder={w("Custom level code (e.g. MEZ, POD, PH)", "Código de nivel personalizado (ej. MEZ, POD, PH)", lang)}
            style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }} />
          <Button variant="outline" size="sm" onClick={addCustomLevel} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}>
            <Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}
          </Button>
        </div>
        {state.customLevels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {state.customLevels.map((lv, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: "#F5F3FF", color: "#5B21B6", border: "1px solid #DDD6FE", padding: "2px 7px", borderRadius: 4 }}>
                {lv}
                <button onClick={() => setState(s => ({ ...s, customLevels: s.customLevels.filter((_, j) => j !== i) }))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: "#7C3AED" }}>
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── step 3 ───────────────────────────────────────────────────────────────────
function Step3({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customStatusCode, setCustomStatusCode] = useState("");
  const [customStatusMeaning, setCustomStatusMeaning] = useState("");

  const toggleDoc = (id: string) => setState(s => ({ ...s, docTypes: s.docTypes.map(d => d.id === id ? { ...d, selected: !d.selected } : d) }));
  const toggleStatus = (id: string) => setState(s => ({ ...s, statusCodes: s.statusCodes.map(sc => sc.id === id ? { ...sc, selected: !sc.selected } : sc) }));

  const selectedCount = state.docTypes.filter(d => d.selected).length;

  const filtered = search.trim()
    ? state.docTypes.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase()) ||
        d.desc.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const categories = [...new Set(state.docTypes.map(d => d.category))];

  const addCustomDoc = () => {
    if (!customCode.trim() || !customName.trim()) return;
    setState(s => ({
      ...s,
      docTypes: [...s.docTypes, { id: uid(), code: customCode.toUpperCase(), name: customName, desc: customDesc || "Custom type", category: "Custom", selected: true, custom: true }]
    }));
    setCustomCode(""); setCustomName(""); setCustomDesc("");
  };

  const addCustomStatus = () => {
    if (!customStatusCode.trim()) return;
    setState(s => ({
      ...s,
      statusCodes: [...s.statusCodes, { id: uid(), code: customStatusCode.toUpperCase(), meaning: customStatusMeaning, selected: true, custom: true }]
    }));
    setCustomStatusCode(""); setCustomStatusMeaning("");
  };

  return (
    <div>
      <SectionTitle
        title={w("What types of documents will be submitted?", "¿Qué tipos de documentos se enviarán?", lang)}
        sub={w("How will files be numbered and what status codes will be used?", "¿Cómo se numerarán los archivos y qué códigos de estado se usarán?", lang)}
      />

      {/* Doc Types */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{w("Document Types", "Tipos de Documentos", lang)}</span>
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700, background: selectedCount > 0 ? "#EFF6FF" : "hsl(var(--secondary))",
              color: selectedCount > 0 ? "#1D4ED8" : "hsl(var(--muted-foreground))",
              border: `1px solid ${selectedCount > 0 ? "#BFDBFE" : "hsl(var(--border))"}`,
              padding: "1px 7px", borderRadius: 10,
            }}>
              {selectedCount} {w("selected", "seleccionados", lang)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setState(s => ({ ...s, docTypes: s.docTypes.map(d => ({ ...d, selected: true })) }))}
              style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))" }}>
              {w("Select All", "Seleccionar Todo", lang)}
            </button>
            <button onClick={() => setState(s => ({ ...s, docTypes: s.docTypes.map(d => ({ ...d, selected: false })) }))}
              style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))" }}>
              {w("Deselect All", "Deseleccionar Todo", lang)}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "hsl(var(--muted-foreground))" }} />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={w("Search document types...", "Buscar tipos de documentos...", lang)}
            style={{ paddingLeft: 32, fontSize: 13 }} />
        </div>

        {filtered ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 6 }}>
            {filtered.map(d => (
              <button key={d.id} onClick={() => toggleDoc(d.id)} style={{
                padding: "8px 10px", borderRadius: 6, textAlign: "left", cursor: "pointer",
                border: `2px solid ${d.selected ? "#2563EB" : "hsl(var(--border))"}`,
                background: d.selected ? "#EFF6FF" : "hsl(var(--card))",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.code}</span>
                  {d.selected && <Check style={{ width: 11, height: 11, color: "#1D4ED8" }} />}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))", marginTop: 2 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 1, lineHeight: 1.2 }}>{d.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            {categories.map(cat => {
              const catTypes = state.docTypes.filter(d => d.category === cat);
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "8px 10px", borderRadius: 6,
                      background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))",
                      cursor: "pointer", marginBottom: isCollapsed ? 0 : 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>{cat}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "1px 6px", borderRadius: 8 }}>
                        {catTypes.filter(t => t.selected).length}/{catTypes.length}
                      </span>
                    </div>
                    {isCollapsed ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronUp style={{ width: 14, height: 14 }} />}
                  </button>
                  {!isCollapsed && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 6 }}>
                      {catTypes.map(d => (
                        <button key={d.id} onClick={() => toggleDoc(d.id)} style={{
                          padding: "8px 10px", borderRadius: 6, textAlign: "left", cursor: "pointer",
                          border: `2px solid ${d.selected ? "#2563EB" : "hsl(var(--border))"}`,
                          background: d.selected ? "#EFF6FF" : "hsl(var(--card))",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.code}</span>
                            {d.selected && <Check style={{ width: 11, height: 11, color: "#1D4ED8" }} />}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))", marginTop: 2 }}>{d.name}</div>
                          <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 1, lineHeight: 1.2 }}>{d.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: "1px solid hsl(var(--border))", paddingTop: 14 }}>
          <Input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase().slice(0,6))} placeholder={w("Code", "Código", lang)} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)", flexShrink: 0 }} />
          <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder={w("Type Name", "Nombre del tipo", lang)} style={{ flex: 1, fontSize: 12 }} />
          <Input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder={w("Description", "Descripción", lang)} style={{ flex: 2, fontSize: 12 }} />
          <Button variant="outline" size="sm" onClick={addCustomDoc} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}>
            <Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}
          </Button>
        </div>
      </Card>

      {/* Sequence Numbers */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Sequence Number Format", "Formato de Número de Secuencia", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
          {w("How will files be numbered within each category?", "¿Cómo se numerarán los archivos dentro de cada categoría?", lang)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          {([3, 4, 5] as const).map(n => (
            <button key={n} onClick={() => setState(s => ({ ...s, seqDigits: n }))} style={{
              padding: "12px", borderRadius: 7, cursor: "pointer", textAlign: "center",
              border: `2px solid ${state.seqDigits === n ? "#2563EB" : "hsl(var(--border))"}`,
              background: state.seqDigits === n ? "#EFF6FF" : "hsl(var(--card))",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 900, color: state.seqDigits === n ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 4 }}>
                {"0".repeat(n - 1)}1
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: state.seqDigits === n ? "#1D4ED8" : "hsl(var(--foreground))" }}>
                {n} {w("digits", "dígitos", lang)}
              </div>
              <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                {n === 3 ? w("001 to 999 — smaller projects", "001 a 999 — proyectos pequeños", lang)
                  : n === 4 ? w("0001 to 9999 — recommended", "0001 a 9999 — recomendado", lang)
                  : w("00001 to 99999 — very large", "00001 a 99999 — proyectos muy grandes", lang)}
              </div>
              {n === 4 && state.seqDigits === 4 && (
                <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 4, display: "inline-block" }}>
                  ✓ {w("Recommended", "Recomendado", lang)}
                </div>
              )}
            </button>
          ))}
        </div>
        <Note text={w("BIMLog validates that sequence numbers match this format exactly. Files with wrong digit count will be rejected.", "BIMLog valida que los números de secuencia coincidan exactamente. Los archivos con recuento incorrecto serán rechazados.", lang)} />
      </Card>

      {/* Status Codes */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Status Codes", "Códigos de Estado", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
          {w("Status codes indicate the suitability of a document for its intended purpose.", "Los códigos de estado indican la idoneidad del documento para su propósito.", lang)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {state.statusCodes.map(sc => (
            <button key={sc.id} onClick={() => toggleStatus(sc.id)} title={sc.meaning} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${sc.selected ? "#2563EB" : "hsl(var(--border))"}`,
              background: sc.selected ? "#EFF6FF" : "hsl(var(--card))",
              color: sc.selected ? "#1D4ED8" : "hsl(var(--foreground))",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{sc.code}</span>
              <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{sc.meaning}</span>
              {!sc.selected && <X style={{ width: 9, height: 9, opacity: 0.4 }} />}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}>
          <Input value={customStatusCode} onChange={e => setCustomStatusCode(e.target.value.toUpperCase().slice(0,6))} placeholder={w("Code", "Código", lang)} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)", flexShrink: 0 }} />
          <Input value={customStatusMeaning} onChange={e => setCustomStatusMeaning(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomStatus()} placeholder={w("Meaning / description", "Significado", lang)} style={{ flex: 1, fontSize: 12 }} />
          <Button variant="outline" size="sm" onClick={addCustomStatus} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}>
            <Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── step 4 ───────────────────────────────────────────────────────────────────
function Step4({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [customRev, setCustomRev] = useState("");

  const addCustomRev = () => {
    if (!customRev.trim()) return;
    setState(s => ({ ...s, customRevisions: [...s.customRevisions, customRev.toUpperCase().trim()] }));
    setCustomRev("");
  };

  const selectedDiscs  = state.disciplines.filter(d => d.selected);
  const selectedLevels = generateLevelCodes(state.floorsAbove, state.basements, state.hasGroundFloor, state.groundFloorCode, state.hasRoof, state.roofCode, state.includeZZ, state.customLevels);

  const MANDATORY_FIELD_KEYS = ["Project Code","Originator","Discipline","Level","Type","Sequence","Status","Revision"];

  const revExamples = buildRevisionCodes(state.revisionFormat, state.customRevisions);

  return (
    <div>
      <SectionTitle title={w("Revision codes and advanced settings", "Códigos de revisión y configuración avanzada", lang)} />

      {/* Revision format */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Revision Format", "Formato de Revisión", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("How will document revisions be tracked?", "¿Cómo se rastrearán las revisiones?", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {(["alpha","numerical","custom"] as const).map(fmt => (
            <button key={fmt} onClick={() => setState(s => ({ ...s, revisionFormat: fmt }))} style={{
              padding: "12px", borderRadius: 7, cursor: "pointer", textAlign: "left",
              border: `2px solid ${state.revisionFormat === fmt ? "#2563EB" : "hsl(var(--border))"}`,
              background: state.revisionFormat === fmt ? "#EFF6FF" : "hsl(var(--card))",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: state.revisionFormat === fmt ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 4 }}>
                {fmt === "alpha" ? w("Alphabetical","Alfabético",lang) : fmt === "numerical" ? w("Numerical with prefix","Numérico con prefijo",lang) : w("Custom","Personalizado",lang)}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {fmt === "alpha" ? "A  B  C  D  E…" : fmt === "numerical" ? "P01  P02  C01  C02…" : w("Define your own sequence","Define tu propia secuencia",lang)}
              </div>
            </button>
          ))}
        </div>
        {state.revisionFormat === "custom" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Input value={customRev} onChange={e => setCustomRev(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && addCustomRev()}
                placeholder={w("Enter revision code and press Enter", "Ingresa código de revisión y presiona Enter", lang)}
                style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }} />
              <Button variant="outline" size="sm" onClick={addCustomRev} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}>
                <Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}
              </Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {state.customRevisions.map((r, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 7px", borderRadius: 4 }}>
                  {r}
                  <button onClick={() => setState(s => ({ ...s, customRevisions: s.customRevisions.filter((_,j) => j!==i) }))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1 }}>
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {revExamples.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginRight: 4, alignSelf: "center" }}>{w("Preview:","Vista previa:",lang)}</span>
            {revExamples.slice(0,10).map(r => (
              <span key={r} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: "#F5F3FF", color: "#5B21B6", border: "1px solid #DDD6FE", padding: "2px 6px", borderRadius: 4 }}>{r}</span>
            ))}
            {revExamples.length > 10 && <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>+{revExamples.length - 10}</span>}
          </div>
        )}
      </Card>

      {/* Mandatory Fields */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Mandatory Fields","Campos Obligatorios",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("Files missing mandatory fields will be rejected.","Los archivos sin campos obligatorios serán rechazados.",lang)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MANDATORY_FIELD_KEYS.map(field => (
            <div key={field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "hsl(var(--secondary))", borderRadius: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{field}</span>
              <Toggle checked={state.mandatoryFields[field] !== false} onChange={v => setState(s => ({ ...s, mandatoryFields: { ...s.mandatoryFields, [field]: v } }))} label="" />
            </div>
          ))}
        </div>
      </Card>

      {/* Grace Period */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Grace Period","Período de Gracia",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Give your team time to adapt before violations are hard rejected.","Dale a tu equipo tiempo para adaptarse antes del rechazo estricto.",lang)}</div>
        <Toggle checked={state.gracePeriod} onChange={v => setState(s => ({ ...s, gracePeriod: v }))} label={w("Enable grace period","Habilitar período de gracia",lang)} />
        {state.gracePeriod && (
          <div style={{ marginLeft: 54, display: "flex", alignItems: "center", gap: 10, marginTop: -4 }}>
            <Input type="number" min={1} max={365} value={state.graceDays}
              onChange={e => setState(s => ({ ...s, graceDays: Math.max(1, parseInt(e.target.value) || 7) }))}
              style={{ width: 80, fontSize: 13 }} />
            <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>{w("days — violations flagged but not rejected","días — las violaciones se marcan pero no se rechazan",lang)}</span>
          </div>
        )}
      </Card>

      {/* Onboarding Acceptance */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Onboarding Acceptance","Aceptación de Incorporación",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Require every team member to read and accept this convention before uploading.","Requiere que cada miembro lea y acepte esta convención antes de cargar.",lang)}</div>
        <Toggle checked={state.requireAcceptance} onChange={v => setState(s => ({ ...s, requireAcceptance: v }))} label={w("Require convention acceptance","Requerir aceptación de la convención",lang)} />
        <div style={{ marginTop: 8, padding: "10px 12px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 11, color: "#1E40AF" }}>
          {w("When a new team member is added they will see the full convention and must click 'I understand and accept' before uploading. Their acceptance is timestamped and permanently recorded.","Cuando se agrega un miembro, verá la convención completa y debe hacer clic en 'Entiendo y acepto' antes de cargar. La aceptación queda registrada de forma permanente.",lang)}
        </div>
      </Card>

      {/* Save as Template */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Convention Template","Plantilla de Convención",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Save this convention as a template to reuse on future projects.","Guarda esta convención como plantilla para reutilizar en proyectos futuros.",lang)}</div>
        <Toggle checked={state.saveAsTemplate} onChange={v => setState(s => ({ ...s, saveAsTemplate: v }))} label={w("Save as template","Guardar como plantilla",lang)} />
        {state.saveAsTemplate && (
          <div style={{ marginLeft: 54, marginTop: -4 }}>
            <Input value={state.templateName} onChange={e => setState(s => ({ ...s, templateName: e.target.value }))}
              placeholder={w("Template name...","Nombre de la plantilla...",lang)} style={{ fontSize: 13 }} />
          </div>
        )}
      </Card>

      {/* File Extensions */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("File Extensions by Discipline","Extensiones por Disciplina",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Optionally restrict which file types each discipline can submit.","Opcionalmente restringe qué tipos de archivo puede enviar cada disciplina.",lang)}</div>
        <div style={{ marginBottom: 8, padding: "10px 12px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 11, color: "#1E40AF" }}>
          <strong>{w("About file extensions:","Sobre las extensiones de archivo:",lang)}</strong> {w("Extensions (.rvt, .dwg, .pdf, etc.) are NOT part of the naming convention itself. They are determined by the software or format used. BIMLog validates only the filename stem — everything before the last dot.","Las extensiones (.rvt, .dwg, .pdf, etc.) NO son parte de la convención de nombres. Son determinadas por el software o formato. BIMLog valida solo el nombre del archivo sin la extensión.",lang)}
        </div>
        <Toggle checked={state.enableExtRestrictions} onChange={v => setState(s => ({ ...s, enableExtRestrictions: v }))}
          label={w("Enable file type restrictions per discipline","Habilitar restricciones de tipo de archivo por disciplina",lang)} />
        {state.enableExtRestrictions && selectedDiscs.length > 0 && (
          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid hsl(var(--border))", fontWeight: 700, fontSize: 11 }}>
                    {w("Discipline","Disciplina",lang)}
                  </th>
                  {FILE_EXTENSIONS.map(ext => (
                    <th key={ext} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid hsl(var(--border))", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>{ext}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedDiscs.map(d => (
                  <tr key={d.id}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid hsl(var(--border))", fontWeight: 600, fontSize: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "1px 5px", borderRadius: 3, marginRight: 5 }}>{d.code}</span>
                      {d.name}
                    </td>
                    {FILE_EXTENSIONS.map(ext => {
                      const allowed = state.extRestrictions[d.code]?.includes(ext) ?? false;
                      return (
                        <td key={ext} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid hsl(var(--border))" }}>
                          <input type="checkbox" checked={allowed}
                            onChange={e => setState(s => {
                              const cur = s.extRestrictions[d.code] || [];
                              return { ...s, extRestrictions: { ...s.extRestrictions, [d.code]: e.target.checked ? [...cur, ext] : cur.filter(x => x !== ext) } };
                            })}
                            style={{ width: 13, height: 13, accentColor: "#2563EB", cursor: "pointer" }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── review screen ────────────────────────────────────────────────────────────
function ReviewScreen({
  state, onEdit, onSave, isSaving, saved, savedMessage, lang, projectId
}: {
  state: WizardState;
  onEdit: (step: number) => void;
  onSave: () => void;
  isSaving: boolean;
  saved: boolean;
  savedMessage: string;
  lang: string;
  projectId: number;
}) {
  const levels = generateLevelCodes(state.floorsAbove, state.basements, state.hasGroundFloor, state.groundFloorCode, state.hasRoof, state.roofCode, state.includeZZ, state.customLevels);
  const revCodes = buildRevisionCodes(state.revisionFormat, state.customRevisions);
  const selectedDiscs = state.disciplines.filter(d => d.selected);
  const selectedDocs  = state.docTypes.filter(d => d.selected);
  const selectedStatus = state.statusCodes.filter(sc => sc.selected);
  const sep = state.separator;

  const seqSample = "0".repeat(state.seqDigits - 1) + "1";

  const sampleParts = [
    state.companies[0]?.code || "PRJ",
    state.companies[0]?.code || "BTC",
    selectedDiscs[0]?.code || "ARC",
    levels[0] || "L1",
    selectedDocs[0]?.code || "DR",
    seqSample,
    selectedStatus[0]?.code || "S2",
    revCodes[0] || "P01",
  ];
  const sampleName = sampleParts.join(sep);

  const handleExportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const graceTo = state.gracePeriod ? new Date(Date.now() + state.graceDays * 86400000).toLocaleDateString() : null;
    win.document.write(`<!DOCTYPE html><html><head><title>Naming Convention — Project ${projectId}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 850px; margin: 40px auto; color: #111; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 20px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .sample { font-family: monospace; font-size: 20px; font-weight: 900; background: #EFF6FF; padding: 12px 16px; border-radius: 6px; margin: 12px 0; word-break: break-all; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
  .chip { font-family: monospace; font-size: 11px; font-weight: 700; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; padding: 2px 7px; border-radius: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .sig { margin-top: 60px; border-top: 1px solid #999; padding-top: 12px; font-size: 12px; color: #666; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>BIMLog — Naming Convention</h1>
<div style="font-size:13px;color:#666;margin-bottom:16px;">Project ID: ${projectId} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()}</div>
<div class="sample">${sampleName}</div>
<h2>Convention Summary</h2>
<div class="row"><span>Separator</span><span><strong>${sep === "-" ? "Hyphen (-)" : "Underscore (_)"}</strong></span></div>
<div class="row"><span>Enforce Uppercase</span><span><strong>${state.enforceUppercase ? "Yes" : "No"}</strong></span></div>
<div class="row"><span>Sequence Format</span><span><strong>${state.seqDigits} digits</strong></span></div>
<div class="row"><span>Revision Format</span><span><strong>${state.revisionFormat}</strong></span></div>
<div class="row"><span>Grace Period</span><span><strong>${state.gracePeriod ? `${state.graceDays} days (until ${graceTo})` : "Off"}</strong></span></div>
<div class="row"><span>Onboarding Acceptance</span><span><strong>${state.requireAcceptance ? "Required" : "Not Required"}</strong></span></div>

<h2>Companies / Originators</h2>
<div class="chips">${state.companies.map(c => `<span class="chip">${c.code} — ${c.name}</span>`).join("")}</div>

<h2>Disciplines</h2>
<div class="chips">${selectedDiscs.map(d => `<span class="chip">${d.code} — ${d.name}</span>`).join("")}</div>

<h2>Building Levels (${levels.length})</h2>
<div class="chips">${levels.map(l => `<span class="chip">${l}</span>`).join("")}</div>

<h2>Document Types (${selectedDocs.length})</h2>
<div class="chips">${selectedDocs.map(d => `<span class="chip">${d.code} — ${d.name}</span>`).join("")}</div>

<h2>Status Codes</h2>
<div class="chips">${selectedStatus.map(sc => `<span class="chip">${sc.code} — ${sc.meaning}</span>`).join("")}</div>

<h2>Revision Codes</h2>
<div class="chips">${revCodes.map(r => `<span class="chip">${r}</span>`).join("")}</div>

<div class="sig">
  <p>I have read and understood the naming convention for this project.</p>
  <br/>
  <p>Name: _____________________________ &nbsp;&nbsp; Company: _____________________________</p>
  <br/>
  <p>Signature: _________________________ &nbsp;&nbsp; Date: ________________________________</p>
</div>
</body></html>`);
    win.document.close();
    win.print();
  };

  const sections = [
    { title: w("Companies / Originators","Empresas / Originadores",lang), step: 0, chips: state.companies.map(c => c.code), detail: state.companies.map(c => `${c.code} — ${c.name}`) },
    { title: w("Disciplines","Disciplinas",lang), step: 1, chips: selectedDiscs.map(d => d.code) },
    { title: w("Building Levels","Niveles del Edificio",lang), step: 1, chips: levels },
    { title: w("Document Types","Tipos de Documentos",lang), step: 2, chips: selectedDocs.map(d => d.code) },
    { title: w("Status Codes","Códigos de Estado",lang), step: 2, chips: selectedStatus.map(sc => `${sc.code}`) },
    { title: w("Revision Codes","Códigos de Revisión",lang), step: 3, chips: revCodes },
  ];

  return (
    <div>
      <SectionTitle title={w("Review your convention before saving","Revisa tu convención antes de guardar",lang)} />

      {saved && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#166534" }}>
          <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />
          {savedMessage}
        </div>
      )}

      {/* Large sample name */}
      <Card style={{ marginBottom: 16, background: "#F0F7FF", border: "1px solid #BFDBFE" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {w("Sample File Name","Nombre de Archivo de Muestra",lang)}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 900, color: "#0F1623", wordBreak: "break-all", lineHeight: 1.3 }}>
          {sampleName}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
          {w("File extensions (.rvt, .dwg, .pdf, etc.) are not part of the convention — they are determined by the software format used.","Las extensiones (.rvt, .dwg, .pdf) no son parte de la convención — las determina el formato del software.",lang)}
        </div>
      </Card>

      {/* Field sections */}
      {sections.map(sec => (
        <Card key={sec.title} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{sec.title}</span>
            <button onClick={() => onEdit(sec.step)} style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px",
              border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer",
              background: "hsl(var(--card))", color: "hsl(var(--foreground))",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Edit2 style={{ width: 11, height: 11 }} />
              {w("Edit","Editar",lang)}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sec.chips.length > 0
              ? sec.chips.map((chip, i) => {
                  const c = CHIP_COLORS[i % CHIP_COLORS.length];
                  return (
                    <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "2px 7px", borderRadius: 4 }}>
                      {chip}
                    </span>
                  );
                })
              : <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("None selected","Ninguno seleccionado",lang)}</span>
            }
          </div>
        </Card>
      ))}

      {/* Summary panel */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{w("Full Summary","Resumen Completo",lang)}</div>
        {[
          [w("Total fields","Total de campos",lang), "8"],
          [w("Separator","Separador",lang), sep === "-" ? w("Hyphen (-)","Guión (-)",lang) : w("Underscore (_)","Guión bajo (_)",lang)],
          [w("Enforce uppercase","Mayúsculas obligatorias",lang), state.enforceUppercase ? w("Yes","Sí",lang) : "No"],
          [w("Companies","Empresas",lang), `${state.companies.length}`],
          [w("Disciplines","Disciplinas",lang), `${selectedDiscs.length} ${w("selected","seleccionadas",lang)}`],
          [w("Levels","Niveles",lang), `${levels.length} ${w("generated","generados",lang)}`],
          [w("Document types","Tipos de documentos",lang), `${selectedDocs.length} ${w("selected","seleccionados",lang)}`],
          [w("Sequence format","Formato de secuencia",lang), `${state.seqDigits} ${w("digits","dígitos",lang)}`],
          [w("Status codes","Códigos de estado",lang), `${selectedStatus.length} ${w("defined","definidos",lang)}`],
          [w("Revision format","Formato de revisión",lang), state.revisionFormat === "alpha" ? w("Alphabetical","Alfabético",lang) : state.revisionFormat === "numerical" ? w("Numerical with prefix","Numérico con prefijo",lang) : w("Custom","Personalizado",lang)],
          [w("Grace period","Período de gracia",lang), state.gracePeriod ? `${w("On","Activo",lang)} — ${state.graceDays} ${w("days","días",lang)}` : w("Off","Inactivo",lang)],
          [w("Onboarding acceptance","Aceptación de incorporación",lang), state.requireAcceptance ? w("Required","Requerida",lang) : w("Not required","No requerida",lang)],
          [w("Convention template","Plantilla de convención",lang), state.saveAsTemplate && state.templateName ? state.templateName : w("Not saved","No guardada",lang)],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid hsl(var(--border))", fontSize: 12 }}>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
            <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{val}</span>
          </div>
        ))}
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={onSave} disabled={isSaving} style={{ flex: 1, gap: 6, fontSize: 14, fontWeight: 700, height: 44 }}>
          {isSaving ? w("Saving…","Guardando…",lang) : w("Save Convention","Guardar Convención",lang)}
        </Button>
        <Button variant="outline" onClick={handleExportPDF} style={{ gap: 6, fontSize: 13, height: 44 }}>
          <Download style={{ width: 14, height: 14 }} />
          {w("Export PDF","Exportar PDF",lang)}
        </Button>
      </div>
    </div>
  );
}

// ─── edit mode ────────────────────────────────────────────────────────────────
function EditMode({ convention, onRunWizard, lang, projectId, onSaved }: {
  convention: any;
  onRunWizard: () => void;
  lang: string;
  projectId: number;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fields, setFields] = useState(
    [...convention.fields].sort((a: any, b: any) => a.fieldOrder - b.fieldOrder)
      .map((f: any) => ({ ...f, values: (f.allowedValues || []).join(", ") }))
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { mutate, isPending } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
        toast({ title: w("Convention updated","Convención actualizada",lang) });
        onSaved();
      },
      onError: () => toast({ title: "Error saving", variant: "destructive" }),
    },
  });

  const handleSave = () => {
    mutate({
      projectId,
      data: {
        separator: convention.separator,
        isActive: convention.isActive,
        fields: fields.map((f, i) => ({
          label: f.label,
          fieldOrder: i,
          allowedValues: f.values.split(",").map((v: string) => v.trim()).filter(Boolean),
        })),
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{w("Naming Convention","Convención de Nombres",lang)}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("Edit fields inline. Drag to reorder.","Edita campos en línea. Arrastra para reordenar.",lang)}</div>
        </div>
        <Button variant="outline" onClick={onRunWizard} style={{ gap: 6, fontSize: 12 }}>
          <RotateCcw style={{ width: 13, height: 13 }} />
          {w("Re-run setup wizard","Reejecutar asistente",lang)}
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px 24px 1fr 2fr 28px", gap: 8, paddingLeft: 4, paddingRight: 4, marginBottom: 4 }}>
          <div /><div />
          <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{w("Field Label","Etiqueta",lang)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{w("Allowed Values (comma-separated)","Valores permitidos (separados por coma)",lang)}</div>
          <div />
        </div>
        {fields.map((f, idx) => {
          const c = CHIP_COLORS[idx % CHIP_COLORS.length];
          return (
            <div key={f.id ?? idx} style={{
              display: "grid", gridTemplateColumns: "24px 24px 1fr 2fr 28px",
              gap: 8, alignItems: "center",
              background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "10px 10px",
            }}>
              <div style={{ cursor: "grab", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}>
                <GripVertical style={{ width: 14, height: 14 }} />
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: 5,
                background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>{idx + 1}</span>
              <Input value={f.label} onChange={e => setFields(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} style={{ fontSize: 13 }} />
              <Input value={f.values} onChange={e => setFields(prev => prev.map((x, i) => i === idx ? { ...x, values: e.target.value } : x))} style={{ fontSize: 12, fontFamily: "var(--font-mono)" }} />
              <button onClick={() => setFields(prev => prev.filter((_, i) => i !== idx))}
                style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid hsl(var(--border))" }}>
        <Button variant="outline" onClick={() => setFields(prev => [...prev, { id: uid(), label: `Field ${prev.length + 1}`, values: "", fieldOrder: prev.length }])} style={{ gap: 5, fontSize: 12 }}>
          <Plus style={{ width: 12, height: 12 }} />{w("Add Field","Agregar Campo",lang)}
        </Button>
        <Button onClick={handleSave} disabled={isPending} style={{ gap: 5, fontSize: 12 }}>
          {isPending ? w("Saving…","Guardando…",lang) : w("Save Convention","Guardar Convención",lang)}
        </Button>
      </div>
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
export function ConventionBuilder({ projectId }: { projectId: number }) {
  const { lang } = useI18n();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: convention, isLoading, isError, refetch } = useGetConvention(projectId);
  const [forceWizard, setForceWizard] = useState(false);

  const initDisciplines = (): DisciplineEntry[] =>
    DEFAULT_DISCIPLINES.map(d => ({ ...d, id: uid(), selected: true }));

  const initDocTypes = (): DocTypeEntry[] =>
    DOC_TYPE_CATEGORIES.flatMap(cat =>
      cat.types.map(t => ({ ...t, id: uid(), category: cat.cat, selected: false }))
    );

  const initStatusCodes = (): StatusEntry[] =>
    DEFAULT_STATUS.map(sc => ({ ...sc, id: uid(), selected: true }));

  const [ws, setWs] = useState<WizardState>(() => ({
    step: 0,
    companies: user ? [{ id: uid(), name: user.companyName, code: user.companyName.slice(0, 3).toUpperCase() }] : [],
    separator: "-",
    enforceUppercase: true,
    applyCharLimits: false,
    disciplines: initDisciplines(),
    floorsAbove: 10,
    basements: 1,
    hasGroundFloor: true,
    groundFloorCode: "G0",
    hasRoof: true,
    roofCode: "RF",
    includeZZ: true,
    customLevels: [],
    docTypes: initDocTypes(),
    seqDigits: 4,
    statusCodes: initStatusCodes(),
    revisionFormat: "numerical",
    customRevisions: [],
    mandatoryFields: { "Project Code": true, Originator: true, Discipline: true, Level: true, Type: true, Sequence: true, Status: true, Revision: true },
    saveAsTemplate: false,
    templateName: "",
    gracePeriod: false,
    graceDays: 14,
    requireAcceptance: true,
    enableExtRestrictions: false,
    extRestrictions: {},
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  // Pre-populate companies from user if user loads after initial state
  useEffect(() => {
    if (user && ws.companies.length === 0) {
      setWs(s => ({ ...s, companies: [{ id: uid(), name: user.companyName, code: user.companyName.slice(0, 3).toUpperCase() }] }));
    }
  }, [user]);

  const { mutate } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
        const graceTo = ws.gracePeriod ? new Date(Date.now() + ws.graceDays * 86400000).toLocaleDateString() : null;
        const msg = graceTo
          ? w(`Convention saved. Grace period active until ${graceTo}. Violations will be flagged but not rejected until then.`,`Convención guardada. Período de gracia activo hasta ${graceTo}. Las violaciones se marcarán pero no se rechazarán.`, lang)
          : w("Convention saved. Enforcing all uploads immediately.","Convención guardada. Aplicada a todas las cargas de inmediato.", lang);
        setSavedMessage(msg);
        setSaved(true);
        setIsSaving(false);
      },
      onError: () => {
        toast({ title: "Error saving convention", variant: "destructive" });
        setIsSaving(false);
      },
    },
  });

  const handleSave = () => {
    const levels = generateLevelCodes(ws.floorsAbove, ws.basements, ws.hasGroundFloor, ws.groundFloorCode, ws.hasRoof, ws.roofCode, ws.includeZZ, ws.customLevels);
    const selectedDiscs = ws.disciplines.filter(d => d.selected);
    const selectedDocs  = ws.docTypes.filter(d => d.selected);
    const selectedStatus = ws.statusCodes.filter(sc => sc.selected);
    const revCodes = buildRevisionCodes(ws.revisionFormat, ws.customRevisions);
    const seqVals = Array.from({ length: Math.min(10, Math.pow(10, ws.seqDigits) - 1) }, (_, i) => String(i + 1).padStart(ws.seqDigits, "0"));

    const fields = [
      { label: "Project Code", fieldOrder: 0, allowedValues: ws.companies.map(c => c.code) },
      { label: "Originator",   fieldOrder: 1, allowedValues: ws.companies.map(c => c.code) },
      { label: "Discipline",   fieldOrder: 2, allowedValues: selectedDiscs.map(d => d.code) },
      { label: "Level",        fieldOrder: 3, allowedValues: levels },
      { label: "Type",         fieldOrder: 4, allowedValues: selectedDocs.map(d => d.code) },
      { label: "Sequence",     fieldOrder: 5, allowedValues: seqVals },
      { label: "Status",       fieldOrder: 6, allowedValues: selectedStatus.map(sc => sc.code) },
      { label: "Revision",     fieldOrder: 7, allowedValues: revCodes },
    ];

    setIsSaving(true);
    mutate({ projectId, data: { separator: ws.separator, isActive: true, fields } });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{w("Failed to load convention data","Error al cargar la convención",lang)}</div>
        <Button variant="outline" onClick={() => refetch()} style={{ gap: 6, fontSize: 12 }}>
          {w("Retry","Reintentar",lang)}
        </Button>
      </div>
    );
  }

  const hasExisting = convention && convention.fields && convention.fields.length > 0;

  if (hasExisting && !forceWizard) {
    return (
      <EditMode
        convention={convention}
        onRunWizard={() => setForceWizard(true)}
        lang={lang}
        projectId={projectId}
        onSaved={() => {}}
      />
    );
  }

  const step = ws.step;

  const handleNext = () => setWs(s => ({ ...s, step: Math.min(s.step + 1, 4) }));
  const handleBack = () => setWs(s => ({ ...s, step: Math.max(s.step - 1, 0) }));

  return (
    <div>
      <ProgressBar step={step} />

      {step === 0 && <Step1 state={ws} setState={setWs} lang={lang} />}
      {step === 1 && <Step2 state={ws} setState={setWs} lang={lang} />}
      {step === 2 && <Step3 state={ws} setState={setWs} lang={lang} />}
      {step === 3 && <Step4 state={ws} setState={setWs} lang={lang} />}
      {step === 4 && (
        <ReviewScreen
          state={ws}
          onEdit={s => setWs(prev => ({ ...prev, step: s }))}
          onSave={handleSave}
          isSaving={isSaving}
          saved={saved}
          savedMessage={savedMessage}
          lang={lang}
          projectId={projectId}
        />
      )}

      {/* Nav buttons */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 24, paddingTop: 18, borderTop: "1px solid hsl(var(--border))",
      }}>
        <div>
          {step > 0 && (
            <Button variant="outline" onClick={handleBack} style={{ gap: 6, fontSize: 13 }}>
              <ChevronLeft style={{ width: 15, height: 15 }} />
              {w("Back","Atrás",lang)}
            </Button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {step < 4 && (
            <Button onClick={handleNext} style={{ gap: 6, fontSize: 13 }}>
              {step === 3 ? w("Go to Review","Ir a Revisión",lang) : w("Next","Siguiente",lang)}
              <ChevronRight style={{ width: 15, height: 15 }} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
