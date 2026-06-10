/**
 * DashboardModule — 批量操作仪表盘
 *
 * 负责注册 MissingLinksDashboardView 视图类型和打开仪表盘命令。
 */

import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { Setting } from 'obsidian';
import { DASHBOARD_VIEW_TYPE, MissingLinksDashboardView } from '../../views/batch-dashboard-view';
import { DashboardModal } from '../../ui-manager/dashboard-modal';
import { t } from '../../i18n/locale';
import { dashboardModuleI18n } from '../../i18n/modules/dashboard/module';
import { log } from '../../utils/log-utils';

export class DashboardModule implements PluginModule {
	readonly id = 'dashboard';
	readonly name = t(dashboardModuleI18n).name;
	readonly description = t(dashboardModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		// 保留 registerView 以兼容旧版工作区状态；实际打开改为 DashboardModal
		this.plugin.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf) => new MissingLinksDashboardView(leaf, this.plugin)
		);
		this.registerCommands();
		log.debug('[DashboardModule] loaded');
	}

	onunload(): void {}

	// ─────────────────────────────────────────────────────────────────────────

	private registerCommands(): void {
		const i18n = t(dashboardModuleI18n);

		this.plugin.addCommand({
			id: 'open-batch-dashboard',
			name: i18n.openCommand,
			callback: () => {
				this.openView();
			},
		});
	}

	private openView(): void {
		new DashboardModal(this.plugin.app, this.plugin).open();
	}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(dashboardModuleI18n);
		new Setting(containerEl)
			.setName(i18n.heightSettingName)
			.setDesc(i18n.heightSettingDesc)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.dashboardHeight || '80vh')
					.onChange(async (value) => {
						this.plugin.settings.dashboardHeight = value.trim() || '80vh';
						await this.plugin.saveSettings();
					})
			);
	}
}
