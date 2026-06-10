import type { FileCreationRule } from "./rule-types";

/**
 * 将规则从 fromIndex 移动到 toIndex，并按新数组顺序重写 priority。
 *
 * - priority 采用 **0-based**（`priority = index`），与代码库其余处一致
 *   （createNewRule 用 rules.length、deleteRule 重排为 i、列表行显示 priority+1）。
 * - 数字越小优先级越高：置顶（index 0）= 最小 priority = `RuleManager.matchRule`
 *   升序排序后最先命中。
 * - toIndex 越界自动 clamp 到 [0, length-1]；fromIndex 非法时返回原顺序的副本。
 *
 * 纯函数：是（不 mutate 入参数组，也不 mutate 元素对象；返回全新数组与新对象）。
 */
export function reorderRules(
  rules: FileCreationRule[],
  fromIndex: number,
  toIndex: number
): FileCreationRule[] {
  const reindex = (list: FileCreationRule[]): FileCreationRule[] =>
    list.map((rule, i) => ({ ...rule, priority: i }));

  if (fromIndex < 0 || fromIndex >= rules.length) {
    // 非法源索引：返回原顺序副本（priority 也归一化，避免脏数据外泄）
    return reindex(rules);
  }

  const clampedTo = Math.max(0, Math.min(toIndex, rules.length - 1));
  const next = [...rules];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(clampedTo, 0, moved);
  return reindex(next);
}
