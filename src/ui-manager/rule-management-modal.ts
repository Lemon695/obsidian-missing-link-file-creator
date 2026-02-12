import { App } from 'obsidian';
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { FileCreationRule } from "@/model/rule-types";
import { RuleManagementDialog } from "@/react/modals/RuleManagementDialog";
import { RuleEditModal } from "./rule-edit-modal";
import { CustomModal } from "./custom-modal";
import { ObsidianProvider } from "@/react/context/ObsidianContext";
import CheckAndCreateMDFilePlugin from "../main";

export class RuleManagementModal extends CustomModal {
	private plugin: CheckAndCreateMDFilePlugin;
	private root: Root | null = null;
	public static currentInstance: RuleManagementModal | null = null;
	private refreshCallback: (() => void) | null = null;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app);
		this.plugin = plugin;
		RuleManagementModal.currentInstance = this;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ccmd-react-root', 'ccmd-rule-management-modal', 'ccmd-quickAddModal');

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(
				ObsidianProvider,
				{
					app: this.app,
					plugin: this.plugin,
					settings: this.plugin.settings,
				},
				React.createElement(RuleManagementDialog, {
					onOpenEditModal: (rule: FileCreationRule, onSave: (rule: FileCreationRule) => void) => {
						const modal = new RuleEditModal(this.app, rule, onSave, this.plugin);
						modal.open();
					},
					onClose: () => this.close(),
				})
			)
		);
	}

	public refreshRulesList() {
		// Re-render the React tree to pick up settings changes
		if (this.root) {
			this.onOpen();
		}
	}

	onClose() {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
		RuleManagementModal.currentInstance = null;
	}
}
