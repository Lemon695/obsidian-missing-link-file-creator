/**
 * folder-tree.ts — 从规则的 targetFolder 列表构建嵌套目录树
 *
 * 纯函数：不修改入参，无副作用。
 */

import type { FileCreationRule } from "../model/rule-types";

export interface FolderTreeNode {
  name: string;
  path: string;
  children: FolderTreeNode[];
}

function normSeg(s: string): string {
  return s.trim().replace(/^\/+|\/+$/g, "");
}

/**
 * 把所有规则的 targetFolder 聚合为嵌套树。
 * 空/空白目录被忽略；相同路径只出现一次（多规则共享目录时合并）。
 */
export function buildFolderTree(rules: readonly FileCreationRule[]): FolderTreeNode[] {
  const roots: FolderTreeNode[] = [];
  const index = new Map<string, FolderTreeNode>();

  for (const rule of rules) {
    const normalized = normSeg(rule.targetFolder ?? "");
    if (!normalized) continue;

    const segs = normalized.split("/").filter((s) => s.length > 0);
    let current = roots;
    let pathSoFar = "";

    for (const seg of segs) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${seg}` : seg;
      let node = index.get(pathSoFar);
      if (!node) {
        node = { name: seg, path: pathSoFar, children: [] };
        index.set(pathSoFar, node);
        current.push(node);
      }
      current = node.children;
    }
  }

  return roots;
}
