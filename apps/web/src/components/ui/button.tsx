"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const variants = {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_16px_50px_-24px_hsl(var(--primary)/0.75)] hover:bg-primary/90 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_20px_60px_-22px_hsl(var(--primary)/0.9)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_14px_44px_-24px_hsl(var(--destructive)/0.8)] hover:bg-destructive/90",
        outline:
          "border border-white/10 bg-white/[0.025] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary",
        secondary:
          "border border-white/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-muted-foreground hover:bg-white/[0.055] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-7 text-[0.95rem]",
        icon: "h-10 w-10",
      },
    };

    const baseClasses = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
      variants.variant[variant],
      variants.size[size],
      className,
    );

    if (asChild) {
      const child = React.Children.only(children);
      if (!React.isValidElement(child)) {
        return null;
      }

      // Never forward `children` here: the child already owns its content.
      // Passing it again replaces the child's children with the child itself
      // (e.g. a <Link> rendering an <a> inside an <a>).
      const childClassName = (
        child as React.ReactElement<{ className?: string }>
      ).props?.className;

      return React.cloneElement(child as React.ReactElement<any>, {
        ...props,
        ref,
        className: cn(baseClasses, childClassName),
      });
    }

    return (
      <button className={baseClasses} ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
