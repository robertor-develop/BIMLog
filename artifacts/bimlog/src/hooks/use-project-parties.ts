import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import type { ProjectParty } from "@/lib/project-party-options";

export function useProjectParties(projectId: number) {
  const { token } = useAuthStore();
  const [result, setResult] = useState<{ projectId: number; entries: ProjectParty[]; state: "loading" | "ready" | "error" }>({ projectId, entries: [], state: "loading" });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/v1${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 403 ? "Project directory access denied / Acceso al directorio denegado" : "Project directory request failed / Falló la solicitud del directorio");
    return response.json();
  }, [token]);
  useEffect(() => {
    let current = true;
    setResult({ projectId, entries: [], state: "loading" });
    request(`/projects/${projectId}/directory`).then(entries => {
      if (!Array.isArray(entries)) throw new Error("Invalid directory response");
      if (current) setResult({ projectId, entries, state: "ready" });
    }).catch(() => { if (current) setResult({ projectId, entries: [], state: "error" }); });
    return () => { current = false; };
  }, [projectId, request, revision]);
  return { entries: result.projectId === projectId ? result.entries : [], state: result.projectId === projectId ? result.state : "loading" as const, refresh, request };
}
