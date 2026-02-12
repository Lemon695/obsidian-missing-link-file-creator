import React, { useState, useCallback, useMemo } from "react";
import { Notice } from "obsidian";
import { CreationResult, FileToCreate } from "@/model/file-types";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
import { Checkbox } from "@/react/components/ui/checkbox";
import { Progress } from "@/react/components/ui/progress";
import { ScrollArea } from "@/react/components/ui/scroll-area";
import { Pagination } from "@/react/components/shared/Pagination";
import { CheckSquare } from "lucide-react";

type Phase = "select" | "progress" | "done";

interface CreationConfirmDialogProps {
  files: FileToCreate[];
  onConfirm: (files: FileToCreate[]) => Promise<boolean | { success: boolean; message?: string }>;
  onCancel: () => void;
  onClose: () => void;
}

export function CreationConfirmDialog({ files, onConfirm, onCancel, onClose }: CreationConfirmDialogProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [fileStates, setFileStates] = useState(() => files.map((f) => ({ ...f })));
  const [currentPage, setCurrentPage] = useState(1);
  const [result, setResult] = useState<CreationResult>({ created: 0, skipped: 0, failed: 0, aliasesAdded: 0 });
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(fileStates.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageFiles = fileStates.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const selectedCount = fileStates.filter((f) => f.selected).length;
  const isAllPageSelected = pageFiles.length > 0 && pageFiles.every((f) => f.selected);
  const isSomePageSelected = pageFiles.some((f) => f.selected);

  const toggleAll = useCallback(() => {
    const newVal = !isAllPageSelected;
    setFileStates((prev) => {
      const pageStart = (safePage - 1) * itemsPerPage;
      const pageEnd = safePage * itemsPerPage;
      return prev.map((f, i) => (i >= pageStart && i < pageEnd ? { ...f, selected: newVal } : f));
    });
  }, [isAllPageSelected, safePage, itemsPerPage]);

  const toggleFile = useCallback((index: number) => {
    setFileStates((prev) => prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f)));
  }, []);

  const handleConfirm = useCallback(async () => {
    const selected = fileStates.filter((f) => f.selected);
    if (selected.length === 0) {
      new Notice(t("pleaseSelectAtLeastOneFile"));
      return;
    }

    setPhase("progress");
    setProgressTotal(selected.length);

    const res: CreationResult = { created: 0, skipped: 0, failed: 0, aliasesAdded: 0 };
    const batchSize = 5;

    for (let i = 0; i < selected.length; i += batchSize) {
      const batch = selected.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          try {
            const result = await onConfirm([file]);
            const ok = typeof result === "boolean" ? result : result?.success;
            if (ok) {
              res.created++;
              res.aliasesAdded += file.aliases.length;
            } else {
              res.skipped++;
            }
          } catch {
            res.failed++;
          }
        })
      );
      setProgressCurrent(Math.min(i + batchSize, selected.length));
      setResult({ ...res });
    }

    setResult({ ...res });
    setPhase("done");

    // Auto-close after 10s
    setTimeout(() => onClose(), 10000);
  }, [fileStates, onConfirm, onClose]);

  const percent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  // === SELECT PHASE ===
  if (phase === "select") {
    return (
      <div className="tw-flex tw-flex-col tw-gap-4">
        <h2 className="tw-text-lg tw-font-semibold tw-m-0">{t("createFiles")}</h2>
        <p className="tw-text-sm tw-text-muted-foreground tw-m-0">
          {t("linksDetected", { count: String(fileStates.length) })}
        </p>

        {/* File table */}
        <ScrollArea className="tw-h-[430px] tw-border tw-border-border tw-rounded-md">
          <table className="tw-w-full tw-text-sm">
            <thead>
              <tr className="tw-border-b tw-bg-secondary">
                <th className="tw-w-10 tw-p-2 tw-text-center">
                  <Checkbox
                    checked={isAllPageSelected ? true : isSomePageSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="tw-p-2 tw-text-left tw-w-1/4">{t("filename")}</th>
                <th className="tw-p-2 tw-text-left tw-w-[35%]">{t("path")}</th>
                <th className="tw-p-2 tw-text-left">{t("aliases", { count: "" }).replace(": ", "")}</th>
                <th className="tw-p-2 tw-text-left tw-w-[15%]">{t("matchedRule")}</th>
              </tr>
            </thead>
            <tbody>
              {pageFiles.map((file, pageIdx) => {
                const globalIdx = (safePage - 1) * itemsPerPage + pageIdx;
                return (
                  <tr key={globalIdx} className="tw-border-b tw-border-border hover:tw-bg-muted/50">
                    <td className="tw-p-2 tw-text-center">
                      <Checkbox checked={file.selected} onCheckedChange={() => toggleFile(globalIdx)} />
                    </td>
                    <td className="tw-p-2 tw-truncate" title={file.filename}>{file.filename}</td>
                    <td className="tw-p-2 tw-truncate tw-text-muted-foreground" title={file.path}>{file.path}</td>
                    <td className="tw-p-2 tw-truncate">{file.aliases.length > 0 ? file.aliases.join(", ") : "-"}</td>
                    <td className="tw-p-2 tw-truncate">{file.matchedRule || <span className="tw-text-muted-foreground tw-italic">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>

        {/* Pagination */}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          infoText={t("page", {
            current: String(safePage),
            total: String(totalPages),
            fileCount: String(fileStates.length),
            selectedCount: String(selectedCount),
          })}
        />

        {/* Buttons */}
        <div className="tw-flex tw-justify-end tw-gap-3 tw-mt-2">
          <Button variant="outline" onClick={onCancel}>{t("cancel")}</Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            {t("createSelectedFiles")}
          </Button>
        </div>
      </div>
    );
  }

  // === PROGRESS / DONE PHASE ===
  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-py-6">
      <h2 className="tw-text-lg tw-font-semibold tw-m-0">
        {phase === "done" ? t("fileCreationCompleted", { total: String(result.created + result.skipped + result.failed) }) : t("creatingFilesProgress")}
      </h2>

      <span className="tw-text-5xl tw-font-bold tw-text-primary">{percent}%</span>

      <Progress value={percent} className="tw-w-full tw-h-3" />

      <span className="tw-text-base tw-text-muted-foreground">
        {t("creatingFilesStatus", { current: String(progressCurrent), total: String(progressTotal) })}
      </span>

      {/* Stats grid */}
      <div className="tw-grid tw-grid-cols-2 tw-gap-4 tw-w-full tw-mt-4">
        <StatItem icon="✅" label={t("successfullyCreated", { count: String(result.created) })} color="tw-border-l-green-500" />
        <StatItem icon="⏭️" label={t("skipped", { count: String(result.skipped) })} color="tw-border-l-yellow-500" />
        <StatItem icon="❌" label={t("failed", { count: String(result.failed) })} color="tw-border-l-red-500" />
        <StatItem icon="🏷️" label={t("aliases", { count: String(result.aliasesAdded) })} color="tw-border-l-blue-500" />
      </div>

      {phase === "done" && (
        <Button onClick={onClose} className="tw-mt-4">{t("close")}</Button>
      )}
    </div>
  );
}

function StatItem({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className={`tw-flex tw-items-center tw-gap-3 tw-p-3 tw-bg-secondary tw-rounded-md tw-border-l-4 ${color}`}>
      <span className="tw-text-xl">{icon}</span>
      <span className="tw-text-sm">{label}</span>
    </div>
  );
}
