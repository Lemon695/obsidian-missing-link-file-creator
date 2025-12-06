import { App, FileSystemAdapter } from "obsidian";
import { log } from "../utils/log-utils";

const IGNORE_LIST_FILENAME = "ignore_list.json";

export class IgnoreListManager {
    private app: App;
    private ignoreList: Set<string> = new Set();
    private loaded: boolean = false;
    private pluginDir: string;

    constructor(app: App, manifest: any) {
        this.app = app;
        this.pluginDir = manifest.dir;
    }

    private getFilePath(): string {
        return `${this.pluginDir}/${IGNORE_LIST_FILENAME}`;
    }

    async loadIgnoreList(): Promise<void> {
        try {
            const path = this.getFilePath();
            if (await this.app.vault.adapter.exists(path)) {
                const content = await this.app.vault.adapter.read(path);
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    this.ignoreList = new Set(data);
                }
            }
            this.loaded = true;
            log.debug(`Loaded ${this.ignoreList.size} items from ignore list.`);
        } catch (error) {
            log.error("Failed to load ignore list:", error);
            // Fallback to empty if failed
            this.ignoreList = new Set();
            this.loaded = true;
        }
    }

    async saveIgnoreList(): Promise<void> {
        try {
            const path = this.getFilePath();
            const data = Array.from(this.ignoreList);
            await this.app.vault.adapter.write(path, JSON.stringify(data, null, 2));
            log.debug("Saved ignore list to disk.");
        } catch (error) {
            log.error("Failed to save ignore list:", error);
        }
    }

    getIgnoreList(): string[] {
        return Array.from(this.ignoreList);
    }

    has(path: string): boolean {
        return this.ignoreList.has(path);
    }

    async add(path: string): Promise<void> {
        if (!this.ignoreList.has(path)) {
            this.ignoreList.add(path);
            await this.saveIgnoreList();
        }
    }

    async remove(path: string): Promise<void> {
        if (this.ignoreList.has(path)) {
            this.ignoreList.delete(path);
            await this.saveIgnoreList();
        }
    }

    async migrateFromSettings(oldList: string[]): Promise<void> {
        if (!oldList || oldList.length === 0) return;

        // Ensure loaded
        if (!this.loaded) await this.loadIgnoreList();

        let changed = false;
        for (const item of oldList) {
            if (!this.ignoreList.has(item)) {
                this.ignoreList.add(item);
                changed = true;
            }
        }

        if (changed) {
            log.debug("Migrated items from legacy settings to separate storage.");
            await this.saveIgnoreList();
        }
    }
}
