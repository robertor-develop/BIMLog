import { useState, useEffect, useRef } from "react";
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
  Download, RotateCcw, AlertTriangle, CheckCircle2, X,
  ArrowUp, ArrowDown, RefreshCw, Upload, FileText, Info,
  Clock, GitMerge,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────
function w(en: string, es: string, lang: string) { return lang === "es" ? es : en; }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── types ───────────────────────────────────────────────────────────────────
interface Company       { id: string; name: string; code: string; }
interface DisciplineEntry { id: string; code: string; name: string; desc: string; selected: boolean; custom?: boolean; editingCode?: boolean; editingName?: boolean; }
interface LevelEntry    { id: string; code: string; }
interface DocTypeEntry  { id: string; code: string; name: string; desc: string; category: string; selected: boolean; custom?: boolean; }
interface StatusEntry   { id: string; code: string; meaning: string; selected: boolean; custom?: boolean; }

// ─── constants ────────────────────────────────────────────────────────────────
const DEFAULT_DISCIPLINES: Omit<DisciplineEntry,"id"|"selected"|"editingCode"|"editingName">[] = [
  { code: "ARC",  name: "Architecture",       desc: "Architectural drawings and models" },
  { code: "STR",  name: "Structure",          desc: "Structural engineering documents" },
  { code: "MEP",  name: "Mechanical",         desc: "Mechanical and HVAC documents" },
  { code: "ELE",  name: "Electrical",         desc: "Electrical engineering documents" },
  { code: "PLUM", name: "Plumbing",           desc: "Plumbing and drainage documents" },
  { code: "CIV",  name: "Civil",              desc: "Civil and site engineering documents" },
  { code: "LAN",  name: "Landscape",          desc: "Landscape architecture documents" },
  { code: "INT",  name: "Interior Design",    desc: "Interior design documents" },
  { code: "FPR",  name: "Fire Protection",    desc: "Fire protection and suppression documents" },
  { code: "ICT",  name: "Technology",         desc: "IT and communications documents" },
  { code: "GEO",  name: "Geotechnical",       desc: "Geotechnical and survey documents" },
  { code: "EST",  name: "Cost Estimating",    desc: "Cost and quantity documents" },
  { code: "SH",   name: "Sheet Metal",        desc: "Sheet metal fabrication documents" },
  { code: "MP",   name: "Mech. Piping",       desc: "Mechanical piping documents" },
  { code: "ENV",  name: "Environmental",      desc: "Environmental engineering documents" },
  { code: "PRC",  name: "Procurement",        desc: "Procurement and contracts documents" },
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
    { code: "MAP", name: "Mechanical Plan",       desc: "Mechanical layout" },
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
    { code: "GCA", name: "Geotechnical Calc",     desc: "Ground and foundation calc" },
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
    { code: "AUR", name: "Audit Report",          desc: "Quality audit report" },
    { code: "CLR", name: "Clash Report",          desc: "BIM clash detection report" },
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
    { code: "SCH", name: "Schedule",              desc: "General schedule" },
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
    { code: "EXT", name: "Extension of Time",     desc: "EOT claim document" },
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
    { code: "PCL", name: "Point Cloud",           desc: "Laser scan and point cloud files" },
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
  companies: Company[];
  separator: "-" | "_";
  enforceUppercase: boolean;
  applyCharLimits: boolean;
  disciplines: DisciplineEntry[];
  // level generator inputs (for regeneration)
  floorsAbove: number;
  basements: number;
  hasGroundFloor: boolean;
  groundFloorCode: string;
  hasRoof: boolean;
  roofCode: string;
  includeZZ: boolean;
  // THE master level list — fully editable, ordered
  levelList: LevelEntry[];
  docTypes: DocTypeEntry[];
  seqDigits: 3 | 4 | 5;
  statusCodes: StatusEntry[];
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
  // ── front-door setup context ──────────────────────────────────────────────
  flowPhase: "setup_context" | "industrial_discovery" | "import_structure" | "ai_suggestions" | "main_wizard" | "re_evidence" | "changes_review";
  setupCtx: SetupContext;
  discoveryResult: DiscoveryResult | null;
  reanalysisResult: ReanalysisResult | null;
  industrialState: IndustrialState;
  importState: ImportState;
  userGuidance: string;
}

// ─── setup context types ──────────────────────────────────────────────────────
interface SetupContext {
  setupContextChoice: string;
  projectEnvironment: string;
  builderIntent: string;
  scopeType: string;
  scopeDetails: { disciplines: string; systems: string; packages: string; notes: string };
  levelsRelevant: string;
  primaryStructure: string;
  availableInputs: Record<string, boolean>;
  analysisOnlyMode: boolean;
}

interface DiscoveryItem {
  code?: string;
  key?: string;
  label: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  accepted?: boolean;
  editing?: boolean;
}

interface DiscoveryResult {
  projectTypeGuess: string;
  scopeInterpretation: string;
  usesLevels: boolean | null;
  usesAreas: boolean | null;
  usesPackages: boolean | null;
  usesVolumes: boolean | null;
  suggestedDisciplines: DiscoveryItem[];
  suggestedSystems: DiscoveryItem[];
  suggestedDocTypes: DiscoveryItem[];
  suggestedExtraFields: DiscoveryItem[];
  suggestedFieldOrder: string[];
  ambiguities: string[];
  recommendedMode: string;
  analysisSummary: string;
}

interface IndustrialCodeEntry { id: string; code: string; label: string; }

interface IndustrialState {
  disciplineCodes: IndustrialCodeEntry[];
  systemCodes: IndustrialCodeEntry[];
  packageStructure: string;
  areaZoneStructure: string;
  volumeStructure: string;
  sampleDocCodes: string;
  levelsIfRelevant: string;
}

interface UploadedFile {
  id: string;
  file: File;
  category: "pdf" | "spreadsheet" | "screenshot" | "sample";
}

interface ImportState {
  sampleNames: string;
  rawFolderText: string;
  rawIndexText: string;
  rawNotes: string;
  analyzing: boolean;
  error: string;
  extractionWarning: string;
  uploadedFiles: UploadedFile[];
}

interface ReanalysisItem { code: string; label: string; reason: string; confidence: string; }
interface ReanalysisExtraField { key: string; label: string; reason: string; confidence: string; }
interface ReanalysisConflict { category: string; existingValue: string; newValue: string; reason: string; confidence: string; }

interface ReanalysisResult {
  baselineVersion: number;
  analysisSummary: string;
  confirmedItems: {
    disciplines: string[];
    systems: string[];
    documentTypes: string[];
    extraFields: string[];
    fieldOrder: string[];
  };
  newlySuggestedItems: {
    disciplines: ReanalysisItem[];
    systems: ReanalysisItem[];
    documentTypes: ReanalysisItem[];
    extraFields: ReanalysisExtraField[];
    fieldOrder: string[];
  };
  conflicts: ReanalysisConflict[];
  stillUnresolved: string[];
  recommendedActions: string[];
  proposedNextVersionSummary: string;
  _extractionWarning?: string;
}

interface ConventionVersionSnapshot {
  id: number;
  conventionVersion: number;
  analysisSummary: string | null;
  changeSummary: string | null;
  userGuidance: string | null;
  acceptedDisciplines: Array<{ code: string; label: string }>;
  acceptedSystems: Array<{ code: string; label: string }>;
  acceptedDocTypes: Array<{ code: string; label: string }>;
  acceptedExtraFields: Array<{ key: string; label: string }>;
  acceptedFieldOrder: string[];
  createdAt: string;
  createdById: number | null;
}

function defaultSetupCtx(): SetupContext {
  return {
    setupContextChoice: "",
    projectEnvironment: "",
    builderIntent: "",
    scopeType: "",
    scopeDetails: { disciplines: "", systems: "", packages: "", notes: "" },
    levelsRelevant: "",
    primaryStructure: "",
    availableInputs: {},
    analysisOnlyMode: false,
  };
}

function defaultIndustrialState(): IndustrialState {
  return {
    disciplineCodes: [{ id: uid(), code: "", label: "" }],
    systemCodes: [],
    packageStructure: "",
    areaZoneStructure: "",
    volumeStructure: "",
    sampleDocCodes: "",
    levelsIfRelevant: "",
  };
}

function defaultImportState(): ImportState {
  return { sampleNames: "", rawFolderText: "", rawIndexText: "", rawNotes: "", analyzing: false, error: "", extractionWarning: "", uploadedFiles: [] };
}

// ─── level helpers ────────────────────────────────────────────────────────────
function buildLevelList(
  floorsAbove: number, basements: number,
  hasGroundFloor: boolean, groundFloorCode: string,
  hasRoof: boolean, roofCode: string, includeZZ: boolean,
): LevelEntry[] {
  const codes: string[] = [];
  for (let b = basements; b >= 1; b--) codes.push(`B${b}`);
  if (hasGroundFloor) codes.push(groundFloorCode || "G0");
  for (let f = 1; f <= floorsAbove; f++) codes.push(`L${f}`);
  if (hasRoof) codes.push(roofCode || "RF");
  if (includeZZ) codes.push("ZZ");
  return codes.map(code => ({ id: uid(), code }));
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
          position: "relative", flexShrink: 0, marginTop: 2, transition: "background 0.2s",
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

// ─── Step 0: Project Convention Setup (front door) ───────────────────────────
const API_BASE_CB = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function RadioGroup({ label, field, options, value, onChange }: {
  label: string; field: string;
  options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {options.map(opt => (
          <label key={opt.value} htmlFor={`${field}-${opt.value}`} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
            border: `1.5px solid ${value === opt.value ? "#2563EB" : "#E5E7EB"}`,
            borderRadius: 8, cursor: "pointer",
            background: value === opt.value ? "#EFF6FF" : "white",
          }}>
            <input id={`${field}-${opt.value}`} type="radio" name={field} value={opt.value}
              checked={value === opt.value} onChange={() => onChange(opt.value)}
              style={{ accentColor: "#2563EB", width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: "#111827" }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { bg: "#DCFCE7", color: "#166534", label: "High" },
    medium: { bg: "#FEF9C3", color: "#854D0E", label: "Medium" },
    low: { bg: "#FEE2E2", color: "#991B1B", label: "Low" },
  };
  const s = map[level];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{s.label}</span>
  );
}

function Step0_SetupContext({ state, setState, onContinue }: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onContinue: () => void;
}) {
  const ctx = state.setupCtx;
  const setCtx = (partial: Partial<SetupContext>) =>
    setState(s => ({ ...s, setupCtx: { ...s.setupCtx, ...partial } }));

  const isPartialScope = ctx.scopeType !== "" && ctx.scopeType !== "entire" && ctx.scopeType !== "not_sure" && ctx.scopeType !== "review_only";

  const evidenceOptions: { key: keyof typeof ctx.availableInputs; label: string }[] = [
    { key: "sampleFileNames", label: "Sample file names" },
    { key: "folderStructure", label: "Folder structure" },
    { key: "documentIndex", label: "Document index / register" },
    { key: "pdfDocuments", label: "PDF documents" },
    { key: "spreadsheetRegisters", label: "Spreadsheet registers" },
    { key: "mixedEvidence", label: "Mixed evidence" },
    { key: "nothingYet", label: "Nothing yet" },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Project Convention Setup</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Before setting up any fields, tell BIMLog about your project</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          Answer these questions first. BIMLog will use your answers to guide the convention structure correctly for your environment — whether you are setting up from scratch, taking over an existing project, configuring a partial scope, or simply analyzing first.
        </div>
      </div>

      <RadioGroup label="Setup context" field="setupContextChoice" value={ctx.setupContextChoice} onChange={v => setCtx({ setupContextChoice: v })} options={[
        { value: "full", label: "Set up the full project convention from the start" },
        { value: "takeover", label: "Take over an existing document environment" },
        { value: "partial", label: "Configure BIMLog for only part of the project scope" },
        { value: "analyze_first", label: "Analyze the project first before deciding" },
      ]} />

      <RadioGroup label="Project environment" field="projectEnvironment" value={ctx.projectEnvironment} onChange={v => setCtx({ projectEnvironment: v })} options={[
        { value: "building", label: "Building" },
        { value: "industrial_epc", label: "Industrial / plant / EPC" },
        { value: "infrastructure_civil", label: "Infrastructure / civil" },
        { value: "legal_regulatory", label: "Legal / regulatory / document-heavy" },
        { value: "mixed_custom", label: "Mixed / custom" },
        { value: "not_sure", label: "Not sure yet" },
      ]} />

      <RadioGroup label="What do you want BIMLog to do first" field="builderIntent" value={ctx.builderIntent} onChange={v => setCtx({ builderIntent: v })} options={[
        { value: "create_scratch", label: "Create a new convention from scratch" },
        { value: "mirror_existing", label: "Mirror an existing naming logic" },
        { value: "analyze_existing", label: "Analyze existing evidence and propose a structure" },
        { value: "not_sure", label: "I am not sure yet" },
      ]} />

      <RadioGroup label="Scope of responsibility" field="scopeType" value={ctx.scopeType} onChange={v => setCtx({ scopeType: v })} options={[
        { value: "entire", label: "Entire project" },
        { value: "disciplines", label: "Specific disciplines" },
        { value: "systems", label: "Specific systems" },
        { value: "packages", label: "Specific packages / areas / volumes" },
        { value: "review_only", label: "Document review / audit only" },
        { value: "not_sure", label: "Not sure yet" },
      ]} />

      {isPartialScope && (
        <div style={{ marginBottom: 22, padding: "16px 18px", border: "1.5px solid #BFDBFE", borderRadius: 8, background: "#F0F9FF" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Specify your scope below</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ctx.scopeType === "disciplines" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Disciplines</label>
                <input value={ctx.scopeDetails.disciplines} onChange={e => setCtx({ scopeDetails: { ...ctx.scopeDetails, disciplines: e.target.value } })}
                  placeholder="e.g. Structural, Mechanical, Piping"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            {ctx.scopeType === "systems" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Systems</label>
                <input value={ctx.scopeDetails.systems} onChange={e => setCtx({ scopeDetails: { ...ctx.scopeDetails, systems: e.target.value } })}
                  placeholder="e.g. HVAC, Sprinkler, Instrumentation"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            {ctx.scopeType === "packages" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Packages / areas / volumes</label>
                <input value={ctx.scopeDetails.packages} onChange={e => setCtx({ scopeDetails: { ...ctx.scopeDetails, packages: e.target.value } })}
                  placeholder="e.g. Package A, Zone 3, Volume 2"
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Additional notes</label>
              <input value={ctx.scopeDetails.notes} onChange={e => setCtx({ scopeDetails: { ...ctx.scopeDetails, notes: e.target.value } })}
                placeholder="Any additional context about your scope"
                style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>
      )}

      <RadioGroup label="Are levels / floors relevant to this project?" field="levelsRelevant" value={ctx.levelsRelevant} onChange={v => setCtx({ levelsRelevant: v })} options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "not_sure", label: "Not sure yet" },
      ]} />

      <RadioGroup label="What usually matters more in this project's document structure?" field="primaryStructure" value={ctx.primaryStructure} onChange={v => setCtx({ primaryStructure: v })} options={[
        { value: "levels", label: "Levels / floors" },
        { value: "areas", label: "Areas / zones" },
        { value: "packages", label: "Packages / volumes" },
        { value: "disciplines", label: "Disciplines" },
        { value: "mixed", label: "Mixed" },
        { value: "not_sure", label: "Not sure yet" },
      ]} />

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 8 }}>What evidence do you already have?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {evidenceOptions.map(opt => (
            <label key={opt.key} htmlFor={`evidence-${opt.key}`} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
              border: `1.5px solid ${ctx.availableInputs[opt.key] ? "#2563EB" : "#E5E7EB"}`,
              borderRadius: 8, cursor: "pointer",
              background: ctx.availableInputs[opt.key] ? "#EFF6FF" : "white",
            }}>
              <input id={`evidence-${opt.key}`} type="checkbox"
                checked={!!ctx.availableInputs[opt.key]}
                onChange={e => setCtx({ availableInputs: { ...ctx.availableInputs, [opt.key]: e.target.checked } })}
                style={{ accentColor: "#2563EB", width: 15, height: 15 }} />
              <span style={{ fontSize: 13, color: "#111827" }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{
        marginBottom: 28, padding: "14px 18px",
        border: `2px solid ${ctx.analysisOnlyMode ? "#2563EB" : "#E5E7EB"}`,
        borderRadius: 8, cursor: "pointer",
        background: ctx.analysisOnlyMode ? "#EFF6FF" : "white",
      }} onClick={() => setCtx({ analysisOnlyMode: !ctx.analysisOnlyMode })}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={ctx.analysisOnlyMode}
            onChange={e => setCtx({ analysisOnlyMode: e.target.checked })}
            style={{ accentColor: "#2563EB", width: 15, height: 15, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Analyze project without creating a convention yet</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3, lineHeight: 1.5 }}>BIMLog will perform discovery only and will not force you into final convention setup. You can review the findings and decide what to do next.</div>
          </div>
        </label>
      </div>

      <Button onClick={onContinue} style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "11px 0", gap: 6 }}>
        Continue <ChevronRight style={{ width: 15, height: 15 }} />
      </Button>
    </div>
  );
}

