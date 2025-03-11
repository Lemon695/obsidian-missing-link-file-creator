import {App, TFile} from 'obsidian';
import {log} from "../utils/log-utils";

export interface TagLinkAnalysisResult {
	suggestedName: string;
	relevance: number; // 相关性评分 (0-100)
	relatedTags: string[];
	relatedLinks: string[];
	suggestedTemplate?: string;
}

export class TagLinkAnalyzer {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 分析文件中的标签和链接，提供相关性建议
	 */
	async analyzeFile(file: TFile): Promise<TagLinkAnalysisResult[]> {
		const results: TagLinkAnalysisResult[] = [];
		try {
			// 获取文件内容
			const content = await this.app.vault.read(file);

			// 提取标签
			const tags = this.extractTags(content);

			// 提取链接
			const links = this.extractLinks(content);

			// 获取vault中所有标签的使用情况
			const tagUsage = await this.getTagUsageStats();

			// 分析文件中尚未创建的链接
			for (const link of links) {
				if (!this.isLinkResolved(link)) {
					// 计算该链接与文件中各标签的相关性
					const tagRelevance = this.calculateTagRelevance(link, tags, tagUsage);

					// 找到最相关的标签
					const relatedTags = Object.entries(tagRelevance)
						.sort((a, b) => b[1] - a[1])
						.slice(0, 3)
						.map(entry => entry[0]);

					// 计算总体相关性评分
					const relevanceScore = relatedTags.length > 0
						? Math.min(100, Math.round(relatedTags.reduce((sum, tag) => sum + tagRelevance[tag], 0) / relatedTags.length * 100))
						: 0;

					// 查找可能的相关链接
					const relatedLinks = this.findRelatedLinks(link, tagRelevance);

					// 建议使用的模板 (基于相关标签)
					const suggestedTemplate = await this.suggestTemplate(relatedTags);

					results.push({
						suggestedName: link,
						relevance: relevanceScore,
						relatedTags,
						relatedLinks,
						suggestedTemplate
					});
				}
			}

			// 按相关性排序
			results.sort((a, b) => b.relevance - a.relevance);

		} catch (error) {
			log.error(`Error analyzing file: ${error}`);
		}

		return results;
	}

