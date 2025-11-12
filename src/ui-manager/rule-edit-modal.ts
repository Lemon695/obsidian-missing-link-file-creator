import {App, Modal, Setting, Notice, ButtonComponent} from 'obsidian';
import {FileCreationRule, TemplateAliasHandling} from "../model/rule-types";
import {ConditionMatchType, ConditionOperator, MatchCondition} from "../model/condition-types";
import CheckAndCreateMDFilePlugin from "../main";
import {FolderSuggest} from "../settings/suggesters/folder-suggester";
import {FileSuggest, FileSuggestMode} from "../settings/suggesters/file-suggester";
import GenericInputPrompt from "./generic-input-prompt";
import {ConditionEditor} from "./condition-editor";
import {TemplateSelectionModal} from "./template-selection-modal";
import {CustomModal} from "./custom-modal";
import {log} from "../utils/log-utils";
import {RuleManagementModal} from './rule-management-modal';
import {CreateFileSettingTab} from "../settings/settings";
import {t} from "../i18n/locale";

export class RuleEditModal extends CustomModal {
	private rule: FileCreationRule;
	private onSave: (rule: FileCreationRule) => void;
	private plugin: CheckAndCreateMDFilePlugin;
	private didSubmit = false;
	private conditionsContainer: HTMLElement;
	private conditionEditors: ConditionEditor[] = [];

	constructor(
		app: App,
		rule: FileCreationRule,
		onSave: (rule: FileCreationRule) => void,
		plugin: CheckAndCreateMDFilePlugin
	) {
		super(app);
		if (!rule.conditions) {
			rule.conditions = [];
		}

		this.rule = {...rule}; // 创建副本，防止直接修改原对象
		this.onSave = onSave;
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('ccmd-rule-edit-modal', 'ccmd-quickAddModal');

		// 两列布局
		const mainContainer = contentEl.createDiv({cls: 'ccmd-rule-edit-container '});

		// 左侧面板：基本信息和条件
		const leftPanelScroll = mainContainer.createDiv({cls: 'ccmd-rule-edit-left-panel-scroll'});
		const leftPanel = leftPanelScroll.createDiv({cls: 'ccmd-rule-edit-left-panel'});

		// 右侧面板：目标设置
		const rightPanel = mainContainer.createDiv({cls: 'ccmd-rule-edit-right-panel'});

		// === 左侧面板内容 ===
		// 标题和开关部分
		const headerSection = leftPanel.createDiv({cls: 'ccmd-rule-header-section'});

		// 标题（可点击编辑）
		const titleEl = headerSection.createEl('h2', {
			text: this.rule.id ? this.rule.name : t('createRule'),
			cls: 'ccmd-rule-edit-title'
		});

		titleEl.addEventListener("click", async () => {
			try {
				const newName = await GenericInputPrompt.Prompt(
					this.app,
					t('ruleNamePrompt'),
					t('enterRuleName'),
					this.rule.name
				);
				if (newName && newName !== this.rule.name) {
					this.rule.name = newName;
					titleEl.setText(newName);
				}
			} catch (e) {
				log.debug(`No new name provided`);
			}
		});

		const enableToggle = new Setting(headerSection)
			.setName(t('enable'))
			.setDesc(t('enableDisableRule'))
			.setClass('ccmd-rule-enable-toggle')
			.addToggle(toggle => {
				toggle
					.setValue(this.rule.enabled)
					.onChange(value => {
						this.rule.enabled = value;
					});
			});

		const conditionsSection = leftPanel.createDiv({cls: 'ccmd-rule-section'});
		conditionsSection.createEl('h3', {text: t('matching'), cls: 'ccmd-rule-section-title'});

		this.conditionsContainer = conditionsSection.createDiv({cls: 'ccmd-conditions-container'});
		this.renderConditions();

		const addConditionBtn = new ButtonComponent(conditionsSection);
		addConditionBtn
			.setButtonText(t('addCondition'))
			.setClass('ccmd-rule-add-condition-button')
			.setIcon("plus-circle")
			.onClick(() => {
				this.addNewCondition();
			});

		// === 右侧面板内容 ===
		const targetSection = rightPanel.createDiv({cls: 'ccmd-rule-section'});
		targetSection.createEl('h3', {text: t('targetSettings'), cls: 'ccmd-rule-section-title'});

		// 目标文件夹，使用文件夹建议器
		new Setting(targetSection)
			.setName(t('targetFolder'))
			.setDesc(t('targetFolderDesc'))
			.addSearch(cb => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder(t('exampleFolder'))
					.setValue(this.rule.targetFolder)
					.onChange(value => {
						this.rule.targetFolder = value;
					});
			});

		const templateSetting = new Setting(targetSection)
			.setName(t('useTemplate'))
			.setDesc(t('useTemplateDesc'))
			.addSearch(cb => {
				if (this.plugin.settings.templateFolder) {
					new FileSuggest(
						cb.inputEl,
						this.plugin,
						FileSuggestMode.TemplateFiles
					);
				}
				cb.setPlaceholder(t('selectTemplate'))
					.setValue(this.rule.templatePath)
					.onChange(value => {
						this.rule.templatePath = value;
					});
			});

