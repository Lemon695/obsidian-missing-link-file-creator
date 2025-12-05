/**
 * UI 相关常量定义
 * 集中管理所有 UI 相关的常量，包括 CSS 类名、延迟时间、尺寸等
 */

/**
 * CSS 类名常量
 */
export const CSS_CLASSES = {
    // Suggestion 相关
    SUGGESTION_ITEM: 'ccmd-suggestion-item',
    SUGGESTION_CONTAINER: 'ccmd-suggestion-container',
    SUGGESTION: 'ccmd-suggestion',

    // Tooltip 相关
    PATH_TOOLTIP: 'ccmd-path-tooltip',

    // 状态类
    IS_SELECTED: 'is-selected',
    SHOW: 'show',

    // Modal 相关
    MODAL_CONTAINER: 'ccmd-modal-container',
    QUICK_ADD_MODAL: 'ccmd-quickAddModal',

    // Template 相关
    TEMPLATE_SELECTION_MODAL: 'ccmd-template-selection-modal',
    TEMPLATE_SEARCH_CONTAINER: 'template-search-container',
    TEMPLATE_SEARCH_INPUT: 'ccmd-template-search-input',
    TEMPLATE_LIST: 'ccmd-template-list',
    TEMPLATE_ITEM: 'ccmd-template-item',
    NO_TEMPLATES: 'ccmd-no-templates',

    // Rule 相关
    RULE_EDIT_MODAL: 'ccmd-rule-edit-modal',
    RULE_EDIT_CONTAINER: 'ccmd-rule-edit-container',
    RULE_EDIT_LEFT_PANEL: 'ccmd-rule-edit-left-panel',
    RULE_EDIT_LEFT_PANEL_SCROLL: 'ccmd-rule-edit-left-panel-scroll',
    RULE_EDIT_RIGHT_PANEL: 'ccmd-rule-edit-right-panel',
    RULE_EDIT_BUTTONS: 'ccmd-rule-edit-buttons',
    RULE_SAVE_BUTTON: 'ccmd-rule-save-button',
    RULE_CANCEL_BUTTON: 'ccmd-rule-cancel-button',
} as const;

/**
 * 延迟时间常量（毫秒）
 */
export const DELAYS = {
    /** Tooltip 显示延迟 - 避免鼠标快速划过时闪烁 */
    TOOLTIP_SHOW_MS: 300,

    /** Tooltip 隐藏延迟 - 平滑过渡 */
    TOOLTIP_HIDE_MS: 200,

    /** Modal 样式应用延迟 - 确保 DOM 已渲染 */
    MODAL_STYLE_APPLY_MS: 0,
} as const;

/**
 * 尺寸常量
 */
export const SIZES = {
    // Suggestion 尺寸
    SUGGESTION_MIN_WIDTH: '300px',
    SUGGESTION_MAX_WIDTH: '800px',

    // Modal 尺寸 - CustomModal
    CUSTOM_MODAL_WIDTH: '90vw',
    CUSTOM_MODAL_MAX_WIDTH: '1400px',
    CUSTOM_MODAL_MIN_WIDTH: '600px',

    // Modal 尺寸 - SelectTemplateView
    TEMPLATE_MODAL_WIDTH: '700px',
    TEMPLATE_MODAL_MAX_WIDTH: '90vw',
    TEMPLATE_MODAL_MIN_WIDTH: '600px',
} as const;

/**
 * 位置常量
 */
export const POSITIONS = {
    /** Modal 居中定位 */
    MODAL_CENTER: {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
    },

    /** Tooltip 偏移量（像素） */
    TOOLTIP_OFFSET: 8,
} as const;

/**
 * Popper.js 配置常量
 */
export const POPPER_CONFIG = {
    /** 默认放置位置 */
    DEFAULT_PLACEMENT: 'bottom-end' as const,

    /** 偏移量 [水平, 垂直] */
    DEFAULT_OFFSET: [0, 5] as [number, number],

    /** 边界内边距 */
    BOUNDARY_PADDING: 10,

    /** 备用放置位置 */
    FALLBACK_PLACEMENTS: ['bottom-start', 'top-end', 'top-start'] as const,
} as const;
