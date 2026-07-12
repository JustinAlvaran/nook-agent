export type NookBrainState =
  | "idle"
  | "listening"
  | "understanding"
  | "remembering"
  | "researching"
  | "planning"
  | "asking"
  | "waiting"
  | "working"
  | "checking"
  | "presenting"
  | "celebrating"
  | "warning"
  | "error"
  | "sleeping";
export type NookFocusTarget =
  | "command"
  | "plan"
  | "approval"
  | "sources"
  | "result"
  | "none";
export type NookExpression =
  | "neutral"
  | "curious"
  | "focused"
  | "waiting"
  | "happy"
  | "concerned"
  | "error";
export type NookMotionSignal = {
  state: NookBrainState;
  intensity: "low" | "normal" | "high";
  focusTarget: NookFocusTarget;
  expression: NookExpression;
  progress: number | null;
};
export type NookStageAnchor =
  | "home"
  | "command"
  | "plan"
  | "approval"
  | "sources"
  | "result";
const TRANSITIONS: Partial<Record<NookBrainState, NookBrainState[]>> = {
  idle: ["listening", "planning", "sleeping"],
  listening: ["understanding", "asking"],
  understanding: ["remembering", "researching", "planning", "asking"],
  remembering: ["researching", "planning"],
  researching: ["planning", "checking", "error"],
  planning: ["asking", "waiting", "working", "warning", "error"],
  asking: ["understanding", "planning"],
  waiting: ["working", "warning", "error"],
  working: ["checking", "error"],
  checking: ["presenting", "working", "error"],
  presenting: ["celebrating", "idle"],
  celebrating: ["idle"],
  warning: ["idle"],
  error: ["idle"],
  sleeping: ["idle", "listening"],
};
export function canTransitionBrainState(
  from: NookBrainState,
  to: NookBrainState,
) {
  return from === to || (TRANSITIONS[from] ?? []).includes(to);
}
export function anchorForFocus(focus: NookFocusTarget): NookStageAnchor {
  return focus === "none" ? "home" : focus;
}

export type MotionTask = {
  status: string;
  verified?: boolean;
  hasValidSources?: boolean;
};
export type MotionStep = {
  status: string;
  toolName?: string | null;
  ordinal?: number;
  total?: number;
} | null;
export type MotionEvent = { eventType: string } | { event_type: string };

export function deriveNookBrainState(
  task: MotionTask,
  currentStep: MotionStep,
  events: MotionEvent[] = [],
): NookBrainState {
  const eventTypes = events.map((e) =>
    "eventType" in e ? e.eventType : e.event_type,
  );
  if (task.status === "needs_clarification") return "asking";
  if (
    task.status === "awaiting_approval" ||
    currentStep?.status === "awaiting_approval"
  )
    return "waiting";
  if (task.status === "verifying" || currentStep?.status === "verifying")
    return "checking";
  if (task.status === "running") {
    if (currentStep?.toolName === "search_web") return "researching";
    return "working";
  }
  if (task.status === "planning" || task.status === "policy_review")
    return eventTypes.some((e) => e.includes("memory"))
      ? "remembering"
      : "planning";
  if (task.status === "completed")
    return task.verified || eventTypes.some((e) => e.includes("verified"))
      ? "presenting"
      : "checking";
  if (task.status === "blocked") return "warning";
  if (task.status === "failed") return "error";
  if (task.status === "offline") return "sleeping";
  return "idle";
}

export function deriveNookMotionSignal(
  status: string,
  toolName?: string | null,
): NookMotionSignal {
  const state = deriveNookBrainState(
    { status, verified: status === "completed" },
    toolName ? { status, toolName } : null,
  );
  if (state === "planning" || state === "remembering")
    return {
      state,
      intensity: "normal",
      focusTarget: "plan",
      expression: "curious",
      progress: null,
    };
  if (status === "awaiting_approval")
    return {
      state: "waiting",
      intensity: "low",
      focusTarget: "approval",
      expression: "waiting",
      progress: null,
    };
  if (status === "running" && toolName === "search_web")
    return {
      state: "researching",
      intensity: "normal",
      focusTarget: "sources",
      expression: "focused",
      progress: null,
    };
  if (status === "running")
    return {
      state: "working",
      intensity: "normal",
      focusTarget: "plan",
      expression: "focused",
      progress: null,
    };
  if (status === "verifying")
    return {
      state: "checking",
      intensity: "low",
      focusTarget: "result",
      expression: "focused",
      progress: null,
    };
  if (status === "completed")
    return {
      state: "presenting",
      intensity: "low",
      focusTarget: "result",
      expression: "happy",
      progress: 1,
    };
  if (status === "blocked")
    return {
      state: "warning",
      intensity: "low",
      focusTarget: "none",
      expression: "concerned",
      progress: null,
    };
  if (status === "failed")
    return {
      state: "error",
      intensity: "low",
      focusTarget: "none",
      expression: "error",
      progress: null,
    };
  if (status === "offline")
    return {
      state: "sleeping",
      intensity: "low",
      focusTarget: "none",
      expression: "neutral",
      progress: null,
    };
  return {
    state: "idle",
    intensity: "low",
    focusTarget: "command",
    expression: "neutral",
    progress: null,
  };
}
