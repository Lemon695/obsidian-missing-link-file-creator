import {App} from "obsidian";
import {convertLegacyRule, FileCreationRule, RuleMatchResult, RuleMatchType} from "./rule-types";
import {log} from "../utils/log-utils";
import {ConditionMatchType, ConditionOperator, MatchCondition} from "./condition-types";
import {CreateFileSettings} from "../settings/settings";

/**
 * 规则管理器 - 负责管理和应用文件创建规则
 */
export class RuleManager {
	private app: App;
	private readonly settings: CreateFileSettings;

	constructor(app: App, settings: CreateFileSettings) {
		this.app = app;
		this.settings = settings;

		// 旧规则——>转换
		if (this.settings.rules && this.settings.rules.length > 0) {
			const hasLegacyRules = this.settings.rules.some(rule => !rule.conditions);
			if (hasLegacyRules) {
				this.settings.rules = this.settings.rules.map(rule => convertLegacyRule(rule));
			}
		}
	}

	matchRule(filename: string, context?: { frontmatter?: any, sourcePath?: string }): RuleMatchResult {
		// 没有启用规则/规则列表为空——>返回False
		if (!this.settings.useRules || !this.settings.rules || this.settings.rules.length === 0) {
			return {matched: false};
		}

		// 获取所有启用的规则——>"优先级"排序
		const activeRules = this.settings.rules
			.filter(rule => rule.enabled)
			.sort((a, b) => a.priority - b.priority);

		if (activeRules.length === 0) {
			return {matched: false};
		}

		for (const rule of activeRules) {
			if (this.checkRuleMatch(filename, rule, context)) {
				log.debug(() => `Applied rule ${rule.name} to filename: ${filename}`);

				return {
					matched: true,
					rule: rule,
					targetFolder: rule.targetFolder,
					templatePath: rule.templatePath,
					templateAliasHandling: rule.templateAliasHandling
				};
			}
		}

		return {matched: false};
	}

	private checkRuleMatch(filename: string, rule: FileCreationRule, context?: {
		frontmatter?: any,
		sourcePath?: string
	}): boolean {
		if (!rule.conditions || rule.conditions.length === 0) return false;

		try {
			let finalResult = true;
			let hasPositiveCondition = false;

			// 先处理AND条件
			for (const condition of rule.conditions) {
				if (condition.operator === ConditionOperator.AND) {
					hasPositiveCondition = true;
					const matches = this.checkConditionMatch(filename, condition, context);
					if (!matches) return false;
				}
			}

			// 如果没有AND条件，检查OR条件
			if (!hasPositiveCondition) {
				let anyOrMatch = false;
				const orConditions = rule.conditions.filter(c => c.operator === ConditionOperator.OR);

				if (orConditions.length > 0) {
					hasPositiveCondition = true;
					for (const condition of orConditions) {
						if (this.checkConditionMatch(filename, condition)) {
							anyOrMatch = true;
							break;
						}
					}

					// 没有一个OR条件满足
					if (!anyOrMatch) return false;
				}
			}

			// 检查NOT条件（必须都不匹配）
			for (const condition of rule.conditions) {
				if (condition.operator === ConditionOperator.NOT) {
					if (this.checkConditionMatch(filename, condition)) {
						// 如果NOT条件匹配，则规则不匹配
						return false;
					}
				}
			}

			// 检查EXCLUDE条件
			for (const condition of rule.conditions) {
				if (condition.operator === ConditionOperator.EXCLUDE) {
					if (this.checkConditionMatch(filename, condition)) {
						// 如果排除条件匹配，则规则不匹配
						return false;
					}
				}
			}

			// 如果没有任何条件，或只有NOT/EXCLUDE条件——>不匹配
			return hasPositiveCondition;

		} catch (error) {
			console.error(`Error matching rule ${rule.name}:`, error);
			return false;
		}
	}

