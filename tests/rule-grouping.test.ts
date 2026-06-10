import { test } from "node:test";
import assert from "node:assert/strict";
import type { FileCreationRule } from "../src/model/rule-types";
import { deriveGroupKey, groupRules } from "../src/utils/rule-grouping";

const r = (over: Partial<FileCreationRule>): FileCreationRule => ({
  id: "", name: "", enabled: true, conditions: [],
  targetFolder: "", templatePath: "", priority: 0, ...over,
});

// ── deriveGroupKey ──
test("deriveGroupKey: 多段路径 → 父目录为 key，父目录末段为 label", () => {
  assert.deepEqual(
    deriveGroupKey("拆书-小说/大宣武圣/大宣武圣-01-钩子"),
    { key: "拆书-小说/大宣武圣", label: "大宣武圣" }
  );
});

test("deriveGroupKey: 归一化首尾斜杠", () => {
  assert.deepEqual(deriveGroupKey("/a/b/x/"), { key: "a/b", label: "b" });
});

test("deriveGroupKey: 单段路径 → 自身为 key 和 label", () => {
  assert.deepEqual(deriveGroupKey("01-日记"), { key: "01-日记", label: "01-日记" });
});

test("deriveGroupKey: 空/空白 → 空 key/label", () => {
  assert.deepEqual(deriveGroupKey(""), { key: "", label: "" });
  assert.deepEqual(deriveGroupKey("   "), { key: "", label: "" });
});

// ── groupRules ──
test("groupRules: 同父目录聚为一组，组内保序", () => {
  const rules = [
    r({ id: "a", targetFolder: "拆书/大宣武圣/钩子" }),
    r({ id: "b", targetFolder: "拆书/大宣武圣/事件" }),
  ];
  const groups = groupRules(rules);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "拆书/大宣武圣");
  assert.equal(groups[0].label, "大宣武圣");
  assert.deepEqual(groups[0].rules.map((x) => x.id), ["a", "b"]);
});

test("groupRules: 不同父目录分多组，按首次出现排序", () => {
  const rules = [
    r({ id: "a", targetFolder: "x/p1/leaf" }),
    r({ id: "b", targetFolder: "y/p2/leaf" }),
    r({ id: "c", targetFolder: "x/p1/leaf2" }),
  ];
  const groups = groupRules(rules);
  assert.deepEqual(groups.map((g) => g.key), ["x/p1", "y/p2"]);
  assert.deepEqual(groups[0].rules.map((x) => x.id), ["a", "c"]);
  assert.deepEqual(groups[1].rules.map((x) => x.id), ["b"]);
});

test("groupRules: 空目录归入 key='' 组", () => {
  const groups = groupRules([r({ id: "a", targetFolder: "" })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "");
});

test("groupRules: 不修改入参数组与元素", () => {
  const rules = [r({ id: "a", targetFolder: "x/p/leaf" })];
  const snapshot = JSON.stringify(rules);
  groupRules(rules);
  assert.equal(JSON.stringify(rules), snapshot);
});

test("groupRules: 空数组 → 空", () => {
  assert.deepEqual(groupRules([]), []);
});
