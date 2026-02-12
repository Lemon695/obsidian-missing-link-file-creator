import { App } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { TemplatePickerDialog } from "@/react/modals/TemplatePickerDialog";
import { t } from "@/i18n/locale";
import { SelectTemplateView } from "@/view/select-template-view";

export class TemplateBrowserModal extends SelectTemplateView {
	private templates: string[];
	private onChoose: (templatePath: string) => void;
	private root: Root | null = null;

	constructor(app: App, templates: string[], onChoose: (templatePath: string) => void) {
		super(app);
		this.templates = templates;
		this.onChoose = onChoose;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ccmd-react-root", "ccmd-template-browser-modal", "ccmd-quickAddModal");

		this.root = createRoot(contentEl);
		this.root.render(
			React.createElement(TemplatePickerDialog, {
				templates: this.templates,
				title: t("selectTemplate"),
				onChoose: (templatePath: string) => {
					this.onChoose(templatePath);
					this.close();
				},
				onClose: () => this.close(),
			})
		);
	}

	onClose() {
		this.root?.unmount();
		this.root = null;

		const { contentEl } = this;
		contentEl.empty();
	}
}
