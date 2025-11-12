export const translations = {
	'en-GB': {
		// Command names
		createFilesForUnresolvedLinksInCurrentFile: 'Create files for unresolved links in current file',

		// Main plugin
		loadingPlugin: 'Loading plugin v',
	},
	'zh': {
		// Command names
		createFilesForUnresolvedLinksInCurrentFile: '为当前文件中的未解析链接创建文件',

		// Main plugin
		loadingPlugin: '加载插件 v',
	}
};

type Locale = keyof typeof translations;

export function getLocale(): Locale {
	const lang = window.localStorage.getItem('language') || 'en-GB';
	return (lang in translations ? lang : 'en-GB') as Locale;
}

export function t(key: keyof typeof translations["en-GB"], params?: Record<string, string>): string {
	const locale = getLocale();
	let text = translations[locale][key] || translations["en-GB"][key];
	// 替换占位符
	if (params) {
		Object.keys(params).forEach(paramKey => {
			text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
		});
	}
	return text;
}

/**
 * 调试函数：打印当前语言设置
 */
export function debugLocale(): void {
	console.log('=== Locale Debug Info ===');
	console.log('Current locale:', getLocale());
	console.log('localStorage language:', window.localStorage.getItem('language'));
	console.log('navigator.language:', navigator.language);
	console.log('moment locale:', (window as any).moment?.locale());
	console.log('========================');
}
