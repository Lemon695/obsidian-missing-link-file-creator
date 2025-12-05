/**
 * 缓存相关常量定义
 */

/**
 * 缓存持续时间常量（毫秒）
 */
export const CACHE_DURATIONS = {
    /** 模板列表缓存时间 - 1 分钟 */
    TEMPLATE_LIST_MS: 60000,

    /** 模板内容缓存时间 - 5 分钟 */
    TEMPLATE_CONTENT_MS: 300000,

    /** 模板缓存最大条目数 */
    TEMPLATE_CACHE_MAX_ENTRIES: 50,
} as const;
