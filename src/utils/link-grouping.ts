import type { FileToCreate } from "../model/file-types";

/**
 * 缺失链接分组结果。
 * - matched：已命中规则且本次尚未创建
 * - unmatched：未命中任何规则且本次尚未创建（待指定目录/模板）
 * - created：本次已创建（path 命中 createdPaths）
 */
export interface MissingLinkGroups {
	matched: FileToCreate[];
	unmatched: FileToCreate[];
	created: FileToCreate[];
}

/**
 * 把待创建文件按「已匹配规则 / 待指定 / 本次已创建」三段分组。
 *
 * 判据：
 *   1. 若 file.path 在 createdPaths 中 → created（优先级最高）
 *   2. 否则存在 matchedRule → matched
 *   3. 否则 → unmatched
 *
 * 纯函数：是（不 mutate 入参，返回全新数组）。
 *
 * @param files 待创建文件列表
 * @param createdPaths 本次已创建的文件路径集合（默认空集，即不标记 created）
 */
export function groupMissingLinks(
	files: FileToCreate[],
	createdPaths: Set<string> = new Set<string>()
): MissingLinkGroups {
	const matched: FileToCreate[] = [];
	const unmatched: FileToCreate[] = [];
	const created: FileToCreate[] = [];

	for (const file of files) {
		if (createdPaths.has(file.path)) {
			created.push(file);
		} else if (file.matchedRule) {
			matched.push(file);
		} else {
			unmatched.push(file);
		}
	}

	return { matched, unmatched, created };
}
