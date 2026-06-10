import type { I18nDict } from '../../locale';

interface TagSettingsI18n {
	enable: { name: string; desc: string };
	minConfidence: { name: string; desc: string };
}

export const tagSettingsI18n: I18nDict<TagSettingsI18n> = {
	zh: {
		enable: {
			name: '启用自动标签',
			desc: '创建文件时根据文件名、内容和关联关系自动建议并写入标签',
		},
		minConfidence: {
			name: '最低置信度',
			desc: '标签建议被应用的最低置信度评分（0–1）',
		},
	},
	en: {
		enable: {
			name: 'Enable auto tagging',
			desc: 'Automatically suggest and write tags based on filename, content, and relationships when creating files',
		},
		minConfidence: {
			name: 'Min confidence',
			desc: 'Minimum confidence score (0–1) for a tag suggestion to be applied',
		},
	},
};
