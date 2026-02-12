import { App, Notice } from 'obsidian';
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { FileCreationRule } from "@/model/rule-types";
import { RuleEditDialog } from "@/react/modals/RuleEditDialog";
import { TemplateSelectionModal } from "./template-selection-modal";
import { CustomModal } from "./custom-modal";
import { ObsidianProvider } from "@/react/context/ObsidianContext";
import { RuleManagementModal } from './rule-management-modal';
import { CreateFileSettingTab } from "@/settings/settings";
import CheckAndCreateMDFilePlugin from "../main";
import { t } from "@/i18n/locale";

export class RuleEditModal extends CustomModal {
	private rule: FileCreationRule;
	private onSave: (rule: FileCreationRule) => void;
	private plugin: CheckAndCreateMDFilePlugin;
	private root: Root | null = null;

	constructor(
		app: App,
		rule: FileCreationRule,
		onSave: (rule: FileCreationRule) => void,
		plugin: CheckAndCreateMDFilePlugin
	) {
		super(app);
		this.rule = { ...rule };
		this.onSave = onSave;
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ccmd-react-root', 'ccmd-rule-edit-modal', 'ccmd-quickAddModal');

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(
				ObsidianProvider,
				{
					app: this.app,
					plugin: this.plugin,
					settings: this.plugin.settings,
				},
				React.createElement(RuleEditDialog, {
					rule: this.rule,
					onSave: (updatedRule: FileCreationRule) => {
						this.onSave(updatedRule);
						this.close();
						new Notice(t('ruleSaved', { name: updatedRule.name }));
						if (RuleManagementModal.currentInstance) {
							RuleManagementModal.currentInstance.refreshRulesList();
						}
						if (CreateFileSettingTab.currentInstance) {
							CreateFileSettingTab.currentInstance.refreshRulesSummary();
						}
					},
					onCancel: () => this.close(),
					onBrowseTemplates: (onChoose: (path: string) => void) => {
						const templates = this.plugin.templaterService.getAvailableTemplates();
						if (templates.length === 0) {
							new Notice(t('noTemplatesFound'));
							return;
						}
						new TemplateSelectionModal(this.app, templates, onChoose).open();
					},
				})
			)
		);
	}

	onClose() {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
}
