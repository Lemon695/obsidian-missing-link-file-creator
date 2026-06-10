import { App } from 'obsidian';
import { log } from '../utils/log-utils';

const HISTORY_FILENAME = 'creation_history.json';
const MAX_HISTORY_ENTRIES = 100;

export interface HistoryEntry {
	timestamp: number;  // Unix ms
	filePath: string;
	ruleName?: string;  // undefined = default (no rule)
	sourcePath?: string;
}

export class HistoryManager {
	private app: App;
	private pluginDir: string;
	private entries: HistoryEntry[] = [];
	private loaded = false;

	constructor(app: App, manifest: { dir?: string }) {
		this.app = app;
		this.pluginDir = manifest.dir ?? '';
	}

	private getFilePath(): string {
		return `${this.pluginDir}/${HISTORY_FILENAME}`;
	}

	async load(): Promise<void> {
		try {
			const path = this.getFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const content = await this.app.vault.adapter.read(path);
				const data = JSON.parse(content);
				if (Array.isArray(data)) {
					this.entries = data as HistoryEntry[];
				}
			}
			this.loaded = true;
			log.debug(`Loaded ${this.entries.length} history entries`);
		} catch (error) {
			log.error('Failed to load creation history:', error);
			this.entries = [];
			this.loaded = true;
		}
	}

	private async save(): Promise<void> {
		try {
			const path = this.getFilePath();
			await this.app.vault.adapter.write(path, JSON.stringify(this.entries, null, 2));
		} catch (error) {
			log.error('Failed to save creation history:', error);
		}
	}

	async record(entry: Omit<HistoryEntry, 'timestamp'>): Promise<void> {
		if (!this.loaded) await this.load();
		this.entries.unshift({ ...entry, timestamp: Date.now() });
		if (this.entries.length > MAX_HISTORY_ENTRIES) {
			this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
		}
		await this.save();
	}

	getEntries(): HistoryEntry[] {
		return [...this.entries];
	}

	async clear(): Promise<void> {
		this.entries = [];
		await this.save();
	}
}
