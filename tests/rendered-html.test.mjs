import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the finished Nook landing replaces the starter", async () => {
  const [page, layout, packageJson] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/layout.tsx"),
    read("../package.json"),
  ]);
  assert.match(page, /little agent who starts in your control room/i);
  assert.match(page, /Create my Nook/i);
  assert.match(page, /Exact<\/b> approvals/i);
  assert.match(layout, /Nook/);
  assert.doesNotMatch(page + layout + packageJson, /Codex is working|react-loading-skeleton|codex-preview/i);
  assert.doesNotMatch(page, /work across the apps|Publish rig-validated Nooks|same bot with a color filter/i);
});

test("creator and control room use real account APIs", async () => {
  const [creator, dashboard, taskRoute, taskRunRoute, taskExecutor, memoryRoute, nookRoute, claimMigration] = await Promise.all([
    read("../app/create/page.tsx"),
    read("../app/dashboard/DashboardClient.tsx"),
    read("../app/api/tasks/route.ts"),
    read("../app/api/tasks/[taskId]/run/route.ts"),
    read("../lib/server/execute-task.ts"),
    read("../app/api/memories/route.ts"),
    read("../app/api/nooks/route.ts"),
    read("../supabase/migrations/20260712000100_supervised_agent_mvp.sql"),
  ]);
  assert.match(creator, /Continue with Google/);
  assert.match(creator, /Continue with GitHub/);
  assert.match(creator, /fetch\("\/api\/nooks"/);
  assert.match(dashboard, /fetch\("\/api\/tasks"/);
  assert.match(dashboard, /decideApproval/);
  assert.match(dashboard, /Execute saved tool/);
  assert.match(dashboard, /What .* knows/);
  assert.match(dashboard, /api\/integrations\/google/);
  assert.match(taskRoute, /createTaskPlan/);
  assert.match(taskRoute, /nook_create_supervised_task/);
  assert.match(taskRoute, /getServerIdentity/);
  assert.match(nookRoute, /getServerIdentity/);
  assert.match(taskRunRoute, /executeTask/);
  assert.match(taskExecutor, /nook_claim_supervised_run/);
  assert.match(taskExecutor, /runProductTask/);
  assert.match(memoryRoute, /nook_memories/);
  assert.match(creator, /explanationDepth/);
  assert.match(claimMigration, /for update/);
  assert.doesNotMatch(claimMigration, /p_keep_approval/);
  assert.doesNotMatch(taskRoute + nookRoute, /getDb|drizzle-orm/);
  assert.doesNotMatch(dashboard, /setTimeout\(\(\) => setMessage/);
});

test("supervised tool execution is allowlisted, hash-bound, and receipt-backed", async () => {
  const [registry, executor, migration, approval, authCallback] = await Promise.all([
    read("../lib/agent/tools/registry.ts"),
    read("../lib/server/execute-task.ts"),
    read("../supabase/migrations/20260712000100_supervised_agent_mvp.sql"),
    read("../app/api/tasks/[taskId]/approvals/[approvalId]/route.ts"),
    read("../app/auth/callback/route.ts"),
  ]);
  for (const tool of ["create_draft", "open_supported_url", "guided_workflow", "save_nook_preference"]) assert.match(registry, new RegExp(tool));
  assert.match(registry, /Unknown or disabled tool/);
  assert.match(executor, /action\.actionHash !== plannedStep\.action_hash/);
  assert.match(executor, /nook_finish_supervised_run/);
  assert.match(migration, /create table if not exists public\.task_events/);
  assert.match(migration, /private\.nook_verify_server_signature/);
  assert.match(migration, /The allowlisted tool completed and its result was verified/);
  assert.match(approval, /nook_decide_approval/);
  assert.doesNotMatch(approval, /nook_decide_simulated_approval/);
  assert.match(authCallback, /safeAppPath/);
});