	private checkConditionMatch(filename: string, condition: MatchCondition, context?: {
		frontmatter?: any,
		sourcePath?: string
	}): boolean {
		// 如果是frontmatter匹配类型，但没有传入frontmatter上下文，则无法匹配
		if (condition.type === ConditionMatchType.FRONTMATTER) {
			if (!context || !context.frontmatter) {
				log.debug(`No frontmatter context available for matching`);
				return false;
			}

			// 检查属性是否存在
			if (!condition.property) {
				log.debug(`Frontmatter match failed: no property specified`);
				return false;
			}

			// 获取属性值
			const propertyValue = context.frontmatter[condition.property];
			if (propertyValue === undefined) {
				log.debug(`Frontmatter match failed: property "${condition.property}" does not exist`);
				return false;
			}

			// 获取frontmatter匹配类型，默认为精确匹配
			const matchType = condition.frontmatterMatchType || ConditionMatchType.EXACT;

			// 处理数组值
			if (Array.isArray(propertyValue)) {
				// 如果属性值是数组，检查数组中是否有值匹配
				log.debug(`Checking array value for "${condition.property}": ${JSON.stringify(propertyValue)}`);
				return propertyValue.some(value => {
					const valueStr = String(value);
					return this.matchString(valueStr, condition.pattern, matchType);
				});
			}

			// 将属性值转换为字符串进行匹配
			const valueStr = String(propertyValue);
			return this.matchString(valueStr, condition.pattern, matchType);
		}

		switch (condition.type) {
			case ConditionMatchType.CONTAINS:
				return filename.includes(condition.pattern);

			case ConditionMatchType.STARTS_WITH:
				return filename.startsWith(condition.pattern);

			case ConditionMatchType.ENDS_WITH:
				return filename.endsWith(condition.pattern);

			case ConditionMatchType.EXACT:
				return filename === condition.pattern;

			case ConditionMatchType.REGEX:
				const regex = new RegExp(condition.pattern);
				return regex.test(filename);

			default:
				return false;
		}
	}

	/**
	 * 根据匹配类型对字符串进行匹配
	 * @param value 要匹配的值
	 * @param pattern 匹配模式
	 * @param matchType 匹配类型
	 * @returns 是否匹配
	 */
	private matchString(value: string, pattern: string, matchType: ConditionMatchType): boolean {
		switch (matchType) {
			case ConditionMatchType.CONTAINS:
				return value.includes(pattern);

			case ConditionMatchType.STARTS_WITH:
				return value.startsWith(pattern);

			case ConditionMatchType.ENDS_WITH:
				return value.endsWith(pattern);

			case ConditionMatchType.EXACT:
				return value === pattern;

			case ConditionMatchType.REGEX:
				const regex = new RegExp(pattern);
				return regex.test(value);

			default:
				return value === pattern;
		}
	}

	/**
	 * 添加规则
	 * @param rule 规则
	 */
	addRule(rule: FileCreationRule) {
		if (!this.settings.rules) {
			this.settings.rules = [];
		}

		// 确保ID唯一
		if (!rule.id) {
			rule.id = `rule-${Date.now()}`;
		}

		this.settings.rules.push(rule);
	}

	/**
	 * 更新规则
	 * @param ruleId 规则ID
	 * @param updatedRule 更新后的规则
	 */
	updateRule(ruleId: string, updatedRule: Partial<FileCreationRule>): boolean {
		if (!this.settings.rules) return false;

		const ruleIndex = this.settings.rules.findIndex(r => r.id === ruleId);
		if (ruleIndex === -1) return false;

		this.settings.rules[ruleIndex] = {
			...this.settings.rules[ruleIndex],
			...updatedRule
		};

		return true;
	}

	/**
	 * 删除规则
	 * @param ruleId 规则ID
	 */
	deleteRule(ruleId: string): boolean {
		if (!this.settings.rules) return false;

		const initialLength = this.settings.rules.length;
		this.settings.rules = this.settings.rules.filter((rule: { id: string; }) => rule.id !== ruleId);

		return this.settings.rules.length < initialLength;
	}

	/**
	 * 重新排序规则
	 * @param ruleIds 按新顺序排列的规则ID数组
	 */
	reorderRules(ruleIds: string[]): boolean {
		if (!this.settings.rules || this.settings.rules.length !== ruleIds.length) {
			return false;
		}

		// 创建一个按新顺序排列的规则数组
		const newRulesOrder: FileCreationRule[] = [];

		for (const ruleId of ruleIds) {
			const rule = this.settings.rules.find((r: { id: string; }) => r.id === ruleId);
			if (!rule) return false;
			newRulesOrder.push(rule);
		}

		// 更新每个规则的优先级
		for (let i = 0; i < newRulesOrder.length; i++) {
			newRulesOrder[i].priority = i;
		}

		this.settings.rules = newRulesOrder;
		return true;
	}

	/**
	 * 获取所有规则
	 */
	getAllRules(): FileCreationRule[] {
		return this.settings.rules || [];
	}

	/**
	 * 获取规则数量
	 */
	getRuleCount(): number {
		return this.settings.rules?.length || 0;
	}
}
