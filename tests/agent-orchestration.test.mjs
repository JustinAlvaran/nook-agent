import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const dataUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const transpile = async (path, replacements = {}) => {
  let source = await read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;
  source = output;
  for (const [from, to] of Object.entries(replacements))
    source = source.replaceAll(`"${from}"`, `"${to}"`);
  return dataUrl(source);
};

const contractsUrl = await transpile("../lib/agent/contracts.ts");
const stateMachine = await import(
  await transpile("../lib/agent/state-machine.ts")
);
const actionUrl = await transpile("../lib/agent/action.ts", {
  "./contracts": contractsUrl,
});
const action = await import(actionUrl);
const policy = await import(await transpile("../lib/agent/policy.ts"));
const retry = await import(await transpile("../lib/agent/retry.ts"));
const receiptsUrl = await transpile("../lib/agent/receipts.ts", {
  "./contracts": contractsUrl,
});
const brain = await import(
  await transpile("../lib/agent/brain.ts", { "./contracts": contractsUrl })
);
const motion = await import(await transpile("../lib/agent/nook-motion.ts"));
const memoryPolicy = await import(
  await transpile("../lib/agent/memory-policy.ts")
);
const research = await import(await transpile("../lib/agent/research.ts"));
const sequential = await import(await transpile("../lib/agent/sequential.ts"));
test("sequential plans are bounded and skip downstream steps after failure", () => {
  assert.equal(
    sequential.validateSequentialPlan([
      { id: "a", mode: "tool" },
      { id: "b", mode: "tool", dependsOnStepId: "a" },
      { id: "c", mode: "tool", dependsOnStepId: "b" },
    ]),
    true,
  );
  assert.throws(
    () =>
      sequential.validateSequentialPlan([
        { id: "a", mode: "tool" },
        { id: "b", mode: "tool" },
        { id: "c", mode: "tool" },
        { id: "d", mode: "tool" },
      ]),
    /three-tool/,
  );
  const failed = sequential.propagateDependencyFailures([
    { id: "a", status: "failed" },
    { id: "b", status: "queued", dependsOnStepId: "a" },
    { id: "c", status: "queued", dependsOnStepId: "b" },
  ]);
  assert.deepEqual(
    failed.map((s) => s.status),
    ["failed", "skipped", "skipped"],
  );
});

test("research security blocks unsafe URLs, enforces domains, and deduplicates", () => {
  assert.equal(research.isSafeResearchUrl("http://example.com"), false);
  assert.equal(research.isSafeResearchUrl("https://127.0.0.1/x"), false);
  assert.equal(research.isSafeResearchUrl("https://192.168.1.2/x"), false);
  assert.equal(research.isSafeResearchUrl("https://docs.example.com/x"), true);
  const results = research.normalizeSearchResults(
    [
      {
        title: "Official",
        url: "https://docs.example.com/a?tracking=1",
        description: "primary",
      },
      {
        title: "Duplicate",
        url: "https://docs.example.com/a?other=2",
        description: "duplicate",
      },
      { title: "Blocked", url: "https://bad.example.net/x" },
    ],
    {
      query: "q",
      freshness: "current",
      allowedDomains: ["example.com"],
      blockedDomains: ["example.net"],
      maxResults: 5,
    },
    new Date("2026-01-01"),
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].publishedAt, null);
});

test("memory policy rejects secrets and excludes inactive or expired memory", () => {
  assert.equal(
    memoryPolicy.validateMemoryContent("Prefer concise answers").ok,
    true,
  );
  assert.equal(
    memoryPolicy.validateMemoryContent("API key: sk-example-secret").ok,
    false,
  );
  assert.equal(
    memoryPolicy.validateMemoryContent("Card 4111 1111 1111 1111").ok,
    false,
  );
  assert.equal(memoryPolicy.memoryIsRetrievable({ status: "proposed" }), false);
  assert.equal(
    memoryPolicy.memoryIsRetrievable(
      { status: "active", expiresAt: "2020-01-01T00:00:00Z" },
      new Date("2026-01-01"),
    ),
    false,
  );
  assert.equal(memoryPolicy.memoryIsRetrievable({ status: "active" }), true);
});

