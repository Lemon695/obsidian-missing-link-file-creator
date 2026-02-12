import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Notice, TFile } from "obsidian";
import { useObsidian, useActiveFile } from "@/react/context/ObsidianContext";
import { MissingLinkData } from "@/utils/file-operations";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
import { ScrollArea } from "@/react/components/ui/scroll-area";
import { CountBadge } from "@/react/components/shared/CountBadge";
import { Pagination } from "@/react/components/shared/Pagination";
import { SearchBar } from "@/react/components/shared/SearchBar";
import { Checkbox } from "@/react/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/react/components/ui/select";
import {
  RefreshCw, CheckSquare, Plus, EyeOff, Folder, List, Vault, FileText,
} from "lucide-react";

type SortField = "count" | "name";
type SortDir = "asc" | "desc";
type ScopeMode = "vault" | "active";

const ITEMS_PER_PAGE = 50;

export function DashboardPanel() {
  const { app, plugin } = useObsidian();
  const activeFile = useActiveFile(app);

  const [allLinks, setAllLinks] = useState<Map<string, MissingLinkData>>(new Map());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("vault");
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const links = await plugin.fileOperations.scanVaultForMissingLinks();
      setAllLinks(links);
      setSelectedKeys(new Set());
    } catch (e: any) {
      new Notice(t("dashboardScanError", { message: e.message }));
    } finally {
      setLoading(false);
    }
  }, [plugin]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Filtered + sorted data
  const filteredItems = useMemo(() => {
    let items = Array.from(allLinks.values());

    if (scopeMode === "active" && activeFile) {
      items = items.filter((item) => item.sourceFiles.has(activeFile.path));
    } else if (scopeMode === "active") {
      items = [];
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => item.filePath.toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      let result = 0;
      if (sortField === "count") {
        result = a.occurrenceCount - b.occurrenceCount;
      } else {
        const nameA = a.filePath.split("/").pop() || a.filePath;
        const nameB = b.filePath.split("/").pop() || b.filePath;
        result = nameA.localeCompare(nameB);
      }
      return sortDir === "asc" ? result : -result;
    });

    return items;
  }, [allLinks, scopeMode, activeFile, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = filteredItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const isAllPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedKeys.has(i.filePath));

  const toggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        pageItems.forEach((i) => next.delete(i.filePath));
      } else {
        pageItems.forEach((i) => next.add(i.filePath));
      }
      return next;
    });
  }, [isAllPageSelected, pageItems]);

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const createFiles = useCallback(async (keys: string[]) => {
    let createdCount = 0;
    let failedCount = 0;
    for (const key of keys) {
      const data = allLinks.get(key);
      if (!data) { failedCount++; continue; }
      try {
        const sourceFile = app.workspace.getActiveFile();
        const result = await plugin.fileOperations.createSingleFileFromLink(data.filePath, sourceFile?.path);
        if (result.success) {
          createdCount++;
          const fileName = result.path?.split("/").pop()?.replace(".md", "") || data.filePath;
          const message = data.ruleMatch?.name
            ? t("sideViewCreatedWithRule", { file: fileName, rule: data.ruleMatch.name })
            : t("sideViewCreatedNoRule", { file: fileName });
          new Notice(message, 3000);
        } else { failedCount++; }
      } catch { failedCount++; }
    }
    if (failedCount > 0) new Notice(`Failed to create ${failedCount} file(s).`);
    // Remove created from state
    setAllLinks((prev) => {
      const next = new Map(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, [allLinks, app, plugin]);

  const handleCreateSelected = useCallback(() => {
    if (selectedKeys.size === 0) {
      new Notice(t("dashboardNoLinksSelected"));
      return;
    }
    createFiles(Array.from(selectedKeys));
  }, [selectedKeys, createFiles]);

  const handleIgnore = useCallback(async (key: string) => {
    await plugin.fileOperations.addToIgnoreList(key);
    setAllLinks((prev) => { const next = new Map(prev); next.delete(key); return next; });
    setSelectedKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    const displayName = key.split("/").pop() || key;
    new Notice(t("sideViewIgnored", { file: displayName }));
  }, [plugin]);

  const handleSortChange = useCallback((value: string) => {
    const [f, d] = value.split("-");
    setSortField(f as SortField);
    setSortDir(d as SortDir);
  }, []);

  return (
    <div className="tw-flex tw-flex-col tw-h-full tw-w-full tw-p-3 tw-overflow-hidden">
      {/* Header */}
      <div className="tw-flex tw-flex-col tw-gap-3 tw-mb-3 tw-pb-3 tw-border-b tw-border-border">
        {/* Row 1: Title + Actions */}
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <h2 className="tw-m-0 tw-text-lg tw-font-semibold">{t("dashboardTitle")}</h2>
          <div className="tw-flex tw-gap-2">
            <Button onClick={handleCreateSelected} size="sm">
              <CheckSquare className="tw-h-4 tw-w-4 tw-mr-1" />
              {t("dashboardCreateSelected")}
            </Button>
            <Button variant="outline" size="icon" onClick={refreshData} title={t("dashboardRefreshTooltip")}>
              <RefreshCw className="tw-h-4 tw-w-4" />
            </Button>
          </div>
        </div>
        {/* Row 2: Search + Toolbar */}
        <div className="tw-flex tw-items-center tw-gap-2">
          <SearchBar
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
            placeholder={t("dashboardSearchPlaceholder")}
          />
          <Button
            variant={scopeMode === "active" ? "default" : "outline"}
            size="icon"
            onClick={() => {
              const next = scopeMode === "vault" ? "active" : "vault";
              setScopeMode(next);
              setCurrentPage(1);
              new Notice(t("dashboardScopeSwitched", { scope: next === "vault" ? t("dashboardScopeVault") : t("dashboardScopeActive") }));
            }}
            title={scopeMode === "vault" ? t("dashboardScopeVault") : t("dashboardScopeActive")}
          >
            {scopeMode === "vault" ? <Vault className="tw-h-4 tw-w-4" /> : <FileText className="tw-h-4 tw-w-4" />}
          </Button>
          <Select value={`${sortField}-${sortDir}`} onValueChange={handleSortChange}>
            <SelectTrigger className="tw-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count-desc">{t("dashboardSortCountDesc")}</SelectItem>
              <SelectItem value="count-asc">{t("dashboardSortCountAsc")}</SelectItem>
              <SelectItem value="name-asc">{t("dashboardSortNameAsc")}</SelectItem>
              <SelectItem value="name-desc">{t("dashboardSortNameDesc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="tw-flex tw-flex-col tw-gap-2 tw-p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="tw-h-10 tw-bg-muted tw-rounded tw-animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="tw-text-center tw-p-10 tw-text-muted-foreground tw-flex tw-flex-col tw-items-center tw-gap-2">
          <span className="tw-text-2xl">{searchQuery ? "🔍" : "🎉"}</span>
          <span className="tw-font-semibold">
            {searchQuery ? t("dashboardNoMatchesTitle") : t("dashboardAllClearTitle")}
          </span>
          <span className="tw-text-sm">
            {searchQuery ? t("dashboardNoMatchesDesc", { query: searchQuery }) : t("dashboardAllClearDesc")}
          </span>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <ScrollArea className="tw-flex-1">
          {/* List Header */}
          <div className="tw-grid tw-grid-cols-[40px_2fr_60px_2fr_80px] tw-items-center tw-p-2 tw-font-bold tw-bg-secondary tw-rounded-t-md tw-border tw-border-border tw-text-sm">
            <div className="tw-flex tw-justify-center">
              <Checkbox checked={isAllPageSelected} onCheckedChange={toggleSelectAll} />
            </div>
            <div>{t("dashboardColName")}</div>
            <div>{t("dashboardColRef")}</div>
            <div>{t("dashboardColPath")}</div>
            <div className="tw-text-right">{t("dashboardColActions")}</div>
          </div>

          {/* Items */}
          {pageItems.map((data) => (
            <DashboardListItem
              key={data.filePath}
              data={data}
              selected={selectedKeys.has(data.filePath)}
              onToggle={() => toggleSelect(data.filePath)}
              onCreate={() => createFiles([data.filePath])}
              onIgnore={() => handleIgnore(data.filePath)}
            />
          ))}
        </ScrollArea>
      )}

      {/* Footer */}
      {!loading && filteredItems.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          infoText={t("dashboardShowingRows", {
            start: String((safePage - 1) * ITEMS_PER_PAGE + 1),
            end: String(Math.min(safePage * ITEMS_PER_PAGE, filteredItems.length)),
            total: String(filteredItems.length),
            unit: t("dashboardUnitLinks"),
          })}
        />
      )}
    </div>
  );
}

interface DashboardListItemProps {
  data: MissingLinkData;
  selected: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onIgnore: () => void;
}

function DashboardListItem({ data, selected, onToggle, onCreate, onIgnore }: DashboardListItemProps) {
  const displayName = data.filePath.split("/").pop() || data.filePath;

  return (
    <div className="tw-grid tw-grid-cols-[40px_2fr_60px_2fr_80px] tw-items-center tw-p-2 tw-border-b tw-border-border tw-text-sm hover:tw-bg-muted/50">
      <div className="tw-flex tw-justify-center">
        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </div>
      <div className="tw-flex tw-items-center tw-gap-1">
        <span className="tw-font-medium tw-truncate" title={data.filePath}>{displayName}</span>
        {data.aliases.size > 0 && (
          <span className="tw-text-xs tw-text-muted-foreground">(+{data.aliases.size})</span>
        )}
      </div>
      <div>
        <CountBadge
          count={data.occurrenceCount}
          title={"Referenced in:\n" + Array.from(data.sourceFiles).join("\n")}
        />
      </div>
      <div className="tw-text-muted-foreground tw-truncate tw-text-xs" title={data.filePath}>
        {data.filePath}
      </div>
      <div className="tw-flex tw-justify-end tw-gap-1">
        <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={onIgnore} title={t("sideViewIgnoreTooltip")}>
          <EyeOff className="tw-h-3.5 tw-w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={onCreate} title={t("sideViewCreateTooltip")}>
          <Plus className="tw-h-3.5 tw-w-3.5" />
        </Button>
      </div>
    </div>
  );
}
