import {App, Modal, Setting, TFile, Notice} from 'obsidian';
import {CreationModalParams, CreationResult, FileToCreate} from "../model/file-types";

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

			const ruleNameHeader = document.createElement('th');
			ruleNameHeader.textContent = 'Matched Rule';
			ruleNameHeader.addClass('rule-name-column');

			// const actionsHeader = document.createElement('th');
			// actionsHeader.textContent = 'Actions';
			// actionsHeader.addClass('actions-column');

			headerRow.appendChild(selectHeader);
			headerRow.appendChild(filenameHeader);
			headerRow.appendChild(pathHeader);
			headerRow.appendChild(aliasesHeader);
			headerRow.appendChild(ruleNameHeader);
			// headerRow.appendChild(actionsHeader);
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

				const ruleNameCell = document.createElement('td');
				ruleNameCell.addClass('rule-name-cell');
				if (file.matchedRule) {
					ruleNameCell.textContent = file.matchedRule;
				} else {
					ruleNameCell.textContent = '-';
					ruleNameCell.addClass('no-rule-match');
				}

				/**
				// 操作单元格
				const actionsCell = document.createElement('td');
				actionsCell.addClass('actions-cell');

				// 预览按钮
				const previewButton = document.createElement('button');
				previewButton.textContent = 'Preview';
				previewButton.addClass('preview-button');
				previewButton.disabled = this.isProcessing;
				previewButton.addEventListener('click', async () => {
					try {
						if (this.params.onPreview) {
							const fileContent = await this.params.onPreview(file.path, file.aliases, file.templatePath);
							this.showPreviewModal(file.filename, fileContent);
						} else {
							new Notice('Preview function is not available');
						}
					} catch (error) {
						new Notice(`Failed to generate preview: ${error.message}`);
					}
				});
				actionsCell.appendChild(previewButton);*/

				row.appendChild(selectCell);
				row.appendChild(filenameCell);
				row.appendChild(pathCell);
				row.appendChild(aliasesCell);
				row.appendChild(ruleNameCell);
				// row.appendChild(actionsCell);
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

		window.requestAnimationFrame(() => {
			const progressBarElement = this.progressElements!.progressBar;
			progressBarElement.style.width = `${percent}%`;
			progressBarElement.style.display = 'block';
			progressBarElement.style.visibility = 'visible';

			// 强制浏览器重新计算布局
			void progressBarElement.offsetWidth;
		});

		// 更新进度
		this.progressElements.progressText.textContent = `Creating files • ${current} of ${total}`;

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

	// 预览模态框
	private showPreviewModal(filename: string, content: string) {
		const modal = new Modal(this.app);
		modal.titleEl.setText(`Preview: ${filename}`);

		const contentEl = modal.contentEl;
		contentEl.addClass('file-preview-modal');

		const previewContainer = contentEl.createDiv({cls: 'preview-container'});

		// 创建切换按钮组
		const toggleContainer = contentEl.createDiv({cls: 'toggle-container'});
		const renderButton = document.createElement('button');
		renderButton.textContent = 'Preview';
		renderButton.classList.add('active');

		const sourceButton = document.createElement('button');
		sourceButton.textContent = 'Source';

		toggleContainer.appendChild(renderButton);
		toggleContainer.appendChild(sourceButton);

		// 创建预览和源码视图
		const renderView = previewContainer.createDiv({cls: 'render-view'});
		const sourceView = previewContainer.createDiv({cls: 'source-view'});
		sourceView.style.display = 'none';

		// 设置源码视图
		const sourceCodeEl = document.createElement('pre');
		sourceCodeEl.textContent = content;
		sourceView.appendChild(sourceCodeEl);

		// 设置渲染视图 (简单HTML渲染)
		// 使用简单的HTML转换，而不是完整的Markdown渲染
		renderView.innerHTML = this.convertMarkdownToHTML(content);

		// 添加切换逻辑
		renderButton.addEventListener('click', () => {
			renderView.style.display = 'block';
			sourceView.style.display = 'none';
			renderButton.classList.add('active');
			sourceButton.classList.remove('active');
		});

		sourceButton.addEventListener('click', () => {
			renderView.style.display = 'none';
			sourceView.style.display = 'block';
			renderButton.classList.remove('active');
			sourceButton.classList.add('active');
		});

		modal.open();
	}

	// 添加一个简单的Markdown到HTML转换方法
	private convertMarkdownToHTML(markdown: string): string {
		// 这是非常基本的转换，只处理最常见的markdown语法
		let html = markdown
			// 处理标题
			.replace(/^### (.*$)/gim, '<h3>$1</h3>')
			.replace(/^## (.*$)/gim, '<h2>$1</h2>')
			.replace(/^# (.*$)/gim, '<h1>$1</h1>')
			// 处理粗体和斜体
			.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/gim, '<em>$1</em>')
			// 处理链接
			.replace(/\[\[(.*?)\]\]/gim, '<a href="#" class="internal-link">$1</a>')
			.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
			// 处理列表
			.replace(/^\s*\* (.*$)/gim, '<ul><li>$1</li></ul>')
			.replace(/^\s*- (.*$)/gim, '<ul><li>$1</li></ul>')
			.replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
			// 处理引用
			.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
			// 处理代码块和内联代码
			.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			// 处理换行
			.replace(/\n/gim, '<br>');

		return html;
	}

	public setCloseCallback(callback: (result: CreationResult | null) => void): void {
		this.onCloseCallback = callback;
	}

	onOpen(): void {
		const {contentEl} = this;

		// 设置标题
		contentEl.createEl('h2', {text: 'Create Files'});

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
				const batchSize = 5;
				for (let i = 0; i < selectedFiles.length; i += batchSize) {
					const batch = selectedFiles.slice(i, i + batchSize);
					const promises = batch.map(async (file, batchIndex) => {
						try {
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
					});

					await Promise.all(promises);

					// 更新进度
					this.updateProgressPage(Math.min(i + batchSize, selectedFiles.length), selectedFiles.length, result);
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


