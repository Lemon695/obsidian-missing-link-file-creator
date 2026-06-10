import test from "node:test";
import assert from "node:assert/strict";

import { FileOperations } from "../src/utils/file-operations";
import { TemplaterService } from "../src/service/templater-service";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeSettings(overrides = {}) {
  return {
    createFileSetting: "default",
    showCreateFileNotification: true,
    defaultFolderPath: "",
    addAliasesToFrontmatter: true,
    useTemplates: false,
    defaultTemplatePath: "",
    templateFolder: "",
    templaterMethod: "execute" as const,
    useRules: false,
    rules: [],
    autoTagging: false,
    autoTaggingMinConfidence: 0.7,
    debugMode: false,
    ignoreList: [],
    ...overrides,
  };
}

function makeApp() {
  return {
    vault: {
      getFiles: () => [],
      getAbstractFileByPath: () => null,
      getMarkdownFiles: () => [],
    },
    metadataCache: {
      getFileCache: () => null,
    },
    workspace: {
      getActiveFile: () => null,
    },
    fileManager: {},
    plugins: { plugins: {} },
  } as any;
}

function makeFileOps() {
  return new FileOperations({ app: makeApp(), settings: makeSettings() });
}

// ─── M5-1: extractFrontmatterLinks ───────────────────────────────────────────

test("extractFrontmatterLinks: extracts [[link]] from a string value", () => {
  const ops = makeFileOps();
  const fm = { related: "[[Note A]]" };
  const links = ops.extractFrontmatterLinks(fm, "source.md");
  assert.equal(links.length, 1);
  assert.equal(links[0].filename, "Note A");
  assert.equal(links[0].sourcePath, "source.md");
});

test("extractFrontmatterLinks: extracts multiple links from one string value", () => {
  const ops = makeFileOps();
  const fm = { related: "[[Note A]] and [[Note B]]" };
  const links = ops.extractFrontmatterLinks(fm, "source.md");
  assert.equal(links.length, 2);
  const names = links.map((l) => l.filename).sort();
  assert.deepEqual(names, ["Note A", "Note B"]);
});

test("extractFrontmatterLinks: extracts from array values", () => {
  const ops = makeFileOps();
  const fm = { related: ["[[Note A]]", "[[Note B]]"] };
  const links = ops.extractFrontmatterLinks(fm);
  assert.equal(links.length, 2);
});

test("extractFrontmatterLinks: extracts from nested object values", () => {
  const ops = makeFileOps();
  const fm = { meta: { link: "[[Nested Note]]" } };
  const links = ops.extractFrontmatterLinks(fm);
  assert.equal(links.length, 1);
  assert.equal(links[0].filename, "Nested Note");
});

test("extractFrontmatterLinks: returns empty array when no links", () => {
  const ops = makeFileOps();
  const fm = { title: "no links here", count: 42 };
  const links = ops.extractFrontmatterLinks(fm as any);
  assert.equal(links.length, 0);
});

test("extractFrontmatterLinks: handles link with alias", () => {
  const ops = makeFileOps();
  const fm = { related: "[[Note A|Display Name]]" };
  const links = ops.extractFrontmatterLinks(fm);
  assert.equal(links.length, 1);
  assert.equal(links[0].filename, "Note A");
  assert.equal(links[0].alias, "Display Name");
});

test("extractFrontmatterLinks: ignores number and boolean values", () => {
  const ops = makeFileOps();
  const fm = { count: 5, flag: true, link: "[[Real Note]]" };
  const links = ops.extractFrontmatterLinks(fm as any);
  assert.equal(links.length, 1);
  assert.equal(links[0].filename, "Real Note");
});

// ─── M5-3: processBasicTemplate — new variables ───────────────────────────────

function makeTemplaterService() {
  return new TemplaterService(makeApp(), makeSettings(), {} as any);
}

test("processBasicTemplate: replaces {{alias}} with first alias", () => {
  const svc = makeTemplaterService();
  const result = svc.processBasicTemplate(
    "alias: {{alias}}",
    { filename: "Note", path: "Note.md", aliases: "MyAlias, Second", alias: "MyAlias" }
  );
  assert.equal(result, "alias: MyAlias");
});

test("processBasicTemplate: {{alias}} is empty string when no aliases", () => {
  const svc = makeTemplaterService();
  const result = svc.processBasicTemplate(
    "alias: {{alias}}",
    { filename: "Note", path: "Note.md", aliases: "", alias: "" }
  );
  assert.equal(result, "alias: ");
});

test("processBasicTemplate: replaces {{rule_name}}", () => {
  const svc = makeTemplaterService();
  const result = svc.processBasicTemplate(
    "rule: {{rule_name}}",
    { filename: "Note", path: "Note.md", aliases: "", rule_name: "My Rule" }
  );
  assert.equal(result, "rule: My Rule");
});

test("processBasicTemplate: replaces {{link_text}}", () => {
  const svc = makeTemplaterService();
  const result = svc.processBasicTemplate(
    "link: {{link_text}}",
    { filename: "Note", path: "Note.md", aliases: "", link_text: "original link" }
  );
  assert.equal(result, "link: original link");
});

test("processBasicTemplate: replaces {{source_file}} and {{source_path}}", () => {
  const svc = makeTemplaterService();
  const result = svc.processBasicTemplate(
    "from: {{source_file}} at {{source_path}}",
    {
      filename: "Note",
      path: "Note.md",
      aliases: "",
      source_file: "Parent",
      source_path: "Parent.md",
    }
  );
  assert.equal(result, "from: Parent at Parent.md");
});

test("expandTemplateVariables fills rule_name/link_text as empty string when not provided", () => {
  const svc = makeTemplaterService();
  // processBasicTemplate calls expandTemplateVariables internally
  const result = svc.processBasicTemplate(
    "{{rule_name}}|{{link_text}}",
    { filename: "x", path: "x.md", aliases: "" }
  );
  // Both should be replaced with empty string (not left as {{...}})
  assert.equal(result, "|");
});
