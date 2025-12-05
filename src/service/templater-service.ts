import { App, TFile, TFolder } from "obsidian";
import { FileOperations } from "@/utils/file-operations";
import { log } from "@/utils/log-utils";
import { CreateFileSettings } from "@/settings/settings";
import { CACHE_DURATIONS } from "@/constants/cache-constants";

export class TemplaterService {
	private app: App;
	private settings: CreateFileSettings;
	private fileOperations: FileOperations;
	private templateCache: Map<string, { content: string, lastAccessed: number }> = new Map();
	private templateListCache: string[] | null = null;
	private templateLastRefreshTime: number = 0;
	private readonly MAX_CACHE_SIZE = 50; // 限制缓存大小

	constructor(app: App, settings: CreateFileSettings, fileOperations: FileOperations) {
		this.app = app;
		this.settings = settings;
		this.fileOperations = fileOperations;
	}

	/**
	 * 检查Templater插件是否存在并启用
	 */
	hasTemplaterPlugin(): boolean {
		const hasTemplater = this.app.plugins.plugins["templater-obsidian"] !== undefined;
		log.debug(`Templater plugin ${hasTemplater ? 'is installed' : 'is not installed'}`);
		return hasTemplater;
	}

	/**
	 * 使用Templater处理模板并生成内容
	 * @param templatePath 模板路径
	 * @param targetPath 目标文件路径
	 * @param variables 可选的变量
	 * @param templaterMode
	 * @returns 处理后的内容，如果失败则返回null
	 */
	async processTemplateWithTemplater(
		templatePath: string,
		targetPath: string,
		variables?: Record<string, string>,
		templaterMode: 'merge' | 'skip' = 'skip'
	): Promise<string | null> {
		try {
			if (!this.hasTemplaterPlugin()) {
				log.debug("Templater plugin not found");
				return null;
			}

			log.debug(`Processing template with Templater: ${templatePath} Target: ${targetPath}, templaterMode: ${templaterMode}`);

			// 检查模板文件是否存在
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
			if (!templateFile || !(templateFile instanceof TFile)) {
				console.error(`Template file not found: ${templatePath}`);
				return null;
			}

			// 读取模板内容
			const templateContent = await this.app.vault.read(templateFile as TFile);
			log.debug(`Template content has been read, length: ${templateContent.length} characters`);

			try {
				const templaterPlugin = this.app.plugins.plugins["templater-obsidian"];

				// 使用Templater的overwrite_file_commands方法
				if (templaterPlugin && typeof (templaterPlugin as any).templater?.overwrite_file_commands === 'function') {

					let targetFile = this.app.vault.getAbstractFileByPath(targetPath);
					if (!targetFile) {
						await this.app.vault.create(targetPath, templateContent);
						targetFile = this.app.vault.getAbstractFileByPath(targetPath);
					} else if (targetFile instanceof TFile) {
						await this.app.vault.modify(targetFile as TFile, templateContent);
					}

					if (!(targetFile instanceof TFile)) {
						throw new Error(`Unable to create or access target file: ${targetPath}`);
					}

					// 使用overwrite_file_commands方法
					await templaterPlugin.templater.overwrite_file_commands(targetFile);

					// 读取处理后的文件内容
					const processedContent = await this.app.vault.read(targetFile as TFile);
					log.debug(`Templater processing completed, processed content length: ${processedContent.length} characters`);

					let finalContent = processedContent;

					// 如果设置为合并模式且有待处理的别名，将别名合并到处理后的内容中

					if (templaterMode === 'merge') {
						const aliases = this.fileOperations && this.fileOperations.pendingAliases.get(targetPath);
						if (aliases && aliases.length > 0) {
							log.debug(`Merging aliases into file ${targetPath}, aliases: ${aliases.join(', ')}`);

							// 检查是否包含frontmatter
							const hasFrontmatter = finalContent.trim().startsWith('---');

							if (hasFrontmatter) {
								// 从处理后的内容中提取frontmatter
								const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
								const fmMatch = finalContent.match(fmRegex);

								if (fmMatch) {
									const frontmatter = fmMatch[1];
									const restContent = finalContent.slice(fmMatch[0].length);

									// 检查是否已有aliases字段
									const hasAliases = /^aliases:/m.test(frontmatter);

									if (hasAliases) {
										// 将新别名添加到现有别名列表中
										// 支持多种格式: 数组格式和列表格式
										const aliasesYaml = aliases.map(a => `  - "${a}"`).join('\n');

										if (/aliases:\s*\[.*\]/m.test(frontmatter)) {
											// 数组格式: aliases: ["别名1", "别名2"]
											const updatedFrontmatter = frontmatter.replace(
												/aliases:\s*\[(.*)\]/m,
												(match, existingAliases) => {
													const existingList = existingAliases.trim();
													const prefix = existingList ? existingList + ', ' : '';
													return `aliases: [${prefix}${aliases.map(a => `"${a}"`).join(', ')}]`;
												}
											);
											finalContent = `---\n${updatedFrontmatter}\n---${restContent}`;
										} else {
											// 列表格式: aliases:\n  - "别名1"\n  - "别名2"
											const indentMatch = frontmatter.match(/aliases:\s*\n(\s+)- /);
											const indent = indentMatch ? indentMatch[1] : '  ';

											// 根据现有缩进格式化新别名
											const formattedAliases = aliases.map(a => `${indent}- "${a}"`).join('\n');

											// 查找aliases块的结尾位置
											const updatedFrontmatter = frontmatter.replace(
												/aliases:\s*(\n\s+- .*)*$/m,
												(match) => {
													return `${match}\n${formattedAliases}`;
												}
											);
											finalContent = `---\n${updatedFrontmatter}\n---${restContent}`;
										}
									} else {
										// 没有aliases字段，添加新字段
										const aliasesYaml = aliases.map(a => `  - "${a}"`).join('\n');
										const updatedFrontmatter = `${frontmatter}\naliases:\n${aliasesYaml}`;
										finalContent = `---\n${updatedFrontmatter}\n---${restContent}`;
									}

									// 更新文件内容
									await this.app.vault.modify(targetFile as TFile, finalContent);
									log.debug(`Alias merging completed, file has been updated`);
								}
							} else {
								const aliasesYaml = aliases.map(a => `  - "${a}"`).join('\n');
								finalContent = `---\naliases:\n${aliasesYaml}\n---\n\n${finalContent}`;
								await this.app.vault.modify(targetFile as TFile, finalContent);
								log.debug(`Added frontmatter and aliases`);
							}

							// 处理完成后清除pending别名
							this.fileOperations.pendingAliases.delete(targetPath);
						}
					}

					return finalContent;
				} else {
					log.debug("Templater's overwrite_file_commands method not found, falling back to basic template processing");
					return this.processBasicTemplate(templateContent, variables || {});
				}
			} catch (error) {
				log.error(`Templater processing failed: ${error}`);
				return this.processBasicTemplate(templateContent, variables || {});
			}
		} catch (error) {
			log.error(`Error occurred while processing template: ${error}`);
			try {
				const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
				if (templateFile && templateFile instanceof TFile) {
					const templateContent = await this.app.vault.read(templateFile);
					return this.processBasicTemplate(templateContent, variables || {}, targetPath);
				}
			} catch (fallbackError) {
				log.error(`Fallback template processing failed: ${fallbackError.message}`);
			}
			return null;
		}
	}

