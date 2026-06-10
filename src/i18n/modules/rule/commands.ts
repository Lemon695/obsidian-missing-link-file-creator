import type { I18nDict } from '../../locale';

interface RuleCommandsI18n {
	openManagement: { name: string };
}

export const ruleCommandsI18n: I18nDict<RuleCommandsI18n> = {
	zh: {
		openManagement: { name: '管理文件创建规则' },
	},
	en: {
		openManagement: { name: 'Manage file creation rules' },
	},
};
