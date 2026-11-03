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
      "border-primary/20 bg-primary/12 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]",
    secondary:
      "border-white/10 bg-white/[0.055] text-foreground/85",
    outline: "border-white/12 bg-transparent text-muted-foreground",
    success:
      "border-primary/20 bg-primary/10 text-primary",
    warning:
      "border-amber-400/20 bg-amber-400/10 text-amber-200",
    destructive:
      "border-destructive/25 bg-destructive/12 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
