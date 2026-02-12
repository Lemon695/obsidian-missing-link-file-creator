import React, { useState, useCallback, useRef, useEffect } from "react";
import { App } from "obsidian";
import { MatchCondition, ConditionMatchType, ConditionOperator } from "@/model/condition-types";
import { t } from "@/i18n/locale";
import { useObsidian } from "@/react/context/ObsidianContext";
import { Button } from "@/react/components/ui/button";
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

const OPERATOR_COLORS: Record<string, string> = {
  [ConditionOperator.AND]: "tw-border-l-blue-500",
  [ConditionOperator.OR]: "tw-border-l-green-500",
  [ConditionOperator.NOT]: "tw-border-l-yellow-500",
  [ConditionOperator.EXCLUDE]: "tw-border-l-red-500",
};

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
  const borderColor = OPERATOR_COLORS[condition.operator] || "tw-border-l-blue-500";

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
    <div className={`tw-p-4 tw-mb-3 tw-rounded-md tw-border tw-border-border tw-border-l-4 ${borderColor} tw-bg-secondary/30`}>
      {/* Header: operator + delete */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <div className="tw-flex tw-items-center tw-gap-2">
          <span className="tw-text-sm tw-font-medium">Condition</span>
          <Select value={condition.operator} onValueChange={(v) => update({ operator: v as ConditionOperator })}>
            <SelectTrigger className="tw-w-[110px] tw-h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7 tw-text-destructive" onClick={onDelete}>
          <Trash2 className="tw-h-3.5 tw-w-3.5" />
        </Button>
      </div>

      {/* Body: property type + match type + pattern */}
      <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
        {/* Property type */}
        <Select value={getPropertyTypeFromCondition(condition.type)} onValueChange={handlePropertyTypeChange}>
          <SelectTrigger className="tw-w-[130px] tw-h-8">
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
            className="tw-w-[140px] tw-h-8"
            placeholder="Property name"
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
          <SelectTrigger className="tw-w-[120px] tw-h-8">
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
          className="tw-flex-1 tw-min-w-[140px] tw-h-8"
          placeholder={isFrontmatter ? "Property value" : "Text to match"}
          value={condition.pattern}
          onChange={(e) => update({ pattern: e.target.value })}
        />
      </div>
    </div>
  );
}
