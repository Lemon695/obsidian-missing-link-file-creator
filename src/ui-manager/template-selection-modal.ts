import {App, Modal, TFile} from "obsidian";
import {SelectTemplateView} from "../view/select-template-view";

export class TemplateSelectionModal extends SelectTemplateView {
	private templates: string[];
	private onChoose: (path: string) => void;

	constructor(app: App, templates: string[], onChoose: (path: string) => void) {
		super(app);
		this.templates = templates;
		this.onChoose = onChoose;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('ccmd-template-selection-modal', 'ccmd-quickAddModal');

		contentEl.createEl('h2', {text: 'Select Template'});

		const searchContainer = contentEl.createDiv({cls: 'template-search-container'});
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search templates...', //搜索模板...
			cls: 'ccmd-template-search-input'
		});
		searchInput.style.width = "100%";
		searchInput.style.marginBottom = "15px";
		searchInput.style.padding = "8px";
		searchInput.style.borderRadius = "4px";
		searchInput.style.border = "1px solid var(--background-modifier-border)";

		const templateList = contentEl.createDiv({cls: 'ccmd-template-list'});

		if (this.templates.length === 0) {
			templateList.createEl('div', {
				text: 'No template files found', //没有找到模板文件
				cls: 'ccmd-no-templates'
			});
			return;
		}

		const renderTemplates = (templates: string[]) => {
			templateList.empty();

			if (templates.length === 0) {
				templateList.createEl('div', {
					text: 'No matching templates', //未找到匹配的模板
					cls: 'ccmd-no-templates'
				});
				return;
			}

			templates.forEach(templatePath => {
				const item = templateList.createEl('div', {
					cls: 'ccmd-template-item',
					text: templatePath
				});

				item.addEventListener('click', () => {
					this.onChoose(templatePath);
					this.close();
				});
			});
		};

		renderTemplates(this.templates);

		searchInput.addEventListener('input', () => {
			const searchTerm = searchInput.value.toLowerCase();
			const filteredTemplates = this.templates.filter(
				template => template.toLowerCase().includes(searchTerm)
			);
			renderTemplates(filteredTemplates);
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
