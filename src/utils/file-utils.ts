import {App, TFile} from 'obsidian';

export class FileUtils {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 检查文件是否存在于 Obsidian 库中
	 * @param fileName 文件名（不包含扩展名）
	 * @returns 是否存在
	 */
	isFileExistsInVault(fileName: string): boolean {
		const matchedFile = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		return matchedFile !== null;
	}

	/**
	 * 检查文件
	 *
	 * 只检查文件名（basename），不考虑路径
	 * @param fileName 文件名
	 */
	getFileByFileName(fileName: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(fileName, '');
	}

	getFileByFileNameV2(fileName: string): TFile | null {
		// 先尝试直接查找
		const directMatch = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		if (directMatch) return directMatch;

		// 如果没找到，去掉扩展名再试一次
		const baseFileName = fileName.replace(/\.[^/.]+$/, '');
		return this.app.metadataCache.getFirstLinkpathDest(baseFileName, '');
	}

	/**
	 * 根据文件名获取文件的完整路径
	 * @param fileName 文件名（不包含扩展名）
	 * @returns 文件的完整路径，如果未找到返回 null
	 */
	getFilePathByName(fileName: string): string | null {
		const matchedFile = this.app.metadataCache.getFirstLinkpathDest(fileName, '');
		return matchedFile ? matchedFile.path : null;
	}
}
