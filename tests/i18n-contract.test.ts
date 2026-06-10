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

test("module files define view open commands via i18n dictionaries", () => {
  const dashboard = fs.readFileSync(
    path.join(ROOT, "src/modules/dashboard/index.ts"),
    "utf8"
  );
  const sidebar = fs.readFileSync(
    path.join(ROOT, "src/modules/sidebar/index.ts"),
    "utf8"
  );
  assert.match(dashboard, /dashboardModuleI18n/);
  assert.match(sidebar, /sidebarModuleI18n/);
  assert.match(dashboard, /openCommand/);
  assert.match(sidebar, /openCommand/);
});