	/**
	 * 获取临时文件夹路径
	 */
	private getTempFolderPath(): string {
		return `${this.app.vault.configDir}/temp-templater`;
	}

	/**
	 * 确保临时文件夹存在
	 */
	private async ensureTempFolderExists(): Promise<void> {
		const tempFolderPath = this.getTempFolderPath();
		const tempFolder = this.app.vault.getAbstractFileByPath(tempFolderPath);

		if (!tempFolder) {
			try {
				await this.app.vault.createFolder(tempFolderPath);
			} catch (error) {
				console.error("Failed to create temp folder:", error);
			}
		}
	}

	/**
	 * 基本模板处理（当Templater不可用时使用）
	 * @param templateContent 模板内容
	 * @param variables 变量
	 */
	processBasicTemplate(templateContent: string, variables: Record<string, string>, targetPath?: string): string {
		// 扩展变量
		const expandedVars = this.expandTemplateVariables(variables, targetPath || '');

		let processed = templateContent;

		// 更复杂的模板语法: {{var}} 和 {{func(var)}}
		const regex = /\{\{\s*([^}]+)\s*\}\}/g;

		processed = processed.replace(regex, (match, expr) => {
			expr = expr.trim();

			// 处理简单变量: {{var}}
			if (/^[a-zA-Z0-9_]+$/.test(expr)) {
				return expandedVars[expr] !== undefined ? expandedVars[expr] : match;
			}

			// 处理函数调用: {{lowercase(var)}} 或 {{uppercase(var)}}
			const funcMatch = expr.match(/^([a-zA-Z0-9_]+)\(([^)]*)\)$/);
			if (funcMatch) {
				const funcName = funcMatch[1];
				const param = funcMatch[2].trim();

				// 解析参数
				let value;
				if (/^[a-zA-Z0-9_]+$/.test(param)) {
					// 参数是变量
					value = expandedVars[param] !== undefined ? expandedVars[param] : param;
				} else if (/^["'].*["']$/.test(param)) {
					// 参数是字符串字面量
					value = param.slice(1, -1);
				} else {
					// 无法解析的参数
					return match;
				}

				// 执行函数
				switch (funcName.toLowerCase()) {
					case 'lowercase':
						return value.toLowerCase();
					case 'uppercase':
						return value.toUpperCase();
					case 'capitalize':
						return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
					case 'kebabcase':
						return value
							.replace(/\s+/g, '-')
							.replace(/([a-z])([A-Z])/g, '$1-$2')
							.toLowerCase();
					case 'snakecase':
						return value
							.replace(/\s+/g, '_')
							.replace(/([a-z])([A-Z])/g, '$1_$2')
							.toLowerCase();
					case 'camelcase':
						return value
							.replace(/[\s-_]+(.)/g, (_match: string, c: string) => c.toUpperCase())
							.replace(/^[A-Z]/, (c: string) => c.toLowerCase());
					case 'titlecase':
						return value.replace(/\b\w/g, (c: string) => c.toUpperCase());
					default:
						return match;
				}
			}

			return match;
		});

