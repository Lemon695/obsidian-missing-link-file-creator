/**
 * TemplateModule — 模板支持
 *
 * 负责模板相关设置项渲染，实际模板应用由 plugin.templaterService 处理。
 */

import { Setting } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { t } from '../../i18n/locale';
import { templateModuleI18n } from '../../i18n/modules/template/module';
import { templateSettingsI18n } from '../../i18n/modules/template/settings';
import { log } from '../../utils/log-utils';

export class TemplateModule implements PluginModule {
	readonly id = 'template';
	readonly name = t(templateModuleI18n).name;
	readonly description = t(templateModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		log.debug('[TemplateModule] loaded');
	}

	onunload(): void {}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(templateSettingsI18n);
		const { settings } = this.plugin;

		new Setting(containerEl)
			.setName(i18n.enableTemplates.name)
			.setDesc(i18n.enableTemplates.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.useTemplates)
					.onChange(async (value) => {
						settings.useTemplates = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.defaultTemplate.name)
			.setDesc(i18n.defaultTemplate.desc)
			.addText((text) =>
				text
					.setValue(settings.defaultTemplatePath)
					.onChange(async (value) => {
						settings.defaultTemplatePath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.templateFolder.name)
			.setDesc(i18n.templateFolder.desc)
			.addText((text) =>
				text
					.setPlaceholder(i18n.templateFolder.placeholder)
					.setValue(settings.templateFolder)
					.onChange(async (value) => {
						settings.templateFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.templaterMethod.name)
			.setDesc(i18n.templaterMethod.desc)
			.addDropdown((drop) => {
				const opts = i18n.templaterMethod.options;
				drop
					.addOption('execute', opts.execute)
					.addOption('overwrite', opts.overwrite)
					.addOption('basic', opts.basic)
					.setValue(settings.templaterMethod)
					.onChange(async (value: string) => {
						settings.templaterMethod = value as 'execute' | 'overwrite' | 'basic';
						await this.plugin.saveSettings();
					});
			});
	}
}
