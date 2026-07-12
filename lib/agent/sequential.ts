export type SequentialStep = {
  id: string;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "cancelled";
  dependsOnStepId?: string | null;
};
export function nextRunnableStep(steps: SequentialStep[]) {
  for (const step of steps) {
    if (step.status !== "queued") continue;
    if (!step.dependsOnStepId) return step;
    const dependency = steps.find((item) => item.id === step.dependsOnStepId);
    if (dependency?.status === "succeeded") return step;
  }
  return null;
}
export function propagateDependencyFailures(steps: SequentialStep[]) {
  const result = steps.map((step) => ({ ...step }));
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of result) {
      if (step.status !== "queued" || !step.dependsOnStepId) continue;
      const dependency = result.find(
        (item) => item.id === step.dependsOnStepId,
      );
      if (
        dependency &&
        ["failed", "skipped", "cancelled"].includes(dependency.status)
      ) {
        step.status = "skipped";
        changed = true;
      }
    }
  }
  return result;
}
export function validateSequentialPlan(
  steps: Array<{ id: string; dependsOnStepId?: string | null; mode?: string }>,
) {
  const executable = steps.filter((step) => step.mode === "tool");
  if (executable.length > 3)
    throw new Error("Plan exceeds the three-tool MVP limit.");
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) throw new Error("Duplicate step id.");
    if (step.dependsOnStepId && !seen.has(step.dependsOnStepId))
      throw new Error("Dependencies must point to an earlier step.");
    seen.add(step.id);
  }
  return true;
}
