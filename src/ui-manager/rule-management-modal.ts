import {App, ButtonComponent, Modal, Notice, Setting} from 'obsidian';
import {FileCreationRule} from "../model/rule-types";
import {ConditionMatchType, ConditionOperator} from "../model/condition-types";
import CheckAndCreateMDFilePlugin from "../main";
import {RuleEditModal} from "./rule-edit-modal";
import {CustomModal} from "./custom-modal";
import {t} from "../i18n/locale";

export class RuleManagementModal extends CustomModal {
	private plugin: CheckAndCreateMDFilePlugin;
	private rulesContainer: HTMLElement;
	public static currentInstance: RuleManagementModal | null = null;


	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app);
		this.plugin = plugin;
		RuleManagementModal.currentInstance = this;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('ccmd-rule-management-modal', 'ccmd-quickAddModal');

		contentEl.createEl('h2', {
			text: t('fileCreationRulesManagement'),
			cls: 'ccmd-rule-management-title'
		});

		contentEl.createEl('p', {
			text: t('rulesManagementDescription'),
			cls: 'ccmd-rule-management-description ccmd-setting-item-description'
		});

		this.rulesContainer = contentEl.createDiv({cls: 'ccmd-rules-list-container'});

		this.refreshRulesList();

		const buttonContainer = contentEl.createDiv({cls: 'ccmd-rule-management-buttons'});

		const addRuleButton = new ButtonComponent(buttonContainer);
		addRuleButton
			.setButtonText(t('addRule'))
			.setCta()
			.onClick(() => {
				this.createNewRule();
			});

		const closeButton = new ButtonComponent(buttonContainer);
		closeButton
			.setButtonText(t('close'))
			.onClick(() => {
				this.close();
			});
	}

	private createNewRule() {
		const newRule: FileCreationRule = {
			id: `rule-${Date.now()}`,
			name: t('createRule'),
			enabled: true,
			conditions: [{
				id: `cond-${Date.now()}`,
				type: ConditionMatchType.CONTAINS,
				pattern: '',
				operator: ConditionOperator.AND
			}],
			targetFolder: '',
			templatePath: '',
			priority: this.plugin.settings.rules?.length || 0
		};

		const modal = new RuleEditModal(
			this.app,
			newRule,
			(updatedRule) => {
				if (!this.plugin.settings.rules) {
					this.plugin.settings.rules = [];
				}
				this.plugin.settings.rules.push(updatedRule);
				this.plugin.saveSettings();
				this.refreshRulesList();
			},
			this.plugin
		);

		modal.open();
	}

	// 刷新规则列表
	public refreshRulesList() {
		this.rulesContainer.empty();

		if (!this.plugin.settings.rules || this.plugin.settings.rules.length === 0) {
			const emptyState = this.rulesContainer.createDiv({cls: 'ccmd-rules-empty-state'});

			const emptyIcon = emptyState.createDiv({cls: 'ccmd-rules-empty-icon'});
			emptyIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><line x1="9" y1="9" x2="10" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>`;

			const emptyText = emptyState.createDiv({cls: 'ccmd-rules-empty-text'});
			emptyText.createEl('h3', {text: t('noRulesCreatedYet')});
			emptyText.createEl('p', {text: t('rulesAutomateDescription')});

			const createFirstButton = new ButtonComponent(emptyState);
			createFirstButton
				.setButtonText(t('createFirstRule'))
				.setCta()
				.setClass('ccmd-create-first-rule-button')
				.onClick(() => {
					this.createNewRule();
				});

			return;
		}

		// 获取并排序规则
		const rules = [...this.plugin.settings.rules].sort((a, b) => a.priority - b.priority);

		// 规则表格
		const rulesTable = this.rulesContainer.createEl('table', {cls: 'ccmd-rules-table'});

		// 表头
		const tableHead = rulesTable.createEl('thead');
		const headerRow = tableHead.createEl('tr');

		// 表头列
		headerRow.createEl('th', {cls: 'ccmd-rule-status-column', text: ''});
		headerRow.createEl('th', {cls: 'ccmd-rule-name-column', text: t('ruleName')});
		headerRow.createEl('th', {cls: 'ccmd-rule-conditions-column', text: t('matchConditions')});
		headerRow.createEl('th', {cls: 'ccmd-rule-target-column', text: t('targetFolder')});
		headerRow.createEl('th', {cls: 'ccmd-rule-template-column', text: t('useTemplate')});
		headerRow.createEl('th', {cls: 'ccmd-rule-actions-column', text: t('actions')});

		// 表体
		const tableBody = rulesTable.createEl('tbody');

		rules.forEach((rule, index) => {
			const ruleRow = tableBody.createEl('tr', {cls: 'rule-row'});
			if (!rule.enabled) {
				ruleRow.addClass('ccmd-rule-disabled');
			}

			const statusCell = ruleRow.createEl('td', {cls: 'rule-status-cell'});
			new Setting(statusCell)
				.setClass('ccmd-rule-toggle-setting')
				.addToggle(toggle => {
					toggle
						.setTooltip(rule.enabled ? t('enabled') : t('disabled'))
						.setValue(rule.enabled)
						.onChange(async value => {
							rule.enabled = value;
							setTimeout(async () => {
								await this.plugin.saveSettings();
								this.refreshRulesList();
							}, 150);
						});
				});

			// 名称列
			const nameCell = ruleRow.createEl('td', {cls: 'ccmd-rule-name-cell'});
			nameCell.createEl('div', {
				text: rule.name,
				cls: 'ccmd-rule-name'
			});

			// 条件列
			const conditionsCell = ruleRow.createEl('td', {cls: 'rule-conditions-cell'});
			conditionsCell.createEl('div', {
				text: this.getConditionsDescription(rule),
				cls: 'ccmd-rule-conditions-text'
			});

			// 目标文件夹列
			const targetCell = ruleRow.createEl('td', {cls: 'rule-target-cell'});
			targetCell.createEl('div', {
				text: rule.targetFolder || '(Default)',
				cls: 'ccmd-rule-target-text'
			});

			// 模板列
			const templateCell = ruleRow.createEl('td', {cls: 'rule-template-cell'});
			templateCell.createEl('div', {
				text: rule.templatePath || '(无)',
				cls: 'ccmd-rule-template-text'
			});

			// 操作列
			const actionsCell = ruleRow.createEl('td', {cls: 'rule-actions-cell'});
			const actionsContainer = actionsCell.createDiv({cls: 'ccmd-rule-actions-container'});

			// 编辑按钮
			const editButton = new ButtonComponent(actionsContainer);
			editButton
				.setTooltip(t('editRule'))
				.setIcon('pencil')
				.setClass('ccmd-rule-action-button')
				.onClick(() => {
					this.editRule(rule);
				});

			// 优先级按钮
			if (index > 0) {
				const moveUpButton = new ButtonComponent(actionsContainer);
				moveUpButton
					.setTooltip(t('moveUp')) //提高优先级
					.setIcon('arrow-up')
					.setClass('ccmd-rule-action-button')
					.onClick(async () => {
						await this.moveRuleUp(index);
					});
			}

			if (index < rules.length - 1) {
				const moveDownButton = new ButtonComponent(actionsContainer);
				moveDownButton
					.setTooltip(t('moveDown')) //降低优先级
					.setIcon('arrow-down')
					.setClass('ccmd-rule-action-button')
					.onClick(async () => {
						await this.moveRuleDown(index);
					});
			}

			const deleteButton = new ButtonComponent(actionsContainer);
			deleteButton
				.setTooltip(t('deleteRule')) //删除规则
				.setIcon('trash')
				.setClass('ccmd-rule-action-button')
				.onClick(async () => {
					if (await this.confirmDelete(rule.name)) {
						this.deleteRule(rule.id);
					}
				});
			deleteButton.buttonEl.addClass('ccmd-rule-delete-button');
		});
	}

	private getConditionsDescription(rule: FileCreationRule): string {
		if (!rule.conditions || rule.conditions.length === 0) {
			return t('noMatchConditions'); //无匹配条件
		}

		return rule.conditions.map(cond => {
			let typeDesc = "";
			let operatorDesc = "";

			switch (cond.operator) {
				case ConditionOperator.AND:
					operatorDesc = t('and');
					break;
				case ConditionOperator.OR:
					operatorDesc = t('or');
					break;
				case ConditionOperator.NOT:
					operatorDesc = t('not');
					break;
				case ConditionOperator.EXCLUDE:
					operatorDesc = t('exclude');
					break;
			}

			switch (cond.type) {
				case ConditionMatchType.CONTAINS:
					typeDesc = t('contains');
					break;
				case ConditionMatchType.STARTS_WITH:
					typeDesc = t('beginsWith'); //以...开头
					break;
				case ConditionMatchType.ENDS_WITH:
					typeDesc = t('endsWith'); //以...结尾
					break;
				case ConditionMatchType.EXACT:
					typeDesc = t('matches'); //精确匹配
					break;
				case ConditionMatchType.REGEX:
					typeDesc = t('regex'); //正则匹配
					break;
			}

			return `${operatorDesc} ${typeDesc} "${cond.pattern}"`;
		}).join("; ");
	}

	// 编辑规则
	private editRule(rule: FileCreationRule) {
		const modal = new RuleEditModal(
			this.app,
			{...rule}, // 创建副本
			async (updatedRule) => {
				// 更新规则
				const ruleIndex = this.plugin.settings.rules.findIndex(r => r.id === rule.id);
				if (ruleIndex !== -1) {
					this.plugin.settings.rules[ruleIndex] = updatedRule;
					await this.plugin.saveSettings();
					this.refreshRulesList();
				}
			},
			this.plugin
		);

		modal.open();
	}

	// 删除规则
	private async deleteRule(ruleId: string) {
		this.plugin.settings.rules = this.plugin.settings.rules.filter(r => r.id !== ruleId);

		// 更新剩余规则的优先级
		this.plugin.settings.rules.forEach((r, i) => {
			r.priority = i;
		});

		await this.plugin.saveSettings();
		this.refreshRulesList();

		new Notice(t('ruleDeleted'));
	}

	// 确认删除
	private async confirmDelete(ruleName: string): Promise<boolean> {
		return new Promise(resolve => {
			const modal = new ConfirmDeleteModal(this.app, ruleName, (confirmed) => {
				resolve(confirmed);
			});
			modal.open();
		});
	}

	// 上移规则
	private async moveRuleUp(index: number) {
		if (index <= 0) return;

		// 交换当前规则和上一个规则的优先级
		const currentRule = this.plugin.settings.rules[index];
		const previousRule = this.plugin.settings.rules[index - 1];

		currentRule.priority--;
		previousRule.priority++;

		// 重新排序规则数组
		this.plugin.settings.rules.sort((a, b) => a.priority - b.priority);

		await this.plugin.saveSettings();
		this.refreshRulesList();
	}

	// 下移规则
	private async moveRuleDown(index: number) {
		if (index >= this.plugin.settings.rules.length - 1) return;

		// 交换当前规则和下一个规则的优先级
		const currentRule = this.plugin.settings.rules[index];
		const nextRule = this.plugin.settings.rules[index + 1];

		currentRule.priority++;
		nextRule.priority--;

		// 重新排序规则数组
		this.plugin.settings.rules.sort((a, b) => a.priority - b.priority);

		await this.plugin.saveSettings();
		this.refreshRulesList();
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();

		RuleManagementModal.currentInstance = null;
	}
}

class ConfirmDeleteModal extends Modal {
	private onConfirm: (confirmed: boolean) => void;
	private ruleName: string;

	constructor(app: App, ruleName: string, onConfirm: (confirmed: boolean) => void) {
		super(app);
		this.ruleName = ruleName;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('ccmd-confirm-delete-modal', 'ccmd-quickAddModal');

		contentEl.createEl('h2', {text: t('confirmDeletion')});
		contentEl.createEl('p', {text: t('confirmDeleteRule', {name: this.ruleName})});

		const buttonContainer = contentEl.createDiv({cls: 'ccmd-confirm-buttons'});

		const cancelButton = new ButtonComponent(buttonContainer);
		cancelButton
			.setButtonText(t('cancel'))
			.onClick(() => {
				this.onConfirm(false);
				this.close();
			});

		const confirmButton = new ButtonComponent(buttonContainer);
		confirmButton
			.setButtonText(t('delete'))
			.setWarning()
			.onClick(() => {
				this.onConfirm(true);
				this.close();
			});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
