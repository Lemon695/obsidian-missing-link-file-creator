import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
	// 忽略构建产物、依赖和 codex 测试快照（CJS 格式，不参与 TS 检查）
	{
		ignores: [
			"node_modules/**",
			"dist/**",
			"build/**",
			"main.js",
			".codex-tests/**",
		],
	},

	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: "./tsconfig.json",
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},

	...tseslint.configs.recommended,

	...obsidianmd.configs.recommended,

	// Obsidian 的 TypeScript 类型定义中存在大量 any，
	// no-unsafe-* 规则在此类插件项目里误报率极高，降为警告。
	{
		rules: {
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			// React JSX 属性（onClick/onChange 等）接受 async 函数是合法惯用法
			"@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": { "attributes": false } }],
		},
	},
);
