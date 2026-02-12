import React from "react";
import { cn } from "@/react/lib/utils";

interface CountBadgeProps {
  count: number;
  title?: string;
  className?: string;
}

export function CountBadge({ count, title, className }: CountBadgeProps) {
  let colorClass = "tw-bg-muted tw-text-muted-foreground";
  if (count >= 10) colorClass = "tw-bg-destructive tw-text-destructive-foreground";
  else if (count >= 5) colorClass = "tw-bg-orange-500 tw-text-white";
  else if (count >= 3) colorClass = "tw-bg-yellow-500 tw-text-white";

  return (
    <span
      className={cn(
        "tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-px-2 tw-py-0.5 tw-text-xs tw-font-bold tw-min-w-[20px]",
        colorClass,
        className
      )}
      title={title}
    >
      {count}
    </span>
  );
}
