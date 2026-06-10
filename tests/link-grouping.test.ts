import { test } from 'node:test';
import assert from 'node:assert';
import type { FileToCreate } from '../src/model/file-types';
import { groupMissingLinks } from '../src/utils/link-grouping';

const f = (over: Partial<FileToCreate>): FileToCreate => ({
  id: '', filename: '', path: '', selected: false, aliases: [], ...over,
});

test('groupMissingLinks 按 matchedRule 分 matched / unmatched，createdPaths 识别 created', () => {
  const files = [
    f({ id: 'a', filename: '赤焰马', path: '宠兽/赤焰马.md', matchedRule: '宠兽规则' }),
    f({ id: 'b', filename: '惊雷拳', path: '惊雷拳.md' }), // 无 matchedRule
    f({ id: 'c', filename: '苏长卿', path: '角色/苏长卿.md', matchedRule: '角色规则' }),
  ];
  const created = new Set<string>(['角色/苏长卿.md']);
  const g = groupMissingLinks(files, created);
  assert.deepEqual(g.matched.map(x => x.id), ['a']);   // 有规则且未创建
  assert.deepEqual(g.unmatched.map(x => x.id), ['b']); // 无规则且未创建
  assert.deepEqual(g.created.map(x => x.id), ['c']);   // path 在 createdPaths 中
});

test('groupMissingLinks 不 mutate 入参', () => {
  const files = [f({ id: 'a', path: 'x.md', matchedRule: 'r' })];
  const copy = JSON.parse(JSON.stringify(files));
  groupMissingLinks(files, new Set());
  assert.deepEqual(files, copy);
});

test('groupMissingLinks createdPaths 省略时全部按 matched/unmatched 归类', () => {
  const files = [
    f({ id: 'a', path: 'a.md', matchedRule: 'r' }),
    f({ id: 'b', path: 'b.md' }),
  ];
  const g = groupMissingLinks(files);
  assert.deepEqual(g.matched.map(x => x.id), ['a']);
  assert.deepEqual(g.unmatched.map(x => x.id), ['b']);
  assert.deepEqual(g.created.map(x => x.id), []);
});

test('groupMissingLinks created 优先于 matched/unmatched（已创建即归 created）', () => {
  const files = [
    f({ id: 'a', path: 'a.md', matchedRule: 'r' }), // 有规则但已创建
    f({ id: 'b', path: 'b.md' }),                   // 无规则但已创建
  ];
  const g = groupMissingLinks(files, new Set(['a.md', 'b.md']));
  assert.deepEqual(g.matched.map(x => x.id), []);
  assert.deepEqual(g.unmatched.map(x => x.id), []);
  assert.deepEqual(g.created.map(x => x.id), ['a', 'b']);
});
