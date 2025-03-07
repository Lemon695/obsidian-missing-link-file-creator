import {App, TFile, TFolder} from "obsidian";
import {CreateFileSettings} from "../settings";
import {FileOperations} from "../utils/file-operations";
import {log} from "../utils/log-utils";

export class TemplaterService {
	private app: App;
	private settings: CreateFileSettings;
	private fileOperations: FileOperations;

	constructor(app: App, settings: CreateFileSettings, fileOperations: FileOperations) {
		this.app = app;
		this.settings = settings;
		this.fileOperations = fileOperations;
	}

	/**
	 * 检查Templater插件是否存在并启用
	 */
	hasTemplaterPlugin(): boolean {
		// @ts-ignore - 使用插件API检查Templater
		const hasTemplater = this.app.plugins.plugins["templater-obsidian"] !== undefined;
		log.debug(`Templater plugin ${hasTemplater ? 'is installed' : 'is not installed'}`);
		return hasTemplater;
	}

	/**
	 * 使用Templater处理模板并生成内容
	 * @param templatePath 模板路径
	 * @param targetPath 目标文件路径
	 * @param variables 可选的变量
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
				// @ts-ignore - 访问Templater API
				const templaterPlugin = this.app.plugins.plugins["templater-obsidian"];

				// 使用Templater的overwrite_file_commands方法
				if (templaterPlugin.templater.overwrite_file_commands) {

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
						const aliases = this.fileOperations?.pendingAliases.get(targetPath);
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
	processBasicTemplate(templateContent: string, variables: Record<string, string>): string {
		let processed = templateContent;

		// 简单的变量替换
		for (const [key, value] of Object.entries(variables)) {
			const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
			processed = processed.replace(regex, value || '');
		}

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

		// 递归收集文件夹中的所有模板
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

		log.debug(`Found ${templates.length} template files`);
		return templates;
	}
}
