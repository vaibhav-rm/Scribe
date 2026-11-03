"use client";

import { cn } from "@/lib/utils";

export function OrbitMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center",
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full border border-primary/25" />
      <span className="absolute inset-[3px] rounded-full border border-electric/25" />
      <span className="absolute inset-0 animate-orbit rounded-full">
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.9)]" />
      </span>
      <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.9)]" />
    </span>
  );
}

export function PageLoader({
  label = "Loading workspace",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        compact ? "min-h-[42vh]" : "min-h-[70vh]",
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <OrbitMark />
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Preparing the page
          </p>
        </div>
      </div>
    </div>
  );
}
