export const STAGES = [
  "capture",
  "qualify",
  "assign",
  "contact",
  "appointment_set",
  "inspection",
  "proposal",
  "negotiate",
  "won",
  "lost_nurture",
] as const;

export type Stage = (typeof STAGES)[number];

export const PIPELINE_STAGES = [
  "capture",
  "qualify",
  "assign",
  "contact",
  "appointment_set",
  "inspection",
  "proposal",
  "negotiate",
  "won",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  capture: "Capture",
  qualify: "Qualify",
  assign: "Assign",
  contact: "Contact",
  appointment_set: "Appointment set",
  inspection: "Inspection",
  proposal: "Proposal",
  negotiate: "Negotiate",
  won: "Won",
  lost_nurture: "Lost / Nurture",
};

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

/**
 * Phase 1 stage rules:
 * - Forward (including skips) along the pipeline is allowed
 * - Any non-lost stage may move to lost_nurture
 * - lost_nurture may reopen to any pipeline stage except won
 * - won is terminal except lost_nurture (job fell through)
 * - Backward moves require an explicit override (Firstmate / Ray)
 */
export function canTransition(
  from: string,
  to: string,
  options: { allowBackward?: boolean } = {},
): boolean {
  if (!isStage(from) || !isStage(to)) return false;
  if (from === to) return false;

  if (to === "lost_nurture") {
    return from !== "lost_nurture";
  }

  if (from === "lost_nurture") {
    return to !== "won";
  }

  // won → lost_nurture is already allowed by the `to === lost_nurture` branch.

  if (!isPipelineStage(from) || !isPipelineStage(to)) return false;

  const fromIdx = PIPELINE_STAGES.indexOf(from);
  const toIdx = PIPELINE_STAGES.indexOf(to);
  if (toIdx > fromIdx) return true;
  return options.allowBackward === true;
}

export function assertTransition(
  from: string,
  to: string,
  options: { allowBackward?: boolean } = {},
): asserts to is Stage {
  if (!canTransition(from, to, options)) {
    throw new Error(`Illegal stage transition: ${from} → ${to}`);
  }
}

export function suggestedNextStage(from: string): Stage | null {
  if (from === "won" || from === "lost_nurture") return null;
  if (!isPipelineStage(from)) return null;
  const idx = PIPELINE_STAGES.indexOf(from);
  const next = PIPELINE_STAGES[idx + 1];
  return next ?? null;
}
