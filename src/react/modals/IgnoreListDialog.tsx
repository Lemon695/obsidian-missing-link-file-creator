import React, { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/react/hooks/useDebounce";
import { Notice } from "obsidian";
import { useObsidian } from "@/react/context/ObsidianContext";
import { t } from "@/i18n/locale";
import { ignoreSettingsI18n } from "@/i18n/modules/ignore/settings";
import { Trash2, List, Search } from "lucide-react";

interface IgnoreListDialogProps {
  onClose: () => void;
}

export function IgnoreListDialog({ onClose }: IgnoreListDialogProps) {
  const { plugin } = useObsidian();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  const i18n = useMemo(() => t(ignoreSettingsI18n), []);

  const allItems = useMemo(
    () => plugin.ignoreListManager?.getIgnoreList() ?? [],
    [plugin.ignoreListManager, forceUpdate]
  );

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter((item) => item.toLowerCase().includes(q));
  }, [allItems, debouncedSearch]);

  const handleRemove = useCallback(
    async (item: string) => {
      await plugin.ignoreListManager?.remove(item);
      new Notice(i18n.itemRemoved);
      refresh();
    },
    [plugin, i18n, refresh]
  );

  const handleClearAll = useCallback(async () => {
    // eslint-disable-next-line no-alert
    if (!confirm(i18n.confirmClearAll)) return;
    await plugin.ignoreListManager?.clear();
    new Notice(i18n.listCleared);
    setSearchQuery("");
    refresh();
  }, [plugin, i18n, refresh]);

  return (
    <div className="ccmd-dialog ccmd-dialog--fill">
      <div className="ccmd-dialog__head">
        <h2 className="ccmd-modal__title">{i18n.dialogTitle}</h2>
        <p className="ccmd-modal__subtitle">{i18n.listCount(allItems.length)}</p>
      </div>

      <div className="ccmd-search">
        <Search />
        <input
          type="text"
          value={searchQuery}
          placeholder={i18n.searchPlaceholder}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="ccmd-dialog__list ccmd-scroll">
        {allItems.length === 0 && (
          <div className="ccmd-empty-state ccmd-empty-state--fill">
            <div className="ccmd-empty-state__icon"><List size={24} /></div>
            <div className="ccmd-empty-state__desc">{i18n.emptyList}</div>
          </div>
        )}

        {allItems.length > 0 && filteredItems.length === 0 && (
          <div className="ccmd-empty-state ccmd-empty-state--fill">
            <div className="ccmd-empty-state__desc">{i18n.noMatchingItems(debouncedSearch)}</div>
          </div>
        )}

        {filteredItems.map((item) => (
          <div key={item} className="ccmd-ignore-item">
            <span className="ccmd-ignore-item__path" title={item}>{item}</span>
            <button
              className="ccmd-iconbtn ccmd-iconbtn--sm ccmd-iconbtn--danger"
              onClick={() => handleRemove(item)}
              title={i18n.removeItem}
              aria-label={i18n.removeItem}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="ccmd-dialog__foot ccmd-dialog__foot--between">
        <button className="ccmd-btn ccmd-btn--danger" onClick={handleClearAll} disabled={allItems.length === 0}>
          <Trash2 size={14} />
          {i18n.clearAll}
        </button>
        <button className="ccmd-btn" onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}
