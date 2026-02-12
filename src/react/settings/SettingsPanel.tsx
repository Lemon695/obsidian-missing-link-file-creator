import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/i18n/locale";
import { FileCreationRule } from "@/model/rule-types";
import { ConditionOperator, ConditionMatchType } from "@/model/condition-types";
import { useObsidian } from "@/react/context/ObsidianContext";
import { Button } from "@/react/components/ui/button";
import { Input } from "@/react/components/ui/input";
import { Checkbox } from "@/react/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/react/components/ui/select";
import { FolderSuggest } from "@/settings/suggesters/folder-suggester";
import type { CreateFileSettings } from "@/settings/settings";

interface SettingsPanelProps {
  refreshToken: number;
  onOpenRulesManagement: () => void;
}

function getRuleMatchDescription(rule: FileCreationRule): string {
  if (!rule.conditions || rule.conditions.length === 0) {
    return `${t("noMatchConditions")} -> ${t("targetFolder")}: ${rule.targetFolder || t("defaultValue")}, ${t("useTemplate")}: ${rule.templatePath || t("noneValue")}${rule.enabled ? "" : ` [${t("disabled")}]`}`;
  }

  const conditionsToShow = rule.conditions.slice(0, 2);
  const remainingCount = Math.max(0, rule.conditions.length - 2);

  const conditionDescriptions = conditionsToShow.map((cond) => {
    const operatorMap: Record<string, string> = {
      [ConditionOperator.AND]: t("and"),
      [ConditionOperator.OR]: t("or"),
      [ConditionOperator.NOT]: t("not"),
      [ConditionOperator.EXCLUDE]: t("exclude"),
    };

    const typeMap: Record<string, string> = {
      [ConditionMatchType.CONTAINS]: t("contains"),
      [ConditionMatchType.STARTS_WITH]: t("beginsWith"),
      [ConditionMatchType.ENDS_WITH]: t("endsWith"),
      [ConditionMatchType.EXACT]: t("matches"),
      [ConditionMatchType.REGEX]: t("regex"),
      [ConditionMatchType.FRONTMATTER]: "frontmatter",
    };

    return `${operatorMap[cond.operator] || cond.operator} ${typeMap[cond.type] || cond.type} "${cond.pattern}"`;
  });

  let description = conditionDescriptions.join("; ");
  if (remainingCount > 0) {
    description += `; ${t("plusMoreConditions", { count: remainingCount.toString() })}`;
  }

  return `${description} -> ${t("targetFolder")}: ${rule.targetFolder || t("defaultValue")}, ${t("useTemplate")}: ${rule.templatePath || t("noneValue")}${rule.enabled ? "" : ` [${t("disabled")}]`}`;
}

