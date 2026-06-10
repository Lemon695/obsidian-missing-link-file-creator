import React, { useState, useCallback, useEffect, useRef } from "react";
import { Notice } from "obsidian";
import { CreationResult, FileToCreate } from "@/model/file-types";
import { t } from "@/i18n/locale";
import { Checkbox } from "@/react/components/ui/checkbox";
import { Pagination } from "@/react/components/shared/Pagination";
import { CheckCircle2, SkipForward, XCircle, Tag } from "lucide-react";

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
  const autoCloseTimerRef = useRef<number | null>(null);

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

    const res: CreationResult = { created: 0, skipped: 0, failed: 0, aliasesAdded: 0, createdPaths: [] };
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
              res.createdPaths!.push(file.path);
            } else {
              res.skipped++;
            }
          } catch {
            res.failed++;
          }
        })
      );
      // 进度按已完成（成功+跳过+失败）数量显示，而非批次偏移量
      setProgressCurrent(res.created + res.skipped + res.failed);
      setResult({ ...res });
    }

    setResult({ ...res });
    setPhase("done");

    // Auto-close after 10s
    autoCloseTimerRef.current = window.setTimeout(() => onClose(), 10000);
  }, [fileStates, onConfirm, onClose]);

  const percent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === "select" && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleConfirm();
        return;
      }

      if (e.key !== "Escape") return;
      e.preventDefault();

      if (phase === "select") {
        onCancel();
      } else if (phase === "done") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, handleConfirm, onCancel, onClose]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // === SELECT PHASE ===
  if (phase === "select") {
    const aliasHeader = t("aliases", { count: "" }).replace(": ", "");
    return (
      <div className="ccmd-dialog ccmd-dialog--fill">
        <div className="ccmd-dialog__head">
          <h2 className="ccmd-modal__title">{t("createFiles")}</h2>
          <p className="ccmd-modal__subtitle">{t("linksDetected", { count: String(fileStates.length) })}</p>
        </div>

        {/* File table */}
        <div className="ccmd-create-table ccmd-scroll">
          <div className="ccmd-create-row ccmd-create-row--head">
            <span className="ccmd-create-row__check">
              <Checkbox
                checked={isAllPageSelected ? true : isSomePageSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
              />
            </span>
            <span className="ccmd-create-row__cell">{t("filename")}</span>
            <span className="ccmd-create-row__cell">{t("path")}</span>
            <span className="ccmd-create-row__cell">{aliasHeader}</span>
            <span className="ccmd-create-row__cell">{t("matchedRule")}</span>
          </div>
          {pageFiles.map((file, pageIdx) => {
            const globalIdx = (safePage - 1) * itemsPerPage + pageIdx;
            return (
              <div key={globalIdx} className="ccmd-create-row">
                <span className="ccmd-create-row__check">
                  <Checkbox checked={file.selected} onCheckedChange={() => toggleFile(globalIdx)} />
                </span>
                <span className="ccmd-create-row__cell" title={file.filename}>{file.filename}</span>
                <span className="ccmd-create-row__cell ccmd-create-row__muted" title={file.path}>{file.path}</span>
                <span className="ccmd-create-row__cell">{file.aliases.length > 0 ? file.aliases.join(", ") : "-"}</span>
                <span className="ccmd-create-row__cell">
                  {file.matchedRule || <span className="ccmd-create-row__faint">-</span>}
                </span>
              </div>
            );
          })}
        </div>

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
        <div className="ccmd-dialog__foot ccmd-dialog__foot--end">
          <button className="ccmd-btn" onClick={onCancel}>{t("cancel")}</button>
          <button className="ccmd-btn ccmd-btn--cta" onClick={handleConfirm} disabled={selectedCount === 0}>
            {t("createSelectedFiles")}
          </button>
        </div>
      </div>
    );
  }

  // === PROGRESS / DONE PHASE ===
  return (
    <div className="ccmd-dialog ccmd-dialog--fill ccmd-create-progress">
      <h2 className="ccmd-modal__title">
        {phase === "done"
          ? t("fileCreationCompleted", { total: String(result.created + result.skipped + result.failed) })
          : t("creatingFilesProgress")}
      </h2>

      <span className="ccmd-create-progress__pct">{percent}%</span>

      <div className="ccmd-meter ccmd-create-progress__bar">
        <div className="ccmd-meter__fill" style={{ ["--meter" as string]: `${percent}%` } as React.CSSProperties} />
      </div>

      <span className="ccmd-create-progress__status">
        {t("creatingFilesStatus", { current: String(progressCurrent), total: String(progressTotal) })}
      </span>

      {/* Stats grid */}
      <div className="ccmd-create-stats">
        <StatItem kind="success" icon={<CheckCircle2 size={18} />} label={t("successfullyCreated", { count: String(result.created) })} />
        <StatItem kind="skip" icon={<SkipForward size={18} />} label={t("skipped", { count: String(result.skipped) })} />
        <StatItem kind="fail" icon={<XCircle size={18} />} label={t("failed", { count: String(result.failed) })} />
        <StatItem kind="alias" icon={<Tag size={18} />} label={t("aliases", { count: String(result.aliasesAdded) })} />
      </div>

      {phase === "done" && (
        <button className="ccmd-btn ccmd-btn--cta" onClick={onClose}>{t("close")}</button>
      )}
    </div>
  );
}

function StatItem({ kind, icon, label }: { kind: "success" | "skip" | "fail" | "alias"; icon: React.ReactNode; label: string }) {
  return (
    <div className="ccmd-create-stat" data-kind={kind}>
      <span className="ccmd-create-stat__icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