// ─── Industrial Structure Discovery ──────────────────────────────────────────
function IndustrialDiscovery({ state, setState, onBack, onContinue }: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const ind = state.industrialState;
  const setInd = (partial: Partial<IndustrialState>) =>
    setState(s => ({ ...s, industrialState: { ...s.industrialState, ...partial } }));
  const levelsRelevant = state.setupCtx.levelsRelevant === "yes";

  function addCode(field: "disciplineCodes" | "systemCodes") {
    setInd({ [field]: [...ind[field], { id: uid(), code: "", label: "" }] });
  }
  function removeCode(field: "disciplineCodes" | "systemCodes", id: string) {
    setInd({ [field]: ind[field].filter(e => e.id !== id) });
  }
  function updateCode(field: "disciplineCodes" | "systemCodes", id: string, patch: Partial<IndustrialCodeEntry>) {
    setInd({ [field]: ind[field].map(e => e.id === id ? { ...e, ...patch } : e) });
  }

  const codeTable = (label: string, sub: string, field: "disciplineCodes" | "systemCodes") => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>{sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ind[field].map(entry => (
          <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "100px 1fr 28px", gap: 8, alignItems: "center" }}>
            <input value={entry.code} onChange={e => updateCode(field, entry.id, { code: e.target.value.toUpperCase().slice(0, 8) })}
              placeholder="CODE" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", textTransform: "uppercase" }} />
            <input value={entry.label} onChange={e => updateCode(field, entry.id, { label: e.target.value })}
              placeholder="Description / full name" style={{ fontSize: 13, padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none" }} />
            <button onClick={() => removeCode(field, entry.id)}
              style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => addCode(field)} style={{ marginTop: 8, fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
        <Plus style={{ width: 12, height: 12 }} /> Add {label.replace(" codes", "")}
      </button>
    </div>
  );

  const textArea = (label: string, sub: string, key: keyof Pick<IndustrialState, "packageStructure"|"areaZoneStructure"|"volumeStructure"|"sampleDocCodes"|"levelsIfRelevant">) => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{sub}</div>
      <textarea value={ind[key]} onChange={e => setInd({ [key]: e.target.value })} rows={3}
        style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Industrial Structure Discovery</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Describe your project's industrial structure</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          Enter codes relevant to your project environment. Do not assume standard building disciplines. Use the codes, labels, and structure from your actual project.
        </div>
      </div>

      {codeTable("Discipline codes", "Codes representing engineering disciplines (e.g. PROC, MECH, INST, ELEC, PIPE, CIVL)", "disciplineCodes")}
      {codeTable("System codes", "Codes for process systems, plant systems, or technical systems (e.g. SYS-01, U100, F-300)", "systemCodes")}
      {textArea("Package structure", "Describe how work packages, areas, or volumes are organized (one per line or brief description)", "packageStructure")}
      {textArea("Area / zone structure", "Describe how areas or zones are organized (e.g. Area A, Zone 1, Unit 200)", "areaZoneStructure")}
      {textArea("Volume / tomo structure", "Describe volume or tomo structure if applicable (e.g. Vol-01, Tomo-A)", "volumeStructure")}
      {textArea("Sample existing document codes", "Paste 3-10 real document codes from the project so BIMLog can learn the pattern", "sampleDocCodes")}
      {levelsRelevant && textArea("Level codes (you said levels are relevant)", "List the level codes used in this project (one per line)", "levelsIfRelevant")}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Button variant="outline" onClick={onBack} style={{ gap: 6, fontSize: 13 }}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Back
        </Button>
        <Button onClick={onContinue} style={{ gap: 6, fontSize: 13 }}>
          Continue to wizard <ChevronRight style={{ width: 15, height: 15 }} />
        </Button>
      </div>
    </div>
  );
}

// ─── Import Existing Structure ────────────────────────────────────────────────
function ImportStructure({ state, setState, token, projectId, onBack, onResult }: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  token: string;
  projectId: number;
  onBack: () => void;
  onResult: (result: DiscoveryResult) => void;
}) {
  const imp = state.importState;
  const setImp = (partial: Partial<ImportState>) =>
    setState(s => ({ ...s, importState: { ...s.importState, ...partial } }));

  const [dragOver, setDragOver] = useState<UploadedFile["category"] | null>(null);

  async function runAnalysis() {
    setImp({ analyzing: true, error: "", extractionWarning: "" });
    try {
      const sampleNames = imp.sampleNames.split("\n").map(s => s.trim()).filter(Boolean);
      let res: Response;
      if (imp.uploadedFiles.length > 0) {
        const fd = new FormData();
        fd.append("setupContext", state.setupCtx.setupContextChoice);
        fd.append("projectEnvironment", state.setupCtx.projectEnvironment);
        fd.append("builderIntent", state.setupCtx.builderIntent);
        fd.append("scopeType", state.setupCtx.scopeType);
        fd.append("scopeDetails", JSON.stringify(state.setupCtx.scopeDetails));
        fd.append("levelsRelevant", state.setupCtx.levelsRelevant);
        fd.append("primaryStructure", state.setupCtx.primaryStructure);
        fd.append("availableInputs", JSON.stringify(state.setupCtx.availableInputs));
        fd.append("sampleNames", sampleNames.join("\n"));
        fd.append("rawFolderTreeText", imp.rawFolderText);
        fd.append("rawIndexText", imp.rawIndexText);
        fd.append("rawNotes", imp.rawNotes);
        for (const uf of imp.uploadedFiles) {
          fd.append(uf.category, uf.file, uf.file.name);
        }
        res = await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/discover-upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        res = await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            setupContext: state.setupCtx.setupContextChoice,
            projectEnvironment: state.setupCtx.projectEnvironment,
            builderIntent: state.setupCtx.builderIntent,
            scopeType: state.setupCtx.scopeType,
            scopeDetails: state.setupCtx.scopeDetails,
            levelsRelevant: state.setupCtx.levelsRelevant,
            primaryStructure: state.setupCtx.primaryStructure,
            availableInputs: state.setupCtx.availableInputs,
            sampleNames,
            rawFolderTreeText: imp.rawFolderText,
            rawIndexText: imp.rawIndexText,
            rawNotes: imp.rawNotes,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setImp({ analyzing: false, error: data.error || "Analysis failed" });
        return;
      }
      const { _extractionWarning, ...cleanData } = data as Record<string, unknown>;
      setImp({ analyzing: false, extractionWarning: typeof _extractionWarning === "string" ? _extractionWarning : "" });
      setState(s => ({ ...s, discoveryResult: cleanData as unknown as DiscoveryResult }));
      onResult(cleanData as unknown as DiscoveryResult);
    } catch (err) {
      setImp({ analyzing: false, error: err instanceof Error ? err.message : "Analysis failed" });
    }
  }

  const textAreaField = (label: string, sub: string, key: keyof Pick<ImportState, "sampleNames"|"rawFolderText"|"rawIndexText"|"rawNotes">, rows: number, placeholder: string) => (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{sub}</div>
      <textarea value={imp[key]} onChange={e => setImp({ [key]: e.target.value })} rows={rows} placeholder={placeholder}
        style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "var(--font-mono)", lineHeight: 1.6 }} />
    </div>
  );

  function renderUploadSlot(
    title: string,
    category: UploadedFile["category"],
    accept: string,
    purposes: string[],
  ) {
    const slotId = `upload-${category}`;
    const catFiles = imp.uploadedFiles.filter(f => f.category === category);
    const isOver = dragOver === category;

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
      e.preventDefault();
      setDragOver(null);
      const dropped = Array.from(e.dataTransfer.files);
      const newFiles = dropped.map(file => ({ id: uid(), file, category } as UploadedFile));
      if (newFiles.length > 0) setImp({ uploadedFiles: [...imp.uploadedFiles, ...newFiles] });
    }

    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>
          {purposes.join(" · ")}
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(category); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
          onDrop={handleDrop}
          style={{
            border: `1px dashed ${isOver ? "#2563EB" : "#D1D5DB"}`,
            borderRadius: 8,
            background: isOver ? "#EFF6FF" : "#FAFAFA",
            padding: "14px 16px",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          {catFiles.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {catFiles.map(uf => (
                <div key={uf.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 5, marginBottom: 4, fontSize: 12 }}>
                  <FileText style={{ width: 12, height: 12, color: "#6B7280", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{uf.file.name}</span>
                  <span style={{ color: "#9CA3AF", flexShrink: 0, fontSize: 11 }}>{uf.file.name.split(".").pop()?.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={() => setImp({ uploadedFiles: imp.uploadedFiles.filter(f => f.id !== uf.id) })}
                    style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label
            htmlFor={slotId}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 12px", cursor: "pointer" }}
          >
            <Upload style={{ width: 18, height: 18, color: isOver ? "#2563EB" : "#9CA3AF" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: isOver ? "#1D4ED8" : "#6B7280" }}>
              Drag and drop files here or click to browse
            </span>
            <span style={{ fontSize: 11, color: "#C4C9D4" }}>
              {accept.replace(/\./g, "").split(",").join(", ").toUpperCase()}
            </span>
            <input
              id={slotId}
              type="file"
              multiple
              accept={accept}
              style={{ display: "none" }}
              onChange={e => {
                const newFiles = Array.from(e.target.files || []).map(file => ({ id: uid(), file, category } as UploadedFile));
                setImp({ uploadedFiles: [...imp.uploadedFiles, ...newFiles] });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Import Existing Structure</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Provide evidence before BIMLog proposes anything</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          You can paste text, upload evidence, or do both. BIMLog will use whatever you provide and propose a probable structure for your review. You will review and edit every suggestion before anything is applied.
        </div>
      </div>

      {textAreaField("Sample file names", "Paste existing file names, one per line", "sampleNames", 6, "PRJ-ARC-G0-DR-0001-P01\nPRJ-STR-L3-CA-0003-C02\n...")}
      {textAreaField("Folder structure", "Paste a folder tree or list of folder names", "rawFolderText", 5, "01-Architecture\n  01.01-Drawings\n  01.02-Models\n02-Structure\n...")}
      {textAreaField("Document index / register", "Paste rows from a document register or index", "rawIndexText", 5, "Doc No | Discipline | Title | Status\nPRJ-ARC-0001 | ARC | Ground Floor Plan | IFR...")}
      {textAreaField("Additional notes", "Any other context, conventions explained in words, or instructions to the analysis engine", "rawNotes", 4, "The project uses a zone-based structure. Area codes are A1–A6...")}

      <div style={{ marginTop: 8, marginBottom: 24, borderTop: "1px solid #E5E7EB", paddingTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 4 }}>Upload Existing Evidence</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
          You can upload supporting files instead of typing everything manually. BIMLog will extract what it can and combine it with your pasted inputs.
        </div>
        {renderUploadSlot("PDF references", "pdf", ".pdf", [
          "Document indexes", "Naming guides", "Contract appendices", "Document lists", "Sample coded documents",
        ])}
        {renderUploadSlot("Spreadsheet registers", "spreadsheet", ".xlsx,.xls,.csv", [
          "Document indexes", "Registers", "Drawing lists", "Transmittal logs", "Submittal logs", "Coding tables",
        ])}
        {renderUploadSlot("Screenshot evidence", "screenshot", ".png,.jpg,.jpeg,.webp", [
          "Folder trees", "Naming examples", "Document headers", "Register screenshots", "Existing coding systems",
        ])}
        {renderUploadSlot("Optional sample files", "sample", ".pdf,.dwg,.ifc,.nwd,.rvt,.docx,.xlsx,.xls,.csv", [
          "Filename evidence only", "BIMLog extracts filenames and visible naming patterns only",
        ])}
      </div>

      {imp.extractionWarning && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, fontSize: 13, color: "#92400E", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          {imp.extractionWarning}
        </div>
      )}

      {imp.error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 13, color: "#991B1B" }}>
          {imp.error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <Button variant="outline" onClick={onBack} style={{ gap: 6, fontSize: 13 }} disabled={imp.analyzing}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Back
        </Button>
        <Button onClick={runAnalysis} disabled={imp.analyzing} style={{ gap: 6, fontSize: 13 }}>
          {imp.analyzing ? (
            <><RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Analyzing project structure…</>
          ) : (
            <>Analyze Project Structure <ChevronRight style={{ width: 15, height: 15 }} /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── AI Suggestions review ────────────────────────────────────────────────────
function AISuggestions({ state, setState, onBack, onContinueToWizard, onStopHere }: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onBack: () => void;
  onContinueToWizard: () => void;
  onStopHere: () => void;
}) {
  const result = state.discoveryResult;
  if (!result) return null;

  function updateItem(
    list: "suggestedDisciplines" | "suggestedSystems" | "suggestedDocTypes" | "suggestedExtraFields",
    idx: number, patch: Partial<DiscoveryItem>
  ) {
    setState(s => {
      const r = s.discoveryResult;
      if (!r) return s;
      const updated = (r[list] as DiscoveryItem[]).map((item, i) => i === idx ? { ...item, ...patch } : item);
      return { ...s, discoveryResult: { ...r, [list]: updated } };
    });
  }

  function removeItem(list: "suggestedDisciplines" | "suggestedSystems" | "suggestedDocTypes" | "suggestedExtraFields", idx: number) {
    setState(s => {
      const r = s.discoveryResult;
      if (!r) return s;
      return { ...s, discoveryResult: { ...r, [list]: (r[list] as DiscoveryItem[]).filter((_, i) => i !== idx) } };
    });
  }

  function addItem(list: "suggestedDisciplines" | "suggestedSystems" | "suggestedDocTypes" | "suggestedExtraFields") {
    const blank: DiscoveryItem = { code: "", label: "", reason: "Manually added", confidence: "high", accepted: true };
    setState(s => {
      const r = s.discoveryResult;
      if (!r) return s;
      return { ...s, discoveryResult: { ...r, [list]: [...(r[list] as DiscoveryItem[]), blank] } };
    });
  }

  const boolFlag = (v: boolean | null) => v === true ? "Yes" : v === false ? "No" : "Not determined";

  const itemList = (
    title: string,
    list: "suggestedDisciplines" | "suggestedSystems" | "suggestedDocTypes" | "suggestedExtraFields",
    items: DiscoveryItem[],
    useKey = false
  ) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</div>
        <button onClick={() => addItem(list)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid #D1D5DB", background: "white", cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
          <Plus style={{ width: 11, height: 11 }} /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>None suggested</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{
              padding: "10px 14px", borderRadius: 8,
              border: `1.5px solid ${item.accepted === false ? "#E5E7EB" : "#D1D5DB"}`,
              background: item.accepted === false ? "#F9FAFB" : "white",
              opacity: item.accepted === false ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {item.editing ? (
                      <>
                        <input
                          value={useKey ? (item.key ?? "") : (item.code ?? "")}
                          onChange={e => updateItem(list, idx, useKey ? { key: e.target.value.toUpperCase() } : { code: e.target.value.toUpperCase() })}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, width: 80, padding: "3px 6px", borderRadius: 4, border: "1px solid #D1D5DB", outline: "none" }}
                        />
                        <input
                          value={item.label}
                          onChange={e => updateItem(list, idx, { label: e.target.value })}
                          style={{ flex: 1, fontSize: 12, padding: "3px 6px", borderRadius: 4, border: "1px solid #D1D5DB", outline: "none" }}
                        />
                      </>
                    ) : (
                      <>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 4 }}>
                          {useKey ? item.key : item.code}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.label}</span>
                      </>
                    )}
                    <ConfidenceBadge level={item.confidence} />
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4 }}>{item.reason}</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => updateItem(list, idx, { editing: !item.editing })}
                    style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#2563EB")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>
                    <Edit2 style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => updateItem(list, idx, { accepted: item.accepted === false ? true : false })}
                    style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: item.accepted === false ? "#9CA3AF" : "#16A34A", borderRadius: 4 }}>
                    <Check style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => removeItem(list, idx)}
                    style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Suggested Convention Structure</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Review BIMLog's analysis of your project</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          These are AI-generated proposals only. Everything below is editable. Your edits are authoritative — accept, modify, remove, or add items before proceeding. Nothing is applied until you confirm.
        </div>
      </div>

      <div style={{ padding: "16px 18px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, marginBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Project type interpretation</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{result.projectTypeGuess || "Not determined"}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Scope interpretation</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{result.scopeInterpretation || "Not specified"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Levels", val: boolFlag(result.usesLevels) },
            { label: "Areas", val: boolFlag(result.usesAreas) },
            { label: "Packages", val: boolFlag(result.usesPackages) },
            { label: "Volumes", val: boolFlag(result.usesVolumes) },
          ].map(f => (
            <div key={f.label} style={{ padding: "8px 10px", background: "white", border: "1px solid #E2E8F0", borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{f.val}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Analysis summary</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{result.analysisSummary}</div>
        </div>
        {result.recommendedMode && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Recommended mode</div>
            <div style={{ fontSize: 13, color: "#374151" }}>{result.recommendedMode}</div>
          </div>
        )}
      </div>

      {itemList("Suggested disciplines", "suggestedDisciplines", result.suggestedDisciplines)}
      {itemList("Suggested systems", "suggestedSystems", result.suggestedSystems)}
      {itemList("Suggested document types", "suggestedDocTypes", result.suggestedDocTypes)}
      {itemList("Suggested extra fields", "suggestedExtraFields", result.suggestedExtraFields, true)}

      {result.suggestedFieldOrder && result.suggestedFieldOrder.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Suggested field order</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.suggestedFieldOrder.map((f, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "4px 10px", borderRadius: 5 }}>
                {i + 1}. {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.ambiguities && result.ambiguities.length > 0 && (
        <div style={{ marginBottom: 24, padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Open questions / ambiguities</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {result.ambiguities.map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: "#92400E" }}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0369A1", marginBottom: 4 }}>Project Convention Guidance</div>
        <div style={{ fontSize: 12, color: "#0369A1", marginBottom: 10 }}>
          Add any project-specific rules, corrections, exclusions, or naming decisions BIMLog should carry forward into the active convention. This is for human context that AI should not guess.
        </div>
        <textarea
          value={state.userGuidance}
          onChange={e => setState(s => ({ ...s, userGuidance: e.target.value }))}
          rows={5}
          placeholder={"Example:\nGoing forward, remove Chinese company references from the active naming convention.\nKeep them only as historical evidence where already present.\nUse local operational terminology for all new convention fields and future records."}
          style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 6, border: "1px solid #BAE6FD", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "var(--font-mono)", lineHeight: 1.6, background: "#fff" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {}}
            style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "1px solid #BAE6FD", background: "#E0F2FE", color: "#0369A1", cursor: "default" }}
          >
            Save guidance
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
          Guidance is saved automatically when you accept this convention. It will be carried forward into all future re-analyses.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid hsl(var(--border))" }}>
        <Button variant="outline" onClick={onBack} style={{ gap: 6, fontSize: 13 }}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Back
        </Button>
        <div style={{ display: "flex", gap: 10 }}>
          {state.setupCtx.analysisOnlyMode && (
            <Button variant="outline" onClick={onStopHere} style={{ fontSize: 13 }}>
              Save findings and stop here
            </Button>
          )}
          <Button onClick={onContinueToWizard} style={{ gap: 6, fontSize: 13 }}>
            Accept and continue to builder <ChevronRight style={{ width: 15, height: 15 }} />
          </Button>
        </div>
      </div>
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
                  background: done ? "#2563EB" : "hsl(var(--border))", zIndex: 0,
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

// ─── Re-Evidence Intake ───────────────────────────────────────────────────────
function ReEvidenceIntake({ state, setState, token, projectId, onBack, onResult }: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  token: string;
  projectId: number;
  onBack: () => void;
  onResult: (result: ReanalysisResult) => void;
}) {
  const imp = state.importState;
  const setImp = (partial: Partial<ImportState>) =>
    setState(s => ({ ...s, importState: { ...s.importState, ...partial } }));
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [dragOver, setDragOver] = useState<UploadedFile["category"] | null>(null);

  async function runReanalysis() {
    setAnalyzing(true); setError(""); setWarning("");
    try {
      const fd = new FormData();
      fd.append("sampleNames", imp.sampleNames.split("\n").map((s: string) => s.trim()).filter(Boolean).join("\n"));
      fd.append("rawFolderTreeText", imp.rawFolderText);
      fd.append("rawIndexText", imp.rawIndexText);
      fd.append("rawNotes", imp.rawNotes);
      for (const uf of imp.uploadedFiles) { fd.append(uf.category, uf.file, uf.file.name); }
      const res = await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/reanalyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setAnalyzing(false); setError(data.error || "Re-analysis failed"); return; }
      const { _extractionWarning, ...cleanData } = data as Record<string, unknown>;
      if (typeof _extractionWarning === "string") setWarning(_extractionWarning);
      setAnalyzing(false);
      onResult(cleanData as unknown as ReanalysisResult);
    } catch (err) {
      setAnalyzing(false);
      setError(err instanceof Error ? err.message : "Re-analysis failed");
    }
  }

  function renderSlot(title: string, category: UploadedFile["category"], accept: string, purposes: string[]) {
    const slotId = `reev-${category}`;
    const catFiles = imp.uploadedFiles.filter(f => f.category === category);
    const isOver = dragOver === category;
    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
      e.preventDefault(); setDragOver(null);
      const newFiles = Array.from(e.dataTransfer.files).map(file => ({ id: uid(), file, category } as UploadedFile));
      if (newFiles.length > 0) setImp({ uploadedFiles: [...imp.uploadedFiles, ...newFiles] });
    }
    return (
      <div key={category} style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>{purposes.join(" · ")}</div>
        <div onDragOver={e => { e.preventDefault(); setDragOver(category); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }} onDrop={handleDrop}
          style={{ border: `1px dashed ${isOver ? "#2563EB" : "#D1D5DB"}`, borderRadius: 8, background: isOver ? "#EFF6FF" : "#FAFAFA", padding: "12px 14px", transition: "border-color 0.15s, background 0.15s" }}>
          {catFiles.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {catFiles.map(uf => (
                <div key={uf.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 5, marginBottom: 4, fontSize: 12 }}>
                  <FileText style={{ width: 12, height: 12, color: "#6B7280", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{uf.file.name}</span>
                  <span style={{ color: "#9CA3AF", flexShrink: 0, fontSize: 11 }}>{uf.file.name.split(".").pop()?.toUpperCase()}</span>
                  <button type="button" onClick={() => setImp({ uploadedFiles: imp.uploadedFiles.filter(f => f.id !== uf.id) })} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label htmlFor={slotId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer" }}>
            <Upload style={{ width: 16, height: 16, color: isOver ? "#2563EB" : "#9CA3AF" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: isOver ? "#1D4ED8" : "#6B7280" }}>Drag and drop files here or click to browse</span>
            <span style={{ fontSize: 11, color: "#C4C9D4" }}>{accept.replace(/\./g, "").split(",").join(", ").toUpperCase()}</span>
            <input id={slotId} type="file" multiple accept={accept} style={{ display: "none" }} onChange={e => {
              const newFiles = Array.from(e.target.files || []).map(file => ({ id: uid(), file, category } as UploadedFile));
              setImp({ uploadedFiles: [...imp.uploadedFiles, ...newFiles] });
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>
    );
  }

  const ta = (label: string, sub: string, val: string, onChange: (v: string) => void, rows: number, placeholder: string) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{sub}</div>
      <textarea value={val} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "var(--font-mono)", lineHeight: 1.6 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <RefreshCw style={{ width: 18, height: 18, color: "#2563EB" }} />
          <span style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Add More Evidence and Re-run Discovery</span>
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
          Upload new evidence or paste additional context. The system will compare it against your existing accepted convention and show only what changed.
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", marginBottom: 14 }}>Paste new text evidence</div>
        {ta("Sample file names", "Real file names from the project, one per line", imp.sampleNames, v => setImp({ sampleNames: v }), 4, "PRJ-ARC-G0-DR-001-A1.pdf\nPRJ-STR-01-GA-002-P1.dwg")}
        {ta("Folder structure", "Paste a new folder tree or directory listing", imp.rawFolderText, v => setImp({ rawFolderText: v }), 4, "Project Root\n  └─ Architecture\n  └─ Structure")}
        {ta("Document register / index", "Paste rows from a spreadsheet or document register", imp.rawIndexText, v => setImp({ rawIndexText: v }), 3, "Doc No\tTitle\tDiscipline\nPRJ-ARC-001\tGA Floor Plans\tARC")}
        {ta("Additional notes", "Anything else relevant — new scope, new subcontractors, etc.", imp.rawNotes, v => setImp({ rawNotes: v }), 3, "New MEP subcontractor added...")}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", marginBottom: 14 }}>Upload new files</div>
        {renderSlot("PDF references", "pdf", ".pdf", ["Updated BEP sections", "New naming standard PDFs", "Revised specification sections"])}
        {renderSlot("Spreadsheet registers", "spreadsheet", ".xlsx,.xls,.csv", ["Updated drawing registers", "New document transmittals", "Revised schedule of sheets"])}
        {renderSlot("Screenshot evidence", "screenshot", ".png,.jpg,.jpeg,.webp", ["New CDE folder screenshots", "Updated file manager views"])}
        {renderSlot("Optional sample files", "sample", ".pdf,.dwg,.ifc,.nwd,.rvt,.docx,.xlsx,.xls,.csv", ["New real project files — filename used as naming pattern evidence only"])}
      </div>

      {warning && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400E", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
          <span>{warning}</span>
        </div>
      )}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>{error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, borderTop: "1px solid hsl(var(--border))" }}>
        <Button variant="outline" onClick={onBack} disabled={analyzing} style={{ gap: 6, fontSize: 13 }}>
          <ChevronLeft style={{ width: 15, height: 15 }} /> Back
        </Button>
        <Button onClick={runReanalysis} disabled={analyzing} style={{ gap: 6, fontSize: 13 }}>
          {analyzing
            ? <><RefreshCw style={{ width: 14, height: 14 }} /> Running re-analysis...</>
            : <><RefreshCw style={{ width: 14, height: 14 }} /> Run Re-analysis</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Changes Review ───────────────────────────────────────────────────────────
function ChangesReview({ state, token, projectId, userGuidance, onGuidanceChange, onAccept, onDiscard }: {
  state: WizardState;
  token: string;
  projectId: number;
  userGuidance: string;
  onGuidanceChange: (v: string) => void;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const result = state.reanalysisResult!;
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [localGuidance, setLocalGuidance] = useState(userGuidance);
  const [guidanceSaved, setGuidanceSaved] = useState(false);

  const toggle = (key: string) => setDecisions(d => ({ ...d, [key]: !d[key] }));
  const isOn = (key: string) => decisions[key] === true;

  const cColor = (c: string) => c === "high" ? "#059669" : c === "medium" ? "#D97706" : "#9CA3AF";
  const cBg = (c: string) => c === "high" ? "#ECFDF5" : c === "medium" ? "#FFFBEB" : "#F3F4F6";

  async function handleAcceptChanges() {
    setSaving(true); setSaveError("");
    try {
      const { confirmedItems: ci, newlySuggestedItems: ni, stillUnresolved, proposedNextVersionSummary, analysisSummary } = result;
      const acceptedDisciplines = [
        ...ci.disciplines.map(code => ({ code, label: code })),
        ...ni.disciplines.filter((_, i) => isOn(`nd_${i}`)).map(d => ({ code: d.code, label: d.label })),
      ];
      const acceptedSystems = [
        ...ci.systems.map(code => ({ code, label: code })),
        ...ni.systems.filter((_, i) => isOn(`ns_${i}`)).map(s => ({ code: s.code, label: s.label })),
      ];
      const acceptedDocTypes = [
        ...ci.documentTypes.map(code => ({ code, label: code })),
        ...ni.documentTypes.filter((_, i) => isOn(`ndt_${i}`)).map(d => ({ code: d.code, label: d.label })),
      ];
      const acceptedExtraFields = [
        ...ci.extraFields.map(key => ({ key, label: key })),
        ...ni.extraFields.filter((_, i) => isOn(`nef_${i}`)).map(f => ({ key: f.key, label: f.label })),
      ];
      const res = await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          acceptedDisciplines, acceptedSystems, acceptedDocTypes, acceptedExtraFields,
          acceptedFieldOrder: ci.fieldOrder,
          analysisSummary,
          ambiguities: stillUnresolved,
          changeSummary: proposedNextVersionSummary,
          userGuidance: localGuidance || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error || "Failed to save version"); setSaving(false); return; }
      setSaving(false);
      onGuidanceChange(localGuidance);
      onAccept();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save version");
      setSaving(false);
    }
  }

  function itemRow(item: ReanalysisItem | ReanalysisExtraField, key: string) {
    const code = "code" in item ? item.code : item.key;
    const label = item.label;
    const on = isOn(key);
    return (
      <div key={key} onClick={() => toggle(key)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", marginBottom: 4, border: `1px solid ${on ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: 7, background: on ? "#EFF6FF" : "#FAFAFA", cursor: "pointer", userSelect: "none" }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? "#2563EB" : "#D1D5DB"}`, background: on ? "#2563EB" : "#fff", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {on && <Check style={{ width: 10, height: 10, color: "#fff" }} />}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{code}</span>
          {label !== code && <span style={{ fontSize: 12, color: "#374151" }}> — {label}</span>}
          <span style={{ fontSize: 11, color: cColor(item.confidence), background: cBg(item.confidence), padding: "1px 5px", borderRadius: 4, marginLeft: 6 }}>{item.confidence}</span>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{item.reason}</div>
        </div>
      </div>
    );
  }

  const ni = result.newlySuggestedItems;
  const hasNew = ni.disciplines.length + ni.systems.length + ni.documentTypes.length + ni.extraFields.length > 0;
  const ci = result.confirmedItems;
  const hasConfirmed = ci.disciplines.length + ci.systems.length + ci.documentTypes.length > 0;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <GitMerge style={{ width: 18, height: 18, color: "#2563EB" }} />
          <span style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Convention Changes Review</span>
        </div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          Based on Version {result.baselineVersion}. Review each finding before saving a new version. Changes are not forced — you decide what to accept.
        </div>
      </div>

      <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0369A1", marginBottom: 8 }}>Active Project Convention Guidance</div>
        <div style={{ fontSize: 12, color: "#0369A1", marginBottom: 8 }}>
          This guidance governs the active convention. Edit it here before accepting a new version. Guidance is carried forward into all future re-analyses.
        </div>
        <textarea
          value={localGuidance}
          onChange={e => { setLocalGuidance(e.target.value); setGuidanceSaved(false); }}
          rows={4}
          placeholder={"No guidance set. Add project-specific rules, corrections, or naming decisions BIMLog should respect going forward."}
          style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 6, border: "1px solid #BAE6FD", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "var(--font-mono)", lineHeight: 1.6, background: "#fff" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => { onGuidanceChange(localGuidance); setGuidanceSaved(true); }}
            style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "1px solid #BAE6FD", background: guidanceSaved ? "#DCFCE7" : "#E0F2FE", color: guidanceSaved ? "#15803D" : "#0369A1", cursor: "pointer" }}
          >
            {guidanceSaved ? "Guidance updated" : "Update guidance"}
          </button>
        </div>
      </div>

      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", marginBottom: 8 }}>Analysis Summary</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{result.analysisSummary || "No summary provided."}</div>
      </div>

      {hasConfirmed && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <CheckCircle2 style={{ width: 14, height: 14, color: "#059669" }} />
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#059669" }}>Confirmed by New Evidence</span>
          </div>
          {ci.disciplines.length > 0 && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}><strong>Disciplines:</strong> {ci.disciplines.join(", ")}</div>}
          {ci.systems.length > 0 && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}><strong>Systems:</strong> {ci.systems.join(", ")}</div>}
          {ci.documentTypes.length > 0 && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}><strong>Document types:</strong> {ci.documentTypes.join(", ")}</div>}
          {ci.extraFields.length > 0 && <div style={{ fontSize: 12, color: "#374151" }}><strong>Extra fields:</strong> {ci.extraFields.join(", ")}</div>}
        </div>
      )}

      {hasNew && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Plus style={{ width: 14, height: 14, color: "#2563EB" }} />
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2563EB" }}>Newly Suggested Items</span>
            <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 4 }}>— click to accept</span>
          </div>
          {ni.disciplines.length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Disciplines</div>{ni.disciplines.map((d, i) => itemRow(d, `nd_${i}`))}</div>)}
          {ni.systems.length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Systems</div>{ni.systems.map((s, i) => itemRow(s, `ns_${i}`))}</div>)}
          {ni.documentTypes.length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Document types</div>{ni.documentTypes.map((d, i) => itemRow(d, `ndt_${i}`))}</div>)}
          {ni.extraFields.length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Extra fields</div>{ni.extraFields.map((f, i) => itemRow(f, `nef_${i}`))}</div>)}
        </div>
      )}

      {result.conflicts.length > 0 && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <AlertTriangle style={{ width: 14, height: 14, color: "#D97706" }} />
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D97706" }}>Conflict with Current Convention</span>
          </div>
          {result.conflicts.map((conflict, i) => {
            const key = `conflict_${i}`;
            const replace = isOn(key);
            return (
              <div key={i} style={{ background: "#fff", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 3 }}>{conflict.category}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{conflict.reason}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setDecisions(d => ({ ...d, [key]: false }))} style={{ flex: 1, padding: "6px 10px", border: `1.5px solid ${!replace ? "#9CA3AF" : "#E5E7EB"}`, borderRadius: 6, background: !replace ? "#F3F4F6" : "#fff", fontSize: 12, cursor: "pointer", fontWeight: !replace ? 600 : 400, color: !replace ? "#374151" : "#9CA3AF" }}>
                    Keep current: {conflict.existingValue}
                  </button>
                  <button type="button" onClick={() => setDecisions(d => ({ ...d, [key]: true }))} style={{ flex: 1, padding: "6px 10px", border: `1.5px solid ${replace ? "#D97706" : "#E5E7EB"}`, borderRadius: 6, background: replace ? "#FFFBEB" : "#fff", fontSize: 12, cursor: "pointer", fontWeight: replace ? 600 : 400, color: replace ? "#92400E" : "#9CA3AF" }}>
                    Replace with: {conflict.newValue}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.stillUnresolved.length > 0 && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", marginBottom: 10 }}>Still Unresolved</div>
          {result.stillUnresolved.map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5, display: "flex", gap: 8 }}><span style={{ color: "#9CA3AF" }}>—</span><span>{item}</span></div>
          ))}
        </div>
      )}

      {result.recommendedActions.length > 0 && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", marginBottom: 10 }}>Recommended Actions</div>
          {result.recommendedActions.map((action, i) => (
            <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5, display: "flex", gap: 8 }}><span style={{ color: "#2563EB", fontWeight: 700 }}>{i + 1}.</span><span>{action}</span></div>
          ))}
        </div>
      )}

      {result.proposedNextVersionSummary && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "16px 20px", marginBottom: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0369A1", marginBottom: 8 }}>Proposed Next Version Summary</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{result.proposedNextVersionSummary}</div>
        </div>
      )}

      {saveError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>{saveError}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, borderTop: "1px solid hsl(var(--border))" }}>
        <Button variant="outline" onClick={onDiscard} disabled={saving} style={{ gap: 6, fontSize: 13 }}>
          <X style={{ width: 14, height: 14 }} /> Discard Changes
        </Button>
        <Button onClick={handleAcceptChanges} disabled={saving} style={{ gap: 6, fontSize: 13 }}>
          {saving ? "Saving..." : <><Check style={{ width: 14, height: 14 }} /> Accept Selected Changes + Save New Version</>}
        </Button>
      </div>
    </div>
  );
}

