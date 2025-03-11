// Credits go to Liam's Periodic Notes Plugin: https://github.com/liamcain/obsidian-periodic-notes

import {App, ISuggestOwner, Scope} from "obsidian";
import {createPopper, Instance as PopperInstance} from "@popperjs/core";

const wrapAround = (value: number, size: number): number => {
	return ((value % size) + size) % size;
};

class Suggest<T> {
	private owner: ISuggestOwner<T>;
	private values: T[];
	private suggestions: HTMLDivElement[];
	private selectedItem: number;
	private containerEl: HTMLElement;
	private activeTooltip: HTMLElement | null = null;

	constructor(
		owner: ISuggestOwner<T>,
		containerEl: HTMLElement,
		scope: Scope
	) {
		this.owner = owner;
		this.containerEl = containerEl;

		containerEl.on(
			"click",
			".suggestion-item",
			this.onSuggestionClick.bind(this)
		);
		containerEl.on(
			"mousemove",
			".suggestion-item",
			this.onSuggestionMouseover.bind(this)
		);

		scope.register([], "ArrowUp", (event) => {
			if (!event.isComposing) {
				this.setSelectedItem(this.selectedItem - 1, true);
				return false;
			}
		});

		scope.register([], "ArrowDown", (event) => {
			if (!event.isComposing) {
				this.setSelectedItem(this.selectedItem + 1, true);
				return false;
			}
		});

		scope.register([], "Enter", (event) => {
			if (!event.isComposing) {
				this.useSelectedItem(event);
				return false;
			}
		});
	}

	onSuggestionClick(event: MouseEvent, el: HTMLDivElement): void {
		event.preventDefault();

		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
		this.useSelectedItem(event);
	}

	onSuggestionMouseover(_event: MouseEvent, el: HTMLDivElement): void {
		const item = this.suggestions.indexOf(el);
		this.setSelectedItem(item, false);
	}

	setSuggestions(values: T[]) {
		this.containerEl.empty();
		const suggestionEls: HTMLDivElement[] = [];

		values.forEach((value) => {
			const suggestionEl = this.containerEl.createDiv("suggestion-item");
			this.owner.renderSuggestion(value, suggestionEl);
			suggestionEls.push(suggestionEl);

			// 添加鼠标悬停显示完整路径的功能
			this.addPathTooltip(suggestionEl);
		});

		this.values = values;
		this.suggestions = suggestionEls;
		this.setSelectedItem(0, false);
	}

	useSelectedItem(event: MouseEvent | KeyboardEvent) {
		const currentValue = this.values[this.selectedItem];
		if (currentValue) {
			this.clearActiveTooltip();

			this.owner.selectSuggestion(currentValue, event);
		}
	}

	setSelectedItem(selectedIndex: number, scrollIntoView: boolean) {
		const normalizedIndex = wrapAround(
			selectedIndex,
			this.suggestions.length
		);
		const prevSelectedSuggestion = this.suggestions[this.selectedItem];
		const selectedSuggestion = this.suggestions[normalizedIndex];

		prevSelectedSuggestion?.removeClass("is-selected");
		selectedSuggestion?.addClass("is-selected");

		this.selectedItem = normalizedIndex;

		if (scrollIntoView) {
			selectedSuggestion.scrollIntoView(false);
		}
	}

	// 清除活跃的工具提示
	clearActiveTooltip() {
		const tooltips = document.querySelectorAll('.path-tooltip');
		tooltips.forEach(tooltip => {
			tooltip.remove();
		});
	}

