import { App, TFile } from "obsidian";
import { log } from "@/utils/log-utils";
import { TagContext } from "@/types/frontmatter";

/**
 * 标签建议接口
 */
export interface TagSuggestion {
	tag: string;
	confidence: number; // 0-1之间的置信度
	reason: string;
}

export class TagHelper {
	private app: App;
	private tagCache: Map<string, string[]> = new Map();
	private lastCacheUpdate: number = 0;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 为指定内容生成标签建议
	 * @param content 文件内容
	 * @param filename 文件名
	 * @param context 上下文信息(可选)
	 * @returns 标签建议列表
	 */
	async suggestTags(content: string, filename: string, context?: TagContext): Promise<TagSuggestion[]> {
		await this.ensureTagCacheUpdated();

		const suggestions: TagSuggestion[] = [];

		// 1. 从文件名分析可能的标签
		const nameBasedTags = this.analyzeFilename(filename);
		suggestions.push(...nameBasedTags);

		// 2. 从内容分析可能的标签
		const contentBasedTags = this.analyzeContent(content);
		suggestions.push(...contentBasedTags);

		// 3. 从源文件关系分析标签
		if (context?.sourcePath) {
			const relationBasedTags = await this.analyzeFileRelations(context.sourcePath);
			suggestions.push(...relationBasedTags);
		}

		// 4. 合并相同标签，提高置信度
		const mergedSuggestions = this.mergeSimilarTags(suggestions);

		// 按置信度排序
		return mergedSuggestions.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * 应用标签到文件内容
	 */
	applyTagsToContent(content: string, tags: string[]): string {
		if (!tags || tags.length === 0) return content;

		// 检查是否有frontmatter
		if (content.startsWith('---')) {
			// 有frontmatter，检查是否已有tags
			const frontmatterEndIndex = content.indexOf('---', 3);
			if (frontmatterEndIndex !== -1) {
				const frontmatter = content.substring(0, frontmatterEndIndex + 3);
				const restContent = content.substring(frontmatterEndIndex + 3);

				if (frontmatter.includes('tags:')) {
					// 已有tags，添加新标签
					// 支持数组格式和列表格式
					if (frontmatter.match(/tags:\s*\[.*\]/)) {
						// 数组格式
						const updatedFrontmatter = frontmatter.replace(
							/tags:\s*\[(.*)\]/,
							(match, existingTags) => {
								const tagList = existingTags.split(',')
									.map((t: string) => t.trim())
									.filter((t: string) => t);

								// 添加新标签(避免重复)
								for (const tag of tags) {
									const formattedTag = `"${tag}"`;
									if (!tagList.includes(formattedTag) && !tagList.includes(tag)) {
										tagList.push(formattedTag);
									}
								}

								return `tags: [${tagList.join(', ')}]`;
							}
						);
						return updatedFrontmatter + restContent;
					} else {
						// 列表格式
						const frontmatterLines = frontmatter.split('\n');
						const tagsLineIndex = frontmatterLines.findIndex(line => line.trim().startsWith('tags:'));

						if (tagsLineIndex !== -1) {
							// 找出缩进级别
							const indentMatch = frontmatterLines[tagsLineIndex + 1]?.match(/^(\s+)-/);
							const indent = indentMatch ? indentMatch[1] : '  ';

							// 收集现有标签
							const existingTags = new Set<string>();
							let i = tagsLineIndex + 1;
							while (i < frontmatterLines.length && frontmatterLines[i].match(/^\s+- /)) {
								const tagMatch = frontmatterLines[i].match(/^\s+- ["']?([^"'\n]*)["']?/);
								if (tagMatch) existingTags.add(tagMatch[1]);
								i++;
							}

							// 添加新标签
							const newTagLines = tags
								.filter(tag => !existingTags.has(tag))
								.map(tag => `${indent}- "${tag}"`);

							// 插入新标签行
							frontmatterLines.splice(i, 0, ...newTagLines);
							return frontmatterLines.join('\n') + restContent;
						}
					}
				} else {
					// 无tags字段，添加新字段
					const tagsYaml = tags.map(tag => `  - "${tag}"`).join('\n');
					const updatedFrontmatter = frontmatter.substring(0, frontmatter.length - 4) +
						`\ntags:\n${tagsYaml}\n---`;
					return updatedFrontmatter + restContent;
				}
			}
		}

		// 无frontmatter或处理失败，添加新frontmatter
		const tagsYaml = tags.map(tag => `  - "${tag}"`).join('\n');
		return `---\ntags:\n${tagsYaml}\n---\n\n${content}`;
	}

	/**
	 * 从文件名分析可能的标签
	 */
	private analyzeFilename(filename: string): TagSuggestion[] {
		const suggestions: TagSuggestion[] = [];

		// 移除扩展名
		const baseName = filename.replace(/\.[^/.]+$/, '');

		// 处理不同的命名格式
		// 1. 处理PascalCase (MyClassName)
		if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(baseName)) {
			const words = baseName.match(/[A-Z][a-z]+/g) || [];
			if (words.length >= 2) {
				// 使用可选链操作符或添加额外检查确保words[0]存在
				const firstWord = words[0]?.toLowerCase() || '';
				if (firstWord) {  // 确保firstWord不为空
					suggestions.push({
						tag: firstWord,
						confidence: 0.6,
						reason: `Based on PascalCase filename pattern (${baseName})`
					});
				}
			}
		}

		// 2. 处理kebab-case (my-file-name)
		if (baseName.includes('-')) {
			const words = baseName.split('-');
			if (words.length >= 2) {
				suggestions.push({
					tag: words[0],
					confidence: 0.7,
					reason: `Based on kebab-case filename pattern (${baseName})`
				});
			}
		}

		// 3. 处理snake_case (my_file_name)
		if (baseName.includes('_')) {
			const words = baseName.split('_');
			if (words.length >= 2) {
				suggestions.push({
					tag: words[0],
					confidence: 0.7,
					reason: `Based on snake_case filename pattern (${baseName})`
				});
			}
		}

		// 4. 查找符合现有标签模式的文件名
		const allTags = Array.from(this.tagCache.keys());
		for (const tag of allTags) {
			if (baseName.toLowerCase().includes(tag.toLowerCase())) {
				suggestions.push({
					tag: tag,
					confidence: 0.8,
					reason: `Filename contains existing tag: ${tag}`
				});
			}
		}

		return suggestions;
	}

