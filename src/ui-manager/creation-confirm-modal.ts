import {App, Modal, Setting, TFile, Notice} from 'obsidian';
import {CreateFileSettings} from "../settings";

// 待创建文件
interface FileToCreate {
	id: string;         // 唯一标识
	filename: string;   // 文件名
	path: string;       // 完整路径
	selected: boolean;  // 是否选中
	aliases: string[];  // 别名列表
}

interface CreationModalParams {
	app: App;
	settings: CreateFileSettings;
	files: FileToCreate[];
	onConfirm: (selectedFiles: FileToCreate[]) => Promise<boolean>;
	onCancel: () => void;
}

// 文件创建结果
interface CreationResult {
	created: number;    // 成功创建的文件数
	skipped: number;    // 跳过的文件数
	failed: number;     // 失败的文件数
	aliasesAdded: number; // 添加的别名数
}

/**
 * 文件创建确认弹窗
 */
export class CreationConfirmModal extends Modal {
	private params: CreationModalParams;
	private currentPage: number = 1;
	private readonly itemsPerPage: number = 10;
	private selectAllCheckbox: HTMLInputElement;
	private confirmButton: HTMLButtonElement;
	private cancelButton: HTMLButtonElement;
	private paginationDiv: HTMLDivElement;
	private resultDiv: HTMLDivElement;
	private isProcessing: boolean = false;
	public finalResult: CreationResult | null = null;
	private onCloseCallback: ((result: CreationResult | null) => void) | null = null;

	private progressElements: {
		percentageDisplay: HTMLElement,
		progressBar: HTMLElement,
		progressText: HTMLElement,
		stats: {
			created: HTMLElement,
			skipped: HTMLElement,
			failed: HTMLElement,
			aliases: HTMLElement
		}
	} | null = null;

	constructor(params: CreationModalParams) {
		super(params.app);
		this.params = params;
	}

	/**
	 * 计算总页数
	 */
	private get totalPages(): number {
		return Math.ceil(this.params.files.length / this.itemsPerPage);
	}

	/**
	 * 获取当前页的文件
	 */
	private getCurrentPageFiles(): FileToCreate[] {
		const start = (this.currentPage - 1) * this.itemsPerPage;
		const end = Math.min(start + this.itemsPerPage, this.params.files.length);
		return this.params.files.slice(start, end);
	}

	/**
	 * 切换全选状态
	 */
	private toggleSelectAll(checked: boolean): void {
		const currentFiles = this.getCurrentPageFiles();
		currentFiles.forEach(file => file.selected = checked);
		this.updateFileList();
		this.updateSelectAllCheckbox();
		this.updateConfirmButton();
		this.updatePagination();
	}

	/**
	 * 更新全选复选框状态
	 */
	private updateSelectAllCheckbox(): void {
		const currentFiles = this.getCurrentPageFiles();
		const allSelected = currentFiles.every(file => file.selected);
		const someSelected = currentFiles.some(file => file.selected);

		this.selectAllCheckbox.checked = allSelected;
		this.selectAllCheckbox.indeterminate = someSelected && !allSelected;
	}

	/**
	 * 更新确认按钮状态
	 */
	private updateConfirmButton(): void {
		const anySelected = this.params.files.some(file => file.selected);
		this.confirmButton.disabled = !anySelected || this.isProcessing;
	}

	/**
	 * 更新分页控件
	 */
	private updatePagination(): void {
		this.paginationDiv.empty();

		// 已选择的文件数量
		const selectedCount = this.params.files.filter(file => file.selected).length;

		const paginationInfo = document.createElement('span');
		paginationInfo.textContent = `Page ${this.currentPage}/${this.totalPages}, ${this.params.files.length} files total, ${selectedCount} selected`;
		this.paginationDiv.appendChild(paginationInfo);

		if (this.totalPages > 1) {
			const paginationControls = document.createElement('div');
			paginationControls.addClass('pagination-controls');

			const prevButton = document.createElement('button');
			prevButton.textContent = 'Previous';
			prevButton.disabled = this.currentPage === 1 || this.isProcessing;
			prevButton.addEventListener('click', () => {
				if (this.currentPage > 1) {
					this.currentPage--;
					this.updateFileList();
					this.updatePagination();
					this.updateSelectAllCheckbox();
				}
			});

			const nextButton = document.createElement('button');
			nextButton.textContent = 'Next';
			nextButton.disabled = this.currentPage === this.totalPages || this.isProcessing;
			nextButton.addEventListener('click', () => {
				if (this.currentPage < this.totalPages) {
					this.currentPage++;
					this.updateFileList();
					this.updatePagination();
					this.updateSelectAllCheckbox();
				}
			});

			paginationControls.appendChild(prevButton);
			paginationControls.appendChild(nextButton);
			this.paginationDiv.appendChild(paginationControls);
		}
	}

