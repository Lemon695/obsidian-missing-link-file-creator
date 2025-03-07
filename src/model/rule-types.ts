import {ConditionOperator, MatchCondition} from "./condition-types";

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

export function convertLegacyRule(rule: any): FileCreationRule {
	if (rule.conditions) {
		return rule as FileCreationRule;
	}

	// 旧版本规则转换
	const newRule: FileCreationRule = {
		id: rule.id,
		name: rule.name,
		enabled: rule.enabled,
		conditions: [{
			id: `cond-${Date.now()}`,
			type: rule.matchType,
			pattern: rule.pattern,
			operator: ConditionOperator.AND
		}],
		targetFolder: rule.targetFolder,
		templatePath: rule.templatePath,
		priority: rule.priority,
		description: rule.description
	};

	return newRule;
}
