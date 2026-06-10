import type { I18nDict } from '../../locale';

interface TemplateModuleI18n {
	name: string;
	description: string;
}

export const templateModuleI18n: I18nDict<TemplateModuleI18n> = {
	zh: {
		name: '模板支持',
		description: '创建文件时自动应用模板，支持 Templater 插件和内置基础模板引擎。',
	},
	en: {
		name: 'Template Support',
		description: 'Apply templates when creating files. Supports Templater plugin and built-in basic template engine.',
	},
};
