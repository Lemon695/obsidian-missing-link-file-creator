import React, { useState, useCallback } from "react";
import { useObsidian } from "@/react/context/ObsidianContext";
import { RuleManager } from "@/model/rule-manager";
import { t } from "@/i18n/locale";
import { Input } from "@/react/components/ui/input";
import { CheckCircle, XCircle } from "lucide-react";

interface RuleTestDialogProps {
  onClose: () => void;
}

export function RuleTestDialog({ onClose }: RuleTestDialogProps) {
  const { plugin } = useObsidian();
  const [fileName, setFileName] = useState("");
  const [tested, setTested] = useState(false);

  const ruleManager = new RuleManager(plugin.app, plugin.settings);
  const result = tested && fileName.trim()
    ? ruleManager.matchRule(fileName.trim())
    : null;

  const handleTest = useCallback(() => {
    setTested(true);
  }, []);

  return (
    <div className="ccmd-dialog ccmd-dialog--fill">
      <div className="ccmd-dialog__head">
        <h2 className="ccmd-modal__title">{t("ruleTestDialogTitle")}</h2>
      </div>

      <div className="ccmd-field">
        <label className="ccmd-field__label">{t("ruleTestInputLabel")}</label>
        <div className="ccmd-field__row">
          <Input
            placeholder={t("ruleTestInputPlaceholder")}
            value={fileName}
            onChange={(e) => { setFileName(e.target.value); setTested(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleTest(); }}
            autoFocus
          />
          <button className="ccmd-btn ccmd-btn--cta" onClick={handleTest} disabled={!fileName.trim()}>
            {t("ruleTestResult")}
          </button>
        </div>
      </div>

      {tested && fileName.trim() && (
        <div className="ccmd-testresult">
          {result?.matched ? (
            <>
              <div className="ccmd-testresult__hit">
                <CheckCircle size={17} />
                <span>{t("ruleTestMatchedRule")}: <strong>{result.rule?.name}</strong></span>
              </div>
              <div className="ccmd-testresult__grid">
                <span className="ccmd-testresult__key">{t("ruleTestTargetFolder")}</span>
                <span className="ccmd-codetag">
                  {result.targetFolder || plugin.settings.defaultFolderPath || t("ruleTestDefaultFolder")}
                </span>
                <span className="ccmd-testresult__key">{t("ruleTestTemplate")}</span>
                <span className="ccmd-codetag">{result.templatePath || "—"}</span>
                {result.extraFrontmatter && Object.keys(result.extraFrontmatter).length > 0 && (
                  <>
                    <span className="ccmd-testresult__key">{t("extraFrontmatter")}</span>
                    <div className="ccmd-preview__fm">
                      {Object.entries(result.extraFrontmatter).map(([k, v]) => (
                        <span key={k} className="ccmd-codetag">{k}: {v}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="ccmd-testresult__miss">
              <XCircle size={17} />
              <span>{t("ruleTestNoMatch")}</span>
            </div>
          )}
        </div>
      )}

      <div className="ccmd-dialog__foot ccmd-dialog__foot--end ccmd-dialog__foot--push">
        <button className="ccmd-btn" onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}
