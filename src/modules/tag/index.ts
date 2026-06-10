/**
 * TagModule — 自动标签
 *
 * 负责自动标签设置项渲染，实际标签分析由 FileOperations 处理。
 */

import { Setting } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { t } from '../../i18n/locale';
import { tagModuleI18n } from '../../i18n/modules/tag/module';
import { tagSettingsI18n } from '../../i18n/modules/tag/settings';
import { log } from '../../utils/log-utils';

export class TagModule implements PluginModule {
	readonly id = 'tag';
	readonly name = t(tagModuleI18n).name;
	readonly description = t(tagModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		log.debug('[TagModule] loaded');
	}

	onunload(): void {}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(tagSettingsI18n);
		const { settings } = this.plugin;

		new Setting(containerEl)
			.setName(i18n.enable.name)
			.setDesc(i18n.enable.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.autoTagging)
					.onChange(async (value) => {
						settings.autoTagging = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.minConfidence.name)
			.setDesc(i18n.minConfidence.desc)
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(settings.autoTaggingMinConfidence)
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings.autoTaggingMinConfidence = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
