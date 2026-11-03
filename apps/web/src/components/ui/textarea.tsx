"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  className,
  label,
  error,
  id,
  ...props
}: TextareaProps) {
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
      <textarea
        id={id}
        className={cn(
          "flex min-h-[100px] w-full resize-y rounded-md border border-border bg-background/60 px-3.5 py-3 text-sm text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
