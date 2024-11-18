import {App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile} from 'obsidian';

interface CreateFileSettings {
	createFileSetting: string;
	// 新增设置项：是否显示"新增文件"通知
	showCreateFileNotification: boolean;
	defaultFolderPath: string;
}

const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '', // 默认为空，表示根目录
}

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	private isCommandExecuting: boolean = false; // 添加命令执行状态标志

	async onload() {
		await this.loadSettings();

		// 注册文件删除事件监听器
		this.registerEvent(
			this.app.vault.on('create', (file: TAbstractFile) => {
				// 只在命令执行期间响应文件创建事件
				if (this.isCommandExecuting) {
					if (this.settings.showCreateFileNotification) {
						// 当文件被添加时显示自定义通知
						new Notice(`File create: ${file.path}`);
					}

					// 在控制台记录添加操作
					console.log(`File create: ${file.path} at ${new Date().toLocaleString()}`);
				}
			})
		);

		// 校验当前文件关联的文件链接新增文件的命令
		this.addCommand({
			id: 'check-and-create-md-files',
			name: 'Check and Create Linked MD Files',
			callback: async () => {
				this.isCommandExecuting = true; // 设置命令执行标志
				await this.checkAndCreateMDFiles();
				this.isCommandExecuting = false; // 命令执行完成后重置标志
			},
		});

		// 添加设置标签
		this.addSettingTab(new CreateFileSettingTab(this.app, this));
	}

	onunload() {
		console.log('CheckAndCreateMDFilePlugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async checkAndCreateMDFiles() {
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
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);

			// 如果文件不存在，则创建
			if (!existingFile) {
				await this.createFile(filePath);
			}
		}
	}

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

	async createFile(filePath: string) {
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
			console.log(`Created new file: ${fullFilePath}`);
		} catch (error) {
			console.error(`Failed to create file: ${fullFilePath}`, error);
		}
	}
}

class CreateFileSettingTab extends PluginSettingTab {
	plugin: CheckAndCreateMDFilePlugin;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// 添加新增文件通知设置
		new Setting(containerEl)
			.setName('Show Create File Notifications')
			.setDesc('Show a notification when a file is create')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCreateFileNotification)
				.onChange(async (value) => {
					this.plugin.settings.showCreateFileNotification = value;
					await this.plugin.saveSettings();
				}));

		// 添加设置说明
		containerEl.createEl('h2', {text: 'Plugin Settings'});

		new Setting(containerEl)
			.setName('Default Folder Path')
			.setDesc('Set the default folder where new MD files will be created.')
			.addText(text =>
				text.setValue(this.plugin.settings.defaultFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolderPath = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
