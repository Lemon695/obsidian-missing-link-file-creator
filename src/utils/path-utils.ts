import {LogUtils} from "./log-utils";
import {CreateFileSettings} from "../settings";

/**
 * 将相对路径解析为绝对路径
 * @param filePath 要解析的文件路径
 * @param basePath 基准路径
 * @returns 解析后的完整路径
 */
export function resolveFilePath(filePath: string, basePath: string, settings?: CreateFileSettings): string {
	if (settings?.debugMode) {
		LogUtils.showDebugLog(() => `Resolving file path. Input: ${filePath}, Base: ${basePath}`, { debugMode: settings.debugMode });
	}

	// 如果文件路径已经是绝对路径，直接返回
	if (filePath.startsWith('/')) {
		if (settings?.debugMode) {
			LogUtils.showDebugLog(() => `Absolute path detected, returning: ${filePath}`, { debugMode: settings.debugMode });
		}
		return filePath;
	}

	// 处理 "../" 和 "./" 相对路径
	const segments = filePath.split('/');
	const baseSegments = basePath.split('/');

	for (const segment of segments) {
		if (segment === '..') {
			// 如果是 ".."，则移除上一级目录
			baseSegments.pop();
		} else if (segment !== '.') {
			// 非 "." 的段直接添加
			baseSegments.push(segment);
		}
	}

	// 返回解析后的完整路径
	const result = baseSegments.join('/');
	if (settings?.debugMode) {
		LogUtils.showDebugLog(() => `Resolved path: ${result}`, { debugMode: settings.debugMode });
	}
	return result;
}


