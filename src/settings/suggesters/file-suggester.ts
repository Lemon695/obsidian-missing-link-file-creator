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
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}
}
