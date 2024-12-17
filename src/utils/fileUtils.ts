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
		// 获取所有 MD 文件
		const allMDFiles = this.app.vault.getFiles()
			.filter(file => file.extension === 'md');

		// 检查是否存在匹配的文件
		return allMDFiles.some(file => {
			// 提取文件名（不包含路径和扩展名）
			const existingFileName = file.basename;

			console.log(`对比文件: 
                目标文件名: ${fileName}, 
                现有文件名: ${existingFileName}`);

			return existingFileName === fileName;
		});
	}

	/**
	 * 检查文件
	 *
	 * 只检查文件名（basename），不考虑路径
	 * @param fileName 文件名
	 */
	getFileByFileName(fileName: string): TFile | null {
		const markdownFiles = this.app.vault.getFiles();

		return markdownFiles.find(file => file.basename === fileName) || null;
	}

	getFileByFileNameV2(fileName: string): TFile | null {
		const markdownFiles = this.app.vault.getFiles();
		const baseFileName = fileName.replace(/\.[^/.]+$/, '');  // 去掉扩展名

		let file = markdownFiles.find(file => file.basename === baseFileName);
		if (file) return file;

		// 动态获取所有文件的扩展名
		const extensions = markdownFiles.map(file => file.basename.split('.').pop()).filter(Boolean);
		// 去除重复的扩展名
		const uniqueExtensions = [...new Set(extensions)];

		for (const ext of uniqueExtensions) {
			file = markdownFiles.find(file => file.basename === baseFileName + '.' + ext);
			if (file) return file;
		}

		return null;
	}

	/**
	 * 根据文件名获取文件的完整路径
	 * @param fileName 文件名（不包含扩展名）
	 * @returns 文件的完整路径，如果未找到返回 null
	 */
	getFilePathByName(fileName: string): string | null {
		const matchedFile = this.app.vault.getFiles()
			.find(file =>
				file.extension === 'md' && file.basename === fileName
			);

		return matchedFile ? matchedFile.path : null;
	}
}
