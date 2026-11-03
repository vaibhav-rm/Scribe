"use client";

import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Scribe home"
    >
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.45),0_10px_30px_-12px_hsl(var(--primary)/0.8)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
        <span className="absolute inset-0 bg-[linear-gradient(135deg,hsl(0_0%_100%/0.35),transparent_48%)]" />
        <span className="relative font-display text-[17px] font-bold leading-none">
          S
        </span>
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-electric shadow-[0_0_8px_hsl(var(--electric)/0.9)]" />
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">
          Scribe<span className="text-primary">.</span>
        </span>
      )}
    </Link>
  );
}
