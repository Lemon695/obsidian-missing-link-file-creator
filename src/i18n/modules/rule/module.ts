import type { I18nDict } from '../../locale';

interface RuleModuleI18n {
	name: string;
	description: string;
}

export const ruleModuleI18n: I18nDict<RuleModuleI18n> = {
	zh: {
		name: '规则引擎',
		description: '按文件名或 frontmatter 属性自动匹配规则，将文件创建到指定目录并应用对应模板。',
	},
	en: {
		name: 'Rule Engine',
		description: 'Auto-match rules by filename or frontmatter to create files in the right folder with the right template.',
	},
};
