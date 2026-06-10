import type { I18nDict } from '../../locale';

interface IgnoreSettingsI18n {
	listCount: (count: number) => string;
	managedViaSidebar: string;
	manage: string;
	dialogTitle: string;
	searchPlaceholder: string;
	removeItem: string;
	clearAll: string;
	confirmClearAll: string;
	emptyList: string;
	noMatchingItems: (query: string) => string;
	itemRemoved: string;
	listCleared: string;
}

export const ignoreSettingsI18n: I18nDict<IgnoreSettingsI18n> = {
	zh: {
		listCount: (count) => `已忽略 ${count} 个链接`,
		managedViaSidebar: '忽略列表通过侧边栏面板管理。在侧边栏中点击链接旁的「忽略」按钮可将其加入列表。',
		manage: '管理',
		dialogTitle: '忽略列表管理',
		searchPlaceholder: '搜索忽略项…',
		removeItem: '移除',
		clearAll: '清空全部',
		confirmClearAll: '确定要清空所有忽略项吗？此操作无法撤销。',
		emptyList: '忽略列表为空',
		noMatchingItems: (query) => `没有匹配「${query}」的忽略项`,
		itemRemoved: '已从忽略列表移除',
		listCleared: '忽略列表已清空',
	},
	en: {
		listCount: (count) => `${count} ignored link${count === 1 ? '' : 's'}`,
		managedViaSidebar: 'The ignore list is managed from the sidebar panel. Click the ignore button next to a link in the sidebar to add it.',
		manage: 'Manage',
		dialogTitle: 'Ignore List',
		searchPlaceholder: 'Search ignored items…',
		removeItem: 'Remove',
		clearAll: 'Clear All',
		confirmClearAll: 'Remove all items from the ignore list? This cannot be undone.',
		emptyList: 'Ignore list is empty',
		noMatchingItems: (query) => `No items match "${query}"`,
		itemRemoved: 'Removed from ignore list',
		listCleared: 'Ignore list cleared',
	},
};
