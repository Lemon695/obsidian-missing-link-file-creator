import React, { useState, useCallback, useMemo } from "react";
import { Notice } from "obsidian";
import { useObsidian } from "@/react/context/ObsidianContext";
import { FileCreationRule } from "@/model/rule-types";
import { ConditionMatchType, ConditionOperator } from "@/model/condition-types";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
import { ScrollArea } from "@/react/components/ui/scroll-area";
import { SearchBar } from "@/react/components/shared/SearchBar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/react/components/ui/table";
import {
  Pencil, Trash2, ArrowUp, ArrowDown, Plus, X, FileText,
} from "lucide-react";

interface RuleManagementDialogProps {
  onOpenEditModal: (rule: FileCreationRule, onSave: (rule: FileCreationRule) => void) => void;
  onClose: () => void;
}

export function RuleManagementDialog({ onOpenEditModal, onClose }: RuleManagementDialogProps) {
  const { plugin } = useObsidian();
  const [searchQuery, setSearchQuery] = useState("");
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  const rules = useMemo(() => {
    let list = [...(plugin.settings.rules || [])].sort((a, b) => a.priority - b.priority);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.targetFolder?.toLowerCase().includes(q) ||
          r.templatePath?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [plugin.settings.rules, searchQuery, forceUpdate]);

  const createNewRule = useCallback(() => {
    const newRule: FileCreationRule = {
      id: `rule-${Date.now()}`,
      name: t("createRule"),
      enabled: true,
      conditions: [{ id: `cond-${Date.now()}`, type: ConditionMatchType.CONTAINS, pattern: "", operator: ConditionOperator.AND }],
      targetFolder: "",
      templatePath: "",
      priority: plugin.settings.rules?.length || 0,
    };
    onOpenEditModal(newRule, (updatedRule) => {
      if (!plugin.settings.rules) plugin.settings.rules = [];
      plugin.settings.rules.push(updatedRule);
      plugin.saveSettings();
      refresh();
    });
  }, [plugin, onOpenEditModal, refresh]);

  const editRule = useCallback((rule: FileCreationRule) => {
    onOpenEditModal({ ...rule }, async (updatedRule) => {
      const idx = plugin.settings.rules.findIndex((r) => r.id === rule.id);
      if (idx !== -1) {
        plugin.settings.rules[idx] = updatedRule;
        await plugin.saveSettings();
        refresh();
      }
    });
  }, [plugin, onOpenEditModal, refresh]);

  const deleteRule = useCallback(async (ruleId: string) => {
    plugin.settings.rules = plugin.settings.rules.filter((r) => r.id !== ruleId);
    plugin.settings.rules.forEach((r, i) => (r.priority = i));
    await plugin.saveSettings();
    refresh();
    new Notice(t("ruleDeleted"));
  }, [plugin, refresh]);

  const moveRule = useCallback(async (index: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= plugin.settings.rules.length) return;
    const a = plugin.settings.rules[index];
    const b = plugin.settings.rules[swapIdx];
    if (direction === "up") { a.priority--; b.priority++; } else { a.priority++; b.priority--; }
    plugin.settings.rules.sort((x, y) => x.priority - y.priority);
    await plugin.saveSettings();
    refresh();
  }, [plugin, refresh]);

  const toggleEnabled = useCallback(async (rule: FileCreationRule) => {
    rule.enabled = !rule.enabled;
    await plugin.saveSettings();
    refresh();
  }, [plugin, refresh]);

  const getConditionsDesc = (rule: FileCreationRule): string => {
    if (!rule.conditions || rule.conditions.length === 0) return t("noMatchConditions");
    return rule.conditions.map((c) => `${c.operator} ${c.type} "${c.pattern}"`).join("; ");
  };

  return (
    <div
      className="tw-flex tw-flex-col tw-gap-4 tw-h-full"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
          e.preventDefault();
          createNewRule();
        }
      }}
    >
      {/* Header */}
      <div className="tw-pb-3 tw-border-b tw-border-border">
        <h2 className="tw-m-0 tw-text-xl tw-font-semibold">{t("fileCreationRulesManagement")}</h2>
        <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-muted-foreground">{t("rulesManagementDescription")}</p>
      </div>

      {/* Search */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={t("searchRules")} />

      {/* Rules list */}
      <ScrollArea className="tw-flex-1 tw-min-h-[400px] tw-border tw-border-border tw-rounded-lg">
        {rules.length === 0 && !searchQuery && (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-p-12 tw-text-center">
            <FileText className="tw-h-12 tw-w-12 tw-text-muted-foreground tw-mb-4" />
            <h3 className="tw-text-lg tw-font-semibold tw-mb-2">{t("noRulesCreatedYet")}</h3>
            <p className="tw-text-sm tw-text-muted-foreground tw-max-w-[400px] tw-mb-4">{t("rulesAutomateDescription")}</p>
            <Button onClick={createNewRule}>{t("createFirstRule")}</Button>
          </div>
        )}

        {rules.length === 0 && searchQuery && (
          <div className="tw-flex tw-items-center tw-justify-center tw-p-12 tw-text-muted-foreground">
            No rules match "{searchQuery}"
          </div>
        )}

        {rules.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="tw-w-[60px]"></TableHead>
                <TableHead className="tw-w-[180px]">{t("ruleName")}</TableHead>
                <TableHead>{t("matchConditions")}</TableHead>
                <TableHead className="tw-w-[140px]">{t("targetFolder")}</TableHead>
                <TableHead className="tw-w-[140px]">{t("useTemplate")}</TableHead>
                <TableHead className="tw-w-[120px]">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule, index) => (
                <TableRow key={rule.id} className={rule.enabled ? "" : "tw-opacity-50"}>
                  <TableCell>
                    <button
                      type="button"
                      className="tw-w-10 tw-h-5 tw-rounded-full tw-border tw-cursor-pointer tw-transition-colors"
                      style={{ backgroundColor: rule.enabled ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
                      onClick={() => toggleEnabled(rule)}
                      title={rule.enabled ? t("enabled") : t("disabled")}
                      aria-label={rule.enabled ? t("enabled") : t("disabled")}
                      aria-pressed={rule.enabled}
                    />
                  </TableCell>
                  <TableCell className={`tw-font-medium ${!rule.enabled ? "tw-line-through tw-text-muted-foreground" : ""}`}>
                    {rule.name}
                  </TableCell>
                  <TableCell className="tw-text-muted-foreground tw-truncate tw-max-w-[300px]" title={getConditionsDesc(rule)}>
                    {getConditionsDesc(rule)}
                  </TableCell>
                  <TableCell>
                    <code className="tw-text-xs tw-px-2 tw-py-1 tw-bg-secondary tw-rounded tw-border-l-2 tw-border-l-green-500">
                      {rule.targetFolder || t("defaultValue")}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="tw-text-xs tw-px-2 tw-py-1 tw-bg-secondary tw-rounded tw-border-l-2 tw-border-l-blue-500">
                      {rule.templatePath || t("noneValue")}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="tw-flex tw-gap-1">
                      <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={() => editRule(rule)} title={t("editRule")} aria-label={t("editRule")}>
                        <Pencil className="tw-h-3.5 tw-w-3.5" />
                      </Button>
                      {index > 0 && (
                        <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={() => moveRule(index, "up")} title={t("moveUp")} aria-label={t("moveUp")}>
                          <ArrowUp className="tw-h-3.5 tw-w-3.5" />
                        </Button>
                      )}
                      {index < rules.length - 1 && (
                        <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={() => moveRule(index, "down")} title={t("moveDown")} aria-label={t("moveDown")}>
                          <ArrowDown className="tw-h-3.5 tw-w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7 tw-text-destructive" onClick={() => deleteRule(rule.id)} title={t("deleteRule")} aria-label={t("deleteRule")}>
                        <Trash2 className="tw-h-3.5 tw-w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="tw-flex tw-justify-end tw-gap-3 tw-pt-3 tw-border-t tw-border-border">
        <Button onClick={createNewRule}>
          <Plus className="tw-h-4 tw-w-4 tw-mr-1" />
          {t("addRule")}
        </Button>
        <Button variant="outline" onClick={onClose}>{t("close")}</Button>
      </div>
    </div>
  );
}
