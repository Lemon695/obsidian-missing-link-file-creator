/* eslint-disable obsidianmd/no-static-styles-assignment -- 遗留 Modal 布局 */
import { App } from 'obsidian';
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { CustomModal } from "./custom-modal";
import { ObsidianProvider } from "@/react/context/ObsidianContext";
import { DashboardPanel } from "@/react/views/DashboardPanel";
import CheckAndCreateMDFilePlugin from "../main";

export class DashboardModal extends CustomModal {
	private plugin: CheckAndCreateMDFilePlugin;
	private root: Root | null = null;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		// CSS-005: 隐藏 Obsidian 原生关闭按钮
		const nativeClose = modalEl.querySelector('.modal-close-button');
		if (nativeClose instanceof HTMLElement) nativeClose.style.display = 'none';
		contentEl.addClass('ccmd-react-root', 'ccmd-dashboard-modal');
		contentEl.setCssProps({ '--dash-h': this.plugin.settings.dashboardHeight || '80vh' });

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(
				ObsidianProvider,
				{ app: this.app, plugin: this.plugin, settings: this.plugin.settings },
				React.createElement(DashboardPanel, { onClose: () => this.close() })
			)
		);
	}

	onClose() {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
}
