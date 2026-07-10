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
  const [creator, dashboard, taskRoute, nookRoute] = await Promise.all([
    read("../app/create/page.tsx"),
    read("../app/dashboard/page.tsx"),
    read("../app/api/tasks/route.ts"),
    read("../app/api/nooks/route.ts"),
  ]);
  assert.match(creator, /Save with ChatGPT/);
  assert.match(creator, /fetch\("\/api\/nooks"/);
  assert.match(dashboard, /fetch\("\/api\/tasks"/);
  assert.match(taskRoute, /createTaskPlan/);
  assert.match(taskRoute, /getServerIdentity/);
  assert.match(nookRoute, /getServerIdentity/);
  assert.doesNotMatch(dashboard, /setTimeout\(\(\) => setMessage/);
});
