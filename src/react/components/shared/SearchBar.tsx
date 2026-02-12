import React from "react";
import { Input } from "@/react/components/ui/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, className }: SearchBarProps) {
  return (
    <div className={`tw-relative tw-flex-1 ${className || ""}`}>
      <Search className="tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-h-4 tw-w-4 tw-text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tw-pl-9"
      />
    </div>
  );
}
