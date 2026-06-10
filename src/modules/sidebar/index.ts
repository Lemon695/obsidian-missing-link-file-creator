/**
 * SidebarModule — 侧边栏面板
 *
 * 负责注册 ActiveMissingLinksView 视图类型和打开侧边栏命令。
 */

import { WorkspaceLeaf } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { ACTIVE_SIDE_VIEW_TYPE, ActiveMissingLinksView } from '../../views/active-missing-links-view';
import { t } from '../../i18n/locale';
import { sidebarModuleI18n } from '../../i18n/modules/sidebar/module';
import { log } from '../../utils/log-utils';

export class SidebarModule implements PluginModule {
	readonly id = 'sidebar';
	readonly name = t(sidebarModuleI18n).name;
	readonly description = t(sidebarModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		this.plugin.registerView(
			ACTIVE_SIDE_VIEW_TYPE,
			(leaf) => new ActiveMissingLinksView(leaf, this.plugin)
		);
		this.registerCommands();
		log.debug('[SidebarModule] loaded');
	}

	onunload(): void {}

	// ─────────────────────────────────────────────────────────────────────────

	private registerCommands(): void {
		const i18n = t(sidebarModuleI18n);

		this.plugin.addCommand({
			id: 'open-active-missing-links-view',
			name: i18n.openCommand,
			callback: async () => {
				await this.openView();
			},
		});
	}

	private async openView(): Promise<void> {
		const { workspace } = this.plugin.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(ACTIVE_SIDE_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ACTIVE_SIDE_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}
}
