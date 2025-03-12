// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import {App, TAbstractFile, TFolder} from "obsidian";
import {TextInputSuggest} from "./suggest";

export class FolderSuggest extends TextInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement) {
		super(app, inputEl);

		this.enhanceInputElement();
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder: TAbstractFile) => {
			if (
				folder instanceof TFolder &&
				folder.path.toLowerCase().contains(lowerCaseInputStr)
			) {
				folders.push(folder);
			}
		});

		return folders.slice(0, 1000);
	}

	renderSuggestion(file: TFolder, el: HTMLElement): void {
		el.setText(file.path);

		// 确保提示项显示完整路径
		el.title = file.path; // 添加HTML title属性

		// 添加溢出样式
		el.style.overflow = "hidden";
		el.style.textOverflow = "ellipsis";
		el.style.whiteSpace = "nowrap";
	}

	selectSuggestion(file: TFolder): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}

	private enhanceInputElement() {
		const inputEl = this.inputEl;

		// 添加滚动功能 - 这里不需要修改CSS，我们只添加事件处理
		let tooltip: HTMLElement | null = null;

		// 鼠标悬停时显示完整路径
		inputEl.addEventListener('mouseenter', () => {
			if (inputEl.value && inputEl.scrollWidth > inputEl.clientWidth) {
				if (!tooltip) {
					tooltip = document.createElement('div');
					tooltip.addClass('ccmd-path-tooltip');
					tooltip.setText(inputEl.value);
					document.body.appendChild(tooltip);
				}

				const rect = inputEl.getBoundingClientRect();
				tooltip.style.top = `${rect.bottom + 8}px`;
				tooltip.style.left = `${rect.left}px`;

				// 延迟显示，避免频繁触发
				setTimeout(() => {
					if (tooltip) tooltip.addClass('show');
				}, 300);
			}
		});

		// 鼠标移出时隐藏提示
		inputEl.addEventListener('mouseleave', () => {
			if (tooltip) {
				tooltip.removeClass('show');
				setTimeout(() => {
					if (tooltip) {
						tooltip.remove();
						tooltip = null;
					}
				}, 200);
			}
		});

		// 焦点时确保光标可见
		inputEl.addEventListener('focus', () => {
			// 延迟执行，确保在输入框完全渲染后执行
			setTimeout(() => {
				// 获取当前输入框中光标位置
				const cursorPos = inputEl.selectionStart || 0;

				// 计算光标位置相对于可视区域的偏移
				const textWidthBeforeCursor = this.getTextWidth(inputEl.value.substring(0, cursorPos), getComputedStyle(inputEl));

				// 调整滚动位置，使光标可见
				if (textWidthBeforeCursor > inputEl.clientWidth) {
					inputEl.scrollLeft = textWidthBeforeCursor - inputEl.clientWidth / 2;
				}
			}, 0);
		});
	}

	// 辅助方法：计算文本宽度
	private getTextWidth(text: string, style: CSSStyleDeclaration): number {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (context) {
			context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			return context.measureText(text).width;
		}
		return 0;
	}

}
