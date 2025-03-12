// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import {TAbstractFile, TFile} from "obsidian";
import {TextInputSuggest} from "./suggest";
import CheckAndCreateMDFilePlugin from "../../main";
import {get_tfiles_from_folder} from "../../utils/data-utils";
import {errorWrapperSync} from "../../utils/error-utils";

export enum FileSuggestMode {
	TemplateFiles,
	ScriptFiles,
}

export class FileSuggest extends TextInputSuggest<TFile> {
	constructor(
		public inputEl: HTMLInputElement,
		private plugin: CheckAndCreateMDFilePlugin,
		private mode: FileSuggestMode
	) {
		super(plugin.app, inputEl);

		this.enhanceInputElement();
	}

	get_folder(mode: FileSuggestMode): string {
		switch (mode) {
			case FileSuggestMode.TemplateFiles:
				// return this.plugin.settings.templates_folder;
				return this.plugin.settings.templateFolder;
			case FileSuggestMode.ScriptFiles:
				//TODO
				// return this.plugin.settings.user_scripts_folder;
				return "";
		}
	}

	get_error_msg(mode: FileSuggestMode): string {
		switch (mode) {
			case FileSuggestMode.TemplateFiles:
				return `Templates folder doesn't exist`;
			case FileSuggestMode.ScriptFiles:
				return `User Scripts folder doesn't exist`;
		}
	}

	getSuggestions(input_str: string): TFile[] {
		const all_files = errorWrapperSync(
			() =>
				get_tfiles_from_folder(
					this.plugin.app,
					this.get_folder(this.mode)
				),
			this.get_error_msg(this.mode)
		);
		if (!all_files) {
			return [];
		}

		const files: TFile[] = [];
		const lower_input_str = input_str.toLowerCase();

		all_files.forEach((file: TAbstractFile) => {
			if (
				file instanceof TFile &&
				file.extension === "md" &&
				file.path.toLowerCase().contains(lower_input_str)
			) {
				files.push(file);
			}
		});

		return files.slice(0, 1000);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);

		// 确保提示项显示完整路径
		el.title = file.path; // 添加HTML title属性

		// 添加溢出样式
		el.style.overflow = "hidden";
		el.style.textOverflow = "ellipsis";
		el.style.whiteSpace = "nowrap";
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}

	private enhanceInputElement() {
		const inputEl = this.inputEl;

		let tooltip: HTMLElement | null = null;

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

				setTimeout(() => {
					if (tooltip) tooltip.addClass('show');
				}, 300);
			}
		});

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

		inputEl.addEventListener('focus', () => {
			setTimeout(() => {
				const cursorPos = inputEl.selectionStart || 0;
				const textWidthBeforeCursor = this.getTextWidth(inputEl.value.substring(0, cursorPos), getComputedStyle(inputEl));

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
