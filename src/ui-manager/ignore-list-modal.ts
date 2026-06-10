import { App } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { IgnoreListDialog } from '@/react/modals/IgnoreListDialog';
import { CustomModal } from './custom-modal';
import { ObsidianProvider } from '@/react/context/ObsidianContext';
import CheckAndCreateMDFilePlugin from '../main';

export class IgnoreListModal extends CustomModal {
	private plugin: CheckAndCreateMDFilePlugin;
	private root: Root | null = null;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ccmd-react-root', 'ccmd-ignore-list-modal', 'ccmd-quickAddModal');

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(
				ObsidianProvider,
				{
					app: this.app,
					plugin: this.plugin,
					settings: this.plugin.settings,
				},
				React.createElement(IgnoreListDialog, {
					onClose: () => this.close(),
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
