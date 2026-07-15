import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Browser Hand manifest is MV3 and least privilege", async () => {
  const manifest = JSON.parse(await read("../browser-extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "storage"]);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
  for (const permission of [
    "tabs",
    "history",
    "cookies",
    "webRequest",
    "debugger",
    "scripting",
  ])
    assert.equal(manifest.permissions.includes(permission), false);
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
});

test("Browser Hand executes data commands without arbitrary code hooks", async () => {
  const worker = await read("../browser-extension/service-worker.js");
  assert.match(worker, /chrome\.tabs\.create/);
  assert.match(worker, /expectedUrl\(command\.action\)/);
  assert.doesNotMatch(worker, /\beval\s*\(/);
  assert.doesNotMatch(worker, /new Function\s*\(/);
  assert.doesNotMatch(worker, /executeScript/);
  assert.doesNotMatch(worker, /document\.cookie/);
});

