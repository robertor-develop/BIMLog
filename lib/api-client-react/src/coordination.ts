import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type CoordinationActionType =
  | "VALUE_NOT_IN_CONVENTION"
  | "CANNOT_DETERMINE"
  | "CONVENTION_INCOMPLETE";

export interface CoordinationFieldAction {
  type: CoordinationActionType;
  text: string;
}

export interface CoordinationProposedField {
  fieldLabel: string;
  proposedValue: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  action?: CoordinationFieldAction | null;
}

export interface CoordinationAnalysis {
  proposedFields: CoordinationProposedField[];
  proposedFilename: string;
  overallConfidence: "high" | "medium" | "low";
  severe: boolean;
  severeReason: string | null;
  aiSummary: string;
  detectedDiscipline: string | null;
  detectedDocType: string | null;
  detectedLevel: string | null;
  detectedOriginator: string | null;
  keywords: string[];
}

export interface CoordinationConventionFieldSnapshot {
  label: string;
  fieldOrder: number;
  allowedValues: string[];
}

export interface CoordinationIntakeResponse {
  cacheKey: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  conventionId: number;
  conventionSnapshot: {
    separator: string;
    fields: CoordinationConventionFieldSnapshot[];
  };
  analysis: CoordinationAnalysis;
}

export interface CoordinationConfirmRequest {
  cacheKey: string;
  userAction: "accepted" | "manually_corrected" | "rejected";
  finalFilename: string;
  manualFieldsChanged?: Record<string, string>;
  destinationAction: "downloaded" | "queued_sync" | "pending";
  proposedFilename?: string;
  analysis?: CoordinationAnalysis;
  conventionId?: number;
  conventionSnapshot?: unknown;
  warningAcknowledged?: boolean;
}

export interface CoordinationEvent {
  id: number;
  originalFilename: string;
  finalFilename: string | null;
  proposedFilename: string | null;
  fileType: string | null;
  aiConfidence: "high" | "medium" | "low" | null;
  warningsTriggered: boolean | null;
  userAction: "accepted" | "manually_corrected" | "rejected" | null;
  destinationAction: "downloaded" | "queued_sync" | "pending" | null;
  uploaderCompany: string | null;
  uploaderId: number;
  uploaderName: string | null;
  createdAt: string;
}

const eventsKey = (projectId: number) =>
  [`/api/v1/projects/${projectId}/coordination/events`] as const;

export function useCoordinationEvents(projectId: number) {
  return useQuery({
    queryKey: eventsKey(projectId),
    queryFn: () =>
      customFetch<CoordinationEvent[]>(
        `/api/v1/projects/${projectId}/coordination/events`,
        { method: "GET" },
      ),
    enabled: !!projectId,
  });
}

export function useCoordinationIntake(projectId: number) {
  return useMutation({
    mutationFn: async (file: File): Promise<CoordinationIntakeResponse> => {
      const fd = new FormData();
      fd.append("file", file);
      return customFetch<CoordinationIntakeResponse>(
        `/api/v1/projects/${projectId}/coordination/intake`,
        { method: "POST", body: fd },
      );
    },
  });
}

export interface CoordinationConfirmResult {
  ok?: boolean;
  eventId?: number;
  blob?: Blob;
  filename?: string;
}

export function useCoordinationConfirm(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: CoordinationConfirmRequest): Promise<CoordinationConfirmResult> => {
      const url = `/api/v1/projects/${projectId}/coordination/confirm`;
      // For downloaded action, server returns binary — handle manually so we can read the blob
      if (req.userAction !== "rejected" && req.destinationAction === "downloaded") {
        const token = (() => {
          try {
            const stored = localStorage.getItem("bimlog-auth");
            return stored ? JSON.parse(stored)?.state?.token ?? null : null;
          } catch (err) {
            console.warn("[coordination] failed to read auth token for file download:", err);
            return null;
          }
        })();
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(req),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
        }
        const blob = await resp.blob();
        return { blob, filename: req.finalFilename };
      }
      return customFetch<CoordinationConfirmResult>(url, {
        method: "POST",
        body: JSON.stringify(req),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey(projectId) });
    },
  });
}
