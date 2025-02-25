import {App, Notice, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileUtils} from './file-utils';
import {LogUtils} from "./log-utils";
import {CreateFileSettings} from "../settings";
import {UIManager} from "../ui-manager/creation-confirm-modal";
import {resolveFilePath} from "./path-utils";

export interface FileOperationsOptions {
	app: App;
	settings: CreateFileSettings;
}

interface LinkInfo {
	filename: string;
	alias?: string;
	path?: string;
	baseName?: string;
	isEmbed?: boolean; //是否为嵌入类型
	isMediaType?: boolean; //是否为媒体类型（图片、视频等）
}

// 跟踪文件及其多个别名
interface FileWithAliases {
	filename: string;
	path?: string;
	baseName?: string;
	aliases: Set<string>; // 别名
}

export class FileOperations {
	private app: App;
	private settings: CreateFileSettings;
	private fileUtils: FileUtils;
	private uiManager: UIManager;

	constructor(options: FileOperationsOptions) {
		this.app = options.app;
		this.settings = options.settings;
		this.fileUtils = new FileUtils(options.app);
		this.uiManager = new UIManager(options.app, options.settings);
	}

	/**
	 * 提取文件中的 MD 链接，正确处理别名、路径和引用
	 * @param content 文件内容
	 * @returns 提取的链接信息数组
	 */
	extractMDLinks(content: string): LinkInfo[] {
		const regex = /!?\[\[((?:[^\[\]]|\\.)+?(?:\|(?:[^\[\]]|\\.)+?)?)]]/g;
		const linkInfos: LinkInfo[] = [];
		let match;

		while ((match = regex.exec(content)) !== null) {
			const linkText = match[1].replace(/\\([\[\]])/g, '$1'); // 处理转义的方括号
			const isEmbed = match[0].startsWith('!');

			// 处理块引用和标题引用: 检查是否包含#或^符号（用于标题引用或块引用）
			const hashIndex = linkText.indexOf('#');
			const caretIndex = linkText.indexOf('^');

			let filename: string;
			if (hashIndex > 0) {
				filename = linkText.substring(0, hashIndex).trim();
			} else if (caretIndex > 0) {
				filename = linkText.substring(0, caretIndex).trim();
			} else {
				// 检查是否包含别名（以 | 分隔）
				const parts = linkText.split('|');
				if (parts.length > 1) {
					// 有别名的情况：[[filename|alias]]
					filename = parts[0].trim();
				} else {
					// 无别名的情况：[[filename]]
					filename = linkText.trim();
				}
			}

			if (!filename) continue;

			// 处理带有别名的情况
			let alias: string | undefined;
			const pipeIndex = linkText.indexOf('|');
			if (pipeIndex > 0) {
				// 确保'|'不在引用部分内
				if ((hashIndex === -1 || pipeIndex < hashIndex) &&
					(caretIndex === -1 || pipeIndex < caretIndex)) {
					alias = linkText.substring(pipeIndex + 1).trim();

					// 如果别名还包含#或^，需要进一步处理
					const aliasHashIndex = alias.indexOf('#');
					const aliasCaretIndex = alias.indexOf('^');
					if (aliasHashIndex > 0) {
						alias = alias.substring(0, aliasHashIndex).trim();
					} else if (aliasCaretIndex > 0) {
						alias = alias.substring(0, aliasCaretIndex).trim();
					}
				}
			}

			// 处理文件路径
			const linkInfo: LinkInfo = {
				filename: filename,
				alias: alias,
				isEmbed: isEmbed,
				isMediaType: this.fileUtils.isMediaFile(filename)
			};

			if (filename.includes('/')) {
				const lastSlashIndex = filename.lastIndexOf('/');
				linkInfo.path = filename.substring(0, lastSlashIndex);
				linkInfo.baseName = filename.substring(lastSlashIndex + 1);
			} else {
				linkInfo.baseName = filename;
			}

			linkInfos.push(linkInfo);
		}

		LogUtils.showDebugLog(() => `Extracted links: ${linkInfos.length}`, this.settings);
		return linkInfos;
	}

