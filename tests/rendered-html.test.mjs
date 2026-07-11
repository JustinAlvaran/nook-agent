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
  assert.match(page, /little agent who lives on your desktop/i);
  assert.match(page, /Create my Nook/i);
  assert.match(page, /Explicit<\/b> approvals/i);
  assert.match(layout, /Nook/);
  assert.doesNotMatch(page + layout + packageJson, /Codex is working|react-loading-skeleton|codex-preview/i);
});

test("creator and control room use real account APIs", async () => {
  const [creator, dashboard, taskRoute, taskRunRoute, memoryRoute, nookRoute, claimMigration] = await Promise.all([
    read("../app/create/page.tsx"),
    read("../app/dashboard/DashboardClient.tsx"),
    read("../app/api/tasks/route.ts"),
    read("../app/api/tasks/[taskId]/run/route.ts"),
    read("../app/api/memories/route.ts"),
    read("../app/api/nooks/route.ts"),
    read("../supabase/migrations/20260711000600_task_run_claims.sql"),
  ]);
  assert.match(creator, /Continue with Google/);
  assert.match(creator, /Continue with GitHub/);
  assert.match(creator, /fetch\("\/api\/nooks"/);
  assert.match(dashboard, /fetch\("\/api\/tasks"/);
  assert.match(dashboard, /decideApproval/);
  assert.match(dashboard, /Work on this task/);
  assert.match(dashboard, /What .* knows/);
  assert.match(dashboard, /api\/integrations\/google/);
  assert.match(taskRoute, /createTaskPlan/);
  assert.match(taskRoute, /nook_create_planned_task/);
  assert.match(taskRoute, /getServerIdentity/);
  assert.match(nookRoute, /getServerIdentity/);
  assert.match(taskRunRoute, /nook_claim_task_run/);
  assert.match(taskRunRoute, /runProductTask/);
  assert.match(memoryRoute, /nook_memories/);
  assert.match(creator, /explanationDepth/);
  assert.match(claimMigration, /for update/);
  assert.doesNotMatch(claimMigration, /p_keep_approval/);
  assert.doesNotMatch(taskRoute + nookRoute, /getDb|drizzle-orm/);
  assert.doesNotMatch(dashboard, /setTimeout\(\(\) => setMessage/);
});