	private extractTags(content: string): string[] {
		const tags: string[] = [];
		// 匹配标签 (#tag)
		const tagRegex = /#([a-zA-Z0-9_\-/]+)/g;
		let match;
		while (match = tagRegex.exec(content)) {
			tags.push(match[1]);
		}

		// 提取 YAML frontmatter 中的标签
		const frontmatterMatch = content.match(/^---\s*([\s\S]*?)\s*---/);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1];
			const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]*)\]/);
			if (tagsMatch) {
				// 解析数组格式的标签
				const tagList = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
				tags.push(...tagList);
			} else {
				// 解析列表格式的标签
				const tagListMatch = frontmatter.match(/tags:\s*\n([\s\S]*?)(?:\n\w|$)/);
				if (tagListMatch) {
					const tagListText = tagListMatch[1];
					const tagListRegex = /\s*-\s*["']?([^"'\n]*)["']?/g;
					let tagMatch;
					while (tagMatch = tagListRegex.exec(tagListText)) {
						tags.push(tagMatch[1].trim());
					}
				}
			}
		}

		return [...new Set(tags)]; // 去重
	}

	private extractLinks(content: string): string[] {
		const links: string[] = [];
		// 匹配 [[link]] 或 [[link|alias]]
		const linkRegex = /\[\[((?:[^\[\]]|\\.)+?)(?:\|(?:[^\[\]]|\\.)+?)?\]\]/g;
		let match;
		while (match = linkRegex.exec(content)) {
			const link = match[1].split('#')[0].split('|')[0].trim();
			if (link) links.push(link);
		}
		return [...new Set(links)]; // 去重
	}

	private isLinkResolved(link: string): boolean {
		return !!this.app.metadataCache.getFirstLinkpathDest(link, '');
	}

	private async getTagUsageStats(): Promise<Record<string, number>> {
		const stats: Record<string, number> = {};
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache) {
				// 处理标签
				if (cache.tags) {
					for (const tagObj of cache.tags) {
						const tag = tagObj.tag.substring(1); // 移除 # 前缀
						stats[tag] = (stats[tag] || 0) + 1;
					}
				}

				// 处理 frontmatter 标签
				if (cache.frontmatter && cache.frontmatter.tags) {
					const fmTags = Array.isArray(cache.frontmatter.tags)
						? cache.frontmatter.tags
						: [cache.frontmatter.tags];

					for (const tag of fmTags) {
						stats[tag] = (stats[tag] || 0) + 1;
					}
				}
			}
		}

		return stats;
	}

	private calculateTagRelevance(link: string, fileTags: string[], tagUsage: Record<string, number>): Record<string, number> {
		const relevance: Record<string, number> = {};
		const linkWords = this.tokenize(link);

		for (const tag of fileTags) {
			const tagWords = this.tokenize(tag);

			// 计算词汇重叠
			let overlap = 0;
			for (const word of linkWords) {
				if (tagWords.includes(word)) {
					overlap++;
				}
			}

			// 计算相关性得分 (考虑标签在vault中的使用频率)
			const tagFrequency = tagUsage[tag] || 1;
			const frequencyFactor = Math.min(1, 10 / tagFrequency); // 较少使用的标签可能更具特异性

			relevance[tag] = overlap > 0
				? (overlap / Math.max(linkWords.length, tagWords.length)) * (1 + frequencyFactor)
				: 0;
		}

		return relevance;
	}

	private tokenize(text: string): string[] {
		// 将CamelCase和kebab-case分解为单词
		const normalized = text
			.replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase -> Camel Case
			.replace(/[-_]/g, ' ');              // kebab-case -> kebab case

		return normalized
			.toLowerCase()
			.split(/\s+/)
			.filter(word => word.length > 2);    // 只保留长度大于2的词
	}

	private findRelatedLinks(link: string, tagRelevance: Record<string, number>): string[] {
		const relatedLinks: string[] = [];
		const files = this.app.vault.getMarkdownFiles();
		const relevantTags = Object.keys(tagRelevance).filter(tag => tagRelevance[tag] > 0.3);

		if (relevantTags.length === 0) return [];

		// 查找包含相同相关标签的文件
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) continue;

			let fileHasRelevantTag = false;

			// 检查文件标签
			if (cache.tags) {
				for (const tagObj of cache.tags) {
					const tag = tagObj.tag.substring(1);
					if (relevantTags.includes(tag)) {
						fileHasRelevantTag = true;
						break;
					}
				}
			}

			// 检查 frontmatter 标签
			if (!fileHasRelevantTag && cache.frontmatter && cache.frontmatter.tags) {
				const fmTags = Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags];

				for (const tag of fmTags) {
					if (relevantTags.includes(tag)) {
						fileHasRelevantTag = true;
						break;
					}
				}
			}

			if (fileHasRelevantTag) {
				relatedLinks.push(file.basename);
			}
		}

		// 只返回前5个相关链接
		return relatedLinks.slice(0, 5);
	}

	private async suggestTemplate(relatedTags: string[]): Promise<string | undefined> {
		if (relatedTags.length === 0) return undefined;

		// 分析使用了相同标签的文件所使用的模板
		const templateUsage: Record<string, number> = {};
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) continue;

			let fileHasRelevantTag = false;

			// 检查文件是否包含相关标签
			if (cache.tags) {
				for (const tagObj of cache.tags) {
					const tag = tagObj.tag.substring(1);
					if (relatedTags.includes(tag)) {
						fileHasRelevantTag = true;
						break;
					}
				}
			}

			if (cache.frontmatter && cache.frontmatter.tags) {
				const fmTags = Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags];

				for (const tag of fmTags) {
					if (relatedTags.includes(tag)) {
						fileHasRelevantTag = true;
						break;
					}
				}
			}

			if (fileHasRelevantTag && cache.frontmatter && cache.frontmatter.template) {
				const template = cache.frontmatter.template;
				templateUsage[template] = (templateUsage[template] || 0) + 1;
			}
		}

		// 找出使用最多的模板
		const templates = Object.entries(templateUsage)
			.sort((a, b) => b[1] - a[1]);

		return templates.length > 0 ? templates[0][0] : undefined;
	}
}
