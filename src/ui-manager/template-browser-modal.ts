import {App, Modal, TFile} from 'obsidian';

export class TemplateBrowserModal extends Modal {
	private templates: string[];
	private onChoose: (templatePath: string) => void;

	constructor(app: App, templates: string[], onChoose: (templatePath: string) => void) {
		super(app);
		this.templates = templates;
		this.onChoose = onChoose;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('ccmd-template-browser-modal');

		contentEl.createEl('h2', {text: 'Select Template'});

		const searchContainer = contentEl.createDiv({cls: 'template-search-container'});
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search templates...',
			cls: 'ccmd-template-search-input'
		});

		const templateList = contentEl.createDiv({cls: 'ccmd-template-list'});

		const renderTemplates = (templates: string[]) => {
			templateList.empty();

			if (templates.length === 0) {
				templateList.createEl('div', {
					text: 'No templates found',
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
