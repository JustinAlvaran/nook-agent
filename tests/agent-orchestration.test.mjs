import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const transpile = async (path, replacements = {}) => {
  let source = (await read(path));
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  source = output;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, `"${to}"`);
  return dataUrl(source);
};

const contractsUrl = await transpile("../lib/agent/contracts.ts");
const stateMachine = await import(await transpile("../lib/agent/state-machine.ts"));
const actionUrl = await transpile("../lib/agent/action.ts", { "./contracts": contractsUrl });
const action = await import(actionUrl);
const policy = await import(await transpile("../lib/agent/policy.ts"));
const retry = await import(await transpile("../lib/agent/retry.ts"));
const receiptsUrl = await transpile("../lib/agent/receipts.ts", { "./contracts": contractsUrl });

test("task and step state machines reject unsafe jumps", () => {
  assert.equal(stateMachine.canTransitionTask("ready", "running"), true);
  assert.equal(stateMachine.canTransitionTask("ready", "completed"), false);
  assert.equal(stateMachine.canTransitionStep("awaiting_approval", "approved"), true);
  assert.throws(() => stateMachine.assertStepTransition("awaiting_approval", "succeeded"), /Invalid step transition/);
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
  const reordered = { ...base, arguments: { nested: { a: 1, b: 2 }, to: "owner", body: "Hello" } };
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
  assert.throws(() => action.validateApprovalDecision(intent, {
    approvalId: intent.id,
    actionHash: "changed",
    decision: "approve",
    decidedByUserId: "user_1",
    decidedAt: "2029-01-01T00:00:00.000Z",
  }, new Date("2029-01-01T00:00:00.000Z")), /immutable action/);
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
  assert.equal(policy.evaluateActionPolicy({ ...common, actionType: "shell.execute", reversible: false }).blocked, true);
  const publish = policy.evaluateActionPolicy({ ...common, actionType: "page.publish", reversible: false });
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
  await queue.consumeExecutionMessage({
    body: { taskId: "task_1", workflowId: "task_1", action: { actionId: "act_1" } },
    attempts: 2,
    ack: () => { acknowledgements += 1; },
    retry: () => assert.fail("duplicate should not retry"),
  }, {
    receipts: { findByActionId: async () => ({ receiptId: "receipt_1" }), saveIfAbsent: async (value) => value },
    executor: { execute: async () => { executions += 1; return { summary: "bad" }; }, reconcile: async () => null },
    workflows: { send: async () => { events += 1; } },
  });
  assert.equal(executions, 0);
  assert.equal(events, 1);
  assert.equal(acknowledgements, 1);
});
