/**
 * RuleModule — 文件创建规则引擎
 *
 * 负责注册规则管理命令，以及规则相关的设置项渲染。
 */

import { Setting } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { RuleManagementModal } from '../../ui-manager/rule-management-modal';
import { t } from '../../i18n/locale';
import { ruleModuleI18n } from '../../i18n/modules/rule/module';
import { ruleCommandsI18n } from '../../i18n/modules/rule/commands';
import { ruleSettingsI18n } from '../../i18n/modules/rule/settings';
import { log } from '../../utils/log-utils';

export class RuleModule implements PluginModule {
	readonly id = 'rule';
	readonly name = t(ruleModuleI18n).name;
	readonly description = t(ruleModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		this.registerCommands();
		log.debug('[RuleModule] loaded');
	}

	onunload(): void {}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(ruleSettingsI18n);
		const { settings } = this.plugin;

		new Setting(containerEl)
			.setName(i18n.enableRules.name)
			.setDesc(i18n.enableRules.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.useRules)
					.onChange(async (value) => {
						settings.useRules = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.manageRules.name)
			.setDesc(i18n.summary(settings.rules?.length ?? 0))
			.addButton((btn) =>
				btn
					.setButtonText(i18n.manageRules.button)
					.onClick(() => {
						new RuleManagementModal(this.plugin.app, this.plugin).open();
					})
			);
	}

	// ─────────────────────────────────────────────────────────────────────────

	private registerCommands(): void {
		const i18n = t(ruleCommandsI18n);

		this.plugin.addCommand({
			id: 'open-create-missing-links-rule-management',
			name: i18n.openManagement.name,
			callback: () => {
				new RuleManagementModal(this.plugin.app, this.plugin).open();
			},
		});
	}
}