// ─── step 1 ───────────────────────────────────────────────────────────────────
function Step1({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  // per-company edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const code = newCode.trim().toUpperCase() || newName.trim().slice(0, 3).toUpperCase();
    setState(s => ({ ...s, companies: [...s.companies, { id: uid(), name: newName.trim(), code }] }));
    setNewName(""); setNewCode("");
  };

  const startEdit = (c: Company) => { setEditId(c.id); setEditName(c.name); setEditCode(c.code); };
  const saveEdit = () => {
    if (!editId) return;
    setState(s => ({ ...s, companies: s.companies.map(c => c.id === editId ? { ...c, name: editName.trim() || c.name, code: editCode.toUpperCase().slice(0, 8) || c.code } : c) }));
    setEditId(null);
  };

  return (
    <div>
      <SectionTitle
        title={w("Who is on this project?", "¿Quiénes participan en este proyecto?", lang)}
        sub={w("Add every company that will submit files. Each company gets a unique code used in every file name.", "Agrega cada empresa que enviará archivos. Cada empresa obtiene un código único.", lang)}
      />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{w("Add Company", "Agregar Empresa", lang)}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input value={newName} onChange={e => { setNewName(e.target.value); if (!newCode) setNewCode(e.target.value.slice(0,3).toUpperCase()); }} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder={w("Company Name", "Nombre de Empresa", lang)} style={{ flex: 2, fontSize: 13 }} />
          <Input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().slice(0,8))} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder={w("Code (auto)", "Código (auto)", lang)} style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-mono)" }} />
          <Button onClick={handleAdd} size="sm" style={{ gap: 5, fontSize: 12, flexShrink: 0 }}><Plus style={{ width: 13, height: 13 }} />{w("Add", "Agregar", lang)}</Button>
        </div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
          {w("Each person will be identified by their company code in every file name. Codes can be up to 8 characters.", "Cada persona se identificará por el código de su empresa. Los códigos pueden tener hasta 8 caracteres.", lang)}
        </div>

        {/* Edit modal overlay */}
        {editId && (
          <div style={{ marginTop: 12, padding: "14px 16px", background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>{w("Edit Company", "Editar Empresa", lang)}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder={w("Company Name", "Nombre", lang)} style={{ flex: 2, fontSize: 13 }} autoFocus />
              <Input value={editCode} onChange={e => setEditCode(e.target.value.toUpperCase().slice(0,8))} placeholder="Code" style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-mono)" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={saveEdit} style={{ fontSize: 12, gap: 5 }}><Check style={{ width: 12, height: 12 }} />{w("Save", "Guardar", lang)}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditId(null)} style={{ fontSize: 12 }}>{w("Cancel", "Cancelar", lang)}</Button>
            </div>
          </div>
        )}

        {state.companies.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {state.companies.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 7, background: editId === c.id ? "#EFF6FF" : "hsl(var(--secondary))", border: `1px solid ${editId === c.id ? "#2563EB" : "hsl(var(--border))"}` }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "3px 10px", borderRadius: 4, flexShrink: 0, minWidth: 60, textAlign: "center" }}>
                  {c.code}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                <button onClick={() => startEdit(c)} title={w("Edit code and name", "Editar código y nombre", lang)} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}>
                  <Edit2 style={{ width: 13, height: 13 }} />
                </button>
                <button onClick={() => setState(s => ({ ...s, companies: s.companies.filter(x => x.id !== c.id) }))} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }}
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
            <button key={sep} onClick={() => setState(s => ({ ...s, separator: sep }))} style={{ padding: "16px", borderRadius: 8, cursor: "pointer", textAlign: "left", border: `2px solid ${state.separator === sep ? "#2563EB" : "hsl(var(--border))"}`, background: state.separator === sep ? "#EFF6FF" : "hsl(var(--card))" }}>
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
        <Toggle checked={state.enforceUppercase} onChange={v => setState(s => ({ ...s, enforceUppercase: v }))} label={w("Force uppercase on all file names", "Forzar mayúsculas en todos los nombres", lang)} sub={w("BIMLog will reject any file name containing lowercase letters. Recommended for ISO 19650.", "BIMLog rechazará nombres con letras minúsculas. Recomendado para ISO 19650.", lang)} />
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 12, marginTop: 4 }}>
          <Toggle checked={state.applyCharLimits} onChange={v => setState(s => ({ ...s, applyCharLimits: v }))} label={w("Apply character limits per field", "Aplicar límite de caracteres por campo", lang)} sub={w("You will be able to set min and max characters per field in the review screen.", "Podrás establecer mínimos y máximos por campo en la pantalla de revisión.", lang)} />
        </div>
      </Card>
    </div>
  );
}

