import type { I18nDict } from '../../locale';

interface DashboardModuleI18n {
	name: string;
	description: string;
	openCommand: string;
	heightSettingName: string;
	heightSettingDesc: string;
}

export const dashboardModuleI18n: I18nDict<DashboardModuleI18n> = {
	zh: {
		name: '批量仪表盘',
		description: '全库或当前文件的缺失链接汇总视图，支持批量创建、搜索过滤、分组排序。',
		openCommand: '打开批量操作仪表盘',
		heightSettingName: '仪表盘弹窗高度',
		heightSettingDesc: '接受任意 CSS 高度值（如 80vh、600px），默认 80vh。',
	},
	en: {
		name: 'Batch Dashboard',
		description: 'Overview of missing links across the vault or current file. Supports batch create, search, and sorting.',
		openCommand: 'Open Batch Operations Dashboard',
		heightSettingName: 'Dashboard dialog height',
		heightSettingDesc: 'Any valid CSS height value (e.g. 80vh, 600px). Default: 80vh.',
	},
};
