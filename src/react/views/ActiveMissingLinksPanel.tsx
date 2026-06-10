import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Notice, TFile } from "obsidian";
import { useObsidian, useActiveFile } from "@/react/context/ObsidianContext";
import { useObsidianEvent } from "@/react/bridge/useObsidianEvent";
import { MissingLinkData } from "@/utils/file-operations";
import { t } from "@/i18n/locale";
import {
  RefreshCw,
  FilePlus,
  Check,
  BookOpen,
  Zap,
  AlertTriangle,
  Link2Off,
  CheckCircle2,
} from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function ActiveMissingLinksPanel() {
  const { app, plugin } = useObsidian();
  const activeFile = useActiveFile(app);
  const [missingLinks, setMissingLinks] = useState<MissingLinkData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // 会话级「本次已创建」列表：创建后保留展示，随活跃文件切换重置
  const [createdItems, setCreatedItems] = useState<MissingLinkData[]>([]);
  // 防止批量创建时多次 setTimeout 叠加
  const scanTimerRef = useRef<number | null>(null);

  const scan = useCallback(() => {
    if (!activeFile) {
      setMissingLinks([]);
      return;
    }

    const links = app.metadataCache.getFileCache(activeFile)?.links || [];
    const ignoreList = plugin.ignoreListManager
      ? plugin.ignoreListManager.getIgnoreList()
      : (plugin.settings.ignoreList || []);

    const unresolvedLinks: MissingLinkData[] = [];

    for (const link of links) {
      const linkPath = link.link;
      const resolvedFile = app.metadataCache.getFirstLinkpathDest(linkPath, activeFile.path);

      if (!resolvedFile) {
        if (ignoreList.includes(linkPath)) continue;

        let count = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allUnresolved = (app.metadataCache as any).unresolvedLinks;
        for (const filePath in allUnresolved) {
          if (allUnresolved[filePath][linkPath]) {
            count += allUnresolved[filePath][linkPath];
          }
        }

        const baseName = linkPath.split("/").pop() || linkPath;
        const frontmatter = app.metadataCache.getFileCache(activeFile)?.frontmatter;
        const ruleMatch = plugin.fileOperations.matchRule(baseName, {
          frontmatter,
          sourcePath: activeFile.path,
        });

        unresolvedLinks.push({
          filePath: linkPath,
          aliases: new Set(),
          sourceFiles: new Set([activeFile.path]),
          occurrenceCount: count,
          ruleMatch:
            ruleMatch.matched && ruleMatch.rule
              ? { name: ruleMatch.rule.name, templatePath: ruleMatch.templatePath }
              : undefined,
        });
      }
    }

    setMissingLinks(unresolvedLinks);
  }, [activeFile, app, plugin]);

  // Scan on mount and when active file changes
  useEffect(() => { scan(); }, [scan]);

  // 切换活跃文件时重置会话选择与已创建段
  useEffect(() => {
    setSelected(new Set());
    setCreatedItems([]);
  }, [activeFile?.path]);

  // Re-scan when the active file is modified
  useObsidianEvent(app.vault, "modify", (file: TFile) => {
    if (activeFile && file.path === activeFile.path) scan();
  }, [activeFile, scan]);

  const createdPaths = useMemo(
    () => new Set(createdItems.map((c) => c.filePath)),
    [createdItems]
  );
  const pending = useMemo(
    () => missingLinks.filter((l) => !createdPaths.has(l.filePath)),
    [missingLinks, createdPaths]
  );
  const matched = useMemo(() => pending.filter((l) => l.ruleMatch), [pending]);
  const unmatched = useMemo(() => pending.filter((l) => !l.ruleMatch), [pending]);
  const selPending = useMemo(
    () => pending.filter((l) => selected.has(l.filePath)),
    [pending, selected]
  );

  const markCreated = useCallback((links: MissingLinkData[]) => {
    setCreatedItems((prev) => {
      const existing = new Set(prev.map((p) => p.filePath));
      const fresh = links.filter((l) => !existing.has(l.filePath));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      links.forEach((l) => next.delete(l.filePath));
      return next;
    });
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current = window.setTimeout(() => scan(), 100);
  }, [scan]);

  const handleCreate = useCallback(async (link: MissingLinkData) => {
    try {
      const result = await plugin.fileOperations.createSingleFileFromLink(
        link.filePath,
        activeFile?.path
      );
      if (result.success) {
        const fileName = result.path?.split("/").pop()?.replace(".md", "") || link.filePath;
        const message = link.ruleMatch?.name
          ? t("sideViewCreatedWithRule", { file: fileName, rule: link.ruleMatch.name })
          : t("sideViewCreatedNoRule", { file: fileName });
        new Notice(message);
        markCreated([link]);
      } else {
        new Notice(result.message || t("sideViewCreateFailed"));
      }
    } catch (e) {
      new Notice(t("failedToCreateFileMessage", { message: e.message }));
    }
  }, [plugin, activeFile, markCreated]);

  const createMany = useCallback(async (links: MissingLinkData[]) => {
    if (links.length === 0) return;
    const done: MissingLinkData[] = [];
    let failed = 0;
    for (const link of links) {
      try {
        const result = await plugin.fileOperations.createSingleFileFromLink(
          link.filePath,
          activeFile?.path
        );
        if (result.success) done.push(link);
        else failed++;
      } catch {
        failed++;
      }
    }
    if (done.length > 0) {
      new Notice(t("sideViewSectionCreated", { count: String(done.length) }));
      markCreated(done);
    }
    if (failed > 0) new Notice(t("sideViewCreateFailed"));
  }, [plugin, activeFile, markCreated]);

  const toggleSelect = useCallback((filePath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath); else next.add(filePath);
      return next;
    });
  }, []);

  return (
    <div className="ccmd-sidebar">
      {/* Header */}
      <div className="ccmd-sidebar__head">
        <div className="ccmd-sidebar__head-row">
          <Link2Off size={16} />
          <span className="ccmd-sidebar__title">{t("sideViewHeader")}</span>
          <span className="ccmd-badge ccmd-badge--count">{pending.length}</span>
          <span className="ccmd-sidebar__spacer" />
          <button className="ccmd-iconbtn ccmd-iconbtn--sm" onClick={scan} title={t("sideViewRefresh")} aria-label={t("sideViewRefresh")}>
            <RefreshCw />
          </button>
        </div>
        {activeFile && (
          <div className="ccmd-file-crumb">
            <BookOpen size={13} />
            <span className="ccmd-file-crumb__name">{activeFile.basename}</span>
          </div>
        )}
      </div>

      {/* Create-all CTA or empty state */}
      {!activeFile ? (
        <div className="ccmd-empty-state ccmd-empty-state--fill">
          <div className="ccmd-empty-state__title">{t("sideViewNoActiveFile")}</div>
          <div className="ccmd-empty-state__desc">{t("sideViewEmptyNoActive")}</div>
        </div>
      ) : pending.length > 0 ? (
        <div className="ccmd-sidebar__cta">
          <button className="ccmd-btn ccmd-btn--cta" onClick={() => createMany(pending)}>
            <Zap size={15} />
            {t("sideViewCreateAll", { count: String(pending.length) })}
          </button>
          <div className="ccmd-sidebar__cta-sub">
            {t("sideViewCreateAllSub", {
              matched: String(matched.length),
              unmatched: String(unmatched.length),
            })}
          </div>
        </div>
      ) : createdItems.length === 0 ? (
        <div className="ccmd-empty-state ccmd-empty-state--fill">
          <div className="ccmd-empty-state__icon ccmd-empty-state__icon--success">
            <CheckCircle2 size={24} strokeWidth={2.2} />
          </div>
          <div className="ccmd-empty-state__title">{t("sideViewEmptyAllClear")}</div>
          <div className="ccmd-empty-state__desc">{t("sideViewEmptyAllClearDesc")}</div>
        </div>
      ) : null}

      {/* Sections */}
      <div className="ccmd-sidebar__body ccmd-scroll">
        {matched.length > 0 && (
          <div className="ccmd-section-label">{t("sideViewSectionMatched")}</div>
        )}
        {matched.map((link) => (
          <LinkRow
            key={link.filePath}
            link={link}
            selected={selected.has(link.filePath)}
            onToggle={toggleSelect}
            onCreate={handleCreate}
          />
        ))}

        {unmatched.length > 0 && (
          <div className="ccmd-section-label">{t("sideViewSectionUnmatched")}</div>
        )}
        {unmatched.map((link) => (
          <LinkRow
            key={link.filePath}
            link={link}
            selected={selected.has(link.filePath)}
            onToggle={toggleSelect}
            onCreate={handleCreate}
          />
        ))}

        {createdItems.length > 0 && (
          <>
            <div className="ccmd-section-label">
              {t("sideViewSectionCreated", { count: String(createdItems.length) })}
            </div>
            {createdItems.map((link) => (
              <div key={link.filePath} className="ccmd-list__item ccmd-link-row--done">
                <Check size={14} />
                <span className="ccmd-link-row__main ccmd-link-row__title">{link.filePath}</span>
                <span className="ccmd-badge">{t("sideViewCreatedBadge")}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Selection bar */}
      {selPending.length > 0 && (
        <div className="ccmd-select-bar">
          <span className="ccmd-select-bar__count">
            {t("sideViewSelectedCount", { count: String(selPending.length) })}
          </span>
          <span className="ccmd-sidebar__spacer" />
          <button className="ccmd-btn ccmd-btn--sm" onClick={() => setSelected(new Set())}>
            {t("sideViewClearSelection")}
          </button>
          <button className="ccmd-btn ccmd-btn--cta ccmd-btn--sm" onClick={() => createMany(selPending)}>
            <FilePlus size={13} />
            {t("sideViewCreateSelected")}
          </button>
        </div>
      )}
    </div>
  );
}

interface LinkRowProps {
  link: MissingLinkData;
  selected: boolean;
  onToggle: (filePath: string) => void;
  onCreate: (link: MissingLinkData) => void;
}

function LinkRow({ link, selected, onToggle, onCreate }: LinkRowProps) {
  const [creating, setCreating] = useState(false);
  const rule = link.ruleMatch;
  const templateTail = rule?.templatePath
    ? rule.templatePath.split("/").pop()?.replace(/\.md$/, "")
    : undefined;

  return (
    <div
      className={cx("ccmd-list__item ccmd-link-row", selected && "ccmd-list__item--selected")}
      onClick={() => onToggle(link.filePath)}
    >
      <span
        className={cx("ccmd-check ccmd-link-row__check", selected && "ccmd-check--on")}
        data-state={selected ? "checked" : "unchecked"}
      >
        <Check />
      </span>

      <div className="ccmd-link-row__main">
        <div className="ccmd-link-row__title">{link.filePath}</div>
        <div className="ccmd-link-row__meta">
          {rule ? (
            <>
              <span className="ccmd-badge ccmd-badge--accent">{rule.name}</span>
              {templateTail && <span className="ccmd-link-row__folder">{templateTail}</span>}
            </>
          ) : (
            <span className="ccmd-link-row__norule">
              <AlertTriangle size={11} />
              {t("sideViewNoRule")}
            </span>
          )}
          {link.occurrenceCount > 1 && (
            <span
              className="ccmd-badge ccmd-badge--count"
              title={`${t("dashboardColRef")}: ${link.occurrenceCount}`}
            >
              {link.occurrenceCount}
            </span>
          )}
        </div>
      </div>

      <button
        className="ccmd-iconbtn ccmd-iconbtn--sm"
        disabled={creating}
        title={t("sideViewCreateTooltip")}
        aria-label={t("sideViewCreateTooltip")}
        onClick={(e) => {
          e.stopPropagation();
          setCreating(true);
          onCreate(link);
          setCreating(false);
        }}
      >
        <FilePlus size={14} />
      </button>
    </div>
  );
}