	/**
	 * 更新文件列表
	 */
	private updateFileList(): void {
		const contentEl = this.contentEl;
		const fileListDiv = contentEl.querySelector('.file-list-container');

		if (fileListDiv) {
			fileListDiv.empty();

			const currentFiles = this.getCurrentPageFiles();

			if (currentFiles.length === 0) {
				const emptyMessage = document.createElement('div');
				emptyMessage.textContent = 'No files to create';
				emptyMessage.addClass('empty-message');
				fileListDiv.appendChild(emptyMessage);
				return;
			}

			const table = document.createElement('table');
			table.addClass('file-table');

			// 表头
			const thead = document.createElement('thead');
			const headerRow = document.createElement('tr');

			const selectHeader = document.createElement('th');
			selectHeader.addClass('select-column');
			this.selectAllCheckbox = document.createElement('input');
			this.selectAllCheckbox.type = 'checkbox';
			this.selectAllCheckbox.disabled = this.isProcessing;
			this.selectAllCheckbox.addEventListener('change', (e) => {
				this.toggleSelectAll((e.target as HTMLInputElement).checked);
			});
			selectHeader.appendChild(this.selectAllCheckbox);

			const filenameHeader = document.createElement('th');
			filenameHeader.textContent = 'Filename';

			const pathHeader = document.createElement('th');
			pathHeader.textContent = 'Path';

			const aliasesHeader = document.createElement('th');
			aliasesHeader.textContent = 'Aliases';

			headerRow.appendChild(selectHeader);
			headerRow.appendChild(filenameHeader);
			headerRow.appendChild(pathHeader);
			headerRow.appendChild(aliasesHeader);
			thead.appendChild(headerRow);
			table.appendChild(thead);

			// 表格内容
			const tbody = document.createElement('tbody');

			currentFiles.forEach(file => {
				const row = document.createElement('tr');

				const selectCell = document.createElement('td');
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = file.selected;
				checkbox.disabled = this.isProcessing;
				checkbox.addEventListener('change', (e) => {
					file.selected = (e.target as HTMLInputElement).checked;
					this.updateSelectAllCheckbox();
					this.updateConfirmButton();
					this.updatePagination();
				});
				selectCell.appendChild(checkbox);

				const filenameCell = document.createElement('td');
				filenameCell.textContent = file.filename;
				filenameCell.addClass('filename-cell');

				const pathCell = document.createElement('td');
				pathCell.textContent = file.path;
				pathCell.addClass('path-cell');

				const aliasesCell = document.createElement('td');
				if (file.aliases.length > 0) {
					// 滑动显示别名全部内容
					const aliasesContainer = document.createElement('div');
					aliasesContainer.addClass('aliases-cell-container');
					aliasesContainer.textContent = file.aliases.join(', ');
					aliasesCell.appendChild(aliasesContainer);
				} else {
					aliasesCell.textContent = '-';
					aliasesCell.addClass('no-aliases');
				}

				row.appendChild(selectCell);
				row.appendChild(filenameCell);
				row.appendChild(pathCell);
				row.appendChild(aliasesCell);
				tbody.appendChild(row);
			});

			table.appendChild(tbody);
			fileListDiv.appendChild(table);

			this.updateSelectAllCheckbox();
		}
	}

