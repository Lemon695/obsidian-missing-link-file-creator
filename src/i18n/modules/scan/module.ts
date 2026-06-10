import type { I18nDict } from '../../locale';

interface ScanModuleI18n {
	name: string;
	description: string;
}

export const scanModuleI18n: I18nDict<ScanModuleI18n> = {
	zh: {
		name: '链接扫描与创建',
		description: '检测 [[wiki链接]] 并一键批量创建缺失文件，支持当前文件、文件夹、全库三种扫描范围。',
	},
	en: {
		name: 'Link Scan & Create',
		description: 'Detect [[wiki links]] and batch-create missing files. Supports current file, folder, and entire vault.',
	},
};