		templateSetting.addButton(button => {
			button.setIcon("search")
				.setTooltip(t('browseTemplates'))
				.onClick(() => {
					this.browseTemplates();
				});
		});

		// 只在选择了模板时显示别名处理选项
		new Setting(targetSection)
			.setName(t('templateAliasHandling'))
			.setDesc(t('templateAliasHandlingDesc'))
			.addDropdown(dropdown => {
				dropdown.selectEl.addClass('ccmd-wider-dropdown');
				dropdown
					.addOption(TemplateAliasHandling.SKIP, t('skipTemplaterHandlesAliases'))
					.addOption(TemplateAliasHandling.MERGE, t('mergeWithTemplate'))
					.setValue(this.rule.templateAliasHandling || TemplateAliasHandling.SKIP)
					.onChange(value => {
						this.rule.templateAliasHandling = value as TemplateAliasHandling;
					});
			});

		const buttonContainer = contentEl.createDiv({cls: 'ccmd-rule-edit-buttons'});

		const cancelButton = new ButtonComponent(buttonContainer);
		cancelButton
			.setButtonText(t('cancel'))
			.setClass('ccmd-rule-cancel-button')
			.onClick(() => {
				this.close();
			});

		const saveButton = new ButtonComponent(buttonContainer);
		saveButton
			.setButtonText(t('save'))
			.setClass('ccmd-rule-save-button')
			.setCta()
			.onClick(() => {
				this.saveRule();
			});
	}

	private renderConditions() {
		this.conditionEditors.forEach(editor => {
			editor.destroy();
		});
		this.conditionEditors = [];

		this.conditionsContainer.empty();

		if (this.rule.conditions.length === 0) {
			const emptyMessage = this.conditionsContainer.createEl('div', {
				text: t('clickAddCondition'), //点击"添加条件"创建第一个匹配条件
				cls: 'ccmd-empty-conditions-message'
			});
			return;
		}

		this.rule.conditions.forEach((condition, index) => {
			const editor = new ConditionEditor(
				this.app,
				this.conditionsContainer,
				condition,
				(updatedCondition) => {
					this.rule.conditions[index] = updatedCondition;
				},
				() => {
					// 删除条件
					this.rule.conditions.splice(index, 1);
					this.renderConditions();
				}
			);

			this.conditionEditors.push(editor);
		});
	}

	private addNewCondition() {
		const newCondition: MatchCondition = {
			id: `cond-${Date.now()}`,
			type: ConditionMatchType.CONTAINS,
			pattern: '',
			operator: ConditionOperator.AND
		};

		this.rule.conditions.push(newCondition);
		this.renderConditions();
	}

	private browseTemplates() {
		const templates = this.plugin.templaterService.getAvailableTemplates();

		if (templates.length === 0) {
			new Notice(t('noTemplatesFound'));
			return;
		}

		const modal = new TemplateSelectionModal(
			this.app,
			templates,
			(templatePath) => {
				this.rule.templatePath = templatePath;

				const templateInputs = this.contentEl.querySelectorAll('.setting-item-control input');
				templateInputs.forEach(input => {
					const settingItem = input.closest('.setting-item');
					if (settingItem && settingItem.querySelector('.setting-item-name')?.textContent?.includes('Use Template')) {
						(input as HTMLInputElement).value = templatePath;
					}
				});
			}
		);

		modal.open();
	}

	// 重新加载对话框内容
	reload() {
		this.onOpen();
	}

	private saveRule() {
		if (!this.rule.name.trim()) {
			new Notice(t('ruleNameCannotBeEmpty'));
			return;
		}

		if (this.rule.conditions.length === 0) {
			new Notice(t('atLeastOneConditionRequired'));
			return;
		}

		for (const condition of this.rule.conditions) {
			if (!condition.pattern.trim()) {
				new Notice(t('matchPatternCannotBeEmpty'));
				return;
			}

			// 验证正则
			if (condition.type === ConditionMatchType.REGEX) {
				try {
					new RegExp(condition.pattern);
				} catch (e) {
					new Notice(t('invalidRegularExpression'));
					return;
				}
			}
		}

		this.didSubmit = true;

		// 调用保存回调
		this.onSave(this.rule);

		// 关闭对话框
		this.close();

		// 显示通知
		new Notice(t('ruleSaved', {name: this.rule.name}));

		if (RuleManagementModal.currentInstance) {
			RuleManagementModal.currentInstance.refreshRulesList();
		}

		if (CreateFileSettingTab.currentInstance) {
			CreateFileSettingTab.currentInstance.refreshRulesSummary();
		}
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();

		if (!this.didSubmit) {
			log.debug(t('ruleEditingCancelled'));
		}
	}
}
