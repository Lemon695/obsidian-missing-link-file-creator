import type { I18nDict } from '../../locale';

interface TagModuleI18n {
	name: string;
	description: string;
}

export const tagModuleI18n: I18nDict<TagModuleI18n> = {
	zh: {
		name: '自动标签',
		description: '基于文件名、内容和关联关系分析，在创建文件时自动建议并写入标签。',
	},
	en: {
		name: 'Auto Tagging',
		description: 'Analyze filename, content, and relationships to automatically suggest and write tags when creating files.',
	},
};