	/**
	 * 从内容分析可能的标签
	 */
	private analyzeContent(content: string): TagSuggestion[] {
		const suggestions: TagSuggestion[] = [];

		// 提取所有链接
		const links: string[] = [];
		const linkRegex = /\[\[((?:[^\[\]]|\\.)+?)(?:\|(?:[^\[\]]|\\.)+?)?\]\]/g;
		let match;
		while (match = linkRegex.exec(content)) {
			const link = match[1].split('#')[0].split('|')[0].trim();
			links.push(link);
		}

		// 分析链接，查找相关标签
		if (links.length > 0) {
			const linkTags = this.analyzeLinks(links);
			suggestions.push(...linkTags);
		}

		// 基于内容关键词分析
		const contentText = content
			.replace(/```[\s\S]*?```/g, '') // 移除代码块
			.replace(/`[^`]*`/g, '')       // 移除内联代码
			.replace(/\[\[.*?\]\]/g, '')   // 移除链接
			.replace(/---[\s\S]*?---/, ''); // 移除frontmatter

		// 分析内容中最常见的词
		const wordFreq = this.analyzeWordFrequency(contentText);
		const topWords = Object.entries(wordFreq)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5);

		// 将常见词与已有标签进行匹配
		const allTags = Array.from(this.tagCache.keys());
		for (const [word, freq] of topWords) {
			// 检查是否与已有标签相似
			for (const tag of allTags) {
				if (this.areWordsSimilar(word, tag) || tag.includes(word) || word.includes(tag)) {
					suggestions.push({
						tag: tag,
						confidence: 0.5 + Math.min(0.3, freq / 100),
						reason: `Common word "${word}" matches existing tag "${tag}"`
					});
				}
			}

			// 如果单词出现频率很高，可能成为新标签
			if (freq > 5 && word.length > 3) {
				suggestions.push({
					tag: word,
					confidence: 0.4 + Math.min(0.3, freq / 100),
					reason: `Common word appears ${freq} times`
				});
			}
		}

		return suggestions;
	}

	/**
	 * 分析链接关系，查找相关标签
	 */
	private async analyzeFileRelations(sourcePath: string): Promise<TagSuggestion[]> {
		const suggestions: TagSuggestion[] = [];

		try {
			const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
			if (!sourceFile || !(sourceFile instanceof TFile)) return suggestions;

			// 获取源文件的标签
			const cache = this.app.metadataCache.getFileCache(sourceFile);
			if (!cache) return suggestions;

			// 收集文件中的标签
			const fileTags: string[] = [];

			// 处理inline标签
			if (cache.tags) {
				for (const tagObj of cache.tags) {
					// 移除#前缀
					const tag = tagObj.tag.substring(1);
					fileTags.push(tag);
				}
			}

			// 处理frontmatter标签
			if (cache.frontmatter && cache.frontmatter.tags) {
				const fmTags = Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags];

				fileTags.push(...fmTags);
			}

			// 为每个标签创建建议
			for (const tag of fileTags) {
				suggestions.push({
					tag: tag,
					confidence: 0.7,
					reason: `Source file ${sourceFile.basename} has tag "${tag}"`
				});
			}

			// 分析源文件链接的其他文件
			const links = cache.links || [];
			if (links.length > 0) {
				const linkedFiles: TFile[] = [];

				for (const link of links) {
					const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, sourcePath);
					if (linkedFile) linkedFiles.push(linkedFile);
				}

				// 分析链接文件的共同标签
				const tagFrequency: Record<string, number> = {};

				for (const file of linkedFiles) {
					const fileCache = this.app.metadataCache.getFileCache(file);
					if (!fileCache) continue;

					// 收集标签
					if (fileCache.tags) {
						for (const tagObj of fileCache.tags) {
							const tag = tagObj.tag.substring(1);
							tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
						}
					}

					if (fileCache.frontmatter && fileCache.frontmatter.tags) {
						const fmTags = Array.isArray(fileCache.frontmatter.tags)
							? fileCache.frontmatter.tags
							: [fileCache.frontmatter.tags];

						for (const tag of fmTags) {
							tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
						}
					}
				}

				// 选择最常见的标签
				const commonTags = Object.entries(tagFrequency)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 3);

				for (const [tag, count] of commonTags) {
					suggestions.push({
						tag: tag,
						confidence: 0.5 + Math.min(0.3, count / linkedFiles.length),
						reason: `Common tag in ${count} linked files`
					});
				}
			}

		} catch (error) {
			log.error(`Error analyzing file relations: ${error}`);
		}

		return suggestions;
	}

	/**
	 * 分析链接，查找相关标签
	 */
	private analyzeLinks(links: string[]): TagSuggestion[] {
		const suggestions: TagSuggestion[] = [];

		if (links.length === 0) return suggestions;

		// 查找这些链接最常与哪些标签一起出现
		const linkTagsMap: Record<string, Record<string, number>> = {};

		for (const link of links) {
			const tags = this.tagCache.get(link.toLowerCase()) || [];

			for (const tag of tags) {
				if (!linkTagsMap[link]) linkTagsMap[link] = {};
				linkTagsMap[link][tag] = (linkTagsMap[link][tag] || 0) + 1;
			}
		}

		// 聚合所有链接中的标签频率
		const allTagFrequency: Record<string, number> = {};
		for (const link of Object.keys(linkTagsMap)) {
			for (const [tag, freq] of Object.entries(linkTagsMap[link])) {
				allTagFrequency[tag] = (allTagFrequency[tag] || 0) + freq;
			}
		}

		// 选择最常见的标签
		const commonTags = Object.entries(allTagFrequency)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);

		for (const [tag, count] of commonTags) {
			suggestions.push({
				tag: tag,
				confidence: 0.6 + Math.min(0.3, count / links.length),
				reason: `Common tag for linked files (${count} occurrences)`
			});
		}

		return suggestions;
	}

	/**
	 * 分析文本中词语的频率
	 */
	private analyzeWordFrequency(text: string): Record<string, number> {
		const frequency: Record<string, number> = {};

		// 将文本转换为小写并分割为单词
		const words = text.toLowerCase()
			.replace(/[^\w\s]/g, ' ')  // 去除标点
			.split(/\s+/)             // 按空格分割
			.filter(word => word.length > 3); // 只保留长度大于3的词

		// 停用词列表(常见词汇，不适合作为标签)
		const stopWords = new Set([
			'this', 'that', 'these', 'those', 'with', 'from', 'have', 'has', 'had',
			'were', 'been', 'being', 'their', 'there', 'where', 'which', 'what',
			'when', 'then', 'than', 'they', 'them', 'some', 'such', 'only', 'other',
			'into', 'most', 'more', 'much', 'many', 'also', 'about', 'should', 'would'
		]);

		// 计算频率
		for (const word of words) {
			if (!stopWords.has(word)) {
				frequency[word] = (frequency[word] || 0) + 1;
			}
		}

		return frequency;
	}

	/**
	 * 检查两个词是否相似
	 */
	private areWordsSimilar(word1: string, word2: string): boolean {
		const leven = this.levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
		// 词语越长，允许的编辑距离越大
		const maxLength = Math.max(word1.length, word2.length);
		const threshold = Math.max(1, Math.floor(maxLength * 0.3));

		return leven <= threshold;
	}

	/**
	 * 计算两个字符串的编辑距离
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const track = Array(str2.length + 1).fill(null).map(() =>
			Array(str1.length + 1).fill(null));

		for (let i = 0; i <= str1.length; i += 1) {
			track[0][i] = i;
		}

		for (let j = 0; j <= str2.length; j += 1) {
			track[j][0] = j;
		}

		for (let j = 1; j <= str2.length; j += 1) {
			for (let i = 1; i <= str1.length; i += 1) {
				const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
				track[j][i] = Math.min(
					track[j][i - 1] + 1, // deletion
					track[j - 1][i] + 1, // insertion
					track[j - 1][i - 1] + indicator, // substitution
				);
			}
		}

		return track[str2.length][str1.length];
	}

	/**
	 * 合并相似的标签建议
	 */
	private mergeSimilarTags(suggestions: TagSuggestion[]): TagSuggestion[] {
		if (suggestions.length <= 1) return suggestions;

		const merged: TagSuggestion[] = [];
		const processed = new Set<number>();

		for (let i = 0; i < suggestions.length; i++) {
			if (processed.has(i)) continue;

			const current = suggestions[i];
			let maxConfidence = current.confidence;
			let reasons = [current.reason];

			// 查找相似标签
			for (let j = i + 1; j < suggestions.length; j++) {
				if (processed.has(j)) continue;

				const other = suggestions[j];

				// 如果标签完全相同或非常相似
				if (current.tag === other.tag || this.areWordsSimilar(current.tag, other.tag)) {
					maxConfidence = Math.max(maxConfidence, other.confidence);
					reasons.push(other.reason);
					processed.add(j);
				}
			}

			// 使用合并后的置信度和原因
			merged.push({
				tag: current.tag,
				confidence: Math.min(0.95, maxConfidence + 0.1 * (reasons.length - 1)),
				reason: reasons.join('; ')
			});

			processed.add(i);
		}

		return merged;
	}

	/**
	 * 确保标签缓存是最新的
	 */
	private async ensureTagCacheUpdated(): Promise<void> {
		const now = Date.now();
		if (now - this.lastCacheUpdate < 300000 && this.tagCache.size > 0) {
			return; // 缓存未过期
		}

		// 更新缓存
		this.tagCache.clear();

		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) continue;

			// 收集文件中的所有标签
			const fileTags: string[] = [];

			// 处理inline标签
			if (cache.tags) {
				for (const tagObj of cache.tags) {
					const tag = tagObj.tag.substring(1); // 移除#前缀
					fileTags.push(tag);
				}
			}

			// 处理frontmatter标签
			if (cache.frontmatter && cache.frontmatter.tags) {
				const fmTags = Array.isArray(cache.frontmatter.tags)
					? cache.frontmatter.tags
					: [cache.frontmatter.tags];

				fileTags.push(...fmTags);
			}

			// 如果文件有标签，将其添加到缓存
			if (fileTags.length > 0) {
				this.tagCache.set(file.basename.toLowerCase(), fileTags);
			}
		}

		this.lastCacheUpdate = now;
		log.debug(`Updated tag cache with ${this.tagCache.size} files`);
	}
}
