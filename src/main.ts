import {App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, Vault} from 'obsidian';
import {FileOperations, FileOperationsOptions} from './utils/file-operations';
import {RuleManagementModal} from "./ui-manager/rule-management-modal";
import {log} from "./utils/log-utils";
import {TemplaterService} from "./service/templater-service";
import {CreateFileSettings, CreateFileSettingTab, DEFAULT_SETTINGS} from "./settings/settings";
import {t} from "./i18n/locale";

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	public fileOperations: FileOperations;
	public templaterService: TemplaterService;
	private isCommandExecuting: boolean = false; // 添加命令执行状态标志

	async onload() {
		console.log(t('loadingPlugin') + this.manifest.version);

		// 调试语言设置
		//debugLocale();

		await this.loadSettings();

		log.setDebugMode(this.settings.debugMode);

		this.fileOperations = new FileOperations(<FileOperationsOptions>{
			app: this.app,
			settings: this.settings,
		});

		this.templaterService = new TemplaterService(this.app, this.settings, this.fileOperations);

		// 校验当前文件关联的文件链接
		this.addCommand({
			id: 'create-missing-links-current-file',
			name: t('createFilesForUnresolvedLinksInCurrentFile'),
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
			name: t('scanFolderAndCreateMissingFiles'),
			callback: async () => {
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFilesInFolder();
				this.isCommandExecuting = false;
			},
		});

		//扫描整个 vault 中的所有文件并创建缺失的链接文件
		this.addCommand({
			id: 'create-missing-links-vault-scan',
			name: t('scanEntireVaultAndCreateMissingFiles'),
			callback: async () => {
				this.isCommandExecuting = true;
				await this.fileOperations.checkAndCreateMDFilesInVault();
				this.isCommandExecuting = false;
			},
		});

		this.addCommand({
			id: 'open-create-missing-links-rule-management',
			name: t('manageFileCreationRules'),
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
							.setTitle(t('createFilesForSelectedUnresolvedLinks'))
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
		log.debug("CheckAndCreateMDFilePlugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		log.setDebugMode(this.settings.debugMode);
	}

}


