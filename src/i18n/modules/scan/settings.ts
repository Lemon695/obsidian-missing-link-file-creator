import type { I18nDict } from '../../locale';

interface ScanSettingsI18n {
	notification: { name: string; desc: string };
	defaultFolder: { name: string; desc: string; placeholder: string };
	addAliases: { name: string; desc: string };
	debugMode: { name: string; desc: string };
}

export const scanSettingsI18n: I18nDict<ScanSettingsI18n> = {
	zh: {
		notification: {
			name: '创建成功通知',
			desc: '创建文件后显示通知提示',
		},
		defaultFolder: {
			name: '默认保存目录',
			desc: '无规则匹配时，新文件保存到此目录（留空则保存到仓库根目录）',
			placeholder: '示例：Inbox/Links',
		},
		addAliases: {
			name: '自动写入 aliases',
			desc: '将链接中的别名写入新文件的 frontmatter。使用 Templater 时可关闭此项以避免冲突',
		},
		debugMode: {
			name: '调试模式',
			desc: '在控制台输出详细日志，排查问题时使用',
		},
	},
	en: {
		notification: {
			name: 'Creation notification',
			desc: 'Show a notification when a file is successfully created',
		},
		defaultFolder: {
			name: 'Default folder',
			desc: 'New files are saved here when no rule matches. Leave empty for vault root.',
			placeholder: 'Example: Inbox/Links',
		},
		addAliases: {
			name: 'Write aliases to frontmatter',
			desc: 'Add link aliases to the new file\'s frontmatter. Disable if it conflicts with Templater.',
		},
		debugMode: {
			name: 'Debug mode',
			desc: 'Log detailed information to the console for troubleshooting',
		},
	},
};
