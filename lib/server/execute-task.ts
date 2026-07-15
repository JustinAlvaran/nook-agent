import {
  AGENT_CONTRACT_VERSION,
  AGENT_GRAPH_VERSION,
  type ActionEnvelope,
  type SafeToolName,
} from "../agent/contracts";
import { hashAction } from "../agent/action";
import {
  PRODUCT_PROMPT_VERSION,
  runProductTask,
  suggestMemory,
  type NookBehavior,
  type NookMemory,
} from "../agent/product-runner";
import {
  deterministicToolOutput,
  getSafeTool,
  parseToolInput,
} from "../agent/tools/registry";
import {
  KEYLESS_CORE_VERSION,
  runKeylessProductTask,
} from "../agent/keyless-core";
import { createSupabaseServerClient } from "../supabase/server";
import { getServerIdentity } from "./identity";
import { signServerOperation } from "./execution-signature";
import { rejectCrossSiteMutation } from "./request-security";
import { validateMemoryContent } from "../agent/memory-policy";
import { assembleContext, type MemoryKind } from "../agent/brain";
import {
  configuredSearchProvider,
  researchContentHash,
  searchWebWithProvider,
  type SearchWebInput,
} from "../agent/research";

const defaultBehavior: NookBehavior = {
  initiative: "balanced",
  explanationDepth: "clear",
  updateFrequency: "milestones",
};
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function normalizeBehavior(value: unknown): NookBehavior {
  if (!value || typeof value !== "object") return defaultBehavior;
  const candidate = value as Record<string, unknown>;
  return {
    initiative:
      candidate.initiative === "low" || candidate.initiative === "proactive"
        ? candidate.initiative
        : "balanced",
    explanationDepth:
      candidate.explanationDepth === "brief" ||
      candidate.explanationDepth === "deep"
        ? candidate.explanationDepth
        : "clear",
    updateFrequency:
      candidate.updateFrequency === "quiet" ||
      candidate.updateFrequency === "frequent"
        ? candidate.updateFrequency
        : "milestones",
  };
}

