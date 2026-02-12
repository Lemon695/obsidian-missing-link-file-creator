import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { translations } from "../src/i18n/locale";

const ROOT = process.cwd();
const requiredKeys = [
  "openBatchOperationsDashboard",
  "openCurrentFileMissingLinksView",
  "confirm",
  "noTemplateFilesFound",
  "noMatchingTemplates",
  "searchTemplatesPlaceholder",
] as const;

test("Required i18n keys exist in en-GB and zh", () => {
  for (const key of requiredKeys) {
    assert.ok(translations["en-GB"][key], `missing en-GB key: ${key}`);
    assert.ok(translations.zh[key], `missing zh key: ${key}`);
  }
});

test("main.ts uses i18n keys for view commands", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/main.ts"), "utf8");
  assert.match(source, /t\('openBatchOperationsDashboard'\)/);
  assert.match(source, /t\('openCurrentFileMissingLinksView'\)/);
});
