import { AGENT_GRAPH_VERSION } from "../../../../../lib/agent/contracts";
import { PRODUCT_PROMPT_VERSION, runProductTask, suggestMemory, type NookBehavior, type NookMemory } from "../../../../../lib/agent/product-runner";
import { getServerIdentity } from "../../../../../lib/server/identity";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export const runtime = "edge";
type Context = { params: Promise<{ taskId: string }> };
const defaultBehavior: NookBehavior = { initiative: "balanced", explanationDepth: "clear", updateFrequency: "milestones" };

function normalizeBehavior(value: unknown): NookBehavior {
  if (!value || typeof value !== "object") return defaultBehavior;
  const candidate = value as Record<string, unknown>;
  return {
    initiative: candidate.initiative === "low" || candidate.initiative === "proactive" ? candidate.initiative : "balanced",
    explanationDepth: candidate.explanationDepth === "brief" || candidate.explanationDepth === "deep" ? candidate.explanationDepth : "clear",
    updateFrequency: candidate.updateFrequency === "quiet" || candidate.updateFrequency === "frequent" ? candidate.updateFrequency : "milestones",
  };
}

export async function POST(_request: Request, context: Context) {
  const identity = await getServerIdentity();
  if (!identity) return Response.json({ error: "Sign in before Nook works on a task." }, { status: 401 });
  const { taskId } = await context.params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Task storage is unavailable." }, { status: 503 });
  const { data: task, error } = await supabase.from("tasks").select("id,input,status,nooks(name,behavior_settings),task_outputs(*)").eq("id", taskId).eq("owner_id", identity.userId).maybeSingle();
  if (error) return Response.json({ error: "The task could not be loaded." }, { status: 503 });
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  const existing = Array.isArray(task.task_outputs) ? task.task_outputs[0] : task.task_outputs;
  if (existing) return Response.json({ output: existing, alreadyCompleted: true });
  if (!new Set(["ready", "awaiting_approval", "failed"]).has(task.status)) return Response.json({ error: "This task cannot be worked in its current state." }, { status: 409 });

  const { data: claimRows, error: claimError } = await supabase.rpc("nook_claim_task_run", { p_task_id: task.id });
  if (claimError || !claimRows?.[0]) return Response.json({ error: "This task is already running or changed in another window." }, { status: 409 });
  const mode = claimRows[0].run_mode as "work" | "draft_only";
  const nookRelation = Array.isArray(task.nooks) ? task.nooks[0] : task.nooks;
  const { data: memoryRows } = await supabase.from("nook_memories").select("kind,content").eq("owner_id", identity.userId).eq("status", "active").order("updated_at", { ascending: false }).limit(20);
  const memories = (memoryRows ?? []) as NookMemory[];
  try {
    const result = await runProductTask({ input: task.input, nookName: nookRelation?.name || "Nook", behavior: normalizeBehavior(nookRelation?.behavior_settings), memories, mode });
    const { data: outputId, error: storeError } = await supabase.rpc("nook_store_task_output", {
      p_task_id: task.id,
      p_summary: result.output.summary,
      p_result_markdown: result.output.resultMarkdown,
      p_model: result.modelName,
      p_graph_version: AGENT_GRAPH_VERSION,
      p_prompt_version: PRODUCT_PROMPT_VERSION,
      p_metadata: { title: result.output.title, whatChanged: result.output.whatChanged, nextSuggestedAction: result.output.nextSuggestedAction },
    });
    if (storeError) throw storeError;
    const memorySuggestion = await suggestMemory(task.input, result.output);
    return Response.json({
      output: { id: outputId, ...result.output, result_markdown: result.output.resultMarkdown, model: result.modelName, mode },
      memorySuggestion: memorySuggestion?.shouldSuggest ? memorySuggestion : null,
    });
  } catch (runError) {
    await supabase.from("tasks").update({ status: "failed", active_run_mode: null }).eq("id", task.id).eq("owner_id", identity.userId).eq("status", "running");
    console.error("task.work.failed", runError instanceof Error ? runError.message : "unknown");
    return Response.json({ error: "Nook could not finish this work right now. Your saved plan is safe—try again." }, { status: 502 });
  }
}
