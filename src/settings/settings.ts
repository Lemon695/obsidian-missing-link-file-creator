import { App, PluginSettingTab, Setting, TFolder } from 'obsidian'
import { FileCreationRule } from "@/model/rule-types";
import CheckAndCreateMDFilePlugin from "../main";
import { FolderSuggest } from './suggesters/folder-suggester';
import { log } from 'src/utils/log-utils';
import { RuleManagementModal } from "@/ui-manager/rule-management-modal";
import { t } from "@/i18n/locale";

export interface CreateFileSettings {
	createFileSetting: string;
	showCreateFileNotification: boolean;
	defaultFolderPath: string;

	addAliasesToFrontmatter: boolean;

	// 模板设置
	useTemplates: boolean;            // 是否使用模板
	defaultTemplatePath: string;      // 默认模板路径
	templateFolder: string;           // 模板文件夹路径
	templaterMethod: 'execute' | 'overwrite' | 'basic';

	// 规则设置
	useRules: boolean;                // 是否使用规则
	rules: FileCreationRule[];        // 文件创建规则

	// 自动标签设置
	autoTagging: boolean;
	autoTaggingMinConfidence: number;

	// Developer options
	debugMode: boolean;

	// 忽略列表
	ignoreList: string[];
}

export const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '', // 默认为目录

	addAliasesToFrontmatter: true,

	// 模板默认设置
	useTemplates: false,
	defaultTemplatePath: '',
	templateFolder: '',
	templaterMethod: 'execute',

	// 规则默认设置
	useRules: false,
	rules: [],

	// 自动标签默认设置
	autoTagging: false,
	autoTaggingMinConfidence: 0.7,

	// Developer options
	debugMode: false,

	// 忽略列表
	ignoreList: []
}

export class CreateFileSettingTab extends PluginSettingTab {
	plugin: CheckAndCreateMDFilePlugin;

	private rulesInfoContainer: HTMLElement | null = null;
	public static currentInstance: CreateFileSettingTab | null = null;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;