	/**
	 * 显示进度页面
	 * @param selectedFiles 选中要创建的文件
	 */
	private showProgressPage(selectedFiles: FileToCreate[]): void {
		const {contentEl} = this;

		// 清空当前内容
		contentEl.empty();

		// 进度页面标题
		contentEl.createEl('h2', {text: 'Creating Files'});

		// 创建进度指示器
		const progressContainer = contentEl.createDiv({cls: 'progress-page-container'});

		// 百分比显示
		const percentageDisplay = progressContainer.createDiv({cls: 'percentage-display'});
		percentageDisplay.textContent = '0%';

		// 进度条容器
		const progressBarContainer = progressContainer.createDiv({cls: 'progress-bar-container'});
		const progressBar = progressBarContainer.createDiv({cls: 'progress-bar'});
		progressBar.style.width = '0%';
		progressBar.style.display = 'block';

		// 详细进度文本
		const progressText = progressContainer.createDiv({cls: 'progress-text'});
		progressText.textContent = `Creating files (0/${selectedFiles.length})`;

		// 实时统计容器
		const statsContainer = contentEl.createDiv({cls: 'stats-container'});

		// 统计项
		const createdStat = statsContainer.createDiv({cls: 'stat-item created-stat'});
		createdStat.innerHTML = `<span class="stat-icon">✅</span> Successfully created: <span class="stat-value">0</span>&nbsp; files`;

		const skippedStat = statsContainer.createDiv({cls: 'stat-item skipped-stat'});
		skippedStat.innerHTML = `<span class="stat-icon">⏭️</span> Skipped: <span class="stat-value">0</span>&nbsp; files`;

		const failedStat = statsContainer.createDiv({cls: 'stat-item failed-stat'});
		failedStat.innerHTML = `<span class="stat-icon">❌</span> Failed: <span class="stat-value">0</span>&nbsp; files`;

		const aliasesStat = statsContainer.createDiv({cls: 'stat-item aliases-stat'});
		aliasesStat.innerHTML = `<span class="stat-icon">🏷️</span> Added aliases: <span class="stat-value">0</span>`;

		this.progressElements = {
			percentageDisplay,
			progressBar,
			progressText,
			stats: {
				created: createdStat.querySelector('.stat-value') as HTMLElement,
				skipped: skippedStat.querySelector('.stat-value') as HTMLElement,
				failed: failedStat.querySelector('.stat-value') as HTMLElement,
				aliases: aliasesStat.querySelector('.stat-value') as HTMLElement
			}
		};
	}

	/**
	 * 更新进度页面
	 * @param current 当前进度
	 * @param total 总数
	 * @param result 当前结果统计
	 */
	private updateProgressPage(current: number, total: number, result: CreationResult): void {
		if (!this.progressElements) return;

		const percent = Math.min(100, Math.round((current / total) * 100));

		// 更新百分比
		this.progressElements.percentageDisplay.textContent = `${percent}%`;

		const progressBarElement = this.progressElements.progressBar;
		progressBarElement.style.width = `${percent}%`;
		progressBarElement.style.display = 'block';
		progressBarElement.style.visibility = 'visible';
		progressBarElement.style.zIndex = '10';

		console.log(`Setting progress bar width to ${percent}%`);

		// 更新进度
		this.progressElements.progressText.textContent = `Creating files... (${current}/${total})`;

		// 更新统计数据
		this.progressElements.stats.created.textContent = result.created.toString();
		this.progressElements.stats.skipped.textContent = result.skipped.toString();
		this.progressElements.stats.failed.textContent = result.failed.toString();
		this.progressElements.stats.aliases.textContent = result.aliasesAdded.toString();
	}

	/**
	 * 显示结果摘要
	 */
	private showResult(result: CreationResult): void {
		this.finalResult = result;

		// 如果当前处于进度页面，将进度更新为100%
		if (this.progressElements) {
			this.updateProgressPage(1, 1, result);

			if (this.progressElements.progressText) {
				this.progressElements.progressText.textContent = `File creation completed (${result.created + result.skipped + result.failed}/${result.created + result.skipped + result.failed})`;
			}

			// 延迟10秒自动关闭
			setTimeout(() => {
				this.close();
			}, 10 * 1000);
		} else {
			// 如果不在进度页面，直接关闭
			this.close();
		}
	}

