import {App, Notice, TAbstractFile, TFile, Vault} from 'obsidian';
import {resolveFilePath} from './pathUtils';
import {FileUtils} from './fileUtils';

interface FileOperationsOptions {
	app: App;
	settings: {
		defaultFolderPath: string;
		showCreateFileNotification: boolean;
	};
}

export class FileOperations {
	private app: App;
	private settings: FileOperationsOptions['settings'];
	private fileUtils: FileUtils;

	constructor(options: FileOperationsOptions) {
		this.app = options.app;
		this.settings = options.settings;
		this.fileUtils = new FileUtils(options.app);
	}

	/**
	 * 提取文件中的 MD 链接
	 * @param content 文件内容
	 * @returns 提取的链接数组
	 */
	extractMDLinks(content: string): string[] {
		// 使用正则表达式提取 [[...]] 中的内容
		const regex = /\[\[([^\\[\]]+)]]/g;
		const fileLinks: string[] = [];
		let match;
		while ((match = regex.exec(content)) !== null) {
			fileLinks.push(match[1]);
		}

		console.log(`fileLinks--->${fileLinks.length}`);
		return fileLinks;
	}

	/**
	 * 检查并创建 MD 文件
	 */
	async checkAndCreateMDFiles(): Promise<void> {
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) {
			console.log("No active file found.");
			return;
		}

		const fileContent = await this.app.vault.read(currentFile);
		const linkedFiles = this.extractMDLinks(fileContent);

		for (const link of linkedFiles) {
			const filePath = link.trim();

			console.log("filePath--->" + filePath)
			// 检查文件是否已存在于库中的任何位置
			const existingFile = this.fileUtils.getFileByFileNameV2(filePath);
			console.log(`检查文件 ${filePath}:`, existingFile ? "已存在" : "不存在");

			// 如果文件不存在，则创建
			if (!existingFile) {
				await this.createFile(filePath);
			}
		}
	}

	/**
	 * 在指定文件夹中检查并创建 MD 文件
	 */
	async checkAndCreateMDFilesInFolder(): Promise<void> {
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) {
			new Notice("No active file found.");
			return;
		}

		const folder = currentFile.parent;
		if (!folder) {
			new Notice("Current file is not in a folder.");
			return;
		}

		const files = this.app.vault.getFiles().filter(file => file.parent === folder && file.extension === 'md');

		if (files.length === 0) {
			new Notice("No MD files found in this folder.");
			return;
		}

		for (const file of files) {
			try {
				const fileContent = await this.app.vault.read(file);
				const linkedFiles = this.extractMDLinks(fileContent);

				for (const link of linkedFiles) {
					const filePath = link.trim();
					console.log("filePath--->" + filePath)

					const existingFile = this.fileUtils.getFileByFileNameV2(filePath);
					if (!existingFile) {
						console.log("Resolved File Path---" + filePath);
						await this.createFile(filePath);
					}
				}
			} catch (error) {
				console.error(`Error processing file ${file.path}:`, error);
				new Notice(`Error processing file ${file.path}: ${error}`);
			}
		}

		new Notice(`Finished checking and creating files in ${folder.path}.`);
	}

	/**
	 * 创建文件
	 * @param filePath 文件路径
	 */
	async createFile(filePath: string): Promise<void> {
		const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

		// 使用配置的默认文件夹路径
		const folderPath = this.settings.defaultFolderPath || '';

		const fullFilePath = folderPath ? `${folderPath}/${filePath}.md` : `${filePath}.md`;

		console.log(`fullFilePath--->${fullFilePath},filePath--->${folderPath}`)
		if (folderPath.length > 0) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			// 使用 Obsidian API 创建文件夹（如果文件夹不存在）
			if (!folder) {
				console.log(`Folder does not exist. Creating folder: ${folderPath}`);
				await this.app.vault.createFolder(folderPath);
			}
		}

		// 创建新的 Markdown 文件
		const fileContent = ``;
		try {
			// 使用 Vault.create 来创建文件
			await this.app.vault.create(fullFilePath, fileContent);

			// 使用配置的通知设置
			if (this.settings.showCreateFileNotification) {
				new Notice(`File created: ${fullFilePath}`);
			}

			console.log(`Created new file: ${fullFilePath}`);
		} catch (error) {
			console.error(`Failed to create file: ${fullFilePath}`, error);
		}
	}
}
