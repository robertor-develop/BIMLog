import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ConventionSetupStatus } from "./convention-document-state";

export type ConventionFlowPhase =
  | "setup_context"
  | "industrial_discovery"
  | "import_structure"
  | "ai_suggestions"
  | "main_wizard"
  | "re_evidence"
  | "changes_review"
  | "checkpoint"
  | "edit_foundation";

export interface ConventionSetupNavigationContext {
  setupContextChoice: string;
  projectEnvironment: string;
  builderIntent: string;
  analysisOnlyMode: boolean;
}

export function resolveSetupContinuation(context: ConventionSetupNavigationContext): ConventionFlowPhase {
  const analyzeExisting = context.analysisOnlyMode
    || context.builderIntent === "analyze_existing"
    || context.builderIntent === "mirror_existing"
    || context.setupContextChoice === "takeover"
    || context.setupContextChoice === "analyze_first";
  if (analyzeExisting) return "import_structure";
  if (context.projectEnvironment === "industrial_epc") return "industrial_discovery";
  return "main_wizard";
}

export function phaseRequiresCompletedConvention(phase: ConventionFlowPhase): boolean {
  return phase === "checkpoint"
    || phase === "edit_foundation"
    || phase === "re_evidence"
    || phase === "changes_review";
}

export function resolveCheckpointContinuation(hasExisting: boolean): { flowPhase: ConventionFlowPhase; step: number } {
  return hasExisting
    ? { flowPhase: "main_wizard", step: 4 }
    : { flowPhase: "setup_context", step: 0 };
}

export function resolveWizardBackPhase(enteredFromDiscovery: boolean, hasDiscoveryResult: boolean): ConventionFlowPhase {
  return enteredFromDiscovery && hasDiscoveryResult ? "ai_suggestions" : "setup_context";
}

export function useConventionPhaseGuard<T extends { flowPhase: ConventionFlowPhase; step: number }>(options: {
  setupStatus: ConventionSetupStatus;
  flowPhase: ConventionFlowPhase;
  justSaved: boolean;
  setState: Dispatch<SetStateAction<T>>;
}): void {
  const { setupStatus, flowPhase, justSaved, setState } = options;
  useEffect(() => {
    if (justSaved) return;
    if (setupStatus !== "completed" && phaseRequiresCompletedConvention(flowPhase)) {
      setState(state => ({ ...state, flowPhase: "setup_context", step: 0 }));
    }
  }, [setupStatus, flowPhase, justSaved, setState]);
}
