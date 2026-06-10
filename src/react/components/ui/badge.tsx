import * as React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "ccmd-badge--accent",
  secondary: "ccmd-badge--muted",
  destructive: "ccmd-badge--warn",
  outline: "",
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

interface BadgeVariantOptions {
  variant?: BadgeVariant | null;
  className?: string;
}

function badgeVariants({ variant, className }: BadgeVariantOptions = {}): string {
  const v: BadgeVariant = variant ?? "default";
  return cx("ccmd-badge", VARIANT_CLASS[v], className);
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={badgeVariants({ variant, className })} {...props} />;
}

export { Badge, badgeVariants };
