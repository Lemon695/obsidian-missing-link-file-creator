import { FileCreationRule } from "@/model/rule-types";

export interface CreateFileSettings {
	createFileSetting: string;
	showCreateFileNotification: boolean;
	defaultFolderPath: string;

	addAliasesToFrontmatter: boolean;

	// 模板设置
	useTemplates: boolean;            // 是否使用模板
	defaultTemplatePath: string;      // 默认模板路径
	templateFolder: string;           // 模板文件夹路径
	templaterMethod: 'execute' | 'overwrite' | 'basic';

	// 规则设置
	useRules: boolean;                // 是否使用规则
	rules: FileCreationRule[];        // 文件创建规则

	// 自动标签设置
	autoTagging: boolean;
	autoTaggingMinConfidence: number;

	// Developer options
	debugMode: boolean;

	// 忽略列表
	ignoreList: string[];

	// 仪表盘弹窗高度（CSS 值，如 80vh / 600px）
	dashboardHeight: string;

	// 模块启用状态（opt-out：undefined = 启用）
	moduleEnabled?: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: CreateFileSettings = {
	createFileSetting: 'default',
	showCreateFileNotification: true,
	defaultFolderPath: '',

	addAliasesToFrontmatter: true,

	// 模板默认设置
	useTemplates: false,
	defaultTemplatePath: '',
	templateFolder: '',
	templaterMethod: 'execute',

	// 规则默认设置
	useRules: false,
	rules: [],

	// 自动标签默认设置
	autoTagging: false,
	autoTaggingMinConfidence: 0.7,

	// Developer options
	debugMode: false,

	// 忽略列表
	ignoreList: [],

	dashboardHeight: '80vh',
}
