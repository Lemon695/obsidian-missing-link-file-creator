export enum ConditionOperator {
	AND = "and",        // 所有条件都必须满足
	OR = "or",          // 至少一个条件满足
	NOT = "not",        // 否定(取反)
	EXCLUDE = "exclude" // 排除
}

export enum ConditionMatchType {
	CONTAINS = "contains",       // 包含指定文本
	STARTS_WITH = "startsWith",  // 以指定文本开始
	ENDS_WITH = "endsWith",      // 以指定文本结束
	REGEX = "regex",             // 正则表达式匹配
	EXACT = "exact",             // 精确匹配
	FRONTMATTER = "frontmatter"  // Frontmatter属性匹配
}

export interface MatchCondition {
	id: string;                   // 条件ID
	type: ConditionMatchType;     // 匹配类型
	pattern: string;              // 匹配模式
	operator: ConditionOperator;  // 条件运算符
	property?: string;            // 用于frontmatter匹配的属性名
	frontmatterMatchType?: ConditionMatchType; // frontmatter模式下的子匹配类型
}
