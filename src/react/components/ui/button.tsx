import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "ccmd-btn--cta",
  destructive: "ccmd-btn--danger",
  outline: "",
  secondary: "",
  ghost: "ccmd-btn--ghost",
  link: "ccmd-btn--ghost",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  default: "",
  sm: "ccmd-btn--sm",
  lg: "",
  icon: "",
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

interface ButtonVariantOptions {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
}

function buttonVariants({
  variant,
  size,
  className,
}: ButtonVariantOptions = {}): string {
  const v: ButtonVariant = variant ?? "default";
  const s: ButtonSize = size ?? "default";
  // size=icon 切换为方形图标按钮基类
  if (s === "icon") {
    return cx(
      "ccmd-iconbtn",
      v === "destructive" && "ccmd-iconbtn--danger",
      className
    );
  }
  return cx("ccmd-btn", VARIANT_CLASS[v], SIZE_CLASS[s], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
