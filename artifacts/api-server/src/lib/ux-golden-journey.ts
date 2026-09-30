export type GoldenJourneyStep = Readonly<{
  name: "setup" | "activate" | "task" | "evidence" | "decision" | "report";
  expectedRecordId: string;
  observedRecordId: string;
  mutationCount: number;
}>;

const REQUIRED_STEPS = ["setup", "activate", "task", "evidence", "decision", "report"] as const;

export function verifyGoldenJourney(steps: readonly GoldenJourneyStep[]) {
  const failures: string[] = [];
  REQUIRED_STEPS.forEach((name, index) => {
    const step = steps[index];
    if (!step || step.name !== name) failures.push(`STEP_${name.toUpperCase()}_MISSING_OR_OUT_OF_ORDER`);
    else {
      if (!step.expectedRecordId.trim() || step.expectedRecordId !== step.observedRecordId) failures.push(`STEP_${name.toUpperCase()}_IDENTITY_MISMATCH`);
      if (step.mutationCount !== 1) failures.push(`STEP_${name.toUpperCase()}_MUTATION_COUNT_${step.mutationCount}`);
    }
  });
  if (steps.length !== REQUIRED_STEPS.length) failures.push("UNEXPECTED_STEP_COUNT");
  return Object.freeze({ status: failures.length ? "blocked" : "passed", failures: Object.freeze(failures), exactRecordChain: failures.length === 0 });
}
