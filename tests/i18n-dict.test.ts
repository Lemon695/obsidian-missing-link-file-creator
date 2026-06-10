/**
 * Tests for the I18nDict<T> overload of t().
 *
 * The t() function supports two call signatures:
 *   t(key: string)          — legacy flat-key lookup
 *   t(dict: I18nDict<T>)    — new typed dict lookup
 */

// Polyfill window.localStorage for Node.js test environment.
// getLocale() reads window.localStorage.getItem('language').
const _store: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => _store[key] ?? null,
    setItem: (key: string, val: string) => { _store[key] = val; },
    removeItem: (key: string) => { delete _store[key]; },
  },
  moment: undefined,
};

import test from "node:test";
import assert from "node:assert/strict";
import { t, type I18nDict } from "../src/i18n/locale";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const greetingDict: I18nDict<{ hello: string; bye: string }> = {
  zh: { hello: "你好", bye: "再见" },
  en: { hello: "Hello", bye: "Goodbye" },
};

const simpleDict: I18nDict<string> = {
  zh: "中文值",
  en: "English value",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

test("I18nDict: t(dict) returns an object with the correct locale keys", () => {
  const result = t(greetingDict);
  // Must be an object with 'hello' and 'bye' fields
  assert.ok(typeof result === "object");
  assert.ok("hello" in result);
  assert.ok("bye" in result);
});

test("I18nDict: t(dict) value is either zh or en branch (never both)", () => {
  const result = t(greetingDict);
  const isZh = result.hello === "你好";
  const isEn = result.hello === "Hello";
  assert.ok(isZh || isEn, `unexpected value: ${result.hello}`);
});

test("I18nDict: t(dict) with string value returns a string", () => {
  const result = t(simpleDict);
  assert.equal(typeof result, "string");
  const valid = result === "中文值" || result === "English value";
  assert.ok(valid, `unexpected value: ${result}`);
});

test("Legacy t(key) still works alongside I18nDict overload", () => {
  // 'confirm' is a well-known key that exists in the flat translations dict
  const result = t("confirm");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("I18nDict: each module's i18n dict resolves without throwing", async () => {
  // Dynamically import all module dicts and call t() on each
  const dicts = await Promise.all([
    import("../src/i18n/modules/scan/module").then((m) => m.scanModuleI18n),
    import("../src/i18n/modules/rule/module").then((m) => m.ruleModuleI18n),
    import("../src/i18n/modules/ignore/module").then((m) => m.ignoreModuleI18n),
    import("../src/i18n/modules/template/module").then((m) => m.templateModuleI18n),
    import("../src/i18n/modules/tag/module").then((m) => m.tagModuleI18n),
    import("../src/i18n/modules/sidebar/module").then((m) => m.sidebarModuleI18n),
    import("../src/i18n/modules/dashboard/module").then((m) => m.dashboardModuleI18n),
  ]);

  for (const dict of dicts) {
    const result = t(dict as I18nDict<any>);
    assert.ok(typeof result === "object", "expected object result");
    assert.ok("name" in result, "expected 'name' field");
    assert.ok(typeof (result as any).name === "string");
    assert.ok((result as any).name.length > 0);
  }
});
