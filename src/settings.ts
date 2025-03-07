import {App, PluginSettingTab, Setting, TFolder} from 'obsidian'
import CheckAndCreateMDFilePlugin from "./main";
import {FileCreationRule, RuleMatchType} from "./model/rule-types";
import {RuleManagementModal} from "./ui-manager/rule-management-modal";
import {FolderSuggest} from "./settings/suggesters/folder-suggester";
import {log} from "./utils/log-utils";

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

	// Developer options
	debugMode: boolean;
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
			.setName('Notification Settings')
			.setDesc('Show a notification when a file is create')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCreateFileNotification)
				.onChange(async (value) => {
					this.plugin.settings.showCreateFileNotification = value;
					await this.plugin.saveSettings();
				}));

		// 文件夹选择器
		new Setting(containerEl)
			.setName('Default Path')
			.setDesc('Set the default folder where new MD files will be created.')
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
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
			.setName('Template folder')
			.setDesc('Set the folder for template files')
			.addSearch(cb => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder("Example: Templates")
					.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value;
						await this.plugin.saveSettings();
						log.debug(`Template folder set to: ${value}`);
					});
			});

		new Setting(containerEl)
			.setName('Enable Templates')
			.setDesc('Use template feature when creating files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useTemplates)
				.onChange(async (value) => {
					this.plugin.settings.useTemplates = value;
					await this.plugin.saveSettings();
					log.debug(`Template feature ${value ? 'enabled' : 'disabled'}`);
				}));

		// 别名控制
		new Setting(containerEl)
			.setName('Add aliases to frontmatter')
			.setDesc('When enabled, aliases from links will be added to frontmatter. Disable this if it conflicts with Templater.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.addAliasesToFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.addAliasesToFrontmatter = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', {text: 'Rules Management'});

		new Setting(containerEl)
			.setName('Enable Rules')
			.setDesc('Automatically apply different target folders and templates based on filename patterns')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useRules)
				.onChange(async (value) => {
					this.plugin.settings.useRules = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Manage Rules')
			.setDesc('Add, edit and delete file creation rules')
			.addButton(button => button
				.setButtonText('Manage Rules')
				.setCta()
				.onClick(() => {
					const modal = new RuleManagementModal(this.app, this.plugin);
					modal.open();
				}));

		// 样式提示
		if (this.plugin.settings.rules && this.plugin.settings.rules.length > 0) {
			const rulesInfo = containerEl.createDiv({cls: 'rules-info'});
			rulesInfo.createEl('p', {
				text: `${this.plugin.settings.rules.length} rules configured`,
				cls: 'rules-count'
			});

			// 显示前3条规则摘要
			const previewCount = Math.min(this.plugin.settings.rules.length, 3);
			const rulesList = rulesInfo.createEl('ul', {cls: 'rules-preview'});

			for (let i = 0; i < previewCount; i++) {
				const rule = this.plugin.settings.rules[i];
				const ruleItem = rulesList.createEl('li');
				ruleItem.innerHTML = `<strong>${rule.name}</strong>: ${this.getRuleMatchDescription(rule)}`;
			}

			if (this.plugin.settings.rules.length > 3) {
				rulesInfo.createEl('p', {
					text: `... and ${this.plugin.settings.rules.length - 3} more rules`,
					cls: 'rules-more'
				});
			}
		}

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

	private getRuleMatchDescription(rule: FileCreationRule): string {
		if (!rule.conditions || rule.conditions.length === 0) {
			return "No matching conditions  → Target folder: " + (rule.targetFolder || '(Default)') +
				", Template: " + (rule.templatePath || '(None)') +
				(rule.enabled ? '' : ' [Disabled]');
		}

		// 只展示前两个条件，如果有更多则添加省略号
		const conditionsToShow = rule.conditions.slice(0, 2);
		const remainingCount = Math.max(0, rule.conditions.length - 2);

		const conditionDescriptions = conditionsToShow.map(cond => {
			let operatorDesc = "";
			let typeDesc = "";

			switch (cond.operator) {
				case "and":
					operatorDesc = "and";
					break;
				case "or":
					operatorDesc = "or";
					break;
				case "not":
					operatorDesc = "not";
					break;
				case "exclude":
					operatorDesc = "exclude";
					break;
			}

			switch (cond.type) {
				case "contains":
					typeDesc = "contains";
					break;
				case "startsWith":
					typeDesc = "begins with";
					break;
				case "endsWith":
					typeDesc = "ends with";
					break;
				case "exact":
					typeDesc = "matches";
					break;
				case "regex":
					typeDesc = "regex";
					break;
			}

			return `${operatorDesc}${typeDesc}"${cond.pattern}"`;
		});

		let description = conditionDescriptions.join("; ");

		if (remainingCount > 0) {
			description += `; ...plus ${remainingCount} more conditions`;
		}

		return description +
			" → Target folder: " + (rule.targetFolder || '(Default)') +
			", Template: " + (rule.templatePath || '(None)') +
			(rule.enabled ? '' : ' [Disabled]');
	}

}