		CreateFileSettingTab.currentInstance = this;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 添加新增文件通知设置
		new Setting(containerEl)
			.setName(t('notificationSettings'))
			.setDesc(t('notificationSettingsDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCreateFileNotification)
				.onChange(async (value) => {
					this.plugin.settings.showCreateFileNotification = value;
					await this.plugin.saveSettings();
				}));

		// 文件夹选择器
		new Setting(containerEl)
			.setName(t('defaultPath'))
			.setDesc(t('defaultPathDesc'))
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder(t('exampleFolder'))
					.setValue(this.plugin.settings.defaultFolderPath)
					.onChange((new_folder) => {
						new_folder = new_folder.trim()
						new_folder = new_folder.replace(/\/$/, "");

						this.plugin.settings.defaultFolderPath = new_folder;
						this.plugin.saveSettings();
					});
				// @ts-ignore
				cb.containerEl.addClass("ccmd-folder-search");
			});

		new Setting(containerEl)
			.setName(t('templateFolder'))
			.setDesc(t('templateFolderDesc'))
			.addSearch(cb => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder(t('exampleTemplates'))
					.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value;
						await this.plugin.saveSettings();
						log.debug(`Template folder set to: ${value}`);
					});
			});

		new Setting(containerEl)
			.setName(t('enableTemplates'))
			.setDesc(t('enableTemplatesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useTemplates)
				.onChange(async (value) => {
					this.plugin.settings.useTemplates = value;
					await this.plugin.saveSettings();
					log.debug(`Template feature ${value ? 'enabled' : 'disabled'}`);
				}));

		// 别名控制
		new Setting(containerEl)
			.setName(t('addAliasesToFrontmatter'))
			.setDesc(t('addAliasesToFrontmatterDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.addAliasesToFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.addAliasesToFrontmatter = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: t('rulesManagement') });

		new Setting(containerEl)
			.setName(t('enableRules'))
			.setDesc(t('enableRulesDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useRules)
				.onChange(async (value) => {
					this.plugin.settings.useRules = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('manageRules'))
			.setDesc(t('manageRulesDesc'))
			.addButton(button => button
				.setButtonText(t('manageRulesButton'))
				.setCta()
				.onClick(() => {
					const modal = new RuleManagementModal(this.app, this.plugin);
					modal.open();
				}));

		this.rulesInfoContainer = containerEl.createDiv();

		this.createRulesSummary();

		// containerEl.createEl('h3', {text: 'Auto Tagging'});
		//
		// new Setting(containerEl)
		// 	.setName('Enable Auto Tagging')
		// 	.setDesc('Automatically suggest and apply tags to newly created files based on content and relationships')
		// 	.addToggle(toggle => toggle
		// 		.setValue(this.plugin.settings.autoTagging)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.autoTagging = value;
		// 			await this.plugin.saveSettings();
		// 		}));
		//
		// new Setting(containerEl)
		// 	.setName('Tag Confidence Threshold')
		// 	.setDesc('Only apply tags with confidence above this threshold (0.5-0.95)')
		// 	.addSlider(slider => slider
		// 		.setLimits(0.5, 0.95, 0.05)
		// 		.setValue(this.plugin.settings.autoTaggingMinConfidence)
		// 		.setDynamicTooltip()
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.autoTaggingMinConfidence = value;
		// 			await this.plugin.saveSettings();
		// 		}));

		new Setting(containerEl)
			.setName(t('developer'))
			.setHeading()

		// Debug mode
		new Setting(containerEl)
			.setName(t('debugMode'))
			.setDesc(t('debugModeDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));
	}

	private getRuleMatchDescription(rule: FileCreationRule): string {
		if (!rule.conditions || rule.conditions.length === 0) {
			return t('noMatchConditions') + "  → " + t('targetFolder') + ": " + (rule.targetFolder || t('defaultValue')) +
				", " + t('useTemplate') + ": " + (rule.templatePath || t('noneValue')) +
				(rule.enabled ? '' : ` [${t('disabled')}]`);
		}

		// 只展示前两个条件，如果有更多则添加省略号
		const conditionsToShow = rule.conditions.slice(0, 2);
		const remainingCount = Math.max(0, rule.conditions.length - 2);

		const conditionDescriptions = conditionsToShow.map(cond => {
			let operatorDesc = "";
			let typeDesc = "";

			switch (cond.operator) {
				case "and":
					operatorDesc = t('and');
					break;
				case "or":
					operatorDesc = t('or');
					break;
				case "not":
					operatorDesc = t('not');
					break;
				case "exclude":
					operatorDesc = t('exclude');
					break;
			}

			switch (cond.type) {
				case "contains":
					typeDesc = t('contains');
					break;
				case "startsWith":
					typeDesc = t('beginsWith');
					break;
				case "endsWith":
					typeDesc = t('endsWith');
					break;
				case "exact":
					typeDesc = t('matches');
					break;
				case "regex":
					typeDesc = t('regex');
					break;
			}

			return `${operatorDesc} ${typeDesc} "${cond.pattern}"`;
		});

		let description = conditionDescriptions.join("; ");

		if (remainingCount > 0) {
			description += `; ${t('plusMoreConditions', { count: remainingCount.toString() })}`;
		}

		return description +
			" → " + t('targetFolder') + ": " + (rule.targetFolder || t('defaultValue')) +
			", " + t('useTemplate') + ": " + (rule.templatePath || t('noneValue')) +
			(rule.enabled ? '' : ` [${t('disabled')}]`);
	}

	private createRulesSummary() {
		if (!this.rulesInfoContainer) return;

		// 清空容器
		this.rulesInfoContainer.empty();

		if (this.plugin.settings.rules && this.plugin.settings.rules.length > 0) {
			const rulesInfo = this.rulesInfoContainer.createDiv({ cls: 'rules-info' });
			rulesInfo.createEl('p', {
				text: t('rulesConfigured', { count: this.plugin.settings.rules.length.toString() }),
				cls: 'rules-count'
			});

			// 显示前3条规则摘要
			const previewCount = Math.min(this.plugin.settings.rules.length, 3);
			const rulesList = rulesInfo.createEl('ul', { cls: 'rules-preview' });

			for (let i = 0; i < previewCount; i++) {
				const rule = this.plugin.settings.rules[i];
				const ruleItem = rulesList.createEl('li');
				ruleItem.innerHTML = `<strong>${rule.name}</strong>: ${this.getRuleMatchDescription(rule)}`;
			}

			if (this.plugin.settings.rules.length > 3) {
				rulesInfo.createEl('p', {
					text: t('andMoreRules', { count: (this.plugin.settings.rules.length - 3).toString() }),
					cls: 'rules-more'
				});
			}
		}
	}

	public refreshRulesSummary() {
		this.createRulesSummary();
	}

	hide() {
		CreateFileSettingTab.currentInstance = null;
	}
}
