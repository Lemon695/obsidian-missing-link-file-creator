import React, { useMemo, useState } from "react";
import { t } from "@/i18n/locale";
import { Search, X } from "lucide-react";

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
    <div className="ccmd-dialog">
      <div className="ccmd-dialog__head ccmd-dialog__head-row">
        <h2 className="ccmd-modal__title">{title || t("selectTemplate")}</h2>
        {onClose && (
          <button className="ccmd-modal__close" onClick={onClose} title={t("close")} aria-label={t("close")}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="ccmd-search">
        <Search />
        <input
          type="text"
          value={query}
          placeholder={t("searchTemplatesPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="ccmd-card ccmd-scroll ccmd-picker-list ccmd-template-list">
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
      </div>
    </div>
  );
}
