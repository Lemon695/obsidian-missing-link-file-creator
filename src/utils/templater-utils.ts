/**
 * Templater 工具函数
 * 类型守卫和辅助函数
 */

import type { TemplaterPlugin } from '../types/templater';

/**
 * 类型守卫：检查 Templater 插件是否已安装
 */
export function hasTemplaterPlugin(app: { plugins: { plugins: Record<string, unknown> } }): boolean {
    return app.plugins.plugins['templater-obsidian'] !== undefined;
}

/**
 * 类型守卫：检查对象是否为 TemplaterPlugin
 */
export function isTemplaterPlugin(plugin: unknown): plugin is TemplaterPlugin {
    return (
        typeof plugin === 'object' &&
        plugin !== null &&
        'templater' in plugin &&
        typeof (plugin as TemplaterPlugin).templater === 'object'
    );
}

/**
 * 安全获取 Templater 插件实例
 */
export function getTemplaterPlugin(app: { plugins: { plugins: Record<string, unknown> } }): TemplaterPlugin | null {
    const plugin = app.plugins.plugins['templater-obsidian'];
    return isTemplaterPlugin(plugin) ? plugin : null;
}
