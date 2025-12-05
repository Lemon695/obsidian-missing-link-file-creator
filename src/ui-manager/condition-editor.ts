import {App, ButtonComponent, Setting} from "obsidian";
import {ConditionMatchType, ConditionOperator, MatchCondition} from "@/model/condition-types";
import {FrontmatterValueSuggester} from "@/settings/suggesters/frontmatter-value-suggester";
import {FrontmatterPropertySuggester} from "@/settings/suggesters/frontmatter-property-suggester";

export class ConditionEditor {
	private app: App;
	private container: HTMLElement;
	private condition: MatchCondition;
	private onChange: (condition: MatchCondition) => void;
	private onDelete: () => void;
	private conditionEl: HTMLElement;
	private propertyField: HTMLElement;
	private propertyNameSuggester: FrontmatterPropertySuggester | null = null;
	private valueSuggester: FrontmatterValueSuggester | null = null;

	constructor(
		app: App,
		container: HTMLElement,
		condition: MatchCondition,
		onChange: (condition: MatchCondition) => void,
		onDelete: () => void
	) {
		this.app = app;
		this.container = container;
		this.condition = condition;
		this.onChange = onChange;
		this.onDelete = onDelete;
		this.render();
	}

	render() {
		this.conditionEl = this.container.createDiv({cls: 'ccmd-condition-item'});
		this.conditionEl.style.marginBottom = "20px";
		this.conditionEl.style.padding = "15px";
		this.conditionEl.style.borderRadius = "6px";

		const conditionHeader = this.conditionEl.createDiv({cls: 'ccmd-condition-header'});
		conditionHeader.style.display = "flex";
		conditionHeader.style.justifyContent = "space-between";
		conditionHeader.style.alignItems = "center";
		conditionHeader.style.marginBottom = "15px";

		const headerTitle = conditionHeader.createEl('h4', {
			text: "Condition settings",
			cls: 'ccmd-condition-title'
		});
		headerTitle.style.margin = "0";

		const controlsContainer = conditionHeader.createDiv({cls: 'condition-controls'});
		controlsContainer.style.display = "flex";
		controlsContainer.style.alignItems = "center";
		controlsContainer.style.gap = "10px";

		const operatorSettingContainer = controlsContainer.createDiv({cls: 'ccmd-operator-setting-container'});
		const operatorSetting = new Setting(operatorSettingContainer)
			.setName("Condition type")
			.setClass('ccmd-condition-operator-setting')
			.addDropdown(dropdown => {
				dropdown.selectEl.addClass('ccmd-wider-dropdown');
				dropdown
					.addOption(ConditionOperator.AND, "AND")
					.addOption(ConditionOperator.OR, "OR")
					.addOption(ConditionOperator.NOT, "NOT")
					.addOption(ConditionOperator.EXCLUDE, "EXCLUDE")
					.setValue(this.condition.operator)
					.onChange(value => {
						this.condition.operator = value as ConditionOperator;
						this.onChange(this.condition);
						this.updateStyles();
					});
			});

		const deleteBtn = new ButtonComponent(controlsContainer);
		deleteBtn
			.setIcon("trash")
			.setTooltip("Delete this condition")
			.setClass('ccmd-condition-delete-button')
			.onClick(() => {
				this.onDelete();
			});

		const conditionContent = this.conditionEl.createDiv({cls: 'ccmd-condition-content'});
		conditionContent.style.display = "flex";
		conditionContent.style.gap = "12px";
		conditionContent.style.alignItems = "center";
		conditionContent.style.width = "100%";

		// 选择匹配属性类型的下拉框（第一列）
		const propertyTypeContainer = conditionContent.createDiv({cls: 'ccmd-property-type-container'});
		propertyTypeContainer.style.flex = "0 0 130px";
		propertyTypeContainer.style.minWidth = "130px";

		const propertyTypeDropdown = new Setting(propertyTypeContainer)
			.setClass('ccmd-property-type-setting')
			.addDropdown(dropdown => {
				dropdown.selectEl.addClass('ccmd-wider-dropdown');
				dropdown
					.addOption('filename', "Filename")
					// .addOption('alias', "Alias") //TODO
					.addOption('frontmatter', "Frontmatter")
					// .addOption('tag', "Tag") //TODO
					.setValue(this.getDropdownValueFromConditionType(this.condition.type))
					.onChange(value => {
						if (value === 'frontmatter') {
							this.condition.type = ConditionMatchType.FRONTMATTER;
							this.updateUILayout(true);
						} else {
							const wasFromFrontmatter = this.condition.type === ConditionMatchType.FRONTMATTER;

							this.condition.type = this.getConditionTypeFromDropdownValue(value);

							if (wasFromFrontmatter) {
								this.updateUILayout(false);
							}
						}
						this.onChange(this.condition);
					});
			});

		const restLayoutContainer = conditionContent.createDiv({cls: 'rest-layout-container'});
		restLayoutContainer.style.display = "flex";
		restLayoutContainer.style.flex = "1";
		restLayoutContainer.style.gap = "12px";
		restLayoutContainer.style.alignItems = "center";
		restLayoutContainer.style.minWidth = "0";

		this.propertyField = this.conditionEl.createDiv({cls: 'property-field-container'});
		this.propertyField.style.display = "none";

		this.updateUILayout(this.condition.type === ConditionMatchType.FRONTMATTER);

		this.updateStyles();
	}

