import {App, TFile, TFolder} from "obsidian";
import {CreateFileSettings} from "../settings";

export class TemplaterService {
	private app: App;
	private settings: CreateFileSettings;

	constructor(app: App, settings: CreateFileSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 检查Templater插件是否存在并启用
	 */
	hasTemplaterPlugin(): boolean {
		// @ts-ignore - 使用插件API检查Templater
		const hasTemplater = this.app.plugins.plugins["templater-obsidian"] !== undefined;
		console.log(`Templater插件${hasTemplater ? '已安装' : '未安装'}`);
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
		variables?: Record<string, string>
	): Promise<string | null> {
		try {
			if (!this.hasTemplaterPlugin()) {
				console.log("Templater插件未找到");
				return null;
			}

			console.log(`使用Templater处理模板: ${templatePath} 目标: ${targetPath}`);

			// 检查模板文件是否存在
			const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
			if (!templateFile || !(templateFile instanceof TFile)) {
				console.error(`Template file not found: ${templatePath}`);
				return null;
			}

			// 读取模板内容
			const templateContent = await this.app.vault.read(templateFile as TFile);
			console.log(`模板内容已读取，长度: ${templateContent.length}字符`);

			try {
				// 获取Templater插件实例
				// @ts-ignore - 访问Templater API
				const templaterPlugin = this.app.plugins.plugins["templater-obsidian"];

				// 使用Templater的内部函数处理模板
				// 不同版本的Templater可能有不同的API，这里我们尝试几种常见的方法

				// 方法1: 通过直接执行模板命令
				try {
					// 创建临时文件用于处理
					const tempFilePath = targetPath; // 直接用目标文件路径

					// 1. 先创建目标文件
					let targetFile = this.app.vault.getAbstractFileByPath(tempFilePath);
					if (!targetFile) {
						await this.app.vault.create(tempFilePath, templateContent);
						targetFile = this.app.vault.getAbstractFileByPath(tempFilePath);
					} else if (targetFile instanceof TFile) {
						await this.app.vault.modify(targetFile as TFile, templateContent);
					}

					if (!(targetFile instanceof TFile)) {
						throw new Error(`无法创建或访问目标文件: ${tempFilePath}`);
					}

					// 2. 使用Templater的命令API执行模板
					// @ts-ignore
					await templaterPlugin.templater.execute_commands_on_file(targetFile);

					// 3. 读取处理后的文件内容
					const processedContent = await this.app.vault.read(targetFile as TFile);
					console.log(`Templater处理完成，处理后内容长度: ${processedContent.length}字符`);

					return processedContent;
				} catch (methodError) {
					console.error(`Templater方法1失败: ${methodError.message}`, methodError);

					// 尝试方法2
					// @ts-ignore
					if (templaterPlugin.templater.overwrite_file_commands) {
						console.log("尝试Templater方法2");

						// 创建或获取目标文件
						let targetFile = this.app.vault.getAbstractFileByPath(targetPath);
						if (!targetFile) {
							await this.app.vault.create(targetPath, templateContent);
							targetFile = this.app.vault.getAbstractFileByPath(targetPath);
						}

						if (!(targetFile instanceof TFile)) {
							throw new Error(`无法创建或访问目标文件: ${targetPath}`);
						}

						// 使用overwrite_file_commands方法
						// @ts-ignore
						await templaterPlugin.templater.overwrite_file_commands(targetFile);

						// 读取处理后的内容
						return await this.app.vault.read(targetFile as TFile);
					}

					throw methodError;
				}
			} catch (error) {
				console.error("Templater处理失败: ", error);

				// 如果所有Templater方法都失败，退回到基本模板处理
				return this.processBasicTemplate(templateContent, variables || {});
			}
		} catch (error) {
			console.error("处理模板时发生错误:", error);
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
			console.log("模板文件夹路径为空");
			return [];
		}

		// 检查文件夹是否存在
		const folderObj = this.app.vault.getAbstractFileByPath(templateFolder);
		if (!folderObj || !(folderObj instanceof TFolder)) {
			console.log(`Cannot find template file: ${templateFolder}`);
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

		// 调试输出找到的模板文件
		console.log(`找到 ${templates.length} 个模板文件`);
		return templates;
	}
}
