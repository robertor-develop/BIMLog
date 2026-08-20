import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { useAuthStore } from "../../store/auth";
import { LensNextPanel } from "./LensNextPanel";
import {
  bootstrapLensNextBridgeSession,
  createLensNextBridgeClient,
} from "./lens-next-client";
import {
  lensNextLaunchModeFromSearch,
  resolveLensNextLaunchProject,
} from "./lens-next-launch-binding";
import { normalizeLensNextProjects } from "./lens-next-model";
import {
  clearLensNextBridgeSession,
  getLensNextBridgeSessionSnapshot,
  injectLensNextBridgeSession,
  subscribeLensNextBridgeSession,
} from "./lens-next-session";
import type {
  LensNextBridgeProjectContext,
  LensNextProjectOption,
} from "./lens-next-types";

function asProjectOptions(value: unknown): readonly LensNextProjectOption[] {
  if (!Array.isArray(value)) return [];
  return normalizeLensNextProjects(
    value.flatMap((candidate): LensNextProjectOption[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const record = candidate as Record<string, unknown>;
      if (!Number.isInteger(record.id) || typeof record.name !== "string")
        return [];
      return [{
        id: record.id as number,
        name: record.name,
        code: typeof record.code === "string" ? record.code : null,
      }];
    }),
  );
}

export function LensNextWorkspace() {
  const token = useAuthStore((state) => state.token);
  const { data, isLoading, isError } = useListProjects();
  const projects = useMemo(() => asProjectOptions(data), [data]);
  const launchMode = useMemo(
    () => lensNextLaunchModeFromSearch(window.location.search),
    [],
  );
  const workspaceClassName = launchMode === "navisworks"
    ? "lens-next-workspace lens-next-workspace--embedded"
    : "lens-next-workspace";
  const routeStateClassName = launchMode === "navisworks"
    ? "lens-next-route-state lens-next-route-state--embedded"
    : "lens-next-route-state";
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [bridgeContext, setBridgeContext] =
    useState<LensNextBridgeProjectContext | null>(null);
  const [bridgeDiscoveryError, setBridgeDiscoveryError] = useState<string | null>(null);
  const bridgeSession = useSyncExternalStore(
    subscribeLensNextBridgeSession,
    getLensNextBridgeSessionSnapshot,
    () => null,
  );

  useEffect(() => {
    if (bridgeSession) return;
    const controller = new AbortController();
    let timer: number | null = null;
    const retryMs = launchMode === "navisworks" ? 2_000 : 10_000;
    const connect = async () => {
      try {
        const session = await bootstrapLensNextBridgeSession(undefined, controller.signal);
        if (controller.signal.aborted) return;
        injectLensNextBridgeSession({
          protocolVersion: 1,
          source: session.source,
          token: session.token,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
        });
        setBridgeDiscoveryError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBridgeDiscoveryError(
          error instanceof Error ? error.message : "Lens Next bridge discovery failed.",
        );
        timer = window.setTimeout(connect, retryMs);
      }
    };
    void connect();
    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [bridgeSession, launchMode]);

  useEffect(() => {
    if (!bridgeSession) {
      setBridgeContext(null);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const client = createLensNextBridgeClient({
          sessionToken: bridgeSession.token,
        });
        if (!(await client.probe(controller.signal)))
          throw new Error("Lens Next bridge did not confirm the active session.");
        const context = await client.loadProjectContext(controller.signal);
        if (controller.signal.aborted) return;
        setBridgeContext(context);
        setBridgeDiscoveryError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBridgeContext(null);
        setBridgeDiscoveryError(
          error instanceof Error ? error.message : "Lens Next project context failed.",
        );
        clearLensNextBridgeSession();
      }
    };
    void load();
    return () => controller.abort();
  }, [bridgeSession]);

  const resolution = useMemo(
    () => resolveLensNextLaunchProject(
      projects,
      selectedProjectId,
      bridgeContext,
      launchMode,
    ),
    [bridgeContext, launchMode, projects, selectedProjectId],
  );

  useEffect(() => {
    if (resolution.projectId !== selectedProjectId)
      setSelectedProjectId(resolution.projectId);
  }, [resolution.projectId, selectedProjectId]);

  if (isLoading) {
    return <main className={routeStateClassName}>Loading authorized BIMLog projects…</main>;
  }
  if (isError) {
    return <main className={routeStateClassName} role="alert">Authorized projects could not be loaded.</main>;
  }
  if (!token || projects.length === 0) {
    return <main className={routeStateClassName} role="alert">No authorized BIMLog project is available.</main>;
  }
  if (resolution.status === "unauthorized_project") {
    return <main className={routeStateClassName} role="alert">{resolution.message}</main>;
  }
  if (launchMode === "navisworks" && resolution.status === "waiting_for_bridge") {
    return (
      <main className={routeStateClassName} aria-live="polite">
        <strong>Connecting to Navisworks…</strong>
        <span>{resolution.message}</span>
        {bridgeDiscoveryError && <small>{bridgeDiscoveryError}</small>}
      </main>
    );
  }

  return (
    <main className={workspaceClassName} data-lens-next-embedded={launchMode === "navisworks" ? "true" : "false"}>
      <LensNextPanel
        projects={projects}
        selectedProjectId={resolution.projectId}
        onProjectChange={setSelectedProjectId}
        projectLocked={resolution.locked}
        authToken={token}
        bridgeSessionToken={bridgeSession?.token ?? ""}
      />
    </main>
  );
}
