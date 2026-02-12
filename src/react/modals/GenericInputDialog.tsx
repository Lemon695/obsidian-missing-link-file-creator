import React, { useState } from "react";
import { t } from "@/i18n/locale";
import { Button } from "@/react/components/ui/button";
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
    <div className="tw-flex tw-flex-col tw-gap-4">
      <h2 className="tw-m-0 tw-text-lg tw-font-semibold">{header}</h2>
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
      <div className="tw-flex tw-flex-row-reverse tw-gap-2">
        <Button onClick={() => onConfirm(value)}>{t("confirm")}</Button>
        <Button variant="outline" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </div>
  );
}
