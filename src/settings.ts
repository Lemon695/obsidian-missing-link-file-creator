import {App, PluginSettingTab, Setting, TFolder} from 'obsidian'
import CheckAndCreateMDFilePlugin from "./main";

export interface CreateFileSettings {
	createFileSetting: string;
	showCreateFileNotification: boolean;
	defaultFolderPath: string;

	// Developer options
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '', // 默认为目录

	// Developer options
	debugMode: false,
}

export class CreateFileSettingTab extends PluginSettingTab {
	plugin: CheckAndCreateMDFilePlugin;

	constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// 添加新增文件通知设置
		new Setting(containerEl)
			.setName('Notification Settings')
			.setDesc('Show a notification when a file is create')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCreateFileNotification)
				.onChange(async (value) => {
					this.plugin.settings.showCreateFileNotification = value;
					await this.plugin.saveSettings();
				}));

		let selectedIndex = -1;

		const folderSelectionSetting = new Setting(containerEl)
			.setName('Default Path')
			.setDesc('Set the default folder where new MD files will be created.');

		//自定义文件夹选择器
		const folderSelectContainer = document.createElement('div');
		folderSelectContainer.addClass('ccmd-folder-select-container');

		//输入框包装器
		const inputWrapper = document.createElement('div');
		inputWrapper.addClass('ccmd-folder-select-input-wrapper');
		folderSelectContainer.appendChild(inputWrapper);

		const searchIcon = document.createElement('span');
		searchIcon.addClass('ccmd-folder-select-icon');
		searchIcon.innerHTML = '🔍';
		inputWrapper.appendChild(searchIcon);

		//输入框
		const inputEl = document.createElement('input');
		inputEl.addClass('ccmd-folder-select-input');
		inputEl.type = 'text';
		inputEl.placeholder = 'Type to search folders...';
		inputEl.value = this.plugin.settings.defaultFolderPath || '';
		inputWrapper.appendChild(inputEl);

		//下拉菜单容器
		const dropdownContainer = document.createElement('div');
		dropdownContainer.addClass('ccmd-folder-select-dropdown');
		dropdownContainer.style.display = 'none';
		folderSelectContainer.appendChild(dropdownContainer);

		//添加到设置
		folderSelectionSetting.settingEl.appendChild(folderSelectContainer);

		//获取所有文件夹路径
		const folders = this.getAllFolders();

		inputEl.addEventListener('focus', () => {
			this.updateFolderDropdown(dropdownContainer, folders, inputEl.value);
			dropdownContainer.style.display = 'block';
		});

		document.addEventListener('click', (event) => {
			if (!folderSelectContainer.contains(event.target as Node)) {
				dropdownContainer.style.display = 'none';
			}
		});

		inputEl.addEventListener('input', () => {
			this.updateFolderDropdown(dropdownContainer, folders, inputEl.value);
			dropdownContainer.style.display = 'block';
		});

		inputEl.addEventListener('change', async () => {
			this.plugin.settings.defaultFolderPath = inputEl.value;
			await this.plugin.saveSettings();
		});

		inputEl.addEventListener('keydown', (event) => {
			if (dropdownContainer.style.display === 'none') {
				return;
			}

			const options = dropdownContainer.querySelectorAll('.ccmd-folder-select-option');

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				selectedIndex = (selectedIndex > 0) ? selectedIndex - 1 : options.length - 1;
				this.updateOptionSelection(options, selectedIndex);
			} else if (event.key === 'ArrowDown') {
				event.preventDefault();
				selectedIndex = (selectedIndex < options.length - 1) ? selectedIndex + 1 : 0;
				this.updateOptionSelection(options, selectedIndex);
			} else if (event.key === 'Enter') {
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < options.length) {
					(options[selectedIndex] as HTMLElement).click();
				}
			} else if (event.key === 'Escape') {
				event.preventDefault();
				dropdownContainer.style.display = 'none';
			}
		});
		inputEl.addEventListener('focus', () => {
			selectedIndex = -1;
		});

		new Setting(containerEl)
			.setName('Developer')
			.setHeading()

		// Debug mode
		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug mode to log detailed information to the console.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));
	}

	private updateFolderDropdown(dropdownContainer: HTMLElement, folders: string[], searchText: string): void {
		// 清空现有选项
		dropdownContainer.empty();

		if (this.hasOwnProperty('selectedIndex')) {
			(this as any).selectedIndex = -1;
		}

		// 添加根目录选项
		if ('' === searchText || 'root'.includes(searchText.toLowerCase())) {
			const rootOption = document.createElement('div');
			rootOption.addClass('ccmd-folder-select-option');
			rootOption.textContent = 'Root Directory';
			rootOption.addEventListener('click', async () => {
				const inputEl = dropdownContainer.parentElement?.querySelector('.ccmd-folder-select-input') as HTMLInputElement;
				if (inputEl) {
					inputEl.value = '';
					this.plugin.settings.defaultFolderPath = '';
					await this.plugin.saveSettings();
					dropdownContainer.style.display = 'none';
				}
			});
			dropdownContainer.appendChild(rootOption);
		}

		// 筛选并添加匹配的文件夹
		const filteredFolders = folders.filter(folder =>
			folder.toLowerCase().includes(searchText.toLowerCase())
		);

		if (filteredFolders.length > 0) {
			filteredFolders.forEach(folder => {
				const option = document.createElement('div');
				option.addClass('ccmd-folder-select-option');
				option.textContent = folder;
				option.addEventListener('click', async () => {
					const inputEl = dropdownContainer.parentElement?.querySelector('.ccmd-folder-select-input') as HTMLInputElement;
					if (inputEl) {
						inputEl.value = folder;
						this.plugin.settings.defaultFolderPath = folder;
						await this.plugin.saveSettings();
						dropdownContainer.style.display = 'none';
					}
				});
				dropdownContainer.appendChild(option);
			});
		} else if (searchText && filteredFolders.length === 0) {
			const noResultOption = document.createElement('div');
			noResultOption.addClass('ccmd-folder-select-option');
			noResultOption.addClass('ccmd-folder-select-no-result');
			noResultOption.textContent = 'No matching folders';
			dropdownContainer.appendChild(noResultOption);
		}
	}

	private getAllFolders(): string[] {
		const folders: string[] = [];

		const getSubfolders = (folder: TFolder, path: string) => {
			const folderPath = path ? path + '/' + folder.name : folder.name;
			if (folderPath) {
				folders.push(folderPath);
			}

			folder.children
				.filter(child => child instanceof TFolder)
				.forEach(subFolder => {
					getSubfolders(subFolder as TFolder, folderPath);
				});
		};

		this.app.vault.getRoot().children
			.filter(child => child instanceof TFolder)
			.forEach(folder => {
				getSubfolders(folder as TFolder, '');
			});

		return folders.sort();
	}

	private updateOptionSelection(options: NodeListOf<Element>, selectedIndex: number): void {
		options.forEach(option => {
			option.removeClass('ccmd-folder-select-option-selected');
		});

		if (selectedIndex >= 0 && selectedIndex < options.length) {
			options[selectedIndex].addClass('ccmd-folder-select-option-selected');

			(options[selectedIndex] as HTMLElement).scrollIntoView({
				block: 'nearest',
				inline: 'nearest'
			});
		}
	}
}