	private addPathTooltip(suggestionEl: HTMLElement) {
		let tooltip: HTMLElement | null = null;

		suggestionEl.addEventListener('mouseenter', () => {
			// 检查内容是否被截断
			if (suggestionEl.scrollWidth > suggestionEl.clientWidth ||
				suggestionEl.offsetWidth < suggestionEl.scrollWidth) {

				// 清除任何现有的工具提示
				this.clearActiveTooltip();

				tooltip = document.createElement('div');
				tooltip.addClass('path-tooltip');
				tooltip.setText(suggestionEl.textContent || '');
				document.body.appendChild(tooltip);
				this.activeTooltip = tooltip;  // 跟踪活跃的工具提示

				const rect = suggestionEl.getBoundingClientRect();
				tooltip.style.top = `${rect.bottom + 8}px`;
				tooltip.style.left = `${rect.left}px`;

				// 延迟显示避免闪烁
				setTimeout(() => {
					if (tooltip) tooltip.addClass('show');
				}, 300);
			}
		});

		suggestionEl.addEventListener('mouseleave', () => {
			if (tooltip) {
				tooltip.removeClass('show');
				setTimeout(() => {
					if (tooltip) {
						tooltip.remove();
						tooltip = null;
						this.activeTooltip = null;  // 清除活跃的工具提示引用
					}
				}, 200);
			}
		});
	}
}

export abstract class TextInputSuggest<T> implements ISuggestOwner<T> {
	protected app: App;
	protected inputEl: HTMLInputElement | HTMLTextAreaElement;

	private popper: PopperInstance;
	private scope: Scope;
	private suggestEl: HTMLElement;
	private suggest: Suggest<T>;

	constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement) {
		this.app = app;
		this.inputEl = inputEl;
		this.scope = new Scope();

		this.suggestEl = createDiv("suggestion-container");
		const suggestion = this.suggestEl.createDiv("suggestion");
		this.suggest = new Suggest(this, suggestion, this.scope);

		this.scope.register([], "Escape", this.close.bind(this));

		this.inputEl.addEventListener("input", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("focus", this.onInputChanged.bind(this));
		this.inputEl.addEventListener("blur", this.close.bind(this));
		this.suggestEl.on(
			"mousedown",
			".suggestion-container",
			(event: MouseEvent) => {
				event.preventDefault();
			}
		);
	}

	onInputChanged(): void {
		const inputStr = this.inputEl.value;
		const suggestions = this.getSuggestions(inputStr);

		if (!suggestions) {
			this.close();
			return;
		}

		if (suggestions.length > 0) {
			this.suggest.setSuggestions(suggestions);
			this.open(this.app.dom.appContainerEl, this.inputEl);
		} else {
			this.close();
		}
	}

	open(container: HTMLElement, inputEl: HTMLElement): void {
		this.app.keymap.pushScope(this.scope);

		container.appendChild(this.suggestEl);
		this.popper = createPopper(inputEl, this.suggestEl, {
			placement: "bottom-start",
			modifiers: [
				{
					name: "offset",
					options: {
						offset: [0, 5], // 水平和垂直偏移
					},
				},
				{
					name: "preventOverflow",
					options: {
						boundary: container,
						padding: 10,
					},
				},
				{
					name: "sameWidth",
					enabled: false, // 禁用sameWidth修饰符
					fn: ({state, instance}) => {
						// 不再设置与参考元素相同的宽度
						return;
					},
					phase: "beforeWrite",
					requires: ["computeStyles"],
				},
			],
		});

		this.suggestEl.style.width = "auto";
		this.suggestEl.style.minWidth = "120px";
		this.suggestEl.style.maxWidth = "180px";
	}

	close(): void {
		this.app.keymap.popScope(this.scope);

		// 确保清除任何可能存在的工具提示
		const tooltips = document.querySelectorAll('.path-tooltip');
		tooltips.forEach(tooltip => {
			tooltip.remove();
		});

		this.suggest.setSuggestions([]);
		if (this.popper) this.popper.destroy();
		this.suggestEl.detach();
	}

	abstract getSuggestions(inputStr: string): T[];

	abstract renderSuggestion(item: T, el: HTMLElement): void;

	abstract selectSuggestion(item: T): void;
}
