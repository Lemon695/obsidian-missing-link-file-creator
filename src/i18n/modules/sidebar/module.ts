import type { I18nDict } from '../../locale';

interface SidebarModuleI18n {
	name: string;
	description: string;
	openCommand: string;
}

export const sidebarModuleI18n: I18nDict<SidebarModuleI18n> = {
	zh: {
		name: '侧边栏面板',
		description: '在侧边栏实时展示当前活动文件的缺失链接，支持单条创建和忽略操作。',
		openCommand: '打开当前文件缺失链接视图（侧边栏）',
	},
	en: {
		name: 'Sidebar Panel',
		description: 'Show missing links for the active file in the sidebar. Supports per-link create and ignore actions.',
		openCommand: 'Open Current File Missing Links (Side View)',
	},
};
