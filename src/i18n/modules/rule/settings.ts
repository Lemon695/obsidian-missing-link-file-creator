import type { I18nDict } from '../../locale';

interface RuleSettingsI18n {
	enableRules: { name: string; desc: string };
	manageRules: { name: string; desc: string; button: string };
	summary: (count: number) => string;
}

export const ruleSettingsI18n: I18nDict<RuleSettingsI18n> = {
	zh: {
		enableRules: {
			name: '启用规则',
			desc: '根据文件名或 frontmatter 属性自动应用目标目录和模板',
		},
		manageRules: {
			name: '规则管理',
			desc: '添加、编辑、排序和删除文件创建规则',
			button: '管理规则',
		},
		summary: (count) => `已配置 ${count} 条规则`,
	},
	en: {
		enableRules: {
			name: 'Enable rules',
			desc: 'Automatically apply target folders and templates based on filename or frontmatter',
		},
		manageRules: {
			name: 'Rule management',
			desc: 'Add, edit, reorder and delete file creation rules',
			button: 'Manage rules',
		},
		summary: (count) => `${count} rule${count === 1 ? '' : 's'} configured`,
	},
};
