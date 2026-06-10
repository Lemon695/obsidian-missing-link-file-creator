import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/react/hooks/useDebounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Notice } from "obsidian";
import { useObsidian, useActiveFile } from "@/react/context/ObsidianContext";
import { MissingLinkData } from "@/utils/file-operations";
import { HistoryEntry } from "@/service/history-manager";
import { ScanModule } from "@/modules/scan/index";
import { t } from "@/i18n/locale";
import {
  RefreshCw, FilePlus, EyeOff, Vault, FileText, History,
  ChevronDown, ChevronRight, BarChart2, List, Search, CheckCircle2,
  Scan, Zap, FolderOpen, X, Check,
} from "lucide-react";

type ActiveTab = "links" | "history" | "stats";
type SortField = "count" | "name";
type SortDir = "asc" | "desc";
type ScopeMode = "vault" | "active";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const TABS = [
  { key: "links", labelKey: "linksTab" },
  { key: "stats", labelKey: "statsTab" },
  { key: "history", labelKey: "historyTab" },
] as const satisfies ReadonlyArray<{ key: ActiveTab; labelKey: string }>;

// ── Group helpers ─────────────────────────────────────────────────────────────

type DashGroup = {
  folder: string;
  ruleName?: string;
  items: MissingLinkData[];
  isUnmatched: boolean;
  key: string;
};

function groupLinks(items: MissingLinkData[]): DashGroup[] {
  const folderMap = new Map<string, DashGroup>();
  for (const item of items) {
    if (!item.ruleMatch) {
      const k = "__unmatched__";
      if (!folderMap.has(k)) folderMap.set(k, { folder: "", ruleName: undefined, items: [], isUnmatched: true, key: k });
      folderMap.get(k)!.items.push(item);
      continue;
    }
    const lastSlash = item.filePath.lastIndexOf("/");
    const folder = lastSlash > 0 ? item.filePath.slice(0, lastSlash) : "__root__";
    const k = folder;
    if (!folderMap.has(k)) {
      folderMap.set(k, { folder: folder === "__root__" ? "" : folder, ruleName: item.ruleMatch.name, items: [], isUnmatched: false, key: k });
    }
    folderMap.get(k)!.items.push(item);
  }
  return Array.from(folderMap.values()).sort((a, b) => {
    if (a.isUnmatched !== b.isUnmatched) return a.isUnmatched ? 1 : -1;
    return a.folder.localeCompare(b.folder);
  });
}

// ── Flat row types for virtualizer ────────────────────────────────────────────

type FlatRow =
  | { type: "group-header"; group: DashGroup }
  | { type: "item"; item: MissingLinkData; groupKey: string };

const ROW_HEIGHT_HEADER = 40;
const ROW_HEIGHT_ITEM = 36;

// ── DashboardPanel ────────────────────────────────────────────────────────────