		return processed;
	}

	/**
	 * 合并frontmatter
	 * @param frontmatter1 第一个frontmatter
	 * @param content2 可能包含frontmatter的内容
	 */
	mergeFrontmatter(frontmatter1: string, content2: string): string {
		// 如果第二个内容不包含frontmatter，直接拼接
		if (!content2.startsWith('---')) {
			return frontmatter1 + content2;
		}

		// 如果第一个frontmatter为空，直接返回第二个内容
		if (!frontmatter1 || frontmatter1 === '---\n---\n\n') {
			return content2;
		}

		try {
			// 提取第一个frontmatter的YAML部分
			const fm1Match = frontmatter1.match(/^---\s*([\s\S]*?)\s*---\s*/);
			if (!fm1Match) return frontmatter1 + content2;
			const yaml1 = fm1Match[1];

			// 提取第二个内容的YAML部分和正文
			const fm2Match = content2.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
			if (!fm2Match) return frontmatter1 + content2;

			const yaml2 = fm2Match[1];
			const body2 = fm2Match[2];

			// 简单合并YAML（这里可以用更复杂的YAML解析库，但这是基本实现）
			const mergedYaml = this.mergeYamlStrings(yaml1, yaml2);

			return `---\n${mergedYaml}\n---\n\n${body2}`;
		} catch (error) {
			console.error("Error merging frontmatter:", error);
			return frontmatter1 + content2;
		}
	}

	/**
	 * 合并两个YAML字符串
	 * 简单实现，实际项目可能需要使用YAML库
	 */
	private mergeYamlStrings(yaml1: string, yaml2: string): string {
		const lines1 = yaml1.split('\n');
		const lines2 = yaml2.split('\n');

		// 提取第一个YAML的键和内容
		const yamlMap = new Map<string, string>();

		for (const line of [...lines1, ...lines2]) {
			const match = line.match(/^(\w+):(.*)/);
			if (match) {
				const [_, key, value] = match;
				if (!yamlMap.has(key.trim())) {
					yamlMap.set(key.trim(), value.trim());
				}
			}
		}

		// 重建YAML
		return Array.from(yamlMap.entries())
			.map(([key, value]) => `${key}: ${value}`)
			.join('\n');
	}

	/**
	 * 获取可用的模板列表
	 */
	getAvailableTemplates(): string[] {
		// 使用缓存减少文件系统访问
		const now = Date.now();
		if (this.templateListCache && (now - this.templateLastRefreshTime < CACHE_DURATIONS.TEMPLATE_LIST_MS)) {
			return this.templateListCache;
		}

		const templateFolder = this.settings.templateFolder;
		if (!templateFolder) {
			return [];
		}

		// 检查文件夹是否存在
		const folderObj = this.app.vault.getAbstractFileByPath(templateFolder);
		if (!folderObj || !(folderObj instanceof TFolder)) {
			log.debug(`Cannot find template file: ${templateFolder}`);
			return [];
		}

		const templates: string[] = [];

		const collectTemplates = (folder: TFolder) => {
			folder.children.forEach(file => {
				if (file instanceof TFile && file.extension === 'md') {
					templates.push(file.path);
				} else if (file instanceof TFolder) {
					collectTemplates(file);
				}
			});
		};

		collectTemplates(folderObj as TFolder);

		// 保存到缓存
		this.templateListCache = templates;
		this.templateLastRefreshTime = now;

		log.debug(`Found ${templates.length} template files`);
		return templates;
	}

	/**
	 * 扩展模板变量，添加更多有用的数据
	 * @param variables 基本变量
	 * @param targetPath 目标文件路径
	 * @returns 扩展后的变量对象
	 */
	private expandTemplateVariables(variables: Record<string, string>, targetPath: string): Record<string, string> {
		const expanded = { ...variables };

		// 当前日期时间变量
		const now = new Date();
		expanded.date = now.toISOString().split('T')[0]; // YYYY-MM-DD
		expanded.time = now.toTimeString().split(' ')[0]; // HH:MM:SS
		expanded.datetime = now.toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS

		// 格式化日期变量
		expanded.year = now.getFullYear().toString();
		expanded.month = (now.getMonth() + 1).toString().padStart(2, '0');
		expanded.day = now.getDate().toString().padStart(2, '0');
		expanded.hour = now.getHours().toString().padStart(2, '0');
		expanded.minute = now.getMinutes().toString().padStart(2, '0');
		expanded.second = now.getSeconds().toString().padStart(2, '0');

		// 路径相关变量
		if (targetPath) {
			const pathParts = targetPath.split('/');
			expanded.folder = pathParts.slice(0, -1).join('/');
			expanded.parentFolder = pathParts.slice(0, -2).join('/') || '/';

			const filenameParts = pathParts.pop()?.split('.') || [];
			expanded.fileext = filenameParts.length > 1 ? filenameParts.pop() || '' : '';
		}

		// 活动文件相关变量
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			expanded.activeFile = activeFile.basename;
			expanded.activeFilePath = activeFile.path;
			expanded.activeFileFolder = activeFile.parent?.path || '';
		}

		return expanded;
	}

	private pruneTemplateCache(): void {
		if (this.templateCache.size > this.MAX_CACHE_SIZE) {
			// 只保留最近使用的模板
			const entries = Array.from(this.templateCache.entries());
			entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
			const toKeep = entries.slice(0, this.MAX_CACHE_SIZE);

			this.templateCache.clear();
			for (const [key, value] of toKeep) {
				this.templateCache.set(key, value);
			}

			log.debug(`已将模板缓存减少到 ${this.templateCache.size} 项`);
		}
	}

	// 清除缓存
	clearTemplateCache(): void {
		this.templateCache.clear();
		this.templateListCache = null;
		this.templateLastRefreshTime = 0;
		log.debug("Template cache cleared");
	}

	/**
	 * 格式化日期
	 * @param date 日期对象
	 * @param format 格式字符串
	 * @returns 格式化后的日期字符串
	 */
	private formatDate(date: Date, format: string): string {
		const tokens: Record<string, () => string> = {
			'YYYY': () => date.getFullYear().toString(),
			'MM': () => (date.getMonth() + 1).toString().padStart(2, '0'),
			'DD': () => date.getDate().toString().padStart(2, '0'),
			'HH': () => date.getHours().toString().padStart(2, '0'),
			'hh': () => (date.getHours() % 12 || 12).toString().padStart(2, '0'),
			'mm': () => date.getMinutes().toString().padStart(2, '0'),
			'ss': () => date.getSeconds().toString().padStart(2, '0'),
			'M': () => (date.getMonth() + 1).toString(),
			'D': () => date.getDate().toString(),
			'H': () => date.getHours().toString(),
			'h': () => (date.getHours() % 12 || 12).toString(),
			'm': () => date.getMinutes().toString(),
			's': () => date.getSeconds().toString(),
			'dddd': () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
			'ddd': () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
			'MMMM': () => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()],
			'MMM': () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
			'A': () => date.getHours() < 12 ? 'AM' : 'PM',
			'a': () => date.getHours() < 12 ? 'am' : 'pm'
		};

		// 替换所有日期token
		let result = format;

		// 先处理长的token，防止部分匹配问题
		const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

		for (const token of sortedTokens) {
			result = result.replace(new RegExp(token, 'g'), tokens[token]());
		}

		return result;
	}
}
