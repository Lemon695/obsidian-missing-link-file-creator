/**
 * src/core/module-manager.ts
 *
 * 模块生命周期编排器。
 * 负责注册、加载、卸载功能模块，支持运行时启用/禁用。
 */

import type { PluginModule } from './types';
import type CheckAndCreateMDFilePlugin from '../main';

export class ModuleManager {
	/** 已注册模块（按注册顺序） */
	private readonly registry = new Map<string, PluginModule>();

	/** 当前已加载的模块 ID 集合 */
	private readonly loaded = new Set<string>();

	constructor(private readonly plugin: CheckAndCreateMDFilePlugin) {}

	// ─────────────────────────────────────────────────────────────────────────
	// 注册阶段（插件启动时，loadAll 之前调用）
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * 注册一个模块。同一 ID 不可重复注册。
	 */
	register(module: PluginModule): void {
		if (this.registry.has(module.id)) {
			throw new Error(`[ModuleManager] Module '${module.id}' is already registered.`);
		}
		this.registry.set(module.id, module);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 加载阶段
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * 加载所有已启用的模块（插件 onload 时调用）。
	 */
	async loadAll(): Promise<void> {
		for (const [id, mod] of this.registry) {
			if (this.isEnabled(id)) {
				await this.loadOne(mod);
			}
		}
	}

	/**
	 * 卸载所有已加载的模块（插件 onunload 时调用）。
	 */
	unloadAll(): void {
		// 逆序卸载，保持依赖安全
		const ids = [...this.loaded].reverse();
		for (const id of ids) {
			this.unloadOne(id);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 运行时启用 / 禁用（设置面板切换开关时调用）
	// ─────────────────────────────────────────────────────────────────────────

	async enableModule(id: string): Promise<void> {
		if (!this.registry.has(id)) return;

		this.plugin.settings.moduleEnabled ??= {};
		this.plugin.settings.moduleEnabled[id] = true;
		await this.plugin.saveSettings();

		if (!this.loaded.has(id)) {
			await this.loadOne(this.registry.get(id)!);
		}
	}

	async disableModule(id: string): Promise<void> {
		if (!this.registry.has(id)) return;

		this.plugin.settings.moduleEnabled ??= {};
		this.plugin.settings.moduleEnabled[id] = false;
		await this.plugin.saveSettings();

		this.unloadOne(id);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 查询
	// ─────────────────────────────────────────────────────────────────────────

	/** 获取所有已注册模块（按注册顺序，用于设置面板渲染） */
	getAll(): PluginModule[] {
		return [...this.registry.values()];
	}

	/** 指定模块是否处于启用状态（undefined → 默认启用，opt-out 模型） */
	isEnabled(id: string): boolean {
		const enabled = this.plugin.settings.moduleEnabled?.[id];
		return enabled !== false;
	}

	/** 指定模块是否已加载 */
	isLoaded(id: string): boolean {
		return this.loaded.has(id);
	}

	/** 获取指定模块实例（用于模块间协作） */
	get<T extends PluginModule>(id: string): T | undefined {
		return this.registry.get(id) as T | undefined;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// 私有辅助
	// ─────────────────────────────────────────────────────────────────────────

	private async loadOne(mod: PluginModule): Promise<void> {
		if (this.loaded.has(mod.id)) return;
		try {
			await mod.onload();
			this.loaded.add(mod.id);
		} catch (e) {
			console.error(`[ModuleManager] Failed to load '${mod.id}':`, e);
		}
	}

	private unloadOne(id: string): void {
		if (!this.loaded.has(id)) return;
		const mod = this.registry.get(id);
		if (!mod) return;
		try {
			mod.onunload();
		} catch (e) {
			console.error(`[ModuleManager] Failed to unload '${id}':`, e);
		} finally {
			this.loaded.delete(id);
		}
	}
}
