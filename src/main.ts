import { Plugin } from 'obsidian';
import { FileOperations, FileOperationsOptions } from './utils/file-operations';
import { log } from './utils/log-utils';
import { TemplaterService } from './service/templater-service';
import { CreateFileSettings, DEFAULT_SETTINGS } from './settings/settings';
import { t } from './i18n/locale';
import { IgnoreListManager } from './service/ignore-list-manager';
import { HistoryManager } from './service/history-manager';
import { ModuleManager } from './core/module-manager';
import { ModularSettingTab } from './core/settings-tab';

// Modules
import { ScanModule } from './modules/scan/index';
import { RuleModule } from './modules/rule/index';
import { IgnoreModule } from './modules/ignore/index';
import { TemplateModule } from './modules/template/index';
import { TagModule } from './modules/tag/index';
import { SidebarModule } from './modules/sidebar/index';
import { DashboardModule } from './modules/dashboard/index';
import { DataviewModule } from './modules/dataview/index';

export interface MissingLinksApi {
	scanCurrentFile(): Promise<void>;
	createFile(link: string, sourcePath?: string): Promise<{ success: boolean; path?: string }>;
	getIgnoreList(): string[];
}

export default class CheckAndCreateMDFilePlugin extends Plugin {
	settings: CreateFileSettings;
	public fileOperations: FileOperations;
	public templaterService: TemplaterService;
	public ignoreListManager: IgnoreListManager;
	public historyManager: HistoryManager;
	public moduleManager: ModuleManager;
	public api: MissingLinksApi;

	async onload() {
		log.info(t('loadingPlugin') + this.manifest.version);

		await this.loadSettings();
		log.setDebugMode(this.settings.debugMode);

		// Core services
		this.ignoreListManager = new IgnoreListManager(this.app, this.manifest);
		await this.ignoreListManager.loadIgnoreList();

		// Migrate legacy ignore list from settings
		if (this.settings.ignoreList && this.settings.ignoreList.length > 0) {
			await this.ignoreListManager.migrateFromSettings(this.settings.ignoreList);
			this.settings.ignoreList = [];
			await this.saveSettings();
		}

		this.historyManager = new HistoryManager(this.app, this.manifest);
		await this.historyManager.load();

		this.fileOperations = new FileOperations(<FileOperationsOptions>{
			app: this.app,
			settings: this.settings,
			ignoreListManager: this.ignoreListManager,
			historyManager: this.historyManager,
		});

		this.templaterService = new TemplaterService(this.app, this.settings, this.fileOperations);

		// Module system
		this.moduleManager = new ModuleManager(this);
		this.moduleManager.register(new ScanModule(this));
		this.moduleManager.register(new RuleModule(this));
		this.moduleManager.register(new IgnoreModule(this));
		this.moduleManager.register(new TemplateModule(this));
		this.moduleManager.register(new TagModule(this));
		this.moduleManager.register(new SidebarModule(this));
		this.moduleManager.register(new DashboardModule(this));
		this.moduleManager.register(new DataviewModule(this));
		await this.moduleManager.loadAll();

		// Public API for external plugins / scripts
		this.api = {
			scanCurrentFile: async () => {
				await this.fileOperations.checkAndCreateMDFiles();
			},
			createFile: async (link: string, sourcePath?: string) => {
				return this.fileOperations.createSingleFileFromLink(link, sourcePath);
			},
			getIgnoreList: () => {
				return this.ignoreListManager.getIgnoreList();
			},
		};

		this.addSettingTab(new ModularSettingTab(this.app, this));
	}

	onunload() {
		this.moduleManager?.unloadAll();
		log.debug('CheckAndCreateMDFilePlugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		log.setDebugMode(this.settings.debugMode);
	}
}
