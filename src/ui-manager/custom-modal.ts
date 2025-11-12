import {App, Modal} from 'obsidian';

export class CustomModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	open() {
		super.open();

		setTimeout(() => {
			const modalEl = this.contentEl.closest('.modal');
			if (modalEl instanceof HTMLElement) {
				modalEl.style.width = '90vw';
				modalEl.style.maxWidth = '1400px';
				modalEl.style.minWidth = '600px';

				modalEl.style.left = '50%';
				modalEl.style.top = '50%';
				modalEl.style.transform = 'translate(-50%, -50%)';
				modalEl.style.position = 'fixed';
			}

			const modalContainer = this.contentEl.closest('.ccmd-modal-container');
			if (modalContainer instanceof HTMLElement) {
				modalContainer.style.width = 'auto';
				modalContainer.style.maxWidth = 'none';

				modalContainer.style.display = 'flex';
				modalContainer.style.justifyContent = 'center';
				modalContainer.style.alignItems = 'center';
				modalContainer.style.position = 'fixed';
				modalContainer.style.inset = '0';
			}
		}, 0);
	}
}
