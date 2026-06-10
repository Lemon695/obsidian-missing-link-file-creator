import type { I18nDict } from '../../locale';

interface DataviewModuleI18n {
	name: string;
	description: string;
}

export const dataviewModuleI18n: I18nDict<DataviewModuleI18n> = {
	zh: {
		name: 'Dataview 集成',
		description: '注册 missing-links 代码块处理器，在笔记中内联展示缺失链接列表。',
	},
	en: {
		name: 'Dataview Integration',
		description: 'Registers a missing-links code block processor to display missing links inline in notes.',
	},
};
