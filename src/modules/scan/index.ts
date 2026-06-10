/**
 * ScanModule — 链接扫描与文件创建
 *
 * 负责注册三个扫描命令（当前文件 / 文件夹 / 全库）和右键菜单项。
 * 业务逻辑委托给 plugin.fileOperations，此处只做入口注册。
 * 同时维护增量扫描缓存（ScanCache），并在全库扫描后更新侧边栏 badge。
 */

import { Setting } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { t } from '../../i18n/locale';
import { scanModuleI18n } from '../../i18n/modules/scan/module';
import { scanCommandsI18n } from '../../i18n/modules/scan/commands';
import { scanSettingsI18n } from '../../i18n/modules/scan/settings';
import { log } from '../../utils/log-utils';
import { ScanCache } from '../../service/scan-cache';
import { ACTIVE_SIDE_VIEW_TYPE } from '../../views/active-missing-links-view';

export class ScanModule implements PluginModule {
	readonly id = 'scan';
	readonly name = t(scanModuleI18n).name;
	readonly description = t(scanModuleI18n).description;

	/** 命令执行防重入标志 */
	private isExecuting = false;

	/** 增量扫描缓存 */
	readonly scanCache: ScanCache;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {
		this.scanCache = new ScanCache(plugin.app);
	}

	onload(): void {
		this.scanCache.startListening();
		this.registerCommands();
		this.registerContextMenu();
		log.debug('[ScanModule] loaded');
	}

	onunload(): void {
		this.scanCache.stopListening();
		// 命令和 registerEvent 由 Obsidian 自动清理
	}

	renderSettings(containerEl: HTMLElement): void {
		const i18n = t(scanSettingsI18n);
		const { settings } = this.plugin;

		new Setting(containerEl)
			.setName(i18n.notification.name)
			.setDesc(i18n.notification.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.showCreateFileNotification)
					.onChange(async (value) => {
						settings.showCreateFileNotification = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.defaultFolder.name)
			.setDesc(i18n.defaultFolder.desc)
			.addText((text) =>
				text
					.setPlaceholder(i18n.defaultFolder.placeholder)
					.setValue(settings.defaultFolderPath)
					.onChange(async (value) => {
						settings.defaultFolderPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.addAliases.name)
			.setDesc(i18n.addAliases.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.addAliasesToFrontmatter)
					.onChange(async (value) => {
						settings.addAliasesToFrontmatter = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(i18n.debugMode.name)
			.setDesc(i18n.debugMode.desc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.debugMode)
					.onChange(async (value) => {
						settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 私有方法
	// ─────────────────────────────────────────────────────────────────────────

	private registerCommands(): void {
		const i18n = t(scanCommandsI18n);

		this.plugin.addCommand({
			id: 'create-missing-links-current-file',
			name: i18n.currentFile.name,
			callback: async () => {
				if (this.isExecuting) return;
				this.isExecuting = true;
				try {
					await this.plugin.fileOperations.checkAndCreateMDFiles();
				} finally {
					this.isExecuting = false;
				}
			},
		});

		this.plugin.addCommand({
			id: 'create-missing-links-folder-scan',
			name: i18n.folder.name,
			callback: async () => {
				if (this.isExecuting) return;
				this.isExecuting = true;
				try {
					await this.plugin.fileOperations.checkAndCreateMDFilesInFolder();
				} finally {
					this.isExecuting = false;
				}
			},
		});

		this.plugin.addCommand({
			id: 'create-missing-links-vault-scan',
			name: i18n.vault.name,
			callback: async () => {
				if (this.isExecuting) return;
				this.isExecuting = true;
				try {
					await this.plugin.fileOperations.checkAndCreateMDFilesInVault();
					// 扫描完成后更新增量缓存和侧边栏 badge
					await this.refreshCacheAndBadge();
				} finally {
					this.isExecuting = false;
				}
			},
		});
	}

	/**
	 * 刷新增量扫描缓存，并更新侧边栏 badge 数字
	 */
	private async refreshCacheAndBadge(): Promise<void> {
		try {
			const results = await this.plugin.fileOperations.scanVaultForMissingLinks();
			this.scanCache.setFullScan(results);
			this.updateSidebarBadge(this.scanCache.totalMissingCount);
		} catch (error) {
			log.error(`[ScanModule] refreshCacheAndBadge failed: ${error}`);
		}
	}

	/**
	 * 更新侧边栏叶片标题，附带缺失链接数量 badge
	 */
	private updateSidebarBadge(count: number): void {
		const leaves = this.plugin.app.workspace.getLeavesOfType(ACTIVE_SIDE_VIEW_TYPE);
		const baseName = t(scanModuleI18n).name;
		for (const leaf of leaves) {
			// 通过 leaf 内部元素更新标题（tabHeaderInnerTitleEl 是 Obsidian 内部属性）
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
			const tabTitleEl = (leaf as any).tabHeaderInnerTitleEl as HTMLElement | undefined;
			if (tabTitleEl) {
				tabTitleEl.textContent = count > 0 ? `${baseName} (${count})` : baseName;
			}
		}
		log.debug(`[ScanModule] badge updated: ${count} missing links`);
	}

	private registerContextMenu(): void {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-menu', (menu, editor) => {
				const selectedText = editor.getSelection();
				if (!selectedText?.includes('[[')) return;

				const i18n = t(scanCommandsI18n);
				menu.addItem((item) =>
					item
						.setTitle(i18n.selectedText.name)
						.setIcon('document-plus')
						.onClick(async () => {
							await this.plugin.fileOperations.createLinksFromSelectedText(selectedText);
						})
				);
			})
		);
	}
}
