import React, { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/react/hooks/useDebounce";
import { Notice } from "obsidian";
import { useObsidian } from "@/react/context/ObsidianContext";
import { FileCreationRule } from "@/model/rule-types";
import { ConditionMatchType, ConditionOperator } from "@/model/condition-types";
import { RuleManager } from "@/model/rule-manager";
import { filterRules, RuleFilterMode } from "@/utils/rule-filter";
import { groupRules, flattenGroupsToPriority, RuleGroup } from "@/utils/rule-grouping";
import { buildFolderTree, type FolderTreeNode } from "@/utils/folder-tree";
import { t } from "@/i18n/locale";
import {
  Pencil, Trash2, Plus, X, FileText, FolderOpen,
  Download, Upload, FlaskConical, Search, Filter,
  GripVertical, Sliders, Layers, ChevronRight, ChevronDown, Copy,
  CheckSquare, Network, Check, MoreHorizontal, Eye, EyeOff,
} from "lucide-react";
import { RuleTestDialog } from "./RuleTestDialog";
import { GenericInputDialog } from "./GenericInputDialog";

interface RuleManagementDialogProps {
  onOpenEditModal: (rule: FileCreationRule, onSave: (rule: FileCreationRule) => void) => void;
  onClose: () => void;
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function ruleHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function matchTypeLabel(type: ConditionMatchType): string {
  switch (type) {
    case ConditionMatchType.CONTAINS: return t("contains");
    case ConditionMatchType.STARTS_WITH: return t("beginsWith");
    case ConditionMatchType.ENDS_WITH: return t("endsWith");
    case ConditionMatchType.EXACT: return t("matches");
    case ConditionMatchType.REGEX: return t("regex");
    case ConditionMatchType.FRONTMATTER: return "Frontmatter";
    default: return String(type);
  }
}

const FILTER_PILLS = [
  { mode: "all", labelKey: "ruleFilterAll" },
  { mode: "enabled", labelKey: "ruleFilterEnabled" },
  { mode: "disabled", labelKey: "ruleFilterDisabled" },
  { mode: "noTemplate", labelKey: "ruleFilterNoTemplate" },
] as const satisfies ReadonlyArray<{ mode: RuleFilterMode; labelKey: string }>;

export function RuleManagementDialog({ onOpenEditModal, onClose }: RuleManagementDialogProps) {
  const { plugin } = useObsidian();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterMode, setFilterMode] = useState<RuleFilterMode>("all");
  type SortMode = "priority" | "name-asc" | "name-desc";
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [showTree, setShowTree] = useState(false);

  // Grouped-view state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragGroupKey, setDragGroupKey] = useState<string | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [overGroupKey, setOverGroupKey] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const ruleManager = useMemo(() => new RuleManager(plugin.app, plugin.settings), [plugin]);

  const sortedAll = useMemo(
    () => [...(plugin.settings.rules || [])].sort((a, b) => a.priority - b.priority),
    [plugin.settings.rules, forceUpdate]
  );

  const counts = useMemo(
    () => ({
      all: sortedAll.length,
      enabled: filterRules(sortedAll, "enabled").length,
      disabled: filterRules(sortedAll, "disabled").length,
      noTemplate: filterRules(sortedAll, "noTemplate").length,
    }),
    [sortedAll]
  );

  const displayRules = useMemo(() => {
    const byMode = filterRules(sortedAll, filterMode);
    let filtered = byMode;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = byMode.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.targetFolder?.toLowerCase().includes(q) ||
          r.templatePath?.toLowerCase().includes(q)
      );
    }
    if (sortMode === "name-asc") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === "name-desc") return [...filtered].sort((a, b) => b.name.localeCompare(a.name));
    return filtered; // "priority" — already sorted by sortedAll
  }, [sortedAll, filterMode, debouncedSearch, sortMode]);

  const displayGroups = useMemo(() => groupRules(displayRules), [displayRules]);

  // Drag only when full unfiltered priority-sorted view (display index === priority)
  const canReorder = filterMode === "all" && !searchQuery && sortMode === "priority";

  // ── CRUD ──────────────────────────────────────────────────────────────────

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
      void plugin.saveSettings();
      refresh();
    });
  }, [plugin, onOpenEditModal, refresh]);

  const editRule = useCallback((rule: FileCreationRule) => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onOpenEditModal({ ...rule }, async (updatedRule) => {
      const idx = plugin.settings.rules.findIndex((r) => r.id === rule.id);
      if (idx !== -1) {
        plugin.settings.rules[idx] = updatedRule;
        await plugin.saveSettings();
        refresh();
      }
    });
  }, [plugin, onOpenEditModal, refresh]);

  const duplicateRule = useCallback((rule: FileCreationRule) => {
    const newRule: FileCreationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (copy)`,
      priority: plugin.settings.rules?.length || 0,
    };
    if (!plugin.settings.rules) plugin.settings.rules = [];
    plugin.settings.rules.push(newRule);
    void plugin.saveSettings();
    refresh();
  }, [plugin, refresh]);

  const deleteRule = useCallback(async (ruleId: string) => {
    plugin.settings.rules = plugin.settings.rules.filter((r) => r.id !== ruleId);
    plugin.settings.rules.forEach((r, i) => (r.priority = i));
    await plugin.saveSettings();
    refresh();
    new Notice(t("ruleDeleted"));
  }, [plugin, refresh]);

  const toggleEnabled = useCallback(async (rule: FileCreationRule) => {
    rule.enabled = !rule.enabled;
    await plugin.saveSettings();
    refresh();
  }, [plugin, refresh]);

  const toggleGroupEnabled = useCallback(async (groupKey: string) => {
    const currentGroups = groupRules(sortedAll);
    const group = currentGroups.find((g) => g.key === groupKey);
    if (!group) return;
    const newEnabled = !group.rules.every((r) => r.enabled);
    plugin.settings.rules = plugin.settings.rules.map((r) =>
      group.rules.some((gr) => gr.id === r.id) ? { ...r, enabled: newEnabled } : r
    );
    await plugin.saveSettings();
    refresh();
  }, [sortedAll, plugin, refresh]);

  // ── Batch selection ────────────────────────────────────────────────────────

  const toggleSelectRule = useCallback((ruleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const batchEnable = useCallback(async () => {
    plugin.settings.rules = plugin.settings.rules.map((r) =>
      selectedIds.has(r.id) ? { ...r, enabled: true } : r
    );
    await plugin.saveSettings();
    clearSelection();
    refresh();
  }, [selectedIds, plugin, clearSelection, refresh]);

  const batchDelete = useCallback(async () => {
    const count = selectedIds.size;
    plugin.settings.rules = plugin.settings.rules
      .filter((r) => !selectedIds.has(r.id))
      .map((r, i) => ({ ...r, priority: i }));
    await plugin.saveSettings();
    clearSelection();
    refresh();
    new Notice(`${t("ruleDeleted")} ×${count}`);
  }, [selectedIds, plugin, clearSelection, refresh]);

  const batchChangeFolder = useCallback(async (newFolder: string) => {
    plugin.settings.rules = plugin.settings.rules.map((r) =>
      selectedIds.has(r.id) ? { ...r, targetFolder: newFolder } : r
    );
    await plugin.saveSettings();
    clearSelection();
    setShowFolderInput(false);
    refresh();
  }, [selectedIds, plugin, clearSelection, refresh]);

  // ── Drag-and-drop (group-internal) ────────────────────────────────────────

  const handleGroupDrop = useCallback(async (groupKey: string, from: number, to: number) => {
    if (from === to) return;
    const currentGroups = groupRules(sortedAll);
    const newGroups = currentGroups.map((g) => {
      if (g.key !== groupKey) return g;
      const newRules = [...g.rules];
      const [moved] = newRules.splice(from, 1);
      newRules.splice(to, 0, moved);
      return { ...g, rules: newRules };
    });
    plugin.settings.rules = flattenGroupsToPriority(newGroups);
    await plugin.saveSettings();
    refresh();
  }, [sortedAll, plugin, refresh]);

  const handleDragStart = useCallback((groupKey: string, idx: number) => {
    setDragGroupKey(groupKey);
    setDragFromIdx(idx);
  }, []);

  const handleDragOver = useCallback((groupKey: string, idx: number) => {
    setOverGroupKey(groupKey);
    setOverIdx((prev) => (prev === idx ? prev : idx));
  }, []);

  const handleDrop = useCallback((groupKey: string, to: number) => {
    if (dragGroupKey === groupKey && dragFromIdx !== null) {
      void handleGroupDrop(groupKey, dragFromIdx, to);
    }
    setDragGroupKey(null);
    setDragFromIdx(null);
    setOverGroupKey(null);
    setOverIdx(null);
  }, [dragGroupKey, dragFromIdx, handleGroupDrop]);

  const handleDragEnd = useCallback(() => {
    setDragGroupKey(null);
    setDragFromIdx(null);
    setOverGroupKey(null);
    setOverIdx(null);
  }, []);

  // ── Import/export ──────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    try {
      const json = ruleManager.exportRules();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = activeDocument.createElement("a");
      a.href = url;
      a.download = "missing-link-rules.json";
      a.click();
      URL.revokeObjectURL(url);
      new Notice(t("rulesExported"));
    } catch (err) {
      new Notice(t("importRulesError").replace("{message}", String(err)));
    }
  }, [ruleManager]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        // eslint-disable-next-line no-alert
        const mode = confirm(
          `${t("importModeOverwrite")} → OK\n${t("importModeMerge")} → Cancel`
        ) ? "overwrite" : "merge";
        ruleManager.importRules(text, mode);
        await plugin.saveSettings();
        new Notice(t("rulesImported"));
        refresh();
      } catch (err) {
        new Notice(t("importRulesError").replace("{message}", String(err)));
      }
      if (importInputRef.current) importInputRef.current.value = "";
    },
    [ruleManager, plugin, refresh]
  );

  if (showTestDialog) {
    return <RuleTestDialog onClose={() => setShowTestDialog(false)} />;
  }

  return (
    <div
      className="ccmd-modal"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
          e.preventDefault();
          createNewRule();
        }
      }}
    >
      {/* Header */}
      <div className="ccmd-modal__header">
        <Sliders size={22} />
        <div className="ccmd-modal__header-text">
          <h2 className="ccmd-modal__title">{t("fileCreationRulesManagement")}</h2>
          <p className="ccmd-modal__subtitle">{t("rulesGroupedSubtitle")}</p>
        </div>
        <button className="ccmd-modal__close" onClick={onClose} title={t("close")} aria-label={t("close")}>
          <X size={18} />
        </button>
      </div>

      {/* Toolbar: column layout — search full-width, filter pills below */}
      <div className="ccmd-rulemgmt__toolbar ccmd-rulemgmt__toolbar--bold">
        <div className="ccmd-search">
          <Search />
          <input
            type="text"
            value={searchQuery}
            placeholder={t("searchRules")}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="ccmd-rulemgmt__filter-row">
          <div className="ccmd-rulemgmt__filter-badges" role="tablist">
            {FILTER_PILLS.map(({ mode, labelKey }) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={filterMode === mode}
                className={cx("ccmd-filter-badge", filterMode === mode && "ccmd-filter-badge--active")}
                onClick={() => setFilterMode(mode)}
              >
                {filterMode === mode && <Check size={12} />}
                {t(labelKey)}{mode !== "all" ? ` ${counts[mode]}` : ""}
              </button>
            ))}
          </div>
          <span className="ccmd-modal__footer-spacer" />
          <select
            className="ccmd-rulemgmt__sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label="sort"
          >
            <option value="priority">{t("sortPriority")}</option>
            <option value="name-asc">{t("sortNameAsc")}</option>
            <option value="name-desc">{t("sortNameDesc")}</option>
          </select>
        </div>
      </div>

      {/* Selection action bar (visible when items are selected) */}
      {selectedIds.size > 0 && !showFolderInput && (
        <SelectionBar
          count={selectedIds.size}
          onEnable={batchEnable}
          onChangeFolder={() => setShowFolderInput(true)}
          onDelete={batchDelete}
          onClear={clearSelection}
        />
      )}

      {/* Rule list / folder input / tree overlay */}
      {showFolderInput ? (
        <div className="ccmd-rulemgmt__list ccmd-scroll" style={{ padding: "var(--sp-6)" }}>
          <GenericInputDialog
            header={t("batchChangeFolderHeader")}
            placeholder={t("batchChangeFolderPlaceholder")}
            onConfirm={batchChangeFolder}
            onCancel={() => setShowFolderInput(false)}
          />
        </div>
      ) : showTree ? (
        <div className="ccmd-rulemgmt__list ccmd-scroll ccmd-rulemgmt__tree-panel">
          <FolderTreeView rules={sortedAll} onClose={() => setShowTree(false)} />
        </div>
      ) : (
        <div className="ccmd-rulemgmt__list ccmd-scroll ccmd-list">
          {counts.all === 0 ? (
            <div className="ccmd-empty-state ccmd-empty-state--fill">
              <div className="ccmd-empty-state__icon"><FileText size={24} /></div>
              <div className="ccmd-empty-state__title">{t("noRulesCreatedYet")}</div>
              <div className="ccmd-empty-state__desc">{t("rulesAutomateDescription")}</div>
              <button className="ccmd-btn ccmd-btn--cta" onClick={createNewRule}>
                <Plus size={15} />
                {t("createFirstRule")}
              </button>
            </div>
          ) : displayRules.length === 0 ? (
            <div className="ccmd-empty-state ccmd-empty-state--fill">
              <div className="ccmd-empty-state__desc">
                {t("noRulesMatchSearch", { query: debouncedSearch || t(FILTER_PILLS.find((p) => p.mode === filterMode)!.labelKey) })}
              </div>
            </div>
          ) : (
            displayGroups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                isCollapsed={collapsedGroups.has(group.key)}
                canReorder={canReorder}
                selectedIds={selectedIds}
                dragGroupKey={dragGroupKey}
                dragFromIdx={dragFromIdx}
                overGroupKey={overGroupKey}
                overIdx={overIdx}
                onToggleCollapse={() =>
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                    return next;
                  })
                }
                onToggleGroup={toggleGroupEnabled}
                onToggleRule={toggleEnabled}
                onSelectRule={toggleSelectRule}
                onEdit={editRule}
                onDuplicate={duplicateRule}
                onDelete={deleteRule}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="ccmd-modal__footer">
        <button className="ccmd-btn ccmd-btn--sm" onClick={() => setShowTestDialog(true)} title={t("testRules")}>
          <FlaskConical size={14} />
          {t("testRules")}
        </button>
        <button
          className={cx("ccmd-btn ccmd-btn--sm", showTree && "ccmd-btn--accent")}
          onClick={() => setShowTree((v) => !v)}
          title={t("folderTreePreview")}
        >
          <Network size={14} />
          {t("folderTreePreview")}
        </button>
        <span className="ccmd-modal__footer-spacer" />
        <button className="ccmd-btn ccmd-btn--sm" onClick={handleExport} title={t("exportRules")}>
          <Download size={14} />
          {t("exportRules")}
        </button>
        <button className="ccmd-btn ccmd-btn--sm" onClick={() => importInputRef.current?.click()} title={t("importRules")}>
          <Upload size={14} />
          {t("importRules")}
        </button>
        <input ref={importInputRef} type="file" accept=".json" hidden onChange={handleImportFile} />
        <button className="ccmd-btn ccmd-btn--cta ccmd-btn--sm" onClick={createNewRule} title={t("addRule")}>
          <Plus size={14} />
          {t("addRule")}
        </button>
      </div>
    </div>
  );
}

// ── SelectionBar ─────────────────────────────────────────────────────────────

interface SelectionBarProps {
  count: number;
  onEnable: () => void;
  onChangeFolder: () => void;
  onDelete: () => void;
  onClear: () => void;
}

function SelectionBar({ count, onEnable, onChangeFolder, onDelete, onClear }: SelectionBarProps) {
  return (
    <div className="ccmd-rulemgmt__selbar">
      <CheckSquare size={14} className="ccmd-rulemgmt__selbar-icon" />
      <span className="ccmd-rulemgmt__selbar-count">
        {t("selectedCount", { count: String(count) })}
      </span>
      <span className="ccmd-modal__footer-spacer" />
      <button className="ccmd-btn ccmd-btn--sm ccmd-btn--accent" onClick={onEnable}>
        {t("batchEnable")}
      </button>
      <button className="ccmd-btn ccmd-btn--sm ccmd-btn--accent" onClick={onChangeFolder}>
        <FolderOpen size={13} />
        {t("batchChangeFolder")}
      </button>
      <button className="ccmd-btn ccmd-btn--sm ccmd-btn--danger" onClick={onDelete}>
        <Trash2 size={13} />
        {t("delete")}
      </button>
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={onClear} title={t("close")}>
        <X size={13} />
      </button>
    </div>
  );
}

// ── GroupSection ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: RuleGroup;
  isCollapsed: boolean;
  canReorder: boolean;
  selectedIds: Set<string>;
  dragGroupKey: string | null;
  dragFromIdx: number | null;
  overGroupKey: string | null;
  overIdx: number | null;
  onToggleCollapse: () => void;
  onToggleGroup: (groupKey: string) => void;
  onToggleRule: (rule: FileCreationRule) => void;
  onSelectRule: (ruleId: string) => void;
  onEdit: (rule: FileCreationRule) => void;
  onDuplicate: (rule: FileCreationRule) => void;
  onDelete: (ruleId: string) => void;
  onDragStart: (groupKey: string, idx: number) => void;
  onDragOver: (groupKey: string, idx: number) => void;
  onDrop: (groupKey: string, idx: number) => void;
  onDragEnd: () => void;
}

function GroupSection({
  group, isCollapsed, canReorder, selectedIds,
  dragGroupKey, dragFromIdx, overGroupKey, overIdx,
  onToggleCollapse, onToggleGroup, onToggleRule, onSelectRule,
  onEdit, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: GroupSectionProps) {
  const allEnabled = group.rules.every((r) => r.enabled);
  const label = group.label || t("ruleGroupOther");

  return (
    <div>
      {/* Group header */}
      <div className="ccmd-rulegroup__head">
        <button
          className="ccmd-iconbtn ccmd-iconbtn--sm"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "expand" : "collapse"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Layers size={13} className="ccmd-rulegroup__icon" />
        <span className="ccmd-rulegroup__name">{label}</span>
        <span className="ccmd-rulegroup__count">{group.rules.length}</span>
        <span className="ccmd-modal__footer-spacer" />
        <span className="ccmd-rulegroup__toggle-label">{t("ruleGroupWholeToggle")}</span>
        <button
          type="button"
          className={cx("ccmd-toggle ccmd-toggle--sm", allEnabled && "ccmd-toggle--on")}
          onClick={() => onToggleGroup(group.key)}
          aria-pressed={allEnabled}
        />
      </div>

      {/* Rows */}
      {!isCollapsed && group.rules.map((rule, idx) => (
        <BoldRuleRow
          key={rule.id}
          rule={rule}
          groupKey={group.key}
          indexInGroup={idx}
          canReorder={canReorder}
          isSelected={selectedIds.has(rule.id)}
          isDragging={dragGroupKey === group.key && dragFromIdx === idx}
          isDragOver={overGroupKey === group.key && overIdx === idx && dragFromIdx !== null && dragFromIdx !== idx}
          onToggle={onToggleRule}
          onSelect={onSelectRule}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}

// ── BoldRuleRow ───────────────────────────────────────────────────────────────

interface BoldRuleRowProps {
  rule: FileCreationRule;
  groupKey: string;
  indexInGroup: number;
  canReorder: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onToggle: (rule: FileCreationRule) => void;
  onSelect: (ruleId: string) => void;
  onEdit: (rule: FileCreationRule) => void;
  onDuplicate: (rule: FileCreationRule) => void;
  onDelete: (ruleId: string) => void;
  onDragStart: (groupKey: string, idx: number) => void;
  onDragOver: (groupKey: string, idx: number) => void;
  onDrop: (groupKey: string, idx: number) => void;
  onDragEnd: () => void;
}

function BoldRuleRow({
  rule, groupKey, indexInGroup, canReorder, isSelected, isDragging, isDragOver,
  onToggle, onSelect, onEdit, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: BoldRuleRowProps) {
  const templateTail = rule.templatePath
    ? rule.templatePath.split("/").pop()?.replace(/\.md$/, "")
    : undefined;
  const dotStyle = { ["--dot" as string]: `hsl(${ruleHue(rule.id)} 60% 55%)` } as React.CSSProperties;

  const firstCond = rule.conditions?.[0];

  return (
    <div
      className={cx("ccmd-list__item ccmd-rule-row--bold", isDragOver && "ccmd-rule-row--dragover", isSelected && "ccmd-rule-row--selected")}
      data-disabled={!rule.enabled || undefined}
      data-dragging={isDragging || undefined}
      draggable={canReorder}
      onDragStart={canReorder ? (e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(groupKey, indexInGroup); } : undefined}
      onDragOver={canReorder ? (e) => { e.preventDefault(); onDragOver(groupKey, indexInGroup); } : undefined}
      onDrop={canReorder ? (e) => { e.preventDefault(); onDrop(groupKey, indexInGroup); } : undefined}
      onDragEnd={canReorder ? onDragEnd : undefined}
    >
      {/* Grip */}
      {canReorder && (
        <span className="ccmd-rule-row__grip" aria-hidden="true" title={t("dragToReorder")}>
          <GripVertical size={14} />
        </span>
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        className="ccmd-rule-row-bold__check"
        checked={isSelected}
        onChange={() => onSelect(rule.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={rule.name}
      />

      {/* Main content: two lines */}
      <div className="ccmd-rule-row-bold__main">
        {/* Line 1: dot + name + disabled badge */}
        <div className="ccmd-rule-row-bold__line1">
          <span className="ccmd-rule-row__dot" style={dotStyle} />
          <span className="ccmd-rule-row__name-text" title={rule.name}>{rule.name}</span>
          {!rule.enabled && (
            <span className="ccmd-rule-row-bold__disabled-badge">{t("disabled")}</span>
          )}
        </div>
        {/* Line 2: filter icon + condition label + monospace pattern + folder chip */}
        <div className="ccmd-rule-row-bold__line2">
          <Filter size={11} />
          {firstCond ? (
            <>
              <span className="ccmd-condbadge">{matchTypeLabel(firstCond.type)}</span>
              <code>{firstCond.pattern}</code>
            </>
          ) : (
            <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>
              {t("noMatchConditions")}
            </span>
          )}
          <span className="ccmd-chip ccmd-chip--folder" title={rule.targetFolder || t("defaultValue")}>
            <FolderOpen size={11} />
            <span className="ccmd-chip__path">{rule.targetFolder || t("defaultValue")}</span>
          </span>
        </div>
      </div>

      {/* Template chip */}
      <span className="ccmd-chip ccmd-chip--template" title={rule.templatePath || t("noneValue")}>
        <FileText size={11} />
        <span className="ccmd-chip__path">{templateTail || t("noneValue")}</span>
      </span>

      {/* Row actions: edit / copy / more ⋯ */}
      <BoldRowActions
        rule={rule}
        onToggle={onToggle}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}

// ── BoldRowActions (edit / copy / more⋯) ─────────────────────────────────────

interface BoldRowActionsProps {
  rule: FileCreationRule;
  onToggle: (rule: FileCreationRule) => void;
  onEdit: (rule: FileCreationRule) => void;
  onDuplicate: (rule: FileCreationRule) => void;
  onDelete: (ruleId: string) => void;
}

function BoldRowActions({ rule, onToggle, onEdit, onDuplicate, onDelete }: BoldRowActionsProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="ccmd-rule-row__actions">
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={() => onEdit(rule)} title={t("editRule")}>
        <Pencil size={13} />
      </button>
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={() => onDuplicate(rule)} title={t("copyRule")}>
        <Copy size={13} />
      </button>
      <div className="ccmd-more-wrap">
        <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={() => setOpen((v) => !v)} title={t("more")}>
          <MoreHorizontal size={13} />
        </button>
        {open && (
          <>
            <div className="ccmd-more-backdrop" onClick={() => setOpen(false)} />
            <div className="ccmd-more-menu">
              <button onClick={() => { onToggle(rule); setOpen(false); }}>
                {rule.enabled ? <EyeOff size={13} /> : <Eye size={13} />}
                {rule.enabled ? t("disabled") : t("enabled")}
              </button>
              <div className="ccmd-more-menu__divider" />
              <button className="ccmd-more-menu__danger" onClick={() => { onDelete(rule.id); setOpen(false); }}>
                <Trash2 size={13} />
                {t("deleteRule")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── FolderTreeView ────────────────────────────────────────────────────────────

function FolderTreeView({ rules, onClose }: { rules: readonly FileCreationRule[]; onClose: () => void }) {
  const tree = buildFolderTree(rules);
  return (
    <div className="ccmd-foldertree">
      <div className="ccmd-foldertree__header">
        <Network size={14} />
        <span>{t("folderTreePreview")}</span>
        <span className="ccmd-modal__footer-spacer" />
        <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={onClose} title={t("close")}>
          <X size={13} />
        </button>
      </div>
      {tree.length === 0 ? (
        <div className="ccmd-empty-state" style={{ padding: "var(--sp-6) 0" }}>
          <div className="ccmd-empty-state__desc">{t("folderTreeEmpty")}</div>
        </div>
      ) : (
        <div className="ccmd-foldertree__body">
          {tree.map((node) => <TreeNodeRow key={node.path} node={node} depth={0} />)}
        </div>
      )}
    </div>
  );
}

function TreeNodeRow({ node, depth }: { node: FolderTreeNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className="ccmd-foldertree__row"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={hasChildren ? () => setCollapsed((v) => !v) : undefined}
      >
        {hasChildren ? (
          collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
        ) : (
          <span style={{ display: "inline-block", width: 12 }} />
        )}
        <FolderOpen size={13} className="ccmd-foldertree__icon" />
        <span className="ccmd-foldertree__name">{node.name}</span>
      </div>
      {!collapsed && node.children.map((child) => (
        <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