test("brain perception separates clarification, research, drafting, and preferences", () => {
  const page = brain.perceiveRequest("Create a Facebook Page for my business");
  assert.equal(page.probableIntent, "guided_workflow");
  assert.equal(page.needsClarification, true);
  assert.ok(page.missingInformation.includes("Business name"));
  const research = brain.perceiveRequest(
    "Research the latest official Facebook Page guidance",
  );
  assert.equal(brain.decideResearch(research).required, true);
  assert.equal(
    brain.decideResearch(
      brain.perceiveRequest("Rewrite this supplied paragraph"),
    ).required,
    false,
  );
  assert.equal(
    brain.perceiveRequest("Nook, prefer concise explanations").probableIntent,
    "change_preference",
  );
  assert.equal(
    brain.perceiveRequest("save my API key abc123").possibleSensitiveData,
    true,
  );
});

test("context assembly is bounded, relevant, project-scoped, and expiration-aware", () => {
  const memories = [
    {
      id: "pinned",
      kind: "preference",
      content: "Prefer official sources",
      pinned: true,
    },
    {
      id: "project",
      kind: "project",
      content: "Facebook launch project",
      projectId: "project-1",
    },
    {
      id: "other",
      kind: "project",
      content: "Facebook for another project",
      projectId: "project-2",
    },
    {
      id: "expired",
      kind: "temporary",
      content: "Facebook expired",
      expiresAt: "2020-01-01T00:00:00Z",
    },
  ];
  const context = brain.assembleContext({
    nook: {
      id: "n",
      name: "Orbit",
      behavior: {
        initiative: "balanced",
        explanationDepth: "clear",
        updateFrequency: "milestones",
      },
    },
    request: "Draft the Facebook launch",
    memories,
    recentTaskSummaries: Array(9).fill("task"),
    availableTools: [],
    connectedProviders: [],
    explicitUserConstraints: [],
    projectId: "project-1",
    now: new Date("2026-01-01"),
  });
  assert.deepEqual(
    context.relevantMemories.map((m) => m.id),
    ["pinned", "project"],
  );
  assert.equal(context.recentTaskSummaries.length, 5);
});

test("task data deterministically drives honest mascot states", () => {
  assert.equal(
    motion.deriveNookBrainState({ status: "planning" }, null),
    "planning",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "awaiting_approval" }, null),
    "waiting",
  );
  assert.equal(
    motion.deriveNookBrainState(
      { status: "running" },
      { status: "running", toolName: "search_web" },
    ),
    "researching",
  );
  assert.equal(
    motion.deriveNookBrainState(
      { status: "running" },
      { status: "running", toolName: "create_draft" },
    ),
    "working",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "verifying" }, null),
    "checking",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "completed", verified: false }, null),
    "checking",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "completed", verified: true }, null),
    "presenting",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "blocked" }, null),
    "warning",
  );
  assert.equal(
    motion.deriveNookBrainState({ status: "failed" }, null),
    "error",
  );
});
test("motion transitions prevent celebration before verification", () => {
  assert.equal(motion.canTransitionBrainState("working", "celebrating"), false);
  assert.equal(motion.canTransitionBrainState("waiting", "celebrating"), false);
  assert.equal(motion.canTransitionBrainState("checking", "presenting"), true);
  assert.equal(motion.anchorForFocus("sources"), "sources");
});

test("task and step state machines reject unsafe jumps", () => {
  assert.equal(stateMachine.canTransitionTask("ready", "running"), true);
  assert.equal(stateMachine.canTransitionTask("ready", "completed"), false);
  assert.equal(
    stateMachine.canTransitionStep("awaiting_approval", "approved"),
    true,
  );
  assert.throws(
    () => stateMachine.assertStepTransition("awaiting_approval", "succeeded"),
    /Invalid step transition/,
  );
});

