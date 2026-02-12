import React, { useState, useCallback, useEffect } from "react";
import { Notice, TFile } from "obsidian";
import { useObsidian, useActiveFile } from "@/react/context/ObsidianContext";
import { useObsidianEvent } from "@/react/bridge/useObsidianEvent";
import { MissingLinkData } from "@/utils/file-operations";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
import { ScrollArea } from "@/react/components/ui/scroll-area";
import { CountBadge } from "@/react/components/shared/CountBadge";
import { RefreshCw, Plus, EyeOff } from "lucide-react";

export function ActiveMissingLinksPanel() {
  const { app, plugin } = useObsidian();
  const activeFile = useActiveFile(app);
  const [missingLinks, setMissingLinks] = useState<MissingLinkData[]>([]);

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

  // Re-scan when the active file is modified
  useObsidianEvent(app.vault, "modify", (file: TFile) => {
    if (activeFile && file.path === activeFile.path) scan();
  }, [activeFile, scan]);

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
        setTimeout(() => scan(), 100);
      } else {
        new Notice(result.message || t("sideViewCreateFailed"));
      }
    } catch (e: any) {
      new Notice(t("failedToCreateFileMessage", { message: e.message }));
    }
  }, [plugin, activeFile, scan]);

  const handleIgnore = useCallback(async (link: MissingLinkData) => {
    await plugin.fileOperations.addToIgnoreList(link.filePath);
    scan();
    new Notice(t("sideViewIgnored", { file: link.filePath }));
  }, [plugin, scan]);

  return (
    <div className="tw-flex tw-flex-col tw-h-full tw-p-2.5">
      {/* Header */}
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-pb-2.5 tw-border-b tw-border-border">
        <h4 className="tw-m-0 tw-text-sm tw-font-semibold">{t("sideViewHeader")}</h4>
        <Button variant="ghost" size="icon" onClick={scan} title={t("sideViewRefresh")}>
          <RefreshCw className="tw-h-4 tw-w-4" />
        </Button>
      </div>

      {/* Active file label */}
      <div className="tw-text-xs tw-text-muted-foreground tw-italic tw-mb-2.5">
        {activeFile ? activeFile.basename : t("sideViewNoActiveFile")}
      </div>

      {/* Content */}
      <ScrollArea className="tw-flex-1">
        {!activeFile && (
          <div className="tw-text-center tw-p-5 tw-text-muted-foreground">
            {t("sideViewEmptyNoActive")}
          </div>
        )}

        {activeFile && missingLinks.length === 0 && (
          <div className="tw-text-center tw-p-5 tw-text-muted-foreground tw-flex tw-flex-col tw-items-center tw-gap-2">
            <span className="tw-text-2xl">🎉</span>
            <span>{t("sideViewEmptyAllClear")}</span>
          </div>
        )}

        {missingLinks.length > 0 && (
          <div className="tw-flex tw-flex-col tw-gap-2">
            {missingLinks.map((link) => (
              <LinkItem
                key={link.filePath}
                link={link}
                onCreate={handleCreate}
                onIgnore={handleIgnore}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface LinkItemProps {
  link: MissingLinkData;
  onCreate: (link: MissingLinkData) => void;
  onIgnore: (link: MissingLinkData) => void;
}

function LinkItem({ link, onCreate, onIgnore }: LinkItemProps) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="tw-flex tw-justify-between tw-items-center tw-px-2.5 tw-py-1.5 tw-bg-background tw-border tw-border-border tw-rounded-md tw-gap-2 hover:tw-bg-secondary/50">
      <div className="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-min-w-0">
        <span className="tw-flex-1 tw-overflow-hidden tw-text-ellipsis tw-whitespace-nowrap tw-text-sm">
          {link.filePath}
        </span>
        <CountBadge
          count={link.occurrenceCount}
          title={`${t("dashboardColRef")}: ${link.occurrenceCount}`}
        />
      </div>
      <div className="tw-flex tw-gap-1 tw-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="tw-h-7 tw-w-7"
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            await onCreate(link);
            setCreating(false);
          }}
          title={t("sideViewCreateTooltip")}
        >
          <Plus className="tw-h-3.5 tw-w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="tw-h-7 tw-w-7"
          onClick={() => onIgnore(link)}
          title={t("sideViewIgnoreTooltip")}
        >
          <EyeOff className="tw-h-3.5 tw-w-3.5" />
        </Button>
      </div>
    </div>
  );
}
