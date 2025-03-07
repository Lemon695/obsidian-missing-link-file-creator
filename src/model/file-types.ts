import {App} from "obsidian";
import {CreateFileSettings} from "../settings";

// 待创建文件
export interface FileToCreate {
	id: string;         // 唯一标识
	filename: string;   // 文件名
	path: string;       // 完整路径
	selected: boolean;  // 是否选中
	aliases: string[];  // 别名列表
	templatePath?: string;
}

export interface CreationModalParams {
	app: App;
	settings: CreateFileSettings;
	files: FileToCreate[];
	onConfirm: (selectedFiles: FileToCreate[]) => Promise<boolean | { success: boolean; message?: string }>;
	onCancel: () => void;
}

// 文件创建-结果
export interface CreationResult {
	created: number;    // 成功创建的文件数
	skipped: number;    // 跳过的文件数
	failed: number;     // 失败的文件数
	aliasesAdded: number; // 添加的别名数
}
