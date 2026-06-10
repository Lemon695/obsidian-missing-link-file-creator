/**
 * IgnoreModule — 忽略列表管理
 *
 * 在设置面板展示当前忽略列表数量，引导用户通过侧边栏面板管理。
 * 实际数据由 plugin.ignoreListManager 管理。
 */

import { Setting } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { t } from '../../i18n/locale';
import { ignoreModuleI18n } from '../../i18n/modules/ignore/module';
import { ignoreSettingsI18n } from '../../i18n/modules/ignore/settings';
import { IgnoreListModal } from '../../ui-manager/ignore-list-modal';
import { log } from '../../utils/log-utils';

export class IgnoreModule implements PluginModule {
	readonly id = 'ignore';
	readonly name = t(ignoreModuleI18n).name;
	readonly description = t(ignoreModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		log.debug('[IgnoreModule] loaded');
	}

	onunload(): void {}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(ignoreSettingsI18n);
		const count = this.plugin.ignoreListManager?.getIgnoreList().length ?? 0;

		new Setting(containerEl)
			.setName(i18n.listCount(count))
			.setDesc(i18n.managedViaSidebar)
			.addButton((btn) =>
				btn
					.setButtonText(i18n.manage)
					.onClick(() => {
						new IgnoreListModal(this.plugin.app, this.plugin).open();
					})
			);
	}
}
