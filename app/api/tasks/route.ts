import {
  AGENT_CONTRACT_VERSION,
  type ActionEnvelope,
} from "../../../lib/agent/contracts";
import { createApprovalIntent, hashAction } from "../../../lib/agent/action";
import {
  MissingOpenAIKeyError,
  createTaskPlan,
} from "../../../lib/agent/planner";
import { evaluateActionPolicy } from "../../../lib/agent/policy";
import {
  ensureProfileAndNook,
  getServerIdentity,
} from "../../../lib/server/identity";
import {
  MissingExecutionSecretError,
  signServerOperation,
} from "../../../lib/server/execution-signature";
import { rejectCrossSiteMutation } from "../../../lib/server/request-security";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { Json } from "../../../lib/supabase/database.types";

export const runtime = "edge";

function taskResponse(row: Record<string, unknown>) {
  return {
    ...row,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan: row.plan ?? null,
    steps: row.task_steps ?? [],
    approvals: row.approvals ?? [],
    receipts: row.action_receipts ?? [],
    output: Array.isArray(row.task_outputs)
      ? (row.task_outputs[0] ?? null)
      : (row.task_outputs ?? null),
  };
}

export async function GET() {
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in to view saved tasks." },
      { status: 401 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Task history is unavailable." },
      { status: 503 },
    );
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, task_steps(*), approvals(*), action_receipts(*), task_events(*), task_executions(*), task_outputs(*)",
    )
    .eq("owner_id", identity.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error)
    return Response.json(
      { error: "Saved task history is temporarily unavailable." },
      { status: 503 },
    );
  return Response.json({
    tasks: (data ?? []).map((row) =>
      taskResponse(row as Record<string, unknown>),
    ),
  });
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in with Google or GitHub to ask Nook for a plan." },
      { status: 401 },
    );
  let body: { input?: unknown; nookName?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const nookName =
    typeof body.nookName === "string"
      ? body.nookName.trim().slice(0, 24)
      : "Orbit";
  if (!input || input.length > 1200)
    return Response.json(
      { error: "Enter a task between 1 and 1,200 characters." },
      { status: 400 },
    );

  try {
    const plan = await createTaskPlan(input);
    const taskId = crypto.randomUUID();
    const nook = await ensureProfileAndNook(identity, nookName || "Orbit");
    const persistedSteps = plan.steps.length
      ? plan.steps
      : [
          {
            id: "step_1",
            title: "Stopped at the safety boundary",
            detail:
              plan.blockedReason || "The request is blocked by Nook policy.",
            kind: "explain" as const,
            mode: "instruction" as const,
            toolName: null,
            toolVersion: null,
            toolInput: null,
            riskClass: plan.riskClass,
            externalEffect: false,
            requiresApproval: false,
          },
        ];
    const stepRows = [] as Array<Record<string, Json>>;
    const persistedStepIds = new Map(
      plan.steps.map((step) => [step.id, crypto.randomUUID()]),
    );
    let approval: Json | null = null;
    for (let ordinal = 0; ordinal < persistedSteps.length; ordinal += 1) {
      const planStep = persistedSteps[ordinal];
      const stepId = persistedStepIds.get(planStep.id)!;
      const envelope: ActionEnvelope = {
        contractVersion: AGENT_CONTRACT_VERSION,
        taskId,
        planVersion: 1,
        stepId,
        actionType: planStep.toolName || "instruction",
        connector: "internal",
        arguments: planStep.toolInput || {},
        externalEffect: planStep.externalEffect,
        reversible: true,
        estimatedCostCents: 0,
        requestedRisk: planStep.riskClass,
      };
      const action = await hashAction(envelope);
      const policy = evaluateActionPolicy(action);
      stepRows.push({
        id: stepId,
        ordinal,
        title: planStep.title,
        detail: planStep.detail,
        kind: planStep.kind,
        status: planStep.requiresApproval ? "awaiting_approval" : "queued",
        requires_approval: planStep.requiresApproval,
        action_id: action.actionId,
        action_hash: action.actionHash,
        tool_name: planStep.toolName,
        tool_version: planStep.toolVersion,
        tool_input: planStep.toolInput as Json,
        dependency_step_id: planStep.dependsOnStepId
          ? (persistedStepIds.get(planStep.dependsOnStepId) ?? null)
          : null,
      });
      if (!plan.blocked && planStep.requiresApproval) {
        const intent = createApprovalIntent(action, policy, {
          toolName: planStep.toolName || "unknown",
          destinationLabel: "This Nook only",
          preview: `${planStep.title}: ${planStep.detail}\nExact input: ${JSON.stringify(planStep.toolInput)}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        const approvalId = crypto.randomUUID();
        approval = {
          id: approvalId,
          step_id: stepId,
          action_id: action.actionId,
          action_hash: action.actionHash,
          risk_class: policy.effectiveRisk,
          intent: { ...intent, id: approvalId },
          expires_at: intent.expiresAt,
        };
      }
    }

    const status = plan.blocked
      ? "blocked"
      : approval
        ? "awaiting_approval"
        : "ready";
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const authorization = await signServerOperation(
      "create_task",
      identity.userId,
      taskId,
    );
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    const { error } = await rpc("nook_create_supervised_task", {
      p_task_id: taskId,
      p_nook_id: nook.id,
      p_input: input,
      p_status: status,
      p_risk_class: plan.riskClass,
      p_plan: plan,
      p_steps: stepRows,
      p_approval: approval ?? undefined,
      p_expires_at: authorization.expiresAt,
      p_signature: authorization.signature,
    });
    if (error) throw error;
    return Response.json(
      { task: { id: taskId, input, status, plan, persisted: true, approval } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MissingOpenAIKeyError) {
      return Response.json(
        {
          error:
            "Nook's agent key has not been enabled for this environment yet.",
          code: "OPENAI_KEY_REQUIRED",
        },
        { status: 503 },
      );
    }
    if (error instanceof MissingExecutionSecretError) {
      return Response.json(
        {
          error:
            "Nook's trusted task executor has not been enabled for this environment yet.",
          code: "EXECUTION_SECRET_REQUIRED",
        },
        { status: 503 },
      );
    }
    console.error(
      "task.plan.failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "Nook could not prepare and save a plan right now." },
      { status: 502 },
    );
  }
}
