import type { AdoptionStageId } from "./adoption-journey";

export type AdoptionProgressInput = {
  emailVerifiedAt: string | null;
  workProfile: string | null;
  preferredDisciplines: string[];
  preferredDocumentTypes: string[];
  completedSteps: string[];
  completedAt: string | null;
  projectCount: number;
  firstValueReached?: boolean;
};

export type AdoptionProgress = {
  completed: boolean;
  completedCount: number;
  percent: number;
  nextStage: AdoptionStageId | null;
};

const stages: Array<{ id: AdoptionStageId; done: (state: AdoptionProgressInput) => boolean }> = [
  { id: "account", done: () => true },
  { id: "verify", done: state => Boolean(state.emailVerifiedAt) },
  { id: "company", done: state => state.completedSteps.includes("company") },
  { id: "project", done: state => state.projectCount > 0 },
  { id: "control", done: state => Boolean(state.workProfile) && state.preferredDisciplines.length > 0 && state.preferredDocumentTypes.length > 0 },
  { id: "first_value", done: state => state.firstValueReached === true || state.completedSteps.includes("first_value") },
];

export function deriveAdoptionProgress(state: AdoptionProgressInput): AdoptionProgress {
  if (state.completedAt) return { completed: true, completedCount: stages.length, percent: 100, nextStage: null };
  const completedCount = stages.filter(stage => stage.done(state)).length;
  const nextStage = stages.find(stage => !stage.done(state))?.id ?? null;
  return {
    completed: nextStage === null,
    completedCount,
    percent: Math.round((completedCount / stages.length) * 100),
    nextStage,
  };
}
