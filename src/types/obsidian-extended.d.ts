/**
 * Extended type definitions for Obsidian API
 * Eliminates the need for @ts-ignore and provides strict typing
 */

import type { TFile, CachedMetadata, Workspace, Vault, SearchComponent as ObsidianSearchComponent } from 'obsidian';

declare module 'obsidian' {
    interface SearchComponent {
        containerEl: HTMLElement;
        inputEl: HTMLInputElement;
    }
}

/**
 * 扩展全局 Console 接口
 * 支持 Chrome DevTools 样式化日志 API
 */
declare global {
    interface Console {
        /**
         * 输出日志消息，支持 CSS 样式
         * @param message 消息内容，可使用 %c 占位符
         * @param optionalParams CSS 样式字符串或其他参数
         */
        log(message?: unknown, ...optionalParams: unknown[]): void;

        /**
         * 输出警告消息，支持 CSS 样式
         */
        warn(message?: unknown, ...optionalParams: unknown[]): void;

        /**
         * 输出错误消息，支持 CSS 样式
         */
        error(message?: unknown, ...optionalParams: unknown[]): void;

        /**
         * 输出调试消息，支持 CSS 样式
         */
        debug(message?: unknown, ...optionalParams: unknown[]): void;

        /**
         * 输出信息消息，支持 CSS 样式
         */
        info(message?: unknown, ...optionalParams: unknown[]): void;
    }
}

/**
 * Plugin-specific type definitions
 */

// File creation result with detailed status
export interface FileCreationResult {
    success: boolean;
    message?: string;
    filePath?: string;
    skipped?: boolean;
    aliasesAdded?: number;
}

// Batch creation statistics
export interface BatchCreationStats {
    created: number;
    skipped: number;
    failed: number;
    aliasesAdded: number;
    errors?: Array<{ path: string; error: string }>;
}

// Template processing configuration
export interface TemplateProcessConfig {
    templatePath: string;
    targetPath: string;
    variables: Record<string, string>;
    mode: 'execute' | 'overwrite' | 'basic';
    aliasHandling?: 'skip' | 'merge';
}

// UI Modal configuration
export interface ModalConfig {
    width?: string;
    height?: string;
    title?: string;
    showCloseButton?: boolean;
}

// Progress notification configuration
export interface ProgressConfig {
    message: string;
    current: number;
    total: number;
    showPercentage?: boolean;
}
