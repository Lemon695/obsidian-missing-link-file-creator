/**
 * Obsidian Frontmatter 类型定义
 * 提供精确的类型约束，替代 any 类型
 */

/**
 * Obsidian Frontmatter 核心接口
 * 支持常见字段和自定义属性
 */
export interface ObsidianFrontmatter {
    // 核心元数据字段
    title?: string;
    aliases?: string[] | string;
    tags?: string[] | string;

    // 日期相关字段
    created?: string;
    modified?: string;
    date?: string;

    // 分类和组织
    category?: string | string[];
    categories?: string | string[];
    type?: string;
    status?: string;

    // 作者和来源
    author?: string;
    authors?: string[];
    source?: string;

    // 自定义属性（索引签名）
    // 允许任意字符串键，值可以是基本类型或数组
    [key: string]: string | string[] | number | boolean | undefined;
}

/**
 * 规则匹配上下文
 * 用于规则引擎的 frontmatter 匹配
 */
export interface RuleMatchContext {
    /** 源文件的 frontmatter 数据 */
    frontmatter?: ObsidianFrontmatter;
    /** 源文件路径 */
    sourcePath?: string;
}

/**
 * 标签建议上下文
 * 用于自动标签功能
 */
export interface TagContext {
    /** 文件内容 */
    content?: string;
    /** Frontmatter 数据 */
    frontmatter?: ObsidianFrontmatter;
    /** 源文件路径 */
    sourcePath?: string;
}

/**
 * 类型守卫：检查值是否为字符串数组
 */
export function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * 类型守卫：检查值是否为有效的 frontmatter
 */
export function isValidFrontmatter(value: unknown): value is ObsidianFrontmatter {
    return typeof value === 'object' && value !== null;
}

/**
 * 规范化 aliases 字段为字符串数组
 * 处理 YAML 中的多种格式：字符串、数组
 */
export function normalizeAliases(aliases: string | string[] | undefined): string[] {
    if (!aliases) return [];
    if (typeof aliases === 'string') return [aliases];
    if (isStringArray(aliases)) return aliases;
    return [];
}

/**
 * 规范化 tags 字段为字符串数组
 * 处理 YAML 中的多种格式：字符串、数组
 */
export function normalizeTags(tags: string | string[] | undefined): string[] {
    if (!tags) return [];
    if (typeof tags === 'string') {
        // 处理逗号分隔的标签字符串
        return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    if (isStringArray(tags)) return tags;
    return [];
}

/**
 * 从 frontmatter 中安全获取字符串值
 */
export function getFrontmatterString(
    frontmatter: ObsidianFrontmatter | undefined,
    key: string,
    defaultValue: string = ''
): string {
    if (!frontmatter) return defaultValue;
    const value = frontmatter[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    return defaultValue;
}

/**
 * 从 frontmatter 中安全获取字符串数组值
 */
export function getFrontmatterArray(
    frontmatter: ObsidianFrontmatter | undefined,
    key: string,
    defaultValue: string[] = []
): string[] {
    if (!frontmatter) return defaultValue;
    const value = frontmatter[key];
    if (typeof value === 'string') return [value];
    if (isStringArray(value)) return value;
    return defaultValue;
}