// ─── step 2 ───────────────────────────────────────────────────────────────────
function Step2({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [customDName, setCustomDName] = useState("");
  const [customDCode, setCustomDCode] = useState("");
  const [editDiscId, setEditDiscId] = useState<string | null>(null);
  const [editDiscCode, setEditDiscCode] = useState("");
  const [editDiscName, setEditDiscName] = useState("");
  // Level add
  const [newLevel, setNewLevel] = useState("");
  const [insertAfter, setInsertAfter] = useState("__end__");

  const toggleDisc = (id: string) => setState(s => ({ ...s, disciplines: s.disciplines.map(d => d.id === id ? { ...d, selected: !d.selected } : d) }));
  const removeDisc = (id: string) => setState(s => ({ ...s, disciplines: s.disciplines.filter(d => d.id !== id) }));

  const startEditDisc = (d: DisciplineEntry) => { setEditDiscId(d.id); setEditDiscCode(d.code); setEditDiscName(d.name); };
  const saveEditDisc = () => {
    if (!editDiscId) return;
    setState(s => ({ ...s, disciplines: s.disciplines.map(d => d.id === editDiscId ? { ...d, code: editDiscCode.toUpperCase().slice(0,8) || d.code, name: editDiscName.trim() || d.name } : d) }));
    setEditDiscId(null);
  };

  const addCustomDisc = () => {
    if (!customDName.trim() || !customDCode.trim()) return;
    setState(s => ({ ...s, disciplines: [...s.disciplines, { id: uid(), code: customDCode.toUpperCase().slice(0,8), name: customDName, desc: "Custom discipline", selected: true, custom: true }] }));
    setCustomDName(""); setCustomDCode("");
  };

  // Level management
  const regenerateLevels = () => {
    setState(s => ({ ...s, levelList: buildLevelList(s.floorsAbove, s.basements, s.hasGroundFloor, s.groundFloorCode, s.hasRoof, s.roofCode, s.includeZZ) }));
  };

  const removeLevel = (id: string) => setState(s => ({ ...s, levelList: s.levelList.filter(l => l.id !== id) }));

  const moveLevel = (id: string, dir: -1 | 1) => {
    setState(s => {
      const list = [...s.levelList];
      const idx = list.findIndex(l => l.id === id);
      if (idx < 0) return s;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= list.length) return s;
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
      return { ...s, levelList: list };
    });
  };

  const addLevel = () => {
    if (!newLevel.trim()) return;
    const entry: LevelEntry = { id: uid(), code: newLevel.toUpperCase().trim() };
    setState(s => {
      const list = [...s.levelList];
      if (insertAfter === "__end__") {
        list.push(entry);
      } else {
        const idx = list.findIndex(l => l.id === insertAfter);
        list.splice(idx + 1, 0, entry);
      }
      return { ...s, levelList: list };
    });
    setNewLevel("");
    setInsertAfter("__end__");
  };

  const editLevelCode = (id: string, code: string) => {
    setState(s => ({ ...s, levelList: s.levelList.map(l => l.id === id ? { ...l, code: code.toUpperCase().slice(0, 10) } : l) }));
  };

  return (
    <div>
      <SectionTitle title={w("What disciplines and floors does this project have?", "¿Qué disciplinas y pisos tiene este proyecto?", lang)} />

      {/* Disciplines */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{w("Disciplines", "Disciplinas", lang)}</div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
            {w("Click code or name to edit — click card to select/deselect", "Clic en código o nombre para editar", lang)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
          {w("Select all disciplines that will submit files. Edit any code or name to match your project standards.", "Selecciona todas las disciplinas. Edita cualquier código o nombre para que coincida con tus estándares.", lang)}
        </div>

        {/* Inline edit panel */}
        {editDiscId && (
          <div style={{ marginBottom: 12, padding: "12px 14px", background: "#EFF6FF", border: "2px solid #2563EB", borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>{w("Edit Discipline", "Editar Disciplina", lang)}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Input value={editDiscCode} onChange={e => setEditDiscCode(e.target.value.toUpperCase().slice(0,8))} placeholder={w("Code", "Código", lang)} style={{ width: 100, fontSize: 13, fontFamily: "var(--font-mono)" }} autoFocus />
              <Input value={editDiscName} onChange={e => setEditDiscName(e.target.value)} placeholder={w("Name", "Nombre", lang)} style={{ flex: 1, fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={saveEditDisc} style={{ fontSize: 12, gap: 5 }}><Check style={{ width: 12, height: 12 }} />{w("Save", "Guardar", lang)}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditDiscId(null)} style={{ fontSize: 12 }}>{w("Cancel", "Cancelar", lang)}</Button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 8 }}>
          {state.disciplines.map(d => (
            <div key={d.id} style={{
              padding: "10px 12px", borderRadius: 7, position: "relative",
              border: `2px solid ${d.selected ? "#2563EB" : "hsl(var(--border))"}`,
              background: d.selected ? "#EFF6FF" : "hsl(var(--card))",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <button onClick={() => toggleDisc(d.id)} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  {d.code}
                </button>
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => startEditDisc(d)} title={w("Edit code / name", "Editar código / nombre", lang)} style={{ padding: 3, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 3 }}>
                    <Edit2 style={{ width: 11, height: 11 }} />
                  </button>
                  <button onClick={() => removeDisc(d.id)} title={w("Remove", "Eliminar", lang)} style={{ padding: 3, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              </div>
              <button onClick={() => toggleDisc(d.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 2, lineHeight: 1.3 }}>{d.desc}</div>
              </button>
              {d.selected && <div style={{ position: "absolute", top: 8, right: 32 }}><Check style={{ width: 11, height: 11, color: "#1D4ED8" }} /></div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid hsl(var(--border))" }}>
          <Input value={customDName} onChange={e => { setCustomDName(e.target.value); if (!customDCode) setCustomDCode(e.target.value.slice(0,4).toUpperCase()); }} placeholder={w("Discipline Name", "Nombre de disciplina", lang)} style={{ flex: 2, fontSize: 12 }} />
          <Input value={customDCode} onChange={e => setCustomDCode(e.target.value.toUpperCase().slice(0,8))} placeholder={w("Code (e.g. MEP)", "Código (ej. MEP)", lang)} style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }} />
          <Button variant="outline" size="sm" onClick={addCustomDisc} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}><Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}</Button>
        </div>
      </Card>

      {/* Building Levels — full control */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{w("Building Levels", "Pisos del Edificio", lang)}</div>
          <span style={{ fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: 10 }}>
            {state.levelList.length} {w("levels", "niveles", lang)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 14 }}>
          {w("Use the generator to auto-fill, then delete, reorder, rename, or insert levels anywhere you need.", "Usa el generador para rellenar automáticamente, luego elimina, reordena o inserta niveles donde necesites.", lang)}
        </div>

        {/* Generator inputs */}
        <div style={{ padding: "12px 14px", background: "hsl(var(--secondary))", borderRadius: 7, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            {w("Level Generator (optional)", "Generador de Niveles (opcional)", lang)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>{w("Floors above ground", "Pisos sobre nivel de suelo", lang)}</label>
              <Input type="number" min={0} max={300} value={state.floorsAbove || ""} placeholder="0"
                onChange={e => setState(s => ({ ...s, floorsAbove: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 4 }}>{w("Basement levels", "Niveles de sótano", lang)}</label>
              <Input type="number" min={0} max={50} value={state.basements || ""} placeholder="0"
                onChange={e => setState(s => ({ ...s, basements: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{ fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={state.hasGroundFloor} onChange={e => setState(s => ({ ...s, hasGroundFloor: e.target.checked }))} style={{ accentColor: "#2563EB" }} />
              {w("Ground floor", "Planta baja", lang)}
              {state.hasGroundFloor && (
                <Input value={state.groundFloorCode} onChange={e => setState(s => ({ ...s, groundFloorCode: e.target.value.toUpperCase().slice(0,6) }))} placeholder="G0" style={{ width: 60, fontSize: 12, fontFamily: "var(--font-mono)", padding: "2px 6px", height: 28 }} />
              )}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={state.hasRoof} onChange={e => setState(s => ({ ...s, hasRoof: e.target.checked }))} style={{ accentColor: "#2563EB" }} />
              {w("Roof level", "Nivel de techo", lang)}
              {state.hasRoof && (
                <Input value={state.roofCode} onChange={e => setState(s => ({ ...s, roofCode: e.target.value.toUpperCase().slice(0,6) }))} placeholder="RF" style={{ width: 60, fontSize: 12, fontFamily: "var(--font-mono)", padding: "2px 6px", height: 28 }} />
              )}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={state.includeZZ} onChange={e => setState(s => ({ ...s, includeZZ: e.target.checked }))} style={{ accentColor: "#2563EB" }} />
              {w("All-levels ZZ", "Todos los niveles ZZ", lang)}
            </label>
          </div>
          <Button variant="outline" size="sm" onClick={regenerateLevels} style={{ gap: 5, fontSize: 12 }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
            {w("Generate level list", "Generar lista de niveles", lang)}
          </Button>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>
            {w("This replaces the current list. Your custom edits below are preserved until you click Generate again.", "Esto reemplaza la lista actual. Tus ediciones personalizadas se preservan hasta que hagas clic en Generar.", lang)}
          </div>
        </div>

        {/* Editable level list */}
        {state.levelList.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {w("Level List — click a code to rename, use arrows to reorder, × to delete", "Lista de Niveles — clic para renombrar, flechas para reordenar, × para eliminar", lang)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {state.levelList.map((lv, idx) => (
                <div key={lv.id} style={{ display: "inline-flex", alignItems: "center", gap: 1, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, overflow: "hidden" }}>
                  <input
                    value={lv.code}
                    onChange={e => editLevelCode(lv.id, e.target.value)}
                    title={w("Click to rename this level", "Clic para renombrar este nivel", lang)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#1D4ED8",
                      background: "transparent", border: "none", outline: "none", padding: "3px 6px",
                      width: Math.max(lv.code.length * 8 + 16, 30), cursor: "text",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <button onClick={() => moveLevel(lv.id, -1)} disabled={idx === 0}
                      style={{ padding: "1px 3px", border: "none", background: "transparent", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#CBD5E1" : "#1D4ED8", lineHeight: 1 }}>
                      <ArrowUp style={{ width: 8, height: 8 }} />
                    </button>
                    <button onClick={() => moveLevel(lv.id, 1)} disabled={idx === state.levelList.length - 1}
                      style={{ padding: "1px 3px", border: "none", background: "transparent", cursor: idx === state.levelList.length - 1 ? "default" : "pointer", color: idx === state.levelList.length - 1 ? "#CBD5E1" : "#1D4ED8", lineHeight: 1 }}>
                      <ArrowDown style={{ width: 8, height: 8 }} />
                    </button>
                  </div>
                  <button onClick={() => removeLevel(lv.id)}
                    style={{ padding: "3px 5px", border: "none", borderLeft: "1px solid #BFDBFE", background: "transparent", cursor: "pointer", color: "#93C5FD", lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "#93C5FD")}>
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13, border: "1px dashed hsl(var(--border))", borderRadius: 7, marginBottom: 14 }}>
            {w("No levels yet. Use the generator above or add levels manually below.", "Sin niveles aún. Usa el generador o agrega niveles manualmente.", lang)}
          </div>
        )}

        {/* Add level with position selector */}
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{w("Add a level", "Agregar un nivel", lang)}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 3 }}>{w("Level Code", "Código de Nivel", lang)}</label>
              <Input value={newLevel} onChange={e => setNewLevel(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addLevel()} placeholder="e.g. MEZ1, PH2, MR3, 13A" style={{ width: 160, fontSize: 12, fontFamily: "var(--font-mono)" }} />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", display: "block", marginBottom: 3 }}>{w("Insert position", "Posición de inserción", lang)}</label>
              <select value={insertAfter} onChange={e => setInsertAfter(e.target.value)} style={{ height: 36, fontSize: 12, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "0 8px", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>
                <option value="__end__">{w("At the end", "Al final", lang)}</option>
                {state.levelList.map((lv, idx) => (
                  <option key={lv.id} value={lv.id}>{w(`After ${lv.code} (position ${idx + 1})`, `Después de ${lv.code} (posición ${idx + 1})`, lang)}</option>
                ))}
                <option value="__start__">{w("At the beginning", "Al inicio", lang)}</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={addLevel} style={{ gap: 4, fontSize: 12, flexShrink: 0, height: 36 }}>
              <Plus style={{ width: 12, height: 12 }} />{w("Add Level", "Agregar Nivel", lang)}
            </Button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
            {w("Common additions: MEZ1, MEZ2, MER (Mechanical Equipment Room), PH1, PH2, RF2, L13A, HALF, POD, SKY", "Ejemplos: MEZ1, MEZ2, MER, PH1, PH2, RF2, L13A, MEDIO, POD", lang)}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── step 3 ───────────────────────────────────────────────────────────────────
function Step3({ state, setState, lang }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; lang: string }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingToCat, setAddingToCat] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customStatusCode, setCustomStatusCode] = useState("");
  const [customStatusMeaning, setCustomStatusMeaning] = useState("");

  const toggleDoc = (id: string) => setState(s => ({ ...s, docTypes: s.docTypes.map(d => d.id === id ? { ...d, selected: !d.selected } : d) }));
  const toggleStatus = (id: string) => setState(s => ({ ...s, statusCodes: s.statusCodes.map(sc => sc.id === id ? { ...sc, selected: !sc.selected } : sc) }));
  const removeDoc = (id: string) => setState(s => ({ ...s, docTypes: s.docTypes.filter(d => d.id !== id) }));

  const selectedCount = state.docTypes.filter(d => d.selected).length;

  const filtered = search.trim()
    ? state.docTypes.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase()) ||
        d.desc.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const categories = [...new Set(state.docTypes.map(d => d.category))];

  const selectAllCat = (cat: string) => setState(s => ({ ...s, docTypes: s.docTypes.map(d => d.category === cat ? { ...d, selected: true } : d) }));
  const deselectAllCat = (cat: string) => setState(s => ({ ...s, docTypes: s.docTypes.map(d => d.category === cat ? { ...d, selected: false } : d) }));

  const addCustomToCategory = (cat: string) => {
    if (!customCode.trim() || !customName.trim()) return;
    setState(s => ({ ...s, docTypes: [...s.docTypes, { id: uid(), code: customCode.toUpperCase().slice(0,8), name: customName, desc: customDesc || "Custom type", category: cat, selected: true, custom: true }] }));
    setCustomCode(""); setCustomName(""); setCustomDesc(""); setAddingToCat(null);
  };

  const addCustomStatus = () => {
    if (!customStatusCode.trim()) return;
    setState(s => ({ ...s, statusCodes: [...s.statusCodes, { id: uid(), code: customStatusCode.toUpperCase(), meaning: customStatusMeaning, selected: true, custom: true }] }));
    setCustomStatusCode(""); setCustomStatusMeaning("");
  };

  const DocCard = ({ d }: { d: DocTypeEntry }) => (
    <div style={{ position: "relative", padding: "8px 10px", borderRadius: 6, border: `2px solid ${d.selected ? "#2563EB" : "hsl(var(--border))"}`, background: d.selected ? "#EFF6FF" : "hsl(var(--card))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => toggleDoc(d.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.code}</span>
          {d.selected && <Check style={{ width: 10, height: 10, color: "#1D4ED8" }} />}
        </button>
        <button onClick={() => removeDoc(d.id)} title={w("Remove", "Eliminar", lang)} style={{ padding: 2, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
          <X style={{ width: 9, height: 9 }} />
        </button>
      </div>
      <button onClick={() => toggleDoc(d.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: d.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>{d.name}</div>
        <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 1, lineHeight: 1.2 }}>{d.desc}</div>
      </button>
    </div>
  );

  return (
    <div>
      <SectionTitle title={w("What types of documents will be submitted?", "¿Qué tipos de documentos se enviarán?", lang)} sub={w("How will files be numbered and what status codes will be used?", "¿Cómo se numerarán y qué códigos de estado se usarán?", lang)} />

      {/* Doc Types */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{w("Document Types", "Tipos de Documentos", lang)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: selectedCount > 0 ? "#EFF6FF" : "hsl(var(--secondary))", color: selectedCount > 0 ? "#1D4ED8" : "hsl(var(--muted-foreground))", border: `1px solid ${selectedCount > 0 ? "#BFDBFE" : "hsl(var(--border))"}`, padding: "1px 7px", borderRadius: 10 }}>
              {selectedCount} {w("selected", "seleccionados", lang)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setState(s => ({ ...s, docTypes: s.docTypes.map(d => ({ ...d, selected: true })) }))} style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))" }}>{w("Select All", "Seleccionar Todo", lang)}</button>
            <button onClick={() => setState(s => ({ ...s, docTypes: s.docTypes.map(d => ({ ...d, selected: false })) }))} style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))" }}>{w("Deselect All", "Deseleccionar Todo", lang)}</button>
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "hsl(var(--muted-foreground))" }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={w("Search document types…", "Buscar tipos de documentos…", lang)} style={{ paddingLeft: 32, fontSize: 13 }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}><X style={{ width: 13, height: 13 }} /></button>}
        </div>

        {filtered ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 6 }}>
            {filtered.map(d => <DocCard key={d.id} d={d} />)}
          </div>
        ) : (
          <div>
            {categories.map(cat => {
              const catTypes = state.docTypes.filter(d => d.category === cat);
              const catSelected = catTypes.filter(t => t.selected).length;
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: isCollapsed ? 0 : 6 }}>
                    <button onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))} style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 6, background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", cursor: "pointer",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{cat}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "1px 6px", borderRadius: 8 }}>{catSelected}/{catTypes.length}</span>
                      </div>
                      {isCollapsed ? <ChevronDown style={{ width: 13, height: 13 }} /> : <ChevronUp style={{ width: 13, height: 13 }} />}
                    </button>
                    {/* Per-category controls */}
                    <button onClick={() => selectAllCat(cat)} title={w("Select all in this section", "Seleccionar todos en esta sección", lang)} style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))", color: "#1D4ED8", flexShrink: 0 }}>✓ {w("All", "Todos", lang)}</button>
                    <button onClick={() => deselectAllCat(cat)} title={w("Deselect all in this section", "Deseleccionar todos en esta sección", lang)} style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>✕ {w("None", "Ninguno", lang)}</button>
                    <button onClick={() => setAddingToCat(addingToCat === cat ? null : cat)} title={w("Add custom type to this section", "Agregar tipo personalizado a esta sección", lang)} style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                      <Plus style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                  {/* Inline add for category */}
                  {addingToCat === cat && !isCollapsed && (
                    <div style={{ padding: "10px 12px", marginBottom: 6, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 7 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>{w(`Add to ${cat}`, `Agregar a ${cat}`, lang)}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase().slice(0,8))} placeholder={w("Code", "Código", lang)} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)", flexShrink: 0 }} />
                        <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder={w("Type Name", "Nombre del tipo", lang)} style={{ flex: 1, minWidth: 120, fontSize: 12 }} />
                        <Input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder={w("Description (optional)", "Descripción (opcional)", lang)} style={{ flex: 2, minWidth: 120, fontSize: 12 }} />
                        <Button size="sm" onClick={() => addCustomToCategory(cat)} style={{ fontSize: 12, gap: 4, flexShrink: 0 }}><Plus style={{ width: 11, height: 11 }} />{w("Add", "Agregar", lang)}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddingToCat(null); setCustomCode(""); setCustomName(""); setCustomDesc(""); }} style={{ fontSize: 12, flexShrink: 0 }}>{w("Cancel", "Cancelar", lang)}</Button>
                      </div>
                    </div>
                  )}
                  {!isCollapsed && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 6 }}>
                      {catTypes.map(d => <DocCard key={d.id} d={d} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Sequence Numbers */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Sequence Number Format", "Formato de Número de Secuencia", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("How will files be numbered within each category?", "¿Cómo se numerarán los archivos dentro de cada categoría?", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          {([3, 4, 5] as const).map(n => (
            <button key={n} onClick={() => setState(s => ({ ...s, seqDigits: n }))} style={{ padding: "12px", borderRadius: 7, cursor: "pointer", textAlign: "center", border: `2px solid ${state.seqDigits === n ? "#2563EB" : "hsl(var(--border))"}`, background: state.seqDigits === n ? "#EFF6FF" : "hsl(var(--card))" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 900, color: state.seqDigits === n ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 4 }}>{"0".repeat(n - 1)}1</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: state.seqDigits === n ? "#1D4ED8" : "hsl(var(--foreground))" }}>{n} {w("digits", "dígitos", lang)}</div>
              <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{n === 3 ? w("001 to 999 — smaller projects", "001 a 999 — proyectos pequeños", lang) : n === 4 ? w("0001 to 9999 — recommended", "0001 a 9999 — recomendado", lang) : w("00001 to 99999 — very large", "00001 a 99999 — proyectos muy grandes", lang)}</div>
              {n === 4 && state.seqDigits === 4 && <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "1px 6px", borderRadius: 4, display: "inline-block" }}>✓ {w("Recommended", "Recomendado", lang)}</div>}
            </button>
          ))}
        </div>
        <Note text={w("BIMLog validates that sequence numbers match this format exactly. Files with wrong digit count will be rejected.", "BIMLog valida que los números de secuencia coincidan exactamente. Los archivos con recuento incorrecto serán rechazados.", lang)} />
      </Card>

      {/* Status Codes */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Status Codes", "Códigos de Estado", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("Status codes indicate the suitability of a document for its intended purpose.", "Los códigos de estado indican la idoneidad del documento para su propósito.", lang)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {state.statusCodes.map(sc => (
            <button key={sc.id} onClick={() => toggleStatus(sc.id)} title={sc.meaning} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${sc.selected ? "#2563EB" : "hsl(var(--border))"}`, background: sc.selected ? "#EFF6FF" : "hsl(var(--card))", color: sc.selected ? "#1D4ED8" : "hsl(var(--foreground))" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{sc.code}</span>
              <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{sc.meaning}</span>
              {sc.custom && (
                <button onClick={e => { e.stopPropagation(); setState(s => ({ ...s, statusCodes: s.statusCodes.filter(x => x.id !== sc.id) })); }} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", color: "#93C5FD" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "#93C5FD")}>
                  <X style={{ width: 9, height: 9 }} />
                </button>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid hsl(var(--border))", paddingTop: 12 }}>
          <Input value={customStatusCode} onChange={e => setCustomStatusCode(e.target.value.toUpperCase().slice(0,6))} placeholder={w("Code", "Código", lang)} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)", flexShrink: 0 }} />
          <Input value={customStatusMeaning} onChange={e => setCustomStatusMeaning(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomStatus()} placeholder={w("Meaning / description", "Significado", lang)} style={{ flex: 1, fontSize: 12 }} />
          <Button variant="outline" size="sm" onClick={addCustomStatus} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}><Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}</Button>
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

  const selectedDiscs = state.disciplines.filter(d => d.selected);
  const revExamples = buildRevisionCodes(state.revisionFormat, state.customRevisions);
  const MANDATORY_FIELD_KEYS = ["Project Code","Originator","Discipline","Level","Type","Sequence","Status","Revision"];

  return (
    <div>
      <SectionTitle title={w("Revision codes and advanced settings", "Códigos de revisión y configuración avanzada", lang)} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Revision Format", "Formato de Revisión", lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>{w("How will document revisions be tracked?", "¿Cómo se rastrearán las revisiones?", lang)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {(["alpha","numerical","custom"] as const).map(fmt => (
            <button key={fmt} onClick={() => setState(s => ({ ...s, revisionFormat: fmt }))} style={{ padding: "12px", borderRadius: 7, cursor: "pointer", textAlign: "left", border: `2px solid ${state.revisionFormat === fmt ? "#2563EB" : "hsl(var(--border))"}`, background: state.revisionFormat === fmt ? "#EFF6FF" : "hsl(var(--card))" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: state.revisionFormat === fmt ? "#1D4ED8" : "hsl(var(--foreground))", marginBottom: 4 }}>
                {fmt === "alpha" ? w("Alphabetical","Alfabético",lang) : fmt === "numerical" ? w("Numerical with prefix","Numérico con prefijo",lang) : w("Custom","Personalizado",lang)}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {fmt === "alpha" ? "A  B  C  D  E…" : fmt === "numerical" ? "P01  P02  C01  C02…" : w("Define your own","Define el tuyo",lang)}
              </div>
            </button>
          ))}
        </div>
        {state.revisionFormat === "custom" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Input value={customRev} onChange={e => setCustomRev(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addCustomRev()} placeholder={w("Enter revision code", "Ingresa código de revisión", lang)} style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }} />
              <Button variant="outline" size="sm" onClick={addCustomRev} style={{ gap: 4, fontSize: 12, flexShrink: 0 }}><Plus style={{ width: 12, height: 12 }} />{w("Add", "Agregar", lang)}</Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {state.customRevisions.map((r, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 7px", borderRadius: 4 }}>
                  {r}
                  <button onClick={() => setState(s => ({ ...s, customRevisions: s.customRevisions.filter((_,j) => j!==i) }))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1 }}><X style={{ width: 10, height: 10 }} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {revExamples.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginRight: 4, alignSelf: "center" }}>{w("Preview:","Vista previa:",lang)}</span>
            {revExamples.slice(0,12).map(r => <span key={r} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: "#F5F3FF", color: "#5B21B6", border: "1px solid #DDD6FE", padding: "2px 6px", borderRadius: 4 }}>{r}</span>)}
          </div>
        )}
      </Card>

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

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Grace Period","Período de Gracia",lang)}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>{w("Give your team time to adapt before violations are hard rejected.","Dale a tu equipo tiempo para adaptarse antes del rechazo estricto.",lang)}</div>
        <Toggle checked={state.gracePeriod} onChange={v => setState(s => ({ ...s, gracePeriod: v }))} label={w("Enable grace period","Habilitar período de gracia",lang)} />
        {state.gracePeriod && (
          <div style={{ marginLeft: 54, display: "flex", alignItems: "center", gap: 10, marginTop: -4 }}>
            <Input type="number" min={1} max={365} value={state.graceDays} onChange={e => setState(s => ({ ...s, graceDays: Math.max(1, parseInt(e.target.value) || 7) }))} style={{ width: 80, fontSize: 13 }} />
            <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>{w("days","días",lang)}</span>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Onboarding Acceptance","Aceptación de Incorporación",lang)}</div>
        <Toggle checked={state.requireAcceptance} onChange={v => setState(s => ({ ...s, requireAcceptance: v }))} label={w("Require convention acceptance","Requerir aceptación de la convención",lang)} />
        <div style={{ marginTop: 6, padding: "10px 12px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 11, color: "#1E40AF" }}>
          {w("Every new team member must click 'I understand and accept' before uploading. Acceptance is timestamped and permanently recorded.","Cada nuevo miembro debe hacer clic en 'Entiendo y acepto' antes de cargar. La aceptación queda registrada permanentemente.",lang)}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("Convention Template","Plantilla de Convención",lang)}</div>
        <Toggle checked={state.saveAsTemplate} onChange={v => setState(s => ({ ...s, saveAsTemplate: v }))} label={w("Save as template","Guardar como plantilla",lang)} />
        {state.saveAsTemplate && (
          <div style={{ marginLeft: 54, marginTop: -4 }}>
            <Input value={state.templateName} onChange={e => setState(s => ({ ...s, templateName: e.target.value }))} placeholder={w("Template name…","Nombre de la plantilla…",lang)} style={{ fontSize: 13 }} />
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{w("File Extensions by Discipline","Extensiones por Disciplina",lang)}</div>
        <div style={{ marginBottom: 8, padding: "10px 12px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 11, color: "#1E40AF" }}>
          <strong>{w("Note:","Nota:",lang)}</strong> {w("Extensions (.rvt, .dwg, .pdf, etc.) are NOT part of the naming convention. They are determined by the software format. BIMLog validates only the filename before the extension.","Las extensiones (.rvt, .dwg, .pdf) NO son parte de la convención. Las determina el formato del software. BIMLog valida solo el nombre sin la extensión.",lang)}
        </div>
        <Toggle checked={state.enableExtRestrictions} onChange={v => setState(s => ({ ...s, enableExtRestrictions: v }))} label={w("Enable file type restrictions per discipline","Habilitar restricciones por disciplina",lang)} />
        {state.enableExtRestrictions && selectedDiscs.length > 0 && (
          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid hsl(var(--border))", fontWeight: 700, fontSize: 11 }}>{w("Discipline","Disciplina",lang)}</th>
                  {FILE_EXTENSIONS.map(ext => <th key={ext} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid hsl(var(--border))", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>{ext}</th>)}
                </tr>
              </thead>
              <tbody>
                {selectedDiscs.map(d => (
                  <tr key={d.id}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid hsl(var(--border))", fontWeight: 600, fontSize: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "1px 5px", borderRadius: 3, marginRight: 5 }}>{d.code}</span>{d.name}
                    </td>
                    {FILE_EXTENSIONS.map(ext => {
                      const allowed = state.extRestrictions[d.code]?.includes(ext) ?? false;
                      return <td key={ext} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid hsl(var(--border))" }}>
                        <input type="checkbox" checked={allowed} onChange={e => setState(s => { const cur = s.extRestrictions[d.code] || []; return { ...s, extRestrictions: { ...s.extRestrictions, [d.code]: e.target.checked ? [...cur, ext] : cur.filter(x => x !== ext) } }; })} style={{ width: 13, height: 13, accentColor: "#2563EB", cursor: "pointer" }} />
                      </td>;
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
function ReviewScreen({ state, onEdit, onSave, isSaving, saved, savedMessage, lang, projectId }: {
  state: WizardState; onEdit: (step: number) => void; onSave: () => void; isSaving: boolean; saved: boolean; savedMessage: string; lang: string; projectId: number;
}) {
  const levels = state.levelList.map(l => l.code);
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
    win.document.write(`<!DOCTYPE html><html><head><title>Naming Convention</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;color:#111}h1{font-size:22px}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}.sample{font-family:monospace;font-size:20px;font-weight:900;background:#EFF6FF;padding:12px 16px;border-radius:6px;margin:12px 0;word-break:break-all}.chips{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.chip{font-family:monospace;font-size:11px;font-weight:700;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;padding:2px 7px;border-radius:4px}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px}.sig{margin-top:60px;border-top:1px solid #999;padding-top:12px;font-size:12px;color:#666}@media print{body{margin:20px}}</style></head><body>
<h1>BIMLog — Naming Convention</h1>
<div style="font-size:13px;color:#666;margin-bottom:16px;">Project ID: ${projectId} | Generated: ${new Date().toLocaleDateString()}</div>
<div class="sample">${sampleName}</div>
<h2>Summary</h2>
<div class="row"><span>Separator</span><span><strong>${sep === "-" ? "Hyphen (-)" : "Underscore (_)"}</strong></span></div>
<div class="row"><span>Enforce Uppercase</span><span><strong>${state.enforceUppercase ? "Yes" : "No"}</strong></span></div>
<div class="row"><span>Sequence Format</span><span><strong>${state.seqDigits} digits</strong></span></div>
<div class="row"><span>Revision Format</span><span><strong>${state.revisionFormat}</strong></span></div>
<div class="row"><span>Grace Period</span><span><strong>${state.gracePeriod ? `${state.graceDays} days (until ${graceTo})` : "Off"}</strong></span></div>
<h2>Companies</h2><div class="chips">${state.companies.map(c=>`<span class="chip">${c.code} — ${c.name}</span>`).join("")}</div>
<h2>Disciplines</h2><div class="chips">${selectedDiscs.map(d=>`<span class="chip">${d.code} — ${d.name}</span>`).join("")}</div>
<h2>Building Levels (${levels.length})</h2><div class="chips">${levels.map(l=>`<span class="chip">${l}</span>`).join("")}</div>
<h2>Document Types (${selectedDocs.length})</h2><div class="chips">${selectedDocs.map(d=>`<span class="chip">${d.code} — ${d.name}</span>`).join("")}</div>
<h2>Status Codes</h2><div class="chips">${selectedStatus.map(sc=>`<span class="chip">${sc.code} — ${sc.meaning}</span>`).join("")}</div>
<h2>Revision Codes</h2><div class="chips">${revCodes.map(r=>`<span class="chip">${r}</span>`).join("")}</div>
<div class="sig"><p>I have read and understood the naming convention for this project.</p><br/><p>Name: _____________________________ &nbsp;&nbsp; Company: _____________________________</p><br/><p>Signature: _________________________ &nbsp;&nbsp; Date: ________________________________</p></div>
</body></html>`);
    win.document.close(); win.print();
  };

  const sections = [
    { title: w("Companies / Originators","Empresas / Originadores",lang), step: 0, chips: state.companies.map(c => c.code) },
    { title: w("Disciplines","Disciplinas",lang), step: 1, chips: selectedDiscs.map(d => d.code) },
    { title: w("Building Levels","Niveles del Edificio",lang), step: 1, chips: levels },
    { title: w("Document Types","Tipos de Documentos",lang), step: 2, chips: selectedDocs.map(d => d.code) },
    { title: w("Status Codes","Códigos de Estado",lang), step: 2, chips: selectedStatus.map(sc => sc.code) },
    { title: w("Revision Codes","Códigos de Revisión",lang), step: 3, chips: revCodes },
  ];

  return (
    <div>
      <SectionTitle title={w("Review your convention before saving","Revisa tu convención antes de guardar",lang)} />
      {saved && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#166534" }}>
          <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0 }} />{savedMessage}
        </div>
      )}
      <Card style={{ marginBottom: 16, background: "#F0F7FF", border: "1px solid #BFDBFE" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{w("Sample File Name","Nombre de Archivo de Muestra",lang)}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 900, color: "#0F1623", wordBreak: "break-all", lineHeight: 1.3 }}>{sampleName}</div>
        <div style={{ marginTop: 10, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{w("File extensions are not part of the convention — determined by software format.","Las extensiones no son parte de la convención — las determina el formato del software.",lang)}</div>
      </Card>
      {sections.map(sec => (
        <Card key={sec.title} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{sec.title}</span>
            <button onClick={() => onEdit(sec.step)} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", border: "1px solid hsl(var(--border))", borderRadius: 5, cursor: "pointer", background: "hsl(var(--card))", display: "flex", alignItems: "center", gap: 4 }}>
              <Edit2 style={{ width: 11, height: 11 }} />{w("Edit","Editar",lang)}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sec.chips.length > 0
              ? sec.chips.map((chip, i) => { const c = CHIP_COLORS[i % CHIP_COLORS.length]; return <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "2px 7px", borderRadius: 4 }}>{chip}</span>; })
              : <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("None selected","Ninguno seleccionado",lang)}</span>
            }
          </div>
        </Card>
      ))}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{w("Full Summary","Resumen Completo",lang)}</div>
        {[
          [w("Total fields","Total de campos",lang), "8"],
          [w("Separator","Separador",lang), sep === "-" ? "Hyphen (-)" : "Underscore (_)"],
          [w("Enforce uppercase","Mayúsculas obligatorias",lang), state.enforceUppercase ? w("Yes","Sí",lang) : "No"],
          [w("Companies","Empresas",lang), `${state.companies.length}`],
          [w("Disciplines","Disciplinas",lang), `${selectedDiscs.length} ${w("selected","seleccionadas",lang)}`],
          [w("Levels","Niveles",lang), `${levels.length} ${w("total","total",lang)}`],
          [w("Document types","Tipos de documentos",lang), `${selectedDocs.length} ${w("selected","seleccionados",lang)}`],
          [w("Sequence format","Formato de secuencia",lang), `${state.seqDigits} ${w("digits","dígitos",lang)}`],
          [w("Status codes","Códigos de estado",lang), `${selectedStatus.length} ${w("defined","definidos",lang)}`],
          [w("Revision format","Formato de revisión",lang), state.revisionFormat],
          [w("Grace period","Período de gracia",lang), state.gracePeriod ? `${state.graceDays} ${w("days","días",lang)}` : w("Off","Inactivo",lang)],
          [w("Onboarding acceptance","Aceptación de incorporación",lang), state.requireAcceptance ? w("Required","Requerida",lang) : w("Not required","No requerida",lang)],
          [w("Template","Plantilla",lang), state.saveAsTemplate && state.templateName ? state.templateName : w("Not saved","No guardada",lang)],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid hsl(var(--border))", fontSize: 12 }}>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </Card>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={onSave} disabled={isSaving} style={{ flex: 1, gap: 6, fontSize: 14, fontWeight: 700, height: 44 }}>
          {isSaving ? w("Saving…","Guardando…",lang) : w("Save Convention","Guardar Convención",lang)}
        </Button>
        <Button variant="outline" onClick={handleExportPDF} style={{ gap: 6, fontSize: 13, height: 44 }}>
          <Download style={{ width: 14, height: 14 }} />{w("Export PDF","Exportar PDF",lang)}
        </Button>
      </div>
    </div>
  );
}

// ─── suggestion data helpers ──────────────────────────────────────────────────
const SUGGEST_DOC_TYPES = DOC_TYPE_CATEGORIES.flatMap(cat =>
  cat.types.map(t => ({ code: t.code, label: `${t.code} — ${t.name}` }))
);
const SUGGEST_DISCIPLINES = DEFAULT_DISCIPLINES.map(d => ({ code: d.code, label: `${d.code} — ${d.name}` }));
const SUGGEST_STATUS = DEFAULT_STATUS.map(s => ({ code: s.code, label: `${s.code} — ${s.meaning}` }));
const SUGGEST_LEVELS = [
  "B5","B4","B3","B2","B1","G0","G1","L1","L2","L3","L4","L5","L6","L7","L8","L9","L10",
  "L11","L12","L13","L14","L15","L16","L17","L18","L19","L20","L25","L30","L40","L50",
  "MEZ1","MEZ2","MEZ3","MER","MER2","PH","PH1","PH2","RF","RF2","SKY","ZZ","XX","HALF",
].map(c => ({ code: c, label: c }));
const SUGGEST_REVISIONS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P",
  "P01","P02","P03","P04","P05","C01","C02","C03","C04","S0","S1","S2","S3","R1","R2","R3",
].map(c => ({ code: c, label: c }));
const SUGGEST_SEQ = ["001","002","003","0001","0002","0003","0004","0005","0006","0007","0008","0009","0010"].map(c => ({ code: c, label: c }));

function getFieldSuggestions(label: string): { type: "chips"; items: { code: string; label: string }[] } | { type: "note"; text: string } {
  const l = label.toLowerCase();
  if (/type|document|doc/.test(l))      return { type: "chips", items: SUGGEST_DOC_TYPES };
  if (/discipline/.test(l))             return { type: "chips", items: SUGGEST_DISCIPLINES };
  if (/level|floor/.test(l))            return { type: "chips", items: SUGGEST_LEVELS };
  if (/status|suitability/.test(l))     return { type: "chips", items: SUGGEST_STATUS };
  if (/revision|rev/.test(l))           return { type: "chips", items: SUGGEST_REVISIONS };
  if (/sequence|seq/.test(l))           return { type: "chips", items: SUGGEST_SEQ };
  if (/originator|company|code/.test(l)) return { type: "note", text: "Enter your company codes (e.g. BIM, ACM, JMP). Each company that submits files needs a unique code." };
  return { type: "note", text: `Enter comma-separated values for the "${label}" field (e.g. AA, BB, CC).` };
}

// ─── smart suggest input ──────────────────────────────────────────────────────
function SmartSuggestInput({ value, onChange, fieldLabel, lang }: {
  value: string; onChange: (v: string) => void; fieldLabel: string; lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestion = getFieldSuggestions(fieldLabel);

  // parse current comma-separated values into a Set for quick lookup
  const currentSet = new Set(
    value.split(",").map(v => v.trim()).filter(Boolean).map(v => v.toUpperCase())
  );

  const toggle = (code: string) => {
    const upper = code.toUpperCase();
    const arr = value.split(",").map(v => v.trim()).filter(Boolean);
    const idx = arr.findIndex(v => v.toUpperCase() === upper);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(code);
    }
    onChange(arr.join(", "));
  };

  // filtered items for chip suggestions
  const filteredItems = suggestion.type === "chips"
    ? (search.trim()
        ? suggestion.items.filter(it => it.label.toLowerCase().includes(search.toLowerCase()))
        : suggestion.items)
    : [];

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && suggestion.type === "chips") {
      setTimeout(() => searchRef.current?.focus(), 60);
    }
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        style={{
          width: "100%", height: 36, fontSize: 12, fontFamily: "var(--font-mono)",
          padding: "0 10px", borderRadius: 6,
          border: open ? "1px solid #2563EB" : "1px solid hsl(var(--border))",
          background: "hsl(var(--card))", color: "hsl(var(--foreground))",
          outline: "none", boxSizing: "border-box",
          boxShadow: open ? "0 0 0 2px #BFDBFE" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 2000,
          background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
          borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
          overflow: "hidden", minWidth: 320,
        }}>
          {suggestion.type === "note" ? (
            <div style={{ padding: "14px 16px", fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
                {w("Tip", "Consejo", lang)}
              </div>
              {suggestion.text}
            </div>
          ) : (
            <>
              {/* search + count header */}
              <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Escape" && (setOpen(false), setSearch(""))}
                  placeholder={w("Search suggestions…", "Buscar sugerencias…", lang)}
                  style={{
                    flex: 1, height: 28, fontSize: 12, padding: "0 8px",
                    border: "1px solid hsl(var(--border))", borderRadius: 5,
                    background: "hsl(var(--secondary))", color: "hsl(var(--foreground))",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                  {currentSet.size} {w("selected", "sel.", lang)} · {filteredItems.length} {w("shown", "visibles", lang)}
                </span>
              </div>
              {/* instruction line */}
              <div style={{ padding: "5px 12px", fontSize: 10, color: "hsl(var(--muted-foreground))", background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
                {w("Click to add or remove from the allowed values list. Already included values are highlighted.", "Clic para agregar o quitar de los valores permitidos.", lang)}
              </div>
              {/* chip grid */}
              <div style={{ maxHeight: 260, overflowY: "auto", padding: "10px 10px" }}>
                {filteredItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "12px", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    {w("No matches", "Sin coincidencias", lang)}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {filteredItems.map(it => {
                      const selected = currentSet.has(it.code.toUpperCase());
                      return (
                        <button
                          key={it.code}
                          onMouseDown={e => { e.preventDefault(); toggle(it.code); }}
                          title={it.label}
                          style={{
                            padding: "4px 9px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            border: `1px solid ${selected ? "#2563EB" : "hsl(var(--border))"}`,
                            background: selected ? "#EFF6FF" : "hsl(var(--secondary))",
                            color: selected ? "#1D4ED8" : "hsl(var(--foreground))",
                            display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          {selected && <span style={{ fontSize: 9 }}>✓</span>}
                          {it.code}
                          <span style={{ fontSize: 9, fontWeight: 400, color: selected ? "#1D4ED8" : "hsl(var(--muted-foreground))", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.label.includes("—") ? it.label.split("—")[1].trim() : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* close button */}
              <div style={{ padding: "8px 10px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onMouseDown={e => { e.preventDefault(); setOpen(false); setSearch(""); }}
                  style={{ fontSize: 11, padding: "4px 12px", borderRadius: 5, border: "1px solid hsl(var(--border))", background: "hsl(var(--secondary))", cursor: "pointer", color: "hsl(var(--foreground))" }}
                >
                  {w("Done", "Listo", lang)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── edit mode ────────────────────────────────────────────────────────────────
function EditMode({ convention, onRunWizard, lang, projectId }: { convention: any; onRunWizard: () => void; lang: string; projectId: number; }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fields, setFields] = useState(
    [...convention.fields].sort((a: any, b: any) => a.fieldOrder - b.fieldOrder)
      .map((f: any) => ({ ...f, values: (f.allowedValues || []).join(", ") }))
  );
  const { mutate, isPending } = useUpsertConvention({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] }); toast({ title: w("Convention updated","Convención actualizada",lang) }); },
      onError: () => toast({ title: "Error saving", variant: "destructive" }),
    },
  });
  const handleSave = () => {
    const sep = convention.separator;
    const conflicts = fields.flatMap((f) =>
      f.values.split(",").map((v: string) => v.trim()).filter((v: string) => v.includes(sep)).map((v: string) => `"${v}" in ${f.label}`)
    );
    if (conflicts.length > 0) {
      toast({ title: w("Warning: values contain separator","Advertencia: valores contienen separador",lang), description: `${conflicts.join(", ")} — ${w("these values contain the separator character","estos valores contienen el separador"," ")}  "${sep}". ${w("File names will still validate correctly.","Los nombres de archivo se validarán correctamente.",lang)}`, variant: "destructive" });
    }
    mutate({ projectId, data: { separator: convention.separator, isActive: convention.isActive, fields: fields.map((f, i) => ({ label: f.label, fieldOrder: i, allowedValues: f.values.split(",").map((v: string) => v.trim()).filter(Boolean) })) } });
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{w("Naming Convention","Convención de Nombres",lang)}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{w("Edit fields inline. Drag to reorder.","Edita campos en línea. Arrastra para reordenar.",lang)}</div>
        </div>
        <Button variant="outline" onClick={onRunWizard} style={{ gap: 6, fontSize: 12 }}>
          <RotateCcw style={{ width: 13, height: 13 }} />{w("Re-run setup wizard","Reejecutar asistente",lang)}
        </Button>
      </div>

      {/* Live Preview */}
      {(() => {
        const sep = convention.separator || "-";
        const previewTokens = fields.map((f: any) => {
          const first = f.values.split(",").map((v: string) => v.trim()).filter(Boolean)[0] || f.label;
          return first;
        });
        const previewName = previewTokens.join(sep);
        return (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              {w("Live Preview","Vista previa en vivo",lang)}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "#1E3A5F", wordBreak: "break-all", marginBottom: 8 }}>
              {previewName || <span style={{ fontStyle: "italic", fontWeight: 400, color: "#94A3B8" }}>{w("Add fields to see preview","Agrega campos para ver la vista previa",lang)}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
              {previewTokens.map((tok: string, i: number) => {
                const c = CHIP_COLORS[i % CHIP_COLORS.length];
                return (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <span title={fields[i]?.label} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "2px 7px", borderRadius: 4, cursor: "default" }}>
                      {tok}
                    </span>
                    {i < previewTokens.length - 1 && (
                      <span style={{ color: "#CBD5E1", fontSize: 13, fontFamily: "var(--font-mono)" }}>{sep}</span>
                    )}
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "#64748B" }}>
              {w(`${fields.length} field${fields.length === 1 ? "" : "s"} · separator: "${sep}"`,`${fields.length} campo${fields.length === 1 ? "" : "s"} · separador: "${sep}"`,lang)}
            </div>
          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px 24px 1fr 2fr 28px", gap: 8, paddingLeft: 4, paddingRight: 4, marginBottom: 4 }}>
          <div /><div />
          <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{w("Field Label","Etiqueta",lang)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>{w("Allowed Values (comma-separated)","Valores permitidos",lang)}</div>
          <div />
        </div>
        {fields.map((f, idx) => {
          const c = CHIP_COLORS[idx % CHIP_COLORS.length];
          return (
            <div key={f.id ?? idx} style={{ display: "grid", gridTemplateColumns: "24px 24px 1fr 2fr 28px", gap: 8, alignItems: "center", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "10px 10px" }}>
              <div style={{ cursor: "grab", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}><GripVertical style={{ width: 14, height: 14 }} /></div>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{idx + 1}</span>
              <Input value={f.label} onChange={e => setFields(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} style={{ fontSize: 13 }} />
              <SmartSuggestInput
                value={f.values}
                onChange={v => setFields(prev => prev.map((x, i) => i === idx ? { ...x, values: v } : x))}
                fieldLabel={f.label}
                lang={lang}
              />
              <button onClick={() => setFields(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))", borderRadius: 4 }} onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
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

  const { token } = useAuthStore();
  const initDisciplines = (): DisciplineEntry[] => DEFAULT_DISCIPLINES.map(d => ({ ...d, id: uid(), selected: true }));
  const initDocTypes    = (): DocTypeEntry[] => DOC_TYPE_CATEGORIES.flatMap(cat => cat.types.map(t => ({ ...t, id: uid(), category: cat.cat, selected: false })));
  const initStatusCodes = (): StatusEntry[] => DEFAULT_STATUS.map(sc => ({ ...sc, id: uid(), selected: true }));
  const initLevelList   = (): LevelEntry[] => buildLevelList(10, 1, true, "G0", true, "RF", true);

  const [ws, setWs] = useState<WizardState>(() => ({
    step: 0,
    companies: user ? [{ id: uid(), name: user.companyName, code: user.companyName.slice(0,3).toUpperCase() }] : [],
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
    levelList: initLevelList(),
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
    flowPhase: "setup_context",
    setupCtx: defaultSetupCtx(),
    discoveryResult: null,
    reanalysisResult: null,
    industrialState: defaultIndustrialState(),
    importState: defaultImportState(),
    userGuidance: "",
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (user && ws.companies.length === 0) {
      setWs(s => ({ ...s, companies: [{ id: uid(), name: user.companyName, code: user.companyName.slice(0,3).toUpperCase() }] }));
    }
  }, [user]);

  const { mutate } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/conventions`] });
        const graceTo = ws.gracePeriod ? new Date(Date.now() + ws.graceDays * 86400000).toLocaleDateString() : null;
        const msg = graceTo
          ? w(`Convention saved. Grace period active until ${graceTo}. Violations will be flagged but not rejected until then.`, `Convención guardada. Período de gracia activo hasta ${graceTo}.`, lang)
          : w("Convention saved. Enforcing all uploads immediately.", "Convención guardada. Aplicada a todas las cargas de inmediato.", lang);
        setSavedMessage(msg); setSaved(true); setIsSaving(false);
      },
      onError: () => { toast({ title: "Error saving convention", variant: "destructive" }); setIsSaving(false); },
    },
  });

  const handleSave = () => {
    const levels = ws.levelList.map(l => l.code);
    const selectedDiscs  = ws.disciplines.filter(d => d.selected);
    const selectedDocs   = ws.docTypes.filter(d => d.selected);
    const selectedStatus = ws.statusCodes.filter(sc => sc.selected);
    const revCodes = buildRevisionCodes(ws.revisionFormat, ws.customRevisions);
    const seqVals  = Array.from({ length: Math.min(10, Math.pow(10, ws.seqDigits) - 1) }, (_, i) => String(i + 1).padStart(ws.seqDigits, "0"));
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

  if (isLoading) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}</div>;
  if (isError) return <div style={{ textAlign: "center", padding: "48px 24px" }}><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{w("Failed to load convention data","Error al cargar la convención",lang)}</div><Button variant="outline" onClick={() => refetch()}>{w("Retry","Reintentar",lang)}</Button></div>;

  const hasExisting = convention && convention.fields && convention.fields.length > 0;

  // ── routing logic: determine the next phase after Step 0 ──────────────────
  function handleSetupContinue() {
    const ctx = ws.setupCtx;
    const intent = ctx.builderIntent;
    const env = ctx.projectEnvironment;
    const isAnalyze = ctx.analysisOnlyMode || intent === "analyze_existing" || intent === "mirror_existing" || ctx.setupContextChoice === "takeover" || ctx.setupContextChoice === "analyze_first";
    if (isAnalyze) { setWs(s => ({ ...s, flowPhase: "import_structure" })); return; }
    if (env === "industrial_epc") { setWs(s => ({ ...s, flowPhase: "industrial_discovery" })); return; }
    setWs(s => ({ ...s, flowPhase: "main_wizard", step: 0 }));
  }

  const [showHistory, setShowHistory] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<ConventionVersionSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/versions`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) setHistoryVersions((await res.json()) as ConventionVersionSnapshot[]);
    } catch { /* silent */ }
    setHistoryLoading(false);
  }

  async function saveVersionSnapshot(summary: string) {
    const dr = ws.discoveryResult;
    if (!dr) return;
    try {
      await fetch(`${API_BASE_CB}/api/v1/projects/${projectId}/convention/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          acceptedDisciplines: (dr.suggestedDisciplines || []).filter(d => d.confidence !== "low").map(d => ({ code: d.code || d.key || "", label: d.label })),
          acceptedSystems: (dr.suggestedSystems || []).filter(d => d.confidence !== "low").map(d => ({ code: d.code || d.key || "", label: d.label })),
          acceptedDocTypes: (dr.suggestedDocTypes || []).filter(d => d.confidence !== "low").map(d => ({ code: d.code || d.key || "", label: d.label })),
          acceptedExtraFields: (dr.suggestedExtraFields || []).filter(d => d.confidence !== "low").map(d => ({ key: d.key || d.code || "", label: d.label })),
          acceptedFieldOrder: dr.suggestedFieldOrder || [],
          analysisSummary: dr.analysisSummary,
          ambiguities: dr.ambiguities || [],
          changeSummary: summary,
          userGuidance: ws.userGuidance || null,
        }),
      });
    } catch { /* non-critical */ }
  }

  const { flowPhase } = ws;

  // ── Setup Context (front door) ────────────────────────────────────────────
  if (flowPhase === "setup_context") {
    return <Step0_SetupContext state={ws} setState={setWs} onContinue={handleSetupContinue} />;
  }

  // ── Industrial Structure Discovery ────────────────────────────────────────
  if (flowPhase === "industrial_discovery") {
    return (
      <IndustrialDiscovery
        state={ws} setState={setWs}
        onBack={() => setWs(s => ({ ...s, flowPhase: "setup_context" }))}
        onContinue={() => setWs(s => ({ ...s, flowPhase: "main_wizard", step: 0 }))}
      />
    );
  }

  // ── Import Existing Structure ─────────────────────────────────────────────
  if (flowPhase === "import_structure") {
    return (
      <ImportStructure
        state={ws} setState={setWs}
        token={token ?? ""}
        projectId={projectId}
        onBack={() => setWs(s => ({ ...s, flowPhase: "setup_context" }))}
        onResult={() => setWs(s => ({ ...s, flowPhase: "ai_suggestions" }))}
      />
    );
  }

  // ── AI Suggestions review ─────────────────────────────────────────────────
  if (flowPhase === "ai_suggestions") {
    return (
      <AISuggestions
        state={ws} setState={setWs}
        onBack={() => setWs(s => ({ ...s, flowPhase: "import_structure" }))}
        onContinueToWizard={() => {
          saveVersionSnapshot("Initial convention setup — accepted from AI discovery");
          setWs(s => ({ ...s, flowPhase: "main_wizard", step: 0 }));
        }}
        onStopHere={() => {
          saveVersionSnapshot("Initial convention setup — accepted in analysis-only mode");
        }}
      />
    );
  }

  // ── Add More Evidence and Re-run Discovery ────────────────────────────────
  if (flowPhase === "re_evidence") {
    return (
      <ReEvidenceIntake
        state={ws} setState={setWs}
        token={token ?? ""}
        projectId={projectId}
        onBack={() => setWs(s => ({ ...s, flowPhase: "main_wizard" }))}
        onResult={result => setWs(s => ({ ...s, reanalysisResult: result, flowPhase: "changes_review" }))}
      />
    );
  }

  // ── Convention Changes Review ─────────────────────────────────────────────
  if (flowPhase === "changes_review") {
    return (
      <ChangesReview
        state={ws}
        token={token ?? ""}
        projectId={projectId}
        userGuidance={ws.userGuidance}
        onGuidanceChange={g => setWs(s => ({ ...s, userGuidance: g }))}
        onAccept={() => setWs(s => ({ ...s, flowPhase: "main_wizard", reanalysisResult: null }))}
        onDiscard={() => setWs(s => ({ ...s, flowPhase: "main_wizard", reanalysisResult: null }))}
      />
    );
  }

  // ── Main wizard (existing steps) ──────────────────────────────────────────
  const step = ws.step;
  return (
    <div>
      <ProgressBar step={step} />
      {step === 0 && <Step1 state={ws} setState={setWs} lang={lang} />}
      {step === 1 && <Step2 state={ws} setState={setWs} lang={lang} />}
      {step === 2 && <Step3 state={ws} setState={setWs} lang={lang} />}
      {step === 3 && <Step4 state={ws} setState={setWs} lang={lang} />}
      {step === 4 && <ReviewScreen state={ws} onEdit={s => setWs(prev => ({ ...prev, step: s }))} onSave={handleSave} isSaving={isSaving} saved={saved} savedMessage={savedMessage} lang={lang} projectId={projectId} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 18, borderTop: "1px solid hsl(var(--border))" }}>
        <div>
          {step === 0
            ? <Button variant="outline" onClick={() => setWs(s => ({ ...s, flowPhase: "setup_context" }))} style={{ gap: 6, fontSize: 13 }}><ChevronLeft style={{ width: 15, height: 15 }} />{w("Back to Setup","Volver",lang)}</Button>
            : <Button variant="outline" onClick={() => setWs(s => ({ ...s, step: s.step - 1 }))} style={{ gap: 6, fontSize: 13 }}><ChevronLeft style={{ width: 15, height: 15 }} />{w("Back","Atrás",lang)}</Button>
          }
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="outline" onClick={() => setWs(s => ({ ...s, importState: { sampleNames: "", rawFolderText: "", rawIndexText: "", rawNotes: "", analyzing: false, error: "", extractionWarning: "", uploadedFiles: [] }, flowPhase: "re_evidence" }))} style={{ gap: 6, fontSize: 13 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Add More Evidence and Re-run Discovery
          </Button>
          {step < 4 && <Button onClick={() => setWs(s => ({ ...s, step: s.step + 1 }))} style={{ gap: 6, fontSize: 13 }}>{step === 3 ? w("Go to Review","Ir a Revisión",lang) : w("Next","Siguiente",lang)}<ChevronRight style={{ width: 15, height: 15 }} /></Button>}
        </div>
      </div>

      <div style={{ marginTop: 28, borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
        <button
          type="button"
          onClick={() => { if (!showHistory) loadHistory(); setShowHistory(h => !h); }}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6B7280", fontSize: 13 }}
        >
          <Clock style={{ width: 14, height: 14 }} />
          <span style={{ fontWeight: 600 }}>Convention History</span>
          {showHistory ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
        </button>

        {showHistory && (
          <div style={{ marginTop: 14 }}>
            {historyLoading && <div style={{ fontSize: 12, color: "#9CA3AF" }}>Loading history...</div>}
            {!historyLoading && historyVersions.length === 0 && (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>No saved versions yet. Versions are created when you accept a discovery or re-analysis result.</div>
            )}
            {!historyLoading && historyVersions.map(v => (
              <div key={v.id} style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ background: "#EFF6FF", color: "#2563EB", fontWeight: 700, fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>Version {v.conventionVersion}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {v.changeSummary && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{v.changeSummary}</div>}
                {v.analysisSummary && <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{v.analysisSummary}</div>}
                {v.acceptedDisciplines.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#6B7280" }}>
                    <strong>Disciplines:</strong> {v.acceptedDisciplines.map(d => d.code).join(", ")}
                  </div>
                )}
                {v.acceptedDocTypes.length > 0 && (
                  <div style={{ fontSize: 11, color: "#6B7280" }}>
                    <strong>Document types:</strong> {v.acceptedDocTypes.map(d => d.code).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