test("canonical action hashes are stable and approval-bound", async () => {
  const contracts = await import(contractsUrl);
  const base = {
    contractVersion: contracts.AGENT_CONTRACT_VERSION,
    taskId: "task_1",
    planVersion: 1,
    stepId: "step_1",
    actionType: "message.send",
    connector: "example",
    arguments: { body: "Hello", to: "owner", nested: { b: 2, a: 1 } },
    externalEffect: true,
    reversible: true,
    estimatedCostCents: 0,
    requestedRisk: 0,
  };
  const reordered = {
    ...base,
    arguments: { nested: { a: 1, b: 2 }, to: "owner", body: "Hello" },
  };
  const first = await action.hashAction(base);
  const second = await action.hashAction(reordered);
  assert.equal(first.actionHash, second.actionHash);
  assert.equal(first.idempotencyKey, `nook_${first.actionHash}`);

  const decision = policy.evaluateActionPolicy(base);
  assert.equal(decision.effectiveRisk, 2);
  assert.equal(decision.requiresApproval, true);
  const intent = action.createApprovalIntent(first, decision, {
    toolName: "send_message",
    destinationLabel: "Example owner",
    preview: "Hello",
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
  assert.throws(
    () =>
      action.validateApprovalDecision(
        intent,
        {
          approvalId: intent.id,
          actionHash: "changed",
          decision: "approve",
          decidedByUserId: "user_1",
          decidedAt: "2029-01-01T00:00:00.000Z",
        },
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    /immutable action/,
  );
});

test("policy blocks prohibited capabilities and fresh-auth gates tier three", () => {
  const common = {
    contractVersion: "nook-agent-contract@1",
    taskId: "task_1",
    planVersion: 1,
    stepId: "step_1",
    connector: "provider",
    arguments: {},
    externalEffect: true,
    estimatedCostCents: 0,
    requestedRisk: 0,
  };
  assert.equal(
    policy.evaluateActionPolicy({
      ...common,
      actionType: "shell.execute",
      reversible: false,
    }).blocked,
    true,
  );
  const publish = policy.evaluateActionPolicy({
    ...common,
    actionType: "page.publish",
    reversible: false,
  });
  assert.equal(publish.effectiveRisk, 3);
  assert.equal(publish.requiresFreshAuth, true);
});

test("retry helper retries only bounded transient classes", () => {
  assert.equal(retry.classifyAgentError({ status: 429 }), "rate_limit");
  assert.equal(retry.shouldRetry("rate_limit", 4), true);
  assert.equal(retry.shouldRetry("rate_limit", 5), false);
  assert.equal(retry.shouldRetry("auth", 1), false);
  assert.equal(retry.retryDelayMs(10), 60_000);
});

test("queue duplicate delivery reuses the receipt without executing", async () => {
  const queueUrl = await transpile("../worker/nook-agent-queue.ts", {
    "../lib/agent/contracts": contractsUrl,
    "../lib/agent/receipts": receiptsUrl,
    "../lib/agent/retry": await transpile("../lib/agent/retry.ts"),
  });
  const queue = await import(queueUrl);
  let executions = 0;
  let acknowledgements = 0;
  let events = 0;
  await queue.consumeExecutionMessage(
    {
      body: {
        taskId: "task_1",
        workflowId: "task_1",
        action: { actionId: "act_1" },
      },
      attempts: 2,
      ack: () => {
        acknowledgements += 1;
      },
      retry: () => assert.fail("duplicate should not retry"),
    },
    {
      receipts: {
        findByActionId: async () => ({ receiptId: "receipt_1" }),
        saveIfAbsent: async (value) => value,
      },
      executor: {
        execute: async () => {
          executions += 1;
          return { summary: "bad" };
        },
        reconcile: async () => null,
      },
      workflows: {
        send: async () => {
          events += 1;
        },
      },
    },
  );
  assert.equal(executions, 0);
  assert.equal(events, 1);
  assert.equal(acknowledgements, 1);
});
