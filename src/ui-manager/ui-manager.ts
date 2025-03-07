import {App, Notice} from "obsidian";
import {CreateFileSettings} from "../settings";
import {CreationConfirmModal} from "./creation-confirm-modal";
import {CreationResult, FileToCreate} from "../model/file-types";

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
			aliases: Set<string>,
			templatePath?: string
		}[],
		createFileFn: (filePath: string, aliases: string[], templatePath?: string) => Promise<{
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
				templatePath: file.templatePath
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
							return await createFileFn(file.path, file.aliases, file.templatePath);
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
			`${statusEmoji} Operation complete`,
			`📄 Successfully created: ${result.created} files`,
			`⏭️ Skipped: ${result.skipped} files`,
			`${result.failed > 0 ? '❌' : '✓'} Failed: ${result.failed} files`,
			`🏷️ Aliases: ${result.aliasesAdded}`
		].join('\n');

		const notice = new Notice(message, 10000); // 显示10秒,自动消失显示框

		if (notice.noticeEl) {
			notice.noticeEl.addClass('result-summary-notice');
			notice.noticeEl.style.fontSize = '14px';
			notice.noticeEl.style.lineHeight = '1.5';
			notice.noticeEl.style.maxWidth = '300px';
		}
	}
}
