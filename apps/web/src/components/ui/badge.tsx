"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "destructive";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default:
      "border-primary/25 bg-primary/12 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]",
    secondary: "border-border bg-secondary text-secondary-foreground",
    outline: "border-border bg-transparent text-muted-foreground",
    success: "border-success/25 bg-success/10 text-success",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    destructive: "border-destructive/25 bg-destructive/12 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
