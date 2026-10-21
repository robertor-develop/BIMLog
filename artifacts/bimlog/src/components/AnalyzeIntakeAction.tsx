import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { analyzeIntakeHref, type AnalyzeIntakeEntryPoint } from "@/lib/analyze-intake-entry-points";

export function AnalyzeIntakeAction({ projectId, source, sourceId, spanish = false }: { projectId: number; source: AnalyzeIntakeEntryPoint; sourceId?: string | number; spanish?: boolean }) {
  return <Link className="btn" href={analyzeIntakeHref(projectId, source, sourceId)} aria-label={spanish ? "Analizar e ingresar en la cola canónica" : "Analyze and Intake into the canonical queue"}>
    <Sparkles size={15} /> {spanish ? "Analizar e ingresar" : "Analyze & Intake"}
  </Link>;
}
