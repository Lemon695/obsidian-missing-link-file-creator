import {App, MetadataCache, TFile} from "obsidian";
import {TextInputSuggest} from "./suggest";

export class FrontmatterValueSuggester extends TextInputSuggest<string> {
	private propertyName: string;
	private metadataCache: MetadataCache;
	private values: Set<string> = new Set();

	constructor(app: App, inputEl: HTMLInputElement, propertyName: string) {
		super(app, inputEl);
		this.metadataCache = app.metadataCache;
		this.propertyName = propertyName;
		this.collectPropertyValues();
	}

	private collectPropertyValues(): void {
		// 清空现有值集合
		this.values.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const metadata = this.metadataCache.getFileCache(file)?.frontmatter;
			if (metadata && this.propertyName in metadata) {
				let value = metadata[this.propertyName];

				// 处理数组类型的值（例如tags数组）
				if (Array.isArray(value)) {
					for (const item of value) {
						if (typeof item === 'string') {
							this.values.add(item);
						}
					}
				}

				// 处理字符串类型的值
				else if (typeof value === 'string') {
					this.values.add(value);
				}

				// 处理数字类型的值
				else if (typeof value === 'number') {
					this.values.add(value.toString());
				}

				// 处理布尔类型的值
				else if (typeof value === 'boolean') {
					this.values.add(value.toString());
				}
			}
		}
	}

	// 更新属性名并重新收集值
	public updatePropertyName(propertyName: string): void {
		this.propertyName = propertyName;
		this.collectPropertyValues();
	}

	getSuggestions(inputStr: string): string[] {
		const lowerCaseInputStr = inputStr.toLowerCase();

		// 过滤匹配的值
		return Array.from(this.values)
			.filter(value => value.toLowerCase().includes(lowerCaseInputStr))
			.sort()
			.slice(0, 10);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger("input");
		this.close();
	}
}
