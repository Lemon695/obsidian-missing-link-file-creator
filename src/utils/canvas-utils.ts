/**
 * canvas-utils.ts — Obsidian Canvas 文件工具
 *
 * Canvas 文件是 JSON 格式，结构如下：
 * {
 *   "nodes": [
 *     { "id": "...", "type": "text", "text": "内容，可包含 [[wiki链接]]" },
 *     { "id": "...", "type": "file", "file": "path/to/file.md" },
 *     ...
 *   ],
 *   "edges": [...]
 * }
 *
 * 本工具提取所有 text 节点中的 [[wikilink]] 引用。
 */

interface CanvasNode {
	id: string;
	type: string;
	text?: string;
	file?: string;
}

interface CanvasData {
	nodes?: CanvasNode[];
	edges?: unknown[];
}

/**
 * 从 Canvas JSON 字符串中提取所有文本节点的内容（拼接为换行分隔的字符串）。
 * 调用方可将返回的字符串传入 extractMDLinks() 进行链接解析。
 *
 * @param canvasJson Canvas 文件的原始 JSON 字符串
 * @returns 所有 text 节点内容的拼接字符串；解析失败返回空字符串
 */
export function extractCanvasTextContent(canvasJson: string): string {
	let data: CanvasData;
	try {
		data = JSON.parse(canvasJson) as CanvasData;
	} catch {
		return '';
	}

	if (!Array.isArray(data.nodes)) return '';

	const lines: string[] = [];
	for (const node of data.nodes) {
		if (node.type === 'text' && typeof node.text === 'string' && node.text.length > 0) {
			lines.push(node.text);
		}
	}

	return lines.join('\n');
}
