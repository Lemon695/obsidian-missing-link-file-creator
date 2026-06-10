import type { RuleManager } from "./rule-manager";
import type { ObsidianFrontmatter } from "@/types/frontmatter";

/** 规则命中预览结果（供规则编辑弹窗的实时预览面板使用） */
export interface RulePreviewResult {
  /** 是否命中任一规则 */
  hit: boolean;
  /** 命中时的目标路径（targetFolder + 样例名） */
  targetPath?: string;
  /** 命中规则使用的模板路径 */
  templatePath?: string;
  /** 命中规则附带的附加 frontmatter */
  previewFrontmatter?: Record<string, string>;
}

/**
 * 对给定样例文件名计算规则命中预览。
 *
 * 设计为**依赖倒置**：接收调用方注入的 `RuleManager` 实例（`RuleManager` 非纯——
 * 依赖 `this.settings`），本函数自身只做编排，可独立单测
 * （测试用 `new RuleManager({} as never, settings)` 注入）。
 *
 * - 命中：返回 `targetPath`（folder/name，folder 尾斜杠归一化）、`templatePath`、
 *   `previewFrontmatter`。
 * - 未命中或样例名为空：`{ hit: false }`，默认目录回退由调用方（持有 settings 的 UI）展示。
 */
export function computeRulePreview(
  manager: RuleManager,
  sampleName: string,
  frontmatter?: ObsidianFrontmatter
): RulePreviewResult {
  const name = sampleName.trim();
  if (!name) return { hit: false };

  const result = manager.matchRule(name, frontmatter ? { frontmatter } : undefined);
  if (!result.matched || !result.rule) return { hit: false };

  const folder = result.targetFolder?.replace(/\/+$/, "");
  return {
    hit: true,
    targetPath: folder ? `${folder}/${name}` : name,
    templatePath: result.templatePath || undefined,
    previewFrontmatter: result.extraFrontmatter,
  };
}
