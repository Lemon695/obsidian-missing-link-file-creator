/**
 * src/core/settings-tab.ts — 统一模块化设置面板
 *
 * 遍历 ModuleManager 中的所有模块，为每个模块渲染独立分区。
 * 各模块通过 renderSettings?(containerEl) 注入自己的设置 UI。
 *
 * 替代原来的 React 版 CreateFileSettingTab，回归轻量原生 Obsidian Setting API。
 */

import { PluginSettingTab, Setting, type App } from 'obsidian';
import type CheckAndCreateMDFilePlugin from '../main';

export class ModularSettingTab extends PluginSettingTab {
	/** 当前打开的实例，供其他模块刷新设置面板（与旧 CreateFileSettingTab 保持相同合约） */
	public static currentInstance: ModularSettingTab | null = null;

	constructor(app: App, private readonly plugin: CheckAndCreateMDFilePlugin) {
		super(app, plugin);
	}

	display(): void {
		ModularSettingTab.currentInstance = this;
		const { containerEl } = this;
		containerEl.empty();

		for (const mod of this.plugin.moduleManager.getAll()) {
			new Setting(containerEl).setName("").setHeading();

			if (mod.description) {
				containerEl.createEl('p', { text: mod.description, cls: 'ccmd-settings-section-desc' });
			}

			if (mod.renderSettings) {
				mod.renderSettings(containerEl);
			}

			containerEl.createEl('hr', { cls: 'ccmd-settings-divider' });
		}
	}

	/** 重新渲染设置面板，使规则数量等动态内容即时更新 */
	public refreshRulesSummary(): void {
		if (ModularSettingTab.currentInstance !== this) return;
		this.display();
	}

	hide(): void {
		ModularSettingTab.currentInstance = null;
	}
}
