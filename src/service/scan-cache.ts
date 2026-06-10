/**
 * ScanCache — 增量扫描缓存层
 *
 * 维护「文件路径 → 该文件贡献的缺失链接 Set」映射。
 * 通过监听 vault:modify 事件，在文件修改时仅失效单个文件的缓存，
 * 而不需要重新全量扫描。
 */

import { App, TFile } from 'obsidian';
import type { MissingLinkData } from '@/utils/file-operations';

export class ScanCache {
	/** 文件路径 → (链接 key → 该文件贡献的出现次数) */
	private readonly perFile = new Map<string, Map<string, number>>();

	/** 全局合并后的缺失链接 Map（key → MissingLinkData） */
	private readonly merged = new Map<string, MissingLinkData>();

	/** 哪些文件已扫描过（缓存有效） */
	private readonly scanned = new Set<string>();

	/** 全量扫描是否已完成 */
	private fullScanDone = false;

	/** vault:modify 事件的取消注册函数 */
	private unregisterModify: (() => void) | null = null;

	constructor(private readonly app: App) {}

	/**
	 * 开始监听 vault:modify 事件
	 */
	startListening(): void {
		const handler = (file: TFile) => {
			this.invalidate(file.path);
		};
		// vault.on('modify') 的 TypeScript 重载未在部分 Obsidian 版本中公开，
		// 使用 any 绕过类型检查（与 useObsidianEvent.ts 中的做法一致）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ref = (this.app.vault as any).on('modify', handler);
		this.unregisterModify = () => this.app.vault.offref(ref);
	}

	/**
	 * 停止监听，清理资源
	 */
	stopListening(): void {
		this.unregisterModify?.();
		this.unregisterModify = null;
	}

	/**
	 * 将全量扫描结果写入缓存
	 */
	setFullScan(results: Map<string, MissingLinkData>): void {
		this.merged.clear();
		this.perFile.clear();
		this.scanned.clear();

		for (const [key, data] of results.entries()) {
			this.merged.set(key, data);
			// 全量扫描时无法得知每个源文件的精确贡献量（结果已合并），
			// 记录 1/file 作为近似值，用于后续 updateFile 移除时的参考。
			for (const src of data.sourceFiles) {
				if (!this.perFile.has(src)) {
					this.perFile.set(src, new Map());
				}
				this.perFile.get(src)!.set(key, 1);
			}
		}

		// 所有已知来源文件标记为已扫描
		for (const src of this.perFile.keys()) {
			this.scanned.add(src);
		}

		this.fullScanDone = true;
	}

	/**
	 * 更新单个文件的扫描结果（增量更新）
	 * @param filePath 被扫描的文件路径
	 * @param contributed 该文件贡献的缺失链接 Map
	 */
	updateFile(filePath: string, contributed: Map<string, MissingLinkData>): void {
		// 移除该文件之前贡献的所有链接（用真实贡献量，而非硬编码 -1）
		const oldContribs = this.perFile.get(filePath) ?? new Map<string, number>();
		for (const [key, oldCount] of oldContribs) {
			const data = this.merged.get(key);
			if (!data) continue;
			data.sourceFiles.delete(filePath);
			data.occurrenceCount = Math.max(0, data.occurrenceCount - oldCount);
			if (data.sourceFiles.size === 0) {
				this.merged.delete(key);
			}
		}
		this.perFile.delete(filePath);

		// 写入新贡献，同时记录精确的贡献量供下次 updateFile 使用
		const newContribs = new Map<string, number>();
		for (const [key, data] of contributed.entries()) {
			newContribs.set(key, data.occurrenceCount);
			const existing = this.merged.get(key);
			if (existing) {
				for (const src of data.sourceFiles) existing.sourceFiles.add(src);
				existing.occurrenceCount += data.occurrenceCount;
				for (const alias of data.aliases) existing.aliases.add(alias);
			} else {
				this.merged.set(key, { ...data, sourceFiles: new Set(data.sourceFiles), aliases: new Set(data.aliases) });
			}
		}

		this.perFile.set(filePath, newContribs);
		this.scanned.add(filePath);
	}

	/**
	 * 失效某个文件的缓存（修改时调用）
	 */
	invalidate(filePath: string): void {
		this.scanned.delete(filePath);
		// 不立即移除 merged 数据，等下次 updateFile 时清理
	}

	/**
	 * 返回全局合并的缺失链接 Map（只读）
	 */
	getAll(): ReadonlyMap<string, MissingLinkData> {
		return this.merged;
	}

	/**
	 * 全量扫描是否已完成
	 */
	isFullScanDone(): boolean {
		return this.fullScanDone;
	}

	/**
	 * 某个文件的缓存是否有效
	 */
	isFileScanned(filePath: string): boolean {
		return this.scanned.has(filePath);
	}

	/**
	 * 清空全部缓存
	 */
	clear(): void {
		this.perFile.clear();
		this.merged.clear();
		this.scanned.clear();
		this.fullScanDone = false;
	}

	/**
	 * 缺失链接总数（当前 merged Map 的大小）
	 */
	get totalMissingCount(): number {
		return this.merged.size;
	}
}
