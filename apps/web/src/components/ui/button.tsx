"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", asChild = false, children, ...props },
    ref,
  ) => {
    const variants = {
      variant: {
        default: "bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium shadow-sm hover:bg-primary/90 transition-colors",
        destructive: "bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-medium shadow-sm hover:bg-destructive/90 transition-colors",
        outline: "border border-input bg-background px-4 py-2 rounded-md font-medium shadow-sm hover:bg-accent transition-colors",
        secondary: "bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium shadow-sm hover:bg-secondary/80 transition-colors",
        ghost: "text-foreground hover:bg-accent hover:text-foreground px-4 py-2 rounded-md font-medium transition-colors",
        link: "text-primary underline-offset-4 hover:underline font-medium transition-colors",
      },
      size: {
        default: "h-10 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    };

    const baseClasses = cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