	public setCloseCallback(callback: (result: CreationResult | null) => void): void {
		this.onCloseCallback = callback;
	}

	onOpen(): void {
		const {contentEl} = this;

		// 设置标题
		contentEl.createEl('h2', {text: 'Confirm File Creation'});

		// 只在初始状态显示描述
		if (!this.isProcessing) {
			contentEl.createEl('p', {
				cls: 'description-text',
				text: `${this.params.files.length} links detected. Select files to be created:`
			});
		}

		// 文件列表
		const fileListContainer = contentEl.createDiv({cls: 'file-list-container'});

		// 分页控件
		this.paginationDiv = contentEl.createDiv({cls: 'pagination-container'});

		// 结果显示区域
		this.resultDiv = contentEl.createDiv({cls: 'result-container'});
		this.resultDiv.style.display = 'none';

		// 按钮容器
		const buttonContainer = contentEl.createDiv({cls: 'button-container'});

		// 取消按钮
		this.cancelButton = document.createElement('button');
		this.cancelButton.textContent = 'Cancel';
		this.cancelButton.addEventListener('click', () => {
			if (!this.isProcessing) {
				this.params.onCancel();
				this.close();
			}
		});

		// 确认按钮
		this.confirmButton = document.createElement('button');
		this.confirmButton.textContent = 'Create Selected Files';
		this.confirmButton.addClass('mod-cta');
		this.confirmButton.addEventListener('click', () => {
			if (this.isProcessing) return;

			const selectedFiles = this.params.files.filter(file => file.selected);
			if (selectedFiles.length === 0) {
				new Notice('Please select at least one file');
				return;
			}

			this.isProcessing = true;

			// 显示专门的进度页面，替换当前内容
			this.showProgressPage(selectedFiles);

			const result: CreationResult = {
				created: 0,
				skipped: 0,
				failed: 0,
				aliasesAdded: 0
			};

			// 异步处理文件创建
			(async () => {
				for (let i = 0; i < selectedFiles.length; i++) {
					const file = selectedFiles[i];
					try {
						// 更新进度显示
						this.updateProgressPage(i, selectedFiles.length, result);

						// 创建单个文件
						const success = await this.params.onConfirm([file]);
						if (success) {
							result.created++;
							result.aliasesAdded += file.aliases.length;
						} else {
							result.skipped++;
						}
					} catch (error) {
						console.error(`Failed to create file: ${file.path}`, error);
						result.failed++;
					}

					//更新进度
					this.updateProgressPage(i + 1, selectedFiles.length, result);
				}

				this.showResult(result);
			})();
		});

		buttonContainer.appendChild(this.cancelButton);
		buttonContainer.appendChild(this.confirmButton);

		this.updateFileList();
		this.updatePagination();
		this.updateConfirmButton();

		contentEl.addClass('creation-confirm-modal');

		const modalContainer = contentEl.closest('.modal');
		if (modalContainer) {
			modalContainer.addClass('file-creation-modal-container');
		}
	}

	onClose(): void {
		// 调用关闭回调
		if (this.onCloseCallback) {
			this.onCloseCallback(this.finalResult);
		}

		const {contentEl} = this;
		contentEl.empty();
	}
}

export class UIManager {
	private app: App;
	private settings: CreateFileSettings;

