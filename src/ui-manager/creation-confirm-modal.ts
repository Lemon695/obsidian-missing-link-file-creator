import { App, Modal } from 'obsidian';
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { CreationModalParams, CreationResult, FileToCreate } from "@/model/file-types";
import { CreationConfirmDialog } from "@/react/modals/CreationConfirmDialog";

/**
 * 文件创建确认弹窗 — React bridge
 */
export class CreationConfirmModal extends Modal {
	private params: CreationModalParams;
	private root: Root | null = null;
	public finalResult: CreationResult | null = null;
	private onCloseCallback: ((result: CreationResult | null) => void) | null = null;

	constructor(params: CreationModalParams) {
		super(params.app);
		this.params = params;
	}

	public setResultCallback(callback: (result: CreationResult | null) => void): void {
		this.onCloseCallback = callback;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ccmd-react-root', 'ccmd-creation-confirm-modal');

		const modalContainer = contentEl.closest('.modal');
		if (modalContainer) {
			modalContainer.addClass('ccmd-file-creation-modal-container');
		}

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(CreationConfirmDialog, {
				files: this.params.files,
				onConfirm: this.params.onConfirm,
				onCancel: () => {
					this.params.onCancel();
					this.close();
				},
				onClose: () => this.close(),
			})
		);
	}

	onClose(): void {
		if (this.onCloseCallback) {
			this.onCloseCallback(this.finalResult);
		}
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
}
