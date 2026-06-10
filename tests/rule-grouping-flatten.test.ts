import { test } from "node:test";
import assert from "node:assert/strict";
import type { FileCreationRule } from "../src/model/rule-types";
import { flattenGroupsToPriority } from "../src/utils/rule-grouping";
import { groupRules } from "../src/utils/rule-grouping";

const r = (over: Partial<FileCreationRule>): FileCreationRule => ({
  id: "id", name: "", enabled: true, conditions: [],
  targetFolder: "", templatePath: "", priority: 0, ...over,
});

// ── flattenGroupsToPriority ──

test("flattenGroupsToPriority: 单组，优先级从 0 开始按顺序赋值", () => {
  const rules = [
    r({ id: "a", priority: 5 }),
    r({ id: "b", priority: 10 }),
    r({ id: "c", priority: 99 }),
  ];
  const groups = groupRules(rules);
  const result = flattenGroupsToPriority(groups);
  assert.deepEqual(result.map((x) => x.priority), [0, 1, 2]);
  assert.deepEqual(result.map((x) => x.id), ["a", "b", "c"]);
});

test("flattenGroupsToPriority: 多组，组间顺序保持，全局连续编号", () => {
  const rules = [
    r({ id: "a", targetFolder: "x/p1/leaf", priority: 0 }),
    r({ id: "b", targetFolder: "y/p2/leaf", priority: 1 }),
    r({ id: "c", targetFolder: "x/p1/leaf2", priority: 2 }),
  ];
  const groups = groupRules(rules);
  // groups[0] = x/p1 → [a, c], groups[1] = y/p2 → [b]
  const result = flattenGroupsToPriority(groups);
  // 拍平顺序：a(0), c(1), b(2)
  assert.deepEqual(result.map((x) => x.id), ["a", "c", "b"]);
  assert.deepEqual(result.map((x) => x.priority), [0, 1, 2]);
});

test("flattenGroupsToPriority: 不修改入参规则对象（immutable）", () => {
  const rules = [r({ id: "a", priority: 42 }), r({ id: "b", priority: 7 })];
  const groups = groupRules(rules);
  const snapshot = JSON.stringify(groups);
  flattenGroupsToPriority(groups);
  // 原始 groups 对象未被修改
  assert.equal(JSON.stringify(groups), snapshot);
  // 原始 rules 的 priority 未被修改
  assert.equal(rules[0].priority, 42);
  assert.equal(rules[1].priority, 7);
});

test("flattenGroupsToPriority: 返回新对象（不是同一引用）", () => {
  const rules = [r({ id: "a", priority: 0 })];
  const groups = groupRules(rules);
  const result = flattenGroupsToPriority(groups);
  // 返回的数组与原 groups[0].rules 不共享引用
  assert.notStrictEqual(result[0], groups[0].rules[0]);
});

test("flattenGroupsToPriority: 空数组 → 空", () => {
  assert.deepEqual(flattenGroupsToPriority([]), []);
});

test("flattenGroupsToPriority: 组内拖拽后重排 priority 语义正确（示例：b↔c 互换）", () => {
  // 模拟用户把同组内 b 拖到 a 前面后的 groups 状态
  const group = {
    key: "proj/sub", label: "sub",
    rules: [
      r({ id: "b", priority: 1 }),
      r({ id: "a", priority: 0 }),
      r({ id: "c", priority: 2 }),
    ],
  };
  const result = flattenGroupsToPriority([group]);
  // b 在前，所以 b.priority=0, a.priority=1, c.priority=2
  assert.deepEqual(result.find((x) => x.id === "b")!.priority, 0);
  assert.deepEqual(result.find((x) => x.id === "a")!.priority, 1);
  assert.deepEqual(result.find((x) => x.id === "c")!.priority, 2);
});

test("flattenGroupsToPriority: 多组拖拽后全局 priority 连续无间隙", () => {
  // 两个组，各自内部顺序已被调整
  const groups = [
    { key: "g1", label: "g1", rules: [r({ id: "x2", priority: 2 }), r({ id: "x1", priority: 0 })] },
    { key: "g2", label: "g2", rules: [r({ id: "y1", priority: 1 }), r({ id: "y2", priority: 3 })] },
  ];
  const result = flattenGroupsToPriority(groups);
  const priorities = result.map((x) => x.priority);
  // 必须是 [0,1,2,3]，连续无间隙
  assert.deepEqual(priorities, [0, 1, 2, 3]);
});