export function SettingsPanel({ refreshToken, onOpenRulesManagement }: SettingsPanelProps) {
  const { app, plugin } = useObsidian();
  const [, forceRender] = useState(0);

  const defaultFolderRef = useRef<HTMLInputElement | null>(null);
  const templateFolderRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (defaultFolderRef.current) {
      new FolderSuggest(app, defaultFolderRef.current);
    }
  }, [app]);

  useEffect(() => {
    if (templateFolderRef.current) {
      new FolderSuggest(app, templateFolderRef.current);
    }
  }, [app]);

  const saveAndRender = useCallback(async () => {
    await plugin.saveSettings();
    forceRender((v) => v + 1);
  }, [plugin]);

  const updateSetting = useCallback(
    async <K extends keyof CreateFileSettings>(key: K, value: CreateFileSettings[K]) => {
      plugin.settings[key] = value;
      await saveAndRender();
    },
    [plugin, saveAndRender]
  );

  const rules = useMemo(() => {
    const list = [...(plugin.settings.rules || [])];
    list.sort((a, b) => a.priority - b.priority);
    return list;
  }, [plugin.settings.rules, refreshToken]);

  return (
    <div className="tw-flex tw-flex-col tw-gap-6 tw-p-4 tw-max-w-[920px]">
      <section className="tw-space-y-4">
        <h3 className="tw-text-base tw-font-semibold tw-m-0">{t("notificationSettings")}</h3>
        <label className="tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-border-border tw-p-3">
          <Checkbox
            checked={plugin.settings.showCreateFileNotification}
            onCheckedChange={(checked) => void updateSetting("showCreateFileNotification", checked === true)}
          />
          <div>
            <div className="tw-font-medium">{t("notificationSettings")}</div>
            <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("notificationSettingsDesc")}</p>
          </div>
        </label>
      </section>

      <section className="tw-space-y-4">
        <h3 className="tw-text-base tw-font-semibold tw-m-0">{t("pathsAndTemplates")}</h3>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
          <div className="tw-space-y-1">
            <label className="tw-text-sm tw-font-medium">{t("defaultPath")}</label>
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">{t("defaultPathDesc")}</p>
            <Input
              ref={defaultFolderRef}
              value={plugin.settings.defaultFolderPath}
              placeholder={t("exampleFolder")}
              onChange={(e) => {
                const value = e.target.value.trim().replace(/\/$/, "");
                void updateSetting("defaultFolderPath", value);
              }}
            />
          </div>

          <div className="tw-space-y-1">
            <label className="tw-text-sm tw-font-medium">{t("templateFolder")}</label>
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">{t("templateFolderDesc")}</p>
            <Input
              ref={templateFolderRef}
              value={plugin.settings.templateFolder}
              placeholder={t("exampleTemplates")}
              onChange={(e) => void updateSetting("templateFolder", e.target.value)}
            />
          </div>
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
          <label className="tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-border-border tw-p-3">
            <Checkbox
              checked={plugin.settings.useTemplates}
              onCheckedChange={(checked) => void updateSetting("useTemplates", checked === true)}
            />
            <div>
              <div className="tw-font-medium">{t("enableTemplates")}</div>
              <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("enableTemplatesDesc")}</p>
            </div>
          </label>

          <label className="tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-border-border tw-p-3">
            <Checkbox
              checked={plugin.settings.addAliasesToFrontmatter}
              onCheckedChange={(checked) => void updateSetting("addAliasesToFrontmatter", checked === true)}
            />
            <div>
              <div className="tw-font-medium">{t("addAliasesToFrontmatter")}</div>
              <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("addAliasesToFrontmatterDesc")}</p>
            </div>
          </label>
        </div>

        <div className="tw-space-y-1">
          <label className="tw-text-sm tw-font-medium">{t("templaterMethod")}</label>
          <Select
            value={plugin.settings.templaterMethod}
            onValueChange={(value) => void updateSetting("templaterMethod", value as CreateFileSettings["templaterMethod"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="execute">execute</SelectItem>
              <SelectItem value="overwrite">overwrite</SelectItem>
              <SelectItem value="basic">basic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="tw-space-y-4">
        <h3 className="tw-text-base tw-font-semibold tw-m-0">{t("rulesManagement")}</h3>

        <label className="tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-border-border tw-p-3">
          <Checkbox
            checked={plugin.settings.useRules}
            onCheckedChange={(checked) => void updateSetting("useRules", checked === true)}
          />
          <div>
            <div className="tw-font-medium">{t("enableRules")}</div>
            <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("enableRulesDesc")}</p>
          </div>
        </label>

        <div className="tw-flex tw-items-center tw-justify-between tw-gap-4 tw-rounded-md tw-border tw-border-border tw-p-3">
          <div>
            <div className="tw-font-medium">{t("manageRules")}</div>
            <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("manageRulesDesc")}</p>
          </div>
          <Button onClick={onOpenRulesManagement}>{t("manageRulesButton")}</Button>
        </div>

        <div className="tw-space-y-2 tw-rounded-md tw-bg-secondary/40 tw-p-3 tw-border tw-border-border">
          <p className="tw-text-sm tw-font-medium tw-m-0">
            {t("rulesConfigured", { count: rules.length.toString() })}
          </p>

          {rules.length > 0 && (
            <ul className="tw-list-disc tw-pl-5 tw-space-y-1 tw-m-0">
              {rules.slice(0, 3).map((rule) => (
                <li key={rule.id} className="tw-text-xs tw-text-muted-foreground">
                  <strong className="tw-text-foreground">{rule.name}</strong>: {getRuleMatchDescription(rule)}
                </li>
              ))}
            </ul>
          )}

          {rules.length > 3 && (
            <p className="tw-text-xs tw-text-muted-foreground tw-m-0">
              {t("andMoreRules", { count: (rules.length - 3).toString() })}
            </p>
          )}
        </div>
      </section>

      <section className="tw-space-y-4">
        <h3 className="tw-text-base tw-font-semibold tw-m-0">{t("developer")}</h3>
        <label className="tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-border-border tw-p-3">
          <Checkbox
            checked={plugin.settings.debugMode}
            onCheckedChange={(checked) => void updateSetting("debugMode", checked === true)}
          />
          <div>
            <div className="tw-font-medium">{t("debugMode")}</div>
            <p className="tw-text-sm tw-text-muted-foreground tw-m-0">{t("debugModeDesc")}</p>
          </div>
        </label>
      </section>
    </div>
  );
}
