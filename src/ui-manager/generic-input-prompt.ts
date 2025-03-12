import {App, ButtonComponent, Modal, TextComponent} from "obsidian";

export default class GenericInputPrompt extends Modal {
	public waitForClose: Promise<string>;

	private resolvePromise: (input: string) => void;
	private rejectPromise: (reason?: unknown) => void;
	private didSubmit = false;
	private inputComponent: TextComponent;
	private input: string;
	private readonly placeholder: string;

	public static Prompt(
		app: App,
		header: string,
		placeholder?: string,
		value?: string
	): Promise<string> {
		const newPromptModal = new GenericInputPrompt(
			app,
			header,
			placeholder,
			value
		);
		return newPromptModal.waitForClose;
	}

	protected constructor(
		app: App,
		private header: string,
		placeholder?: string,
		value?: string
	) {
		super(app);
		this.placeholder = placeholder ?? "";
		this.input = value ?? "";

		this.waitForClose = new Promise<string>((resolve, reject) => {
			this.resolvePromise = resolve;
			this.rejectPromise = reject;
		});

		this.display();
		this.open();
	}

	private display() {
		this.containerEl.addClass("ccmd-quickAddModal", "qaInputPrompt");
		this.contentEl.empty();
		this.titleEl.textContent = this.header;

		const mainContentContainer: HTMLDivElement = this.contentEl.createDiv();
		this.inputComponent = this.createInputField(
			mainContentContainer,
			this.placeholder,
			this.input
		);
		this.createButtonBar(mainContentContainer);
	}

	protected createInputField(
		container: HTMLElement,
		placeholder?: string,
		value?: string
	) {
		const textComponent = new TextComponent(container);

		textComponent.inputEl.style.width = "100%";
		textComponent
			.setPlaceholder(placeholder ?? "")
			.setValue(value ?? "")
			.onChange((value) => (this.input = value))
			.inputEl.addEventListener("keydown", this.submitEnterCallback);

		return textComponent;
	}

	private createButtonBar(mainContentContainer: HTMLDivElement) {
		const buttonBarContainer: HTMLDivElement =
			mainContentContainer.createDiv();

		const confirmButton = new ButtonComponent(buttonBarContainer);
		confirmButton.setButtonText("Confirm").onClick(this.submitClickCallback);
		confirmButton.setCta();
		confirmButton.buttonEl.style.marginRight = "8px";

		const cancelButton = new ButtonComponent(buttonBarContainer);
		cancelButton.setButtonText("Cancel").onClick(this.cancelClickCallback);

		buttonBarContainer.style.display = "flex";
		buttonBarContainer.style.flexDirection = "row-reverse";
		buttonBarContainer.style.justifyContent = "flex-start";
		buttonBarContainer.style.marginTop = "1rem";
	}

	private submitClickCallback = () => this.submit();
	private cancelClickCallback = () => this.cancel();

	private submitEnterCallback = (evt: KeyboardEvent) => {
		if (evt.key === "Enter" && !evt.isComposing) {
			evt.preventDefault();
			this.submit();
		}
	};

	private submit() {
		this.didSubmit = true;
		this.close();
	}

	private cancel() {
		this.close();
	}

	onClose() {
		super.onClose();

		if (this.didSubmit) {
			this.resolvePromise(this.input);
		} else {
			this.rejectPromise("User Cancelled");
		}

		this.inputComponent.inputEl.removeEventListener(
			"keydown",
			this.submitEnterCallback
		);
	}
}
