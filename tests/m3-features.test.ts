import test from "node:test";
import assert from "node:assert/strict";

import { RuleManager } from "../src/model/rule-manager";
import { ConditionMatchType, ConditionOperator } from "../src/model/condition-types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSettings(rules = []) {
  return {
    createFileSetting: "default",
    showCreateFileNotification: true,
    defaultFolderPath: "",
    addAliasesToFrontmatter: true,
    useTemplates: false,
    defaultTemplatePath: "",
    templateFolder: "",
    templaterMethod: "execute" as const,
    useRules: true,
    rules,
    autoTagging: false,
    autoTaggingMinConfidence: 0.7,
    debugMode: false,
    ignoreList: [],
  };
}

function makeRule(id: string, name = id) {
  return {
    id,
    name,
    enabled: true,
    priority: 0,
    conditions: [
      { id: "c1", type: ConditionMatchType.CONTAINS, pattern: "test", operator: ConditionOperator.AND },
    ],
    targetFolder: "notes",
    templatePath: "",
  };
}

// ─── RuleManager.exportRules ──────────────────────────────────────────────────

test("exportRules: returns valid JSON string", () => {
  const settings = makeSettings([makeRule("r1")]);
  const mgr = new RuleManager({} as any, settings);
  const json = mgr.exportRules();
  const parsed = JSON.parse(json);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "r1");
});

test("exportRules: empty rules list returns []", () => {
  const settings = makeSettings([]);
  const mgr = new RuleManager({} as any, settings);
  const json = mgr.exportRules();
  assert.deepEqual(JSON.parse(json), []);
});

// ─── RuleManager.importRules (overwrite) ──────────────────────────────────────

test("importRules overwrite: replaces all existing rules", () => {
  const settings = makeSettings([makeRule("r1"), makeRule("r2")]);
  const mgr = new RuleManager({} as any, settings);
  const incoming = [makeRule("r3"), makeRule("r4")];
  mgr.importRules(JSON.stringify(incoming), "overwrite");
  const all = mgr.getAllRules();
  assert.equal(all.length, 2);
  assert.equal(all[0].id, "r3");
  assert.equal(all[1].id, "r4");
});

test("importRules overwrite: works when existing list is empty", () => {
  const settings = makeSettings([]);
  const mgr = new RuleManager({} as any, settings);
  mgr.importRules(JSON.stringify([makeRule("r1")]), "overwrite");
  assert.equal(mgr.getAllRules().length, 1);
});

// ─── RuleManager.importRules (merge) ─────────────────────────────────────────

test("importRules merge: skips rules with duplicate ids", () => {
  const settings = makeSettings([makeRule("r1")]);
  const mgr = new RuleManager({} as any, settings);
  const incoming = [makeRule("r1"), makeRule("r2")]; // r1 already exists
  mgr.importRules(JSON.stringify(incoming), "merge");
  const all = mgr.getAllRules();
  assert.equal(all.length, 2);
  assert.equal(all.find((r) => r.id === "r1")?.name, "r1"); // original kept
  assert.ok(all.find((r) => r.id === "r2")); // new one added
});

test("importRules merge: adds all when no overlap", () => {
  const settings = makeSettings([makeRule("r1")]);
  const mgr = new RuleManager({} as any, settings);
  mgr.importRules(JSON.stringify([makeRule("r2"), makeRule("r3")]), "merge");
  assert.equal(mgr.getAllRules().length, 3);
});

// ─── RuleManager.importRules (format validation) ──────────────────────────────

test("importRules: throws on invalid JSON", () => {
  const settings = makeSettings([]);
  const mgr = new RuleManager({} as any, settings);
  assert.throws(() => mgr.importRules("not json", "overwrite"), /Invalid JSON format/);
});

test("importRules: throws when root is not an array", () => {
  const settings = makeSettings([]);
  const mgr = new RuleManager({} as any, settings);
  assert.throws(() => mgr.importRules(JSON.stringify({ id: "r1" }), "overwrite"), /Expected an array/);
});

test("importRules: throws when a rule is missing required fields", () => {
  const settings = makeSettings([]);
  const mgr = new RuleManager({} as any, settings);
  const bad = [{ enabled: true }]; // no id or name
  assert.throws(() => mgr.importRules(JSON.stringify(bad), "overwrite"), /id and name/);
});

// ─── IgnoreListManager.clear ─────────────────────────────────────────────────

test("IgnoreListManager clear: removes all items and saves", async () => {
  // Inline a minimal stub — avoids needing a real Obsidian App
  const written: string[] = [];
  const stubApp = {
    vault: {
      adapter: {
        exists: async () => false,
        read: async () => "[]",
        write: async (_p: string, content: string) => { written.push(content); },
      },
    },
  };
  const stubManifest = { dir: ".obsidian/plugins/test-plugin" };

  // Dynamically require to avoid module-level Obsidian import issues
  const { IgnoreListManager } = await import("../src/service/ignore-list-manager");
  const mgr = new IgnoreListManager(stubApp as any, stubManifest);

  // Manually seed internal state via add() — loadIgnoreList is a no-op (file doesn't exist)
  await mgr.add("link-a");
  await mgr.add("link-b");
  assert.equal(mgr.getIgnoreList().length, 2);

  await mgr.clear();
  assert.equal(mgr.getIgnoreList().length, 0);

  // Should have written an empty array to disk
  const lastWrite = written[written.length - 1];
  assert.deepEqual(JSON.parse(lastWrite), []);
});
