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
			text: this.rule.id ? this.rule.name : 'Create Rule',
			cls: 'ccmd-rule-edit-title'
		});

		titleEl.addEventListener("click", async () => {
			try {
				const newName = await GenericInputPrompt.Prompt(
					this.app,
					"Rule Name",
					"Enter rule name",
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
			.setName('Enable')
			.setDesc('Enable or disable this rule')
			.setClass('ccmd-rule-enable-toggle')
			.addToggle(toggle => {
				toggle
					.setValue(this.rule.enabled)
					.onChange(value => {
						this.rule.enabled = value;
					});
			});

		const conditionsSection = leftPanel.createDiv({cls: 'ccmd-rule-section'});
		conditionsSection.createEl('h3', {text: 'Matching', cls: 'ccmd-rule-section-title'});

		this.conditionsContainer = conditionsSection.createDiv({cls: 'ccmd-conditions-container'});
		this.renderConditions();

		const addConditionBtn = new ButtonComponent(conditionsSection);
		addConditionBtn
			.setButtonText("Add Condition")
			.setClass('ccmd-rule-add-condition-button')
			.setIcon("plus-circle")
			.onClick(() => {
				this.addNewCondition();
			});

		// === 右侧面板内容 ===
		const targetSection = rightPanel.createDiv({cls: 'ccmd-rule-section'});
		targetSection.createEl('h3', {text: 'Target Settings', cls: 'ccmd-rule-section-title'});

		// 目标文件夹，使用文件夹建议器
		new Setting(targetSection)
			.setName('Target Folder')
			.setDesc('Matched files will be created in this folder')
			.addSearch(cb => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.rule.targetFolder)
					.onChange(value => {
						this.rule.targetFolder = value;
					});
			});

		const templateSetting = new Setting(targetSection)
			.setName('Use Template')
			.setDesc('Template used when creating files')
			.addSearch(cb => {
				if (this.plugin.settings.templateFolder) {
					new FileSuggest(
						cb.inputEl,
						this.plugin,
						FileSuggestMode.TemplateFiles
					);
				}
				cb.setPlaceholder("Select Template")
					.setValue(this.rule.templatePath)
					.onChange(value => {
						const oldValue = this.rule.templatePath;
						this.rule.templatePath = value;

						// 只有当值变化显著时才重新加载 (比如从无到有，或者完全变成空)
						if ((oldValue === "" && value !== "") ||
							(oldValue !== "" && value === "")) {
							this.reload();
						}
					});
			});

		templateSetting.addButton(button => {
			button.setIcon("search")
				.setTooltip("Browse Templates")
				.onClick(() => {
					this.browseTemplates();
				});
		});

		// 只在选择了模板时显示别名处理选项
		if (this.rule.templatePath) {
			new Setting(targetSection)
				.setName('Template Alias Handling')
				.setDesc('Control how aliases are handled when using Templater')
				.addDropdown(dropdown => {
					dropdown.selectEl.addClass('ccmd-wider-dropdown');
					dropdown
						.addOption(TemplateAliasHandling.SKIP, "Skip (Templater handles aliases)")
						.addOption(TemplateAliasHandling.MERGE, "Merge with template")
						.setValue(this.rule.templateAliasHandling || TemplateAliasHandling.SKIP)
						.onChange(value => {
							this.rule.templateAliasHandling = value as TemplateAliasHandling;
						});
				});
		}

		const buttonContainer = contentEl.createDiv({cls: 'ccmd-rule-edit-buttons'});

		const cancelButton = new ButtonComponent(buttonContainer);
		cancelButton
			.setButtonText('Cancel')
			.setClass('ccmd-rule-cancel-button')
			.onClick(() => {
				this.close();
			});

		const saveButton = new ButtonComponent(buttonContainer);
		saveButton
			.setButtonText('Save')
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
				text: 'Click "Add Condition" to create your first matching rule', //点击"添加条件"创建第一个匹配条件
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
			new Notice('No templates found, please check template folder settings');
			return;
		}

		const modal = new TemplateSelectionModal(
			this.app,
			templates,
			(templatePath) => {
				this.rule.templatePath = templatePath;
				this.reload();
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
			new Notice('Rule name cannot be empty');
			return;
		}

		if (this.rule.conditions.length === 0) {
			new Notice('At least one match condition must be added');
			return;
		}

		for (const condition of this.rule.conditions) {
			if (!condition.pattern.trim()) {
				new Notice('Match pattern cannot be empty');
				return;
			}

			// 验证正则
			if (condition.type === ConditionMatchType.REGEX) {
				try {
					new RegExp(condition.pattern);
				} catch (e) {
					new Notice('Invalid regular expression');
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
		new Notice(`Rule "${this.rule.name}" saved`);
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();

		if (!this.didSubmit) {
			log.debug("Rule editing cancelled");
		}
	}
}
