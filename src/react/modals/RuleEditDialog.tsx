import React, { useState, useCallback, useRef, useEffect } from "react";
import { Notice } from "obsidian";
import { useObsidian } from "@/react/context/ObsidianContext";
import { FileCreationRule, TemplateAliasHandling } from "@/model/rule-types";
import { ConditionMatchType, ConditionOperator, MatchCondition } from "@/model/condition-types";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
import { Input } from "@/react/components/ui/input";
import { ScrollArea } from "@/react/components/ui/scroll-area";
import { Separator } from "@/react/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/react/components/ui/select";
import { PlusCircle, Pencil } from "lucide-react";
import { ConditionEditorCard } from "./ConditionEditorCard";
import { FolderSuggest } from "@/settings/suggesters/folder-suggester";
import { FileSuggest, FileSuggestMode } from "@/settings/suggesters/file-suggester";

interface RuleEditDialogProps {
  rule: FileCreationRule;
  onSave: (rule: FileCreationRule) => void;
  onCancel: () => void;
  onBrowseTemplates: (onChoose: (path: string) => void) => void;
}

export function RuleEditDialog({ rule: initialRule, onSave, onCancel, onBrowseTemplates }: RuleEditDialogProps) {
  const { app, plugin } = useObsidian();
  const [rule, setRule] = useState<FileCreationRule>(() => ({
    ...initialRule,
    conditions: initialRule.conditions.map((c) => ({ ...c })),
  }));
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(rule.name);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleNameSave = useCallback(() => {
    if (nameInput.trim()) updateRule({ name: nameInput.trim() });
    setEditingName(false);
  }, [nameInput, updateRule]);

  return (
    <div
      className="tw-flex tw-flex-col tw-gap-4 tw-h-full"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      {/* Title row */}
      <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-border">
        {editingName ? (
          <div className="tw-flex tw-items-center tw-gap-2">
            <Input
              className="tw-h-8 tw-w-[260px]"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") setEditingName(false); }}
              autoFocus
            />
            <Button size="sm" onClick={handleNameSave}>{t("save")}</Button>
          </div>
        ) : (
          <h2
            className="tw-m-0 tw-text-xl tw-font-semibold tw-cursor-pointer hover:tw-text-primary tw-flex tw-items-center tw-gap-2"
            onClick={() => { setNameInput(rule.name); setEditingName(true); }}
          >
            {rule.name}
            <Pencil className="tw-h-3.5 tw-w-3.5 tw-text-muted-foreground" />
          </h2>
        )}
        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
          <span>{t("enable")}</span>
          <button
            type="button"
            className="tw-w-10 tw-h-5 tw-rounded-full tw-border tw-cursor-pointer tw-transition-colors"
            style={{ backgroundColor: rule.enabled ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
            onClick={() => updateRule({ enabled: !rule.enabled })}
            aria-label={t("enable")}
            aria-pressed={rule.enabled}
          />
        </label>
      </div>

      {/* Two-column layout */}
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4 md:tw-gap-6 tw-flex-1 tw-min-h-0">
        {/* Left: Conditions */}
        <div className="tw-flex-1 tw-flex tw-flex-col tw-min-w-0">
          <h3 className="tw-text-base tw-font-semibold tw-mb-3">{t("matching")}</h3>
          <ScrollArea className="tw-flex-1 tw-min-h-[300px]">
            {rule.conditions.length === 0 && (
              <p className="tw-text-sm tw-text-muted-foreground tw-italic tw-p-4">{t("clickAddCondition")}</p>
            )}
            {rule.conditions.map((cond, idx) => (
              <ConditionEditorCard
                key={cond.id}
                condition={cond}
                onChange={(c) => updateCondition(idx, c)}
                onDelete={() => deleteCondition(idx)}
              />
            ))}
          </ScrollArea>
          <Button variant="outline" className="tw-mt-3" onClick={addCondition}>
            <PlusCircle className="tw-h-4 tw-w-4 tw-mr-1" />
            {t("addCondition")}
          </Button>
        </div>

        <Separator orientation="vertical" className="tw-hidden md:tw-block tw-h-auto" />
        <Separator orientation="horizontal" className="md:tw-hidden" />

        {/* Right: Target settings */}
        <div className="tw-w-full md:tw-w-[320px] tw-flex-shrink-0 tw-flex tw-flex-col tw-gap-4">
          <h3 className="tw-text-base tw-font-semibold">{t("targetSettings")}</h3>

          {/* Target folder */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-text-sm tw-font-medium">{t("targetFolder")}</label>
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">{t("targetFolderDesc")}</p>
            <Input
              ref={folderInputRef}
              className="tw-h-8"
              placeholder={t("exampleFolder")}
              value={rule.targetFolder}
              onChange={(e) => updateRule({ targetFolder: e.target.value })}
            />
          </div>

          {/* Template */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-text-sm tw-font-medium">{t("useTemplate")}</label>
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">{t("useTemplateDesc")}</p>
            <div className="tw-flex tw-gap-2">
              <Input
                ref={templateInputRef}
                className="tw-h-8 tw-flex-1"
                placeholder={t("selectTemplate")}
                value={rule.templatePath}
                onChange={(e) => updateRule({ templatePath: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                className="tw-h-8 tw-w-8"
                onClick={() => onBrowseTemplates((path) => updateRule({ templatePath: path }))}
                title={t("browseTemplates")}
                aria-label={t("browseTemplates")}
              >
                🔍
              </Button>
            </div>
          </div>

          {/* Template alias handling */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-text-sm tw-font-medium">{t("templateAliasHandling")}</label>
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">{t("templateAliasHandlingDesc")}</p>
            <Select
              value={rule.templateAliasHandling || TemplateAliasHandling.SKIP}
              onValueChange={(v) => updateRule({ templateAliasHandling: v as TemplateAliasHandling })}
            >
              <SelectTrigger className="tw-h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TemplateAliasHandling.SKIP}>{t("skipTemplaterHandlesAliases")}</SelectItem>
                <SelectItem value={TemplateAliasHandling.MERGE}>{t("mergeWithTemplate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tw-flex tw-justify-end tw-gap-3 tw-pt-3 tw-border-t tw-border-border">
        <Button variant="outline" onClick={onCancel}>{t("cancel")}</Button>
        <Button onClick={handleSave}>{t("save")}</Button>
      </div>
    </div>
  );
}
