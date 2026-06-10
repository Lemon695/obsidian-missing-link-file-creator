import React, { useState } from "react";
import { t } from "@/i18n/locale";
import { Input } from "@/react/components/ui/input";

interface GenericInputDialogProps {
  header: string;
  placeholder?: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function GenericInputDialog({
  header,
  placeholder,
  initialValue,
  onConfirm,
  onCancel,
}: GenericInputDialogProps) {
  const [value, setValue] = useState(initialValue ?? "");

  return (
    <div className="ccmd-dialog">
      <h2 className="ccmd-modal__title">{header}</h2>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? ""}
        autoFocus
        onKeyDown={(evt) => {
          if (evt.key === "Enter") {
            evt.preventDefault();
            onConfirm(value);
          }
          if (evt.key === "Escape") {
            evt.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="ccmd-dialog__foot ccmd-dialog__foot--end">
        <button className="ccmd-btn" onClick={onCancel}>{t("cancel")}</button>
        <button className="ccmd-btn ccmd-btn--cta" onClick={() => onConfirm(value)}>{t("confirm")}</button>
      </div>
    </div>
  );
}
