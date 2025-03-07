import {App, MetadataCache, TFile} from "obsidian";
import {TextInputSuggest} from "./suggest";

export class FrontmatterPropertySuggester extends TextInputSuggest<string> {
	private metadataCache: MetadataCache;
	private properties: Set<string> = new Set();

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.metadataCache = app.metadataCache;
		this.collectProperties();
	}

	// 从所有文件中收集frontmatter属性名
	private collectProperties(): void {
		// 清空现有属性集合
		this.properties.clear();

		// 获取所有markdown文件
		const files = this.app.vault.getMarkdownFiles();

		// 遍历所有文件的frontmatter数据
		for (const file of files) {
			const metadata = this.metadataCache.getFileCache(file)?.frontmatter;
			if (metadata) {
				for (const key in metadata) {
					// 跳过position属性(Obsidian内部使用的参数)
					if (key !== 'position') {
						this.properties.add(key);
					}
				}
			}
		}
	}

	// 更新属性集合
	public refreshProperties(): void {
		this.collectProperties();
	}

	getSuggestions(inputStr: string): string[] {
		const lowerCaseInputStr = inputStr.toLowerCase();

		// 过滤匹配的属性名
		return Array.from(this.properties)
			.filter(property => property.toLowerCase().includes(lowerCaseInputStr))
			.sort()
			.slice(0, 10);
	}

	renderSuggestion(property: string, el: HTMLElement): void {
		el.setText(property);
	}

	selectSuggestion(property: string): void {
		this.inputEl.value = property;
		this.inputEl.trigger("input");
		this.close();
	}
}
