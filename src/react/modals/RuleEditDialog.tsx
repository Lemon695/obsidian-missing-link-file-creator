import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Notice } from "obsidian";
import { useObsidian } from "@/react/context/ObsidianContext";
import { FileCreationRule, TemplateAliasHandling } from "@/model/rule-types";
import { ConditionMatchType, ConditionOperator, MatchCondition } from "@/model/condition-types";
import { RuleManager } from "@/model/rule-manager";
import { computeRulePreview } from "@/model/rule-preview";
import { t } from "@/i18n/locale";
import { Input } from "@/react/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/react/components/ui/select";
import { PlusCircle, Trash2, X, Search, Eye } from "lucide-react";
import { ConditionEditorCard } from "./ConditionEditorCard";
import { FolderSuggest } from "@/settings/suggesters/folder-suggester";
import { FileSuggest, FileSuggestMode } from "@/settings/suggesters/file-suggester";

interface RuleEditDialogProps {
  rule: FileCreationRule;
  onSave: (rule: FileCreationRule) => void;
  onCancel: () => void;
  onBrowseTemplates: (onChoose: (path: string) => void) => void;
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function RuleEditDialog({ rule: initialRule, onSave, onCancel, onBrowseTemplates }: RuleEditDialogProps) {
  const { app, plugin } = useObsidian();
  const [rule, setRule] = useState<FileCreationRule>(() => ({
    ...initialRule,
    conditions: initialRule.conditions.map((c) => ({ ...c })),
  }));
  const [sampleName, setSampleName] = useState("");

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  // 未保存变更检测（与传入的原始规则比对）
  const initialSerialized = useMemo(() => JSON.stringify(initialRule), [initialRule]);
  const dirty = useMemo(() => JSON.stringify(rule) !== initialSerialized, [rule, initialSerialized]);

  // 命中预览：用「当前编辑中的规则」（强制 enabled）构造临时 RuleManager，依赖注入给 computeRulePreview
  const previewManager = useMemo(
    () => new RuleManager(app, { ...plugin.settings, useRules: true, rules: [{ ...rule, enabled: true }] }),
    [app, plugin.settings, rule]
  );
  const preview = useMemo(
    () => (sampleName.trim() ? computeRulePreview(previewManager, sampleName) : null),
    [previewManager, sampleName]
  );

  // Attach FolderSuggest
  useEffect(() => {
    if (folderInputRef.current) {
      new FolderSuggest(app, folderInputRef.current);
    }
  }, [app]);

  // Attach FileSuggest for templates
  useEffect(() => {
    if (templateInputRef.current && plugin.settings.templateFolder) {
      new FileSuggest(templateInputRef.current, plugin, FileSuggestMode.TemplateFiles);
    }
  }, [plugin]);

  const updateRule = useCallback((patch: Partial<FileCreationRule>) => {
    setRule((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateCondition = useCallback((index: number, cond: MatchCondition) => {
    setRule((prev) => {
      const conditions = [...prev.conditions];
      conditions[index] = cond;
      return { ...prev, conditions };
    });
  }, []);

  const deleteCondition = useCallback((index: number) => {
    setRule((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }, []);

  const addCondition = useCallback(() => {
    const newCond: MatchCondition = {
      id: `cond-${Date.now()}`,
      type: ConditionMatchType.CONTAINS,
      pattern: "",
      operator: ConditionOperator.AND,
    };
    setRule((prev) => ({ ...prev, conditions: [...prev.conditions, newCond] }));
  }, []);

  const handleSave = useCallback(() => {
    if (!rule.name.trim()) {
      new Notice(t("ruleNameCannotBeEmpty"));
      return;
    }
    if (rule.conditions.length === 0) {
      new Notice(t("atLeastOneConditionRequired"));
      return;
    }
    for (const cond of rule.conditions) {
      if (!cond.pattern.trim()) {
        new Notice(t("matchPatternCannotBeEmpty"));
        return;
      }
      if (cond.type === ConditionMatchType.REGEX) {
        try { new RegExp(cond.pattern); } catch {
          new Notice(t("invalidRegularExpression"));
          return;
        }
      }
    }
    onSave(rule);
  }, [rule, onSave]);

  const extraEntries = Object.entries(rule.extraFrontmatter ?? {});
  const fmPreview = preview?.previewFrontmatter ? Object.entries(preview.previewFrontmatter) : [];

  return (
    <div
      className="ccmd-modal"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      {/* Header */}
      <div className="ccmd-modal__header">
        <div className="ccmd-modal__header-text">
          <h2 className="ccmd-modal__title">{t("editRule")}</h2>
          {rule.name && <p className="ccmd-modal__subtitle">{rule.name}</p>}
        </div>
        <label className="ccmd-ruleedit__head-enable">
          {t("enable")}
          <button
            type="button"
            className={cx("ccmd-toggle", rule.enabled && "ccmd-toggle--on")}
            onClick={() => updateRule({ enabled: !rule.enabled })}
            aria-label={t("enable")}
            aria-pressed={rule.enabled}
          />
        </label>
        <button className="ccmd-modal__close" onClick={onCancel} title={t("cancel")} aria-label={t("cancel")}>
          <X size={18} />
        </button>
      </div>

      {/* Two-column body */}
      <div className="ccmd-ruleedit__cols">
        {/* Left: editable fields */}
        <div className="ccmd-ruleedit__left ccmd-scroll">
          <div className="ccmd-field">
            <label className="ccmd-field__label">{t("ruleName")}</label>
            <Input value={rule.name} placeholder={t("ruleName")} onChange={(e) => updateRule({ name: e.target.value })} />
          </div>

          <div>
            <div className="ccmd-setting-heading">{t("matching")}</div>
            {rule.conditions.length === 0 && (
              <p className="ccmd-field__desc">{t("clickAddCondition")}</p>
            )}
            {rule.conditions.map((cond, idx) => (
              <ConditionEditorCard
                key={cond.id}
                condition={cond}
                onChange={(c) => updateCondition(idx, c)}
                onDelete={() => deleteCondition(idx)}
              />
            ))}
            <button className="ccmd-btn ccmd-btn--sm" onClick={addCondition}>
              <PlusCircle size={14} />
              {t("addCondition")}
            </button>
          </div>

          <div className="ccmd-field">
            <label className="ccmd-field__label">{t("targetFolder")}</label>
            <p className="ccmd-field__desc">{t("targetFolderDesc")}</p>
            <Input
              ref={folderInputRef}
              placeholder={t("exampleFolder")}
              value={rule.targetFolder}
              onChange={(e) => updateRule({ targetFolder: e.target.value })}
            />
          </div>

          <div className="ccmd-field">
            <label className="ccmd-field__label">{t("useTemplate")}</label>
            <p className="ccmd-field__desc">{t("useTemplateDesc")}</p>
            <div className="ccmd-field__row">
              <Input
                ref={templateInputRef}
                placeholder={t("selectTemplate")}
                value={rule.templatePath}
                onChange={(e) => updateRule({ templatePath: e.target.value })}
              />
              <button
                type="button"
                className="ccmd-iconbtn"
                onClick={() => onBrowseTemplates((path) => updateRule({ templatePath: path }))}
                title={t("browseTemplates")}
                aria-label={t("browseTemplates")}
              >
                <Search size={15} />
              </button>
            </div>
          </div>

          <div className="ccmd-field">
            <label className="ccmd-field__label">{t("templateAliasHandling")}</label>
            <p className="ccmd-field__desc">{t("templateAliasHandlingDesc")}</p>
            <Select
              value={rule.templateAliasHandling || TemplateAliasHandling.SKIP}
              onValueChange={(v) => updateRule({ templateAliasHandling: v as TemplateAliasHandling })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TemplateAliasHandling.SKIP}>{t("skipTemplaterHandlesAliases")}</SelectItem>
                <SelectItem value={TemplateAliasHandling.MERGE}>{t("mergeWithTemplate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ccmd-field">
            <label className="ccmd-field__label">{t("extraFrontmatter")}</label>
            <p className="ccmd-field__desc">{t("extraFrontmatterDesc")}</p>
            {extraEntries.map(([key, value], idx) => (
              <div key={idx} className="ccmd-kv-row">
                <Input
                  placeholder={t("frontmatterKey")}
                  value={key}
                  onChange={(e) => {
                    const entries = Object.entries(rule.extraFrontmatter ?? {});
                    entries[idx] = [e.target.value, value];
                    updateRule({ extraFrontmatter: Object.fromEntries(entries) });
                  }}
                />
                <Input
                  placeholder={t("frontmatterValue")}
                  value={value}
                  onChange={(e) => {
                    const entries = Object.entries(rule.extraFrontmatter ?? {});
                    entries[idx] = [key, e.target.value];
                    updateRule({ extraFrontmatter: Object.fromEntries(entries) });
                  }}
                />
                <button
                  type="button"
                  className="ccmd-iconbtn ccmd-iconbtn--sm ccmd-iconbtn--danger"
                  onClick={() => {
                    const entries = Object.entries(rule.extraFrontmatter ?? {}).filter((_, i) => i !== idx);
                    updateRule({ extraFrontmatter: Object.fromEntries(entries) });
                  }}
                  title={t("delete")}
                  aria-label={t("delete")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              className="ccmd-btn ccmd-btn--sm"
              onClick={() => {
                const entries = Object.entries(rule.extraFrontmatter ?? {});
                entries.push(["", ""]);
                updateRule({ extraFrontmatter: Object.fromEntries(entries) });
              }}
            >
              <PlusCircle size={13} />
              {t("addFrontmatterField")}
            </button>
          </div>
        </div>

        {/* Right: live match preview */}
        <div className="ccmd-ruleedit__right">
          <div className="ccmd-preview">
            <div className="ccmd-preview__title">
              <Eye />
              {t("rulePreviewTitle")}
            </div>
            <div className="ccmd-field">
              <label className="ccmd-field__label">{t("rulePreviewSampleLabel")}</label>
              <input
                type="text"
                className="ccmd-input"
                placeholder={t("rulePreviewSamplePlaceholder")}
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
              />
            </div>

            {!sampleName.trim() ? (
              <div className="ccmd-preview__empty">{t("rulePreviewEmpty")}</div>
            ) : preview?.hit ? (
              <div className="ccmd-preview__result">
                <span><span className="ccmd-badge ccmd-badge--accent">{t("rulePreviewMatched")}</span></span>
                <div className="ccmd-preview__row">
                  <span className="ccmd-preview__row-label">{t("rulePreviewTarget")}</span>
                  <span className="ccmd-path"><span className="ccmd-path__name">{preview.targetPath}</span></span>
                </div>
                {preview.templatePath && (
                  <div className="ccmd-preview__row">
                    <span className="ccmd-preview__row-label">{t("rulePreviewTemplate")}</span>
                    <span className="ccmd-path">{preview.templatePath}</span>
                  </div>
                )}
                {fmPreview.length > 0 && (
                  <div className="ccmd-preview__row">
                    <span className="ccmd-preview__row-label">{t("rulePreviewFrontmatter")}</span>
                    <div className="ccmd-preview__fm">
                      {fmPreview.map(([k, v]) => (
                        <span key={k} className="ccmd-preview__fm-item">{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ccmd-preview__result">
                <span><span className="ccmd-badge ccmd-badge--muted">{t("rulePreviewNoMatch")}</span></span>
                <div className="ccmd-preview__empty">{t("rulePreviewMissDesc")}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ccmd-modal__footer">
        {dirty && <span className="ccmd-modal__dirty">{t("unsavedChanges")}</span>}
        <span className="ccmd-modal__footer-spacer" />
        <button className="ccmd-btn" onClick={onCancel}>{t("cancel")}</button>
        <button className="ccmd-btn ccmd-btn--cta" onClick={handleSave}>{t("save")}</button>
      </div>
    </div>
  );
}
