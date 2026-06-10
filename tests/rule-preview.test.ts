import { test } from "node:test";
import assert from "node:assert/strict";
import type { FileCreationRule } from "../src/model/rule-types";
import { ConditionMatchType, ConditionOperator } from "../src/model/condition-types";
import { RuleManager } from "../src/model/rule-manager";
import { computeRulePreview } from "../src/model/rule-preview";

const r = (over: Partial<FileCreationRule>): FileCreationRule => ({
  id: "", name: "", enabled: true, conditions: [],
  targetFolder: "", templatePath: "", priority: 0, ...over,
});

function mkSettings(rules: FileCreationRule[]) {
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

const mgr = (rules: FileCreationRule[]) =>
  new RuleManager({} as never, mkSettings(rules));

test("computeRulePreview 命中：返回 targetPath/templatePath/previewFrontmatter", () => {
  const rule = r({
    id: "p", name: "person", targetFolder: "People", templatePath: "tpl/person.md",
    extraFrontmatter: { type: "person" },
    conditions: [{ id: "c", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND }],
  });
  const out = computeRulePreview(mgr([rule]), "MyNote");
  assert.equal(out.hit, true);
  assert.equal(out.targetPath, "People/MyNote");
  assert.equal(out.templatePath, "tpl/person.md");
  assert.deepEqual(out.previewFrontmatter, { type: "person" });
});

test("computeRulePreview 命中但无目标文件夹：targetPath 仅文件名", () => {
  const rule = r({
    id: "p", targetFolder: "", templatePath: "",
    conditions: [{ id: "c", type: ConditionMatchType.CONTAINS, pattern: "x", operator: ConditionOperator.AND }],
  });
  const out = computeRulePreview(mgr([rule]), "xyz");
  assert.equal(out.hit, true);
  assert.equal(out.targetPath, "xyz");
  assert.equal(out.templatePath, undefined);
});

test("computeRulePreview 命中：targetFolder 尾部斜杠被归一化", () => {
  const rule = r({
    id: "p", targetFolder: "People/",
    conditions: [{ id: "c", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND }],
  });
  const out = computeRulePreview(mgr([rule]), "MyNote");
  assert.equal(out.targetPath, "People/MyNote");
});

test("computeRulePreview 未命中：hit=false，无 targetPath", () => {
  const rule = r({
    id: "p", targetFolder: "People",
    conditions: [{ id: "c", type: ConditionMatchType.CONTAINS, pattern: "Person", operator: ConditionOperator.AND }],
  });
  const out = computeRulePreview(mgr([rule]), "Unrelated");
  assert.equal(out.hit, false);
  assert.equal(out.targetPath, undefined);
  assert.equal(out.templatePath, undefined);
  assert.equal(out.previewFrontmatter, undefined);
});

test("computeRulePreview 经 frontmatter 命中", () => {
  const rule = r({
    id: "fm", targetFolder: "People", templatePath: "person.md",
    conditions: [{
      id: "c", type: ConditionMatchType.FRONTMATTER, property: "tags", pattern: "person",
      frontmatterMatchType: ConditionMatchType.EXACT, operator: ConditionOperator.AND,
    }],
  });
  const out = computeRulePreview(mgr([rule]), "Alice", { tags: ["person", "npc"] });
  assert.equal(out.hit, true);
  assert.equal(out.targetPath, "People/Alice");
});

test("computeRulePreview 空样例名：hit=false", () => {
  const rule = r({ id: "p", conditions: [{ id: "c", type: ConditionMatchType.CONTAINS, pattern: "a", operator: ConditionOperator.AND }] });
  const out = computeRulePreview(mgr([rule]), "   ");
  assert.equal(out.hit, false);
});
