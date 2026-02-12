import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("TemplateSelectionModal uses React bridge", () => {
  const source = read("src/ui-manager/template-selection-modal.ts");
  assert.match(source, /createRoot/);
  assert.match(source, /TemplatePickerDialog/);
  assert.match(source, /ccmd-react-root/);
});

test("TemplateBrowserModal uses React bridge", () => {
  const source = read("src/ui-manager/template-browser-modal.ts");
  assert.match(source, /createRoot/);
  assert.match(source, /TemplatePickerDialog/);
  assert.match(source, /ccmd-react-root/);
});

test("GenericInputPrompt uses React bridge and preserves Promise API", () => {
  const source = read("src/ui-manager/generic-input-prompt.ts");
  assert.match(source, /public\s+waitForClose:\s*Promise<string>/);
  assert.match(source, /static\s+Prompt\(/);
  assert.match(source, /createRoot/);
  assert.match(source, /GenericInputDialog/);
});