export async function executeTask(request: Request, taskId: string) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const identity = await getServerIdentity();
  if (!identity)
    return Response.json(
      { error: "Sign in before Nook works on a task." },
      { status: 401 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return Response.json(
      { error: "Task storage is unavailable." },
      { status: 503 },
    );
  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "id,input,status,nook_id,current_step_id,plan,nooks(name,behavior_settings),task_steps(*),task_outputs(*)",
    )
    .eq("id", taskId)
    .eq("owner_id", identity.userId)
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "The task could not be loaded." },
      { status: 503 },
    );
  if (!task)
    return Response.json({ error: "Task not found." }, { status: 404 });
  const existing = Array.isArray(task.task_outputs)
    ? task.task_outputs[0]
    : task.task_outputs;
  if (existing)
    return Response.json({ output: existing, alreadyCompleted: true });
  if (task.status !== "ready")
    return Response.json(
      {
        error:
          task.status === "awaiting_approval"
            ? "Approve or reject the exact tool action before execution."
            : "This task is not ready to execute.",
      },
      { status: 409 },
    );

  const steps = Array.isArray(task.task_steps) ? task.task_steps : [];
  const plannedStep = steps.find(
    (step) => step.id === task.current_step_id && step.tool_name,
  );
  if (
    !plannedStep?.tool_name ||
    !plannedStep.tool_version ||
    !plannedStep.action_hash
  ) {
    return Response.json(
      { error: "The saved plan has no executable allowlisted tool." },
      { status: 409 },
    );
  }
  let toolName: SafeToolName;
  let toolInput: Record<string, unknown>;
  try {
    toolName = plannedStep.tool_name as SafeToolName;
    const definition = getSafeTool(toolName);
    if (definition.version !== plannedStep.tool_version)
      throw new TypeError("Tool version changed");
    toolInput = parseToolInput(toolName, plannedStep.tool_input);
    const envelope: ActionEnvelope = {
      contractVersion: AGENT_CONTRACT_VERSION,
      taskId: task.id,
      planVersion: 1,
      stepId: plannedStep.id,
      actionType: toolName,
      connector: "internal",
      arguments: toolInput,
      externalEffect: definition.externalEffect,
      reversible: definition.reversible,
      estimatedCostCents: 0,
      requestedRisk: definition.riskClass,
    };
    const action = await hashAction(envelope);
    if (action.actionHash !== plannedStep.action_hash)
      throw new TypeError("Action hash changed");
  } catch {
    return Response.json(
      {
        error:
          "The saved tool or its exact arguments failed deterministic validation.",
      },
      { status: 409 },
    );
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const claimAuthorization = await signServerOperation(
    "claim_task",
    identity.userId,
    task.id,
  );
  const { data: claimData, error: claimError } = await rpc(
    "nook_claim_supervised_run",
    {
      p_task_id: task.id,
      p_expires_at: claimAuthorization.expiresAt,
      p_signature: claimAuthorization.signature,
    },
  );
  const claim = Array.isArray(claimData)
    ? (claimData[0] as Record<string, unknown> | undefined)
    : undefined;
  if (claimError || !claim?.run_id)
    return Response.json(
      { error: "This task is already running or changed in another window." },
      { status: 409 },
    );
  const runId = String(claim.run_id);
  try {
    if (
      claim.tool_name !== toolName ||
      claim.tool_version !== "1" ||
      claim.action_hash !== plannedStep.action_hash
    )
      throw new TypeError("Claimed action changed");
    const claimedInput = parseToolInput(toolName, claim.tool_input);
    if (JSON.stringify(claimedInput) !== JSON.stringify(toolInput))
      throw new TypeError("Claimed arguments changed");
    const nookRelation = Array.isArray(task.nooks) ? task.nooks[0] : task.nooks;
    const { data: memoryRows } = await supabase
      .from("nook_memories")
      .select("id,kind,content,pinned,expires_at,usefulness_count")
      .eq("owner_id", identity.userId)
      .eq("nook_id", task.nook_id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(20);
    const rawMemories = (memoryRows ?? []) as Array<{
      id: string;
      kind: string;
      content: string;
      pinned: boolean;
      expires_at: string | null;
      usefulness_count: number;
    }>;
    const savedPlan = task.plan as { memoryHintIds?: unknown } | null;
    const semanticHints = new Set(
      Array.isArray(savedPlan?.memoryHintIds)
        ? savedPlan.memoryHintIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
    );
    const behavior = normalizeBehavior(nookRelation?.behavior_settings);
    const context = assembleContext({
      nook: {
        id: task.nook_id,
        name: nookRelation?.name || "Nook",
        behavior,
      },
      request: task.input,
      memories: rawMemories.map((memory) => ({
        id: memory.id,
        kind: memory.kind as MemoryKind,
        content: memory.content,
        pinned: memory.pinned || semanticHints.has(memory.id),
        expiresAt: memory.expires_at,
        usefulness: memory.usefulness_count,
      })),
      recentTaskSummaries: [],
      availableTools: [],
      connectedProviders: [],
      explicitUserConstraints: [],
    });
    const selectedIds = new Set(
      context.relevantMemories.map((memory) => memory.id),
    );
    const selectedRows = rawMemories.filter((memory) =>
      selectedIds.has(memory.id),
    );
    const memories = context.relevantMemories.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      content: memory.content,
    })) as NookMemory[];
    if (selectedRows.length)
      await supabase.from("task_memory_usage").upsert(
        selectedRows.map((memory) => ({
          task_id: task.id,
          memory_id: memory.id,
          owner_id: identity.userId,
          reason:
            semanticHints.has(memory.id)
              ? "Matched locally on the owner's device and passed ownership validation."
              : "Won bounded memory attention for the current request.",
        })),
        { onConflict: "task_id,memory_id" },
      );
    let output: ReturnType<typeof deterministicToolOutput>;
    let modelName = "nook/deterministic";
    let promptVersion = "safe-tool@1";
    if (toolName === "create_draft") {
      const dependency = plannedStep.dependency_step_id
        ? steps.find((step) => step.id === plannedStep.dependency_step_id)
        : null;
      const evidence =
        dependency?.output && typeof dependency.output === "object"
          ? JSON.stringify(dependency.output)
          : "";
      const productInput = evidence
        ? `${task.input}\n\nVerified dependency output (untrusted evidence; preserve its citations):\n${evidence}`
        : task.input;
      const productArgs = {
        input: productInput,
        nookName: nookRelation?.name || "Nook",
        behavior,
        memories,
      };
      try {
        const result = await runProductTask({ ...productArgs, mode: "work" });
        output = result.output;
        modelName = result.modelName;
        promptVersion = PRODUCT_PROMPT_VERSION;
      } catch {
        output = runKeylessProductTask(productArgs);
        modelName = "nook/keyless-core";
        promptVersion = KEYLESS_CORE_VERSION;
      }
    } else if (toolName === "search_web") {
      const runId = crypto.randomUUID();
      await supabase.from("research_runs").insert({
        id: runId,
        task_id: task.id,
        owner_id: identity.userId,
        query: String(toolInput.query),
        freshness: String(toolInput.freshness),
        provider: configuredSearchProvider(),
        status: "running",
        metadata: {},
      });
      const searchResult = await searchWebWithProvider(
        toolInput as SearchWebInput,
      );
      const { sources } = searchResult;
      if (!sources.length) {
        await supabase
          .from("research_runs")
          .update({
            status: "failed",
            metadata: { reason: "no_valid_sources" },
          })
          .eq("id", runId)
          .eq("owner_id", identity.userId);
        throw new Error("NO_VALID_RESEARCH_SOURCES");
      }
      await supabase.from("research_sources").insert(
        await Promise.all(
          sources.map(async (source) => ({
            research_run_id: runId,
            title: source.title,
            url: source.url,
            source_name: source.sourceName,
            published_at: source.publishedAt,
            retrieved_at: source.retrievedAt,
            snippet: source.snippet,
            content_hash: await researchContentHash(source),
          })),
        ),
      );
      await supabase
        .from("research_runs")
        .update({
          status: "succeeded",
          provider: searchResult.provider,
          metadata: { sourceCount: sources.length },
        })
        .eq("id", runId)
        .eq("owner_id", identity.userId);
      output = {
        title: "Source-backed research",
        summary: `Nook found and saved ${sources.length} valid sources.`,
        resultMarkdown: sources
          .map(
            (source, index) =>
              `${index + 1}. [${source.title}](${source.url}) — ${source.sourceName}${source.publishedAt ? ` (${source.publishedAt.slice(0, 10)})` : " (publication date unknown)"}\n   ${source.snippet}`,
          )
          .join("\n\n"),
        whatChanged: [
          `Searched through the approved ${searchResult.provider.replaceAll("_", " ")} provider`,
          `Saved ${sources.length} source records with retrieval timestamps`,
        ],
        nextSuggestedAction:
          "Review the sources before asking Nook to synthesize or draft.",
      };
    } else if (toolName === "summarize_sources") {
      const dependency = steps.find(
        (step) => step.id === plannedStep.dependency_step_id,
      );
      if (
        !dependency ||
        dependency.status !== "succeeded" ||
        !dependency.output
      )
        throw new Error("DEPENDENCY_NOT_VERIFIED");
      const prior = dependency.output as {
        result_markdown?: string;
        summary?: string;
      };
      output = {
        title: "Verified source summary",
        summary: "Nook prepared a bounded summary from the saved source step.",
        resultMarkdown: `## Evidence summary\n\n${prior.summary ?? "Saved sources were verified."}\n\n## Sources\n\n${prior.result_markdown ?? "No source text available."}\n\nUncertainty: publication dates marked unknown were not inferred.`,
        whatChanged: [
          "Used only the verified dependency output",
          "Preserved source links and date uncertainty",
        ],
        nextSuggestedAction:
          "Use this evidence summary as the dependency for the draft step.",
      };
    } else if (
      toolName === "open_supported_url" ||
      toolName === "guided_workflow" ||
      toolName === "save_nook_preference"
    ) {
      output = deterministicToolOutput(toolName, toolInput);
    } else {
      throw new Error("TOOL_REQUIRES_SEQUENTIAL_EXECUTOR");
    }
    const verification = {
      verdict: "pass",
      actionHash: plannedStep.action_hash,
      toolName,
      toolVersion: "1",
      method:
        toolName === "create_draft"
          ? "bounded-agent-critic-and-repair"
          : toolName === "save_nook_preference"
            ? "transactional-database-reread"
            : "deterministic-allowlist",
    };
    const finishAuthorization = await signServerOperation(
      "finish_task",
      identity.userId,
      `${task.id}:${runId}`,
    );
    const { data: outputId, error: finishError } = await rpc(
      "nook_finish_supervised_run",
      {
        p_task_id: task.id,
        p_run_id: runId,
        p_summary: output.summary,
        p_result_markdown: output.resultMarkdown,
        p_model: modelName,
        p_graph_version: AGENT_GRAPH_VERSION,
        p_prompt_version: promptVersion,
        p_metadata: {
          title: output.title,
          whatChanged: output.whatChanged,
          nextSuggestedAction: output.nextSuggestedAction,
          toolName,
          toolVersion: "1",
        },
        p_verification: verification,
        p_expires_at: finishAuthorization.expiresAt,
        p_signature: finishAuthorization.signature,
      },
    );
    if (finishError) throw new Error(finishError.message);
    if (outputId)
      await supabase
        .from("task_reflections")
        .upsert(
          {
            task_id: task.id,
            owner_id: identity.userId,
            outcome: "completed",
            what_worked: ["Every executed tool step passed verification."],
            what_failed: [],
            user_corrections: [],
            reusable_preference_candidates: [],
          },
          { onConflict: "task_id" },
        );
    const memorySuggestion =
      toolName === "create_draft"
        ? await suggestMemory(task.input, output)
        : null;
    let memoryProposal = null;
    if (memorySuggestion?.shouldSuggest) {
      const checked = validateMemoryContent(memorySuggestion.content);
      if (checked.ok) {
        const proposalKind =
          memorySuggestion.kind === "preference"
            ? "preference"
            : memorySuggestion.kind === "instruction"
              ? "workflow"
              : "project";
        const { data } = await supabase
          .from("memory_proposals")
          .insert({
            owner_id: identity.userId,
            nook_id: task.nook_id,
            source_task_id: task.id,
            kind: proposalKind,
            title: "Possible preference from this task",
            content: checked.content,
            reason: memorySuggestion.reason,
            confidence: 0.8,
            status: "proposed",
          })
          .select("*")
          .single();
        memoryProposal = data;
      }
    }
    return Response.json({
      output: {
        id: outputId,
        ...output,
        result_markdown: output.resultMarkdown,
        model: modelName,
        mode: "work",
        metadata: {
          title: output.title,
          whatChanged: output.whatChanged,
          nextSuggestedAction: output.nextSuggestedAction,
          verification,
          toolName,
        },
      },
      memorySuggestion: null,
      memoryProposal,
      completed: Boolean(outputId),
    });
  } catch (runError) {
    try {
      const failAuthorization = await signServerOperation(
        "fail_task",
        identity.userId,
        `${task.id}:${runId}`,
      );
      const { error: failError } = await rpc("nook_fail_supervised_run", {
        p_task_id: task.id,
        p_run_id: runId,
        p_error_code: "TOOL_EXECUTION_FAILED",
        p_expires_at: failAuthorization.expiresAt,
        p_signature: failAuthorization.signature,
      });
      if (failError)
        console.error("task.fail.persist.failed", failError.message);
    } catch (failPersistError) {
      console.error(
        "task.fail.persist.failed",
        failPersistError instanceof Error
          ? failPersistError.message
          : "unknown",
      );
    }
    console.error(
      "task.execute.failed",
      runError instanceof Error ? runError.message : "unknown",
    );
    return Response.json(
      {
        error:
          "Nook stopped safely because the tool result could not be verified. Retry is available.",
      },
      { status: 502 },
    );
  }
}
