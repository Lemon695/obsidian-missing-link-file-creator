import {App, Notice, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileUtils} from './file-utils';
import {log} from "./log-utils";
import {resolveFilePath} from "./path-utils";
import {UIManager} from "../ui-manager/ui-manager";
import {RuleManager} from "../model/rule-manager";
import {TemplateAliasHandling} from "../model/rule-types";
import {TemplaterService} from "../service/templater-service";
import {TagHelper} from "../service/tag-helper";
import {CreateFileSettings} from "../settings/settings";

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
	private templaterService: TemplaterService;
	private ruleManager: RuleManager;
	public pendingAliases: Map<string, string[]> = new Map();
	private tagHelper: TagHelper;

	constructor(options: FileOperationsOptions) {
		this.app = options.app;
		this.settings = options.settings;
		this.fileUtils = new FileUtils(options.app);
		this.uiManager = new UIManager(options.app, options.settings, this);
		this.templaterService = new TemplaterService(options.app, options.settings, this);
		this.ruleManager = new RuleManager(options.app, options.settings);
		this.tagHelper = new TagHelper(options.app);
	}

	/**
	 * 提取文件中的 MD 链接，正确处理别名、路径和引用
	 * @param content 文件内容
	 * @returns 提取的链接信息数组
	 */
	extractMDLinks(content: string): LinkInfo[] {
		const regex = /!?\[\[((?:\\.|[^\[\]\|])+(?:\|(?:\\.|[^\[\]])+?)?)(?<!\\)]]/g;
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

		log.debug(() => `Extracted links: ${linkInfos.length}`);
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
				log.debug(
					() => `Skipping existing file: ${key}`);
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
					log.debug(
						() => `Added alias "${link.alias}" to file "${key}"`);
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
	prepareFilesToCreate(fileMap: Map<string, FileWithAliases>, context?: { frontmatter?: any, sourcePath?: string }): {
		filename: string,
		path: string,
		aliases: Set<string>,
		conflictResolution?: string,
		templatePath?: string,  // 用于存储规则匹配的模板路径
		matchedRule?: string,    // 用于记录匹配的规则名称
		templateAliasHandling?: TemplateAliasHandling
	}[] {
		const filesToCreate: {
			filename: string,
			path: string,
			aliases: Set<string>,
			conflictResolution?: string,
			templatePath?: string,
			matchedRule?: string,
			templateAliasHandling?: TemplateAliasHandling
		}[] = [];

		const pathTracker = new Map<string, boolean>(); // 跟踪路径是否已存在

		for (const [key, fileInfo] of fileMap.entries()) {

			// 处理相对路径
			let resolvedFilename = this.resolveRelativePath(fileInfo.filename);

			// 获取基本文件名（不含路径）用于规则匹配
			const baseFilename = fileInfo.baseName || resolvedFilename.split('/').pop() || resolvedFilename;

			// 应用规则匹配
			const ruleMatch = this.ruleManager.matchRule(baseFilename, context);
			let targetPath = '';
			let templatePath = undefined;
			let matchedRule = undefined;
			let templateAliasHandling = undefined;

			if (this.settings.useRules && ruleMatch.matched) {
				// 如果启用了规则并有匹配结果
				templatePath = ruleMatch.templatePath;
				matchedRule = ruleMatch.rule?.name;
				templateAliasHandling = ruleMatch.templateAliasHandling;

				if (ruleMatch.targetFolder) {
					// 使用规则指定的目标文件夹
					const folderPath = ruleMatch.targetFolder.replace(/^\/+|\/+$/g, '');
					targetPath = folderPath
						? `${folderPath}/${baseFilename}.md`
						: `${baseFilename}.md`;
				} else if (fileInfo.path) {
					// 如果规则没有指定文件夹但链接中包含路径
					const resolvedPath = this.resolveRelativePath(fileInfo.path);
					const fileName = fileInfo.baseName || fileInfo.filename;
					targetPath = `${resolvedPath}/${fileName}.md`;
				} else {
					// 使用默认文件夹
					let folderPath = this.settings.defaultFolderPath || '';
					folderPath = folderPath.replace(/^\/+|\/+$/g, '');
					targetPath = folderPath
						? `${folderPath}/${resolvedFilename}.md`
						: `${resolvedFilename}.md`;
				}
			} else {
				// 确定文件创建路径（使用默认逻辑）
				if (fileInfo.path) {
					// 如果链接中包含路径，优先使用该路径
					const resolvedPath = this.resolveRelativePath(fileInfo.path);
					const fileName = fileInfo.baseName || fileInfo.filename;
					targetPath = `${resolvedPath}/${fileName}.md`;

					if (this.app.vault.getAbstractFileByPath(targetPath) instanceof TFile) {
						log.debug(() => `Skipping existing file at specific path: ${targetPath}`);
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
						log.debug(() => `Skipping existing file in vault: ${resolvedFilename}`);
						continue;
					}
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
						log.debug(() => `Skipping existing file with no new aliases: ${targetPath}`);
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
						// 防止无限循环
						if (counter > 1000) {
							log.error(() => `无法为 ${targetPath} 创建唯一路径，尝试次数过多`);
							break;
						}
					}

					targetPath = uniquePath;
					conflictResolution = "renamed";
					log.debug(() => `Renamed conflicting path to: ${targetPath}`);
				}
			}

			// 记录此路径已计划创建
			pathTracker.set(targetPath, true);

			filesToCreate.push({
				filename: fileInfo.filename,
				path: targetPath,
				aliases: fileInfo.aliases,
				conflictResolution: conflictResolution,
				templatePath: templatePath,
				matchedRule: matchedRule,
				templateAliasHandling: templateAliasHandling
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
			log.debug(() => 'No active file found.');
			new Notice('No active file found');
			return;
		}

		// 显示初始进度通知
		const loadingNotice = new Notice('Analyzing links...', 0);

		try {
			const fileContent = await this.app.vault.read(currentFile);

			// 获取文件的frontmatter信息
			const frontmatter = this.app.metadataCache.getFileCache(currentFile)?.frontmatter;
			const context = {
				frontmatter: frontmatter,
				sourcePath: currentFile.path
			};

			// 提取链接并合并别名
			const linkInfos = this.extractMDLinks(fileContent);
			const fileMap = this.consolidateFileAliases(linkInfos);

			// 关闭加载通知
			loadingNotice.hide();

			// 准备创建的文件列表
			const filesToCreate = this.prepareFilesToCreate(fileMap, context);

			if (filesToCreate.length === 0) {
				new Notice('No linkable files found');
				return;
			}

			// 显示确认对话框
			const result = await this.uiManager.showCreationConfirmDialog(
				filesToCreate,
				async (filePath, aliases, templatePath, templateAliasHandling) => {
					return await this.createFileWithMultipleAliases(filePath, aliases, templatePath, templateAliasHandling);
				}
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
				new Notice('No linkable files found');
				return;
			}

			// 显示确认对话框
			const result = await this.uiManager.showCreationConfirmDialog(
				filesToCreate,
				async (filePath, aliases, templatePath, templateAliasHandling) => {
					return await this.createFileWithMultipleAliases(filePath, aliases, templatePath, templateAliasHandling);
				}
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
	 * 扫描整个 vault 并创建缺失的 MD 文件，支持多别名，带UI交互
	 */
	async checkAndCreateMDFilesInVault(): Promise<void> {
		// 获取 vault 中的所有 markdown 文件
		const files = this.app.vault.getMarkdownFiles();

		if (files.length === 0) {
			new Notice("No markdown files found in vault");
			return;
		}

		// 显示初始进度通知
		const progressNotice = this.uiManager.showProgressNotice(
			'Scanning vault',
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
					'Scanning vault',
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
				new Notice('No linkable files found in entire vault');
				return;
			}

			// 显示确认对话框
			const result = await this.uiManager.showCreationConfirmDialog(
				filesToCreate,
				async (filePath, aliases, templatePath, templateAliasHandling) => {
					return await this.createFileWithMultipleAliases(filePath, aliases, templatePath, templateAliasHandling);
				}
			);

			// 直接关闭对话框，result为undefined
			if (result) {
				this.uiManager.showResultSummary(result);
			}
		} catch (error) {
			// 出错时关闭进度通知
			progressNotice.hide();
			console.error('Error scanning vault:', error);
			new Notice(`Error scanning vault: ${error.message}`);
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
			log.debug(() => `Created directory: ${pathToCreate}`);
		} catch (error) {
			console.error(`Failed to create directory: ${pathToCreate}`, error);
		}
	}

	/**
	 * 创建文件，支持多个别名
	 * @param filePath 文件路径
	 * @param aliases 别名数组
	 * @param templatePath 模板路径（可选）
	 * @param templateAliasHandling 模板别名处理方式（可选）
	 * @param autoTagging 是否自动添加标签（可选，默认为true）
	 * @returns 是否成功创建
	 */
	async createFileWithMultipleAliases(
		filePath: string,
		aliases: string[],
		templatePath?: string,
		templateAliasHandling?: TemplateAliasHandling,
		autoTagging: boolean = true
	): Promise<{ success: boolean, message?: string }> {
		try {
			// 添加调试日志
			log.debug(`Creating Files: ${filePath}, Using template: ${templatePath || 'No Template'}, Alias handling: ${templateAliasHandling || 'default'}`);

			// 提取文件路径的目录部分
			const lastSlashIndex = filePath.lastIndexOf('/');
			const directory = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';

			// 确保目录存在
			if (directory) {
				log.debug(`Create Directory: ${directory}`);
				try {
					await this.ensureDirectoryExists(directory);
				} catch (dirError) {
					return {
						success: false,
						message: `Cannot Create Directory "${directory}": ${dirError.message}`
					};
				}
			}

			// 提取文件名作为变量
			const filename = filePath.split('/').pop()?.replace('.md', '') || '';

			let fileContent = '';

			const shouldAddAliasesToFrontmatter = this.settings.addAliasesToFrontmatter &&
				(!templatePath || !templateAliasHandling);

			if (templateAliasHandling) {
				log.debug(`Using the alias handling method specified by the rules: ${templateAliasHandling}`);
				if (templateAliasHandling === TemplateAliasHandling.MERGE && aliases && aliases.length > 0) {
					this.pendingAliases.set(filePath, aliases);
					log.debug(`Aliases have been added to the pending queue: ${aliases.join(', ')}`);
				}
			} else if (shouldAddAliasesToFrontmatter && aliases && aliases.length > 0) {
				const aliasesString = aliases.map(alias => `  - "${alias}"`).join('\n');
				fileContent = `---\naliases:\n${aliasesString}\n---\n\n`;
				log.debug("Aliases have been added to the frontmatter based on global settings");
			}

			// 准备变量
			const variables = {
				filename: filename,
				path: filePath,
				aliases: aliases.join(', ')
			};

			// 如果使用模板且设置为合并别名，保存别名到待处理队列
			if (templatePath && templateAliasHandling === TemplateAliasHandling.MERGE && aliases && aliases.length > 0) {
				this.pendingAliases.set(filePath, aliases);
			}

			let success = false;
			let matchedRule;

			if (this.settings.useTemplates && templatePath) {
				log.debug(`Applying template: ${templatePath} to file: ${filePath}`);

				try {
					if (this.templaterService.hasTemplaterPlugin()) {
						log.debug('Processing template with Templater');

						try {
							const templaterMode = templateAliasHandling === TemplateAliasHandling.MERGE ? 'merge' : 'skip';
							const processedContent = await this.templaterService.processTemplateWithTemplater(
								templatePath,
								filePath,
								variables,
								templaterMode
							);

							if (processedContent) {
								log.debug(`File has been processed with Templater: ${filePath}`);
								success = true;
							} else {
								log.debug("Templater processing returned empty content, will attempt basic processing");
							}
						} catch (templaterError) {
							log.error(`Templater processing failed: ${templaterError.message}`);
						}
					}

					if (!success) {
						log.debug('Processing with basic template');

						const newFile = await this.app.vault.create(filePath, fileContent);
						log.debug(`Initial file has been created: ${filePath}`);

						// 获取模板文件
						const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
						if (templateFile && templateFile instanceof TFile) {
							// 读取模板内容
							const templateContent = await this.app.vault.read(templateFile);
							// 处理模板内容
							const processedContent = this.templaterService.processBasicTemplate(templateContent, variables, filePath);

							// 合并frontmatter并更新文件内容
							const targetFile = this.app.vault.getAbstractFileByPath(filePath);
							if (targetFile && targetFile instanceof TFile) {
								const mergedContent = this.templaterService.mergeFrontmatter(fileContent, processedContent);
								await this.app.vault.modify(targetFile, mergedContent);
								log.debug(`File content has been updated using basic processing: ${filePath}`);
								success = true;
							}
						} else {
							log.error(`Template file not found: ${templatePath}`);
						}
					}
				} catch (templateError) {
					log.error(`Failed to apply template: ${templateError.message}`);
					return {
						success: true,
						message: `File has been created, but applying the template failed: ${templateError.message}`
					};
				}
			} else {
				// 没有使用模板，直接创建文件
				await this.app.vault.create(filePath, fileContent);
				log.debug(`Creating file (No Template): ${filePath}`);
				success = true;
			}

			// 如果启用了自动标签功能
			if (success && autoTagging && this.settings.autoTagging) {
				// 在应用模板后，添加自动标签逻辑
				const targetFile = this.app.vault.getAbstractFileByPath(filePath);
				if (targetFile && targetFile instanceof TFile) {
					try {
						// 读取当前文件内容
						const currentContent = await this.app.vault.read(targetFile);

						// 生成标签建议
						const tagSuggestions = await this.tagHelper.suggestTags(
							currentContent,
							targetFile.basename,
							{sourcePath: this.app.workspace.getActiveFile()?.path}
						);

						// 过滤高置信度的标签
						const suggestedTags = tagSuggestions
							.filter(suggestion => suggestion.confidence > this.settings.autoTaggingMinConfidence)
							.map(suggestion => suggestion.tag);

						if (suggestedTags.length > 0) {
							// 应用标签到内容
							const updatedContent = this.tagHelper.applyTagsToContent(
								currentContent,
								suggestedTags
							);

							// 更新文件
							if (updatedContent !== currentContent) {
								await this.app.vault.modify(targetFile, updatedContent);
								log.debug(`Auto-added tags to ${filePath}: ${suggestedTags.join(', ')}`);
							}
						}
					} catch (error) {
						log.error(`Error adding auto-tags: ${error}`);
					}
				}
			}

			return {success: true};
		} catch (error) {
			console.error(`Failed to Create File: ${filePath}`, error);
			return {
				success: false,
				message: `Failed to Create File: ${error.message}`
			};
		}
	}

	/**
	 * 解析相对路径，考虑当前文件上下文
	 * @param path 需要解析的路径
	 * @returns 解析后的绝对路径
	 */
	private resolveRelativePath(path: string): string {
		// 如果已经是绝对路径，直接返回
		if (path.startsWith('/')) return path;

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return path;

		// 获取当前文件所在目录
		const currentFilePath = activeFile.path;
		const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/') || 0);

		if (path.startsWith('./') || path.startsWith('../')) {
			return resolveFilePath(path, currentDir, this.settings);
		}

		return path;
	}

	/**
	 * 从选中文本中创建未解析的链接
	 * @param selectedText 用户选中的文本
	 */
	async createLinksFromSelectedText(selectedText: string): Promise<void> {
		// 从选中文本中提取所有链接
		const linkInfos = this.extractMDLinks(selectedText);

		// 如果没有找到链接，显示提示并返回
		if (linkInfos.length === 0) {
			new Notice('No links found in selected text');
			return;
		}

		// 合并同一文件的多个别名
		const fileMap = this.consolidateFileAliases(linkInfos);

		// 获取当前文件的frontmatter信息
		const currentFile = this.app.workspace.getActiveFile();
		let context = {};

		if (currentFile) {
			const frontmatter = this.app.metadataCache.getFileCache(currentFile)?.frontmatter;
			context = {
				frontmatter: frontmatter,
				sourcePath: currentFile.path
			};
		}

		const filesToCreate = this.prepareFilesToCreate(fileMap, context);
		if (filesToCreate.length === 0) {
			new Notice('No linkable files to create');
			return;
		}

		// 显示确认对话框并创建文件
		const result = await this.uiManager.showCreationConfirmDialog(
			filesToCreate,
			async (filePath, aliases, templatePath, templateAliasHandling) => {
				return await this.createFileWithMultipleAliases(filePath, aliases, templatePath, templateAliasHandling);
			}
		);

		if (result) {
			this.uiManager.showResultSummary(result);
		}
	}

	// 预览方法
	async previewFileContent(templatePath: string, filename: string, aliases: string[]): Promise<string> {
		let previewContent = '';

		const variables = {
			filename: filename,
			path: filename,
			aliases: aliases.join(', ')
		};

		if (this.settings.useTemplates && templatePath) {
			// 读取模板内容
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
			if (templateFile && templateFile instanceof TFile) {
				// 读取模板内容
				const templateContent = await this.app.vault.read(templateFile);
				// 处理模板内容
				previewContent = this.templaterService.processBasicTemplate(templateContent, variables);

				// 如果有别名，在frontmatter中添加
				if (this.settings.addAliasesToFrontmatter && aliases && aliases.length > 0) {
					const aliasesString = aliases.map(alias => `  - "${alias}"`).join('\n');
					const frontmatter = `---\naliases:\n${aliasesString}\n---\n\n`;

					// 合并frontmatter和处理后的内容
					previewContent = this.templaterService.mergeFrontmatter(frontmatter, previewContent);
				}
			}
		} else {
			// 没有使用模板，创建基本内容
			if (this.settings.addAliasesToFrontmatter && aliases && aliases.length > 0) {
				const aliasesString = aliases.map(alias => `  - "${alias}"`).join('\n');
				previewContent = `---\naliases:\n${aliasesString}\n---\n\n`;
			}
		}

		return previewContent;
	}

	// 重命名
	async bulkRenameFiles(renamePairs: { oldPath: string, newPath: string }[]): Promise<{
		success: number,
		failed: number,
		updated: number
	}> {
		const result = {
			success: 0,
			failed: 0,
			updated: 0
		};

		// 收集所有可能受影响的文件
		const allFiles = this.app.vault.getMarkdownFiles();
		const filesToUpdate = new Map<TFile, string>();

		// 处理每个重命名对
		for (const {oldPath, newPath} of renamePairs) {
			try {
				// 获取要重命名的文件
				const file = this.app.vault.getAbstractFileByPath(oldPath);
				if (!file || !(file instanceof TFile)) {
					log.error(`File not found: ${oldPath}`);
					result.failed++;
					continue;
				}

				// 查找引用该文件的所有文件
				for (const potentialRefFile of allFiles) {
					const content = await this.app.vault.read(potentialRefFile);

					// 检查是否包含对此文件的引用
					const oldBasename = file.basename;
					const newBasename = newPath.split('/').pop()?.replace(/\.[^/.]+$/, '');

					if (!newBasename) continue;

					// 查找并替换Wiki链接 [[oldName]] -> [[newName]]
					const linkRegex = new RegExp(`\\[\\[(${oldBasename})(#[^\\]|]*)?(?:\\|([^\\]]*?))?\\]\\]`, 'g');
					let updatedContent = content.replace(linkRegex, (match, name, heading, alias) => {
						result.updated++;
						return `[[${newBasename}${heading || ''}${alias ? `|${alias}` : ''}]]`;
					});

					// 如果内容已更改，添加到更新列表
					if (updatedContent !== content) {
						filesToUpdate.set(potentialRefFile, updatedContent);
					}
				}

				// 执行重命名操作
				await this.app.fileManager.renameFile(file, newPath);
				result.success++;

			} catch (error) {
				log.error(`Error renaming file ${oldPath} to ${newPath}: ${error}`);
				result.failed++;
			}
		}

		// 更新所有引用
		for (const [file, newContent] of filesToUpdate.entries()) {
			try {
				await this.app.vault.modify(file, newContent);
			} catch (error) {
				log.error(`Error updating references in ${file.path}: ${error}`);
			}
		}

		return result;
	}

}

