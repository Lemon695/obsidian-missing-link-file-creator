import {App, Modal, Notice} from "obsidian";
import {CreationConfirmModal} from "./creation-confirm-modal";
import {CreationResult, FileToCreate} from "../model/file-types";
import {TemplateAliasHandling} from "../model/rule-types";
import {FileOperations} from "../utils/file-operations";
import {CreateFileSettings} from "../settings/settings";
import {t} from "../i18n/locale";

export class UIManager {
	private app: App;
	private settings: CreateFileSettings;
	private fileOperations: FileOperations;

	constructor(app: App, settings: CreateFileSettings, fileOperations: FileOperations) {
		this.app = app;
		this.settings = settings;
		this.fileOperations = fileOperations;
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
			aliases: Set<string>,
			templatePath?: string,
			matchedRule?: string,
			templateAliasHandling?: TemplateAliasHandling
		}[],
		createFileFn: (filePath: string, aliases: string[], templatePath?: string, templateAliasHandling?: TemplateAliasHandling) => Promise<{
			success: boolean,
			message?: string
		}>
	): Promise<CreationResult> {
		return new Promise((resolve) => {
			const files: FileToCreate[] = filesToCreate.map((file, index) => ({
				id: `file-${index}`,
				filename: file.filename.split('/').pop() || file.filename,
				path: file.path,
				selected: true,
				aliases: Array.from(file.aliases),
				templatePath: file.templatePath,
				matchedRule: file.matchedRule,
				templateAliasHandling: file.templateAliasHandling
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
					if (selectedFiles.length === 1) {
						const file = selectedFiles[0];
						try {
							return await createFileFn(file.path, file.aliases, file.templatePath, file.templateAliasHandling);
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
				},
				// 添加预览功能的回调
				onPreview: async (filePath, aliases, templatePath) => {
					const template = templatePath || '';
					return await this.fileOperations.previewFileContent(template, filePath, aliases);
				}
			});

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
			`${progressEmoji} ${message} (${current}/${total}, ${percent}%)`, 0
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
			`${statusEmoji} ${t('operationComplete')}`,
			`📄 ${t('successfullyCreated', {count: result.created.toString()})}`,
			`⏭️ ${t('skipped', {count: result.skipped.toString()})}`,
			`${result.failed > 0 ? '❌' : '✓'} ${t('failed', {count: result.failed.toString()})}`,
			`🏷️ ${t('aliases', {count: result.aliasesAdded.toString()})}`
		].join('\n');

		const notice = new Notice(message, 10000); // 显示10秒,自动消失显示框

		if (notice.noticeEl) {
			notice.noticeEl.addClass('result-summary-notice');
			notice.noticeEl.style.fontSize = '14px';
			notice.noticeEl.style.lineHeight = '1.5';
			notice.noticeEl.style.maxWidth = '300px';
		}
	}

	// 显示批量重命名对话框
	showBulkRenameDialog(files: { path: string, newName?: string }[]): Promise<{
		success: number,
		failed: number,
		updated: number
	}> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText(t('bulkRenameFiles'));

			const contentEl = modal.contentEl;
			contentEl.addClass('bulk-rename-modal');

			const form = contentEl.createEl('form');
			form.addClass('bulk-rename-form');

			// 创建表格
			const table = form.createEl('table');
			table.addClass('rename-table');

			// 表头
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', {text: t('currentPath')});
			headerRow.createEl('th', {text: t('newPath')});

			// 表体
			const tbody = table.createEl('tbody');
			const rows: { element: HTMLElement, oldPath: string, newPathInput: HTMLInputElement }[] = [];

			files.forEach(file => {
				const row = tbody.createEl('tr');

				const oldPathCell = row.createEl('td');
				oldPathCell.setText(file.path);

				const newPathCell = row.createEl('td');
				const newPathInput = newPathCell.createEl('input', {
					attr: {
						type: 'text',
						value: file.newName || file.path,
						placeholder: t('newPathPlaceholder')
					}
				});

				rows.push({
					element: row,
					oldPath: file.path,
					newPathInput
				});
			});

			// 批量操作
			const batchContainer = form.createDiv({cls: 'batch-operations'});

			// 批量替换
			const batchReplaceContainer = batchContainer.createDiv({cls: 'batch-replace'});
			batchReplaceContainer.createEl('label', {text: t('batchReplace')});

			const findInput = batchReplaceContainer.createEl('input', {
				attr: {
					type: 'text',
					placeholder: t('find')
				}
			});

			const replaceInput = batchReplaceContainer.createEl('input', {
				attr: {
					type: 'text',
					placeholder: t('replaceWith')
				}
			});

			const replaceButton = batchReplaceContainer.createEl('button', {
				text: t('apply'),
				attr: {
					type: 'button'
				}
			});

			// 批量替换按钮点击处理
			replaceButton.addEventListener('click', () => {
				const findText = findInput.value;
				const replaceText = replaceInput.value;

				if (findText) {
					for (const row of rows) {
						const oldValue = row.newPathInput.value;
						const newValue = oldValue.replace(new RegExp(findText, 'g'), replaceText);
						row.newPathInput.value = newValue;
					}
				}
			});

			// 按钮区域
			const buttonContainer = form.createDiv({cls: 'ccmd-button-container'});

			const cancelButton = buttonContainer.createEl('button', {
				text: t('cancel'),
				attr: {
					type: 'button'
				}
			});

			const confirmButton = buttonContainer.createEl('button', {
				text: t('confirmRename'),
				attr: {
					type: 'button',
					class: 'mod-cta'
				}
			});

			// 取消按钮点击处理
			cancelButton.addEventListener('click', () => {
				modal.close();
				resolve({success: 0, failed: 0, updated: 0});
			});

			// 确认按钮点击处理
			confirmButton.addEventListener('click', async () => {
				const renamePairs = rows
					.filter(row => row.oldPath !== row.newPathInput.value)
					.map(row => ({
						oldPath: row.oldPath,
						newPath: row.newPathInput.value
					}));

				modal.close();

				if (renamePairs.length > 0) {
					const fileOps = new FileOperations({
						app: this.app,
						settings: this.settings
					});

					const result = await fileOps.bulkRenameFiles(renamePairs);
					resolve(result);
				} else {
					resolve({success: 0, failed: 0, updated: 0});
				}
			});

			modal.open();
		});
	}

}