	/**
	 * 将LinkInfo数组转换为FileWithAliases映射，合并同一文件的多个别名
	 * @param linkInfos 链接信息数组
	 * @returns 文件及其别名的映射
	 */
	consolidateFileAliases(linkInfos: LinkInfo[]): Map<string, FileWithAliases> {
		const fileMap = new Map<string, FileWithAliases>();

		// 过滤掉媒体类型的链接
		const nonMediaLinks = linkInfos.filter(link => !link.isMediaType);

		for (const link of nonMediaLinks) {
			// 文件的完整路径
			const key = link.path
				? `${link.path}/${link.baseName || link.filename}`
				: link.filename;

			// 检查文件是否已经存在
			let fileExists = false;

			if (link.path) {
				// 有路径的情况，检查特定路径下是否存在该文件
				fileExists = this.fileUtils.isFileExistsInVault(key, true);
			} else {
				// 无路径的情况，检查全局是否存在该文件
				fileExists = this.fileUtils.isFileExistsInVault(link.filename);
			}

			// 如果文件已存在，跳过
			if (fileExists) {
				LogUtils.showDebugLog(
					() => `Skipping existing file: ${key}`,
					this.settings
				);
				continue;
			}

			if (!fileMap.has(key)) {
				fileMap.set(key, {
					filename: link.filename,
					path: link.path,
					baseName: link.baseName,
					aliases: new Set<string>()
				});
			}

			// 如果有别名，添加到集合中
			if (link.alias) {
				const fileEntry = fileMap.get(key);
				if (fileEntry) {
					fileEntry.aliases.add(link.alias);
					LogUtils.showDebugLog(
						() => `Added alias "${link.alias}" to file "${key}"`,
						this.settings
					);
				}
			}
		}

		return fileMap;
	}

	/**
	 * 封装文件数据结构
	 * @param fileMap 文件和别名的映射
	 * @returns 准备创建的文件数组
	 */
	prepareFilesToCreate(fileMap: Map<string, FileWithAliases>): {
		filename: string,
		path: string,
		aliases: Set<string>,
		conflictResolution?: string
	}[] {
		const filesToCreate: {
			filename: string,
			path: string,
			aliases: Set<string>,
			conflictResolution?: string
		}[] = [];

		const pathTracker = new Map<string, boolean>(); // 跟踪路径是否已存在

		for (const [key, fileInfo] of fileMap.entries()) {

			// 处理相对路径
			let resolvedFilename = this.resolveRelativePath(fileInfo.filename);

			// 确定文件创建路径
			let targetPath = '';

			if (fileInfo.path) {
				// 如果链接中包含路径，优先使用该路径
				const resolvedPath = this.resolveRelativePath(fileInfo.path);
				const fileName = fileInfo.baseName || fileInfo.filename;
				targetPath = `${resolvedPath}/${fileName}.md`;

				if (this.app.vault.getAbstractFileByPath(targetPath) instanceof TFile) {
					LogUtils.showDebugLog(() => `Skipping existing file at specific path: ${targetPath}`, this.settings);
					continue;
				}
			} else {
				// 没有路径的情况，使用默认文件夹
				let folderPath = this.settings.defaultFolderPath || '';

				// 删除开头和结尾多余的斜杠
				folderPath = folderPath.replace(/^\/+|\/+$/g, '');
				targetPath = folderPath
					? `${folderPath}/${resolvedFilename}.md`
					: `${resolvedFilename}.md`;

				// 检查全局是否存在该文件
				if (this.fileUtils.isFileExistsInVault(resolvedFilename)) {
					LogUtils.showDebugLog(() => `Skipping existing file in vault: ${resolvedFilename}`, this.settings);
					continue;
				}
			}

			// 规范化路径（删除重复斜线，处理./和../）
			targetPath = this.normalizeFilePath(targetPath);

			// 检查路径冲突
			let conflictResolution: string | undefined;

			const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
			const pathConflict = pathTracker.has(targetPath);

			if (existingFile || pathConflict) {
				if (existingFile instanceof TFile) {
					if (fileInfo.aliases.size > 0) {
						conflictResolution = "update_aliases";
					} else {
						// 已存在且无新别名 - 跳过
						LogUtils.showDebugLog(() => `Skipping existing file with no new aliases: ${targetPath}`, this.settings);
						continue;
					}
				} else if (pathConflict) {
					// 本批次中已有同路径文件 - 需要创建唯一名称
					let counter = 1;
					let uniquePath = targetPath;

					// 从文件名和扩展名创建唯一路径
					const lastDotIndex = targetPath.lastIndexOf('.');
					const basePath = lastDotIndex !== -1 ? targetPath.substring(0, lastDotIndex) : targetPath;
					const extension = lastDotIndex !== -1 ? targetPath.substring(lastDotIndex) : '';

					while (pathTracker.has(uniquePath) || this.app.vault.getAbstractFileByPath(uniquePath)) {
						uniquePath = `${basePath}-${counter}${extension}`;
						counter++;
					}

					targetPath = uniquePath;
					conflictResolution = "renamed";
					LogUtils.showDebugLog(() => `Renamed conflicting path to: ${targetPath}`, this.settings);
				}
			}

			// 记录此路径已计划创建
			pathTracker.set(targetPath, true);

			filesToCreate.push({
				filename: fileInfo.filename,
				path: targetPath,
				aliases: fileInfo.aliases,
				conflictResolution: conflictResolution
			});
		}

		return filesToCreate;
	}

