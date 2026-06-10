import type { FileCreationRule } from "../model/rule-types";

/** 规则筛选模式 */
export type RuleFilterMode = "all" | "enabled" | "disabled" | "noTemplate";

/**
 * 按筛选模式过滤规则列表。
 *
 * - all：返回全部
 * - enabled：仅 enabled === true
 * - disabled：仅 enabled === false
 * - noTemplate：仅 templatePath 为空（未配置模板）
 *
 * 纯函数：是（不 mutate 入参，返回全新数组）。
 */
export function filterRules(
	rules: FileCreationRule[],
	mode: RuleFilterMode
): FileCreationRule[] {
	switch (mode) {
		case "enabled":
			return rules.filter((rule) => rule.enabled);
		case "disabled":
			return rules.filter((rule) => !rule.enabled);
		case "noTemplate":
			return rules.filter((rule) => !rule.templatePath);
		case "all":
		default:
			return [...rules];
	}
}
