import {App, PluginSettingTab, Setting} from 'obsidian'
import CheckAndCreateMDFilePlugin from "./main";

export interface CreateFileSettings {
	createFileSetting: string;
	// 新增设置项：是否显示"新增文件"通知
	showCreateFileNotification: boolean;
	defaultFolderPath: string;

	// Developer options
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '', // 默认为空，表示根目录

	// Developer options
	debugMode: false,
}

export class CreateFileSettingTab extends PluginSettingTab {
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


		new Setting(containerEl)
			.setName('Developer')
			.setHeading()

		// Debug mode
		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug mode to log detailed information to the console.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));
	}
}