	constructor(app: App, settings: CreateFileSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 显示文件创建确认对话框
	 * @param filesToCreate 待创建的文件列表
	 * @param createFileFn 创建文件的函数
	 * @returns 创建结果的Promise
	 */
	async showCreationConfirmDialog(
		filesToCreate: {
			filename: string,
			path: string,
			aliases: Set<string>
		}[],
		createFileFn: (filePath: string, aliases: string[]) => Promise<boolean>
	): Promise<CreationResult> {
		return new Promise((resolve) => {
			const files: FileToCreate[] = filesToCreate.map((file, index) => ({
				id: `file-${index}`,
				filename: file.filename.split('/').pop() || file.filename,
				path: file.path,
				selected: true,
				aliases: Array.from(file.aliases)
			}));

			// 如果没有文件需要创建——>返回
			if (files.length === 0) {
				resolve({
					created: 0,
					skipped: 0,
					failed: 0,
					aliasesAdded: 0
				});
				return;
			}

			const modal = new CreationConfirmModal({
				app: this.app,
				settings: this.settings,
				files,
				onConfirm: async (selectedFiles) => {
					// 处理单个文件或多个文件
					if (selectedFiles.length === 1) {
						const file = selectedFiles[0];
						try {
							return await createFileFn(file.path, file.aliases);
						} catch (error) {
							console.error(`Failed to create file: ${file.path}`, error);
							return false;
						}
					}
					return false;
				},
				onCancel: () => {
					resolve({
						created: 0,
						skipped: 0,
						failed: 0,
						aliasesAdded: 0,
					});
				}
			});

			// 设置关闭回调，获取最终结果
			modal.setCloseCallback((result) => {
				if (result) {
					resolve(result);
				} else {
					resolve({
						created: 0,
						skipped: 0,
						failed: 0,
						aliasesAdded: 0
					});
				}
			});

			modal.open();
		});
	}

	/**
	 * 进度提示
	 * @param message 提示消息
	 * @param current 当前进度
	 * @param total 总数
	 * @returns Notice实例
	 */
	showProgressNotice(message: string, current: number, total: number): Notice {
		const percent = Math.round((current / total) * 100);
		const progressEmoji = percent < 30 ? '🔍' : (percent < 70 ? '⏳' : '🚀');
		const notice = new Notice(
			`${progressEmoji} ${message} (${current}/${total}, ${percent}%)`,
			0 // 不自动关闭
		);

		if (notice.noticeEl) {
			const progressBar = document.createElement('div');
			progressBar.addClass('notice-progress-bar');
			progressBar.style.width = `${percent}%`;
			progressBar.style.height = '3px';
			progressBar.style.backgroundColor = 'var(--interactive-accent)';
			progressBar.style.position = 'absolute';
			progressBar.style.bottom = '0';
			progressBar.style.left = '0';
			progressBar.style.transition = 'width 0.3s ease';

			notice.noticeEl.style.position = 'relative';
			notice.noticeEl.style.paddingBottom = '5px';
			notice.noticeEl.appendChild(progressBar);
		}

		return notice;
	}

	/**
	 * 更新进度提示
	 * @param notice Notice实例
	 * @param message 提示消息
	 * @param current 当前进度
	 * @param total 总数
	 */
	updateProgressNotice(notice: Notice, message: string, current: number, total: number): void {
		const percent = Math.round((current / total) * 100);
		const progressEmoji = percent < 30 ? '🔍' : (percent < 70 ? '⏳' : '🚀');

		if (notice.noticeEl) {
			// 更新文本
			const textContainer = notice.noticeEl.querySelector('.notice-content') || notice.noticeEl;
			textContainer.textContent = `${progressEmoji} ${message} (${current}/${total}, ${percent}%)`;

			// 更新进度条
			const progressBar = notice.noticeEl.querySelector('.notice-progress-bar') as HTMLElement;
			if (progressBar) {
				progressBar.style.width = `${percent}%`;
			}
		}
	}

	/**
	 * 显示结果摘要通知
	 * @param result 创建结果
	 */
	showResultSummary(result: CreationResult): void {
		if (result.created === 0 && result.skipped === 0 &&
			result.failed === 0 && result.aliasesAdded === 0) {
			return;
		}

		const statusEmoji = result.created > 0 ? '✅' : (result.failed > 0 ? '⚠️' : '📋');

		const message = [
			`${statusEmoji} Operation complete`,
			`📄 Successfully created: ${result.created} files`,
			`⏭️ Skipped: ${result.skipped} files`,
			`${result.failed > 0 ? '❌' : '✓'} Failed: ${result.failed} files`,
			`🏷️ Aliases: ${result.aliasesAdded}`
		].join('\n');

		const notice = new Notice(message, 8000); // 显示8秒

		if (notice.noticeEl) {
			notice.noticeEl.addClass('result-summary-notice');
			notice.noticeEl.style.fontSize = '14px';
			notice.noticeEl.style.lineHeight = '1.5';
			notice.noticeEl.style.maxWidth = '300px';
		}
	}
}
