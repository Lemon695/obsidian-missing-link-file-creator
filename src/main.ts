import { App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, Vault, WorkspaceLeaf } from 'obsidian';
import { FileOperations, FileOperationsOptions } from './utils/file-operations';
import { RuleManagementModal } from "./ui-manager/rule-management-modal";
import { log } from "./utils/log-utils";
import { TemplaterService } from "./service/templater-service";
import { CreateFileSettings, CreateFileSettingTab, DEFAULT_SETTINGS } from "./settings/settings";
import { t } from "./i18n/locale";
import { DASHBOARD_VIEW_TYPE, MissingLinksDashboardView } from "./views/batch-dashboard-view";
import { ACTIVE_SIDE_VIEW_TYPE, ActiveMissingLinksView } from "./views/active-missing-links-view";
import { IgnoreListManager } from "./service/ignore-list-manager";

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	public fileOperations: FileOperations;
	public templaterService: TemplaterService;
	public ignoreListManager: IgnoreListManager;
	private isCommandExecuting: boolean = false; // 添加命令执行状态标志

	async onload() {
		console.log(t('loadingPlugin') + this.manifest.version);

		// 注册仪表盘视图
		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf) => new MissingLinksDashboardView(leaf, this)
		);

		// 注册当前文件视图 (Side View)
		this.registerView(
			ACTIVE_SIDE_VIEW_TYPE,
			(leaf) => new ActiveMissingLinksView(leaf, this)
		);

		// 调试语言设置
		//debugLocale();


		await this.loadSettings();

		log.setDebugMode(this.settings.debugMode);

		// Initialize Ignore List Manager
		this.ignoreListManager = new IgnoreListManager(this.app, this.manifest);
		await this.ignoreListManager.loadIgnoreList();

		// Migration Logic
		if (this.settings.ignoreList && this.settings.ignoreList.length > 0) {
			await this.ignoreListManager.migrateFromSettings(this.settings.ignoreList);
			// Clear legacy settings
			this.settings.ignoreList = [];
			await this.saveSettings();
		}

		this.fileOperations = new FileOperations(<FileOperationsOptions>{
			app: this.app,
			settings: this.settings,
			ignoreListManager: this.ignoreListManager // Pass manager
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

		this.addCommand({
			id: 'open-batch-dashboard',
			name: "Open Batch Operations Dashboard",
			callback: async () => {
				const { workspace } = this.app;
				let leaf: WorkspaceLeaf | null = null;
				const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

				if (leaves.length > 0) {
					// A leaf with our view already exists, use that
					leaf = leaves[0];
				} else {
					// Our view could not be found in the workspace, create a new leaf
					// in the right sidebar for it
					leaf = workspace.getRightLeaf(false);
					if (leaf) {
						await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
					}
				}

				// "Reveal" the leaf in case it is in a collapsed sidebar
				if (leaf) {
					workspace.revealLeaf(leaf);
				}
			}
		});

		this.addCommand({
			id: 'open-active-missing-links-view',
			name: "Open Current File Missing Links (Side View)",
			callback: async () => {
				const { workspace } = this.app;
				let leaf: WorkspaceLeaf | null = null;
				const leaves = workspace.getLeavesOfType(ACTIVE_SIDE_VIEW_TYPE);

				if (leaves.length > 0) {
					leaf = leaves[0];
				} else {
					leaf = workspace.getRightLeaf(false);
					if (leaf) {
						await leaf.setViewState({ type: ACTIVE_SIDE_VIEW_TYPE, active: true });
					}
				}

				if (leaf) {
					workspace.revealLeaf(leaf);
				}
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