export function DashboardPanel({ onClose }: { onClose?: () => void }) {
  const { app, plugin } = useObsidian();
  const activeFile = useActiveFile(app);
  const [activeTab, setActiveTab] = useState<ActiveTab>("links");

  const [allLinks, setAllLinks] = useState<Map<string, MissingLinkData>>(new Map());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("vault");
  const [loading, setLoading] = useState(false);
  // 折叠状态：key → collapsed；初始全部折叠
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [allCollapsedInit, setAllCollapsedInit] = useState(false);

  const scrollParentRef = useRef<HTMLDivElement>(null);

  // ── 数据加载：优先读 ScanCache，避免重复全量扫描 ──────────────────────────
  const refreshData = useCallback(async (forceRescan = false) => {
    setLoading(true);
    try {
      const scanModule = plugin.moduleManager.get<ScanModule>("scan");
      const cache = scanModule?.scanCache;

      let links: Map<string, MissingLinkData>;
      if (!forceRescan && cache?.isFullScanDone()) {
        // 缓存命中：直接读，无 IO
        links = new Map(cache.getAll() as Map<string, MissingLinkData>);
      } else {
        // 缓存冷启动或强制刷新：全量扫描后写入缓存
        links = await plugin.fileOperations.scanVaultForMissingLinks();
        cache?.setFullScan(links);
      }
      setAllLinks(links);
      setSelectedKeys(new Set());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t("dashboardScanError", { message: msg }));
    } finally {
      setLoading(false);
    }
  }, [plugin]);

  useEffect(() => { void refreshData(); }, [refreshData]);

  // ── 过滤 + 排序 ────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let items = Array.from(allLinks.values());
    if (scopeMode === "active" && activeFile) {
      items = items.filter((item) => item.sourceFiles.has(activeFile.path));
    } else if (scopeMode === "active") {
      items = [];
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter((item) => item.filePath.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      const r = sortField === "count"
        ? a.occurrenceCount - b.occurrenceCount
        : (a.filePath.split("/").pop() || "").localeCompare(b.filePath.split("/").pop() || "");
      return sortDir === "asc" ? r : -r;
    });
    return items;
  }, [allLinks, scopeMode, activeFile, debouncedSearch, sortField, sortDir]);

  const displayGroups = useMemo(() => groupLinks(filteredItems), [filteredItems]);

  // 分组加载后，初始化折叠状态（全部折叠）
  useEffect(() => {
    if (!allCollapsedInit && displayGroups.length > 0) {
      setCollapsedGroups(new Set(displayGroups.map((g) => g.key)));
      setAllCollapsedInit(true);
    }
  }, [displayGroups, allCollapsedInit]);

  const matchedCount = useMemo(() => filteredItems.filter((i) => i.ruleMatch).length, [filteredItems]);
  const unmatchedCount = filteredItems.length - matchedCount;

  // ── 展平为虚拟行 ───────────────────────────────────────────────────────────
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const group of displayGroups) {
      rows.push({ type: "group-header", group });
      if (!collapsedGroups.has(group.key)) {
        for (const item of group.items) {
          rows.push({ type: "item", item, groupKey: group.key });
        }
      }
    }
    return rows;
  }, [displayGroups, collapsedGroups]);

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (i) => flatRows[i]?.type === "group-header" ? ROW_HEIGHT_HEADER : ROW_HEIGHT_ITEM,
    overscan: 8,
  });

  // ── 操作回调 ───────────────────────────────────────────────────────────────
  const toggleCollapse = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allKeys = filteredItems.map((i) => i.filePath);
    const allSelected = allKeys.every((k) => selectedKeys.has(k));
    setSelectedKeys(allSelected ? new Set() : new Set(allKeys));
  }, [filteredItems, selectedKeys]);

  const createFiles = useCallback(async (keys: string[]) => {
    let failed = 0;
    for (const key of keys) {
      const data = allLinks.get(key);
      if (!data) { failed++; continue; }
      try {
        const src = app.workspace.getActiveFile();
        const result = await plugin.fileOperations.createSingleFileFromLink(data.filePath, src?.path);
        if (!result.success) failed++;
        else {
          const name = result.path?.split("/").pop()?.replace(".md", "") || data.filePath;
          new Notice(data.ruleMatch?.name
            ? t("sideViewCreatedWithRule", { file: name, rule: data.ruleMatch.name })
            : t("sideViewCreatedNoRule", { file: name }), 2500);
        }
      } catch { failed++; }
    }
    if (failed > 0) new Notice(t("dashboardCreateFailedCount", { count: String(failed) }));
    setAllLinks((prev) => { const next = new Map(prev); keys.forEach((k) => next.delete(k)); return next; });
    setSelectedKeys((prev) => { const next = new Set(prev); keys.forEach((k) => next.delete(k)); return next; });
  }, [allLinks, app, plugin]);

  const handleIgnore = useCallback(async (key: string) => {
    await plugin.fileOperations.addToIgnoreList(key);
    setAllLinks((prev) => { const next = new Map(prev); next.delete(key); return next; });
    setSelectedKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    new Notice(t("sideViewIgnored", { file: key.split("/").pop() || key }));
  }, [plugin]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="ccmd-dash">
      {/* Header */}
      <div className="ccmd-dash__head">
        <div className="ccmd-dash__head-row">
          <Scan size={19} className="ccmd-dash__head-icon" />
          <h2 className="ccmd-dash__title">{t("dashboardTitle")}</h2>
          <span className="ccmd-modal__footer-spacer" />
          <button className="ccmd-btn ccmd-btn--sm" onClick={() => refreshData(true)} title={t("dashboardRefreshTooltip")}>
            <RefreshCw size={14} />
          </button>
          {activeTab === "links" && filteredItems.length > 0 && (
            <button
              className="ccmd-btn ccmd-btn--cta ccmd-btn--sm"
              onClick={() => createFiles(filteredItems.map((i) => i.filePath))}
            >
              <Zap size={14} />
              {t("dashboardCreateAll", { count: String(filteredItems.length) })}
            </button>
          )}
          {onClose && (
            <button className="ccmd-modal__close" onClick={onClose} title={t("close")} aria-label={t("close")}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className="ccmd-tabs ccmd-dash__tabs" role="tablist">
          {TABS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={cx("ccmd-tab", activeTab === key && "ccmd-tab--active")}
              onClick={() => setActiveTab(key)}
            >
              {key === "links" && <List size={14} />}
              {key === "stats" && <BarChart2 size={14} />}
              {key === "history" && <History size={14} />}
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Links tab */}
      {activeTab === "links" && (
        <>
          {/* Toolbar */}
          <div className="ccmd-dash__toolbar">
            <div className="ccmd-search">
              <Search />
              <input
                type="text"
                value={searchQuery}
                placeholder={t("dashboardSearchPlaceholder")}
                onChange={(e) => { setSearchQuery(e.target.value); }}
              />
            </div>
            <button
              className={cx("ccmd-iconbtn", scopeMode === "active" && "ccmd-iconbtn--active")}
              onClick={() => setScopeMode((m) => m === "vault" ? "active" : "vault")}
              title={scopeMode === "vault" ? t("dashboardScopeVault") : t("dashboardScopeActive")}
            >
              {scopeMode === "vault" ? <Vault size={16} /> : <FileText size={16} />}
            </button>
            <select
              className="ccmd-dash__sort-select"
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split("-");
                setSortField(f as SortField);
                setSortDir(d as SortDir);
              }}
            >
              <option value="count-desc">{t("dashboardSortCountDesc")}</option>
              <option value="count-asc">{t("dashboardSortCountAsc")}</option>
              <option value="name-asc">{t("dashboardSortNameAsc")}</option>
              <option value="name-desc">{t("dashboardSortNameDesc")}</option>
            </select>
          </div>

          {/* Summary strip */}
          {!loading && filteredItems.length > 0 && (
            <div className="ccmd-dash__summary">
              <div className="ccmd-dash__summary-card">
                <div className="ccmd-dash__summary-label">{t("statsTotalMissing")}</div>
                <div className="ccmd-dash__summary-num" data-kind="accent">{filteredItems.length}</div>
              </div>
              <div className="ccmd-dash__summary-card">
                <div className="ccmd-dash__summary-label">{t("statsRuleHit")}</div>
                <div className="ccmd-dash__summary-num" data-kind="success">{matchedCount}</div>
              </div>
              <div className="ccmd-dash__summary-card">
                <div className="ccmd-dash__summary-label">{t("dashboardUnmatched")}</div>
                <div className="ccmd-dash__summary-num" data-kind="warn">{unmatchedCount}</div>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="ccmd-dash__body">
              <div className="ccmd-dash__loading">
                {[...Array(5)].map((_, i) => <div key={i} className="ccmd-skeleton" />)}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredItems.length === 0 && (
            <div className="ccmd-dash__body">
              <div className="ccmd-empty-state ccmd-empty-state--fill">
                <div className={cx("ccmd-empty-state__icon", !debouncedSearch && "ccmd-empty-state__icon--success")}>
                  {debouncedSearch ? <Search size={24} /> : <CheckCircle2 size={24} />}
                </div>
                <div className="ccmd-empty-state__title">
                  {debouncedSearch ? t("dashboardNoMatchesTitle") : t("dashboardAllClearTitle")}
                </div>
                <div className="ccmd-empty-state__desc">
                  {debouncedSearch ? t("dashboardNoMatchesDesc", { query: debouncedSearch }) : t("dashboardAllClearDesc")}
                </div>
              </div>
            </div>
          )}

          {/* Virtual list */}
          {!loading && filteredItems.length > 0 && (
            <div className="ccmd-dash__body ccmd-dash__body--virtual" ref={scrollParentRef}>
              <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
                {virtualizer.getVirtualItems().map((vItem) => {
                  const row = flatRows[vItem.index];
                  if (!row) return null;
                  return (
                    <div
                      key={vItem.key}
                      data-index={vItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vItem.start}px)`,
                      }}
                    >
                      {row.type === "group-header" ? (
                        <VirtualGroupHeader
                          group={row.group}
                          collapsed={collapsedGroups.has(row.group.key)}
                          onToggleCollapse={() => toggleCollapse(row.group.key)}
                          onCreateGroup={() => createFiles(row.group.items.map((i) => i.filePath))}
                        />
                      ) : (
                        <VirtualGroupRow
                          item={row.item}
                          selected={selectedKeys.has(row.item.filePath)}
                          onToggle={() => toggleSelect(row.item.filePath)}
                          onCreate={() => createFiles([row.item.filePath])}
                          onIgnore={() => handleIgnore(row.item.filePath)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          {!loading && filteredItems.length > 0 && (
            <div className="ccmd-dash__foot">
              <span className="ccmd-dash__foot-info">
                {t("dashboardFooterInfo", { total: String(filteredItems.length), selected: String(selectedKeys.size) })}
              </span>
              <span className="ccmd-modal__footer-spacer" />
              <button className="ccmd-btn ccmd-btn--sm" onClick={toggleSelectAll}>
                {t("dashboardSelectAll")}
              </button>
              <button
                className="ccmd-btn ccmd-btn--cta ccmd-btn--sm"
                disabled={selectedKeys.size === 0}
                onClick={() => createFiles(Array.from(selectedKeys))}
              >
                <FilePlus size={13} />
                {t("dashboardCreateSelected")}
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "stats" && <StatsPanel allLinks={allLinks} />}
      {activeTab === "history" && <HistoryPanel plugin={plugin} />}
    </div>
  );
}

// ── Virtual row components ────────────────────────────────────────────────────

function VirtualGroupHeader({
  group, collapsed, onToggleCollapse, onCreateGroup,
}: {
  group: DashGroup;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateGroup: () => void;
}) {
  const label = group.isUnmatched ? t("dashboardUnmatched") : (group.folder || t("defaultValue"));
  return (
    <div className="ccmd-dash-group__head">
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={onToggleCollapse}>
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>
      <FolderOpen size={14} className="ccmd-dash-group__folder-icon" />
      <span className="ccmd-dash-group__path" title={group.folder}>{label}</span>
      {group.ruleName && <span className="ccmd-badge ccmd-badge--accent">{group.ruleName}</span>}
      <span className="ccmd-badge ccmd-badge--count">{group.items.length}</span>
      <span className="ccmd-modal__footer-spacer" />
      <button className="ccmd-btn ccmd-btn--sm" onClick={onCreateGroup}>
        <FilePlus size={13} />
        {t("dashboardCreateGroup")}
      </button>
    </div>
  );
}

function VirtualGroupRow({
  item, selected, onToggle, onCreate, onIgnore,
}: {
  item: MissingLinkData;
  selected: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onIgnore: () => void;
}) {
  const displayName = item.filePath.split("/").pop() || item.filePath;
  return (
    <div className={cx("ccmd-list__item ccmd-dash-group__row", selected && "ccmd-list__item--selected")}>
      <span
        className={cx("ccmd-check ccmd-dash-group__check", selected && "ccmd-check--on")}
        onClick={onToggle}
        data-state={selected ? "checked" : "unchecked"}
      >
        <Check size={12} />
      </span>
      <span className="ccmd-dash-group__name" title={item.filePath}>{displayName}</span>
      <span className="ccmd-modal__footer-spacer" />
      <span className="ccmd-dash-group__ref">
        {t("dashboardRefLabel")}
        <span className="ccmd-badge ccmd-badge--count">×{item.occurrenceCount}</span>
      </span>
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={onIgnore} title={t("sideViewIgnoreTooltip")}>
        <EyeOff size={13} />
      </button>
      <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={onCreate} title={t("sideViewCreateTooltip")}>
        <FilePlus size={13} />
      </button>
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ allLinks }: { allLinks: Map<string, MissingLinkData> }) {
  const total = allLinks.size;
  const top10 = useMemo(() =>
    Array.from(allLinks.values()).sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 10),
    [allLinks]
  );
  const matchedCount = useMemo(() => {
    let c = 0;
    for (const d of allLinks.values()) if (d.ruleMatch) c++;
    return c;
  }, [allLinks]);
  const hitPct = total > 0 ? Math.round((matchedCount / total) * 100) : 0;

  return (
    <div className="ccmd-dash__body ccmd-scroll">
      <div className="ccmd-stats">
        <div className="ccmd-stats__card">
          <div className="ccmd-stats__card-label">{t("statsTotalMissing")}</div>
          <div className="ccmd-stats__card-num">{total}</div>
        </div>
        <div className="ccmd-stats__card">
          <div className="ccmd-stats__card-label">{t("statsRuleHit")}</div>
          <div className="ccmd-stats__card-val">
            {t("statsRuleHitValue", { matched: String(matchedCount), total: String(total), pct: String(hitPct) })}
          </div>
          {total > 0 && (
            <div className="ccmd-meter">
              <div className="ccmd-meter__fill" style={{ ["--meter" as string]: `${hitPct}%` } as React.CSSProperties} />
            </div>
          )}
        </div>
        <div>
          <div className="ccmd-section-label">{t("statsTopMissing")}</div>
          {top10.length === 0 ? (
            <div className="ccmd-empty-state__desc">{t("dashboardAllClearTitle")}</div>
          ) : top10.map((data, idx) => {
            const name = data.filePath.split("/").pop() || data.filePath;
            const pct = top10[0].occurrenceCount > 0 ? Math.round((data.occurrenceCount / top10[0].occurrenceCount) * 100) : 0;
            return (
              <div key={data.filePath} className="ccmd-stats__rank">
                <span className="ccmd-stats__rank-no">{idx + 1}</span>
                <div className="ccmd-stats__rank-main">
                  <div className="ccmd-stats__rank-head">
                    <span className="ccmd-stats__rank-name" title={data.filePath}>{name}</span>
                    <span className="ccmd-badge ccmd-badge--count">{data.occurrenceCount}</span>
                  </div>
                  <div className="ccmd-meter">
                    <div className="ccmd-meter__fill" style={{ ["--meter" as string]: `${pct}%` } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ plugin }: { plugin: ReturnType<typeof useObsidian>["plugin"] }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    if (plugin.historyManager) setEntries(plugin.historyManager.getEntries());
  }, [plugin.historyManager]);

  if (entries.length === 0) {
    return (
      <div className="ccmd-dash__body">
        <div className="ccmd-empty-state ccmd-empty-state--fill">
          <div className="ccmd-empty-state__icon"><History size={24} /></div>
          <div className="ccmd-empty-state__title">{t("historyEmpty")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ccmd-dash__body ccmd-scroll">
      <div className="ccmd-hist-row ccmd-hist-row--head">
        <div>{t("historyColTime")}</div>
        <div>{t("historyColFile")}</div>
        <div>{t("historyColRule")}</div>
        <div>{t("historyColSource")}</div>
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="ccmd-hist-row">
          <div className="ccmd-hist-row__time">{new Date(entry.timestamp).toLocaleTimeString()}</div>
          <div className="ccmd-hist-row__cell" title={entry.filePath}>
            {entry.filePath.split("/").pop()?.replace(".md", "") || entry.filePath}
          </div>
          <div>
            {entry.ruleName
              ? <span className="ccmd-badge ccmd-badge--accent">{entry.ruleName}</span>
              : <span className="ccmd-badge">{t("noneValue")}</span>}
          </div>
          <div className="ccmd-hist-row__muted" title={entry.sourcePath}>
            {entry.sourcePath?.split("/").pop()?.replace(".md", "") || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
