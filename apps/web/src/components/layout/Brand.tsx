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
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[4px] border border-primary/40 bg-primary text-primary-foreground shadow-[3px_3px_0_hsl(var(--ink)/0.5)] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-[1.03]">
        <span className="absolute inset-0 bg-[linear-gradient(135deg,hsl(0_0%_100%/0.32),transparent_50%)]" />
        <span className="absolute inset-x-1 top-1 h-px bg-primary-foreground/25" />
        <span className="relative font-display text-[17px] font-extrabold leading-none">
          S
        </span>
        <span className="absolute bottom-1 right-1 h-1 w-1 rounded-[1px] bg-electric shadow-[0_0_8px_hsl(var(--electric)/0.9)]" />
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">
          Scribe<span className="text-primary">.</span>
        </span>
      )}
    </Link>
  );
}
