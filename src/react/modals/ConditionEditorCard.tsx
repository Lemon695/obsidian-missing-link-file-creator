import React, { useCallback, useRef, useEffect } from "react";
import { MatchCondition, ConditionMatchType, ConditionOperator } from "@/model/condition-types";
import { t } from "@/i18n/locale";
import { useObsidian } from "@/react/context/ObsidianContext";
import { Input } from "@/react/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/react/components/ui/select";
import { Trash2 } from "lucide-react";
import { FrontmatterPropertySuggester } from "@/settings/suggesters/frontmatter-property-suggester";
import { FrontmatterValueSuggester } from "@/settings/suggesters/frontmatter-value-suggester";

interface ConditionEditorCardProps {
  condition: MatchCondition;
  onChange: (condition: MatchCondition) => void;
  onDelete: () => void;
}

const OPERATOR_OPTIONS = [
  { value: ConditionOperator.AND, label: "AND" },
  { value: ConditionOperator.OR, label: "OR" },
  { value: ConditionOperator.NOT, label: "NOT" },
  { value: ConditionOperator.EXCLUDE, label: "EXCLUDE" },
];

const MATCH_TYPE_OPTIONS = [
  { value: ConditionMatchType.CONTAINS, label: "contains" },
  { value: ConditionMatchType.STARTS_WITH, label: "begins with" },
  { value: ConditionMatchType.ENDS_WITH, label: "ends with" },
  { value: ConditionMatchType.EXACT, label: "matches" },
  { value: ConditionMatchType.REGEX, label: "regex" },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: "filename", label: "Filename" },
  { value: "frontmatter", label: "Frontmatter" },
];

function getPropertyTypeFromCondition(type: ConditionMatchType): string {
  return type === ConditionMatchType.FRONTMATTER ? "frontmatter" : "filename";
}

function getConditionTypeFromPropertyType(value: string, currentType: ConditionMatchType): ConditionMatchType {
  if (value === "frontmatter") return ConditionMatchType.FRONTMATTER;
  if (currentType !== ConditionMatchType.FRONTMATTER) return currentType;
  return ConditionMatchType.CONTAINS;
}

/** Hook to attach an Obsidian Suggester to a native input ref */
function useSuggester<T>(
  ref: React.RefObject<HTMLInputElement | null>,
  factory: (el: HTMLInputElement) => T,
  deps: unknown[]
): React.MutableRefObject<T | null> {
  const instanceRef = useRef<T | null>(null);
  useEffect(() => {
    if (ref.current) {
      instanceRef.current = factory(ref.current);
    }
    return () => { instanceRef.current = null; };
  }, deps);
  return instanceRef;
}

export function ConditionEditorCard({ condition, onChange, onDelete }: ConditionEditorCardProps) {
  const { app } = useObsidian();
  const isFrontmatter = condition.type === ConditionMatchType.FRONTMATTER;

  const propertyInputRef = useRef<HTMLInputElement | null>(null);
  const valueInputRef = useRef<HTMLInputElement | null>(null);

  // Attach FrontmatterPropertySuggester
  useSuggester(
    propertyInputRef,
    (el) => new FrontmatterPropertySuggester(app, el),
    [app, isFrontmatter]
  );

  // Attach FrontmatterValueSuggester
  const valueSuggesterRef = useSuggester(
    valueInputRef,
    (el) => new FrontmatterValueSuggester(app, el, condition.property || ""),
    [app, isFrontmatter, condition.property]
  );

  const update = useCallback((patch: Partial<MatchCondition>) => {
    onChange({ ...condition, ...patch });
  }, [condition, onChange]);

  const handlePropertyTypeChange = useCallback((value: string) => {
    const newType = getConditionTypeFromPropertyType(value, condition.type);
    const patch: Partial<MatchCondition> = { type: newType };
    if (value !== "frontmatter") {
      patch.property = undefined;
      patch.frontmatterMatchType = undefined;
    }
    update(patch);
  }, [condition.type, update]);

  return (
    <div className="ccmd-cond-card" data-op={condition.operator}>
      {/* Header: operator + delete */}
      <div className="ccmd-cond-card__head">
        <div className="ccmd-cond-card__head-left">
          <span className="ccmd-cond-card__label">{t("conditionLabel")}</span>
          <Select value={condition.operator} onValueChange={(v) => update({ operator: v as ConditionOperator })}>
            <SelectTrigger className="ccmd-cond-card__op">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          className="ccmd-iconbtn ccmd-iconbtn--sm ccmd-iconbtn--danger"
          onClick={onDelete}
          title={t("delete")}
          aria-label={t("delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body: property type + match type + pattern */}
      <div className="ccmd-cond-card__body">
        {/* Property type */}
        <Select value={getPropertyTypeFromCondition(condition.type)} onValueChange={handlePropertyTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Frontmatter: property name input */}
        {isFrontmatter && (
          <Input
            ref={propertyInputRef}
            placeholder={t("propertyName")}
            value={condition.property || ""}
            onChange={(e) => {
              update({ property: e.target.value });
              if (valueSuggesterRef.current) {
                valueSuggesterRef.current.updatePropertyName(e.target.value);
              }
            }}
          />
        )}

        {/* Match type */}
        <Select
          value={isFrontmatter ? (condition.frontmatterMatchType || ConditionMatchType.EXACT) : condition.type}
          onValueChange={(v) => {
            if (isFrontmatter) {
              update({ frontmatterMatchType: v as ConditionMatchType });
            } else {
              update({ type: v as ConditionMatchType });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pattern / value input */}
        <Input
          ref={isFrontmatter ? valueInputRef : undefined}
          className="ccmd-cond-card__pattern"
          placeholder={isFrontmatter ? t("propertyValue") : t("textToMatch")}
          value={condition.pattern}
          onChange={(e) => update({ pattern: e.target.value })}
        />
      </div>
    </div>
  );
}
