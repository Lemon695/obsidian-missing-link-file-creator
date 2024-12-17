import {App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileOperations} from './utils/fileOperations';

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
	private fileOperations: FileOperations;
	// 添加命令执行状态标志
	private isCommandExecuting: boolean = false;

	async onload() {
		await this.loadSettings();

		// 初始化 FileOperations
		this.fileOperations = new FileOperations({
			app: this.app,
			settings: {
				defaultFolderPath: this.settings.defaultFolderPath,
				showCreateFileNotification: this.settings.showCreateFileNotification
			}
		});

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
				// 设置命令执行标志
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFiles();
				// 命令执行完成后重置标志
				this.isCommandExecuting = false;
			},
		});

		this.addCommand({
			id: 'check-and-create-linked-md-files-in-folder',
			name: 'Check and Create Linked MD Files in Folder',
			callback: async () => {
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFilesInFolder();
				this.isCommandExecuting = false;
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
