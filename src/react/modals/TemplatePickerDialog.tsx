import React, { useMemo, useState } from "react";
import { t } from "@/i18n/locale";
import { Input } from "@/react/components/ui/input";
import { ScrollArea } from "@/react/components/ui/scroll-area";

interface TemplatePickerDialogProps {
  templates: string[];
  onChoose: (path: string) => void;
  title?: string;
  onClose?: () => void;
}

export function TemplatePickerDialog({ templates, onChoose, title, onClose }: TemplatePickerDialogProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((item) => item.toLowerCase().includes(q));
  }, [templates, query]);

  return (
    <div className="tw-flex tw-flex-col tw-gap-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
        <h2 className="tw-m-0 tw-text-lg tw-font-semibold">{title || t("selectTemplate")}</h2>
        {onClose && (
          <button
            type="button"
            className="tw-text-sm tw-text-muted-foreground hover:tw-text-foreground"
            onClick={onClose}
            aria-label={t("close")}
          >
            {t("close")}
          </button>
        )}
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchTemplatesPlaceholder")}
        className="ccmd-template-search-input"
        autoFocus
      />

      <ScrollArea className="ccmd-template-list tw-border tw-border-border tw-rounded-md">
        {templates.length === 0 && (
          <div className="ccmd-no-templates">{t("noTemplateFilesFound")}</div>
        )}

        {templates.length > 0 && filtered.length === 0 && (
          <div className="ccmd-no-templates">{t("noMatchingTemplates")}</div>
        )}

        {filtered.map((templatePath) => (
          <div
            key={templatePath}
            className="ccmd-template-item"
            title={templatePath}
            onClick={() => onChoose(templatePath)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChoose(templatePath);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {templatePath}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
