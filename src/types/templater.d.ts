/**
 * Templater 插件 API 类型定义
 * 基于 Templater v2.x 官方文档
 * 消除 @ts-ignore 指令的需要
 */

import type { TFile, TFolder } from 'obsidian';

/**
 * 扩展 Obsidian App 接口，添加插件访问能力
 */
declare module 'obsidian' {
    interface App {
        plugins: {
            /** 已安装的插件映射 */
            plugins: {
                /** Templater 插件实例 */
                'templater-obsidian'?: TemplaterPlugin;
                /** 其他插件 */
                [pluginId: string]: unknown;
            };
            /** 启用的插件 ID 列表 */
            enabledPlugins?: Set<string>;
        };
    }
}

/**
 * Templater 插件主接口
 */
export interface TemplaterPlugin {
    /** Templater 核心 API */
    templater: TemplaterAPI;
}

/**
 * Templater 核心 API
 */
export interface TemplaterAPI {
    /**
     * 覆写文件命令 - 在现有文件上应用模板
     * @param file 目标文件
     * @returns Promise，完成时解析
     */
    overwrite_file_commands(file: TFile): Promise<void>;

    /**
     * 从模板创建新笔记
     * @param template 模板文件
     * @param folder 目标文件夹（可选）
     * @param filename 文件名（可选）
     * @param openNewNote 是否打开新笔记（可选）
     * @returns 创建的文件
     */
    create_new_note_from_template(
        template: TFile,
        folder?: TFolder,
        filename?: string,
        openNewNote?: boolean
    ): Promise<TFile>;

    /**
     * 解析模板内容
     * @param template 模板文件
     * @param targetFile 目标文件
     * @returns 解析后的内容
     */
    parse_template?(template: TFile, targetFile: TFile): Promise<string>;
}

/**
 * Templater 配置接口
 */
export interface TemplaterSettings {
    /** 模板文件夹路径 */
    templates_folder?: string;
    /** 是否启用系统命令 */
    enable_system_commands?: boolean;
    /** 命令超时时间（毫秒） */
    command_timeout?: number;
}
