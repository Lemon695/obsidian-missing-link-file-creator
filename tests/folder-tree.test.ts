import { test } from "node:test";
import assert from "node:assert/strict";
import type { FileCreationRule } from "../src/model/rule-types";
import { buildFolderTree, type FolderTreeNode } from "../src/utils/folder-tree";

const r = (targetFolder: string): FileCreationRule => ({
  id: "", name: "", enabled: true, conditions: [],
  targetFolder, templatePath: "", priority: 0,
});

// ── buildFolderTree ──

test("buildFolderTree: 单层路径 → 一个根节点，无子节点", () => {
  const tree = buildFolderTree([r("日记")]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "日记");
  assert.equal(tree[0].path, "日记");
  assert.deepEqual(tree[0].children, []);
});

test("buildFolderTree: 两层路径 → 根+子", () => {
  const tree = buildFolderTree([r("日记/2026")]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "日记");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].name, "2026");
  assert.equal(tree[0].children[0].path, "日记/2026");
});

test("buildFolderTree: 同父目录多条规则 → 路径合并，不重复", () => {
  const tree = buildFolderTree([r("拆书/大宣武圣/A"), r("拆书/大宣武圣/B")]);
  assert.equal(tree.length, 1);                        // 只有一个根 "拆书"
  assert.equal(tree[0].children.length, 1);            // 只有一个 "大宣武圣"
  assert.equal(tree[0].children[0].children.length, 2); // A 和 B
  const names = tree[0].children[0].children.map((c) => c.name);
  assert.deepEqual(names.sort(), ["A", "B"]);
});

test("buildFolderTree: 不同根目录 → 多根节点", () => {
  const tree = buildFolderTree([r("日记/2026"), r("小说/剧情")]);
  assert.equal(tree.length, 2);
  const roots = tree.map((n) => n.name).sort();
  assert.deepEqual(roots, ["小说", "日记"]);
});

test("buildFolderTree: 空目标文件夹 → 忽略", () => {
  const tree = buildFolderTree([r(""), r("  "), r("日记")]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "日记");
});

test("buildFolderTree: 不修改入参", () => {
  const rules = [r("a/b"), r("a/c")];
  const snap = JSON.stringify(rules);
  buildFolderTree(rules);
  assert.equal(JSON.stringify(rules), snap);
});

test("buildFolderTree: 空数组 → 空树", () => {
  assert.deepEqual(buildFolderTree([]), []);
});

test("buildFolderTree: 三层路径 → 正确嵌套", () => {
  const tree = buildFolderTree([r("a/b/c/d")]);
  assert.equal(tree[0].name, "a");
  assert.equal(tree[0].children[0].name, "b");
  assert.equal(tree[0].children[0].children[0].name, "c");
  assert.equal(tree[0].children[0].children[0].children[0].name, "d");
  assert.equal(tree[0].children[0].children[0].children[0].path, "a/b/c/d");
});

test("buildFolderTree: 首尾斜杠被归一化", () => {
  const tree = buildFolderTree([r("/日记/2026/")]);
  assert.equal(tree[0].name, "日记");
  assert.equal(tree[0].children[0].name, "2026");
});
