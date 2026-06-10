/**
 * src/core/types.ts — 单一信息源
 *
 * 包含：
 *   - PluginModule 接口（模块契约）
 *   - 领域模型重导出（保持向后兼容）
 *
 * 注：设置结构（PluginSettings）将在 Phase 4 迁移完成后迁移到此处。
 * 当前阶段各模块仍通过 plugin.settings（CreateFileSettings）读写设置。
 */

// ─────────────────────────────────────────────────────────────────────────────
// Module 接口
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 所有功能模块必须实现的契约接口。
 *
 * 生命周期：
 *   register()  → loadAll() → onload()  （启动时）
 *   disableModule() → onunload()         （运行时禁用）
 *   plugin.onunload() → unloadAll()      （插件卸载）
 *
 * 资源清理规则：
 *   - plugin.addCommand / registerEvent / registerView → Obsidian 自动清理，onunload 无需处理
 *   - setTimeout / setInterval / 手动 addEventListener / DOM 注入 → 必须在 onunload 中手动清理
 */
export interface PluginModule {
	/** 模块唯一标识，用作设置键和命令 ID 前缀 */
	readonly id: string;

	/** 设置面板中显示的模块名称 */
	readonly name: string;

	/** 设置面板中显示的模块描述 */
	readonly description: string;

	/**
	 * 模块激活时调用。
	 * 在此注册命令、事件监听、视图、Markdown 后处理器等。
	 * 可返回 Promise（异步初始化）或 void。
	 */
	onload(): Promise<void> | void;

	/**
	 * 模块停用时调用（运行时禁用 或 插件卸载）。
	 * 必须同步执行。
	 * 只需手动清理 Obsidian 不会自动清理的资源（定时器、手动事件、DOM）。
	 */
	onunload(): void;

	/**
	 * 可选：向统一设置面板注入模块专属 UI。
	 * 使用 Obsidian Setting API 构建 UI，不使用 React（保持设置面板轻量）。
	 */
	renderSettings?(containerEl: HTMLElement): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 领域模型重导出（便于从 core/types 统一导入）
// ─────────────────────────────────────────────────────────────────────────────

export type { FileCreationRule, RuleMatchResult } from '../model/rule-types';
export { TemplateAliasHandling } from '../model/rule-types';
export type { MatchCondition } from '../model/condition-types';
export { ConditionOperator, ConditionMatchType } from '../model/condition-types';
export type { FileToCreate, CreationResult, CreationModalParams } from '../model/file-types';
