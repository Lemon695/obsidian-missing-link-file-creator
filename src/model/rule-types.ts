import { ConditionOperator, MatchCondition, ConditionMatchType } from "./condition-types";

export enum RuleMatchType {
	CONTAINS = "contains",       // 包含指定文本
	STARTS_WITH = "startsWith",  // 以指定文本开始
	ENDS_WITH = "endsWith",      // 以指定文本结束
	REGEX = "regex",             // 正则表达式匹配
	EXACT = "exact",             // 精确匹配
	TAG = "tag",                 // 标签匹配
	TEMPLATE = "template"        // 模板类型匹配
}

export enum TemplateAliasHandling {
	SKIP = "skip",        // 跳过别名处理
	MERGE = "merge"       // 将别名与模板frontmatter合并
}

// 创建文件规则
export interface FileCreationRule {
	id: string;                 // 规则ID
	name: string;               // 规则名称
	enabled: boolean;           // 是否启用
	conditions: MatchCondition[]; // 匹配条件列表
	targetFolder: string;       // 目标文件夹
	templatePath: string;       // 使用的模板路径
	priority: number;           // 规则优先级（数字越小优先级越高）
	description?: string;       // 规则描述(可选)
	templateAliasHandling?: TemplateAliasHandling; // 模板别名处理方式
}

// 规则匹配结果
export interface RuleMatchResult {
	matched: boolean;           // 是否匹配
	rule?: FileCreationRule;    // 匹配的规则
	targetFolder?: string;      // 计算后的目标文件夹
	templatePath?: string;      // 使用的模板路径
	templateAliasHandling?: TemplateAliasHandling; // 模板别名处理方式
}

/**
 * 旧版本规则格式（v1.0.x）
 * 用于向后兼容
 */
interface LegacyRule {
	id: string;
	name: string;
	enabled: boolean;
	matchType: string;
	pattern: string;
	targetFolder: string;
	templatePath: string;
	priority: number;
	description?: string;
	templateAliasHandling?: TemplateAliasHandling;
}

/**
 * 类型守卫：检查是否为新版规则
 */
function isModernRule(rule: unknown): rule is FileCreationRule {
	return (
		typeof rule === 'object' &&
		rule !== null &&
		'conditions' in rule &&
		Array.isArray((rule as FileCreationRule).conditions)
	);
}

/**
 * 转换旧版规则到新版格式
 * @param rule 旧版或新版规则
 * @returns 新版规则格式
 */
export function convertLegacyRule(rule: LegacyRule | FileCreationRule): FileCreationRule {
	// 如果已经是新版规则，直接返回
	if (isModernRule(rule)) {
		return rule;
	}

	// 验证必需字段
	const legacyRule = rule as LegacyRule;
	if (!legacyRule.id || !legacyRule.name || !legacyRule.matchType) {
		throw new Error(`Invalid legacy rule: missing required fields (id, name, or matchType)`);
	}

	// 转换为新版规则
	const newRule: FileCreationRule = {
		id: legacyRule.id,
		name: legacyRule.name,
		enabled: legacyRule.enabled ?? true,
		conditions: [{
			id: `cond-${Date.now()}`,
			type: legacyRule.matchType as ConditionMatchType,
			pattern: legacyRule.pattern || '',
			operator: ConditionOperator.AND
		}],
		targetFolder: legacyRule.targetFolder || '',
		templatePath: legacyRule.templatePath || '',
		priority: legacyRule.priority ?? 0,
		description: legacyRule.description,
		templateAliasHandling: legacyRule.templateAliasHandling
	};

	return newRule;
}

