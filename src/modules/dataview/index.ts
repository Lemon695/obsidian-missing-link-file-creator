/**
 * DataviewModule — missing-links 代码块处理器
 *
 * 注册 ```missing-links``` 代码块。
 * 渲染当前文件中所有缺失的 wiki 链接，以无序列表形式展示，
 * 每条链接旁附有「创建」操作链接。
 *
 * 代码块语法：
 * ```missing-links
 * ```
 *
 * 可选参数（代码块 body，每行一个 key=value）：
 *   scope=vault      — 展示全库缺失链接（默认：当前文件）
 */

import { MarkdownPostProcessorContext } from 'obsidian';
import type { PluginModule } from '../../core/types';
import type CheckAndCreateMDFilePlugin from '../../main';
import { t } from '../../i18n/locale';
import { dataviewModuleI18n } from '../../i18n/modules/dataview/module';
import { log } from '../../utils/log-utils';

const BLOCK_NAME = 'missing-links';

export class DataviewModule implements PluginModule {
	readonly id = 'dataview';
	readonly name = t(dataviewModuleI18n).name;
	readonly description = t(dataviewModuleI18n).description;

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	onload(): void {
		this.plugin.registerMarkdownCodeBlockProcessor(
			BLOCK_NAME,
			(source, el, ctx) => this.render(source, el, ctx)
		);
		log.debug('[DataviewModule] loaded');
	}

	onunload(): void {}

	// ─────────────────────────────────────────────────────────────────────────

	private async render(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		// Parse options from block body
		const params = this.parseParams(source);
		const scopeVault = params.scope === 'vault';

		const container = el.createDiv({ cls: 'ccmd-dataview-block' });

		try {
			const missingLinks = await this.plugin.fileOperations.scanVaultForMissingLinks();

			let items = Array.from(missingLinks.values());

			if (!scopeVault) {
				// Filter to current file only
				const currentPath = ctx.sourcePath;
				items = items.filter(d => d.sourceFiles.has(currentPath));
			}

			if (items.length === 0) {
				container.createEl('p', {
					text: t('dashboardAllClearTitle'),
					cls: 'ccmd-dataview-empty',
				});
				return;
			}

			const ul = container.createEl('ul', { cls: 'ccmd-dataview-list' });

			for (const data of items) {
				const displayName = data.filePath.split('/').pop() || data.filePath;
				const li = ul.createEl('li', { cls: 'ccmd-dataview-item' });

				li.createEl('span', {
					text: `[[${displayName}]]`,
					cls: 'ccmd-dataview-link',
				});

				li.createEl('span', { text: ' ' });

				const createBtn = li.createEl('a', {
					text: t('sideViewCreateTooltip'),
					cls: 'ccmd-dataview-create',
					href: '#',
				});

				// eslint-disable-next-line @typescript-eslint/no-misused-promises
				createBtn.addEventListener('click', async (e) => {
					e.preventDefault();
					const sourceFile = this.plugin.app.workspace.getActiveFile();
					await this.plugin.fileOperations.createSingleFileFromLink(
						data.filePath,
						sourceFile?.path
					);
				});
			}
		} catch (err) {
			container.createEl('p', {
				text: t('dashboardScanError', { message: String(err) }),
				cls: 'ccmd-dataview-error',
			});
		}
	}

	private parseParams(source: string): Record<string, string> {
		const params: Record<string, string> = {};
		for (const line of source.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx > 0) {
				const key = trimmed.substring(0, eqIdx).trim();
				const value = trimmed.substring(eqIdx + 1).trim();
				params[key] = value;
			}
		}
		return params;
	}
}
