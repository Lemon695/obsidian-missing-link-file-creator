import type { I18nDict } from '../../locale';

interface IgnoreModuleI18n {
	name: string;
	description: string;
}

export const ignoreModuleI18n: I18nDict<IgnoreModuleI18n> = {
	zh: {
		name: '忽略列表',
		description: '管理永久忽略的链接，被忽略的文件不会出现在扫描结果中。',
	},
	en: {
		name: 'Ignore List',
		description: 'Manage permanently ignored links. Ignored files will not appear in scan results.',
	},
};
