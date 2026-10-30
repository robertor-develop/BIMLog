import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {useEffect,useRef} from "react";
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

export function useCoordinationConfirm(projectId: number, scopeKey="") {
  const qc = useQueryClient();
  const pending=useRef<{key:string;result:CoordinationConfirmResult}|null>(null);
  const generation=useRef(0);
  useEffect(()=>{pending.current=null;generation.current++;return()=>{generation.current++;};},[projectId,scopeKey]);
  const verify=async(key:string,result:CoordinationConfirmResult,started:number)=>{
    if(started!==generation.current)throw new Error("Confirmation context changed; reopen saved events.");
    pending.current={key,result};
    const events=await customFetch<CoordinationEvent[]>(`/api/v1/projects/${projectId}/coordination/events`,{method:"GET"});
    if(started!==generation.current)throw new Error("Confirmation context changed; reopen saved events.");
    if(!Array.isArray(events)||!events.some(event=>event.id===result.eventId))throw new Error("Confirmation saved, but its event could not be reopened. Retry the same action to verify without another write.");
    pending.current=null;return result;
  };
  return useMutation({
    mutationFn: async (req: CoordinationConfirmRequest): Promise<CoordinationConfirmResult> => {
      const key=JSON.stringify(req);
      const started=generation.current;
      if(pending.current){if(pending.current.key!==key)throw new Error("Verify the previously saved confirmation before changing the action.");return verify(key,pending.current.result,started);}
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
        const eventId=Number(resp.headers.get("X-Coordination-Event-Id"));
        if(resp.headers.get("X-BIMLog-Project-Id")!==String(projectId)||!Number.isSafeInteger(eventId)||eventId<=0||!resp.headers.get("Content-Type")?.includes("application/octet-stream"))throw new Error("Confirmation receipt is incomplete. Reopen recent events before retrying.");
        const blob = await resp.blob();
        if(!blob.size)throw new Error("Confirmed download is empty. Retry the same action.");
        return verify(key,{ blob, filename: req.finalFilename,eventId },started);
      }
      const result=await customFetch<CoordinationConfirmResult>(url, {
        method: "POST",
        body: JSON.stringify(req),
      });
      if(!Number.isSafeInteger(result.eventId)||Number(result.eventId)<=0)throw new Error("Confirmation event receipt is incomplete.");
      return verify(key,result,started);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey(projectId) });
    },
  });
}
