import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("RuleManagementModal keeps bridge contract: currentInstance + refreshRulesList", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "src/ui-manager/rule-management-modal.ts"),
    "utf8"
  );

  assert.match(source, /public\s+static\s+currentInstance\s*:/);
  assert.match(source, /public\s+refreshRulesList\s*\(/);
});

test("ModularSettingTab keeps currentInstance + refreshRulesSummary contract", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "src/core/settings-tab.ts"),
    "utf8"
  );

  assert.match(source, /static\s+currentInstance\s*:/);
  assert.match(source, /refreshRulesSummary\s*\(/);
});

test("RuleEditModal refreshes both RuleManagementModal and ModularSettingTab after save", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "src/ui-manager/rule-edit-modal.ts"),
    "utf8"
  );

  assert.match(source, /RuleManagementModal\.currentInstance/);
  assert.match(source, /refreshRulesList\s*\(/);
  assert.match(source, /ModularSettingTab\.currentInstance/);
  assert.match(source, /refreshRulesSummary\s*\(/);
});
