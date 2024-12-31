import {App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileOperations, FileOperationsOptions} from './utils/file-operations';
import {CreateFileSettings, CreateFileSettingTab, DEFAULT_SETTINGS} from "./settings";
import {LogUtils} from './utils/log-utils';

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	private fileOperations: FileOperations;
	// 添加命令执行状态标志
	private isCommandExecuting: boolean = false;

	async onload() {
		await this.loadSettings();

		this.fileOperations = new FileOperations(<FileOperationsOptions>{
			app: this.app,
			settings: this.settings,
		});

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
		LogUtils.showDebugLog(() => 'CheckAndCreateMDFilePlugin unloaded', this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}


