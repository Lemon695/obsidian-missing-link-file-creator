import React from "react";
import { createRoot, Root } from "react-dom/client";
import { App, PluginSettingTab } from "obsidian";
import { FileCreationRule } from "@/model/rule-types";
import CheckAndCreateMDFilePlugin from "../main";
import { RuleManagementModal } from "@/ui-manager/rule-management-modal";
import { ObsidianProvider } from "@/react/context/ObsidianContext";
import { SettingsPanel } from "@/react/settings/SettingsPanel";

export interface CreateFileSettings {
	createFileSetting: string;
	showCreateFileNotification: boolean;
	defaultFolderPath: string;

	addAliasesToFrontmatter: boolean;

	// 模板设置
	useTemplates: boolean;            // 是否使用模板
	defaultTemplatePath: string;      // 默认模板路径
	templateFolder: string;           // 模板文件夹路径
	templaterMethod: 'execute' | 'overwrite' | 'basic';

	// 规则设置
	useRules: boolean;                // 是否使用规则
	rules: FileCreationRule[];        // 文件创建规则

	// 自动标签设置
	autoTagging: boolean;
	autoTaggingMinConfidence: number;

	// Developer options
	debugMode: boolean;

	// 忽略列表
	ignoreList: string[];
}

export const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '', // 默认为目录

	addAliasesToFrontmatter: true,

	// 模板默认设置
	useTemplates: false,
	defaultTemplatePath: '',
	templateFolder: '',
	templaterMethod: 'execute',

	// 规则默认设置
	useRules: false,
	rules: [],

	// 自动标签默认设置
	autoTagging: false,
	autoTaggingMinConfidence: 0.7,

	// Developer options
	debugMode: false,

	// 忽略列表
	ignoreList: []
}

export class CreateFileSettingTab extends PluginSettingTab {
	plugin: CheckAndCreateMDFilePlugin;
	private root: Root | null = null;
	private refreshToken = 0;
	public static currentInstance: CreateFileSettingTab | null = null;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;

		CreateFileSettingTab.currentInstance = this;
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.addClass("ccmd-react-root", "ccmd-settings-root");
		this.renderReactPanel();
	}

	private renderReactPanel(): void {
		if (!this.root) {
			this.root = createRoot(this.containerEl);
		}

		this.root.render(
			React.createElement(
				ObsidianProvider,
				{
					app: this.app,
					plugin: this.plugin,
					settings: this.plugin.settings,
				},
				React.createElement(SettingsPanel, {
					refreshToken: this.refreshToken,
					onOpenRulesManagement: () => {
						const modal = new RuleManagementModal(this.app, this.plugin);
						modal.open();
					},
				})
			)
		);
	}

	public refreshRulesSummary() {
		this.refreshToken += 1;
		this.renderReactPanel();
	}

	hide() {
		this.root?.unmount();
		this.root = null;
		CreateFileSettingTab.currentInstance = null;
	}
}
