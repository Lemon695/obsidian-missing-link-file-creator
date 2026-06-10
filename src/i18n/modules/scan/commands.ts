import type { I18nDict } from '../../locale';

interface ScanCommandsI18n {
	currentFile: { name: string };
	folder: { name: string };
	vault: { name: string };
	selectedText: { name: string };
}

export const scanCommandsI18n: I18nDict<ScanCommandsI18n> = {
	zh: {
		currentFile: { name: '为当前文件中的未解析链接创建文件' },
		folder: { name: '扫描文件夹并创建缺失文件' },
		vault: { name: '扫描整个仓库并创建缺失文件' },
		selectedText: { name: '为选中的未解析链接创建文件' },
	},
	en: {
		currentFile: { name: 'Create files for unresolved links in current file' },
		folder: { name: 'Scan folder and create missing files' },
		vault: { name: 'Scan entire vault and create missing files' },
		selectedText: { name: 'Create files for selected unresolved links' },
	},
};
