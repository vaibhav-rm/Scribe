"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  className,
  label,
  error,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground/80"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 hover:border-white/15 focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
