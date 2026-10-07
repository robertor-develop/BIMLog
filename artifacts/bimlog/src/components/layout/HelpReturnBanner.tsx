import { BookOpen } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { safeHelpResumeTarget } from "@/lib/task-journeys";

export function HelpReturnBanner({ projectId }: { projectId: number }) {
  const { lang } = useI18n();
  const resume = safeHelpResumeTarget(new URLSearchParams(useSearch()).get("helpReturn"), projectId);
  if (!resume) return null;
  const es = lang === "es";
  return (
    <aside className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950" aria-label={es ? "Regreso a Ayuda" : "Return to Help"}>
      <span className="flex items-center gap-2"><BookOpen aria-hidden="true" className="h-4 w-4" />{es ? "Abriste este espacio desde una guía de BIMLog." : "You opened this workspace from a BIMLog guide."}</span>
      <Link className="font-semibold underline underline-offset-2" href={resume}>{es ? "Volver al paso de la guía" : "Return to guide step"}</Link>
    </aside>
  );
}
