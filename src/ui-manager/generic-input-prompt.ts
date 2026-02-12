import { App, Modal } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { GenericInputDialog } from "@/react/modals/GenericInputDialog";

export default class GenericInputPrompt extends Modal {
	public waitForClose: Promise<string>;

	private resolvePromise: (input: string) => void;
	private rejectPromise: (reason?: unknown) => void;
	private didSubmit = false;
	private input: string;
	private readonly placeholder: string;
	private root: Root | null = null;

	public static Prompt(
		app: App,
		header: string,
		placeholder?: string,
		value?: string
	): Promise<string> {
		const newPromptModal = new GenericInputPrompt(
			app,
			header,
			placeholder,
			value
		);
		return newPromptModal.waitForClose;
	}

	protected constructor(
		app: App,
		private header: string,
		placeholder?: string,
		value?: string
	) {
		super(app);
		this.placeholder = placeholder ?? "";
		this.input = value ?? "";

		this.waitForClose = new Promise<string>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});

		this.open();
	}

	onOpen() {
		this.containerEl.addClass("ccmd-quickAddModal", "qaInputPrompt");
		this.contentEl.empty();
		this.titleEl.textContent = this.header;

		this.root = createRoot(this.contentEl);
		this.root.render(
			React.createElement(GenericInputDialog, {
				header: this.header,
				placeholder: this.placeholder,
				initialValue: this.input,
				onConfirm: (value: string) => {
					this.input = value;
					this.didSubmit = true;
					this.close();
				},
				onCancel: () => this.close(),
			})
		);
	}

	onClose() {
		this.root?.unmount();
		this.root = null;

		if (this.didSubmit) {
			this.resolvePromise(this.input);
		} else {
			this.rejectPromise("User Cancelled");
		}
	}
}
