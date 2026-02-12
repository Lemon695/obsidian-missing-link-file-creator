import test from "node:test";
import assert from "node:assert/strict";

import { RuleManager } from "../src/model/rule-manager";
import { ConditionMatchType, ConditionOperator } from "../src/model/condition-types";

function createSettings() {
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
    rules: [],
    autoTagging: false,
    autoTaggingMinConfidence: 0.7,
    debugMode: false,
    ignoreList: [],
  };
}

test("RuleManager: priority smaller number wins", () => {
  const settings = createSettings();
  settings.rules = [
    {
      id: "r-low",
      name: "low-priority",
      enabled: true,
      priority: 10,
      targetFolder: "FolderB",
      templatePath: "b.md",
      conditions: [
        { id: "c1", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND },
      ],
    },
    {
      id: "r-high",
      name: "high-priority",
      enabled: true,
      priority: 1,
      targetFolder: "FolderA",
      templatePath: "a.md",
      conditions: [
        { id: "c2", type: ConditionMatchType.CONTAINS, pattern: "Note", operator: ConditionOperator.AND },
      ],
    },
  ];

  const manager = new RuleManager({} as never, settings);
  const result = manager.matchRule("MyNote");

  assert.equal(result.matched, true);
  assert.equal(result.rule?.id, "r-high");
  assert.equal(result.targetFolder, "FolderA");
});

test("RuleManager: OR fallback works when no AND condition", () => {
  const settings = createSettings();
  settings.rules = [
    {
      id: "r-or",
      name: "or-rule",
      enabled: true,
      priority: 1,
      targetFolder: "Target",
      templatePath: "tmp.md",
      conditions: [
        { id: "c1", type: ConditionMatchType.STARTS_WITH, pattern: "Char", operator: ConditionOperator.OR },
        { id: "c2", type: ConditionMatchType.ENDS_WITH, pattern: "_NPC", operator: ConditionOperator.OR },
      ],
    },
  ];

  const manager = new RuleManager({} as never, settings);
  const result = manager.matchRule("My_NPC");

  assert.equal(result.matched, true);
  assert.equal(result.rule?.id, "r-or");
});

test("RuleManager: NOT and EXCLUDE block a positive match", () => {
  const settings = createSettings();
  settings.rules = [
    {
      id: "r-block",
      name: "blocked-rule",
      enabled: true,
      priority: 1,
      targetFolder: "Target",
      templatePath: "tmp.md",
      conditions: [
        { id: "c1", type: ConditionMatchType.CONTAINS, pattern: "Quest", operator: ConditionOperator.AND },
        { id: "c2", type: ConditionMatchType.CONTAINS, pattern: "Archive", operator: ConditionOperator.NOT },
      ],
    },
  ];

  const manager = new RuleManager({} as never, settings);

  assert.equal(manager.matchRule("Quest-New").matched, true);
  assert.equal(manager.matchRule("Quest-Archive").matched, false);
});

test("RuleManager: frontmatter condition matches array values", () => {
  const settings = createSettings();
  settings.rules = [
    {
      id: "r-frontmatter",
      name: "frontmatter-rule",
      enabled: true,
      priority: 1,
      targetFolder: "People",
      templatePath: "person.md",
      conditions: [
        {
          id: "c1",
          type: ConditionMatchType.FRONTMATTER,
          property: "tags",
          pattern: "person",
          frontmatterMatchType: ConditionMatchType.EXACT,
          operator: ConditionOperator.AND,
        },
      ],
    },
  ];

  const manager = new RuleManager({} as never, settings);
  const result = manager.matchRule("Alice", {
    frontmatter: {
      tags: ["person", "npc"],
    },
  });

  assert.equal(result.matched, true);
  assert.equal(result.rule?.id, "r-frontmatter");
});