	private normalizeFilePath(path: string): string {
		// 处理重复斜杠
		let normalized = path.replace(/\/+/g, '/');

		// 处理目录遍历 (./ 和 ../)
		const segments = normalized.split('/');
		const resultSegments: string[] = [];

		for (const segment of segments) {
			if (segment === '.') {

			} else if (segment === '..') {
				// 后退一级目录
				if (resultSegments.length > 0) {
					resultSegments.pop();
				}
			} else {
				resultSegments.push(segment);
			}
		}

		return resultSegments.join('/');
	}

	/**
	 * 检查并创建MD文件，支持多个别名
	 */
	async checkAndCreateMDFiles(): Promise<void> {
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) {
			LogUtils.showDebugLog(() => 'No active file found.', this.settings);
			new Notice('No active file found');
			return;
		}

		// 显示初始进度通知
		const loadingNotice = new Notice('Analyzing links...', 0);

		try {
			const fileContent = await this.app.vault.read(currentFile);

			// 提取链接并合并别名
			const linkInfos = this.extractMDLinks(fileContent);
			const fileMap = this.consolidateFileAliases(linkInfos);

			// 关闭加载通知
			loadingNotice.hide();

			// 准备创建的文件列表
			const filesToCreate = this.prepareFilesToCreate(fileMap);

			if (filesToCreate.length === 0) {
				new Notice('No file links to create');
				return;
			}

			// 显示确认对话框
			const result = await this.uiManager.showCreationConfirmDialog(
				filesToCreate,
				this.createFileWithMultipleAliases.bind(this)
			);

			// 如果直接关闭对话框，result为undefined
			if (result) {
				// 判断是否为"取消"操作的空结果
				if (result.created === 0 && result.skipped === 0 &&
					result.failed === 0 && result.aliasesAdded === 0) {
					// 取消操作，不显示结果
					return;
				}

				this.uiManager.showResultSummary(result);
			}
		} catch (error) {
			// 出错时关闭加载通知
			loadingNotice.hide();
			console.error('Error processing file:', error);
			new Notice(`Error processing file: ${error.message}`);
		}
	}

	/**
	 * 在指定文件夹中检查并创建 MD 文件，支持多别名，带UI交互
	 */
	async checkAndCreateMDFilesInFolder(): Promise<void> {
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) {
			new Notice("No active file found");
			return;
		}

		const folder = currentFile.parent;
		if (!folder) {
			new Notice("Current file isn't in a folder");
			return;
		}

		const files = this.app.vault.getFiles().filter(file => file.parent === folder && file.extension === 'md');

		if (files.length === 0) {
			new Notice("No markdown files found in folder");
			return;
		}

		// 显示初始进度通知
		const progressNotice = this.uiManager.showProgressNotice(
			'Scanning folder',
			0,
			files.length
		);

		try {
			// 收集所有文件中的链接
			const allLinks: LinkInfo[] = [];
			let processedCount = 0;

			for (const file of files) {
				try {
					const fileContent = await this.app.vault.read(file);
					const fileLinks = this.extractMDLinks(fileContent);
					allLinks.push(...fileLinks);
				} catch (error) {
					console.error(`Error processing file ${file.path}:`, error);
				}

				// 更新进度
				processedCount++;
				this.uiManager.updateProgressNotice(
					progressNotice,
					'Scanning folder',
					processedCount,
					files.length
				);
			}

			// 关闭进度通知
			progressNotice.hide();

			// 合并文件的多个别名
			const fileMap = this.consolidateFileAliases(allLinks);

			// 待创建的文件列表
			const filesToCreate = this.prepareFilesToCreate(fileMap);

			if (filesToCreate.length === 0) {
				new Notice('No file links to create');
				return;
			}

			// 显示确认对话框
			const result = await this.uiManager.showCreationConfirmDialog(
				filesToCreate,
				this.createFileWithMultipleAliases.bind(this)
			);

			// 直接关闭对话框，result为undefined
			if (result) {
				this.uiManager.showResultSummary(result);
			}
		} catch (error) {
			// 出错时关闭进度通知
			progressNotice.hide();
			console.error('Error processing folder:', error);
			new Notice(`Error processing folder: ${error.message}`);
		}
	}

	/**
	 * 确保目录存在
	 * @param pathToCreate 要创建的路径
	 */
	async ensureDirectoryExists(pathToCreate: string): Promise<void> {
		if (!pathToCreate || pathToCreate === '/') return;

		// 检查路径是否已存在
		const existingFolder = this.app.vault.getAbstractFileByPath(pathToCreate);
		if (existingFolder) return;

		// 处理父目录
		const parentPath = pathToCreate.split('/').slice(0, -1).join('/');
		if (parentPath) {
			await this.ensureDirectoryExists(parentPath);
		}

		// 创建当前目录
		try {
			await this.app.vault.createFolder(pathToCreate);
			LogUtils.showDebugLog(() => `Created directory: ${pathToCreate}`, this.settings);
		} catch (error) {
			console.error(`Failed to create directory: ${pathToCreate}`, error);
		}
	}

	/**
	 * 创建文件，支持多个别名
	 * @param filePath 文件路径
	 * @param aliases 别名数组
	 * @returns 是否成功创建
	 */
	async createFileWithMultipleAliases(filePath: string, aliases: string[]): Promise<boolean> {
		try {
			// 提取文件路径的目录部分
			const lastSlashIndex = filePath.lastIndexOf('/');
			const directory = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';

			// 确保目录存在
			if (directory) {
				LogUtils.showDebugLog(() => `Attempting to ensure directory exists: ${directory}`, this.settings);
				await this.ensureDirectoryExists(directory);
				LogUtils.showDebugLog(() => `Directory check completed for: ${directory}`, this.settings);
			}

			// 创建文件内容，如果有别名则添加到 frontmatter
			let fileContent = '';
			if (aliases && aliases.length > 0) {
				// 格式化别名为YAML数组
				const aliasesString = aliases.map(alias => `  - "${alias}"`).join('\n');

				fileContent = `---
aliases:
${aliasesString}
---

`;
			}

			// 创建文件
			await this.app.vault.create(filePath, fileContent);

			LogUtils.showDebugLog(
				() => `Created new file: ${filePath} with ${aliases.length} aliases`,
				this.settings
			);

			return true;
		} catch (error) {
			console.error(`Failed to create file: ${filePath}`, error);
			return false;
		}
	}

	/**
	 * 解析相对路径，考虑当前文件上下文
	 * @param path 需要解析的路径
	 * @returns 解析后的绝对路径
	 */
	private resolveRelativePath(path: string): string {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return path;

		// 获取当前文件所在目录
		const currentFilePath = activeFile.path;
		const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));

		if (path.startsWith('./') || path.startsWith('../')) {
			return resolveFilePath(path, currentDir);
		}

		return path;
	}


}

