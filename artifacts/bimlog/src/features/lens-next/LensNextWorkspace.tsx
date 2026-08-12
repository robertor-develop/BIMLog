import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuthStore } from "../../store/auth";
import { LensNextPanel } from "./LensNextPanel";
import { normalizeLensNextProjects } from "./lens-next-model";
import {
  getLensNextBridgeSessionSnapshot,
  subscribeLensNextBridgeSession,
} from "./lens-next-session";
import type { LensNextProjectOption } from "./lens-next-types";

function asProjectOptions(value: unknown): readonly LensNextProjectOption[] {
  if (!Array.isArray(value)) return [];
  return normalizeLensNextProjects(
    value.flatMap((candidate): LensNextProjectOption[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const record = candidate as Record<string, unknown>;
      if (!Number.isInteger(record.id) || typeof record.name !== "string")
        return [];
      return [
        {
          id: record.id as number,
          name: record.name,
          code: typeof record.code === "string" ? record.code : null,
        },
      ];
    }),
  );
}

export function LensNextWorkspace() {
  const token = useAuthStore((state) => state.token);
  const { data, isLoading, isError } = useListProjects();
  const projects = useMemo(() => asProjectOptions(data), [data]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const bridgeSession = useSyncExternalStore(
    subscribeLensNextBridgeSession,
    getLensNextBridgeSessionSnapshot,
    () => null,
  );

  useEffect(() => {
    setSelectedProjectId((current) => {
      if (
        current !== null &&
        projects.some((project) => project.id === current)
      )
        return current;
      return projects[0]?.id ?? null;
    });
  }, [projects]);

  if (isLoading) {
    return (
      <main className="lens-next-route-state">
        Loading authorized BIMLog projects…
      </main>
    );
  }

  if (isError) {
    return (
      <main className="lens-next-route-state" role="alert">
        Authorized projects could not be loaded.
      </main>
    );
  }

  if (!token || projects.length === 0) {
    return (
      <main className="lens-next-route-state" role="alert">
        No authorized BIMLog project is available.
      </main>
    );
  }

  return (
    <LensNextPanel
      projects={projects}
      selectedProjectId={selectedProjectId}
      onProjectChange={setSelectedProjectId}
      authToken={token}
      bridgeSessionToken={bridgeSession?.token ?? ""}
    />
  );
}
