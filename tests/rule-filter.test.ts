import { test } from 'node:test';
import assert from 'node:assert';
import type { FileCreationRule } from '../src/model/rule-types';
import { filterRules } from '../src/utils/rule-filter';

const r = (over: Partial<FileCreationRule>): FileCreationRule => ({
  id: '', name: '', enabled: true, conditions: [],
  targetFolder: '', templatePath: '', priority: 0, ...over,
});

const rules: FileCreationRule[] = [
  r({ id: 'a', enabled: true, templatePath: 'tpl/a.md' }),
  r({ id: 'b', enabled: false, templatePath: 'tpl/b.md' }),
  r({ id: 'c', enabled: true, templatePath: '' }),       // 无模板
  r({ id: 'd', enabled: false, templatePath: '' }),      // 禁用 + 无模板
];

test("filterRules all 返回全部", () => {
  assert.deepEqual(filterRules(rules, 'all').map(x => x.id), ['a', 'b', 'c', 'd']);
});

test("filterRules enabled 仅启用", () => {
  assert.deepEqual(filterRules(rules, 'enabled').map(x => x.id), ['a', 'c']);
});

test("filterRules disabled 仅禁用", () => {
  assert.deepEqual(filterRules(rules, 'disabled').map(x => x.id), ['b', 'd']);
});

test("filterRules noTemplate 仅无模板（templatePath 为空）", () => {
  assert.deepEqual(filterRules(rules, 'noTemplate').map(x => x.id), ['c', 'd']);
});

test("filterRules 不 mutate 入参，返回新数组", () => {
  const copy = JSON.parse(JSON.stringify(rules));
  const out = filterRules(rules, 'enabled');
  assert.deepEqual(rules, copy);
  assert.notStrictEqual(out, rules);
});
