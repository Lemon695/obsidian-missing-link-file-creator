/* eslint-disable obsidianmd/no-static-styles-assignment -- Modal 宽度通过直接 style 赋值控制，Obsidian 原生 .modal-container flexbox 负责居中 */
import {App, Modal} from 'obsidian';

export class CustomModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	open() {
		// ccmd-root 必须在 super.open()（→ onOpen()）之前加好，
		// 确保 React 渲染时 --sp-* / --r-* / --hue-* 等 CSS 变量可继承
		this.contentEl.addClass('ccmd-root');
		super.open();

		window.setTimeout(() => {
			const modalEl = this.contentEl.closest('.modal');
			if (modalEl instanceof HTMLElement) {
				modalEl.style.width = '90vw';
				modalEl.style.maxWidth = '1400px';
				modalEl.style.minWidth = '600px';
			}
		}, 0);
	}
}
