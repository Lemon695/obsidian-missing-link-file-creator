import type { I18nDict } from '../../locale';

interface TemplateSettingsI18n {
	enableTemplates: { name: string; desc: string };
	defaultTemplate: { name: string; desc: string };
	templateFolder: { name: string; desc: string; placeholder: string };
	templaterMethod: { name: string; desc: string; options: { execute: string; overwrite: string; basic: string } };
}

export const templateSettingsI18n: I18nDict<TemplateSettingsI18n> = {
	zh: {
		enableTemplates: {
			name: '启用模板',
			desc: '创建文件时自动应用模板',
		},
		defaultTemplate: {
			name: '默认模板',
			desc: '无规则指定模板时使用的默认模板文件路径',
		},
		templateFolder: {
			name: '模板文件夹',
			desc: '存放模板文件的目录，用于浏览和选择模板',
			placeholder: '示例：Templates',
		},
		templaterMethod: {
			name: '模板处理方式',
			desc: 'execute = 由 Templater 直接处理；overwrite = 写入后覆盖；basic = 内置变量替换',
			options: { execute: 'execute（Templater 处理）', overwrite: 'overwrite（写入后覆盖）', basic: 'basic（内置替换）' },
		},
	},
	en: {
		enableTemplates: {
			name: 'Enable templates',
			desc: 'Automatically apply a template when creating files',
		},
		defaultTemplate: {
			name: 'Default template',
			desc: 'Template used when no rule specifies one',
		},
		templateFolder: {
			name: 'Template folder',
			desc: 'Folder containing template files, used for browsing and selection',
			placeholder: 'Example: Templates',
		},
		templaterMethod: {
			name: 'Templater method',
			desc: 'execute = Templater processes directly; overwrite = write then overwrite; basic = built-in variable substitution',
			options: { execute: 'execute (Templater)', overwrite: 'overwrite (write then re-process)', basic: 'basic (built-in substitution)' },
		},
	},
};