	updateStyles() {
		this.conditionEl.removeClass('ccmd-condition-and', 'ccmd-condition-or', 'ccmd-condition-not', 'ccmd-condition-exclude');

		switch (this.condition.operator) {
			case ConditionOperator.AND:
				this.conditionEl.addClass('ccmd-condition-and');
				break;
			case ConditionOperator.OR:
				this.conditionEl.addClass('ccmd-condition-or');
				break;
			case ConditionOperator.NOT:
				this.conditionEl.addClass('ccmd-condition-not');
				break;
			case ConditionOperator.EXCLUDE:
				this.conditionEl.addClass('ccmd-condition-exclude');
				break;
		}
	}

	// 更新UI
	updateUILayout(isFrontmatter: boolean) {
		const restLayoutContainer = this.conditionEl.querySelector('.rest-layout-container') as HTMLElement;
		if (!restLayoutContainer) return;

		restLayoutContainer.empty();

		if (isFrontmatter) {
			// ===== Frontmatter模式：四列布局 =====
			// 第一列已存在：属性类型选择器;第二列：属性名输入框;第三列：匹配类型下拉框;第四列：属性值输入框

			// 属性名容器（第二列）
			const propertyNameContainer = restLayoutContainer.createDiv({cls: 'property-name-container'});
			propertyNameContainer.style.flex = "0 0 160px";
			propertyNameContainer.style.minWidth = "0";

			// 匹配类型容器（第三列）
			const matchTypeContainer = restLayoutContainer.createDiv({cls: 'ccmd-match-type-container'});
			matchTypeContainer.style.flex = "0 0 130px";
			matchTypeContainer.style.minWidth = "0";

			// 属性值容器（第四列）
			const valueContainer = restLayoutContainer.createDiv({cls: 'value-container'});
			valueContainer.style.flex = "1";
			valueContainer.style.minWidth = "0";

			// 添加属性名输入框
			const propertyInput = new Setting(propertyNameContainer)
				.setClass('ccmd-condition-property-input')
				.addText(text => {
					text
						.setPlaceholder("Property name")
						.setValue(this.condition.property || "")
						.onChange(value => {
							this.condition.property = value;
							this.onChange(this.condition);

							// 属性名更改时，更新值建议器的属性名
							if (this.valueSuggester) {
								this.valueSuggester.updatePropertyName(value);
							}
						});

					this.propertyNameSuggester = new FrontmatterPropertySuggester(
						this.app,
						text.inputEl
					);

					text.inputEl.style.width = "100%";
					text.inputEl.style.height = "36px";
					text.inputEl.style.boxSizing = "border-box";
					return text;
				});

			propertyInput.settingEl.style.padding = "0";
			propertyInput.settingEl.style.border = "none";

			new Setting(matchTypeContainer)
				.setClass('ccmd-condition-match-type')
				.addDropdown(dropdown => {
					dropdown.selectEl.addClass('ccmd-wider-dropdown');
					dropdown
						.addOption(ConditionMatchType.CONTAINS, "contains")
						.addOption(ConditionMatchType.STARTS_WITH, "begins with")
						.addOption(ConditionMatchType.ENDS_WITH, "ends with")
						.addOption(ConditionMatchType.EXACT, "matches")
						.addOption(ConditionMatchType.REGEX, "regex")
						.setValue(this.condition.frontmatterMatchType || ConditionMatchType.EXACT)
						.onChange(value => {
							this.condition.frontmatterMatchType = value as ConditionMatchType;
							this.onChange(this.condition);
						});
				});

			// 属性值输入框
			const valueInput = new Setting(valueContainer)
				.setClass('ccmd-condition-value-input')
				.addText(text => {
					text
						.setPlaceholder("Property value")
						.setValue(this.condition.pattern)
						.onChange(value => {
							this.condition.pattern = value;
							this.onChange(this.condition);
						});

					// 输入框添加自动补全
					this.valueSuggester = new FrontmatterValueSuggester(
						this.app,
						text.inputEl,
						this.condition.property || ""
					);

					text.inputEl.style.width = "100%";
					text.inputEl.style.height = "36px";
					text.inputEl.style.boxSizing = "border-box";
					return text;
				});
			valueInput.settingEl.style.padding = "0";
			valueInput.settingEl.style.border = "none";

		} else {
			// ===== 普通模式：三列布局 =====
			// 第一列已存在：属性类型选择器;第二列：匹配类型下拉;第三列：匹配值输入

			// 创建匹配类型容器（第二列）
			const matchTypeContainer = restLayoutContainer.createDiv({cls: 'ccmd-match-type-container'});
			matchTypeContainer.style.flex = "0 0 130px";
			matchTypeContainer.style.minWidth = "0";

			// 创建模式匹配容器（第三列）
			const patternContainer = restLayoutContainer.createDiv({cls: 'ccmd-pattern-container'});
			patternContainer.style.flex = "1";
			patternContainer.style.minWidth = "0";

			// 添加匹配类型下拉
			new Setting(matchTypeContainer)
				.setClass('ccmd-condition-match-type')
				.addDropdown(dropdown => {
					dropdown.selectEl.addClass('ccmd-wider-dropdown');
					dropdown
						.addOption(ConditionMatchType.CONTAINS, "contains")
						.addOption(ConditionMatchType.STARTS_WITH, "begins with")
						.addOption(ConditionMatchType.ENDS_WITH, "ends with")
						.addOption(ConditionMatchType.EXACT, "matches")
						.addOption(ConditionMatchType.REGEX, "regex")
						.setValue(this.condition.type)
						.onChange(value => {
							this.condition.type = value as ConditionMatchType;
							this.onChange(this.condition);
						});
				});

			// 模式输入
			const patternInput = new Setting(patternContainer)
				.setClass('ccmd-condition-pattern')
				.addText(text => {
					text
						.setPlaceholder("Text to match")
						.setValue(this.condition.pattern)
						.onChange(value => {
							this.condition.pattern = value;
							this.onChange(this.condition);
						});
					text.inputEl.style.width = "100%";
					text.inputEl.style.height = "36px";
					text.inputEl.style.boxSizing = "border-box";
					return text;
				});
			patternInput.settingEl.style.padding = "0";
			patternInput.settingEl.style.border = "none";

			this.valueSuggester = null;
		}
	}

	private getDropdownValueFromConditionType(type: ConditionMatchType): string {
		if (type === ConditionMatchType.FRONTMATTER) {
			return 'frontmatter';
		}

		return 'filename';
	}

	private getConditionTypeFromDropdownValue(value: string): ConditionMatchType {
		if (value === 'frontmatter') {
			return ConditionMatchType.FRONTMATTER;
		}

		if (this.condition.type !== ConditionMatchType.FRONTMATTER) {
			return this.condition.type;
		}

		return ConditionMatchType.CONTAINS;
	}

	destroy() {
		this.propertyNameSuggester = null;
		this.valueSuggester = null;

		if (this.conditionEl) {
			this.conditionEl.remove();
		}
	}

	refreshSuggesters() {
		if (this.propertyNameSuggester) {
			this.propertyNameSuggester.refreshProperties();
		}

		if (this.valueSuggester && this.condition.property) {
			this.valueSuggester.updatePropertyName(this.condition.property);
		}
	}

}
