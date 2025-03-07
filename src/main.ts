import {App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileOperations, FileOperationsOptions} from './utils/file-operations';
import {CreateFileSettings, CreateFileSettingTab, DEFAULT_SETTINGS} from "./settings";
import {LogUtils} from './utils/log-utils';
import {RuleManagementModal} from "./ui-manager/rule-management-modal";
import {TemplaterService} from "./model/templater-service";

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	private fileOperations: FileOperations;
	public templaterService: TemplaterService;
	// 添加命令执行状态标志
	private isCommandExecuting: boolean = false;

	async onload() {
		await this.loadSettings();

		this.fileOperations = new FileOperations(<FileOperationsOptions>{
			app: this.app,
			settings: this.settings,
		});

		this.templaterService = new TemplaterService(this.app, this.settings, this.fileOperations);

		// 校验当前文件关联的文件链接
		this.addCommand({
			id: 'create-missing-links-current-file',
			name: 'Create Files for Unresolved Links in Current File',
			callback: async () => {
				// 设置命令执行标志
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFiles();
				// 命令执行完成后重置标志
				this.isCommandExecuting = false;
			},
		});

		//监测当前文件所在文件夹内的所有文件-关联的文件链接
		this.addCommand({
			id: 'create-missing-links-folder-scan',
			name: 'Scan Folder and Create Missing Files',
			callback: async () => {
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFilesInFolder();
				this.isCommandExecuting = false;
			},
		});

		this.addCommand({
			id: 'open-create-missing-links-rule-management',
			name: 'Manage File Creation Rules',
			callback: () => {
				new RuleManagementModal(this.app, this).open();
			}
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				// 获取选中的文本
				const selectedText = editor.getSelection();
				if (selectedText && selectedText.includes("[[")) {
					menu.addItem((item) => {
						item
							.setTitle("Create Files for Selected Unresolved Links") //创建选中的未解析链接
							.setIcon("document-plus")
							.onClick(async () => {
								// 调用新方法处理选中文本中的链接
								await this.fileOperations.createLinksFromSelectedText(selectedText);
							});
					});
				}
			})
		);

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


