import { test } from "node:test";
import assert from "node:assert/strict";
import type { FileCreationRule } from "../src/model/rule-types";
import { ConditionMatchType, ConditionOperator } from "../src/model/condition-types";
import { RuleManager } from "../src/model/rule-manager";
import { reorderRules } from "../src/model/rule-reorder";

const r = (over: Partial<FileCreationRule>): FileCreationRule => ({
  id: "", name: "", enabled: true, conditions: [],
  targetFolder: "", templatePath: "", priority: 0, ...over,
});

const base: FileCreationRule[] = [
  r({ id: "a", priority: 0 }),
  r({ id: "b", priority: 1 }),
  r({ id: "c", priority: 2 }),
  r({ id: "d", priority: 3 }),
];

test("reorderRules 把元素从 from 移到 to，顺序正确", () => {
  // 把 d(index 3) 移到 index 0
  const out = reorderRules(base, 3, 0);
  assert.deepEqual(out.map((x) => x.id), ["d", "a", "b", "c"]);
});

test("reorderRules 向后移动", () => {
  // 把 a(index 0) 移到 index 2
  const out = reorderRules(base, 0, 2);
  assert.deepEqual(out.map((x) => x.id), ["b", "c", "a", "d"]);
});

test("reorderRules 按数组顺序重写 priority 为 0..N-1（0-based，与代码库一致）", () => {
  const out = reorderRules(base, 3, 0);
  assert.deepEqual(out.map((x) => x.priority), [0, 1, 2, 3]);
  // 置顶的 d 拿到全场最小 priority
  assert.equal(out[0].id, "d");
  assert.equal(out[0].priority, 0);
});

test("reorderRules 不 mutate 入参，返回新数组与新元素对象", () => {
  const copy = JSON.parse(JSON.stringify(base));
  const out = reorderRules(base, 3, 0);
  assert.deepEqual(base, copy); // 入参数组与元素均未变
  assert.notStrictEqual(out, base);
  out.forEach((rule) => assert.ok(!base.includes(rule))); // 元素是新对象
});

test("reorderRules 越界 toIndex 被 clamp 到合法范围", () => {
  const out = reorderRules(base, 0, 99);
  assert.deepEqual(out.map((x) => x.id), ["b", "c", "d", "a"]);
  const out2 = reorderRules(base, 0, -5);
  assert.deepEqual(out2.map((x) => x.id), ["a", "b", "c", "d"]);
});

test("reorderRules 非法 fromIndex 返回原顺序副本（不抛错）", () => {
  const out = reorderRules(base, 99, 0);
  assert.deepEqual(out.map((x) => x.id), ["a", "b", "c", "d"]);
  assert.notStrictEqual(out, base);
});

test("方向断言：拖到 index 0 后该规则 priority 最小，RuleManager 最先命中", () => {
  // 两条规则都匹配含 'Note' 的文件名，初始 A 在前(命中 A)
  const ruleA = r({
    id: "A", name: "A", priority: 0, targetFolder: "FolderA", templatePath: "a.md",
    conditions: [{ id: "ca", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND }],
  });
  const ruleB = r({
    id: "B", name: "B", priority: 1, targetFolder: "FolderB", templatePath: "b.md",
    conditions: [{ id: "cb", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND }],
  });

  const before = new RuleManager({} as never, { ...mkSettings(), rules: [ruleA, ruleB] });
  assert.equal(before.matchRule("MyNote").rule?.id, "A");

  // 把 B(index 1) 拖到 index 0
  const reordered = reorderRules([ruleA, ruleB], 1, 0);
  const after = new RuleManager({} as never, { ...mkSettings(), rules: reordered });
  assert.equal(after.matchRule("MyNote").rule?.id, "B");
});

function mkSettings() {
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
    rules: [] as FileCreationRule[],
    autoTagging: false,
    autoTaggingMinConfidence: 0.7,
    debugMode: false,
    ignoreList: [],
  };
}
