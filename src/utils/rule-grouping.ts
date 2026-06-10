/**
 * rule-grouping.ts — 规则按目标文件夹「项目段」分组（Bold 规则管理 P1 地基）
 *
 * 纯函数：不修改入参，无副作用。
 * 分组键 = targetFolder 去掉最后一段（父目录）；标签 = 父目录的最后一段。
 * 例：`拆书-小说/大宣武圣/大宣武圣-01-钩子` → { key: '拆书-小说/大宣武圣', label: '大宣武圣' }
 * 单段路径自成一组；空目录归入 key='' 组（UI 标注为「其它」）。
 */

import type { FileCreationRule } from "../model/rule-types";

export interface RuleGroupKey {
  /** 分组身份（父目录路径，或单段自身，或 '' 表示未指定） */
  key: string;
  /** 展示标签（父目录末段，或单段自身，或 '' 由 UI 决定文案） */
  label: string;
}

export interface RuleGroup extends RuleGroupKey {
  rules: FileCreationRule[];
}

/** 从 targetFolder 推导分组键与标签（纯函数）。 */
export function deriveGroupKey(targetFolder: string): RuleGroupKey {
  const normalized = (targetFolder ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (normalized === "") return { key: "", label: "" };

  const segs = normalized.split("/").filter((s) => s.length > 0);
  if (segs.length <= 1) {
    return { key: normalized, label: normalized };
  }

  const parent = segs.slice(0, -1).join("/");
  const label = segs[segs.length - 2];
  return { key: parent, label };
}

/**
 * 把分组列表拍平为全局有序规则数组，同时重算 priority（0-based 连续）。
 * - 组间顺序 = 传入 groups 的顺序；组内顺序 = 传入 group.rules 的顺序。
 * - 不修改任何入参对象，返回带新 priority 的新规则副本。
 * - 用途：组内拖拽重排后调用此函数，回写 plugin.settings.rules。
 */
export function flattenGroupsToPriority(groups: readonly RuleGroup[]): FileCreationRule[] {
  const result: FileCreationRule[] = [];
  for (const group of groups) {
    for (const rule of group.rules) {
      result.push({ ...rule, priority: result.length });
    }
  }
  return result;
}

/**
 * 把规则按「项目段」分组。
 * - 组内保持输入顺序；组按首次出现顺序排列（稳定）。
 * - 不修改入参数组，也不修改规则对象。
 */
export function groupRules(rules: readonly FileCreationRule[]): RuleGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, RuleGroup>();

  for (const rule of rules) {
    const { key, label } = deriveGroupKey(rule.targetFolder);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, rules: [] };
      byKey.set(key, group);
      order.push(key);
    }
    group.rules.push(rule);
  }

  return order.map((key) => byKey.get(key)!);
}
